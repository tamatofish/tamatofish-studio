import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { readFiles } from '@/lib/file-store';
import { requireAuth } from '@/lib/server-auth';

/* GET /api/files/download?id=xxx */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const { ctx } = auth;

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 });

  const file = readFiles().find((f) => f.id === id);
  if (!file) return NextResponse.json({ error: '文件不存在' }, { status: 404 });

  // 管理员可下载任意；普通成员只能下载已通过的
  if (ctx.role !== 'admin' && file.status !== 'approved') {
    return NextResponse.json({ error: '文件未通过审核' }, { status: 403 });
  }

  const stream = fs.readFileSync(file.storagePath);
  return new NextResponse(stream, {
    headers: {
      'Content-Type': file.mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(file.name)}"`,
    },
  });
}