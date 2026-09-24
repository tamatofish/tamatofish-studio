'use client';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getSupabaseBrowserClientWithRetry } from '@/lib/supabase-browser';
import { callAuthenticatedApi } from '@/lib/auth-client';
import { MemberChat } from '@/components/member-chat';
import { getLeaderDepts } from '@/lib/dept-title';
import {
  INQUIRY_STATUS_MAP,
  INQUIRY_STATUS_OPTIONS,
  type Inquiry,
  type MeResponse,
  type Visitor,
  type GlobalNotice,
  type DepartmentNotice,
} from '@/lib/types';

const STATUS_CLASS_MAP: Record<string, string> = {
  pending: 'text-[#b45309] bg-[#fef3c7]',
  contacted: 'text-[#0e7490] bg-[#cffafe]',
  closed: 'text-[#85888e] bg-[#eef0f2]',
};
const fieldCls = 'rounded-none border-[#e3e4e8] bg-white text-[#1b1c1e] font-light placeholder:text-[#b9bcc2] focus-visible:ring-[#1b1c1e]/15 focus-visible:border-[#1b1c1e]';
const btnSolid = 'rounded-none border-0 bg-[#1b1c1e] text-[#f5f6f7] font-light hover:bg-[#3a3c40]';
const btnGhost = 'rounded-none border-[#d4d6da] bg-transparent text-xs font-light text-[#55585e] hover:border-[#1b1c1e] hover:bg-transparent hover:text-[#1b1c1e]';
const panelCls = 'border border-[#e3e4e8] bg-white';
const GLOBAL_READ_KEY = 'studio_read_global_notices';
const DEPT_READ_KEY = 'studio_read_dept_notices';

const FILE_MAX_SIZE = 10 * 1024 * 1024;
type FileStatus = 'pending' | 'approved' | 'rejected';
type FileLevel = 'public' | 'internal' | 'confidential' | 'secret';
type ActionLevel = 'public' | 'confidential' | 'secret';

interface FileRecord {
  id: string;
  name: string;
  displayName: string;
  code: string;
  size: number;
  mimeType: string;
  uploaderId?: string;
  uploaderName: string;
  uploadedAt: number;
  status: FileStatus;
  reviewedBy?: string;
  reviewedAt?: number;
  rejectReason?: string;
  level?: FileLevel;
  visibleTo?: string[];
}
interface AccessRequest {
  id: string;
  fileId: string;
  fileCode: string;
  fileName: string;
  requesterId: string;
  requesterName: string;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
  reviewedBy?: string;
  reviewedAt?: number;
}
interface ViewInvite {
  id: string;
  fileId: string;
  fileCode: string;
  fileName: string;
  inviteeId: string;
  inviteeName: string;
  inviteeEmail?: string;
  inviterName: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: number;
  respondedAt?: number;
}
interface ActionRecord {
  id: string;
  code: string;
  codename: string;
  actionTime: number;
  team: string;
  airSupport: boolean;
  infoSupport: boolean;
  description: string;
  level: ActionLevel;
  visibleTo: string[];
  creatorId: string;
  creatorName: string;
  createdAt: number;
}
interface ActionViewInvite {
  id: string;
  actionId: string;
  actionCode: string;
  actionCodename: string;
  inviteeId: string;
  inviteeName: string;
  inviterName: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: number;
  respondedAt?: number;
}
interface ActionAccessRequest {
  id: string;
  actionId: string;
  actionCode: string;
  actionCodename: string;
  requesterId: string;
  requesterName: string;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
  reviewedBy?: string;
  reviewedAt?: number;
}
function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
const FILE_STATUS_MAP: Record<FileStatus, { text: string; cls: string }> = {
  pending: { text: '待审核', cls: 'bg-[#f5f6f7] text-[#85888e]' },
  approved: { text: '已通过', cls: 'bg-[#e8f5e9] text-[#2e7d32]' },
  rejected: { text: '已拒绝', cls: 'bg-[#fdecea] text-[#c62828]' },
};
const FILE_LEVEL_MAP: Record<FileLevel, { text: string; cls: string }> = {
  public: { text: '公开', cls: 'bg-[#dcfce7] text-[#166534]' },
  internal: { text: '内部', cls: 'bg-[#eef0f2] text-[#55585e]' },
  confidential: { text: '机密', cls: 'bg-[#fef3c7] text-[#b45309]' },
  secret: { text: '绝密', cls: 'bg-[#fdecea] text-[#c62828]' },
};
const ACTION_LEVEL_MAP: Record<ActionLevel, { text: string; cls: string }> = {
  public: { text: '公开', cls: 'bg-[#dcfce7] text-[#166534]' },
  confidential: { text: '机密', cls: 'bg-[#fef3c7] text-[#b45309]' },
  secret: { text: '绝密', cls: 'bg-[#fdecea] text-[#c62828]' },
};

type FileFilter = 'all' | 'approved';

