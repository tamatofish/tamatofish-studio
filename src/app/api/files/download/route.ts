import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { readFiles } from '@/lib/file-store';
import { requireAuth } from '@/lib/server-auth';

const BUCKET = 'files';

function getStorageClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('缺少 Supabase 环境变量');
  return createClient(url, key, { auth: { persistSession: false } });
}

/* GET /api/files/download?id=xxx */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const { ctx } = auth;

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 });

  const allFiles = await readFiles();
  const file = allFiles.find((f) => f.id === id);
  if (!file) return NextResponse.json({ error: '文件不存在' }, { status: 404 });

  // 管理员可下载任意；普通成员只能下载已通过的
  if (ctx.role !== 'admin' && file.status !== 'approved') {
    return NextResponse.json({ error: '文件未通过审核' }, { status: 403 });
  }

  // 从 Supabase Storage 下载
  const admin = getStorageClient();
  const { data, error } = await admin.storage.from(BUCKET).download(file.storagePath);
  if (error || !data) {
    return NextResponse.json({ error: `读取文件失败: ${error?.message ?? '未知错误'}` }, { status: 500 });
  }

  const buf = Buffer.from(await data.arrayBuffer());
  return new NextResponse(buf, {
    headers: {
      'Content-Type': file.mimeType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(file.name)}"`,
      'Content-Length': String(buf.length),
    },
  });
}