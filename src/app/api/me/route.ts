import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server-auth';
import type { MeResponse, UserRole } from '@/lib/types';

// GET /api/me — 返回当前登录用户身份：内部成员 / 访客 / 未建档
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const { client, userId, email, isInternal } = auth.ctx;

  let role: UserRole = 'none';
  let member = null;
  let visitor = null;

  if (isInternal) {
    role = 'internal';
    const { data, error } = await client
      .from('internal_members')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) {
      return NextResponse.json({ error: `查询成员档案失败: ${error.message}` }, { status: 500 });
    }
    member = data;
  } else {
    const { data: visitorData, error: visitorError } = await client
      .from('visitors')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (visitorError) {
      return NextResponse.json({ error: `查询访客档案失败: ${visitorError.message}` }, { status: 500 });
    }
    if (visitorData) {
      role = 'visitor';
      visitor = visitorData;
    }
  }

  return NextResponse.json({ email, role, member, visitor } as MeResponse);
}