function loadLocalRead(key: string): string[] {
  if (typeof window === 'undefined') return [];
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
function saveLocalRead(key: string, ids: string[]) {
  try { localStorage.setItem(key, JSON.stringify(ids)); } catch {}
}

function matchFile(f: FileRecord, keyword: string): boolean {
  const kw = keyword.trim().toLowerCase();
  if (!kw) return true;
  const code = (f.code ?? '').toLowerCase();
  const name = (f.displayName ?? f.name ?? '').toLowerCase();
  return code.includes(kw) || name.includes(kw);
}

function canAccessFile(
  f: FileRecord,
  user: { userId: string; name: string; memberNo: string; email: string },
): boolean {
  if (f.status !== 'approved') return false;
  const lv = f.level ?? 'internal';
  const vt = f.visibleTo ?? [];

  if (lv === 'public') return true;

  if (lv === 'internal') {
    if (vt.length === 0) return true;
    return vt.includes(user.name) || vt.includes(user.memberNo) || vt.includes(user.email);
  }

  if (vt.length === 0) return false;
  return vt.includes(user.name) || vt.includes(user.memberNo) || vt.includes(user.email);
}

function hasFileAccess(
  f: FileRecord,
  user: { userId: string; name: string; memberNo: string; email: string },
  myInvites: ViewInvite[],
): boolean {
  if (canAccessFile(f, user)) return true;
  const acceptedInvite = myInvites.some(
    (inv) => inv.fileId === f.id && inv.status === 'accepted'
  );
  return acceptedInvite;
}

function hasActionAccess(
  a: ActionRecord,
  user: { userId: string; name: string; memberNo: string; email: string },
  myActionInvites: ActionViewInvite[],
): boolean {
  const vt = a.visibleTo ?? [];
  if (
    vt.includes(user.userId) ||
    vt.includes(user.name) ||
    vt.includes(user.memberNo) ||
    vt.includes(user.email)
  ) return true;
  return myActionInvites.some((inv) => inv.actionId === a.id && inv.status === 'accepted');
}

type SectionKey = 'overview' | 'notices' | 'inquiries' | 'files' | 'visitors' | 'actions';

const SECTIONS: { key: SectionKey; label: string; icon: React.ReactNode }[] = [
  { key: 'overview', label: '概览', icon: (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10.5 12 3l9 7.5" /><path d="M5 10v10h14V10" /><path d="M9.5 13.5c1 1 4 1 5 0" /></svg>) },
  { key: 'notices', label: '通知', icon: (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" /><path d="M10 18a2 2 0 0 0 4 0" /></svg>) },
  { key: 'inquiries', label: '意向', icon: (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a8 8 0 1 1-3.3-6.4" /><path d="M22 4l-10 10-3-3" /></svg>) },
  { key: 'files', label: '文件', icon: (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5a2 2 0 0 1 2-2h6l2 2h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" /></svg>) },
  { key: 'visitors', label: '访客', icon: (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3" /><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" /></svg>) },
  { key: 'actions', label: '行动', icon: (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3" /></svg>) },
];

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [visitorMap, setVisitorMap] = useState<Record<string, Visitor>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [pwOpen, setPwOpen] = useState(false);
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [newGlobalNotice, setNewGlobalNotice] = useState('');
  const [submittingGlobalNotice, setSubmittingGlobalNotice] = useState(false);
  const [newDeptNotice, setNewDeptNotice] = useState('');
  const [submittingDeptNotice, setSubmittingDeptNotice] = useState(false);
  const [selectedDeptForNotice, setSelectedDeptForNotice] = useState<string>('');
  const [globalNotices, setGlobalNotices] = useState<GlobalNotice[]>([]);
  const [readGlobalIds, setReadGlobalIds] = useState<string[]>([]);
  const [globalDetail, setGlobalDetail] = useState<Record<string, any[]>>({});
  const [allDeptNotices, setAllDeptNotices] = useState<DepartmentNotice[]>([]);
  const [readDeptIds, setReadDeptIds] = useState<string[]>([]);
  const [deptDetail, setDeptDetail] = useState<Record<string, any[]>>({});
  const [expandedGlobalIds, setExpandedGlobalIds] = useState<string[]>([]);
  const [expandedDeptIds, setExpandedDeptIds] = useState<string[]>([]);
  const [dismissedGlobalIds, setDismissedGlobalIds] = useState<string[]>([]);
  const [dismissedDeptIds, setDismissedDeptIds] = useState<string[]>([]);
  const [animatingId, setAnimatingId] = useState<string | null>(null);
  const [appCollapsed, setAppCollapsed] = useState(true);
  const [historyCollapsed, setHistoryCollapsed] = useState(true);

  const [fileList, setFileList] = useState<FileRecord[]>([]);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileUploading, setFileUploading] = useState(false);
  const [fileMsg, setFileMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [fileFilter, setFileFilter] = useState<FileFilter>('all');
  const [pendingSearch, setPendingSearch] = useState('');
  const [visibleSearch, setVisibleSearch] = useState('');

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDisplayName, setUploadDisplayName] = useState('');
  const [uploadLevel, setUploadLevel] = useState<FileLevel>('internal');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [accessOpen, setAccessOpen] = useState(false);
  const [accessCode, setAccessCode] = useState('');
  const [accessFound, setAccessFound] = useState<FileRecord | null>(null);
  const [accessReason, setAccessReason] = useState('');
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessMsg, setAccessMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [myRequests, setMyRequests] = useState<AccessRequest[]>([]);
  const [myRequestsExpanded, setMyRequestsExpanded] = useState(false);

  const [myInvites, setMyInvites] = useState<ViewInvite[]>([]);
  const [inviteHandling, setInviteHandling] = useState<string | null>(null);

  /* ===== 行动 ===== */
  const [actionList, setActionList] = useState<ActionRecord[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionSaving, setActionSaving] = useState(false);
  const [aCodename, setACodename] = useState('');
  const [aTime, setATime] = useState('');
  const [aTeam, setATeam] = useState('');
  const [aAirSupport, setAAirSupport] = useState(false);
  const [aInfoSupport, setAInfoSupport] = useState(false);
  const [aDesc, setADesc] = useState('');
  const [aMsg, setAMsg] = useState<string | null>(null);

  /* ===== 行动邀请 ===== */
  const [myActionInvites, setMyActionInvites] = useState<ActionViewInvite[]>([]);
  const [actionInviteHandling, setActionInviteHandling] = useState<string | null>(null);

  /* ===== 行动档案权限申请 ===== */
  const [myActionRequests, setMyActionRequests] = useState<ActionAccessRequest[]>([]);
  const [actionAccessOpen, setActionAccessOpen] = useState(false);
  const [actionAccessCode, setActionAccessCode] = useState('');
  const [actionAccessFound, setActionAccessFound] = useState<ActionRecord | null>(null);
  const [actionAccessReason, setActionAccessReason] = useState('');
  const [actionAccessLoading, setActionAccessLoading] = useState(false);
  const [actionAccessMsg, setActionAccessMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [myActionRequestsExpanded, setMyActionRequestsExpanded] = useState(false);

  /* ===== 行动档案展开 ===== */
  const [expandedActionId, setExpandedActionId] = useState<string | null>(null);

  const [activeSection, setActiveSection] = useState<SectionKey>('overview');

  const mergedReadGlobalIds = useMemo(() => {
    const local = loadLocalRead(GLOBAL_READ_KEY);
    return Array.from(new Set([...readGlobalIds, ...local]));
  }, [readGlobalIds]);
  const mergedReadDeptIds = useMemo(() => {
    const local = loadLocalRead(DEPT_READ_KEY);
    return Array.from(new Set([...readDeptIds, ...local]));
  }, [readDeptIds]);

  const leaderDepts = useMemo(() => {
    if (!me?.member) return [];
    return getLeaderDepts(me.member.department, me.member.title);
  }, [me]);
  const isLeader = leaderDepts.length > 0;

  const isDefenseMember = useMemo(() => {
    const depts = (me?.member?.department ?? '')
      .split(/[,，;；]/)
      .map((s) => s.trim())
      .filter(Boolean);
    return depts.includes('综合防务部');
  }, [me]);

  const isAdmin = me?.member?.role === 'admin';

  const loadGlobalNotices = async () => {
    try {
      const res = await callAuthenticatedApi('/api/global-notice');
      if (res && res.ok) {
        const data = await res.json();
        setGlobalNotices(data.notices ?? []);
        setReadGlobalIds(data.readIds ?? []);
        setGlobalDetail(data.detail ?? {});
      }
    } catch (e) { console.error('加载全局通知失败', e); }
  };
  const loadDeptNotices = async () => {
    try {
      const res = await callAuthenticatedApi('/api/department-notice');
      if (res && res.ok) {
        const data = await res.json();
        setAllDeptNotices(data.notices ?? []);
        setReadDeptIds(data.readIds ?? []);
        setDeptDetail(data.detail ?? {});
      }
    } catch (e) { console.error('加载部门通知失败', e); }
  };
  const markGlobalRead = (noticeId: string) => {
    if (mergedReadGlobalIds.includes(noticeId)) return;
    const next = [...mergedReadGlobalIds, noticeId];
    setReadGlobalIds(next);
    saveLocalRead(GLOBAL_READ_KEY, next);
    callAuthenticatedApi('/api/global-notice', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notice_id: noticeId }),
    }).catch((e) => console.error('全局通知标记已读异常:', e));
  };
  const markDeptRead = (noticeId: string) => {
    if (mergedReadDeptIds.includes(noticeId)) return;
    const next = [...mergedReadDeptIds, noticeId];
    setReadDeptIds(next);
    saveLocalRead(DEPT_READ_KEY, next);
    callAuthenticatedApi('/api/department-notice', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notice_id: noticeId }),
    }).catch((e) => console.error('部门通知标记已读异常:', e));
  };
  const handleNoticeClick = (noticeId: string, type: 'global' | 'dept') => {
    if (animatingId) return;
    setAnimatingId(noticeId);
    setTimeout(() => {
      if (type === 'global') { markGlobalRead(noticeId); setDismissedGlobalIds((prev) => [...prev, noticeId]); }
      else { markDeptRead(noticeId); setDismissedDeptIds((prev) => [...prev, noticeId]); }
      setAnimatingId(null);
    }, 500);
  };
  const toggleExpand = (id: string, type: 'global' | 'dept') => {
    if (type === 'global') setExpandedGlobalIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
    else setExpandedDeptIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const loadFiles = useCallback(async () => {
    setFileLoading(true);
    try {
      const res = await callAuthenticatedApi('/api/files');
      if (res?.ok) {
        const data = await res.json();
        setFileList(data.files ?? []);
      } else {
        const d = await res?.json().catch(() => ({}));
        setFileMsg({ type: 'err', text: d.error || '加载文件失败' });
      }
    } catch (e) {
      console.error('加载文件失败', e);
    } finally {
      setFileLoading(false);
    }
  }, []);

  const loadMyRequests = useCallback(async () => {
    try {
      const res = await callAuthenticatedApi('/api/files/access-request');
      if (res?.ok) {
        const data = await res.json();
        setMyRequests(data.requests ?? []);
      }
    } catch { /* ignore */ }
  }, []);

  const loadMyInvites = useCallback(async () => {
    try {
      const res = await callAuthenticatedApi('/api/files/invite');
      if (res?.ok) {
        const data = await res.json();
        setMyInvites(data.invites ?? []);
      }
    } catch { /* ignore */ }
  }, []);

  const loadMyActionInvites = useCallback(async () => {
    try {
      const res = await callAuthenticatedApi('/api/actions/invite');
      if (res?.ok) {
        const data = await res.json();
        setMyActionInvites(data.invites ?? []);
      }
    } catch { /* ignore */ }
  }, []);

  const loadMyActionRequests = useCallback(async () => {
    try {
      const res = await callAuthenticatedApi('/api/actions/access-request');
      if (res?.ok) {
        const data = await res.json();
        setMyActionRequests(data.requests ?? []);
      }
    } catch { /* ignore */ }
  }, []);

  const loadActions = useCallback(async () => {
    if (!isDefenseMember && !isAdmin) return;
    setActionLoading(true);
    try {
      const res = await callAuthenticatedApi('/api/actions');
      if (res?.ok) {
        const data = await res.json();
        setActionList(data.actions ?? []);
      }
    } catch (e) {
      console.error('加载行动档案失败', e);
    } finally {
      setActionLoading(false);
    }
  }, [isDefenseMember, isAdmin]);

  const openUploadDialog = () => {
    setUploadFile(null);
    setUploadDisplayName('');
    setUploadLevel('internal');
    setFileMsg(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    fileInputRef.current?.click();
  };

  const handleFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > FILE_MAX_SIZE) {
      setFileMsg({ type: 'err', text: '文件不能超过 10MB' });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setUploadFile(file);
    const baseName = file.name.replace(/\.[^.]+$/, '');
    setUploadDisplayName(baseName);
    setUploadLevel('internal');
    setUploadOpen(true);
  };

  const confirmUpload = async () => {
    if (!uploadFile) return;
    const name = uploadDisplayName.trim();
    if (!name) { setFileMsg({ type: 'err', text: '请填写文件名' }); return; }

    setFileUploading(true);
    setFileMsg(null);
    const fd = new FormData();
    fd.append('file', uploadFile);
    fd.append('displayName', name);
    fd.append('level', uploadLevel);

    try {
      const res = await callAuthenticatedApi('/api/files', { method: 'POST', body: fd });
      if (!res || !res.ok) {
        const d = await res?.json().catch(() => ({}));
        throw new Error(d.error || '上传失败');
      }
      const data = await res.json();
      setFileMsg({ type: 'ok', text: `上传成功，编号 ${data.file?.code ?? ''}，等待管理员审核` });
      setUploadOpen(false);
      setUploadFile(null);
      setUploadDisplayName('');
      setUploadLevel('internal');
      if (fileInputRef.current) fileInputRef.current.value = '';
      loadFiles();
    } catch (err) {
      setFileMsg({ type: 'err', text: err instanceof Error ? err.message : '上传失败' });
    } finally {
      setFileUploading(false);
    }
  };

  const handleFileDelete = async (id: string, label = '该文件') => {
    if (!window.confirm(`确定删除${label}？`)) return;
    try {
      const res = await callAuthenticatedApi(`/api/files?id=${id}`, { method: 'DELETE' });
      if (!res || !res.ok) {
        const d = await res?.json().catch(() => ({}));
        throw new Error(d.error || '删除失败');
      }
      setFileMsg({ type: 'ok', text: '已删除' });
      loadFiles();
    } catch (err) {
      setFileMsg({ type: 'err', text: err instanceof Error ? err.message : '删除失败' });
    }
  };

  const handleDownload = async (f: FileRecord) => {
    try {
      const res = await callAuthenticatedApi(`/api/files/download?id=${f.id}`);
      if (!res || !res.ok) {
        const d = await res?.json().catch(() => ({}));
        throw new Error(d.error || '下载失败');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = f.name.includes('.') ? f.name.slice(f.name.lastIndexOf('.')) : '';
      a.download = (f.displayName || f.name) + (f.displayName?.includes('.') ? '' : ext);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setFileMsg({ type: 'err', text: err instanceof Error ? err.message : '下载失败' });
    }
  };

  const openAccessDialog = () => {
    setAccessCode('');
    setAccessFound(null);
    setAccessReason('');
    setAccessMsg(null);
    setAccessOpen(true);
    loadMyRequests();
  };

  const findFileByCode = () => {
    const code = accessCode.trim().toUpperCase();
    setAccessMsg(null);
    setAccessFound(null);
    if (!code) { setAccessMsg({ type: 'err', text: '请输入文件编号' }); return; }
    const found = fileList.find((f) => (f.code ?? '').toUpperCase() === code);
    if (!found) { setAccessMsg({ type: 'err', text: '未找到该编号对应的文件' }); return; }
    if (found.status !== 'approved') { setAccessMsg({ type: 'err', text: '该文件尚未通过审核' }); return; }

    const user = {
      userId: me?.member?.user_id ?? '',
      name: me?.member?.name ?? '',
      memberNo: me?.member?.member_no ?? '',
      email: me?.email ?? '',
    };
    if (hasFileAccess(found, user, myInvites)) {
      setAccessMsg({ type: 'ok', text: '你已拥有该文件的访问权限，无需再次申请' });
      setAccessFound(found);
      return;
    }

    setAccessFound(found);
  };

  const submitAccessRequest = async () => {
    if (!accessFound) return;

    const user = {
      userId: me?.member?.user_id ?? '',
      name: me?.member?.name ?? '',
      memberNo: me?.member?.member_no ?? '',
      email: me?.email ?? '',
    };
    if (hasFileAccess(accessFound, user, myInvites)) {
      setAccessMsg({ type: 'err', text: '你已拥有该文件的访问权限，无需再次申请' });
      return;
    }
    const existing = myRequests.find(
      (r) => r.fileId === accessFound.id && (r.status === 'pending' || r.status === 'approved')
    );
    if (existing) {
      setAccessMsg({
        type: 'err',
        text: existing.status === 'pending' ? '你已提交过申请，请等待处理' : '申请已通过，无需重复申请',
      });
      return;
    }

    setAccessLoading(true);
    setAccessMsg(null);
    try {
      const res = await callAuthenticatedApi('/api/files/access-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: accessFound.code, reason: accessReason.trim() || undefined }),
      });
      if (!res || !res.ok) {
        const d = await res?.json().catch(() => ({}));
        throw new Error(d.error || '申请失败');
      }
      setAccessMsg({ type: 'ok', text: '申请已提交，等待管理员处理' });
      setAccessReason('');
      loadMyRequests();
    } catch (err) {
      setAccessMsg({ type: 'err', text: err instanceof Error ? err.message : '申请失败' });
    } finally {
      setAccessLoading(false);
    }
  };

  const handleInviteResponse = async (id: string, action: 'accept' | 'decline') => {
    setInviteHandling(id);
    try {
      const res = await callAuthenticatedApi('/api/files/invite', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      if (!res || !res.ok) {
        const d = await res?.json().catch(() => ({}));
        throw new Error(d.error || '操作失败');
      }
      await loadMyInvites();
      await loadFiles();
      alert(action === 'accept' ? '已接受邀请，文件已加入你的可访问列表' : '已拒绝邀请');
    } catch (err) {
      alert(err instanceof Error ? err.message : '操作失败');
    } finally {
      setInviteHandling(null);
    }
  };

  const handleActionInviteResponse = async (id: string, action: 'accept' | 'decline') => {
    setActionInviteHandling(id);
    try {
      const res = await callAuthenticatedApi('/api/actions/invite', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      if (!res || !res.ok) {
        const d = await res?.json().catch(() => ({}));
        throw new Error(d.error || '操作失败');
      }
      await loadMyActionInvites();
      await loadActions();
      alert(action === 'accept' ? '已接受邀请，档案已加入你的列表' : '已拒绝邀请');
    } catch (err) {
      alert(err instanceof Error ? err.message : '操作失败');
    } finally {
      setActionInviteHandling(null);
    }
  };

  const openActionAccessDialog = () => {
    setActionAccessCode('');
    setActionAccessFound(null);
    setActionAccessReason('');
    setActionAccessMsg(null);
    setActionAccessOpen(true);
    loadMyActionRequests();
  };

  const findActionByCode = () => {
    const code = actionAccessCode.trim().toUpperCase();
    setActionAccessMsg(null);
    setActionAccessFound(null);
    if (!code) { setActionAccessMsg({ type: 'err', text: '请输入档案编号' }); return; }

    const found = actionList.find((a) => (a.code ?? '').toUpperCase() === code);
    if (!found) {
      setActionAccessMsg({
        type: 'err',
        text: '未在当前可见列表中，可直接提交申请，管理员审核后即可查看',
      });
      setActionAccessFound({
        id: '',
        code,
        codename: code,
        actionTime: 0,
        team: '',
        airSupport: false,
        infoSupport: false,
        description: '',
        level: 'secret',
        visibleTo: [],
        creatorId: '',
        creatorName: '',
        createdAt: 0,
      });
      return;
    }

    const user = {
      userId: me?.member?.user_id ?? '',
      name: me?.member?.name ?? '',
      memberNo: me?.member?.member_no ?? '',
      email: me?.email ?? '',
    };
    if (hasActionAccess(found, user, myActionInvites)) {
      setActionAccessMsg({ type: 'ok', text: '你已拥有该档案的查看权限，无需再次申请' });
      setActionAccessFound(found);
      return;
    }
    setActionAccessFound(found);
  };

  const submitActionAccessRequest = async () => {
    if (!actionAccessFound) return;

    const user = {
      userId: me?.member?.user_id ?? '',
      name: me?.member?.name ?? '',
      memberNo: me?.member?.member_no ?? '',
      email: me?.email ?? '',
    };
    if (actionAccessFound.id && hasActionAccess(actionAccessFound, user, myActionInvites)) {
      setActionAccessMsg({ type: 'err', text: '你已拥有该档案的查看权限，无需再次申请' });
      return;
    }

    const existing = myActionRequests.find(
      (r) => r.actionId === actionAccessFound.id && (r.status === 'pending' || r.status === 'approved')
    );
    if (existing) {
      setActionAccessMsg({
        type: 'err',
        text: existing.status === 'pending' ? '你已提交过申请，请等待管理员处理' : '申请已通过，无需重复申请',
      });
      return;
    }

    setActionAccessLoading(true);
    setActionAccessMsg(null);
    try {
      const res = await callAuthenticatedApi('/api/actions/access-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: actionAccessFound.code,
          reason: actionAccessReason.trim() || undefined,
        }),
      });
      if (!res || !res.ok) {
        const d = await res?.json().catch(() => ({}));
        throw new Error(d.error || '申请失败');
      }
      setActionAccessMsg({ type: 'ok', text: '申请已提交，等待管理员处理' });
      setActionAccessReason('');
      loadMyActionRequests();
    } catch (err) {
      setActionAccessMsg({ type: 'err', text: err instanceof Error ? err.message : '申请失败' });
    } finally {
      setActionAccessLoading(false);
    }
  };

  const myActionRequestForFound = useMemo(() => {
    if (!actionAccessFound) return null;
    return myActionRequests.find((r) => r.actionId === actionAccessFound.id) ?? null;
  }, [actionAccessFound, myActionRequests]);

  const openActionDialog = () => {
    setACodename('');
    setATime(new Date().toISOString().slice(0, 16));
    setATeam('');
    setAAirSupport(false);
    setAInfoSupport(false);
    setADesc('');
    setAMsg(null);
    setActionDialogOpen(true);
  };

  const handleSaveAction = async () => {
    if (!aCodename.trim()) { setAMsg('请填写行动代号'); return; }
    if (!aTeam.trim()) { setAMsg('请填写小组'); return; }
    if (!/^[A-Z]+$/.test(aTeam.trim())) { setAMsg('小组只能输入大写英文字母'); return; }

    setActionSaving(true);
    setAMsg(null);
    try {
      const actionTime = aTime ? new Date(aTime).getTime() : Date.now();
      const res = await callAuthenticatedApi('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codename: aCodename.trim(),
          actionTime,
          team: aTeam.trim(),
          airSupport: aAirSupport,
          infoSupport: aInfoSupport,
          description: aDesc.trim(),
        }),
      });
      if (!res || !res.ok) {
        const d = await res?.json().catch(() => ({}));
        throw new Error(d.error || '保存失败');
      }
      setActionDialogOpen(false);
      alert('档案已提交，等待管理员审核');
      await loadActions();
    } catch (err) {
      setAMsg(err instanceof Error ? err.message : '保存失败');
    } finally {
      setActionSaving(false);
    }
  };

  const myRequestForFound = useMemo(() => {
    if (!accessFound) return null;
    return myRequests.find((r) => r.fileId === accessFound.id) ?? null;
  }, [accessFound, myRequests]);

  const myName = me?.member?.name ?? '';
  const myMemberNo = me?.member?.member_no ?? '';
  const myUserId = me?.member?.user_id ?? '';
  const myEmail = me?.email ?? '';

  const pendingMine = useMemo(() => {
    const base = fileList.filter((f) => f.status === 'pending' && f.uploaderId === myUserId);
    return base.filter((f) => matchFile(f, pendingSearch));
  }, [fileList, myUserId, pendingSearch]);

  const visibleFiles = useMemo(() => {
    const user = { userId: myUserId, name: myName, memberNo: myMemberNo, email: myEmail };
    const base = fileList.filter((f) => canAccessFile(f, user));
    const filtered = fileFilter === 'all' ? base : base.filter((f) => f.status === fileFilter);
    return filtered.filter((f) => matchFile(f, visibleSearch));
  }, [fileList, fileFilter, myUserId, myName, myMemberNo, myEmail, visibleSearch]);

  const loadAll = useCallback(async () => {
    const [vRes, iRes] = await Promise.all([
      callAuthenticatedApi('/api/visitors'),
      callAuthenticatedApi('/api/inquiries'),
    ]);
    if (vRes?.ok) {
      const vData = await vRes.json();
      setVisitors(vData.visitors ?? []);
      setVisitorMap(Object.fromEntries((vData.visitors ?? []).map((v: any) => [v.id, v])));
    }
    if (iRes?.ok) {
      const iData = await iRes.json();
      setInquiries(iData.inquiries ?? []);
    }
    await loadGlobalNotices();
    await loadDeptNotices();
    await loadFiles();
    await loadMyRequests();
    await loadMyInvites();
    await loadMyActionInvites();
    await loadMyActionRequests();
    await loadActions();
  }, [loadFiles, loadMyRequests, loadMyInvites, loadMyActionInvites, loadMyActionRequests, loadActions]);

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await callAuthenticatedApi('/api/me');
      if (!active) return;
      if (!res || !res.ok) { router.replace('/login'); return; }
      const data = await res.json();
      if (!active) return;
      setMe(data);
      if (data.role !== 'internal') { setLoading(false); return; }
      await loadAll();
      if (active) {
        setLoading(false);
        const ld = getLeaderDepts(data.member?.department, data.member?.title);
        if (ld.length > 0) setSelectedDeptForNotice(ld[0]);
      }
    })();
    return () => { active = false; };
  }, [router, loadAll]);

  useEffect(() => {
    if (isDefenseMember || isAdmin) loadActions();
  }, [isDefenseMember, isAdmin, loadActions]);

  useEffect(() => {
    if (activeSection === 'actions' && !isDefenseMember && !isAdmin) {
      setActiveSection('overview');
    }
  }, [activeSection, isDefenseMember, isAdmin]);

  const stats = useMemo(() => ({
    visitorCount: visitors.length,
    inquiryCount: inquiries.length,
    pendingCount: inquiries.filter((q) => q.status === 'pending').length,
    fileCount: visibleFiles.length,
  }), [visitors, inquiries, visibleFiles]);

  const myUserIdForNotice = me?.member?.user_id;

  const approvedDeptNotices = allDeptNotices.filter((n) => n.status === 'approved');
  const myDeptApplications = useMemo(() => {
    if (!myUserIdForNotice) return [];
    return allDeptNotices.filter((n) => (n as any).submitter_user_id === myUserIdForNotice);
  }, [allDeptNotices, myUserIdForNotice]);
  const applicationList = isAdmin ? allDeptNotices : myDeptApplications;
  const sortedApplications = useMemo(() =>
    [...applicationList].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [applicationList]
  );
  const historyItems = useMemo(() => {
    const items: { type: 'global' | 'dept'; notice: GlobalNotice | DepartmentNotice }[] = [
      ...globalNotices.map((n) => ({ type: 'global' as const, notice: n })),
      ...approvedDeptNotices.map((n) => ({ type: 'dept' as const, notice: n })),
    ];
    return items.sort((a, b) => new Date(b.notice.created_at).getTime() - new Date(a.notice.created_at).getTime());
  }, [globalNotices, approvedDeptNotices]);

  const visibleGlobalNotices = globalNotices.filter((n) => !dismissedGlobalIds.includes(n.id) && !mergedReadGlobalIds.includes(n.id));
  const visibleDeptNotices = approvedDeptNotices.filter((n) => !dismissedDeptIds.includes(n.id) && !mergedReadDeptIds.includes(n.id));
  const hasAnyVisibleNotice = visibleGlobalNotices.length > 0 || visibleDeptNotices.length > 0;

  const handleStatusChange = async (inquiryId: string, status: string) => {
    setUpdatingId(inquiryId);
    try {
      const res = await callAuthenticatedApi('/api/inquiries', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: inquiryId, status }) });
      if (res?.ok) setInquiries((prev) => prev.map((q) => (q.id === inquiryId ? { ...q, status } : q)));
    } finally { setUpdatingId(null); }
  };

  const submitGlobalNotice = async () => {
    if (!newGlobalNotice.trim() || submittingGlobalNotice) return;
    setSubmittingGlobalNotice(true);
    try {
      const res = await callAuthenticatedApi('/api/global-notice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: newGlobalNotice.trim() }) });
      if (!res?.ok) { const json = await res?.json().catch(() => ({})); alert(json.error || '发布失败'); return; }
      const data = await res.json();
      setGlobalNotices((prev) => [data.notice, ...prev]);
      setNewGlobalNotice(''); alert('全局通知已发布');
    } catch { alert('网络异常'); }
    finally { setSubmittingGlobalNotice(false); }
  };

  const submitDeptNotice = async () => {
    if (!newDeptNotice.trim() || submittingDeptNotice) return;
    if (leaderDepts.length === 0) { alert('仅负责人可提交部门通知'); return; }
    const dept = leaderDepts.length === 1 ? leaderDepts[0] : selectedDeptForNotice;
    if (!dept) { alert('请选择发布部门'); return; }
    setSubmittingDeptNotice(true);
    try {
      const res = await callAuthenticatedApi('/api/department-notice', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newDeptNotice.trim(), department: dept }),
      });
      if (!res?.ok) { const json = await res?.json().catch(() => ({})); alert(json.error || '提交失败'); return; }
      const data = await res.json();
      setAllDeptNotices((prev) => [data.notice, ...prev]);
      setNewDeptNotice(''); alert(`已提交到「${dept}」，等待管理员审核`);
    } catch { alert('网络异常'); }
    finally { setSubmittingDeptNotice(false); }
  };

  const handleApproveDeptNotice = async (id: string, status: 'approved' | 'rejected') => {
    try {
      const res = await callAuthenticatedApi('/api/department-notice', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) });
      if (!res?.ok) { const json = await res?.json().catch(() => ({})); alert(json.error || '操作失败'); return; }
      setAllDeptNotices((prev) => prev.map((n) => n.id === id ? { ...n, status } as DepartmentNotice : n));
      alert(status === 'approved' ? '已通过' : '已拒绝');
    } catch { alert('网络异常'); }
  };

  const handlePasswordChange = async () => {
    setPwMsg(null);
    if (pwNew.length < 6) { setPwMsg('新密码至少 6 位'); return; }
    if (pwNew !== pwConfirm) { setPwMsg('两次输入不一致'); return; }
    setPwSaving(true);
    try {
      const supabase = await getSupabaseBrowserClientWithRetry();
      const { error } = await supabase.auth.updateUser({ password: pwNew });
      if (error) { setPwMsg(`修改失败：${error.message}`); return; }
      setPwMsg(null); setPwNew(''); setPwConfirm(''); setPwOpen(false);
    } catch { setPwMsg('网络异常'); }
    finally { setPwSaving(false); }
  };
  const handleLogout = async () => {
    if (!window.confirm('确定退出登录吗？')) return;
    const supabase = await getSupabaseBrowserClientWithRetry();
    await supabase.auth.signOut();
    router.replace('/login');
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[#f2f3f5] text-sm font-light text-[#9b9ea4]">加载中…</div>;
  if (me?.role !== 'internal') return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-[#f2f3f5] px-6 text-center">
      <p className="text-sm font-light text-[#55585e]">此页面仅对工作室内部人员开放</p>
      <Button asChild className={btnSolid}><a href="/">返回官网首页</a></Button>
    </div>
  );
  const myMember = me.member;

  const ReadDetailList = ({ detail, noticeId }: { detail: Record<string, any[]>; noticeId: string }) => {
    const list = detail[noticeId] ?? [];
    const readCount = list.filter((m) => m.is_read).length;
    return (
      <div className="mt-2 border-t border-[#f0f1f3] pt-3">
        <p className="mb-2 text-[10px] font-light text-[#9b9ea4]">已读 {readCount}/{list.length}</p>
        <div className="grid gap-1 sm:grid-cols-2">
          {list.map((m) => (
            <div key={m.member_id} className="flex items-center justify-between py-0.5">
              <span className="text-[11px] font-light text-[#55585e]">{m.name}（{m.member_no || '—'} {m.department || '—'}）</span>
              <span className={`text-[10px] font-light ${m.is_read ? 'text-[#16a34a]' : 'text-[#9b9ea4]'}`}>{m.is_read ? '已读' : '未读'}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderLevelBadge = (level: FileLevel | undefined) => {
    const lv: FileLevel = level ?? 'internal';
    const info = FILE_LEVEL_MAP[lv];
    return (
      <Badge variant="outline" className={`rounded-none border-0 font-light ${info.cls}`}>
        {info.text}
      </Badge>
    );
  };

  const renderActionLevelBadge = (level: ActionLevel | undefined) => {
    const lv: ActionLevel = level ?? 'secret';
    const info = ACTION_LEVEL_MAP[lv];
    return (
      <Badge variant="outline" className={`rounded-none border-0 font-light ${info.cls}`}>
        {info.text}
      </Badge>
    );
  };

  const renderOverview = () => (
    <div className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: '可访问文件', value: stats.fileCount },
          { label: '注册访客', value: stats.visitorCount },
          { label: '合作意向总数', value: stats.inquiryCount },
          { label: '待处理意向', value: stats.pendingCount },
        ].map((s) => (
          <div key={s.label} className={`${panelCls} p-6`}>
            <p className="text-xs font-light tracking-[0.15em] text-[#9b9ea4]">{s.label}</p>
            <p className="mt-2 text-3xl font-light tracking-wider text-[#1b1c1e]">{s.value}</p>
          </div>
        ))}
      </div>

      <section className={`${panelCls} p-6`}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-light tracking-[0.25em] text-[#1b1c1e]">基础信息</h2>
          <div className="flex items-center gap-2">
            {isAdmin && <Badge variant="outline" className="rounded-none border-0 bg-[#1b1c1e] px-2 py-0.5 text-[10px] font-light tracking-wider text-white">管理员</Badge>}
            {isLeader && <Badge variant="outline" className="rounded-none border-0 bg-[#e8704a] px-2 py-0.5 text-[10px] font-light tracking-wider text-white">负责人</Badge>}
          </div>
        </div>
        <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div><p className="text-[11px] font-light tracking-[0.15em] text-[#9b9ea4]">工号</p><p className="mt-1.5 text-sm font-light tracking-wider text-[#1b1c1e]">{myMember?.member_no || '—'}</p></div>
          <div><p className="text-[11px] font-light tracking-[0.15em] text-[#9b9ea4]">姓名</p><p className="mt-1.5 text-sm font-light tracking-wider text-[#1b1c1e]">{myMember?.name || '—'}</p></div>
          <div><p className="text-[11px] font-light tracking-[0.15em] text-[#9b9ea4]">部门</p><p className="mt-1.5 text-sm font-light tracking-wider text-[#1b1c1e]">{myMember?.department || '—'}</p></div>
          <div><p className="text-[11px] font-light tracking-[0.15em] text-[#9b9ea4]">职位</p><p className="mt-1.5 text-sm font-light tracking-wider text-[#1b1c1e]">{myMember?.title || '—'}</p></div>
        </div>
      </section>

      <MemberChat me={me} />
    </div>
  );

  const renderNotices = () => (
    <div className="space-y-6">
      {hasAnyVisibleNotice && (
        <section className="space-y-3">
          {visibleGlobalNotices.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-light tracking-[0.15em] text-[#85888e]">全局通知</p>
              {visibleGlobalNotices.map((notice) => {
                const isAnimating = animatingId === notice.id;
                return (
                  <div key={notice.id} onClick={() => handleNoticeClick(notice.id, 'global')}
                    className={`cursor-pointer overflow-hidden rounded border p-3 transition-all duration-500 ease-out ${isAnimating ? 'border-[#86efac] bg-[#dcfce7] -translate-x-[120%] opacity-0' : 'border-[#fcd34d] bg-[#fffbeb]'}`}>
                    <p className="text-xs font-light leading-5 text-[#92400e]"><span className="mr-1 font-medium">【未读】</span>{notice.content}</p>
                    <p className="mt-1 text-[10px] text-[#b45309]">{new Date(notice.created_at).toLocaleString('zh-CN')}</p>
                  </div>
                );
              })}
            </div>
          )}
          {visibleDeptNotices.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-light tracking-[0.15em] text-[#85888e]">部门通知</p>
              {visibleDeptNotices.map((notice) => {
                const isAnimating = animatingId === notice.id;
                return (
                  <div key={notice.id} onClick={() => handleNoticeClick(notice.id, 'dept')}
                    className={`cursor-pointer overflow-hidden rounded border p-3 transition-all duration-500 ease-out ${isAnimating ? 'border-[#86efac] bg-[#dcfce7] -translate-x-[120%] opacity-0' : 'border-[#7dd3fc] bg-[#f0f9ff]'}`}>
                    <p className="text-xs font-light leading-5 text-[#0c4a6e]"><span className="mr-1 font-medium">【未读】</span>{notice.content}</p>
                    <p className="mt-1 text-[10px] text-[#0369a1]">部门：{notice.department} · {new Date(notice.created_at).toLocaleString('zh-CN')}</p>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-sm font-light tracking-[0.25em] text-[#1b1c1e]">通知中心</h2>
        {isAdmin && (
          <div className={`${panelCls} space-y-3 p-5`}>
            <p className="text-xs font-light tracking-[0.15em] text-[#85888e]">发布全局通知</p>
            <div className="flex gap-2">
              <Input value={newGlobalNotice} onChange={(e) => setNewGlobalNotice(e.target.value)} placeholder="输入通知内容，回车发布" onKeyDown={(e) => { if (e.key === 'Enter') submitGlobalNotice(); }} className={fieldCls} />
              <Button onClick={submitGlobalNotice} disabled={submittingGlobalNotice} className={`${btnSolid} shrink-0`}>{submittingGlobalNotice ? '发布中…' : '发布'}</Button>
            </div>
          </div>
        )}
        {isLeader && (
          <div className={`${panelCls} space-y-3 p-5`}>
            <p className="text-xs font-light tracking-[0.15em] text-[#85888e]">提交部门通知申请（管理员审核通过后自动发布）</p>
            <div className="flex flex-wrap items-center gap-2">
              {leaderDepts.length > 1 ? (
                <Select value={selectedDeptForNotice} onValueChange={setSelectedDeptForNotice}>
                  <SelectTrigger className="w-[160px] rounded-none border-[#e3e4e8] bg-white text-xs font-light text-[#1b1c1e]">
                    <SelectValue placeholder="选择部门" />
                  </SelectTrigger>
                  <SelectContent className="rounded-none border-[#e3e4e8] bg-white text-xs font-light">
                    {leaderDepts.map((d) => (<SelectItem key={d} value={d}>{d}</SelectItem>))}
                  </SelectContent>
                </Select>
              ) : (
                <span className="rounded-none border border-[#e3e4e8] bg-[#f5f6f7] px-3 py-2 text-xs font-light text-[#55585e]">发布部门：{leaderDepts[0]}</span>
              )}
              <Input value={newDeptNotice} onChange={(e) => setNewDeptNotice(e.target.value)} placeholder="输入通知内容，回车提交" onKeyDown={(e) => { if (e.key === 'Enter') submitDeptNotice(); }} className={`${fieldCls} flex-1 min-w-[200px]`} />
              <Button onClick={submitDeptNotice} disabled={submittingDeptNotice} className={`${btnSolid} shrink-0`}>{submittingDeptNotice ? '提交中…' : '提交申请'}</Button>
            </div>
          </div>
        )}
        {(isAdmin || isLeader) && (
          <div className={`${panelCls} space-y-3 p-5`}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-light tracking-[0.15em] text-[#85888e]">{isAdmin ? '所有通知申请' : '我的通知申请'}（{applicationList.length}）</p>
              {sortedApplications.length > 3 && (
                <Button size="sm" variant="outline" className={`${btnGhost} shrink-0`} onClick={() => setAppCollapsed(!appCollapsed)}>{appCollapsed ? '展开' : '折叠'}</Button>
              )}
            </div>
            {sortedApplications.length === 0 ? <p className="text-xs font-light text-[#9b9ea4]">暂无申请记录</p> : (
              <div className="space-y-2">
                {(appCollapsed ? sortedApplications.slice(0, 3) : sortedApplications).map((n) => (
                  <div key={n.id} className="border border-[#e3e4e8] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="text-xs font-light text-[#1b1c1e]">{n.content}</p>
                        <p className="mt-1 text-[10px] text-[#9b9ea4]">部门：{n.department} · 提交于 {new Date(n.created_at).toLocaleString('zh-CN')}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant="outline" className={`rounded-none border-0 text-[10px] font-light ${n.status === 'pending' ? 'bg-[#fef3c7] text-[#b45309]' : n.status === 'approved' ? 'bg-[#dcfce7] text-[#166534]' : 'bg-[#eef0f2] text-[#85888e]'}`}>{n.status === 'pending' ? '待审核' : n.status === 'approved' ? '已通过' : '已拒绝'}</Badge>
                        {isAdmin && n.status === 'pending' && (
                          <div className="flex gap-1">
                            <Button size="sm" onClick={() => handleApproveDeptNotice(n.id, 'approved')} className={btnSolid}>通过</Button>
                            <Button size="sm" variant="outline" onClick={() => handleApproveDeptNotice(n.id, 'rejected')} className={btnGhost}>拒绝</Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <div className={`${panelCls} space-y-3 p-5`}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-light tracking-[0.15em] text-[#85888e]">历史通知（{historyItems.length}）</p>
            {historyItems.length > 3 && (
              <Button size="sm" variant="outline" className={`${btnGhost} shrink-0`} onClick={() => setHistoryCollapsed(!historyCollapsed)}>{historyCollapsed ? '展开' : '折叠'}</Button>
            )}
          </div>
          {historyItems.length === 0 ? <p className="text-xs font-light text-[#9b9ea4]">暂无历史通知</p> : (
            <div className="space-y-2">
              {(historyCollapsed ? historyItems.slice(0, 3) : historyItems).map((item) => {
                if (item.type === 'global') {
                  const notice = item.notice as GlobalNotice;
                  const isOwner = (notice as any).created_by === myUserIdForNotice;
                  const myRead = mergedReadGlobalIds.includes(notice.id);
                  const expanded = expandedGlobalIds.includes(notice.id);
                  const detail = globalDetail[notice.id] ?? [];
                  const readCount = detail.filter((m) => m.is_read).length;
                  return (
                    <div key={notice.id} className="border border-[#e3e4e8] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="rounded-none border-0 bg-[#fef3c7] text-[10px] font-light text-[#b45309]">全局</Badge>
                            <p className="text-xs font-light text-[#1b1c1e]">{notice.content}</p>
                          </div>
                          <p className="mt-1 text-[10px] text-[#9b9ea4]">{new Date(notice.created_at).toLocaleString('zh-CN')}{isOwner ? ` · 已读 ${readCount}/${detail.length}` : ` · 我：${myRead ? '已读' : '未读'}`}</p>
                        </div>
                        {isOwner && <Button size="sm" variant="outline" onClick={() => toggleExpand(notice.id, 'global')} className={`${btnGhost} shrink-0`}>{expanded ? '收起' : '展开'}</Button>}
                      </div>
                      {expanded && isOwner && <ReadDetailList detail={globalDetail} noticeId={notice.id} />}
                    </div>
                  );
                } else {
                  const notice = item.notice as DepartmentNotice;
                  const isOwner = (notice as any).submitter_user_id === myUserIdForNotice;
                  const myRead = mergedReadDeptIds.includes(notice.id);
                  const expanded = expandedDeptIds.includes(notice.id);
                  const detail = deptDetail[notice.id] ?? [];
                  const readCount = detail.filter((m) => m.is_read).length;
                  return (
                    <div key={notice.id} className="border border-[#e3e4e8] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="rounded-none border-0 bg-[#f0f9ff] text-[10px] font-light text-[#0369a1]">部门</Badge>
                            <p className="text-xs font-light text-[#1b1c1e]">{notice.content}</p>
                          </div>
                          <p className="mt-1 text-[10px] text-[#9b9ea4]">部门：{notice.department} · {new Date(notice.created_at).toLocaleString('zh-CN')}{isOwner ? ` · 已读 ${readCount}/${detail.length}` : ` · 我：${myRead ? '已读' : '未读'}`}</p>
                        </div>
                        {isOwner && <Button size="sm" variant="outline" onClick={() => toggleExpand(notice.id, 'dept')} className={`${btnGhost} shrink-0`}>{expanded ? '收起' : '展开'}</Button>}
                      </div>
                      {expanded && isOwner && <ReadDetailList detail={deptDetail} noticeId={notice.id} />}
                    </div>
                  );
                }
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );

  const renderInquiries = () => (
    <section className="space-y-4">
      <h2 className="text-sm font-light tracking-[0.25em] text-[#1b1c1e]">合作意向管理</h2>
      {inquiries.length === 0 ? <p className={`${panelCls} p-8 text-center text-xs font-light text-[#9b9ea4]`}>暂无合作意向</p> : (
        <div className="space-y-4">
          {inquiries.map((q) => {
            const visitor = q.visitor_id ? visitorMap[q.visitor_id] : undefined;
            return (
              <div key={q.id} className={`${panelCls} space-y-3 p-6`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-sm font-light tracking-wider text-[#1b1c1e]">{q.subject}</h3>
                    <Badge variant="outline" className={`${STATUS_CLASS_MAP[q.status] ?? ''} rounded-none border-0 font-light`}>{INQUIRY_STATUS_MAP[q.status]?.label ?? q.status}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-light text-[#b9bcc2]">处理状态</span>
                    <Select value={q.status} onValueChange={(v) => handleStatusChange(q.id, v)} disabled={updatingId === q.id}>
                      <SelectTrigger size="sm" className="w-[110px] rounded-none border-[#e3e4e8] bg-white font-light text-[#1b1c1e]"><SelectValue placeholder="状态" /></SelectTrigger>
                      <SelectContent className="rounded-none border-[#e3e4e8] bg-white font-light text-[#1b1c1e]">{INQUIRY_STATUS_OPTIONS.map((opt) => (<SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                </div>
                <p className="whitespace-pre-wrap text-xs font-light leading-6 text-[#55585e]">{q.message}</p>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-[#f0f1f3] pt-3 text-[11px] font-light text-[#9b9ea4]">
                  <span>访客：{visitor?.name ?? '（已注销）'}</span>
                  {visitor?.company && <span>公司：{visitor.company}</span>}
                  {visitor?.phone && <span>电话：{visitor.phone}</span>}
                  {q.contact && <span>联系方式：{q.contact}</span>}
                  <span>提交于 {new Date(q.created_at).toLocaleString('zh-CN')}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );

  const renderFiles = () => (
    <div className="space-y-8">
      {myInvites.filter((i) => i.status === 'pending').length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-light tracking-[0.25em] text-[#1b1c1e]">
            查看邀请（{myInvites.filter((i) => i.status === 'pending').length}）
          </h2>
          <div className={`${panelCls} divide-y divide-[#f0f1f3]`}>
            {myInvites.filter((i) => i.status === 'pending').map((inv) => (
              <div key={inv.id} className="flex items-start justify-between gap-3 p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="rounded-none border-0 bg-[#fdecea] text-[10px] font-light text-[#c62828]">
                      绝密
                    </Badge>
                    <p className="text-xs font-light text-[#1b1c1e] break-words">
                      管理员邀请你查看「{inv.fileName}」
                    </p>
                  </div>
                  <p className="mt-1 text-[10px] text-[#9b9ea4] font-mono">
                    编号：{inv.fileCode} · {new Date(inv.createdAt).toLocaleString('zh-CN')}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    size="sm"
                    className={btnSolid}
                    disabled={inviteHandling === inv.id}
                    onClick={() => handleInviteResponse(inv.id, 'accept')}
                  >
                    接受
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className={btnGhost}
                    disabled={inviteHandling === inv.id}
                    onClick={() => handleInviteResponse(inv.id, 'decline')}
                  >
                    拒绝
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-sm font-light tracking-[0.25em] text-[#1b1c1e]">正在审核（{pendingMine.length}）</h2>
            <p className="mt-1 text-[11px] font-light text-[#9b9ea4]">你上传的文件，正在等待管理员审核</p>
          </div>
          <div className="flex items-center gap-3">
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFilePicked} />
            <Button variant="outline" className={btnGhost} onClick={openAccessDialog}>申请权限</Button>
            <Button onClick={openUploadDialog} disabled={fileUploading} className={btnSolid}>
              {fileUploading ? '上传中…' : '上传文件（≤10MB）'}
            </Button>
          </div>
        </div>

        {fileMsg && (
          <p className={`text-xs font-light ${fileMsg.type === 'ok' ? 'text-[#e8704a]' : 'text-red-500'}`}>
            {fileMsg.text}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={pendingSearch}
            onChange={(e) => setPendingSearch(e.target.value)}
            placeholder="按编号或文件名查找…"
            className={`${fieldCls} max-w-xs text-xs`}
          />
          {pendingSearch && (
            <button onClick={() => setPendingSearch('')} className="text-[11px] text-[#85888e] hover:text-[#1b1c1e]">清空</button>
          )}
        </div>

        <div className={`${panelCls} overflow-x-auto`}>
          <table className="w-full min-w-[720px] text-sm font-light">
            <thead>
              <tr className="border-b border-[#e3e4e8] text-left text-[11px] tracking-[0.15em] text-[#9b9ea4]">
                <th className="px-5 py-3 font-light">编号</th>
                <th className="px-5 py-3 font-light">文件名</th>
                <th className="px-5 py-3 font-light">大小</th>
                <th className="px-5 py-3 font-light">上传时间</th>
                <th className="px-5 py-3 font-light">状态</th>
                <th className="px-5 py-3 font-light text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {fileLoading ? (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-xs text-[#9b9ea4]">加载中…</td></tr>
              ) : pendingMine.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-xs text-[#9b9ea4]">
                  {pendingSearch ? '没有匹配的文件' : '暂无正在审核的文件'}
                </td></tr>
              ) : pendingMine.map((f) => (
                <tr key={f.id} className="border-b border-[#f0f1f3] text-[#55585e] last:border-0">
                  <td className="px-5 py-3.5 font-mono text-[11px] text-[#9b9ea4]">{f.code || '—'}</td>
                  <td className="max-w-[260px] px-5 py-3.5">
                    <span className="block truncate text-[#1b1c1e]" title={f.displayName}>{f.displayName}</span>
                  </td>
                  <td className="px-5 py-3.5 text-[#85888e]">{formatSize(f.size)}</td>
                  <td className="px-5 py-3.5 text-[#85888e]">
                    {new Date(f.uploadedAt).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge variant="outline" className={`rounded-none border-0 font-light ${FILE_STATUS_MAP.pending.cls}`}>
                      {FILE_STATUS_MAP.pending.text}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-right">
                    <button onClick={() => handleFileDelete(f.id, '（撤回后文件将无法恢复）')} className="text-xs text-[#9b9ea4] hover:text-red-500">撤回</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-sm font-light tracking-[0.25em] text-[#1b1c1e]">我的权限申请（{myRequests.length}）</h2>
            <p className="mt-1 text-[11px] font-light text-[#9b9ea4]">你提交的文件访问权限申请记录</p>
          </div>
          {myRequests.length > 5 && (
            <Button
              size="sm"
              variant="outline"
              className={btnGhost}
              onClick={() => setMyRequestsExpanded((v) => !v)}
            >
              {myRequestsExpanded ? '收起' : `展开全部（共 ${myRequests.length} 条）`}
            </Button>
          )}
        </div>

        <div className={`${panelCls} overflow-x-auto`}>
          <table className="w-full min-w-[820px] text-sm font-light">
            <thead>
              <tr className="border-b border-[#e3e4e8] text-left text-[11px] tracking-[0.15em] text-[#9b9ea4]">
                <th className="px-5 py-3 font-light">编号</th>
                <th className="px-5 py-3 font-light">文件名</th>
                <th className="px-5 py-3 font-light">申请时间</th>
                <th className="px-5 py-3 font-light">理由</th>
                <th className="px-5 py-3 font-light">状态</th>
              </tr>
            </thead>
            <tbody>
              {myRequests.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-xs text-[#9b9ea4]">暂无申请记录</td></tr>
              ) : (myRequestsExpanded ? myRequests : myRequests.slice(0, 5)).map((r) => {
                const statusMap: Record<string, { text: string; cls: string }> = {
                  pending: { text: '等待处理', cls: 'bg-[#fef3c7] text-[#b45309]' },
                  approved: { text: '已通过', cls: 'bg-[#dcfce7] text-[#166534]' },
                  rejected: { text: '已拒绝', cls: 'bg-[#fdecea] text-[#c62828]' },
                };
                const st = statusMap[r.status] ?? { text: r.status, cls: 'bg-[#eef0f2] text-[#85888e]' };
                return (
                  <tr key={r.id} className="border-b border-[#f0f1f3] text-[#55585e] last:border-0">
                    <td className="px-5 py-3.5 font-mono text-[11px] text-[#9b9ea4]">{r.fileCode}</td>
                    <td className="max-w-[260px] px-5 py-3.5">
                      <span className="block truncate text-[#1b1c1e]" title={r.fileName}>{r.fileName}</span>
                    </td>
                    <td className="px-5 py-3.5 text-[#85888e]">
                      {new Date(r.createdAt).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="max-w-[220px] px-5 py-3.5 text-[#85888e]">
                      {r.reason ? (
                        <span className="block truncate" title={r.reason}>{r.reason}</span>
                      ) : (
                        <span className="text-[#b9bcc2]">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge variant="outline" className={`rounded-none border-0 font-light ${st.cls}`}>
                        {st.text}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {myRequests.length > 0 && (
          <p className="text-[11px] font-light tracking-wider text-[#b9bcc2]">
            显示 {(myRequestsExpanded ? myRequests : myRequests.slice(0, 5)).length} / {myRequests.length} 条
          </p>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-sm font-light tracking-[0.25em] text-[#1b1c1e]">可访问文件（{visibleFiles.length}）</h2>
            <p className="mt-1 text-[11px] font-light text-[#9b9ea4]">按文件等级与可查看人员判断</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {([
              { key: 'all', label: '全部' },
              { key: 'approved', label: '已通过' },
            ] as const).map((item) => {
              const active = fileFilter === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setFileFilter(item.key as FileFilter)}
                  className={`px-3 py-1.5 text-xs font-light tracking-wider transition-colors ${active ? 'bg-[#1b1c1e] text-white' : 'bg-[#f5f6f7] text-[#85888e] hover:text-[#1b1c1e]'}`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={visibleSearch}
            onChange={(e) => setVisibleSearch(e.target.value)}
            placeholder="按编号或文件名查找…"
            className={`${fieldCls} max-w-xs text-xs`}
          />
          {visibleSearch && (
            <button onClick={() => setVisibleSearch('')} className="text-[11px] text-[#85888e] hover:text-[#1b1c1e]">清空</button>
          )}
        </div>

        <div className={`${panelCls} overflow-x-auto`}>
          <table className="w-full min-w-[820px] text-sm font-light">
            <thead>
              <tr className="border-b border-[#e3e4e8] text-left text-[11px] tracking-[0.15em] text-[#9b9ea4]">
                <th className="px-5 py-3 font-light">编号</th>
                <th className="px-5 py-3 font-light">文件名</th>
                <th className="px-5 py-3 font-light">大小</th>
                <th className="px-5 py-3 font-light">文件等级</th>
                <th className="px-5 py-3 font-light">上传时间</th>
                <th className="px-5 py-3 font-light">状态</th>
                <th className="px-5 py-3 font-light text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {fileLoading ? (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-xs text-[#9b9ea4]">加载中…</td></tr>
              ) : visibleFiles.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-xs text-[#9b9ea4]">
                  {visibleSearch ? '没有匹配的文件' : '暂无文件'}
                </td></tr>
              ) : visibleFiles.map((f) => (
                <tr key={f.id} className="border-b border-[#f0f1f3] text-[#55585e] last:border-0">
                  <td className="px-5 py-3.5 font-mono text-[11px] text-[#9b9ea4]">{f.code || '—'}</td>
                  <td className="max-w-[260px] px-5 py-3.5">
                    <button
                      onClick={() => handleDownload(f)}
                      className="block max-w-full truncate text-left text-[#1b1c1e] hover:text-[#e8704a]"
                      title={f.displayName}
                    >
                      {f.displayName}
                    </button>
                  </td>
                  <td className="px-5 py-3.5 text-[#85888e]">{formatSize(f.size)}</td>
                  <td className="px-5 py-3.5">{renderLevelBadge(f.level)}</td>
                  <td className="px-5 py-3.5 text-[#85888e]">
                    {new Date(f.uploadedAt).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge variant="outline" className={`rounded-none border-0 font-light ${FILE_STATUS_MAP[f.status].cls}`}>
                      {FILE_STATUS_MAP[f.status].text}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-right">
                    <button onClick={() => handleDownload(f)} className="text-xs text-[#85888e] hover:text-[#1b1c1e]">下载</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] font-light tracking-wider text-[#b9bcc2]">共 {visibleFiles.length} 个文件 · 单个文件不超过 10MB</p>
      </section>
    </div>
  );

  const renderVisitors = () => (
    <section className="space-y-4">
      <h2 className="text-sm font-light tracking-[0.25em] text-[#1b1c1e]">注册访客（{visitors.length}）</h2>
      <div className={`${panelCls} overflow-x-auto`}>
        <table className="w-full min-w-[680px] text-sm font-light">
          <thead><tr className="border-b border-[#e3e4e8] text-left text-[11px] tracking-[0.15em] text-[#9b9ea4]">
            <th className="px-5 py-3 font-light">称呼</th><th className="px-5 py-3 font-light">注册邮箱</th>
            <th className="px-5 py-3 font-light">公司 / 组织</th><th className="px-5 py-3 font-light">电话</th>
            <th className="px-5 py-3 font-light">感兴趣方向</th><th className="px-5 py-3 font-light">注册时间</th>
          </tr></thead>
          <tbody>
            {visitors.length === 0 ? <tr><td colSpan={6} className="px-5 py-8 text-center text-xs text-[#9b9ea4]">暂无注册访客</td></tr> : visitors.map((v) => (
              <tr key={v.id} className="border-b border-[#f0f1f3] text-[#55585e] last:border-0">
                <td className="px-5 py-3.5 text-[#1b1c1e]">{v.name}</td>
                <td className="px-5 py-3.5 text-[#85888e]">{v.email || '—'}</td>
                <td className="px-5 py-3.5">{v.company || '—'}</td>
                <td className="px-5 py-3.5">{v.phone || '—'}</td>
                <td className="px-5 py-3.5">{v.interest || '—'}</td>
                <td className="px-5 py-3.5 text-[#b9bcc2]">{new Date(v.created_at).toLocaleDateString('zh-CN')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );

  const renderActions = () => (
    <section className="space-y-4">
      {myActionInvites.filter((i) => i.status === 'pending').length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-light tracking-[0.25em] text-[#1b1c1e]">
            行动邀请（{myActionInvites.filter((i) => i.status === 'pending').length}）
          </h2>
          <div className={`${panelCls} divide-y divide-[#f0f1f3]`}>
            {myActionInvites.filter((i) => i.status === 'pending').map((inv) => (
              <div key={inv.id} className="flex items-start justify-between gap-3 p-4">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-light text-[#1b1c1e] break-words">
                    管理员邀请你查看行动档案「{inv.actionCodename}」
                  </p>
                  <p className="mt-1 text-[10px] text-[#9b9ea4] font-mono">
                    编号：{inv.actionCode} · {new Date(inv.createdAt).toLocaleString('zh-CN')}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    size="sm"
                    className={btnSolid}
                    disabled={actionInviteHandling === inv.id}
                    onClick={() => handleActionInviteResponse(inv.id, 'accept')}
                  >
                    接受
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className={btnGhost}
                    disabled={actionInviteHandling === inv.id}
                    onClick={() => handleActionInviteResponse(inv.id, 'decline')}
                  >
                    拒绝
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-light tracking-[0.25em] text-[#1b1c1e]">行动档案（{actionList.length}）</h2>
          <p className="mt-1 text-[11px] font-light text-[#9b9ea4]">仅显示管理员允许你查看的档案</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className={btnGhost} onClick={openActionAccessDialog}>申请权限</Button>
          <Button size="sm" className={btnSolid} onClick={openActionDialog}>添加档案</Button>
        </div>
      </div>

      <div className={`${panelCls} overflow-x-auto`}>
        <table className="w-full min-w-[1000px] text-sm font-light">
          <thead>
            <tr className="border-b border-[#e3e4e8] text-left text-[11px] tracking-[0.15em] text-[#9b9ea4]">
              <th className="px-5 py-3 font-light">档案编号</th>
              <th className="px-5 py-3 font-light">行动代号</th>
              <th className="px-5 py-3 font-light">时间</th>
              <th className="px-5 py-3 font-light">小组</th>
              <th className="px-5 py-3 font-light">空中支援</th>
              <th className="px-5 py-3 font-light">信息支援</th>
              <th className="px-5 py-3 font-light">等级</th>
              <th className="px-5 py-3 font-light">简介</th>
              <th className="px-5 py-3 font-light text-right">详情</th>
            </tr>
          </thead>
          <tbody>
            {actionLoading ? (
              <tr><td colSpan={9} className="px-5 py-8 text-center text-xs text-[#9b9ea4]">加载中…</td></tr>
            ) : actionList.length === 0 ? (
              <tr><td colSpan={9} className="px-5 py-8 text-center text-xs text-[#9b9ea4]">暂无可见档案</td></tr>
            ) : actionList.map((a) => {
              const isExpanded = expandedActionId === a.id;
              return (
                <Fragment key={a.id}>
                  <tr className="border-b border-[#f0f1f3] text-[#55585e] last:border-0">
                    <td className="px-5 py-3.5 font-mono text-[11px] text-[#1b1c1e]">{a.code}</td>
                    <td className="px-5 py-3.5 text-[#1b1c1e]">{a.codename}</td>
                    <td className="px-5 py-3.5 text-[#85888e]">
                      {new Date(a.actionTime).toLocaleString('zh-CN')}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-[#1b1c1e]">{a.team}</td>
                    <td className="px-5 py-3.5">
                      <Badge variant="outline" className={`rounded-none border-0 font-light ${a.airSupport ? 'bg-[#dcfce7] text-[#166534]' : 'bg-[#eef0f2] text-[#9b9ea4]'}`}>
                        {a.airSupport ? '有' : '无'}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge variant="outline" className={`rounded-none border-0 font-light ${a.infoSupport ? 'bg-[#dcfce7] text-[#166534]' : 'bg-[#eef0f2] text-[#9b9ea4]'}`}>
                        {a.infoSupport ? '有' : '无'}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5">{renderActionLevelBadge(a.level)}</td>
                    <td className="max-w-[260px] px-5 py-3.5">
                      {a.description ? (
                        <span className="block truncate" title={a.description}>{a.description}</span>
                      ) : (
                        <span className="text-[#b9bcc2]">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right">
                      <button
                        onClick={() => setExpandedActionId((prev) => (prev === a.id ? null : a.id))}
                        className="text-xs text-[#1b1c1e] hover:text-[#e8704a] hover:underline"
                      >
                        {isExpanded ? '收起' : '展开'}
                      </button>
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr className="border-b border-[#f0f1f3] bg-[#fafbfc] last:border-0">
                      <td colSpan={9} className="px-5 py-5">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <p className="text-[10px] font-light tracking-[0.15em] text-[#9b9ea4]">档案编号</p>
                            <p className="mt-1 font-mono text-xs text-[#1b1c1e]">{a.code}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-light tracking-[0.15em] text-[#9b9ea4]">行动代号</p>
                            <p className="mt-1 text-xs text-[#1b1c1e]">{a.codename}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-light tracking-[0.15em] text-[#9b9ea4]">行动时间</p>
                            <p className="mt-1 text-xs text-[#1b1c1e]">{new Date(a.actionTime).toLocaleString('zh-CN')}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-light tracking-[0.15em] text-[#9b9ea4]">小组</p>
                            <p className="mt-1 font-mono text-xs text-[#1b1c1e]">{a.team}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-light tracking-[0.15em] text-[#9b9ea4]">空中支援</p>
                            <p className="mt-1 text-xs text-[#1b1c1e]">{a.airSupport ? '有' : '无'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-light tracking-[0.15em] text-[#9b9ea4]">信息支援</p>
                            <p className="mt-1 text-xs text-[#1b1c1e]">{a.infoSupport ? '有' : '无'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-light tracking-[0.15em] text-[#9b9ea4]">档案等级</p>
                            <p className="mt-1">{renderActionLevelBadge(a.level)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-light tracking-[0.15em] text-[#9b9ea4]">创建者</p>
                            <p className="mt-1 text-xs text-[#1b1c1e]">{a.creatorName || '—'}</p>
                          </div>
                          <div className="sm:col-span-2">
                            <p className="text-[10px] font-light tracking-[0.15em] text-[#9b9ea4]">完整简介</p>
                            <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-6 text-[#55585e]">
                              {a.description?.trim() ? a.description : '（无简介）'}
                            </p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] font-light tracking-wider text-[#b9bcc2]">共 {actionList.length} 条档案</p>

      <section className="space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-sm font-light tracking-[0.25em] text-[#1b1c1e]">我的档案权限申请（{myActionRequests.length}）</h2>
            <p className="mt-1 text-[11px] font-light text-[#9b9ea4]">你提交的行动档案查看权限申请记录</p>
          </div>
          {myActionRequests.length > 5 && (
            <Button size="sm" variant="outline" className={btnGhost} onClick={() => setMyActionRequestsExpanded((v) => !v)}>
              {myActionRequestsExpanded ? '收起' : `展开全部（共 ${myActionRequests.length} 条）`}
            </Button>
          )}
        </div>

        <div className={`${panelCls} overflow-x-auto`}>
          <table className="w-full min-w-[820px] text-sm font-light">
            <thead>
              <tr className="border-b border-[#e3e4e8] text-left text-[11px] tracking-[0.15em] text-[#9b9ea4]">
                <th className="px-5 py-3 font-light">档案编号</th>
                <th className="px-5 py-3 font-light">行动代号</th>
                <th className="px-5 py-3 font-light">申请时间</th>
                <th className="px-5 py-3 font-light">理由</th>
                <th className="px-5 py-3 font-light">状态</th>
              </tr>
            </thead>
            <tbody>
              {myActionRequests.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-xs text-[#9b9ea4]">暂无申请记录</td></tr>
              ) : (myActionRequestsExpanded ? myActionRequests : myActionRequests.slice(0, 5)).map((r) => {
                const statusMap: Record<string, { text: string; cls: string }> = {
                  pending: { text: '等待处理', cls: 'bg-[#fef3c7] text-[#b45309]' },
                  approved: { text: '已通过', cls: 'bg-[#dcfce7] text-[#166534]' },
                  rejected: { text: '已拒绝', cls: 'bg-[#fdecea] text-[#c62828]' },
                };
                const st = statusMap[r.status] ?? { text: r.status, cls: 'bg-[#eef0f2] text-[#85888e]' };
                return (
                  <tr key={r.id} className="border-b border-[#f0f1f3] text-[#55585e] last:border-0">
                    <td className="px-5 py-3.5 font-mono text-[11px] text-[#9b9ea4]">{r.actionCode}</td>
                    <td className="max-w-[260px] px-5 py-3.5">
                      <span className="block truncate text-[#1b1c1e]" title={r.actionCodename}>{r.actionCodename}</span>
                    </td>
                    <td className="px-5 py-3.5 text-[#85888e]">
                      {new Date(r.createdAt).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="max-w-[220px] px-5 py-3.5 text-[#85888e]">
                      {r.reason ? <span className="block truncate" title={r.reason}>{r.reason}</span> : <span className="text-[#b9bcc2]">—</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge variant="outline" className={`rounded-none border-0 font-light ${st.cls}`}>{st.text}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );

  const SECTION_RENDER: Record<SectionKey, () => React.ReactNode> = {
    overview: renderOverview,
    notices: renderNotices,
    inquiries: renderInquiries,
    files: renderFiles,
    visitors: renderVisitors,
    actions: renderActions,
  };

  return (
    <div className="min-h-screen bg-[#f2f3f5]">
      <header className="border-b border-[#e3e4e8] bg-[#f2f3f5]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#e8704a]" />
            <span className="text-sm font-light tracking-[0.35em] text-[#1b1c1e]">番茄鱼工作室</span>
            <span className="ml-1 text-xs font-light tracking-[0.2em] text-[#9b9ea4]">工作台</span>
            <Badge variant="outline" className="ml-2 rounded-none border-[#e3e4e8] bg-white text-[10px] font-light text-[#85888e]">内部</Badge>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-xs font-light text-[#85888e] sm:inline">{me.email}</span>
            <Button size="sm" variant="outline" className={btnGhost} onClick={() => { setPwMsg(null); setPwNew(''); setPwConfirm(''); setPwOpen(true); }}>修改密码</Button>
            <Button size="sm" variant="outline" className={btnGhost} onClick={handleLogout}>退出登录</Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-6 py-8">
        <aside className="sticky top-20 h-fit w-[88px] shrink-0 border border-[#e3e4e8] bg-white">
          <nav className="flex flex-col">
            {SECTIONS.filter((s) => s.key !== 'actions' || isDefenseMember || isAdmin).map((s) => {
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
          {SECTION_RENDER[activeSection]()}
        </main>
      </div>

      <Dialog
        open={uploadOpen}
        onOpenChange={(v) => {
          if (!fileUploading) {
            setUploadOpen(v);
            if (!v) {
              setUploadFile(null);
              setUploadDisplayName('');
              setUploadLevel('internal');
            }
          }
        }}
      >
        <DialogContent className="rounded-none border-[#e3e4e8] bg-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-light tracking-[0.15em]">上传文件</DialogTitle>
            <DialogDescription className="text-xs text-[#9b9ea4]">
              请为文件设置一个便于识别的名称；内部编号将在上传后自动生成。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs text-[#85888e]">原始文件</Label>
              <p className="rounded-none border border-[#e3e4e8] bg-[#f5f6f7] px-3 py-2 text-xs text-[#55585e] truncate">
                {uploadFile?.name ?? '—'}
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-[#85888e]">文件名 *</Label>
              <Input
                value={uploadDisplayName}
                onChange={(e) => setUploadDisplayName(e.target.value)}
                placeholder="例如：项目需求文档"
                className={fieldCls}
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') confirmUpload(); }}
              />
              <p className="text-[10px] text-[#9b9ea4]">扩展名会保留自原文件，无需重复填写</p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-[#85888e]">文件等级</Label>
              <Select value={uploadLevel} onValueChange={(v) => setUploadLevel(v as FileLevel)}>
                <SelectTrigger className={`${fieldCls} text-xs`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">公开 - 所有人可见</SelectItem>
                  <SelectItem value="internal">内部 - 默认内部人员可见</SelectItem>
                  <SelectItem value="confidential">机密 - 仅指定人员可见</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-[#9b9ea4]">
                {uploadLevel === 'public' && '上传后所有人可见（仍需管理员审核）'}
                {uploadLevel === 'internal' && '上传后内部人员可见（仍需管理员审核）'}
                {uploadLevel === 'confidential' && '上传后仅管理员指定的人可见（仍需管理员审核）'}
              </p>
            </div>

            {fileMsg?.type === 'err' && (
              <p className="text-xs font-light text-red-500">{fileMsg.text}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className={btnGhost}
              onClick={() => {
                setUploadOpen(false);
                setUploadFile(null);
                setUploadDisplayName('');
                setUploadLevel('internal');
              }}
              disabled={fileUploading}
            >
              取消
            </Button>
            <Button onClick={confirmUpload} disabled={fileUploading} className={btnSolid}>
              {fileUploading ? '上传中…' : '确认上传'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={accessOpen} onOpenChange={(v) => { if (!accessLoading) setAccessOpen(v); }}>
        <DialogContent className="rounded-none border-[#e3e4e8] bg-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-light tracking-[0.15em]">申请文件访问权限</DialogTitle>
            <DialogDescription className="text-xs text-[#9b9ea4]">
              输入文件编号查找文件。仅「机密 / 绝密」等级的文件可以申请；通过后你会获得该文件的访问权限。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs text-[#85888e]">文件编号</Label>
              <div className="flex gap-2">
                <Input
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  placeholder="例如：F-20260922-001"
                  className={`${fieldCls} flex-1 font-mono text-xs`}
                  onKeyDown={(e) => { if (e.key === 'Enter') findFileByCode(); }}
                />
                <Button onClick={findFileByCode} className={`${btnSolid} shrink-0`}>查找</Button>
              </div>
            </div>

            {accessFound && (
              <div className="space-y-3 border border-[#e3e4e8] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-light text-[#1b1c1e] truncate" title={accessFound.displayName}>
                      {accessFound.displayName}
                    </p>
                    <p className="mt-1 text-[11px] text-[#9b9ea4] font-mono">{accessFound.code}</p>
                  </div>
                  {renderLevelBadge(accessFound.level)}
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-[#9b9ea4]">
                  <span>大小：{formatSize(accessFound.size)}</span>
                  <span>上传者：{accessFound.uploaderName}</span>
                  <span>上传于：{new Date(accessFound.uploadedAt).toLocaleString('zh-CN')}</span>
                </div>

                {(() => {
                  const user = {
                    userId: me?.member?.user_id ?? '',
                    name: me?.member?.name ?? '',
                    memberNo: me?.member?.member_no ?? '',
                    email: me?.email ?? '',
                  };

                  if (hasFileAccess(accessFound, user, myInvites)) {
                    return <p className="text-xs text-[#e8704a]">你已拥有访问权限，无需再次申请。</p>;
                  }

                  const lv = accessFound.level ?? 'internal';
                  if (lv === 'public' || lv === 'internal') {
                    return (
                      <p className="text-xs text-[#e8704a]">
                        该文件等级为「{lv === 'public' ? '公开' : '内部'}」，无需申请。
                      </p>
                    );
                  }

                  if (myRequestForFound) {
                    const st = myRequestForFound.status;
                    if (st === 'pending') {
                      return <p className="text-xs text-[#b45309]">申请已提交，等待管理员处理。</p>;
                    }
                    if (st === 'approved') {
                      return <p className="text-xs text-[#16a34a]">申请已通过，请到「可访问文件」查看。</p>;
                    }
                    if (st === 'rejected') {
                      return (
                        <div className="space-y-2">
                          <p className="text-xs text-red-500">上次申请已被拒绝，你可以重新提交。</p>
                          <Label className="text-xs text-[#85888e]">申请理由（可选）</Label>
                          <Input
                            value={accessReason}
                            onChange={(e) => setAccessReason(e.target.value)}
                            placeholder="简单说明为什么需要访问该文件"
                            className={fieldCls}
                          />
                          <Button onClick={submitAccessRequest} disabled={accessLoading} className={`${btnSolid} w-full`}>
                            {accessLoading ? '提交中…' : '重新申请访问权限'}
                          </Button>
                        </div>
                      );
                    }
                  }

                  return (
                    <div className="space-y-2">
                      <Label className="text-xs text-[#85888e]">申请理由（可选）</Label>
                      <Input
                        value={accessReason}
                        onChange={(e) => setAccessReason(e.target.value)}
                        placeholder="简单说明为什么需要访问该文件"
                        className={fieldCls}
                      />
                      <Button onClick={submitAccessRequest} disabled={accessLoading} className={`${btnSolid} w-full`}>
                        {accessLoading ? '提交中…' : '申请访问权限'}
                      </Button>
                    </div>
                  );
                })()}
              </div>
            )}

            {accessMsg && (
              <p className={`text-xs font-light ${accessMsg.type === 'ok' ? 'text-[#e8704a]' : 'text-red-500'}`}>
                {accessMsg.text}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" className={btnGhost} onClick={() => setAccessOpen(false)} disabled={accessLoading}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={actionDialogOpen} onOpenChange={(v) => { if (!actionSaving) setActionDialogOpen(v); }}>
        <DialogContent className="rounded-none border-[#e3e4e8] bg-white max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-light tracking-[0.15em]">添加行动档案</DialogTitle>
            <DialogDescription className="text-xs text-[#9b9ea4]">
              档案编号将根据行动时间自动生成，格式 DEC+YYYYMMDD+6位随机数。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs text-[#85888e]">行动代号 *</Label>
                <Input
                  value={aCodename}
                  onChange={(e) => setACodename(e.target.value)}
                  placeholder="例如：晨曦行动"
                  className={fieldCls}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-[#85888e]">时间 *</Label>
                <Input
                  type="datetime-local"
                  value={aTime}
                  onChange={(e) => setATime(e.target.value)}
                  className={fieldCls}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-[#85888e]">小组 *（仅大写英文字母）</Label>
              <Input
                value={aTeam}
                onChange={(e) => setATeam(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
                placeholder="例如：ALPHA"
                className={`${fieldCls} font-mono`}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs text-[#85888e]">空中支援</Label>
                <div className="flex items-center gap-2 h-9">
                  <button
                    type="button"
                    onClick={() => setAAirSupport(!aAirSupport)}
                    className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${aAirSupport ? 'bg-[#1b1c1e]' : 'bg-[#d4d6da]'}`}
                  >
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all duration-200 ${aAirSupport ? 'left-[18px]' : 'left-0.5'}`} />
                  </button>
                  <span className="text-xs text-[#55585e]">{aAirSupport ? '有' : '无'}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-[#85888e]">信息支援</Label>
                <div className="flex items-center gap-2 h-9">
                  <button
                    type="button"
                    onClick={() => setAInfoSupport(!aInfoSupport)}
                    className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${aInfoSupport ? 'bg-[#1b1c1e]' : 'bg-[#d4d6da]'}`}
                  >
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all duration-200 ${aInfoSupport ? 'left-[18px]' : 'left-0.5'}`} />
                  </button>
                  <span className="text-xs text-[#55585e]">{aInfoSupport ? '有' : '无'}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-[#85888e]">简介</Label>
              <textarea
                value={aDesc}
                onChange={(e) => setADesc(e.target.value)}
                placeholder="简要描述行动目标、背景等"
                rows={4}
                className="w-full rounded-none border border-[#e3e4e8] bg-white px-3 py-2 text-xs font-light text-[#1b1c1e] placeholder:text-[#b9bcc2] focus:border-[#1b1c1e] focus:outline-none"
              />
            </div>

            <p className="text-[10px] text-[#9b9ea4]">
              新档案默认等级为「绝密」，仅管理员可修改。若需邀请他人查看，请联系管理员。
            </p>

            {aMsg && <p className="text-xs text-red-500">{aMsg}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" className={btnGhost} onClick={() => setActionDialogOpen(false)} disabled={actionSaving}>
              取消
            </Button>
            <Button onClick={handleSaveAction} disabled={actionSaving} className={btnSolid}>
              {actionSaving ? '保存中…' : '保存档案'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={actionAccessOpen} onOpenChange={(v) => { if (!actionAccessLoading) setActionAccessOpen(v); }}>
        <DialogContent className="rounded-none border-[#e3e4e8] bg-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-light tracking-[0.15em]">申请档案查看权限</DialogTitle>
            <DialogDescription className="text-xs text-[#9b9ea4]">
              输入档案编号查找档案。提交后等待管理员审核，通过后你会在「行动档案」列表中看到该档案。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs text-[#85888e]">档案编号</Label>
              <div className="flex gap-2">
                <Input
                  value={actionAccessCode}
                  onChange={(e) => setActionAccessCode(e.target.value)}
                  placeholder="例如：DEC20260922XXXXXX"
                  className={`${fieldCls} flex-1 font-mono text-xs`}
                  onKeyDown={(e) => { if (e.key === 'Enter') findActionByCode(); }}
                />
                <Button onClick={findActionByCode} className={`${btnSolid} shrink-0`}>查找</Button>
              </div>
            </div>

            {actionAccessFound && (
              <div className="space-y-3 border border-[#e3e4e8] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-light text-[#1b1c1e] truncate" title={actionAccessFound.codename}>
                      {actionAccessFound.codename}
                    </p>
                    <p className="mt-1 text-[11px] text-[#9b9ea4] font-mono">{actionAccessFound.code}</p>
                  </div>
                  {renderActionLevelBadge(actionAccessFound.level)}
                </div>
                {actionAccessFound.actionTime > 0 && (
                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-[#9b9ea4]">
                    <span>时间：{new Date(actionAccessFound.actionTime).toLocaleString('zh-CN')}</span>
                    {actionAccessFound.team && <span>小组：{actionAccessFound.team}</span>}
                  </div>
                )}

                {(() => {
                  const user = {
                    userId: me?.member?.user_id ?? '',
                    name: me?.member?.name ?? '',
                    memberNo: me?.member?.member_no ?? '',
                    email: me?.email ?? '',
                  };

                  if (actionAccessFound.id && hasActionAccess(actionAccessFound, user, myActionInvites)) {
                    return <p className="text-xs text-[#e8704a]">你已拥有查看权限，无需再次申请。</p>;
                  }

                  if (myActionRequestForFound) {
                    const st = myActionRequestForFound.status;
                    if (st === 'pending') return <p className="text-xs text-[#b45309]">申请已提交，等待管理员处理。</p>;
                    if (st === 'approved') return <p className="text-xs text-[#16a34a]">申请已通过，请到「行动档案」查看。</p>;
                    if (st === 'rejected') {
                      return (
                        <div className="space-y-2">
                          <p className="text-xs text-red-500">上次申请已被拒绝，你可以重新提交。</p>
                          <Label className="text-xs text-[#85888e]">申请理由（可选）</Label>
                          <Input
                            value={actionAccessReason}
                            onChange={(e) => setActionAccessReason(e.target.value)}
                            placeholder="简单说明为什么需要查看该档案"
                            className={fieldCls}
                          />
                          <Button onClick={submitActionAccessRequest} disabled={actionAccessLoading} className={`${btnSolid} w-full`}>
                            {actionAccessLoading ? '提交中…' : '重新申请查看权限'}
                          </Button>
                        </div>
                      );
                    }
                  }

                  return (
                    <div className="space-y-2">
                      <Label className="text-xs text-[#85888e]">申请理由（可选）</Label>
                      <Input
                        value={actionAccessReason}
                        onChange={(e) => setActionAccessReason(e.target.value)}
                        placeholder="简单说明为什么需要查看该档案"
                        className={fieldCls}
                      />
                      <Button onClick={submitActionAccessRequest} disabled={actionAccessLoading} className={`${btnSolid} w-full`}>
                        {actionAccessLoading ? '提交中…' : '申请查看权限'}
                      </Button>
                    </div>
                  );
                })()}
              </div>
            )}

            {actionAccessMsg && (
              <p className={`text-xs font-light ${actionAccessMsg.type === 'ok' ? 'text-[#e8704a]' : 'text-red-500'}`}>
                {actionAccessMsg.text}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" className={btnGhost} onClick={() => setActionAccessOpen(false)} disabled={actionAccessLoading}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pwOpen} onOpenChange={setPwOpen}>
        <DialogContent className="rounded-none border-[#e3e4e8] bg-white text-[#1b1c1e] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-light tracking-[0.15em]">修改登录密码</DialogTitle>
            <DialogDescription className="text-xs font-light text-[#9b9ea4]">修改后请使用新密码重新登录</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label className="text-xs font-light tracking-[0.15em] text-[#85888e]">新密码</Label><Input type="password" value={pwNew} onChange={(e) => setPwNew(e.target.value)} className={fieldCls} placeholder="至少 6 位" /></div>
            <div className="space-y-2"><Label className="text-xs font-light tracking-[0.15em] text-[#85888e]">确认新密码</Label><Input type="password" value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)} className={fieldCls} /></div>
            {pwMsg && <p className="text-xs font-light text-[#c2410c]">{pwMsg}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" className={btnGhost} onClick={() => setPwOpen(false)}>取消</Button>
            <Button disabled={pwSaving} onClick={handlePasswordChange} className={btnSolid}>{pwSaving ? '保存中…' : '确认修改'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}