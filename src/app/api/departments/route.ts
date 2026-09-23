import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server-auth';

/**
 * PATCH /api/departments
 * body: { oldName: string, newName: string }
 * 将所有成员中出现的 oldName 替换为 newName
 */
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const { ctx } = auth;

  if (ctx.role !== 'admin') {
    return NextResponse.json({ error: '仅管理员可操作' }, { status: 403 });
  }

  const { oldName, newName } = (await req.json()) as {
    oldName?: string;
    newName?: string;
  };

  const oldTrim = (oldName ?? '').trim();
  const newTrim = (newName ?? '').trim();

  if (!oldTrim || !newTrim) {
    return NextResponse.json({ error: '参数不完整' }, { status: 400 });
  }
  if (oldTrim === newTrim) {
    return NextResponse.json({ ok: true, updated: 0 });
  }

  // 拉取所有成员
  const { data: members, error: fetchErr } = await ctx.client
    .from('internal_members')
    .select('id, department');

  if (fetchErr) {
    return NextResponse.json({ error: `查询成员失败: ${fetchErr.message}` }, { status: 500 });
  }

  const targets = (members ?? []).filter((m) => {
    const depts = (m.department ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    return depts.includes(oldTrim);
  });

  let updated = 0;
  for (const m of targets) {
    const depts = (m.department ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((d) => (d === oldTrim ? newTrim : d));
    // 去重（避免替换后出现重复）
    const deduped = Array.from(new Set(depts));
    const { error: updErr } = await ctx.client
      .from('internal_members')
      .update({ department: deduped.join(',') })
      .eq('id', m.id);
    if (!updErr) updated += 1;
  }

  return NextResponse.json({ ok: true, updated });
}
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const { ctx } = auth;

  if (ctx.role !== 'admin') {
    return NextResponse.json({ error: '仅管理员可操作' }, { status: 403 });
  }

  const { name } = (await req.json()) as { name?: string };
  const deptName = (name ?? '').trim();
  if (!deptName) return NextResponse.json({ error: '缺少部门名称' }, { status: 400 });

  // 检查是否还有成员
  const { data: members, error: fetchErr } = await ctx.client
    .from('internal_members')
    .select('id, department');

  if (fetchErr) {
    return NextResponse.json({ error: `查询成员失败: ${fetchErr.message}` }, { status: 500 });
  }

  const hasMember = (members ?? []).some((m) => {
    const depts = (m.department ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    return depts.includes(deptName);
  });

  if (hasMember) {
    return NextResponse.json({ error: '该部门下仍有成员，无法删除' }, { status: 400 });
  }

  // 由于部门是隐式存在的（只出现在成员数据的 department 字段里），
  // 没有成员时它本身就不会出现在列表里。这里的「删除」实际是防御性操作，
  // 如果将来引入了单独的 departments 表，再在这里删除记录即可。
  return NextResponse.json({ ok: true });
}