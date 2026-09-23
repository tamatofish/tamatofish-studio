export interface DeptTitle {
  dept: string;
  title: string;
}

/** 解析 "技术部,美术部" + "负责人,成员" → [{dept:'技术部',title:'负责人'},{dept:'美术部',title:'成员'}] */
export function parseDeptTitles(
  department: string | null | undefined,
  title: string | null | undefined
): DeptTitle[] {
  const depts = (department ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const titles = (title ?? '').split(',').map((s) => s.trim());
  return depts.map((dept, i) => ({
    dept,
    title: titles[i] ?? (titles.length === 1 ? titles[0] : ''),
  }));
}

/** 序列化回逗号分隔字符串 */
export function serializeDeptTitles(pairs: DeptTitle[]): { department: string; title: string } {
  return {
    department: pairs.map((p) => p.dept).join(','),
    title: pairs.map((p) => p.title || '成员').join(','),
  };
}

/** 获取该成员担任"负责人"的所有部门 */
export function getLeaderDepts(
  department: string | null | undefined,
  title: string | null | undefined
): string[] {
  return parseDeptTitles(department, title)
    .filter((p) => p.title === '负责人')
    .map((p) => p.dept);
}

/** 是否在任意部门担任负责人 */
export function isLeaderAny(
  department: string | null | undefined,
  title: string | null | undefined
): boolean {
  return getLeaderDepts(department, title).length > 0;
}
