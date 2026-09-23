import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.COZE_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.COZE_SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: '缺少 Supabase URL 或 SERVICE_ROLE_KEY，请检查 .env.local' },
      { status: 500 },
    );
  }

  const ADMIN_EMAIL = 'fqy090807@163.com';
  const ADMIN_PASSWORD = '090807qwe';
  const ADMIN_NAME = '超级管理员';
  const MEMBER_NO = 'ADMIN002';

  const adminClient = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    let userId: string;
    const { data: list } = await adminClient.auth.admin.listUsers();
    const existingUser = list.users.find((u) => u.email === ADMIN_EMAIL);

    if (existingUser) {
      userId = existingUser.id;
    } else {
      const { data: authData, error: authError } =
        await adminClient.auth.admin.createUser({
          email: ADMIN_EMAIL,
          password: ADMIN_PASSWORD,
          email_confirm: true,
        });
      if (authError || !authData.user) {
        return NextResponse.json(
          { error: `创建 Auth 用户失败: ${authError?.message ?? '未知错误'}` },
          { status: 500 },
        );
      }
      userId = authData.user.id;
    }

    const { data: existing } = await adminClient
      .from('internal_members')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (!existing) {
      const { error: insertError } = await adminClient
        .from('internal_members')
        .insert({
          user_id: userId,
          member_no: MEMBER_NO,
          name: ADMIN_NAME,
          email: ADMIN_EMAIL,
          title: '系统管理员',
          department: '管理部',
          role: 'admin',
          status: 'active',
        });
      if (insertError) {
        return NextResponse.json(
          { error: `插入管理员记录失败: ${insertError.message}` },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: existingUser ? '管理员已存在，已确保关联记录' : '管理员创建成功！',
      login: {
        管理员账号: ADMIN_EMAIL,
        密码: ADMIN_PASSWORD,
        验证码: 'sslp090807',
      },
      note: '请妥善保管。创建成功后请删除 src/app/api/init-admin/route.ts 文件，避免安全风险。',
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '未知错误' },
      { status: 500 },
    );
  }
}
