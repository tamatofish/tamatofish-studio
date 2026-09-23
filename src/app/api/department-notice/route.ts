import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server-auth';
import { getLeaderDepts } from '@/lib/dept-title';
import type { DepartmentNotice } from '@/lib/types';

// GET /api/department-notice
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const { client, userId } = auth.ctx;

  const { data: me } = await client
    .from('internal_members')
    .select('department, title, role')
    .eq('user_id', userId)
    .maybeSingle();

  const myDepts = (me?.department ?? '').split(',').map((s: string) => s.trim()).filter(Boolean);
  const isAdmin = me?.role === 'admin';

  let notices: DepartmentNotice[] = [];
  if (isAdmin) {
    const { data } = await client.from('department_notices').select('*').order('created_at', { ascending: false });
    notices = data ?? [];
  } else {
    const { data: approved } = await client
      .from('department_notices')
      .select('*')
      .eq('status', 'approved')
      .in('department', myDepts.length > 0 ? myDepts : ['__none__']);
    const { data: mine } = await client.from('department_notices').select('*').eq('submitter_user_id', userId);
    const map = new Map<string, DepartmentNotice>();
    [...(approved ?? []), ...(mine ?? [])].forEach((n) => map.set(n.id, n));
    notices = Array.from(map.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  const { data: reads } = await client
    .from('department_notice_read')
    .select('notice_id')
    .eq('user_id', userId);
  const readIds = (reads ?? []).map((r: any) => r.notice_id);

  const detail: Record<string, any[]> = {};
  if (isAdmin) {
    const noticeIds = notices.map((n) => n.id);
    if (noticeIds.length > 0) {
      const { data: allReads } = await client
        .from('department_notice_read')
        .select('notice_id, member_id, is_read, members(name, member_no, department)');
      for (const n of notices) detail[n.id] = [];
      for (const r of (allReads ?? []) as any[]) {
        if (detail[r.notice_id]) {
          detail[r.notice_id].push({
            member_id: r.member_id, is_read: r.is_read,
            name: r.members?.name ?? '—', member_no: r.members?.member_no ?? '—',
            department: r.members?.department ?? '—',
          });
        }
      }
    }
  }

  return NextResponse.json({ notices, readIds, detail });
}

// POST /api/department-notice — 管理员直接发布（任意部门，自动通过）/ 负责人提交草稿
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const { client, userId } = auth.ctx;
  const body = (await req.json().catch(() => null)) as { content?: string; department?: string } | null;
  const content = body?.content?.trim();
  const targetDept = body?.department?.trim();

  if (!content) {
    return NextResponse.json({ error: '请填写通知内容' }, { status: 400 });
  }

  const { data: me } = await client
    .from('internal_members')
    .select('department, title, role')
    .eq('user_id', userId)
    .maybeSingle();

  if (!me) {
    return NextResponse.json({ error: '成员档案不存在' }, { status: 404 });
  }

  const isAdmin = me.role === 'admin';
  let dept: string;

  if (isAdmin) {
    // 管理员：必须指定部门，可发布到任意部门，直接通过无需审核
    if (!targetDept) {
      return NextResponse.json({ error: '请选择发布部门' }, { status: 400 });
    }
    dept = targetDept;
  } else {
    // 负责人：验证身份
    const leaderDepts = getLeaderDepts(me.department, me.title);
    if (leaderDepts.length === 0) {
      return NextResponse.json({ error: '仅部门负责人可提交部门通知' }, { status: 403 });
    }
    if (targetDept) {
      if (!leaderDepts.includes(targetDept)) {
        return NextResponse.json({ error: `你不是「${targetDept}」的负责人，无法发布` }, { status: 403 });
      }
      dept = targetDept;
    } else {
      if (leaderDepts.length === 1) dept = leaderDepts[0];
      else return NextResponse.json({ error: '请选择发布部门' }, { status: 400 });
    }
  }

  const insertData: Record<string, any> = {
    content,
    department: dept,
    submitter_user_id: userId,
    status: isAdmin ? 'approved' : 'pending',
  };
  if (isAdmin) {
    insertData.reviewed_at = new Date().toISOString();
  }

  const { data, error } = await client
    .from('department_notices')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: `提交失败: ${error.message}` }, { status: 500 });
  }
  return NextResponse.json({ notice: data as DepartmentNotice });
}

// PATCH /api/department-notice — 管理员审核
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const { client, userId } = auth.ctx;
  const body = (await req.json().catch(() => null)) as { id?: string; status?: string } | null;
  if (!body?.id || !body.status) {
    return NextResponse.json({ error: '参数不完整' }, { status: 400 });
  }
  const { data: me } = await client.from('internal_members').select('role').eq('user_id', userId).maybeSingle();
  if (me?.role !== 'admin') {
    return NextResponse.json({ error: '仅管理员可审核' }, { status: 403 });
  }
  const status = body.status === 'approved' ? 'approved' : 'rejected';
  const { data, error } = await client
    .from('department_notices')
    .update({ status, reviewed_at: new Date().toISOString() })
    .eq('id', body.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notice: data as DepartmentNotice });
}

// PUT /api/department-notice — 标记已读
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const { client, userId } = auth.ctx;
  const body = (await req.json().catch(() => null)) as { notice_id?: string } | null;
  if (!body?.notice_id) {
    return NextResponse.json({ error: '缺少 notice_id' }, { status: 400 });
  }
  const { data: existing } = await client
    .from('department_notice_read')
    .select('id')
    .eq('notice_id', body.notice_id)
    .eq('user_id', userId)
    .maybeSingle();
  if (existing) return NextResponse.json({ ok: true });
  const { error } = await client
    .from('department_notice_read')
    .insert({ notice_id: body.notice_id, user_id: userId, is_read: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
