'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { callAuthenticatedApi } from '@/lib/auth-client';
import type { MeResponse } from '@/lib/types';

type Phase = 'checking' | 'guest' | 'visitor' | 'internal';

const btnSolid =
  'border-0 bg-[#1b1c1e] text-[#f5f6f7] hover:bg-[#3a3c40] rounded-none';
const btnGhost =
  'border border-[#d4d6da] bg-transparent text-[#55585e] hover:border-[#1b1c1e] hover:text-[#1b1c1e] rounded-none';
const fieldCls =
  'rounded-none border-[#e3e4e8] bg-white text-[#1b1c1e] font-light placeholder:text-[#b9bcc2] focus-visible:ring-[#1b1c1e]/15 focus-visible:border-[#1b1c1e]';

export function InquirySection() {
  const [phase, setPhase] = useState<Phase>('checking');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [form, setForm] = useState({ subject: '', message: '', contact: '' });

  const checkIdentity = useCallback(async () => {
    try {
      const res = await fetch('/api/me');
      if (!res.ok) {
        setPhase('guest');
        return;
      }
      const me = (await res.json()) as MeResponse;
      if (me.role === 'internal') {
        setPhase('internal');
      } else if (me.role === 'visitor') {
        setPhase('visitor');
      } else {
        setPhase('guest');
      }
    } catch {
      setPhase('guest');
    }
  }, []);

  useEffect(() => {
    void checkIdentity();
  }, [checkIdentity]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!form.subject.trim() || !form.message.trim()) {
      setErrorMsg('请填写主题和需求描述');
      return;
    }

    setSubmitting(true);
    try {
      const res = await callAuthenticatedApi('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res) return;
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErrorMsg(data.error ?? '提交失败，请稍后重试');
        return;
      }
      setDone(true);
      setForm({ subject: '', message: '', contact: '' });
    } catch {
      setErrorMsg('网络异常，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl border border-[#e3e4e8] bg-white p-8 sm:p-10">
      {phase === 'checking' && (
        <p className="py-8 text-center text-sm font-light text-[#9b9ea4]">正在确认登录状态…</p>
      )}

      {phase === 'guest' && (
        <div className="flex flex-col items-center gap-5 py-6">
          <p className="text-sm font-light text-[#55585e]">提交合作意向需要先登录访客账号</p>
          <div className="flex gap-3">
            <Button asChild className={btnSolid}>
              <Link href="/login">登录</Link>
            </Button>
            <Button asChild variant="outline" className={btnGhost}>
              <Link href="/register?role=visitor">注册访客账号</Link>
            </Button>
          </div>
        </div>
      )}

      {phase === 'internal' && (
        <div className="flex flex-col items-center gap-5 py-6">
          <p className="text-sm font-light text-[#55585e]">
            当前是内部成员账号，可在工作台查看和跟进访客意向
          </p>
          <Button asChild className={btnSolid}>
            <Link href="/admin">进入工作台</Link>
          </Button>
        </div>
      )}

      {phase === 'visitor' && done && (
        <div className="flex flex-col items-center gap-5 py-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#d4d6da] text-lg font-light text-[#1b1c1e]">
            ✓
          </div>
          <p className="text-sm font-light text-[#1b1c1e]">合作意向已提交，感谢你的信任！</p>
          <div className="flex gap-3">
            <Button variant="outline" className={btnGhost} onClick={() => setDone(false)}>
              再提交一条
            </Button>
            <Button asChild className={btnSolid}>
              <Link href="/dashboard">查看我的意向</Link>
            </Button>
          </div>
        </div>
      )}

      {phase === 'visitor' && !done && (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="subject" className="text-xs font-light tracking-[0.15em] text-[#85888e]">
              合作主题
            </Label>
            <Input
              id="subject"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder="例如：企业官网 / 小程序 / AI 助手开发"
              className={fieldCls}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="message" className="text-xs font-light tracking-[0.15em] text-[#85888e]">
              需求描述
            </Label>
            <Textarea
              id="message"
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder="简单描述你的项目背景、目标和期望时间"
              rows={4}
              className={fieldCls}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact" className="text-xs font-light tracking-[0.15em] text-[#85888e]">
              联系方式（选填）
            </Label>
            <Input
              id="contact"
              value={form.contact}
              onChange={(e) => setForm({ ...form, contact: e.target.value })}
              placeholder="手机 / 微信 / 邮箱"
              className={fieldCls}
            />
          </div>
          {errorMsg && <p className="text-xs font-light text-[#c2410c]">{errorMsg}</p>}
          <Button type="submit" disabled={submitting} className={`w-full ${btnSolid}`}>
            {submitting ? '提交中…' : '提交合作意向'}
          </Button>
        </form>
      )}
    </div>
  );
}
