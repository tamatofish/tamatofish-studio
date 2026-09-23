import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server-auth';
import type { Message } from '@/lib/types';

// GET /api/member-chat?receiver_id=xxx — 获取与指定成员的聊天记录
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const { client, userId } = auth.ctx;
  const receiverId = new URL(req.url).searchParams.get('receiver_id');
  if (!receiverId) {
    return NextResponse.json({ error: '缺少 receiver_id' }, { status: 400 });
  }
  const { data, error } = await client
    .from('chat_messages')
    .select('*')
    .or(`and(sender_id.eq.${userId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${userId})`)
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) {
    return NextResponse.json({ error: `查询消息失败: ${error.message}` }, { status: 500 });
  }
  return NextResponse.json({ messages: (data ?? []) as Message[] });
}

// POST /api/member-chat — 发送消息
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const { client, userId, isAdmin, member } = auth.ctx;
  const body = (await req.json().catch(() => null)) as {
    receiver_id?: string;
    content?: string | null;
    file_url?: string | null;
    file_name?: string | null;
    file_size?: number | null;
    file_mime?: string | null;
  } | null;
  if (!body?.receiver_id) {
    return NextResponse.json({ error: '缺少接收人' }, { status: 400 });
  }
  if (!body.content && !body.file_url) {
    return NextResponse.json({ error: '消息内容不能为空' }, { status: 400 });
  }

  // 部门聊天权限校验：非管理员只能和同部门成员聊天
  if (!isAdmin && member) {
    const { data: target } = await client
      .from('internal_members')
      .select('user_id, department')
      .eq('user_id', body.receiver_id)
      .maybeSingle();
    if (!target) {
      return NextResponse.json({ error: '接收人不存在' }, { status: 404 });
    }
    const myDepts = (member.department ?? '').split(',').filter(Boolean);
    const targetDepts = (target.department ?? '').split(',').filter(Boolean);
    const hasCommonDept = myDepts.some((d) => targetDepts.includes(d));
    if (!hasCommonDept) {
      return NextResponse.json({ error: '你只能与同部门成员聊天' }, { status: 403 });
    }
  }

  const { data, error } = await client
    .from('chat_messages')
    .insert({
      sender_id: userId,
      receiver_id: body.receiver_id,
      content: body.content ?? null,
      file_url: body.file_url ?? null,
      file_name: body.file_name ?? null,
      file_size: body.file_size ?? null,
      file_mime: body.file_mime ?? null,
    })
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: `发送消息失败: ${error.message}` }, { status: 500 });
  }
  return NextResponse.json({ message: data as Message });
}
