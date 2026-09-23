import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server-auth';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { InternalMember } from '@/lib/types';

const normalizeDepartment = (dep: string | string[] | undefined): string | null => {
  if (!dep) return null;
  if (Array.isArray(dep)) {
    const filtered = dep.map((d) => d.trim()).filter(Boolean);
    return filtered.length > 0 ? filtered.join(',') : null;
  }
  return dep.trim() || null;
};

// GET /api/members
// 用 service_role client 绕过 RLS，返回全部成员
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  const adminClient = await getSupabaseClient(); // 不传 token => service_role

  const includeAdmin = new URL(req.url).searchParams.get('include_admin') === '1';

  let query = adminClient
    .from('internal_members')
    .select('id, user_id, member_no, name, title, department, email, bio, role, status, show_on_homepage, created_at');

  if (!includeAdmin) {
    query = query.eq('status', 'active').neq('role', 'admin');
  }

  const { data, error } = await query.order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: `查询成员失败: ${error.message}` }, { status: 500 });
  return NextResponse.json({ members: (data ?? []) as InternalMember[] });
}

interface MemberPayload {
  name?: string;
  title?: string;
  department?: string | string[];
  bio?: string;
  mode?: 'self' | 'admin_create';
  member_no?: string;
  initial_password?: string;
  role?: string;
  status?: string;
  show_on_homepage?: boolean;
}

// POST /api/members
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const { client, userId, email } = auth.ctx;
  const body = (await req.json().catch(() => null)) as MemberPayload | null;
  if (!body?.name || !body.name.trim()) {
    return NextResponse.json({ error: '请填写姓名' }, { status: 400 });
  }
  if (body.mode === 'admin_create') {
    // 用 service_role 查身份，避免 RLS 拦截 admin 记录
    const adminClient = await getSupabaseClient();
    const { data: me, error: meError } = await adminClient
      .from('internal_members').select('id, role').eq('user_id', userId).maybeSingle();
    if (meError) return NextResponse.json({ error: `查询身份失败: ${meError.message}` }, { status: 500 });
    if (!me || me.role !== 'admin') return NextResponse.json({ error: '仅管理员可添加成员' }, { status: 403 });

    const memberNo = body.member_no?.trim() ?? '';
    const initialPassword = body.initial_password ?? '';
    if (!/^[A-Za-z0-9]{2,16}$/.test(memberNo)) return NextResponse.json({ error: '工号需为 2-16 位字母或数字' }, { status: 400 });
    if (initialPassword.length < 6) return NextResponse.json({ error: '初始密码至少 6 位' }, { status: 400 });

    const memberEmail = `${memberNo.toLowerCase()}@qq.com`;
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: memberEmail, password: initialPassword, email_confirm: true,
    });
    if (createError || !newUser.user) {
      const msg = createError?.message ?? '账号创建失败';
      const conflict = /already|registered|exist/i.test(msg);
      return NextResponse.json(
        { error: conflict ? `工号 ${memberNo} 对应的账号已存在` : `创建成员账号失败: ${msg}` },
        { status: conflict ? 409 : 500 },
      );
    }
    const role = body.role === 'admin' ? 'admin' : 'staff';
    const status = body.status === 'inactive' ? 'inactive' : 'active';
    const { data, error } = await adminClient
      .from('internal_members')
      .insert({
        user_id: newUser.user.id,
        member_no: memberNo.toUpperCase(),
        name: body.name.trim(),
        title: (body.title ?? '').trim() || null,
        department: normalizeDepartment(body.department),
        email: memberEmail,
        bio: (body.bio ?? '').trim() || null,
        role, status,
        show_on_homepage: body.show_on_homepage !== false,
      })
      .select().single();
    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: `工号 ${memberNo} 已被占用` }, { status: 409 });
      return NextResponse.json({ error: `创建成员档案失败: ${error.message}` }, { status: 500 });
    }
    return NextResponse.json({ member: data as InternalMember, hint: `成员账号已创建：工号 ${memberNo.toUpperCase()}` });
  }

  // 成员为自己建档
  const { data: existing } = await client.from('internal_members').select('id').eq('user_id', userId).maybeSingle();
  if (existing) return NextResponse.json({ error: '当前账号已存在成员档案' }, { status: 409 });
  const { data, error } = await client
    .from('internal_members')
    .insert({
      user_id: userId, name: body.name.trim(),
      title: (body.title ?? '').trim() || null,
      department: normalizeDepartment(body.department),
      email, bio: (body.bio ?? '').trim() || null,
      show_on_homepage: body.show_on_homepage !== false,
    })
    .select().single();
  if (error) return NextResponse.json({ error: `创建档案失败: ${error.message}` }, { status: 500 });
  return NextResponse.json({ member: data as InternalMember });
}

