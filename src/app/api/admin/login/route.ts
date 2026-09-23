import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 管理员登录固定验证码（管理口令）
const ADMIN_LOGIN_CODE = 'sslp090807';

interface AdminLoginPayload {
  email?: string;
  password?: string;
  code?: string;
}

// POST /api/admin/login — 管理员登录：账号 + 密码 + 固定验证码
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as AdminLoginPayload | null;
  const email = body?.email?.trim();
  const password = body?.password;
  const code = body?.code?.trim();

  if (!email || !password || !code) {
    return NextResponse.json({ error: '请填写账号、密码和验证码' }, { status: 400 });
  }
  if (code !== ADMIN_LOGIN_CODE) {
    return NextResponse.json({ error: '验证码错误' }, { status: 401 });
  }

  const client = await getSupabaseClient();
  const { data: login, error: loginError } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (loginError || !login.session || !login.user) {
    return NextResponse.json({ error: '账号或密码错误' }, { status: 401 });
  }

  // 校验管理员身份
  const { data: member, error: memberError } = await client
    .from('internal_members')
    .select('id, name, role, status')
    .eq('user_id', login.user.id)
    .maybeSingle();

  if (memberError) {
    return NextResponse.json({ error: `查询管理员信息失败: ${memberError.message}` }, { status: 500 });
  }
  if (!member || member.role !== 'admin' || member.status !== 'active') {
    return NextResponse.json({ error: '该账号不具备管理员权限' }, { status: 403 });
  }

  return NextResponse.json({
    access_token: login.session.access_token,
    refresh_token: login.session.refresh_token,
    expires_at: login.session.expires_at,
    user: { id: login.user.id, email: login.user.email ?? email },
    member: { id: member.id, name: member.name },
  });
}
