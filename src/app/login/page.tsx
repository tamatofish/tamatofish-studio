'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getSupabaseBrowserClientWithRetry } from '@/lib/supabase-browser';
import { callAuthenticatedApi } from '@/lib/auth-client';
import type { MeResponse } from '@/lib/types';

const fieldCls =
  'rounded-none border-[#e3e4e8] bg-white text-[#1b1c1e] font-light placeholder:text-[#b9bcc2] focus-visible:ring-[#1b1c1e]/15 focus-visible:border-[#1b1c1e]';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!email.trim() || !password) {
      setErrorMsg('请输入邮箱和密码');
      return;
    }
    setSubmitting(true);
    try {
      const supabase = await getSupabaseBrowserClientWithRetry();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error || !data.session) {
        setErrorMsg(error?.message?.includes('Invalid login')
          ? '邮箱或密码错误，请重试'
          : `登录失败：${error?.message ?? '未知错误'}`);
        return;
      }
      const meRes = await callAuthenticatedApi('/api/me');
      if (!meRes) return;
      if (meRes.ok) {
        const me = (await meRes.json()) as MeResponse;
        router.replace(me.role === 'internal' ? '/admin' : '/dashboard');
        return;
      }
      router.replace('/dashboard');
    } catch {
      setErrorMsg('网络异常，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f2f3f5] px-6 py-16">
      <div className="w-full max-w-md border border-[#e3e4e8] bg-white p-10">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#e8704a]" />
            <span className="text-sm font-light tracking-[0.35em] text-[#1b1c1e]">番茄鱼工作室</span>
          </div>
          <h1 className="mt-8 text-xl font-light tracking-[0.3em] text-[#1b1c1e]">访客登录</h1>
          <div className="mx-auto mt-4 h-px w-10 bg-[#e8704a]" />
        </div>
        <form onSubmit={handleLogin} className="mt-9 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-xs font-light tracking-[0.15em] text-[#85888e]">邮箱</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={fieldCls}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-xs font-light tracking-[0.15em] text-[#85888e]">密码</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="输入密码"
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
          {errorMsg && <p className="text-xs font-light text-[#c2410c]">{errorMsg}</p>}
          <Button
            type="submit"
            disabled={submitting}
            className="w-full rounded-none border-0 bg-[#1b1c1e] text-[#f5f6f7] font-light tracking-[0.3em] hover:bg-[#3a3c40]"
          >
            {submitting ? '登录中…' : '登 录'}
          </Button>
        </form>
        <div className="mt-8 space-y-2.5 text-center text-xs font-light text-[#9b9ea4]">
          <p>
            还没有账号？{' '}
            <Link href="/register" className="text-[#1b1c1e] underline underline-offset-4 hover:text-[#e8704a]">
              去注册
            </Link>
          </p>
          <p className="flex items-center justify-center gap-4">
            <Link href="/" className="transition-colors hover:text-[#1b1c1e]">
              返回官网首页
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
