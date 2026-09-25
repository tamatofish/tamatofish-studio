import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server-auth';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { MeResponse, UserRole } from '@/lib/types';

// GET /api/me — 返回当前登录用户身份：内部成员 / 访客 / 未建档
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const { userId, email, isInternal } = auth.ctx;

  const adminClient = await getSupabaseClient();

  let role: UserRole = 'none';
  let member = null;
  let visitor = null;

  if (isInternal) {
    role = 'internal';
    const { data, error } = await adminClient
      .from('internal_members')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) {
      return NextResponse.json({ error: `查询成员档案失败: ${error.message}` }, { status: 500 });
    }
    member = data;
  } else {
    // 1) 先按 user_id 查
    let visitorData = null;
    const r1 = await adminClient
      .from('visitors')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (r1.error) {
      return NextResponse.json({ error: `查询访客档案失败: ${r1.error.message}` }, { status: 500 });
    }
    visitorData = r1.data;

    // 2) 没查到 → 按 email 查（兜底）
    if (!visitorData && email) {
      const r2 = await adminClient
        .from('visitors')
        .select('*')
        .eq('email', email)
        .maybeSingle();
      if (!r2.error && r2.data) {
        visitorData = r2.data;
        // 顺手把这条记录的 user_id 修正为当前账号
        if (r2.data.user_id !== userId) {
          await adminClient
            .from('visitors')
            .update({ user_id: userId })
            .eq('id', r2.data.id);
          visitorData = { ...r2.data, user_id: userId };
        }
      }
    }

    if (visitorData) {
      role = 'visitor';
      visitor = visitorData;
    }
  }

  return NextResponse.json({ email, role, member, visitor } as MeResponse);
}