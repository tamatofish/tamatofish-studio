import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { requireAuth } from '@/lib/server-auth';
import {
  readActions,
  writeActions,
  readActionInvites,
  writeActionInvites,
  updateActionInvite,
  type ActionViewInvite,
} from '@/lib/file-store';

/* GET /api/actions/invite */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const { ctx } = auth;

  const list = readActionInvites();
  if (ctx.role === 'admin') {
    return NextResponse.json({ invites: list });
  }
  const mine = list.filter(
    (inv) => inv.inviteeId === ctx.userId || inv.inviteeId === ctx.email,
  );
  return NextResponse.json({ invites: mine });
}

/* POST /api/actions/invite */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const { ctx } = auth;

  if (ctx.role !== 'admin') {
    return NextResponse.json({ error: '仅管理员可邀请' }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        actionId?: string;
        invitees?: { userId: string; name: string; email?: string; memberNo?: string }[];
      }
    | null;
  if (!body?.actionId || !Array.isArray(body.invitees) || body.invitees.length === 0) {
    return NextResponse.json({ error: '参数不完整' }, { status: 400 });
  }

  const allActions = readActions();
  const targetAction = allActions.find((a) => a.id === body.actionId);
  if (!targetAction) {
    return NextResponse.json({ error: '档案不存在' }, { status: 404 });
  }

  const all = readActionInvites();
  const created: ActionViewInvite[] = [];

  for (const inv of body.invitees) {
    const exists = all.find(
      (x) =>
        x.actionId === body.actionId &&
        x.inviteeId === inv.userId &&
        x.status !== 'declined',
    );
    if (exists) continue;

    const record: ActionViewInvite = {
      id: crypto.randomUUID(),
      actionId: body.actionId,
      actionCode: targetAction.code,
      actionCodename: targetAction.codename,
      inviteeId: inv.userId,
      inviteeName: inv.name,
      inviterName: ctx.email,
      status: 'pending',
      createdAt: Date.now(),
    };
    created.push(record);
  }

  if (created.length === 0) {
    return NextResponse.json({ ok: true, invites: [] });
  }

  writeActionInvites([...all, ...created]);
  return NextResponse.json({ ok: true, invites: created });
}

/* PATCH /api/actions/invite */
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const { ctx } = auth;

  const body = (await req.json().catch(() => null)) as
    | {
        id?: string;
        action?: 'accept' | 'decline';
        revoke?: boolean;
        actionId?: string;
        inviteeId?: string;
      }
    | null;

  /* ===== 管理员撤回 ===== */
  if (body?.revoke) {
    if (ctx.role !== 'admin') {
      return NextResponse.json({ error: '仅管理员可撤回' }, { status: 403 });
    }
    if (!body.actionId || !body.inviteeId) {
      return NextResponse.json({ error: '参数不完整' }, { status: 400 });
    }

    /* 1) 从 visibleTo 里移除该用户的所有可能标识 */
    const allActions = readActions();
    const idx = allActions.findIndex((a) => a.id === body.actionId);
    if (idx !== -1) {
      const vt = allActions[idx].visibleTo ?? [];

      /* 找出这条邀请对应的完整身份信息 */
      const inv = readActionInvites().find(
        (x) => x.actionId === body.actionId && x.inviteeId === body.inviteeId,
      );

      const toRemove = new Set<string>();
      toRemove.add(body.inviteeId);
      if (inv?.inviteeName) toRemove.add(inv.inviteeName);

      const next = vt.filter((v) => !toRemove.has(v));
      allActions[idx] = { ...allActions[idx], visibleTo: next };
      writeActions(allActions);
    }

    /* 2) 把邀请标记为 declined */
    const all = readActionInvites();
    const target = all.find(
      (inv) =>
        inv.actionId === body.actionId &&
        inv.inviteeId === body.inviteeId &&
        inv.status !== 'declined',
    );
    if (!target) {
      return NextResponse.json({ error: '未找到该邀请记录' }, { status: 404 });
    }
    const updated = updateActionInvite(target.id, {
      status: 'declined',
      respondedAt: Date.now(),
    });
    return NextResponse.json({ invite: updated });
  }

  /* ===== 用户接受/拒绝 ===== */
  if (!body?.id || !body.action) {
    return NextResponse.json({ error: '参数不完整' }, { status: 400 });
  }

  const target = readActionInvites().find((inv) => inv.id === body.id);
  if (!target) {
    return NextResponse.json({ error: '邀请不存在' }, { status: 404 });
  }
  if (target.inviteeId !== ctx.userId && ctx.role !== 'admin') {
    return NextResponse.json({ error: '无权操作' }, { status: 403 });
  }
  if (target.status !== 'pending') {
    return NextResponse.json({ error: '该邀请已处理' }, { status: 400 });
  }

  /* 接受时写入 visibleTo —— 把能拿到的所有标识全写进去 */
  if (body.action === 'accept') {
    const allActions = readActions();
    const idx = allActions.findIndex((a) => a.id === target.actionId);
    if (idx !== -1) {
      /* 从 internal_members 查这个邀请对象的完整信息 */
      const { data: inviteeMember } = await ctx.client
        .from('internal_members')
        .select('user_id, email, name, member_no')
        .eq('user_id', target.inviteeId)
        .maybeSingle();

      const candidates = new Set<string>();
      if (target.inviteeId) candidates.add(target.inviteeId);
      if (target.inviteeName) candidates.add(target.inviteeName);
      if (inviteeMember?.user_id) candidates.add(inviteeMember.user_id);
      if (inviteeMember?.email) candidates.add(inviteeMember.email);
      if (inviteeMember?.name) candidates.add(inviteeMember.name);
      if (inviteeMember?.member_no) candidates.add(inviteeMember.member_no);

      const vt = allActions[idx].visibleTo ?? [];
      const next = Array.from(new Set([...vt, ...Array.from(candidates)]));
      allActions[idx] = { ...allActions[idx], visibleTo: next };
      writeActions(allActions);
    }
  }

  const updated = updateActionInvite(target.id, {
    status: body.action === 'accept' ? 'accepted' : 'declined',
    respondedAt: Date.now(),
  });

  return NextResponse.json({ invite: updated });
}