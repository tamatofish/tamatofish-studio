import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { requireAuth } from '@/lib/server-auth';
import {
  readActions,
  writeActions,
  addActionRequest,
  readActionRequests,
  updateActionRequest,
  ActionAccessRequest,
} from '@/lib/file-store';

/* GET /api/actions/access-request */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const { ctx } = auth;

  const list = await readActionRequests();

  if (ctx.role === 'admin') {
    return NextResponse.json({ requests: list });
  }
  const mine = list.filter(
    (r) => r.requesterId === ctx.userId || r.requesterName === ctx.email,
  );
  return NextResponse.json({ requests: mine });
}

/* POST /api/actions/access-request */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const { ctx } = auth;

  const body = (await req.json().catch(() => null)) as
    | { code?: string; reason?: string }
    | null;
  const codeRaw = (body?.code ?? '').trim().toUpperCase();
  if (!codeRaw) return NextResponse.json({ error: '请填写档案编号' }, { status: 400 });

  const allActions = await readActions();
  const action = allActions.find((a) => (a.code ?? '').toUpperCase() === codeRaw);
  if (!action) return NextResponse.json({ error: '未找到该编号对应的档案' }, { status: 404 });

  if (action.level === 'public') {
    return NextResponse.json({ error: '该档案为「公开」，无需申请' }, { status: 400 });
  }

  const vt = action.visibleTo ?? [];
  if (vt.includes(ctx.userId) || vt.includes(ctx.email)) {
    return NextResponse.json({ error: '你已拥有访问权限' }, { status: 400 });
  }

  const existingRequests = await readActionRequests();
  const existing = existingRequests.find(
    (r) => r.actionId === action.id && r.requesterId === ctx.userId && r.status !== 'rejected',
  );
  if (existing) {
    return NextResponse.json(
      { error: existing.status === 'approved' ? '你已拥有访问权限' : '你已提交过申请，请等待管理员处理' },
      { status: 409 },
    );
  }

  /* 从 internal_members 补全申请人信息，方便审核时写入 visibleTo */
  const { data: me } = await ctx.client
    .from('internal_members')
    .select('user_id, email, name, member_no')
    .eq('user_id', ctx.userId)
    .maybeSingle();

  const record: ActionAccessRequest = {
    id: crypto.randomUUID(),
    actionId: action.id,
    actionCode: action.code,
    actionCodename: action.codename,
    requesterId: ctx.userId,
    requesterName: ctx.email,
    /* 把能拿到的身份标识存进 reason 之外的扩展字段（若类型不允许，就只保留 requesterId/Name） */
    reason: (body?.reason ?? '').trim() || undefined,
    status: 'pending',
    createdAt: Date.now(),
  };

  await addActionRequest(record);
  return NextResponse.json({ request: record });
}

/* PATCH /api/actions/access-request */
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const { ctx } = auth;

  if (ctx.role !== 'admin') {
    return NextResponse.json({ error: '仅管理员可审核' }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as
    | { id?: string; action?: 'approve' | 'reject' }
    | null;
  const id = body?.id;
  const action = body?.action;
  if (!id || !action) return NextResponse.json({ error: '参数不完整' }, { status: 400 });

  const allRequests = await readActionRequests();
  const target = allRequests.find((r) => r.id === id);
  if (!target) return NextResponse.json({ error: '申请不存在' }, { status: 404 });
  if (target.status !== 'pending') {
    return NextResponse.json({ error: '该申请已处理' }, { status: 400 });
  }

  if (action === 'approve') {
    const all = await readActions();
    const idx = all.findIndex((a) => a.id === target.actionId);
    if (idx === -1) return NextResponse.json({ error: '档案已不存在' }, { status: 404 });

    /* 从 internal_members 查申请人完整信息 */
    const { data: requesterMember } = await ctx.client
      .from('internal_members')
      .select('user_id, email, name, member_no')
      .eq('user_id', target.requesterId)
      .maybeSingle();

    /* 把申请人所有可能的标识都写进 visibleTo */
    const candidates = new Set<string>();
    if (target.requesterId) candidates.add(target.requesterId);
    if (target.requesterName) candidates.add(target.requesterName);
    if (requesterMember?.user_id) candidates.add(requesterMember.user_id);
    if (requesterMember?.email) candidates.add(requesterMember.email);
    if (requesterMember?.name) candidates.add(requesterMember.name);
    if (requesterMember?.member_no) candidates.add(requesterMember.member_no);

    const vt = all[idx].visibleTo ?? [];
    const next = Array.from(new Set([...vt, ...Array.from(candidates)]));
    all[idx] = { ...all[idx], visibleTo: next };
    await writeActions(all);
  }

  const updated = await updateActionRequest(id, {
    status: action === 'approve' ? 'approved' : 'rejected',
    reviewedBy: ctx.email,
    reviewedAt: Date.now(),
  });

  return NextResponse.json({ request: updated });
}