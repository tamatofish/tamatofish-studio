import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server-auth';
import { getSupabaseClient } from '@/storage/database/supabase-client';

/* POST /api/access-codes/verify
 * body: { code: string }
 * 校验通过后：
 *  - unlimited：不记录使用者，可反复通过
 *  - single：第一次记录使用者；第二次如果同一人 → 通过，否则拒绝
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const { userId, email } = auth.ctx;

  const body = (await req.json().catch(() => null)) as { code?: string } | null;
  const raw = (body?.code ?? '').trim().toLowerCase();
  if (raw.length !== 64 || !/^[0-9a-f]{64}$/.test(raw)) {
    return NextResponse.json({ error: '验证码格式不正确' }, { status: 400 });
  }

  const adminClient = await getSupabaseClient();
  const { data: row, error } = await adminClient
    .from('access_codes')
    .select('*')
    .eq('code', raw)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: '验证码无效' }, { status: 404 });

  /* 取使用者信息：优先 internal_members，否则 visitors */
  let name = '';
  let memberNo = '';
  const { data: member } = await adminClient
    .from('internal_members')
    .select('name, member_no')
    .eq('user_id', userId)
    .maybeSingle();
  if (member) {
    name = member.name ?? '';
    memberNo = member.member_no ?? '';
  } else {
    const { data: visitor } = await adminClient
      .from('visitors')
      .select('name')
      .eq('user_id', userId)
      .maybeSingle();
    if (visitor) {
      name = visitor.name ?? '';
      memberNo = '';
    }
  }
  const displayName = name && memberNo ? `${name}（${memberNo}）` : name || email;

  if (row.mode === 'single') {
    if (row.used && row.used_by_user_id !== userId) {
      return NextResponse.json(
        { error: `该验证码已被 ${row.used_by_name || '其他成员'} 使用` },
        { status: 403 },
      );
    }
    if (!row.used) {
      await adminClient
        .from('access_codes')
        .update({
          used: true,
          used_by_user_id: userId,
          used_by_name: displayName,
          used_by_member_no: memberNo || null,
          used_at: new Date().toISOString(),
        })
        .eq('id', row.id);
    }
  } else {
    /* unlimited：只更新最后一次使用信息，用于管理员查看 */
    await adminClient
      .from('access_codes')
      .update({
        used: true,
        used_by_user_id: userId,
        used_by_name: displayName,
        used_by_member_no: memberNo || null,
        used_at: new Date().toISOString(),
      })
      .eq('id', row.id);
  }

  return NextResponse.json({ ok: true, displayName });
}