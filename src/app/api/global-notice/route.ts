import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server-auth';
import type { GlobalNotice, InternalMember } from '@/lib/types';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const { client, userId } = auth.ctx;

  const [{ data: notices, error }, { data: reads }, { data: members }] = await Promise.all([
    client.from('global_notices').select('*').order('created_at', { ascending: false }),
    client.from('global_notice_read').select('notice_id, user_id'),
    client.from('internal_members').select('id, user_id, name, member_no, department, status').eq('status', 'active'),
  ]);
  if (error) return NextResponse.json({ error: `查询失败: ${error.message}` }, { status: 500 });

  const readIds = (reads ?? []).filter((r: any) => r.user_id === userId).map((r: any) => r.notice_id);
  const detail: Record<string, any[]> = {};
  for (const notice of (notices ?? [])) {
    detail[notice.id] = (members ?? []).map((m: any) => ({
      member_id: m.id, name: m.name, member_no: m.member_no, department: m.department,
      is_read: (reads ?? []).some((r: any) => r.notice_id === notice.id && r.user_id === m.user_id),
    }));
  }
  return NextResponse.json({ notices: (notices ?? []) as GlobalNotice[], readIds, detail });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const { client, userId } = auth.ctx;
  const { data: me } = await client.from('internal_members').select('role').eq('user_id', userId).maybeSingle();
  if (me?.role !== 'admin') return NextResponse.json({ error: '仅管理员可发布' }, { status: 403 });
  const body = (await req.json().catch(() => null)) as { content?: string } | null;
  if (!body?.content?.trim()) return NextResponse.json({ error: '内容不能为空' }, { status: 400 });
  const { data, error } = await client.from('global_notices').insert({ content: body.content.trim(), created_by: userId }).select().single();
  if (error) return NextResponse.json({ error: `发布失败: ${error.message}` }, { status: 500 });
  return NextResponse.json({ notice: data as GlobalNotice });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const { client, userId } = auth.ctx;
  const body = (await req.json().catch(() => null)) as { notice_id?: string } | null;
  if (!body?.notice_id) return NextResponse.json({ error: '缺少 notice_id' }, { status: 400 });
  const { data: existing } = await client.from('global_notice_read').select('id').eq('notice_id', body.notice_id).eq('user_id', userId).maybeSingle();
  if (!existing) {
    const { error } = await client.from('global_notice_read').insert({ notice_id: body.notice_id, user_id: userId });
    if (error) return NextResponse.json({ error: `标记已读失败: ${error.message}` }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
