import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server-auth';

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const BUCKET = 'chat_attachments';

export const runtime = 'nodejs';

// POST /api/upload-chat-file — 上传聊天文件（图片/文件，≤10MB）
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const { userId } = auth.ctx;

  const formData = await req.formData();
  const file = formData.get('file');
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: '未收到文件' }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: '文件不能超过 10MB' }, { status: 400 });
  }

  // 用 service_role client 上传（不带用户 token，有 Storage 完整权限）
  const { getSupabaseClient } = await import('@/storage/database/supabase-client');
  const adminClient = await getSupabaseClient();

  // 文件名改成纯 ASCII：时间戳-随机数.扩展名，避免中文/特殊字符
  const ext = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() : '';
  const safeExt = ext?.replace(/[^a-z0-9]/g, '') || 'bin';
  const filePath = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${safeExt}`;

  const arrayBuffer = await file.arrayBuffer();
  const { data, error } = await adminClient.storage
    .from(BUCKET)
    .upload(filePath, arrayBuffer, {
      contentType: file.type || 'application/octet-stream',
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    return NextResponse.json({ error: `上传失败: ${error.message}` }, { status: 500 });
  }

  // 获取公开 URL
  const { data: urlData } = adminClient.storage.from(BUCKET).getPublicUrl(data.path);

  return NextResponse.json({
    publicUrl: urlData.publicUrl,
    fileName: file.name,
    fileSize: file.size,
    fileMime: file.type,
    path: data.path,
  });
}
