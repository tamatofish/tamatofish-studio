import { NextRequest, NextResponse } from 'next/server';
import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export interface AuthContext {
  client: SupabaseClient;
  userId: string;
  email: string;
  isInternal: boolean;
  /** 内部成员角色：'admin' = 管理员（可审核文件），'staff' = 普通成员 */
  role: 'admin' | 'staff' | null;
}

type AuthResult =
  | { ok: true; ctx: AuthContext }
  | { ok: false; response: NextResponse };

/**
 * 业务接口鉴权：从 x-session header 取 token，验证登录态并判断是否内部人员。
 * 后续数据操作必须复用 ctx.client（携带用户身份，受 RLS 约束）。
 */
export async function requireAuth(req: NextRequest): Promise<AuthResult> {
  const token = req.headers.get('x-session');

  if (!token) {
    return { ok: false, response: NextResponse.json({ error: '请先登录' }, { status: 401 }) };
  }

  const client = await getSupabaseClient(token);
  const { data: { user }, error: authError } = await client.auth.getUser();

  if (authError || !user) {
    return { ok: false, response: NextResponse.json({ error: '认证失败，请重新登录' }, { status: 401 }) };
  }

  const { data: member, error: memberError } = await client
    .from('internal_members')
    .select('id, role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (memberError) {
    return { ok: false, response: NextResponse.json({ error: `查询身份失败: ${memberError.message}` }, { status: 500 }) };
  }

  return {
    ok: true,
    ctx: {
      client,
      userId: user.id,
      email: user.email ?? '',
      isInternal: !!member,
      role: member?.role === 'admin' ? 'admin' : member ? 'staff' : null,
    },
  };
}