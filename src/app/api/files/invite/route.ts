import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { requireAuth } from '@/lib/server-auth';
import {
  readFiles,
  updateFile,
  addInvite,
  readInvites,
  updateInvite,
  FileViewInvite,
} from '@/lib/file-store';

/* GET /api/files/invite */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const { ctx } = auth;

  const list = readInvites();

  if (ctx.role === 'admin') {
    return NextResponse.json({ invites: list });
  }
  const mine = list.filter((i) => i.inviteeId === ctx.userId);
  return NextResponse.json({ invites: mine });
}

/* POST /api/files/invite */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const { ctx } = auth;

  if (ctx.role !== 'admin') {
    return NextResponse.json({ error: '仅管理员可操作' }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as
    | { fileId?: string; invitees?: { userId: string; name: string; email?: string }[] }
    | null;
  const fileId = body?.fileId;
  const invitees = body?.invitees ?? [];

  if (!fileId) return NextResponse.json({ error: '缺少文件 id' }, { status: 400 });
  if (invitees.length === 0) return NextResponse.json({ error: '请至少选择一位邀请对象' }, { status: 400 });

  const file = readFiles().find((f) => f.id === fileId);
  if (!file) return NextResponse.json({ error: '文件不存在' }, { status: 404 });
  if (file.level !== 'secret') {
    return NextResponse.json({ error: '仅「绝密」文件可邀请查看' }, { status: 400 });
  }

  const existing = readInvites();
  const created: FileViewInvite[] = [];

  for (const inv of invitees) {
    if (!inv.userId || !inv.name) continue;
    const dup = existing.find(
      (e) => e.fileId === file.id && e.inviteeId === inv.userId && e.status !== 'declined',
    );
    if (dup) continue;

    const record: FileViewInvite = {
      id: crypto.randomUUID(),
      fileId: file.id,
      fileCode: file.code,
      fileName: file.displayName || file.name,
      inviteeId: inv.userId,
      inviteeName: inv.name,
      inviteeEmail: inv.email,
      inviterName: ctx.email,
      status: 'pending',
      createdAt: Date.now(),
    };
    addInvite(record);
    created.push(record);
  }

  return NextResponse.json({ ok: true, created });
}

/* PATCH /api/files/invite */
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const { ctx } = auth;

  const body = (await req.json().catch(() => null)) as
    | { id?: string; action?: 'accept' | 'decline' }
    | null;
  const id = body?.id;
  const action = body?.action;
  if (!id || !action) return NextResponse.json({ error: '参数不完整' }, { status: 400 });

  const target = readInvites().find((r) => r.id === id);
  if (!target) return NextResponse.json({ error: '邀请不存在' }, { status: 404 });
  if (target.inviteeId !== ctx.userId) {
    return NextResponse.json({ error: '无权处理该邀请' }, { status: 403 });
  }
  if (target.status !== 'pending') {
    return NextResponse.json({ error: '该邀请已处理' }, { status: 400 });
  }

  if (action === 'accept') {
    const file = readFiles().find((f) => f.id === target.fileId);
    if (!file) return NextResponse.json({ error: '文件已不存在' }, { status: 404 });
    const vt = file.visibleTo ?? [];
    const next = Array.from(new Set([...vt, target.inviteeName]));
    updateFile(file.id, { visibleTo: next });
  }

  const updated = updateInvite(id, {
    status: action === 'accept' ? 'accepted' : 'declined',
    respondedAt: Date.now(),
  });

  return NextResponse.json({ invite: updated });
}