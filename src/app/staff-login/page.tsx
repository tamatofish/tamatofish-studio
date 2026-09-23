'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getSupabaseBrowserClientWithRetry } from '@/lib/supabase-browser';

const fieldCls =
  'rounded-none border-[#e3e4e8] bg-white text-[#1b1c1e] font-light placeholder:text-[#b9bcc2] focus-visible:ring-[#1b1c1e]/15 focus-visible:border-[#1b1c1e]';

interface StaffLoginResponse {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  member: { id: string; member_no: string; name: string };
}

export default function StaffLoginPage() {
  const router = useRouter();
  const [memberNo, setMemberNo] = useState('');
  const [password, setPassword] = useState('');
  const [captchaCode, setCaptchaCode] = useState('');
  const [captchaSvg, setCaptchaSvg] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const tokenRef = useRef('');

  const refreshCaptcha = useCallback(async () => {
    try {
      const res = await fetch('/api/staff/captcha', { cache: 'no-store' });
      const data = (await res.json()) as { svg: string; token: string };
      tokenRef.current = data.token;
      setCaptchaToken(data.token);
      setCaptchaSvg(data.svg);
    } catch {
      setErrorMsg('验证码加载失败，请重试');
    }
  }, []);

  useEffect(() => {
    void refreshCaptcha();
  }, [refreshCaptcha]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!memberNo.trim() || !password) {
      setErrorMsg('请输入工号和密码');
      return;
    }
    if (!captchaCode.trim()) {
      setErrorMsg('请输入验证码');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/staff/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_no: memberNo.trim(),
          password,
          captcha_token: captchaToken,
          captcha_code: captchaCode.trim(),
        }),
      });
      const data = (await res.json()) as StaffLoginResponse & { error?: string };
      if (!res.ok) {
        setErrorMsg(data.error ?? '登录失败，请稍后重试');
        setCaptchaCode('');
        await refreshCaptcha();
        return;
      }
      const supabase = await getSupabaseBrowserClientWithRetry();
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      if (sessionError) {
        setErrorMsg('登录态写入失败，请重试');
        return;
      }
      router.replace('/admin');
    } catch {
      setErrorMsg('网络异常，请稍后重试');
      await refreshCaptcha();
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
          <h1 className="mt-8 text-xl font-light tracking-[0.3em] text-[#1b1c1e]">成员工作台</h1>
          <p className="mt-3 text-[11px] font-light tracking-[0.3em] text-[#9b9ea4]">内部入口 · STAFF ONLY</p>
          <div className="mx-auto mt-4 h-px w-10 bg-[#e8704a]" />
        </div>
        <form onSubmit={handleLogin} className="mt-9 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="member-no" className="text-xs font-light tracking-[0.15em] text-[#85888e]">编号</Label>
            <Input
              id="member-no"
              value={memberNo}
              onChange={(e) => setMemberNo(e.target.value.toUpperCase())}
              placeholder="例如：TF001"
              autoCapitalize="characters"
              className={fieldCls}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="staff-password" className="text-xs font-light tracking-[0.15em] text-[#85888e]">密码</Label>
            <div className="relative">
              <Input
                id="staff-password"
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
          <div className="space-y-2">
            <Label htmlFor="captcha" className="text-xs font-light tracking-[0.15em] text-[#85888e]">验证码</Label>
            <div className="flex items-stretch gap-3">
              <Input
                id="captcha"
                value={captchaCode}
                onChange={(e) => setCaptchaCode(e.target.value)}
                placeholder="输入右侧字符"
                maxLength={6}
                className={fieldCls}
              />
              <button
                type="button"
                onClick={() => {
                  void refreshCaptcha();
                  setCaptchaCode('');
                }}
                title="点击刷新验证码"
                className="flex min-w-[128px] cursor-pointer items-center justify-center overflow-hidden rounded-none border border-[#e3e4e8] bg-white transition-colors hover:border-[#1b1c1e]"
              >
                {captchaSvg ? (
                  <span className="[&>svg]:h-10" dangerouslySetInnerHTML={{ __html: captchaSvg }} />
                ) : (
                  <span className="text-xs font-light text-[#b9bcc2]">加载中…</span>
                )}
              </button>
            </div>
            <p className="text-[11px] font-light text-[#b9bcc2]">看不清？点击图片可刷新</p>
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
          <p>修改密码请登录后在工作台右上角操作</p>
          <p className="flex items-center justify-center gap-4">
            <Link href="/" className="transition-colors hover:text-[#1b1c1e]">
              返回官网首页
            </Link>
            <Link href="/admin-login" className="transition-colors hover:text-[#1b1c1e]">
              管理控制台
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
