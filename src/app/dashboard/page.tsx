'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { getSupabaseBrowserClientWithRetry } from '@/lib/supabase-browser';
import { callAuthenticatedApi } from '@/lib/auth-client';
import { DashboardHero } from '@/components/dashboard-hero';
import { DashboardHelp } from '@/components/dashboard-help';
import { INQUIRY_STATUS_MAP, type Inquiry, type MeResponse } from '@/lib/types';

const EMPTY_PROFILE = { name: '', company: '', phone: '', interest: '' };
const EMPTY_INQUIRY = { subject: '', message: '', contact: '' };
const EMPTY_FEEDBACK = { category: 'other', content: '' };

const fieldCls =
  'rounded-none border-[#e3e4e8] bg-white text-[#1b1c1e] font-light placeholder:text-[#b9bcc2] focus-visible:ring-[#1b1c1e]/15 focus-visible:border-[#1b1c1e]';
const btnSolid =
  'rounded-none border-0 bg-[#1b1c1e] text-[#f5f6f7] font-light hover:bg-[#3a3c40]';
const panelCls = 'border border-[#e3e4e8] bg-white';

type SectionKey = 'inquiries' | 'profile' | 'feedback' | 'help';

const SECTIONS: { key: SectionKey; label: string; icon: React.ReactNode }[] = [
  {
    key: 'inquiries',
    label: '合作意向',
    icon: (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a8 8 0 1 1-3.3-6.4" /><path d="M22 4l-10 10-3-3" /></svg>),
  },
  {
    key: 'profile',
    label: '我的档案',
    icon: (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3" /><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" /></svg>),
  },
  {
    key: 'feedback',
    label: '问题反馈',
    icon: (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" /></svg>),
  },
  {
    key: 'help',
    label: '使用帮助',
    icon: (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.8 2.1c-.8.6-1.3 1.2-1.3 2.2" /><circle cx="12" cy="17" r="0.5" fill="currentColor" /></svg>),
  },
];

const FEEDBACK_CATEGORIES = [
  { value: 'bug', label: 'Bug 反馈' },
  { value: 'suggestion', label: '功能建议' },
  { value: 'content', label: '内容问题' },
  { value: 'other', label: '其它' },
];

interface FeedbackRecord {
  id: string;
  user_id: string | null;
  name: string | null;
  email: string | null;
  category: string;
  content: string;
  status: string;
  admin_reply: string | null;
  created_at: string;
  replied_at: string | null;
}

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [activeSection, setActiveSection] = useState<SectionKey>('inquiries');

  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);

  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [inquiryForm, setInquiryForm] = useState(EMPTY_INQUIRY);
  const [submitting, setSubmitting] = useState(false);
  const [inquiryMsg, setInquiryMsg] = useState<string | null>(null);

  const [feedbacks, setFeedbacks] = useState<FeedbackRecord[]>([]);
  const [feedbackForm, setFeedbackForm] = useState(EMPTY_FEEDBACK);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const loadInquiries = useCallback(async () => {
    const res = await callAuthenticatedApi('/api/inquiries');
    if (!res) return;
    if (res.ok) {
      const data = (await res.json()) as { inquiries: Inquiry[] };
      setInquiries(data.inquiries);
    }
  }, []);

  const loadFeedbacks = useCallback(async () => {
    const res = await callAuthenticatedApi('/api/feedback');
    if (!res) return;
    if (res.ok) {
      const data = (await res.json()) as { feedbacks: FeedbackRecord[] };
      setFeedbacks(data.feedbacks);
    }
  }, []);

  const fillProfile = useCallback((visitor: any) => {
    if (!visitor) return;
    setProfile({
      name: visitor.name ?? '',
      company: visitor.company ?? '',
      phone: visitor.phone ?? '',
      interest: visitor.interest ?? '',
    });
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      // 1) 拿 me 判断身份
      const res = await callAuthenticatedApi('/api/me');
      if (!active) return;
      if (!res || !res.ok) {
        router.replace('/login');
        return;
      }
      const data = (await res.json()) as MeResponse;
      if (!active) return;
      setMe(data);

      // 2) 直接调 /api/my-visitor 拿 visitor（不依赖 me.visitor）
      const vRes = await callAuthenticatedApi('/api/my-visitor');
      if (!active) return;
      if (vRes?.ok) {
        const vData = (await vRes.json()) as { visitor: any };
        fillProfile(vData.visitor);
      }

      // 3) 是 visitor 就加载其他数据
      if (data.role === 'visitor') {
        void loadInquiries();
        void loadFeedbacks();
      }

      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [router, loadInquiries, loadFeedbacks, fillProfile]);

  const handleSaveProfile = async () => {
    setProfileMsg(null);
    if (!profile.name.trim()) {
      setProfileMsg('称呼不能为空');
      return;
    }
    setSavingProfile(true);
    try {
      const res = await callAuthenticatedApi('/api/visitors', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      if (!res) { setProfileMsg('请求未发出（可能未登录）'); return; }
      const text = await res.text();
      if (!res.ok) { setProfileMsg(`保存失败：HTTP ${res.status}｜${text.slice(0, 300)}`); return; }
      setProfileMsg('已保存');
      // 重新拉一次 my-visitor
      const vRes = await callAuthenticatedApi('/api/my-visitor');
      if (vRes?.ok) {
        const vData = (await vRes.json()) as { visitor: any };
        fillProfile(vData.visitor);
      }
    } catch (err) {
      setProfileMsg(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSubmitInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    setInquiryMsg(null);
    if (!inquiryForm.subject.trim() || !inquiryForm.message.trim()) {
      setInquiryMsg('请填写主题和需求描述');
      return;
    }
    setSubmitting(true);
    try {
      const res = await callAuthenticatedApi('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inquiryForm),
      });
      if (!res) { setInquiryMsg('请求未发出（可能未登录）'); return; }
      const text = await res.text();
      if (!res.ok) { setInquiryMsg(`提交失败：HTTP ${res.status}｜${text.slice(0, 300)}`); return; }
      setInquiryForm(EMPTY_INQUIRY);
      setInquiryMsg('提交成功，团队会尽快跟进');
      await loadInquiries();
    } catch (err) {
      setInquiryMsg(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackMsg(null);
    if (!feedbackForm.content.trim()) {
      setFeedbackMsg('请填写反馈内容');
      return;
    }
    setSubmittingFeedback(true);
    try {
      const res = await callAuthenticatedApi('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feedbackForm),
      });
      if (!res) { setFeedbackMsg('请求未发出（可能未登录）'); return; }
      const text = await res.text();
      if (!res.ok) { setFeedbackMsg(`提交失败：HTTP ${res.status}｜${text.slice(0, 300)}`); return; }
      setFeedbackForm(EMPTY_FEEDBACK);
      setFeedbackMsg('反馈已提交，感谢你的意见');
      await loadFeedbacks();
    } catch (err) {
      setFeedbackMsg(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handleLogout = async () => {
    if (!window.confirm('确定退出登录吗？')) return;
    const supabase = await getSupabaseBrowserClientWithRetry();
    await supabase.auth.signOut();
    router.replace('/login');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f2f3f5] text-sm font-light text-[#9b9ea4]">
        加载中…
      </div>
    );
  }

  if (me?.role === 'internal') {
    return (
      <div className="min-h-screen bg-[#f2f3f5]">
        <header className="border-b border-[#e3e4e8] bg-[#f2f3f5]/90 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
            <Link href="/" className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#e8704a]" />
              <span className="text-sm font-light tracking-[0.35em] text-[#1b1c1e]">番茄鱼工作室</span>
              <span className="ml-2 text-xs font-light tracking-[0.2em] text-[#9b9ea4]">我的中心</span>
            </Link>
            <div className="flex items-center gap-4">
              <span className="text-xs font-light text-[#85888e]">{me?.email}</span>
              <Button
                size="sm"
                variant="outline"
                className="rounded-none border-[#d4d6da] bg-transparent text-xs font-light text-[#55585e] hover:border-[#1b1c1e] hover:bg-transparent hover:text-[#1b1c1e]"
                onClick={handleLogout}
              >
                退出登录
              </Button>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-10">
          <div className={`${panelCls} flex flex-col items-center gap-5 p-12 text-center`}>
            <p className="text-sm font-light text-[#55585e]">当前账号是工作室成员，请前往工作台管理访客与合作意向</p>
            <Button asChild className={btnSolid}>
              <Link href="/admin">进入工作台</Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f2f3f5]">
      <header className="border-b border-[#e3e4e8] bg-[#f2f3f5]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#e8704a]" />
            <span className="text-sm font-light tracking-[0.35em] text-[#1b1c1e]">番茄鱼工作室</span>
            <span className="ml-2 text-xs font-light tracking-[0.2em] text-[#9b9ea4]">我的中心</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-xs font-light text-[#85888e]">{me?.email}</span>
            <Button
              size="sm"
              variant="outline"
              className="rounded-none border-[#d4d6da] bg-transparent text-xs font-light text-[#55585e] hover:border-[#1b1c1e] hover:bg-transparent hover:text-[#1b1c1e]"
              onClick={handleLogout}
            >
              退出登录
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-10">
        <DashboardHero
          name={profile.name || ''}
          company={profile.company || ''}
        />

        <div className="flex gap-6">
          <aside className="sticky top-6 h-fit w-[88px] shrink-0 border border-[#e3e4e8] bg-white">
            <nav className="flex flex-col">
              {SECTIONS.map((s) => {
                const active = activeSection === s.key;
                return (
                  <button
                    key={s.key}
                    onClick={() => setActiveSection(s.key)}
                    className={`flex flex-col items-center gap-1.5 py-4 transition-colors ${
                      active ? 'bg-[#1b1c1e] text-white' : 'text-[#85888e] hover:bg-[#f5f6f7] hover:text-[#1b1c1e]'
                    }`}
                  >
                    <span className="flex h-5 w-5 items-center justify-center">{s.icon}</span>
                    <span className="text-[11px] font-light tracking-wider">{s.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          <main className="min-w-0 flex-1">
            {activeSection === 'inquiries' && (
              <div className="space-y-6">
                <div className={panelCls}>
                  <div className="border-b border-[#e3e4e8] px-7 py-5">
                    <h2 className="text-sm font-light tracking-[0.2em] text-[#1b1c1e]">提交新的合作意向</h2>
                  </div>
                  <div className="p-7">
                    <form onSubmit={handleSubmitInquiry} className="space-y-5">
                      <div className="space-y-2">
                        <Label htmlFor="d-subject" className="text-xs font-light tracking-[0.15em] text-[#85888e]">主题</Label>
                        <Input
                          id="d-subject"
                          value={inquiryForm.subject}
                          onChange={(e) => setInquiryForm({ ...inquiryForm, subject: e.target.value })}
                          placeholder="例如：企业官网改版"
                          className={fieldCls}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="d-message" className="text-xs font-light tracking-[0.15em] text-[#85888e]">需求描述</Label>
                        <Textarea
                          id="d-message"
                          value={inquiryForm.message}
                          onChange={(e) => setInquiryForm({ ...inquiryForm, message: e.target.value })}
                          rows={4}
                          placeholder="描述项目背景、目标与期望"
                          className={fieldCls}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="d-contact" className="text-xs font-light tracking-[0.15em] text-[#85888e]">联系方式（选填）</Label>
                        <Input
                          id="d-contact"
                          value={inquiryForm.contact}
                          onChange={(e) => setInquiryForm({ ...inquiryForm, contact: e.target.value })}
                          placeholder="手机 / 微信 / 邮箱"
                          className={fieldCls}
                        />
                      </div>
                      {inquiryMsg && (
                        <p className="whitespace-pre-wrap break-all text-xs font-light text-[#c2410c]">{inquiryMsg}</p>
                      )}
                      <Button type="submit" disabled={submitting} className={btnSolid}>
                        {submitting ? '提交中…' : '提交意向'}
                      </Button>
                    </form>
                  </div>
                </div>

                <div className="space-y-4">
                  <h2 className="text-sm font-light tracking-[0.2em] text-[#1b1c1e]">
                    我的意向记录（{inquiries.length}）
                  </h2>
                  {inquiries.length === 0 ? (
                    <p className={`${panelCls} p-8 text-center text-xs font-light text-[#9b9ea4]`}>暂无合作意向记录</p>
                  ) : (
                    inquiries.map((q) => {
                      const status = INQUIRY_STATUS_MAP[q.status] ?? INQUIRY_STATUS_MAP.pending;
                      return (
                        <div key={q.id} className={`${panelCls} p-6`}>
                          <div className="flex flex-wrap items-center gap-3">
                            <h3 className="text-sm font-light tracking-wider text-[#1b1c1e]">{q.subject}</h3>
                            <Badge variant="outline" className={`${status.className} rounded-none border font-light`}>
                              {status.label}
                            </Badge>
                          </div>
                          <p className="mt-3 whitespace-pre-wrap text-xs font-light leading-6 text-[#85888e]">{q.message}</p>
                          <p className="mt-3 text-[11px] font-light text-[#b9bcc2]">
                            提交于 {new Date(q.created_at).toLocaleString('zh-CN')}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {activeSection === 'profile' && (
              <div className={panelCls}>
                <div className="border-b border-[#e3e4e8] px-7 py-5">
                  <h2 className="text-sm font-light tracking-[0.2em] text-[#1b1c1e]">我的档案</h2>
                  <p className="mt-1 text-xs font-light text-[#9b9ea4]">完善信息有助于团队更高效地跟进你的需求</p>
                </div>
                <div className="space-y-5 p-7">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="p-name" className="text-xs font-light tracking-[0.15em] text-[#85888e]">称呼 *</Label>
                      <Input id="p-name" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} className={fieldCls} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="p-company" className="text-xs font-light tracking-[0.15em] text-[#85888e]">公司 / 组织</Label>
                      <Input id="p-company" value={profile.company} onChange={(e) => setProfile({ ...profile, company: e.target.value })} className={fieldCls} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="p-phone" className="text-xs font-light tracking-[0.15em] text-[#85888e]">电话</Label>
                      <Input id="p-phone" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} className={fieldCls} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="p-interest" className="text-xs font-light tracking-[0.15em] text-[#85888e]">感兴趣的方向</Label>
                      <Input id="p-interest" value={profile.interest} onChange={(e) => setProfile({ ...profile, interest: e.target.value })} className={fieldCls} />
                    </div>
                  </div>
                  {profileMsg && (
                    <p className="whitespace-pre-wrap break-all text-xs font-light text-[#c2410c]">{profileMsg}</p>
                  )}
                  <Button onClick={handleSaveProfile} disabled={savingProfile} className={btnSolid}>
                    {savingProfile ? '保存中…' : '保存档案'}
                  </Button>
                </div>
              </div>
            )}

            {activeSection === 'feedback' && (
              <div className="space-y-6">
                <div className={panelCls}>
                  <div className="border-b border-[#e3e4e8] px-7 py-5">
                    <h2 className="text-sm font-light tracking-[0.2em] text-[#1b1c1e]">问题反馈</h2>
                    <p className="mt-1 text-xs font-light text-[#9b9ea4]">遇到 Bug 或有建议，欢迎告诉我们</p>
                  </div>
                  <div className="p-7">
                    <form onSubmit={handleSubmitFeedback} className="space-y-5">
                      <div className="space-y-2">
                        <Label className="text-xs font-light tracking-[0.15em] text-[#85888e]">分类</Label>
                        <div className="flex flex-wrap gap-2">
                          {FEEDBACK_CATEGORIES.map((c) => {
                            const active = feedbackForm.category === c.value;
                            return (
                              <button
                                key={c.value}
                                type="button"
                                onClick={() => setFeedbackForm({ ...feedbackForm, category: c.value })}
                                className={`px-3 py-1.5 text-xs font-light tracking-wider transition-colors ${
                                  active ? 'bg-[#1b1c1e] text-white' : 'bg-[#f5f6f7] text-[#85888e] hover:text-[#1b1c1e]'
                                }`}
                              >
                                {c.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="fb-content" className="text-xs font-light tracking-[0.15em] text-[#85888e]">内容 *</Label>
                        <Textarea
                          id="fb-content"
                          value={feedbackForm.content}
                          onChange={(e) => setFeedbackForm({ ...feedbackForm, content: e.target.value })}
                          rows={6}
                          placeholder="请尽可能详细描述问题或建议（不超过 5000 字）"
                          className={fieldCls}
                        />
                      </div>
                      {feedbackMsg && (
                        <p className="whitespace-pre-wrap break-all text-xs font-light text-[#c2410c]">{feedbackMsg}</p>
                      )}
                      <Button type="submit" disabled={submittingFeedback} className={btnSolid}>
                        {submittingFeedback ? '提交中…' : '提交反馈'}
                      </Button>
                    </form>
                  </div>
                </div>

                <div className="space-y-4">
                  <h2 className="text-sm font-light tracking-[0.2em] text-[#1b1c1e]">
                    我的反馈记录（{feedbacks.length}）
                  </h2>
                  {feedbacks.length === 0 ? (
                    <p className={`${panelCls} p-8 text-center text-xs font-light text-[#9b9ea4]`}>暂无反馈记录</p>
                  ) : (
                    feedbacks.map((f) => {
                      const catLabel = FEEDBACK_CATEGORIES.find((c) => c.value === f.category)?.label ?? f.category;
                      const stMap: Record<string, { text: string; cls: string }> = {
                        pending: { text: '待处理', cls: 'bg-[#fef3c7] text-[#b45309]' },
                        processing: { text: '处理中', cls: 'bg-[#cffafe] text-[#0e7490]' },
                        resolved: { text: '已解决', cls: 'bg-[#dcfce7] text-[#166534]' },
                        rejected: { text: '已关闭', cls: 'bg-[#eef0f2] text-[#85888e]' },
                      };
                      const st = stMap[f.status] ?? { text: f.status, cls: 'bg-[#eef0f2] text-[#85888e]' };
                      return (
                        <div key={f.id} className={`${panelCls} p-6`}>
                          <div className="flex flex-wrap items-center gap-3">
                            <Badge variant="outline" className="rounded-none border-0 bg-[#f0f9ff] text-[10px] font-light text-[#0369a1]">{catLabel}</Badge>
                            <Badge variant="outline" className={`rounded-none border-0 text-[10px] font-light ${st.cls}`}>{st.text}</Badge>
                            <span className="text-[11px] font-light text-[#b9bcc2]">
                              {new Date(f.created_at).toLocaleString('zh-CN')}
                            </span>
                          </div>
                          <p className="mt-3 whitespace-pre-wrap text-xs font-light leading-6 text-[#55585e]">{f.content}</p>
                          {f.admin_reply && (
                            <div className="mt-4 border-l-2 border-[#e8704a] bg-[#fafbfc] p-4">
                              <p className="text-[10px] font-light tracking-[0.2em] text-[#9b9ea4]">管理员回复</p>
                              <p className="mt-1.5 whitespace-pre-wrap text-xs font-light leading-6 text-[#1b1c1e]">{f.admin_reply}</p>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {activeSection === 'help' && <DashboardHelp />}
          </main>
        </div>
      </div>
    </div>
  );
}