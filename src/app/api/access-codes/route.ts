import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { requireAuth } from '@/lib/server-auth';
import { getSupabaseClient } from '@/storage/database/supabase-client';

async function requireAdmin(auth: any) {
  const adminClient = await getSupabaseClient();
  const { data: me } = await adminClient
    .from('internal_members')
    .select('role')
    .eq('user_id', auth.ctx.userId)
    .maybeSingle();
  return me?.role === 'admin';
}

/* GET /api/access-codes —— 管理员查看列表 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  if (!(await requireAdmin(auth))) {
    return NextResponse.json({ error: '仅管理员可查看' }, { status: 403 });
  }

  const adminClient = await getSupabaseClient();
  const { data, error } = await adminClient
    .from('access_codes')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ codes: data ?? [] });
}

/* POST /api/access-codes —— 管理员创建 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  if (!(await requireAdmin(auth))) {
    return NextResponse.json({ error: '仅管理员可创建' }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as
    | { mode?: 'unlimited' | 'single'; note?: string }
    | null;
  const mode = body?.mode;
  if (mode !== 'unlimited' && mode !== 'single') {
    return NextResponse.json({ error: 'mode 必须是 unlimited 或 single' }, { status: 400 });
  }

  const adminClient = await getSupabaseClient();

  /* 生成 64 位十六进制，保证与历史不重复 */
  let code = '';
  for (let attempt = 0; attempt < 5; attempt++) {
    code = crypto.randomBytes(32).toString('hex'); // 64 位 hex
    const { data: exists } = await adminClient
      .from('access_codes')
      .select('id')
      .eq('code', code)
      .maybeSingle();
    if (!exists) break;
    code = '';
  }
  if (!code) {
    return NextResponse.json({ error: '生成验证码失败，请重试' }, { status: 500 });
  }

  const { data, error } = await adminClient
    .from('access_codes')
    .insert({
      code,
      mode,
      note: (body?.note ?? '').trim() || null,
      created_by: auth.ctx.email,
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ code: data });
}

/* DELETE /api/access-codes?id=xxx —— 管理员删除 */
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  if (!(await requireAdmin(auth))) {
    return NextResponse.json({ error: '仅管理员可删除' }, { status: 403 });
  }

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 });

  const adminClient = await getSupabaseClient();
  const { error } = await adminClient.from('access_codes').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}