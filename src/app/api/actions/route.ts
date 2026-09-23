import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { requireAuth } from '@/lib/server-auth';
import {
  addAction,
  readActions,
  writeActions,
  deleteAction,
  generateActionCode,
  readActionInvites,
  ActionRecord,
  ActionLevel,
} from '@/lib/file-store';

async function getMyRole(client: any, userId: string): Promise<'admin' | 'staff' | null> {
  const { data: member } = await client
    .from('internal_members')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();
  if (!member) return null;
  return member.role === 'admin' ? 'admin' : 'staff';
}

async function isDefenseMember(client: any, userId: string): Promise<boolean> {
  const { data: member } = await client
    .from('internal_members')
    .select('department')
    .eq('user_id', userId)
    .maybeSingle();
  if (!member) return false;
  const depts = (member.department ?? '')
    .split(/[,，;；]/)
    .map((s: string) => s.trim())
    .filter(Boolean);
  return depts.includes('综合防务部');
}

/** GET /api/actions */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const { ctx } = auth;

  const role = await getMyRole(ctx.client, ctx.userId);

  if (role === 'admin') {
    return NextResponse.json({ actions: readActions(), role: 'admin' });
  }

  const isDefense = await isDefenseMember(ctx.client, ctx.userId);
  if (!isDefense) {
    return NextResponse.json({ error: '仅综合防务部成员可访问' }, { status: 403 });
  }

  /* 从 internal_members 查出当前用户所有标识 */
  const { data: me } = await ctx.client
    .from('internal_members')
    .select('user_id, email, name, member_no')
    .eq('user_id', ctx.userId)
    .maybeSingle();

  const identifiers = new Set<string>();
  if (ctx.userId) identifiers.add(ctx.userId);
  if (ctx.email) identifiers.add(ctx.email);
  if (me?.user_id) identifiers.add(me.user_id);
  if (me?.email) identifiers.add(me.email);
  if (me?.name) identifiers.add(me.name);
  if (me?.member_no) identifiers.add(me.member_no);
  const idList = Array.from(identifiers);

  /* 拉取当前用户所有 accepted 的邀请，作为 visibleTo 之外的兜底 */
  const myAcceptedActionIds = new Set(
    readActionInvites()
      .filter(
        (inv) =>
          inv.status === 'accepted' &&
          (idList.includes(inv.inviteeId) || idList.includes(inv.inviteeName)),
      )
      .map((inv) => inv.actionId),
  );

  const all = readActions();
  const visible = all.filter((a) => {
    const vt = a.visibleTo ?? [];
    if (vt.some((v) => idList.includes(v))) return true;
    if (myAcceptedActionIds.has(a.id)) return true;
    if (a.level === 'public') return true;
    if (a.level === 'confidential') return false;
    return false;
  });

  return NextResponse.json({ actions: visible, role: 'staff' });
}

/** POST /api/actions */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const { ctx } = auth;

  const isDefense = await isDefenseMember(ctx.client, ctx.userId);
  if (!isDefense) {
    return NextResponse.json({ error: '仅综合防务部成员可访问' }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        codename?: string;
        actionTime?: number;
        team?: string;
        airSupport?: boolean;
        infoSupport?: boolean;
        description?: string;
      }
    | null;

  const codename = (body?.codename ?? '').trim();
  const actionTime = body?.actionTime ?? Date.now();
  const team = (body?.team ?? '').trim();
  const airSupport = !!body?.airSupport;
  const infoSupport = !!body?.infoSupport;
  const description = (body?.description ?? '').trim();

  if (!codename) return NextResponse.json({ error: '请填写行动代号' }, { status: 400 });
  if (!team) return NextResponse.json({ error: '请填写小组' }, { status: 400 });
  if (!/^[A-Z]+$/.test(team)) {
    return NextResponse.json({ error: '小组只能输入大写英文字母' }, { status: 400 });
  }

  const record: ActionRecord = {
    id: crypto.randomUUID(),
    code: generateActionCode(actionTime),
    codename,
    actionTime,
    team,
    airSupport,
    infoSupport,
    description,
    level: 'secret',
    visibleTo: [],
    creatorId: ctx.userId,
    creatorName: ctx.email,
    createdAt: Date.now(),
  };

  addAction(record);
  return NextResponse.json({ action: record });
}

/** PATCH /api/actions —— 仅管理员 */
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const { ctx } = auth;

  const role = await getMyRole(ctx.client, ctx.userId);
  if (role !== 'admin') {
    return NextResponse.json({ error: '仅管理员可修改档案' }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        id?: string;
        codename?: string;
        actionTime?: number;
        team?: string;
        airSupport?: boolean;
        infoSupport?: boolean;
        description?: string;
        level?: ActionLevel;
        visibleTo?: string[];
      }
    | null;

  const id = body?.id;
  if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 });

  const all = readActions();
  const idx = all.findIndex((a) => a.id === id);
  if (idx === -1) return NextResponse.json({ error: '档案不存在' }, { status: 404 });

  const target = all[idx];
  const patch: Partial<ActionRecord> = {};

  if (body.codename !== undefined) {
    const v = body.codename.trim();
    if (!v) return NextResponse.json({ error: '行动代号不能为空' }, { status: 400 });
    patch.codename = v;
  }
  if (body.actionTime !== undefined) patch.actionTime = body.actionTime;
  if (body.team !== undefined) {
    const v = body.team.trim();
    if (!/^[A-Z]+$/.test(v)) {
      return NextResponse.json({ error: '小组只能输入大写英文字母' }, { status: 400 });
    }
    patch.team = v;
  }
  if (body.airSupport !== undefined) patch.airSupport = !!body.airSupport;
  if (body.infoSupport !== undefined) patch.infoSupport = !!body.infoSupport;
  if (body.description !== undefined) patch.description = body.description.trim();
  if (body.level !== undefined) {
    if (!['public', 'confidential', 'secret'].includes(body.level)) {
      return NextResponse.json({ error: '等级不合法' }, { status: 400 });
    }
    patch.level = body.level;
  }
  if (body.visibleTo !== undefined) patch.visibleTo = body.visibleTo;

  const updated: ActionRecord = { ...target, ...patch };
  all[idx] = updated;
  writeActions(all);

  return NextResponse.json({ action: updated });
}

/** DELETE /api/actions?id=xxx —— 仅管理员 */
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const { ctx } = auth;

  const role = await getMyRole(ctx.client, ctx.userId);
  if (role !== 'admin') {
    return NextResponse.json({ error: '仅管理员可删除档案' }, { status: 403 });
  }

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 });

  const removed = deleteAction(id);
  if (!removed) return NextResponse.json({ error: '档案不存在' }, { status: 404 });
  return NextResponse.json({ ok: true });
}