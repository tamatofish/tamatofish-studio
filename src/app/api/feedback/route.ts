import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server-auth';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// GET /api/feedback —— 管理员看全部，访客看自己
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const { userId } = auth.ctx;

  const adminClient = await getSupabaseClient();

  const { data: me } = await adminClient
    .from('internal_members')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();

  if (me?.role === 'admin') {
    const { data, error } = await adminClient
      .from('feedback')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return NextResponse.json({ error: `查询失败: ${error.message}` }, { status: 500 });
    return NextResponse.json({ feedbacks: data ?? [] });
  }

  const { data, error } = await adminClient
    .from('feedback')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: `查询失败: ${error.message}` }, { status: 500 });
  return NextResponse.json({ feedbacks: data ?? [] });
}

// POST /api/feedback —— 访客提交反馈
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const { userId, email } = auth.ctx;

  const body = (await req.json().catch(() => null)) as
    | { category?: string; content?: string }
    | null;

  const content = (body?.content ?? '').trim();
  if (!content) return NextResponse.json({ error: '请填写反馈内容' }, { status: 400 });
  if (content.length > 5000) return NextResponse.json({ error: '反馈内容不能超过 5000 字' }, { status: 400 });

  const category = (body?.category ?? 'other').trim() || 'other';

  const adminClient = await getSupabaseClient();

  // 尝试拿 visitor 信息
  const { data: visitor } = await adminClient
    .from('visitors')
    .select('id, name')
    .eq('user_id', userId)
    .maybeSingle();

  const { data, error } = await adminClient
    .from('feedback')
    .insert({
      user_id: userId,
      visitor_id: visitor?.id ?? null,
      name: visitor?.name ?? null,
      email: email ?? null,
      category,
      content,
      status: 'pending',
    })
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: `提交失败: ${error.message}` }, { status: 500 });
  return NextResponse.json({ feedback: data });
}

// PATCH /api/feedback —— 管理员回复 / 改状态
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const { userId, email: adminEmail } = auth.ctx;

  const adminClient = await getSupabaseClient();
  const { data: me } = await adminClient
    .from('internal_members')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();
  if (!me || me.role !== 'admin') {
    return NextResponse.json({ error: '仅管理员可操作' }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as
    | { id?: string; status?: string; reply?: string }
    | null;
  if (!body?.id) return NextResponse.json({ error: '缺少 id' }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (body.status) patch.status = body.status;
  if (body.reply !== undefined) {
    patch.admin_reply = body.reply;
    patch.replied_at = new Date().toISOString();
    patch.replied_by = adminEmail ?? null;
  }

  const { data, error } = await adminClient
    .from('feedback')
    .update(patch)
    .eq('id', body.id)
    .select()
    .maybeSingle();
  if (error) return NextResponse.json({ error: `更新失败: ${error.message}` }, { status: 500 });
  if (!data) return NextResponse.json({ error: '反馈不存在' }, { status: 404 });
  return NextResponse.json({ feedback: data });
}