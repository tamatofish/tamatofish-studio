'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

/* ============================================================
 * 类型定义
 * ============================================================ */
type FileStatus = 'pending' | 'approved' | 'rejected';

interface FileRecord {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  uploaderName: string;
  uploadedAt: number;
  status: FileStatus;
  reviewedBy?: string;
  reviewedAt?: number;
  rejectReason?: string;
}

interface FileManagerProps {
  role: 'admin' | 'console';
}

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

/* ============================================================
 * 状态徽章
 * ============================================================ */
function StatusBadge({ status }: { status: FileStatus }) {
  const map: Record<FileStatus, { text: string; cls: string }> = {
    pending: { text: '待审核', cls: 'bg-[#f5f6f7] text-[#85888e]' },
    approved: { text: '已通过', cls: 'bg-[#e8f5e9] text-[#2e7d32]' },
    rejected: { text: '已拒绝', cls: 'bg-[#fdecea] text-[#c62828]' },
  };
  const s = map[status];
  return (
    <span className={`inline-block px-2 py-1 text-[11px] font-light tracking-[0.15em] ${s.cls}`}>
      {s.text}
    </span>
  );
}

/* ============================================================
 * 工具：格式化文件大小
 * ============================================================ */
function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/* ============================================================
 * 主组件
 * ============================================================ */
