'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ShieldCheck } from 'lucide-react';
import { getSupabaseBrowserClientWithRetry } from '@/lib/supabase-browser';

const fieldCls =
  'rounded-none border-[#e3e4e8] bg-white text-[#1b1c1e] font-light placeholder:text-[#b9bcc2] focus-visible:ring-[#1b1c1e]/15 focus-visible:border-[#1b1c1e]';

interface AdminLoginResponse {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
  error?: string;
}

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = '管理员登录 · 番茄鱼工作室';
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      if (!email.trim() || !password || !code.trim()) {
        setError('请填写账号、密码和验证码');
        return;
      }
      setLoading(true);
      try {
        const res = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim(), password, code: code.trim() }),
        });
        const data = (await res.json()) as AdminLoginResponse;
        if (!res.ok || !data.access_token || !data.refresh_token) {
          setError(data.error ?? '登录失败，请稍后重试');
          return;
        }
        const supabase = await getSupabaseBrowserClientWithRetry();
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        });
        if (sessionError) {
          setError(`登录态建立失败: ${sessionError.message}`);
          return;
        }
        router.replace('/admin-console');
      } catch {
        setError('网络异常，请稍后重试');
      } finally {
        setLoading(false);
      }
    },
    [email, password, code, router],
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f2f3f5] px-6 py-16">
      <div className="w-full max-w-md border border-[#e3e4e8] bg-white p-10">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#e8704a]" />
            <span className="text-sm font-light tracking-[0.35em] text-[#1b1c1e]">番茄鱼工作室</span>
          </div>
          <h1 className="mt-8 flex items-center justify-center gap-2 text-xl font-light tracking-[0.3em] text-[#1b1c1e]">
            <ShieldCheck className="h-4 w-4 text-[#e8704a]" />
            管理员登录
          </h1>
          <p className="mt-3 text-[11px] font-light tracking-[0.3em] text-[#9b9ea4]">管理控制台入口</p>
          <div className="mx-auto mt-4 h-px w-10 bg-[#e8704a]" />
        </div>

        <form onSubmit={handleSubmit} className="mt-9 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="admin-email" className="text-xs font-light tracking-[0.15em] text-[#85888e]">管理员账号</Label>
            <Input
              id="admin-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="请输入管理员账号"
              className={fieldCls}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-password" className="text-xs font-light tracking-[0.15em] text-[#85888e]">密码</Label>
            <div className="relative">
              <Input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                className={`${fieldCls} pr-11`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#b9bcc2] transition-colors hover:text-[#1b1c1e]"
                aria-label={showPassword ? '隐藏密码' : '显示密码'}
              >
                {showPassword ? '🙈' : '👁'}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-code" className="text-xs font-light tracking-[0.15em] text-[#85888e]">验证码</Label>
            <Input
              id="admin-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="请输入管理验证码"
              className={fieldCls}
            />
          </div>
          {error && <p className="text-xs font-light text-[#c2410c]">{error}</p>}
          <Button
            type="submit"
            disabled={loading}
            className="w-full rounded-none border-0 bg-[#1b1c1e] text-[#f5f6f7] font-light tracking-[0.25em] hover:bg-[#3a3c40]"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 登录中…
              </>
            ) : (
              '登录管理控制台'
            )}
          </Button>
        </form>

        <div className="mt-8 flex items-center justify-center gap-4 text-xs font-light text-[#9b9ea4]">
          <Link href="/" className="transition-colors hover:text-[#1b1c1e]">返回官网</Link>
          <span className="text-[#e3e4e8]">|</span>
          <Link href="/login" className="transition-colors hover:text-[#1b1c1e]">访客登录</Link>
          <span className="text-[#e3e4e8]">|</span>
          <Link href="/staff-login" className="transition-colors hover:text-[#1b1c1e]">成员登录</Link>
        </div>
      </div>
    </div>
  );
}
