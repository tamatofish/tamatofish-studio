'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getSupabaseBrowserClientWithRetry } from '@/lib/supabase-browser';
import { callAuthenticatedApi } from '@/lib/auth-client';

const fieldCls =
  'rounded-none border-[#e3e4e8] bg-white text-[#1b1c1e] font-light placeholder:text-[#b9bcc2] focus-visible:ring-[#1b1c1e]/15 focus-visible:border-[#1b1c1e]';

interface FormState {
  name: string;
  company: string;
  interest: string;
  email: string;
  password: string;
  confirmPassword: string;
}

const INITIAL: FormState = {
  name: '',
  company: '',
  interest: '',
  email: '',
  password: '',
  confirmPassword: '',
};

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(INITIAL);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!form.name.trim()) return setErrorMsg('请填写称呼');
    if (!form.email.trim()) return setErrorMsg('请填写邮箱');
    if (form.password.length < 6) return setErrorMsg('密码至少 6 位');
    if (form.password !== form.confirmPassword) return setErrorMsg('两次输入的密码不一致');

    setSubmitting(true);
    try {
      const supabase = await getSupabaseBrowserClientWithRetry();
      const { data, error } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: { data: { full_name: form.name.trim() } },
      });

      if (error) {
        setErrorMsg(error.message.includes('already registered') ? '该邮箱已注册，请直接登录' : `注册失败：${error.message}`);
        return;
      }

      if (!data.session) {
        router.replace('/login?registered=1');
        return;
      }

      const profileRes = await callAuthenticatedApi('/api/visitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, company: form.company, interest: form.interest }),
      });
      if (!profileRes) return;

      router.replace('/dashboard');
    } catch {
      setErrorMsg('网络异常，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f2f3f5] px-6 py-16">
      <div className="w-full max-w-lg border border-[#e3e4e8] bg-white p-10">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#e8704a]" />
            <span className="text-sm font-light tracking-[0.35em] text-[#1b1c1e]">番茄鱼工作室</span>
          </div>
          <h1 className="mt-8 text-xl font-light tracking-[0.3em] text-[#1b1c1e]">注册账号</h1>
          <p className="mt-3 text-xs font-light text-[#9b9ea4]">登录后可查看合作意向、跟进处理进度</p>
          <div className="mx-auto mt-4 h-px w-10 bg-[#e8704a]" />
        </div>

        <form onSubmit={handleSubmit} className="mt-9 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-xs font-light tracking-[0.15em] text-[#85888e]">昵称 *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="点击输入文本"
                className={fieldCls}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company" className="text-xs font-light tracking-[0.15em] text-[#85888e]">公司/组织/个人（选填）</Label>
              <Input
                id="company"
                value={form.company}
                onChange={(e) => set('company', e.target.value)}
                placeholder="点击输入"
                className={fieldCls}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="interest" className="text-xs font-light tracking-[0.15em] text-[#85888e]">合作方向（选填）</Label>
            <Input
              id="interest"
              value={form.interest}
              onChange={(e) => set('interest', e.target.value)}
              placeholder="游戏合作 / 软件定制"
              className={fieldCls}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reg-email" className="text-xs font-light tracking-[0.15em] text-[#85888e]">邮箱 *</Label>
            <Input
              id="reg-email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="you@example.com"
              className={fieldCls}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="reg-password" className="text-xs font-light tracking-[0.15em] text-[#85888e]">密码 *</Label>
              <div className="relative">
                <Input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => set('password', e.target.value)}
                  placeholder="至少 6 位"
                  className={`${fieldCls} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#b9bcc2] transition-colors hover:text-[#1b1c1e]"
                  aria-label={showPassword ? '隐藏密码' : '显示密码'}
                >
                  {showPassword ? '隐' : '👁'}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="text-xs font-light tracking-[0.15em] text-[#85888e]">确认密码 *</Label>
              <Input
                id="confirm-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={(e) => set('confirmPassword', e.target.value)}
                placeholder="再次输入密码"
                className={fieldCls}
              />
            </div>
          </div>

          {errorMsg && <p className="text-xs font-light text-[#c2410c]">{errorMsg}</p>}

          <Button
            type="submit"
            disabled={submitting}
            className="w-full rounded-none border-0 bg-[#1b1c1e] text-[#f5f6f7] font-light tracking-[0.3em] hover:bg-[#3a3c40]"
          >
            {submitting ? '注册中…' : '注 册'}
          </Button>
        </form>

        <div className="mt-8 space-y-2.5 text-center text-xs font-light text-[#9b9ea4]">
          <p>
            已有账号？{' '}
            <Link href="/login" className="text-[#1b1c1e] underline underline-offset-4 hover:text-[#e8704a]">
              去登录
            </Link>
          </p>
          <p>工作室成员由内部统一创建账号，不开放自助注册</p>
        </div>
      </div>
    </div>
  );
}
