'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getSupabaseBrowserClientWithRetry } from '@/lib/supabase-browser';
import { callAuthenticatedApi } from '@/lib/auth-client';
import { INQUIRY_STATUS_MAP, type Inquiry, type MeResponse, type Visitor } from '@/lib/types';

const EMPTY_PROFILE = { name: '', company: '', phone: '', interest: '' };
const EMPTY_INQUIRY = { subject: '', message: '', contact: '' };

const fieldCls =
  'rounded-none border-[#e3e4e8] bg-white text-[#1b1c1e] font-light placeholder:text-[#b9bcc2] focus-visible:ring-[#1b1c1e]/15 focus-visible:border-[#1b1c1e]';
const btnSolid =
  'rounded-none border-0 bg-[#1b1c1e] text-[#f5f6f7] font-light hover:bg-[#3a3c40]';
const panelCls = 'border border-[#e3e4e8] bg-white';

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<MeResponse | null>(null);

  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);

  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [inquiryForm, setInquiryForm] = useState(EMPTY_INQUIRY);
  const [submitting, setSubmitting] = useState(false);
  const [inquiryMsg, setInquiryMsg] = useState<string | null>(null);

  const loadInquiries = useCallback(async () => {
    const res = await callAuthenticatedApi('/api/inquiries');
    if (!res) return;
    if (res.ok) {
      const data = (await res.json()) as { inquiries: Inquiry[] };
      setInquiries(data.inquiries);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await callAuthenticatedApi('/api/me');
      if (!active) return;
      if (!res || !res.ok) {
        router.replace('/login');
        return;
      }
      const data = (await res.json()) as MeResponse;
      if (!active) return;
      setMe(data);
      if (data.role === 'visitor' && data.visitor) {
        setProfile({
          name: data.visitor.name,
          company: data.visitor.company ?? '',
          phone: data.visitor.phone ?? '',
          interest: data.visitor.interest ?? '',
        });
        void loadInquiries();
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [router, loadInquiries]);

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
      if (!res) return;
      const data = (await res.json()) as { error?: string; visitor?: Visitor };
      if (!res.ok) {
        setProfileMsg(data.error ?? '保存失败');
        return;
      }
      setProfileMsg('已保存');
    } catch {
      setProfileMsg('网络异常，请稍后重试');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleCreateProfile = async () => {
    setInquiryMsg(null);
    if (!profile.name.trim()) {
      setInquiryMsg('请先填写称呼');
      return;
    }
    setSavingProfile(true);
    try {
      const res = await callAuthenticatedApi('/api/visitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profile.name,
          company: profile.company,
          phone: profile.phone,
          interest: profile.interest,
        }),
      });
      if (!res) return;
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setInquiryMsg(data.error ?? '创建档案失败');
        return;
      }
      window.location.reload();
    } catch {
      setInquiryMsg('网络异常，请稍后重试');
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
      if (!res) return;
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setInquiryMsg(data.error ?? '提交失败');
        return;
      }
      setInquiryForm(EMPTY_INQUIRY);
      setInquiryMsg('提交成功，团队会尽快跟进');
      await loadInquiries();
    } catch {
      setInquiryMsg('网络异常，请稍后重试');
    } finally {
      setSubmitting(false);
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
        {me?.role === 'internal' ? (
          <div className={`${panelCls} flex flex-col items-center gap-5 p-12 text-center`}>
            <p className="text-sm font-light text-[#55585e]">当前账号是工作室成员，请前往工作台管理访客与合作意向</p>
            <Button asChild className={btnSolid}>
              <Link href="/admin">进入工作台</Link>
            </Button>
          </div>
        ) : me?.role === 'visitor' ? (
          <Tabs defaultValue="inquiries" className="space-y-6">
            <TabsList className="rounded-none border border-[#e3e4e8] bg-white">
              <TabsTrigger
                value="inquiries"
                className="rounded-none text-xs font-light tracking-[0.15em] text-[#85888e] data-[state=active]:bg-[#1b1c1e] data-[state=active]:text-[#f5f6f7]"
              >
                合作意向
              </TabsTrigger>
              <TabsTrigger
                value="profile"
                className="rounded-none text-xs font-light tracking-[0.15em] text-[#85888e] data-[state=active]:bg-[#1b1c1e] data-[state=active]:text-[#f5f6f7]"
              >
                我的档案
              </TabsTrigger>
            </TabsList>

            <TabsContent value="inquiries" className="space-y-6">
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
                    {inquiryMsg && <p className="text-xs font-light text-[#c2410c]">{inquiryMsg}</p>}
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
                  <p className={`${panelCls} p-8 text-center text-xs font-light text-[#9b9ea4]`}>
                    暂无合作意向记录
                  </p>
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
            </TabsContent>

            <TabsContent value="profile">
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
                  {profileMsg && <p className="text-xs font-light text-[#c2410c]">{profileMsg}</p>}
                  <Button onClick={handleSaveProfile} disabled={savingProfile} className={btnSolid}>
                    {savingProfile ? '保存中…' : '保存档案'}
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <div className={panelCls}>
            <div className="border-b border-[#e3e4e8] px-7 py-5">
              <h2 className="text-sm font-light tracking-[0.2em] text-[#1b1c1e]">完善你的访客信息</h2>
              <p className="mt-1 text-xs font-light text-[#9b9ea4]">
                创建访客档案后，即可提交合作意向并跟进处理进度
              </p>
            </div>
            <div className="space-y-5 p-7">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="c-name" className="text-xs font-light tracking-[0.15em] text-[#85888e]">称呼 *</Label>
                  <Input id="c-name" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} className={fieldCls} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="c-company" className="text-xs font-light tracking-[0.15em] text-[#85888e]">公司 / 组织（选填）</Label>
                  <Input id="c-company" value={profile.company} onChange={(e) => setProfile({ ...profile, company: e.target.value })} className={fieldCls} />
                </div>
              </div>
              {inquiryMsg && <p className="text-xs font-light text-[#c2410c]">{inquiryMsg}</p>}
              <Button onClick={handleCreateProfile} disabled={savingProfile} className={btnSolid}>
                创建访客档案
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
