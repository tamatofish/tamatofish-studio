import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server-auth';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// GET /api/visitors
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const { userId } = auth.ctx;

  const adminClient = await getSupabaseClient();

  // 用 service_role 查身份，避免 RLS 拦截
  const { data: me, error: meError } = await adminClient
    .from('internal_members').select('role, status').eq('user_id', userId).maybeSingle();
  if (meError) return NextResponse.json({ error: `查询身份失败: ${meError.message}` }, { status: 500 });
  if (!me || me.role !== 'admin') {
    return NextResponse.json({ error: '仅管理员可查看访客列表' }, { status: 403 });
  }

  const { data, error } = await adminClient
    .from('visitors')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: `查询访客失败: ${error.message}` }, { status: 500 });
  return NextResponse.json({ visitors: data ?? [] });
}