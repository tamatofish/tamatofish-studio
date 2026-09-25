import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server-auth';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// GET /api/visitors —— 内部成员（管理员 / 工作人员）可查看访客列表
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const { userId, isInternal } = auth.ctx;

  // 只要不是访客（内部成员）就能看
  if (!isInternal) {
    return NextResponse.json({ error: '仅内部成员可查看访客列表' }, { status: 403 });
  }

  const adminClient = await getSupabaseClient();

  const { data, error } = await adminClient
    .from('visitors')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: `查询访客失败: ${error.message}` }, { status: 500 });
  return NextResponse.json({ visitors: data ?? [] });
}

/** 找一个属于当前用户的 visitor 记录（先 user_id，再 email 兜底） */
async function findMyVisitor(adminClient: any, userId: string, email: string) {
  const r1 = await adminClient
    .from('visitors')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (r1.data) return r1.data;

  if (email) {
    const r2 = await adminClient
      .from('visitors')
      .select('*')
      .eq('email', email)
      .maybeSingle();
    if (r2.data) {
      if (r2.data.user_id !== userId) {
        await adminClient
          .from('visitors')
          .update({ user_id: userId })
          .eq('id', r2.data.id);
        return { ...r2.data, user_id: userId };
      }
      return r2.data;
    }
  }
  return null;
}

// POST /api/visitors —— 建档（有则更新）
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const { userId, email } = auth.ctx;

  const body = (await req.json().catch(() => null)) as
    | { name?: string; company?: string; phone?: string; interest?: string }
    | null;

  const name = (body?.name ?? '').trim();
  if (!name) return NextResponse.json({ error: '请填写称呼' }, { status: 400 });

  const adminClient = await getSupabaseClient();
  const existing = await findMyVisitor(adminClient, userId, email);

  const payload = {
    user_id: userId,
    name,
    company: (body?.company ?? '').trim() || null,
    phone: (body?.phone ?? '').trim() || null,
    interest: (body?.interest ?? '').trim() || null,
    email: email ?? null,
  };

  if (existing?.id) {
    const { data, error } = await adminClient
      .from('visitors')
      .update(payload)
      .eq('id', existing.id)
      .select()
      .maybeSingle();
    if (error) return NextResponse.json({ error: `更新访客失败: ${error.message}` }, { status: 500 });
    return NextResponse.json({ visitor: data });
  }

  const { data, error } = await adminClient
    .from('visitors')
    .insert(payload)
    .select()
    .maybeSingle();
  if (error) return NextResponse.json({ error: `创建访客失败: ${error.message}` }, { status: 500 });
  return NextResponse.json({ visitor: data });
}

// PATCH /api/visitors —— 更新（没有就建）
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const { userId, email } = auth.ctx;

  const body = (await req.json().catch(() => null)) as
    | { name?: string; company?: string; phone?: string; interest?: string }
    | null;

  const name = (body?.name ?? '').trim();
  if (!name) return NextResponse.json({ error: '请填写称呼' }, { status: 400 });

  const adminClient = await getSupabaseClient();
  const existing = await findMyVisitor(adminClient, userId, email);

  const payload = {
    user_id: userId,
    name,
    company: (body?.company ?? '').trim() || null,
    phone: (body?.phone ?? '').trim() || null,
    interest: (body?.interest ?? '').trim() || null,
    email: email ?? null,
  };

  if (existing?.id) {
    const { data, error } = await adminClient
      .from('visitors')
      .update(payload)
      .eq('id', existing.id)
      .select()
      .maybeSingle();
    if (error) return NextResponse.json({ error: `更新访客失败: ${error.message}` }, { status: 500 });
    return NextResponse.json({ visitor: data });
  }

  const { data, error } = await adminClient
    .from('visitors')
    .insert(payload)
    .select()
    .maybeSingle();
  if (error) return NextResponse.json({ error: `创建访客失败: ${error.message}` }, { status: 500 });
  return NextResponse.json({ visitor: data });
}