export function FileManager({ role }: FileManagerProps) {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [filter, setFilter] = useState<FileStatus | 'all'>('all');
  const inputRef = useRef<HTMLInputElement>(null);

  const isConsole = role === 'console';

  /* -------------------- 加载列表 -------------------- */
  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/files');
      const data = await res.json();
      setFiles(data.files || []);
    } catch {
      setMsg({ type: 'err', text: '加载失败' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  /* -------------------- 上传 -------------------- */
  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_SIZE) {
      setMsg({ type: 'err', text: '文件不能超过 10MB' });
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    setUploading(true);
    setMsg(null);

    const fd = new FormData();
    fd.append('file', file);

    try {
      const res = await fetch('/api/files', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '上传失败');
      setMsg({
        type: 'ok',
        text: isConsole ? '上传成功，已加入文件列表' : '上传成功，等待管理员审核',
      });
      load();
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof Error ? err.message : '上传失败' });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  /* -------------------- 审核 -------------------- */
  async function handleReview(id: string, action: 'approve' | 'reject') {
    let reason: string | undefined;
    if (action === 'reject') {
      const input = window.prompt('请输入拒绝原因（可选）');
      if (input === null) return; // 用户取消
      reason = input;
    }

    try {
      const res = await fetch('/api/files', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, reason }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '审核失败');
      }
      setMsg({ type: 'ok', text: action === 'approve' ? '已通过' : '已拒绝' });
      load();
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof Error ? err.message : '审核失败' });
    }
  }

  /* -------------------- 删除 -------------------- */
  async function handleDelete(id: string) {
    if (!window.confirm('确定删除该文件？')) return;
    try {
      const res = await fetch(`/api/files?id=${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '删除失败');
      }
      setMsg({ type: 'ok', text: '已删除' });
      load();
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof Error ? err.message : '删除失败' });
    }
  }

  /* -------------------- 过滤后的列表 -------------------- */
  const visibleFiles = useMemo(() => {
    if (!isConsole || filter === 'all') return files;
    return files.filter((f) => f.status === filter);
  }, [files, filter, isConsole]);

  const pendingCount = useMemo(
    () => files.filter((f) => f.status === 'pending').length,
    [files],
  );

  /* -------------------- 渲染 -------------------- */
  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      {/* 标题区 */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-light tracking-[0.4em] text-[#b9bcc2]">FILES</p>
          <h1 className="mt-3 text-2xl font-light tracking-[0.2em] text-[#1b1c1e]">文件管理</h1>
          <p className="mt-2 text-xs font-light tracking-wider text-[#9b9ea4]">
            {isConsole
              ? '管理员视图 · 可审核所有上传文件'
              : '用户视图 · 上传后需管理员审核'}
          </p>
          <div className="mt-4 h-px w-10 bg-[#e8704a]" />
        </div>

        <div className="flex items-center gap-3">
          {isConsole && pendingCount > 0 && (
            <span className="text-xs font-light text-[#e8704a]">
              {pendingCount} 个待审核
            </span>
          )}
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={handleUpload}
          />
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="border border-[#1b1c1e] bg-[#1b1c1e] px-5 py-2 text-xs font-light tracking-[0.2em] text-white transition-colors hover:bg-white hover:text-[#1b1c1e] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading ? '上传中...' : '上传文件（≤10MB）'}
          </button>
        </div>
      </div>

      {/* 提示信息 */}
      {msg && (
        <p
          className={`mt-6 text-xs font-light ${
            msg.type === 'ok' ? 'text-[#e8704a]' : 'text-red-500'
          }`}
        >
          {msg.text}
        </p>
      )}

      {/* 过滤器（仅 console） */}
      {isConsole && (
        <div className="mt-8 flex flex-wrap items-center gap-2">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((key) => {
            const label =
              key === 'all'
                ? '全部'
                : key === 'pending'
                ? '待审核'
                : key === 'approved'
                ? '已通过'
                : '已拒绝';
            const active = filter === key;
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-3 py-1.5 text-xs font-light tracking-wider transition-colors ${
                  active
                    ? 'bg-[#1b1c1e] text-white'
                    : 'bg-[#f5f6f7] text-[#85888e] hover:text-[#1b1c1e]'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* 列表 */}
      <div className="mt-6 border border-[#e3e4e8] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-[#e3e4e8] text-[11px] font-light tracking-[0.2em] text-[#9b9ea4]">
              <tr>
                <th className="px-5 py-4">文件名</th>
                <th className="px-5 py-4">大小</th>
                {isConsole && <th className="px-5 py-4">上传者</th>}
                <th className="px-5 py-4">上传时间</th>
                <th className="px-5 py-4">状态</th>
                <th className="px-5 py-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td
                    colSpan={isConsole ? 6 : 5}
                    className="px-5 py-10 text-center text-xs font-light text-[#9b9ea4]"
                  >
                    加载中...
                  </td>
                </tr>
              )}

              {!loading && visibleFiles.length === 0 && (
                <tr>
                  <td
                    colSpan={isConsole ? 6 : 5}
                    className="px-5 py-10 text-center text-xs font-light text-[#9b9ea4]"
                  >
                    暂无文件
                  </td>
                </tr>
              )}

              {!loading &&
                visibleFiles.map((f) => (
                  <tr
                    key={f.id}
                    className="border-b border-[#f0f1f3] last:border-0 transition-colors hover:bg-[#fafafa]"
                  >
                    {/* 文件名 */}
                    <td className="max-w-[260px] px-5 py-4">
                      <a
                        href={`/api/files/download?id=${f.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate text-[#1b1c1e] transition-colors hover:text-[#e8704a]"
                        title={f.name}
                      >
                        {f.name}
                      </a>
                      {f.status === 'rejected' && f.rejectReason && (
                        <p className="mt-1 text-[11px] font-light text-[#c62828]">
                          原因：{f.rejectReason}
                        </p>
                      )}
                    </td>

                    {/* 大小 */}
                    <td className="px-5 py-4 text-xs font-light text-[#85888e]">
                      {formatSize(f.size)}
                    </td>

                    {/* 上传者（仅 console） */}
                    {isConsole && (
                      <td className="px-5 py-4 text-xs font-light text-[#55585e]">
                        {f.uploaderName}
                      </td>
                    )}

                    {/* 上传时间 */}
                    <td className="px-5 py-4 text-xs font-light text-[#85888e]">
                      {new Date(f.uploadedAt).toLocaleString('zh-CN', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>

                    {/* 状态 */}
                    <td className="px-5 py-4">
                      <StatusBadge status={f.status} />
                    </td>

                    {/* 操作 */}
                    <td className="whitespace-nowrap px-5 py-4 text-right">
                      {isConsole && f.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleReview(f.id, 'approve')}
                            className="mr-4 text-xs font-light text-[#e8704a] transition-colors hover:text-[#c85a35]"
                          >
                            通过
                          </button>
                          <button
                            onClick={() => handleReview(f.id, 'reject')}
                            className="mr-4 text-xs font-light text-red-500 transition-colors hover:text-red-700"
                          >
                            拒绝
                          </button>
                        </>
                      )}
                      <a
                        href={`/api/files/download?id=${f.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mr-4 text-xs font-light text-[#85888e] transition-colors hover:text-[#1b1c1e]"
                      >
                        下载
                      </a>
                      <button
                        onClick={() => handleDelete(f.id)}
                        className="text-xs font-light text-[#9b9ea4] transition-colors hover:text-red-500"
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 底部信息 */}
      <p className="mt-6 text-[11px] font-light tracking-wider text-[#b9bcc2]">
        共 {visibleFiles.length} 个文件 · 单个文件不超过 10MB
      </p>
    </div>
  );
}