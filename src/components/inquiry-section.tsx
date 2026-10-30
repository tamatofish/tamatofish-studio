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

// 主按钮：白底黑字（暗色页面上的反相）
const btnSolid =
  'border-0 bg-[#e8e9eb] text-[#0a0a0b] hover:bg-white rounded-none';
// 次按钮：透明底 + 暗色边框
const btnGhost =
  'border border-[#3a3b40] bg-transparent text-[#a0a2a8] hover:border-[#e8e9eb] hover:text-[#e8e9eb] rounded-none';
// 表单字段：暗色底 + 暗色边框
const fieldCls =
  'rounded-none border-[#2a2b30] bg-[#0f1012] text-[#e8e9eb] font-light placeholder:text-[#4a4c52] focus-visible:ring-[#e8704a]/25 focus-visible:border-[#e8704a]';

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
    <div className="max-w-2xl border border-[#25262a] bg-[#111215] p-8 sm:p-10">
      {phase === 'checking' && (
        <p className="py-8 text-center text-sm font-light text-[#5a5c62]">正在确认登录状态…</p>
      )}

      {phase === 'guest' && (
        <div className="flex flex-col items-center gap-5 py-6">
          <p className="text-sm font-light text-[#a0a2a8]">提交合作意向需要先登录访客账号</p>
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
          <p className="text-sm font-light text-[#a0a2a8]">
            当前是内部成员账号，可在工作台查看和跟进访客意向
          </p>
          <Button asChild className={btnSolid}>
            <Link href="/admin">进入工作台</Link>
          </Button>
        </div>
      )}

      {phase === 'visitor' && done && (
        <div className="flex flex-col items-center gap-5 py-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#3a3b40] text-lg font-light text-[#e8e9eb]">
            ✓
          </div>
          <p className="text-sm font-light text-[#e8e9eb]">合作意向已提交，感谢你的信任！</p>
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
            <Label htmlFor="subject" className="text-xs font-light tracking-[0.15em] text-[#8a8c91]">
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
            <Label htmlFor="message" className="text-xs font-light tracking-[0.15em] text-[#8a8c91]">
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
            <Label htmlFor="contact" className="text-xs font-light tracking-[0.15em] text-[#8a8c91]">
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
          {errorMsg && <p className="text-xs font-light text-[#f07a52]">{errorMsg}</p>}
          <Button type="submit" disabled={submitting} className={`w-full ${btnSolid}`}>
            {submitting ? '提交中…' : '提交合作意向'}
          </Button>
        </form>
      )}
    </div>
  );
}