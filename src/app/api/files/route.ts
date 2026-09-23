import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  addFile,
  readFiles,
  updateFile,
  deleteFile,
  generateFileCode,
  FileRecord,
  FileLevel,
} from '@/lib/file-store';
import { requireAuth } from '@/lib/server-auth';

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const { ctx } = auth;

  const files = readFiles();

  if (ctx.role === 'admin') {
    const status = new URL(req.url).searchParams.get('status');
    const list = status ? files.filter((f) => f.status === status) : files;
    return NextResponse.json({ files: list, role: 'console' });
  }

  const own = files.filter((f) => f.uploaderId === ctx.userId);
  return NextResponse.json({ files: own, role: 'admin' });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const { ctx } = auth;

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const displayNameRaw = (formData.get('displayName') as string | null) ?? '';
  const levelRaw = (formData.get('level') as string | null) ?? 'internal';

  if (!file) return NextResponse.json({ error: '未选择文件' }, { status: 400 });
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: '文件不能超过 10MB' }, { status: 413 });
  }

  const displayName = displayNameRaw.trim() || file.name;

  // 只接受 public / internal / confidential（绝密由管理员手动设置）
  const allowedLevels: FileLevel[] = ['public', 'internal', 'confidential'];
  const level: FileLevel = (allowedLevels.includes(levelRaw as FileLevel) ? levelRaw : 'internal') as FileLevel;

  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const ext = path.extname(file.name);
  const id = crypto.randomUUID();
  const storagePath = path.join(UPLOAD_DIR, `${id}${ext}`);
  fs.writeFileSync(storagePath, Buffer.from(await file.arrayBuffer()));

  const isAdmin = ctx.role === 'admin';
  const code = generateFileCode();

  const record: FileRecord = {
    id,
    name: file.name,
    displayName,
    code,
    size: file.size,
    mimeType: file.type || 'application/octet-stream',
    uploaderId: ctx.userId,
    uploaderName: ctx.email,
    uploadedAt: Date.now(),
    status: isAdmin ? 'approved' : 'pending',
    reviewedBy: isAdmin ? ctx.email : undefined,
    reviewedAt: isAdmin ? Date.now() : undefined,
    storagePath,
    level,
    visibleTo: [],
  };

  addFile(record);
  return NextResponse.json({ file: record });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const { ctx } = auth;

  if (ctx.role !== 'admin') {
    return NextResponse.json({ error: '仅管理员可操作' }, { status: 403 });
  }

  const body = (await req.json()) as {
    id: string;
    action: 'approve' | 'reject' | 'meta';
    reason?: string;
    level?: FileLevel;
    visibleTo?: string[];
  };

  const { id, action } = body;
  if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 });

  if (action === 'meta') {
    const updated = updateFile(id, {
      level: body.level ?? 'internal',
      visibleTo: body.visibleTo ?? [],
    });
    if (!updated) return NextResponse.json({ error: '文件不存在' }, { status: 404 });
    return NextResponse.json({ file: updated });
  }

  if (action === 'approve') {
    const updated = updateFile(id, {
      status: 'approved',
      reviewedBy: ctx.email,
      reviewedAt: Date.now(),
    });
    if (!updated) return NextResponse.json({ error: '文件不存在' }, { status: 404 });
    return NextResponse.json({ file: updated });
  }

  if (action === 'reject') {
    const removed = deleteFile(id);
    if (!removed) return NextResponse.json({ error: '文件不存在' }, { status: 404 });
    return NextResponse.json({ ok: true, removed: removed.displayName });
  }

  return NextResponse.json({ error: '未知操作' }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const { ctx } = auth;

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 });

  const target = readFiles().find((f) => f.id === id);
  if (!target) return NextResponse.json({ error: '文件不存在' }, { status: 404 });

  if (ctx.role !== 'admin' && target.uploaderId !== ctx.userId) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }

  deleteFile(id);
  return NextResponse.json({ ok: true });
}