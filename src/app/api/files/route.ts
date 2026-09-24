import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
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
const BUCKET = 'files';

function getStorageClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('缺少 Supabase 环境变量');
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const { ctx } = auth;

  const files = await readFiles();

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

  const id = crypto.randomUUID();
  const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : '';
  const safeExt = ext.replace(/[^a-zA-Z0-9.]/g, '') || '';
  const storagePath = `${id}${safeExt}`;

  // 上传到 Supabase Storage
  const admin = getStorageClient();
  const arrayBuffer = await file.arrayBuffer();
  const { error: upErr } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, arrayBuffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });
  if (upErr) {
    return NextResponse.json({ error: `上传失败: ${upErr.message}` }, { status: 500 });
  }

  const isAdmin = ctx.role === 'admin';
  const code = await generateFileCode();

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

  await addFile(record);
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
    const updated = await updateFile(id, {
      level: body.level ?? 'internal',
      visibleTo: body.visibleTo ?? [],
    });
    if (!updated) return NextResponse.json({ error: '文件不存在' }, { status: 404 });
    return NextResponse.json({ file: updated });
  }

  if (action === 'approve') {
    const updated = await updateFile(id, {
      status: 'approved',
      reviewedBy: ctx.email,
      reviewedAt: Date.now(),
    });
    if (!updated) return NextResponse.json({ error: '文件不存在' }, { status: 404 });
    return NextResponse.json({ file: updated });
  }

  if (action === 'reject') {
    const removed = await deleteFile(id);
    if (!removed) return NextResponse.json({ error: '文件不存在' }, { status: 404 });
    // 同时删除 Storage 里的文件（失败也不阻断）
    try {
      const admin = getStorageClient();
      await admin.storage.from(BUCKET).remove([removed.storagePath]);
    } catch { /* ignore */ }
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

  const allFiles = await readFiles();
  const target = allFiles.find((f) => f.id === id);
  if (!target) return NextResponse.json({ error: '文件不存在' }, { status: 404 });

  if (ctx.role !== 'admin' && target.uploaderId !== ctx.userId) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }

  await deleteFile(id);
  // 同时删除 Storage 里的文件
  try {
    const admin = getStorageClient();
    await admin.storage.from(BUCKET).remove([target.storagePath]);
  } catch { /* ignore */ }

  return NextResponse.json({ ok: true });
}