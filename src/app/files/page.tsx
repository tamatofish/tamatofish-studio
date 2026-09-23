import { redirect } from 'next/navigation';
import { FileManager } from '@/components/file-manager';
import { getSessionUser } from '@/lib/auth';

export const metadata = {
  title: '文件管理 · 番茄鱼工作室',
  description: '内部文件上传、审核与管理',
};

export default async function FilesPage() {
  // 服务端读取当前登录用户
  const user = await getSessionUser();

  // 未登录或角色不合法 → 重定向
  if (!user || (user.role !== 'admin' && user.role !== 'console')) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-[#f2f3f5] font-sans text-[#1b1c1e] antialiased">
      <FileManager role={user.role} />
    </div>
  );
}