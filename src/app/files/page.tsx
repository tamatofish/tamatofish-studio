import { FileManager } from '@/components/file-manager';

export const metadata = {
  title: '文件管理 · 番茄鱼工作室',
  description: '内部文件上传、审核与管理',
};

export default function FilesPage() {
  return (
    <div className="min-h-screen bg-[#f2f3f5] font-sans text-[#1b1c1e] antialiased">
      <FileManager role="staff" />
    </div>
  );
}