// DELETE /api/members?id=xxx
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const { client, userId } = auth.ctx;
  const targetId = new URL(req.url).searchParams.get('id');
  if (!targetId) return NextResponse.json({ error: '缺少成员 id' }, { status: 400 });

  const adminClient = await getSupabaseClient();
  const { data: me, error: meError } = await adminClient
    .from('internal_members').select('id, role').eq('user_id', userId).maybeSingle();
  if (meError) return NextResponse.json({ error: `查询身份失败: ${meError.message}` }, { status: 500 });
  if (!me || me.role !== 'admin') return NextResponse.json({ error: '仅管理员可删除成员' }, { status: 403 });
  if (me.id === targetId) return NextResponse.json({ error: '不能删除自己的管理员账号' }, { status: 400 });

  const { data: target } = await adminClient.from('internal_members').select('id, name').eq('id', targetId).maybeSingle();
  if (!target) return NextResponse.json({ error: '成员不存在' }, { status: 404 });

  const { error } = await adminClient.from('internal_members').delete().eq('id', targetId);
  if (error) return NextResponse.json({ error: `删除成员失败: ${error.message}` }, { status: 500 });
  return NextResponse.json({ ok: true, removed: target.name });
}

// PATCH /api/members
export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.response;
    const { client, userId } = auth.ctx;
    const body = (await req.json().catch(() => null)) as (MemberPayload & { id?: string }) | null;
    if (!body) return NextResponse.json({ error: '请求参数无效' }, { status: 400 });

    const adminClient = await getSupabaseClient();
    const { data: me, error: meError } = await adminClient
      .from('internal_members').select('id, role').eq('user_id', userId).maybeSingle();
    if (meError) return NextResponse.json({ error: `查询身份失败: ${meError.message}` }, { status: 500 });
    const isAdmin = me?.role === 'admin';

    let targetUserId = userId;
    if (isAdmin && body.id) {
      const { data: target, error: tError } = await adminClient
        .from('internal_members').select('user_id').eq('id', body.id).maybeSingle();
      if (tError) return NextResponse.json({ error: `查询目标成员失败: ${tError.message}` }, { status: 500 });
      if (!target) return NextResponse.json({ error: '成员不存在' }, { status: 404 });
      targetUserId = target.user_id;
    }

    const updates: Record<string, any> = {};
    if (body.name !== undefined) {
      if (!body.name.trim()) return NextResponse.json({ error: '姓名不能为空' }, { status: 400 });
      updates.name = body.name.trim();
    }
    if (body.title !== undefined) updates.title = (body.title ?? '').trim() || null;
    if (body.department !== undefined) updates.department = normalizeDepartment(body.department);
    if (body.bio !== undefined) updates.bio = (body.bio ?? '').trim() || null;
    if (isAdmin) {
      if (body.member_no !== undefined) updates.member_no = (body.member_no ?? '').trim().toUpperCase() || null;
      if (body.role !== undefined) updates.role = body.role === 'admin' ? 'admin' : 'staff';
      if (body.status !== undefined) updates.status = body.status === 'inactive' ? 'inactive' : 'active';
      if (body.show_on_homepage !== undefined) updates.show_on_homepage = body.show_on_homepage;
    }
    if (Object.keys(updates).length === 0) return NextResponse.json({ error: '没有需要更新的字段' }, { status: 400 });

    const { data, error } = await adminClient
      .from('internal_members').update(updates).eq('user_id', targetUserId).select().maybeSingle();
    if (error) return NextResponse.json({ error: `更新失败: ${error.message} (code: ${error.code})` }, { status: 500 });
    if (!data) return NextResponse.json({ error: '未找到成员档案' }, { status: 404 });
    return NextResponse.json({ member: data as InternalMember });
  } catch (e: any) {
    return NextResponse.json({ error: `服务器异常: ${e?.message ?? String(e)}` }, { status: 500 });
  }
}