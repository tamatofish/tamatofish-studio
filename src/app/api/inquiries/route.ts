import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server-auth';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// GET /api/inquiries —— 管理员看全部，访客看自己
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const { userId } = auth.ctx;

  const adminClient = await getSupabaseClient();

  // 判断当前用户是不是管理员
  const { data: me, error: meError } = await adminClient
    .from('internal_members')
    .select('role, status')
    .eq('user_id', userId)
    .maybeSingle();
  if (meError) {
    return NextResponse.json({ error: `查询身份失败: ${meError.message}` }, { status: 500 });
  }

  // 管理员：全部
  if (me?.role === 'admin') {
    const { data, error } = await adminClient
      .from('inquiries')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return NextResponse.json({ error: `查询合作意向失败: ${error.message}` }, { status: 500 });
    return NextResponse.json({ inquiries: data ?? [] });
  }

  // 访客：先找自己的 visitor 记录
  const { data: visitor } = await adminClient
    .from('visitors')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (!visitor) {
    return NextResponse.json({ inquiries: [] });
  }

  const { data, error } = await adminClient
    .from('inquiries')
    .select('*')
    .eq('visitor_id', visitor.id)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: `查询合作意向失败: ${error.message}` }, { status: 500 });
  return NextResponse.json({ inquiries: data ?? [] });
}

// POST /api/inquiries —— 访客提交新的合作意向
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const { userId } = auth.ctx;

  const body = (await req.json().catch(() => null)) as
    | { subject?: string; message?: string; contact?: string }
    | null;

  const subject = (body?.subject ?? '').trim();
  const message = (body?.message ?? '').trim();
  const contact = (body?.contact ?? '').trim() || null;

  if (!subject) return NextResponse.json({ error: '请填写主题' }, { status: 400 });
  if (!message) return NextResponse.json({ error: '请填写需求描述' }, { status: 400 });

  const adminClient = await getSupabaseClient();

  // 找当前用户的 visitor 档案
  const { data: visitor, error: vErr } = await adminClient
    .from('visitors')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  if (vErr) return NextResponse.json({ error: `查询访客档案失败: ${vErr.message}` }, { status: 500 });
  if (!visitor) {
    return NextResponse.json({ error: '请先在「我的档案」完善信息' }, { status: 400 });
  }

  const { data, error } = await adminClient
    .from('inquiries')
    .insert({
      visitor_id: visitor.id,
      subject,
      message,
      contact,
      status: 'pending',
    })
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: `提交失败: ${error.message}` }, { status: 500 });
  return NextResponse.json({ inquiry: data });
}

// PATCH /api/inquiries —— 管理员更新处理状态
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const { userId } = auth.ctx;

  const adminClient = await getSupabaseClient();
  const { data: me } = await adminClient
    .from('internal_members')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();
  if (!me || me.role !== 'admin') {
    return NextResponse.json({ error: '仅管理员可操作' }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { id?: string; status?: string } | null;
  if (!body?.id || !body?.status) {
    return NextResponse.json({ error: '参数不完整' }, { status: 400 });
  }

  const { data, error } = await adminClient
    .from('inquiries')
    .update({ status: body.status })
    .eq('id', body.id)
    .select()
    .maybeSingle();
  if (error) return NextResponse.json({ error: `更新失败: ${error.message}` }, { status: 500 });
  if (!data) return NextResponse.json({ error: '未找到合作意向' }, { status: 404 });
  return NextResponse.json({ inquiry: data });
}