import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server-auth';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// GET /api/my-visitor —— 拿当前登录用户自己的 visitor 记录
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const { userId, email } = auth.ctx;

  const adminClient = await getSupabaseClient();

  // 先按 user_id
  const r1 = await adminClient
    .from('visitors')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  let data = r1.data;

  // 兜底：按 email
  if (!data && email) {
    const r2 = await adminClient
      .from('visitors')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (r2.data) {
      data = r2.data;
      // 顺手把 user_id 修正为当前账号，保证后续操作一致
      if (r2.data.user_id !== userId) {
        await adminClient
          .from('visitors')
          .update({ user_id: userId })
          .eq('id', r2.data.id);
        data = { ...r2.data, user_id: userId };
      }
    }
  }

  return NextResponse.json({ visitor: data ?? null });
}