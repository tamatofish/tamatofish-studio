import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { requireAuth } from '@/lib/server-auth';
import {
  readFiles,
  updateFile,
  addRequest,
  readRequests,
  updateRequest,
  FileAccessRequest,
} from '@/lib/file-store';

/* GET /api/files/access-request */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const { ctx } = auth;

  const list = readRequests();

  if (ctx.role === 'admin') {
    return NextResponse.json({ requests: list });
  }
  const mine = list.filter((r) => r.requesterId === ctx.userId);
  return NextResponse.json({ requests: mine });
}

/* POST /api/files/access-request */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const { ctx } = auth;

  const body = (await req.json().catch(() => null)) as
    | { code?: string; reason?: string }
    | null;
  const codeRaw = (body?.code ?? '').trim().toUpperCase();
  if (!codeRaw) return NextResponse.json({ error: '请填写文件编号' }, { status: 400 });

  const file = readFiles().find((f) => (f.code ?? '').toUpperCase() === codeRaw);
  if (!file) return NextResponse.json({ error: '未找到该编号对应的文件' }, { status: 404 });
  if (file.status !== 'approved') {
    return NextResponse.json({ error: '该文件尚未通过审核，无法申请' }, { status: 400 });
  }
  if (file.level !== 'confidential') {
    return NextResponse.json({ error: '该文件非机密等级，无需申请' }, { status: 400 });
  }

  const vt = file.visibleTo ?? [];
  if (vt.length === 0) {
    return NextResponse.json({ error: '该文件为公开，无需申请' }, { status: 400 });
  }
  if (vt.includes(ctx.email) || vt.includes(ctx.userId)) {
    return NextResponse.json({ error: '你已有访问权限' }, { status: 400 });
  }

  const existing = readRequests().find(
    (r) => r.fileId === file.id && r.requesterId === ctx.userId && r.status !== 'rejected',
  );
  if (existing) {
    return NextResponse.json(
      { error: existing.status === 'approved' ? '你已有访问权限' : '你已提交过申请，请等待管理员处理' },
      { status: 409 },
    );
  }

  const record: FileAccessRequest = {
    id: crypto.randomUUID(),
    fileId: file.id,
    fileCode: file.code,
    fileName: file.displayName || file.name,
    requesterId: ctx.userId,
    requesterName: ctx.email,
    reason: (body?.reason ?? '').trim() || undefined,
    status: 'pending',
    createdAt: Date.now(),
  };

  addRequest(record);
  return NextResponse.json({ request: record });
}

/* PATCH /api/files/access-request */
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
  if (!id || !action) {
    return NextResponse.json({ error: '参数不完整' }, { status: 400 });
  }

  const target = readRequests().find((r) => r.id === id);
  if (!target) return NextResponse.json({ error: '申请不存在' }, { status: 404 });
  if (target.status !== 'pending') {
    return NextResponse.json({ error: '该申请已处理' }, { status: 400 });
  }

  if (action === 'approve') {
    const file = readFiles().find((f) => f.id === target.fileId);
    if (!file) return NextResponse.json({ error: '文件不存在' }, { status: 404 });
    const vt = file.visibleTo ?? [];
    const next = Array.from(new Set([...vt, target.requesterName]));
    updateFile(file.id, { visibleTo: next });
  }

  const updated = updateRequest(id, {
    status: action === 'approve' ? 'approved' : 'rejected',
    reviewedBy: ctx.email,
    reviewedAt: Date.now(),
  });

  return NextResponse.json({ request: updated });
}