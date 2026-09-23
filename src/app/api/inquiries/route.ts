import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server-auth';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// GET /api/inquiries
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const { userId } = auth.ctx;

  const adminClient = await getSupabaseClient();

  // 用 service_role 查身份
  const { data: me, error: meError } = await adminClient
    .from('internal_members').select('role, status').eq('user_id', userId).maybeSingle();
  if (meError) return NextResponse.json({ error: `查询身份失败: ${meError.message}` }, { status: 500 });
  if (!me || me.role !== 'admin') {
    return NextResponse.json({ error: '仅管理员可查看合作意向' }, { status: 403 });
  }

  const { data, error } = await adminClient
    .from('inquiries')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: `查询合作意向失败: ${error.message}` }, { status: 500 });
  return NextResponse.json({ inquiries: data ?? [] });
}

// PATCH /api/inquiries —— 更新处理状态
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const { userId } = auth.ctx;

  const adminClient = await getSupabaseClient();
  const { data: me } = await adminClient
    .from('internal_members').select('role').eq('user_id', userId).maybeSingle();
  if (!me || me.role !== 'admin') {
    return NextResponse.json({ error: '仅管理员可操作' }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { id?: string; status?: string } | null;
  if (!body?.id || !body?.status) {
    return NextResponse.json({ error: '参数不完整' }, { status: 400 });
  }

  const { data, error } = await adminClient
    .from('inquiries').update({ status: body.status }).eq('id', body.id).select().maybeSingle();
  if (error) return NextResponse.json({ error: `更新失败: ${error.message}` }, { status: 500 });
  if (!data) return NextResponse.json({ error: '未找到合作意向' }, { status: 404 });
  return NextResponse.json({ inquiry: data });
}