'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SiteNav } from '@/components/site-nav';
import { callAuthenticatedApi } from '@/lib/auth-client';

export default function MagicSEBetaPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(false);

  const [loginOpen, setLoginOpen] = useState(false);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleReserve = async () => {
    if (checking) return;
    setChecking(true);
    try {
      const res = await callAuthenticatedApi('/api/me');
      if (!res || !res.ok) { router.push('/login'); return; }
      const data = await res.json();
      if (data?.role === 'internal') { alert('请联系负责人获取相关信息'); return; }
      if (data?.role === 'visitor') { alert('预约成功，我们会尽快与你联系'); return; }
      router.push('/login');
    } catch { router.push('/login'); }
    finally { setChecking(false); }
  };

  const openLogin = () => {
    setCode('');
    setCodeError(null);
    setLoginOpen(true);
  };

  const submitCode = async () => {
    setCodeError(null);
    const trimmed = code.trim().toLowerCase();
    if (trimmed.length !== 64) {
      setCodeError(`验证码应为 64 位，当前 ${trimmed.length} 位`);
      return;
    }
    if (!/^[0-9a-f]{64}$/.test(trimmed)) {
      setCodeError('验证码只能包含 0-9 和 a-f');
      return;
    }
    setSubmitting(true);
    try {
      const res = await callAuthenticatedApi('/api/access-codes/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmed }),
      });
      if (!res || !res.ok) {
        const d = await res?.json().catch(() => ({}));
        throw new Error(d.error || '验证失败');
      }
      router.push('/magic-se/portal');
    } catch (err) {
      setCodeError(err instanceof Error ? err.message : '验证失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f2f3f5] font-sans text-[#1b1c1e] antialiased">
      <SiteNav />
      <main className="mx-auto flex min-h-[calc(100vh-64px)] max-w-3xl flex-col items-center justify-center px-6 py-24 text-center">
        <p className="text-xs font-light tracking-[0.5em] text-[#a3a6ac]">MAGIC SE · BETA</p>
        <h1 className="mt-6 text-5xl font-light tracking-[0.2em] text-[#1b1c1e] sm:text-6xl">Beta 测试</h1>
        <p className="mt-6 max-w-xl text-sm font-light leading-7 text-[#55585e]">
          MAGIC SE Beta 版正在内测中。感谢你的关注，我们会在正式开放时第一时间通知你。
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/magic"
            className="inline-flex items-center gap-2 border border-[#d4d6da] px-5 py-2.5 text-xs font-light tracking-[0.2em] text-[#55585e] transition-colors hover:border-[#1b1c1e] hover:text-[#1b1c1e]"
          >
            ← 返回 MAGIC 系列
          </Link>
          <button
            type="button"
            onClick={handleReserve}
            disabled={checking}
            className="inline-flex items-center gap-2 border border-[#1b1c1e] bg-[#1b1c1e] px-5 py-2.5 text-xs font-light tracking-[0.2em] text-[#f5f6f7] transition-colors hover:bg-[#3a3c40] disabled:opacity-50"
          >
            {checking ? '处理中…' : '预约'}
          </button>
          <button
            type="button"
            onClick={openLogin}
            className="inline-flex items-center gap-2 border border-[#d4d6da] px-5 py-2.5 text-xs font-light tracking-[0.2em] text-[#55585e] transition-colors hover:border-[#1b1c1e] hover:text-[#1b1c1e]"
          >
            登入
          </button>
        </div>
      </main>

      {loginOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6"
          onClick={() => { if (!submitting) setLoginOpen(false); }}
        >
          <div
            className="w-full max-w-md border border-[#e3e4e8] bg-white p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-base font-light tracking-[0.15em] text-[#1b1c1e]">输入验证码</p>
            <p className="mt-2 text-xs font-light leading-6 text-[#9b9ea4]">
              请输入 64 位访问验证码，验证通过后进入 Beta 测试。
            </p>

            <textarea
              value={code}
              onChange={(e) => { setCode(e.target.value); setCodeError(null); }}
              placeholder="粘贴或输入 64 位验证码"
              rows={3}
              autoFocus
              disabled={submitting}
              className="mt-5 w-full resize-none rounded-none border border-[#e3e4e8] bg-white px-3 py-2 font-mono text-xs font-light text-[#1b1c1e] placeholder:text-[#b9bcc2] focus:border-[#1b1c1e] focus:outline-none disabled:opacity-60"
            />

            <div className="mt-2 flex items-center justify-between text-[11px] font-light">
              <span className="text-[#9b9ea4]">{code.trim().length} / 64</span>
              {codeError && <span className="text-red-500">{codeError}</span>}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setLoginOpen(false)}
                disabled={submitting}
                className="border border-[#d4d6da] px-4 py-2 text-xs font-light tracking-[0.15em] text-[#55585e] transition-colors hover:border-[#1b1c1e] hover:text-[#1b1c1e] disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={submitCode}
                disabled={submitting}
                className="border border-[#1b1c1e] bg-[#1b1c1e] px-4 py-2 text-xs font-light tracking-[0.15em] text-[#f5f6f7] transition-colors hover:bg-[#3a3c40] disabled:opacity-50"
              >
                {submitting ? '验证中…' : '确认登入'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}