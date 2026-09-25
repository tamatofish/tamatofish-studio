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
import { parseDeptTitles, serializeDeptTitles, type DeptTitle } from '@/lib/dept-title';
import { INQUIRY_STATUS_MAP, INQUIRY_STATUS_OPTIONS, type Inquiry, type InternalMember, type MeResponse, type Visitor, type GlobalNotice, type DepartmentNotice, type Message } from '@/lib/types';

const STATUS_CLASS_MAP: Record<string, string> = {
  pending: 'text-[#b45309] bg-[#fef3c7]',
  contacted: 'text-[#0e7490] bg-[#cffafe]',
  closed: 'text-[#85888e] bg-[#eef0f2]',
};
const fieldCls = 'rounded-none border-[#e3e4e8] bg-white text-[#1b1c1e] font-light placeholder:text-[#b9bcc2] focus-visible:ring-[#1b1c1e]/15 focus-visible:border-[#1b1c1e]';
const btnSolid = 'rounded-none border-0 bg-[#1b1c1e] text-[#f5f6f7] font-light hover:bg-[#3a3c40]';
const btnGhost = 'rounded-none border-[#d4d6da] bg-transparent text-xs font-light text-[#55585e] hover:border-[#1b1c1e] hover:bg-transparent hover:text-[#1b1c1e]';
const panelCls = 'border border-[#e3e4e8] bg-white';
const TITLE_OPTIONS = ['负责人', '核心成员', '成员', '实习'];

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
  uploaderName: string;
  uploadedAt: number;
  status: FileStatus;
  reviewedBy?: string;
  reviewedAt?: number;
  rejectReason?: string;
  level: FileLevel;
  visibleTo: string[];
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
interface AccessCode {
  id: string;
  code: string;
  mode: 'unlimited' | 'single';
  note?: string | null;
  created_by?: string | null;
  created_at: string;
  used: boolean;
  used_by_user_id?: string | null;
  used_by_name?: string | null;
  used_by_member_no?: string | null;
  used_at?: string | null;
}
interface FeedbackRecord {
  id: string;
  user_id: string | null;
  visitor_id: string | null;
  name: string | null;
  email: string | null;
  category: string;
  content: string;
  status: string;
  admin_reply: string | null;
  created_at: string;
  replied_at: string | null;
  replied_by: string | null;
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
const FILE_LEVEL_OPTIONS: { value: FileLevel; label: string }[] = [
  { value: 'public', label: '公开' },
  { value: 'internal', label: '内部' },
  { value: 'confidential', label: '机密' },
  { value: 'secret', label: '绝密' },
];
const FILE_DEFAULT_LIMIT = 5;

const FEEDBACK_CATEGORIES = [
  { value: 'bug', label: 'Bug 反馈' },
  { value: 'suggestion', label: '功能建议' },
  { value: 'content', label: '内容问题' },
  { value: 'other', label: '其它' },
];
const FEEDBACK_STATUS_OPTIONS = [
  { value: 'pending', label: '待处理' },
  { value: 'processing', label: '处理中' },
  { value: 'resolved', label: '已解决' },
  { value: 'rejected', label: '已关闭' },
];

type PreviewKind = 'image' | 'pdf' | 'video' | 'audio' | 'text' | null;
function getFileExt(name: string): string {
  const idx = name.lastIndexOf('.');
  if (idx === -1) return '';
  return name.slice(idx + 1).toLowerCase();
}
function getPreviewKind(record: Pick<FileRecord, 'name' | 'mimeType'>): PreviewKind {
  const ext = getFileExt(record.name);
  const mime = (record.mimeType || '').toLowerCase();
  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'image';
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (mime.startsWith('video/') || ['mp4', 'webm', 'ogg', 'mov'].includes(ext)) return 'video';
  if (mime.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext)) return 'audio';
  if (mime.startsWith('text/') || ['txt', 'md', 'json', 'csv', 'log', 'xml', 'yml', 'yaml'].includes(ext)) return 'text';
  return null;
}

type HistoryItem =
  | { type: 'global'; notice: GlobalNotice }
  | { type: 'dept'; notice: DepartmentNotice };
const HISTORY_DEFAULT_LIMIT = 5;

const parseError = async (res: Response | undefined): Promise<string> => {
  if (!res) return '网络异常';
  const text = await res.text().catch(() => '');
  try { const d = JSON.parse(text); if (d.error) return d.error; } catch { /* ignore */ }
  return text || `HTTP ${res.status}`;
};

type SectionKey = 'members' | 'notices' | 'files' | 'inquiries' | 'visitors' | 'feedback' | 'actions' | 'chat' | 'platform';

const SECTIONS: { key: SectionKey; label: string; icon: React.ReactNode }[] = [
  { key: 'members', label: '成员', icon: (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3 3-5 6-5s6 2 6 5" /><path d="M16 6a3 3 0 0 1 0 6" /><path d="M18 20c0-2-1-3.5-2.5-4" /></svg>) },
  { key: 'notices', label: '通知', icon: (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" /><path d="M10 18a2 2 0 0 0 4 0" /></svg>) },
  { key: 'files', label: '文件', icon: (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5a2 2 0 0 1 2-2h6l2 2h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" /></svg>) },
  { key: 'inquiries', label: '意向', icon: (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a8 8 0 1 1-3.3-6.4" /><path d="M22 4l-10 10-3-3" /></svg>) },
  { key: 'visitors', label: '访客', icon: (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3" /><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" /></svg>) },
  { key: 'feedback', label: '反馈', icon: (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" /></svg>) },
  { key: 'actions', label: '行动', icon: (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3" /></svg>) },
  { key: 'chat', label: '聊天', icon: (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" /></svg>) },
  { key: 'platform', label: '平台', icon: (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="1" /><path d="M3 10h18" /><path d="M8 4v6M16 4v6" /></svg>) },
];

export default function AdminConsolePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [members, setMembers] = useState<InternalMember[]>([]);
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [visitorMap, setVisitorMap] = useState<Record<string, Visitor>>({});
  const [globalNotices, setGlobalNotices] = useState<GlobalNotice[]>([]);
  const [allDeptNotices, setAllDeptNotices] = useState<DepartmentNotice[]>([]);
  const [newGlobalNotice, setNewGlobalNotice] = useState('');
  const [submittingGlobal, setSubmittingGlobal] = useState(false);
  const [newDeptNotice, setNewDeptNotice] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [submittingDept, setSubmittingDept] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<InternalMember | null>(null);
  const [fName, setFName] = useState('');
  const [fMemberNo, setFMemberNo] = useState('');
  const [fEmail, setFEmail] = useState('');
  const [fBio, setFBio] = useState('');
  const [fRole, setFRole] = useState('staff');
  const [fStatus, setFStatus] = useState('active');
  const [fShowHome, setFShowHome] = useState(true);
  const [fInitialPw, setFInitialPw] = useState('');
  const [fDeptTitles, setFDeptTitles] = useState<DeptTitle[]>([{ dept: '', title: '成员' }]);
  const [fSaving, setFSaving] = useState(false);
  const [fMsg, setFMsg] = useState<string | null>(null);
  const [deptDialogOpen, setDeptDialogOpen] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [renamingDept, setRenamingDept] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameSaving, setRenameSaving] = useState(false);
  const [expandedDept, setExpandedDept] = useState<string | null>(null);
  const [pwOpen, setPwOpen] = useState(false);
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [fileList, setFileList] = useState<FileRecord[]>([]);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileMsg, setFileMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [fileFilter, setFileFilter] = useState<FileStatus | 'all'>('pending');
  const [fileExpanded, setFileExpanded] = useState(false);
  const [allFilesExpanded, setAllFilesExpanded] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileRecord | null>(null);
  const [previewKind, setPreviewKind] = useState<PreviewKind>(null);
  const [previewText, setPreviewText] = useState<string>('');
  const [previewTextLoading, setPreviewTextLoading] = useState(false);
  const [metaFile, setMetaFile] = useState<FileRecord | null>(null);
  const [metaLevel, setMetaLevel] = useState<FileLevel>('internal');
  const [metaVisibleTo, setMetaVisibleTo] = useState<string[]>([]);
  const [metaSaving, setMetaSaving] = useState(false);

  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);

  const [inviteFile, setInviteFile] = useState<FileRecord | null>(null);
  const [inviteSelected, setInviteSelected] = useState<string[]>([]);
  const [inviteSaving, setInviteSaving] = useState(false);

  /* ===== 行动 ===== */
  const [actionList, setActionList] = useState<ActionRecord[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [editActionOpen, setEditActionOpen] = useState(false);
  const [editingAction, setEditingAction] = useState<ActionRecord | null>(null);
  const [eaCodename, setEaCodename] = useState('');
  const [eaTime, setEaTime] = useState('');
  const [eaTeam, setEaTeam] = useState('');
  const [eaAir, setEaAir] = useState(false);
  const [eaInfo, setEaInfo] = useState(false);
  const [eaDesc, setEaDesc] = useState('');
  const [eaLevel, setEaLevel] = useState<ActionLevel>('secret');
  const [eaVisibleTo, setEaVisibleTo] = useState<string[]>([]);
  const [eaSaving, setEaSaving] = useState(false);
  const [eaMsg, setEaMsg] = useState<string | null>(null);

  /* ===== 行动邀请 ===== */
  const [inviteActionFile, setInviteActionFile] = useState<ActionRecord | null>(null);
  const [inviteActionSelected, setInviteActionSelected] = useState<string[]>([]);
  const [inviteActionSaving, setInviteActionSaving] = useState(false);

  /* ===== 行动邀请记录 ===== */
  const [actionInvites, setActionInvites] = useState<ActionViewInvite[]>([]);

  /* ===== 行动档案权限申请 ===== */
  const [actionAccessRequests, setActionAccessRequests] = useState<ActionAccessRequest[]>([]);
  const [actionAccessExpanded, setActionAccessExpanded] = useState(false);

  /* ===== 行动档案展开 ===== */
  const [expandedActionId, setExpandedActionId] = useState<string | null>(null);

  /* ===== 平台：验证码 ===== */
  const [accessCodes, setAccessCodes] = useState<AccessCode[]>([]);
  const [accessCodesLoading, setAccessCodesLoading] = useState(false);
  const [creatingCode, setCreatingCode] = useState(false);
  const [newCodeMode, setNewCodeMode] = useState<'unlimited' | 'single'>('single');
  const [newCodeNote, setNewCodeNote] = useState('');
  const [codeMsg, setCodeMsg] = useState<string | null>(null);
  const [revealedCode, setRevealedCode] = useState<string | null>(null);

  const [historyExpanded, setHistoryExpanded] = useState(false);

  /* ===== 聊天 ===== */
  const [chatTarget, setChatTarget] = useState<InternalMember | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const [chatFile, setChatFile] = useState<File | null>(null);
  const [chatUploading, setChatUploading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);

  /* ===== 反馈 ===== */
  const [feedbacks, setFeedbacks] = useState<FeedbackRecord[]>([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackFilter, setFeedbackFilter] = useState<'all' | 'pending' | 'processing' | 'resolved' | 'rejected'>('all');
  const [replyingFeedback, setReplyingFeedback] = useState<FeedbackRecord | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replySaving, setReplySaving] = useState(false);

  /* ===== 访客搜索 ===== */
  const [visitorSearch, setVisitorSearch] = useState('');

  const [activeSection, setActiveSection] = useState<SectionKey>('members');
  const [refreshing, setRefreshing] = useState(false);

  const myUserId = me?.member?.user_id ?? null;

  const allDepts = useMemo(() => {
    const set = new Set<string>();
    members.forEach((m) => (m.department ?? '').split(',').map((s) => s.trim()).filter(Boolean).forEach((d) => set.add(d)));
    return Array.from(set).sort();
  }, [members]);

  const deptMemberCount = useMemo(() => {
    const map: Record<string, number> = {};
    members.forEach((m) => {
      (m.department ?? '').split(',').map((s) => s.trim()).filter(Boolean).forEach((d) => {
        map[d] = (map[d] ?? 0) + 1;
      });
    });
    return map;
  }, [members]);

  const deptMembersMap = useMemo(() => {
    const map: Record<string, InternalMember[]> = {};
    members.forEach((m) => {
      (m.department ?? '').split(',').map((s) => s.trim()).filter(Boolean).forEach((d) => {
        if (!map[d]) map[d] = [];
        map[d].push(m);
      });
    });
    return map;
  }, [members]);

  const nameByEmail = useMemo(() => {
    const map: Record<string, string> = {};
    members.forEach((m) => {
      if (m.email) map[m.email.toLowerCase()] = m.name;
      if (m.member_no) map[m.member_no.toUpperCase()] = m.name;
      if (m.user_id) map[m.user_id] = m.name;
    });
    return map;
  }, [members]);

  const resolveDisplayName = useCallback((raw: string): string => {
    if (!raw) return '';
    const trimmed = raw.trim();
    if (nameByEmail[trimmed]) return nameByEmail[trimmed];
    const lower = trimmed.toLowerCase();
    if (nameByEmail[lower]) return nameByEmail[lower];
    const upper = trimmed.toUpperCase();
    if (nameByEmail[upper]) return nameByEmail[upper];
    return trimmed;
  }, [nameByEmail]);

  const stats = useMemo(() => ({
    members: members.length, visitors: visitors.length,
    inquiries: inquiries.length, pending: inquiries.filter((q) => q.status === 'pending').length,
  }), [members, visitors, inquiries]);

  const visibleFiles = useMemo(() => {
    if (fileFilter === 'all') return fileList;
    return fileList.filter((f) => f.status === fileFilter);
  }, [fileList, fileFilter]);

  const pendingFileCount = useMemo(
    () => fileList.filter((f) => f.status === 'pending').length,
    [fileList],
  );

  const displayedFiles = useMemo(
    () => (fileExpanded ? visibleFiles : visibleFiles.slice(0, FILE_DEFAULT_LIMIT)),
    [visibleFiles, fileExpanded],
  );

  const hasMoreFiles = visibleFiles.length > FILE_DEFAULT_LIMIT;

  const approvedFiles = useMemo(
    () => fileList.filter((f) => f.status === 'approved'),
    [fileList],
  );

  const displayedAllFiles = useMemo(
    () => (allFilesExpanded ? approvedFiles : approvedFiles.slice(0, FILE_DEFAULT_LIMIT)),
    [approvedFiles, allFilesExpanded],
  );

  const hasMoreAllFiles = approvedFiles.length > FILE_DEFAULT_LIMIT;

  const historyItems = useMemo<HistoryItem[]>(() => {
    const items: HistoryItem[] = [
      ...globalNotices.map((n) => ({ type: 'global' as const, notice: n })),
      ...allDeptNotices.map((n) => ({ type: 'dept' as const, notice: n })),
    ];
    return items.sort((a, b) => new Date(b.notice.created_at).getTime() - new Date(a.notice.created_at).getTime());
  }, [globalNotices, allDeptNotices]);

  const displayedHistory = useMemo(
    () => (historyExpanded ? historyItems : historyItems.slice(0, HISTORY_DEFAULT_LIMIT)),
    [historyItems, historyExpanded],
  );

  const hasMoreHistory = historyItems.length > HISTORY_DEFAULT_LIMIT;

  const pendingDeptNotices = useMemo(
    () => allDeptNotices.filter((n) => n.status === 'pending'),
    [allDeptNotices],
  );

  const pendingAccessRequests = useMemo(
    () => accessRequests.filter((r) => r.status === 'pending'),
    [accessRequests],
  );

  const pendingActionAccessRequests = useMemo(
    () => actionAccessRequests.filter((r) => r.status === 'pending'),
    [actionAccessRequests],
  );

  const chatContacts = useMemo(() => {
    return members
      .filter((m) => m.user_id && m.user_id !== myUserId)
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  }, [members, myUserId]);

  const filteredVisitors = useMemo(() => {
    const kw = visitorSearch.trim().toLowerCase();
    if (!kw) return visitors;
    return visitors.filter((v) => {
      const name = (v.name ?? '').toLowerCase();
      const email = (v.email ?? '').toLowerCase();
      return name.includes(kw) || email.includes(kw);
    });
  }, [visitors, visitorSearch]);

  const filteredFeedbacks = useMemo(() => {
    if (feedbackFilter === 'all') return feedbacks;
    return feedbacks.filter((f) => f.status === feedbackFilter);
  }, [feedbacks, feedbackFilter]);

  const pendingFeedbackCount = useMemo(
    () => feedbacks.filter((f) => f.status === 'pending').length,
    [feedbacks],
  );

  const loadFiles = useCallback(async () => {
    setFileLoading(true);
    try {
      const res = await callAuthenticatedApi('/api/files');
      if (res?.ok) {
        const data = await res.json();
        setFileList(data.files ?? []);
      }
    } catch (e) {
      console.error('加载文件失败', e);
    } finally {
      setFileLoading(false);
    }
  }, []);

  const loadAccessRequests = useCallback(async () => {
    try {
      const res = await callAuthenticatedApi('/api/files/access-request');
      if (res?.ok) {
        const data = await res.json();
        setAccessRequests(data.requests ?? []);
      }
    } catch { /* ignore */ }
  }, []);

  const loadActionAccessRequests = useCallback(async () => {
    try {
      const res = await callAuthenticatedApi('/api/actions/access-request');
      if (res?.ok) {
        const data = await res.json();
        setActionAccessRequests(data.requests ?? []);
      }
    } catch { /* ignore */ }
  }, []);

  const loadActionInvites = useCallback(async () => {
    try {
      const res = await callAuthenticatedApi('/api/actions/invite');
      if (res?.ok) {
        const data = await res.json();
        setActionInvites(data.invites ?? []);
      }
    } catch { /* ignore */ }
  }, []);

  const loadAccessCodes = useCallback(async () => {
    setAccessCodesLoading(true);
    try {
      const res = await callAuthenticatedApi('/api/access-codes');
      if (res?.ok) {
        const data = await res.json();
        setAccessCodes(data.codes ?? []);
      }
    } catch { /* ignore */ }
    finally { setAccessCodesLoading(false); }
  }, []);
  const loadActions = useCallback(async () => {
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
  }, []);

  const loadFeedbacks = useCallback(async () => {
    setFeedbackLoading(true);
    try {
      const res = await callAuthenticatedApi('/api/feedback');
      if (res?.ok) {
        const data = await res.json();
        setFeedbacks(data.feedbacks ?? []);
      }
    } catch (e) {
      console.error('加载反馈失败', e);
    } finally {
      setFeedbackLoading(false);
    }
  }, []);

  const handleFeedbackStatus = async (id: string, status: string) => {
    try {
      const res = await callAuthenticatedApi('/api/feedback', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      if (!res || !res.ok) {
        const d = await res?.json().catch(() => ({}));
        throw new Error(d.error || '更新失败');
      }
      await loadFeedbacks();
    } catch (err) {
      alert(err instanceof Error ? err.message : '更新失败');
    }
  };

  const openReplyFeedback = (f: FeedbackRecord) => {
    setReplyingFeedback(f);
    setReplyText(f.admin_reply ?? '');
  };

  const handleSubmitReply = async () => {
    if (!replyingFeedback) return;
    setReplySaving(true);
    try {
      const res = await callAuthenticatedApi('/api/feedback', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: replyingFeedback.id, reply: replyText }),
      });
      if (!res || !res.ok) {
        const d = await res?.json().catch(() => ({}));
        throw new Error(d.error || '回复失败');
      }
      setReplyingFeedback(null);
      setReplyText('');
      await loadFeedbacks();
    } catch (err) {
      alert(err instanceof Error ? err.message : '回复失败');
    } finally {
      setReplySaving(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      const el = document.createElement('div');
      el.textContent = '已复制';
      el.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#1b1c1e;color:#fff;font-size:12px;padding:6px 14px;border-radius:4px;z-index:9999;pointer-events:none;';
      document.body.appendChild(el);
      setTimeout(() => {
        el.style.transition = 'opacity .3s';
        el.style.opacity = '0';
        setTimeout(() => { if (el.parentNode) document.body.removeChild(el); }, 300);
      }, 1000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch { /* ignore */ }
      document.body.removeChild(ta);
    }
  };

  const loadChatMessages = useCallback(async (receiverId: string) => {
    setChatLoading(true);
    setChatError(null);
    try {
      const res = await callAuthenticatedApi(`/api/member-chat?receiver_id=${encodeURIComponent(receiverId)}`);
      if (!res?.ok) {
        const d = await res?.json().catch(() => ({}));
        throw new Error(d.error || '加载聊天记录失败');
      }
      const data = await res.json();
      setChatMessages(data.messages ?? []);
    } catch (e) {
      setChatError(e instanceof Error ? e.message : '加载聊天记录失败');
      setChatMessages([]);
    } finally {
      setChatLoading(false);
    }
  }, []);

  const openChat = useCallback(async (m: InternalMember) => {
    if (!m.user_id) return;
    if (chatTarget?.id === m.id) return;
    setChatTarget(m);
    setChatMessages([]);
    setChatInput('');
    setChatFile(null);
    setChatError(null);
    if (chatFileInputRef.current) chatFileInputRef.current.value = '';
    await loadChatMessages(m.user_id);
  }, [chatTarget?.id, loadChatMessages]);

  const handleSendChat = useCallback(async () => {
    if (!chatTarget?.user_id || chatSending) return;
    const content = chatInput.trim();
    if (!content && !chatFile) return;

    setChatSending(true);
    setChatError(null);
    try {
      let fileMeta: { file_url?: string; file_name?: string; file_size?: number; file_mime?: string } = {};

      if (chatFile) {
        setChatUploading(true);
        const fd = new FormData();
        fd.append('file', chatFile);
        const upRes = await callAuthenticatedApi('/api/upload-chat-file', { method: 'POST', body: fd });
        if (!upRes?.ok) {
          const d = await upRes?.json().catch(() => ({}));
          throw new Error(d.error || '文件上传失败');
        }
        const upData = await upRes.json();
        fileMeta = {
          file_url: upData.publicUrl,
          file_name: upData.fileName,
          file_size: upData.fileSize,
          file_mime: upData.fileMime,
        };
        setChatUploading(false);
      }

      const res = await callAuthenticatedApi('/api/member-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiver_id: chatTarget.user_id,
          content: content || null,
          ...fileMeta,
        }),
      });
      if (!res?.ok) {
        const d = await res?.json().catch(() => ({}));
        throw new Error(d.error || '发送失败');
      }
      const data = await res.json();
      setChatMessages((prev) => [...prev, data.message as Message]);
      setChatInput('');
      setChatFile(null);
      if (chatFileInputRef.current) chatFileInputRef.current.value = '';
    } catch (e) {
      setChatError(e instanceof Error ? e.message : '发送失败');
    } finally {
      setChatSending(false);
      setChatUploading(false);
    }
  }, [chatTarget, chatSending, chatInput, chatFile]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const getActionAccessors = useCallback((a: ActionRecord): string[] => {
    const raw = new Set<string>();
    (a.visibleTo ?? []).forEach((v) => raw.add(v));
    actionInvites
      .filter((inv) => inv.actionId === a.id && inv.status === 'accepted')
      .forEach((inv) => {
        if (inv.inviteeId) raw.add(inv.inviteeId);
        if (inv.inviteeName) raw.add(inv.inviteeName);
      });

    const seen = new Set<string>();
    const result: string[] = [];
    raw.forEach((id) => {
      const display = resolveDisplayName(id) || id;
      if (seen.has(display)) return;
      seen.add(display);
      result.push(id);
    });
    return result;
  }, [actionInvites, resolveDisplayName]);

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

  const handleFileReview = async (id: string, action: 'approve' | 'reject') => {
    let reason: string | undefined;
    if (action === 'reject') {
      const input = window.prompt('请输入拒绝原因（可选）');
      if (input === null) return;
      reason = input;
    }
    try {
      const res = await callAuthenticatedApi('/api/files', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, reason }),
      });
      if (!res || !res.ok) {
        const d = await res?.json().catch(() => ({}));
        throw new Error(d.error || '审核失败');
      }
      setFileMsg({ type: 'ok', text: action === 'approve' ? '已通过' : '已拒绝' });
      await loadFiles();
    } catch (err) {
      setFileMsg({ type: 'err', text: err instanceof Error ? err.message : '审核失败' });
    }
  };

  const handleFileDelete = async (id: string) => {
    if (!window.confirm('确定删除该文件？')) return;
    try {
      const res = await callAuthenticatedApi(`/api/files?id=${id}`, { method: 'DELETE' });
      if (!res || !res.ok) {
        const d = await res?.json().catch(() => ({}));
        throw new Error(d.error || '删除失败');
      }
      setFileMsg({ type: 'ok', text: '已删除' });
      await loadFiles();
    } catch (err) {
      setFileMsg({ type: 'err', text: err instanceof Error ? err.message : '删除失败' });
    }
  };

  const handlePreview = async (f: FileRecord) => {
    const kind = getPreviewKind(f);
    if (!kind) return;
    setPreviewFile(f);
    setPreviewKind(kind);
    setPreviewText('');
    if (kind === 'text') {
      setPreviewTextLoading(true);
      try {
        const res = await callAuthenticatedApi(`/api/files/download?id=${f.id}`);
        if (res && res.ok) {
          const text = await res.text();
          setPreviewText(text);
        } else {
          setPreviewText('（无法读取文件内容）');
        }
      } catch {
        setPreviewText('（网络异常，无法读取）');
      } finally {
        setPreviewTextLoading(false);
      }
    }
  };

  const closePreview = () => {
    setPreviewFile(null);
    setPreviewKind(null);
    setPreviewText('');
  };

  const openMetaEdit = (f: FileRecord) => {
    setMetaFile(f);
    setMetaLevel(f.level ?? 'internal');
    setMetaVisibleTo(f.visibleTo ?? []);
  };

  const closeMetaEdit = () => {
    setMetaFile(null);
    setMetaLevel('internal');
    setMetaVisibleTo([]);
  };

  const handleSaveMeta = async () => {
    if (!metaFile) return;
    setMetaSaving(true);
    try {
      const res = await callAuthenticatedApi('/api/files', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: metaFile.id, action: 'meta', level: metaLevel, visibleTo: metaVisibleTo }),
      });
      if (!res || !res.ok) {
        const d = await res?.json().catch(() => ({}));
        throw new Error(d.error || '保存失败');
      }
      setFileMsg({ type: 'ok', text: '已保存文件等级与权限' });
      closeMetaEdit();
      await loadFiles();
    } catch (err) {
      setFileMsg({ type: 'err', text: err instanceof Error ? err.message : '保存失败' });
    } finally {
      setMetaSaving(false);
    }
  };

  const toggleMetaMember = (name: string) => {
    setMetaVisibleTo((prev) => prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]);
  };

  const handleAccessReview = async (id: string, action: 'approve' | 'reject') => {
    try {
      const res = await callAuthenticatedApi('/api/files/access-request', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      if (!res || !res.ok) {
        const d = await res?.json().catch(() => ({}));
        throw new Error(d.error || '操作失败');
      }
      alert(action === 'approve' ? '已通过，用户已获得访问权限' : '已拒绝');
      await loadAccessRequests();
      await loadFiles();
    } catch (err) {
      alert(err instanceof Error ? err.message : '操作失败');
    }
  };

  const handleActionAccessReview = async (id: string, action: 'approve' | 'reject') => {
    try {
      const res = await callAuthenticatedApi('/api/actions/access-request', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      if (!res || !res.ok) {
        const d = await res?.json().catch(() => ({}));
        throw new Error(d.error || '操作失败');
      }
      alert(action === 'approve' ? '已通过，用户已获得查看权限' : '已拒绝');
      await loadActionAccessRequests();
      await loadActions();
    } catch (err) {
      alert(err instanceof Error ? err.message : '操作失败');
    }
  };

  const handleRevokeActionAccess = async (action: ActionRecord, targetId: string) => {
    const targetName = resolveDisplayName(targetId);
    if (!window.confirm(`确定撤回「${targetName}」对档案「${action.codename}」的查看权限吗？`)) return;

    try {
      const freshRes = await callAuthenticatedApi('/api/actions');
      if (!freshRes?.ok) throw new Error('获取最新档案失败');
      const freshData = await freshRes.json();
      const freshList: ActionRecord[] = freshData.actions ?? [];
      const fresh = freshList.find((x) => x.id === action.id);
      if (!fresh) throw new Error('档案已不存在');

      const display = resolveDisplayName(targetId) || targetId;
      const nextVisibleTo = (fresh.visibleTo ?? []).filter((v) => {
        const d = resolveDisplayName(v) || v;
        return d !== display;
      });

      const res1 = await callAuthenticatedApi('/api/actions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: fresh.id,
          codename: fresh.codename,
          actionTime: fresh.actionTime,
          team: fresh.team,
          airSupport: fresh.airSupport,
          infoSupport: fresh.infoSupport,
          description: fresh.description,
          level: fresh.level,
          visibleTo: nextVisibleTo,
        }),
      });
      if (!res1 || !res1.ok) {
        const d = await res1?.json().catch(() => ({}));
        throw new Error(d.error || '撤回访问权限失败');
      }

      const res2 = await callAuthenticatedApi('/api/actions/invite', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revoke: true, actionId: fresh.id, inviteeId: targetId }),
      });
      if (res2 && !res2.ok && res2.status !== 404) {
        const d = await res2?.json().catch(() => ({}));
        console.warn('撤回邀请记录失败：', d.error);
      }

      alert('已撤回该成员的查看权限');
      await loadActions();
      await loadActionInvites();
    } catch (err) {
      alert(err instanceof Error ? err.message : '撤回失败');
    }
  };

  const handleSendInvites = async () => {
    if (!inviteFile) return;
    const invitees = members
      .filter((m) => inviteSelected.includes(m.name))
      .map((m) => ({ userId: m.user_id, name: m.name, email: m.email ?? undefined }));
    if (invitees.length === 0) { alert('请至少选择一位邀请对象'); return; }

    setInviteSaving(true);
    try {
      const res = await callAuthenticatedApi('/api/files/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: inviteFile.id, invitees }),
      });
      if (!res || !res.ok) {
        const d = await res?.json().catch(() => ({}));
        throw new Error(d.error || '邀请失败');
      }
      alert(`已向 ${invitees.length} 位成员发送邀请`);
      setInviteFile(null);
      setInviteSelected([]);
    } catch (err) {
      alert(err instanceof Error ? err.message : '邀请失败');
    } finally {
      setInviteSaving(false);
    }
  };

  const openEditAction = async (a: ActionRecord) => {
    let fresh = a;
    let invites = actionInvites;
    try {
      const [res1, res2] = await Promise.all([
        callAuthenticatedApi('/api/actions'),
        callAuthenticatedApi('/api/actions/invite'),
      ]);
      if (res1?.ok) {
        const data = await res1.json();
        const list: ActionRecord[] = data.actions ?? [];
        fresh = list.find((x) => x.id === a.id) ?? a;
        setActionList(list);
      }
      if (res2?.ok) {
        const data = await res2.json();
        invites = data.invites ?? [];
        setActionInvites(invites);
      }
    } catch { /* ignore */ }

    const accessorSet = new Set<string>();
    (fresh.visibleTo ?? []).forEach((v) => accessorSet.add(v));
    invites
      .filter((inv) => inv.actionId === fresh.id && inv.status === 'accepted')
      .forEach((inv) => {
        if (inv.inviteeId) accessorSet.add(inv.inviteeId);
        if (inv.inviteeName) accessorSet.add(inv.inviteeName);
      });

    const seen = new Set<string>();
    const finalAccessors: string[] = [];
    accessorSet.forEach((id) => {
      const display = resolveDisplayName(id) || id;
      if (seen.has(display)) return;
      seen.add(display);
      finalAccessors.push(id);
    });

    setEditingAction(fresh);
    setEaCodename(fresh.codename);
    setEaTime(new Date(fresh.actionTime).toISOString().slice(0, 16));
    setEaTeam(fresh.team);
    setEaAir(fresh.airSupport);
    setEaInfo(fresh.infoSupport);
    setEaDesc(fresh.description);
    setEaLevel(fresh.level);
    setEaVisibleTo(finalAccessors);
    setEaMsg(null);
    setEditActionOpen(true);
  };

  const handleSaveActionEdit = async () => {
    if (!editingAction) return;
    if (!eaCodename.trim()) { setEaMsg('请填写行动代号'); return; }
    if (!eaTeam.trim()) { setEaMsg('请填写小组'); return; }
    if (!/^[A-Z]+$/.test(eaTeam.trim())) { setEaMsg('小组只能输入大写英文字母'); return; }

    setEaSaving(true);
    setEaMsg(null);
    try {
      const res = await callAuthenticatedApi('/api/actions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingAction.id,
          codename: eaCodename.trim(),
          actionTime: eaTime ? new Date(eaTime).getTime() : editingAction.actionTime,
          team: eaTeam.trim(),
          airSupport: eaAir,
          infoSupport: eaInfo,
          description: eaDesc.trim(),
          level: eaLevel,
          visibleTo: eaVisibleTo,
        }),
      });
      if (!res || !res.ok) {
        const d = await res?.json().catch(() => ({}));
        throw new Error(d.error || '保存失败');
      }
      setEditActionOpen(false);
      setEditingAction(null);
      await loadActions();
    } catch (err) {
      setEaMsg(err instanceof Error ? err.message : '保存失败');
    } finally {
      setEaSaving(false);
    }
  };

  const handleDeleteAction = async (id: string) => {
    if (!window.confirm('确定删除该档案？')) return;
    try {
      const res = await callAuthenticatedApi(`/api/actions?id=${id}`, { method: 'DELETE' });
      if (!res || !res.ok) {
        const d = await res?.json().catch(() => ({}));
        throw new Error(d.error || '删除失败');
      }
      await loadActions();
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除失败');
    }
  };

  const handleCreateCode = async () => {
    setCreatingCode(true);
    setCodeMsg(null);
    setRevealedCode(null);
    try {
      const res = await callAuthenticatedApi('/api/access-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: newCodeMode, note: newCodeNote.trim() || undefined }),
      });
      if (!res || !res.ok) {
        const d = await res?.json().catch(() => ({}));
        throw new Error(d.error || '创建失败');
      }
      const data = await res.json();
      setCodeMsg('创建成功');
      setNewCodeNote('');
      setRevealedCode(data.code?.code ?? null);
      await loadAccessCodes();
    } catch (err) {
      setCodeMsg(err instanceof Error ? err.message : '创建失败');
    } finally {
      setCreatingCode(false);
    }
  };

  const handleDeleteCode = async (id: string) => {
    if (!window.confirm('确定删除该验证码？')) return;
    try {
      const res = await callAuthenticatedApi(`/api/access-codes?id=${id}`, { method: 'DELETE' });
      if (!res || !res.ok) {
        const d = await res?.json().catch(() => ({}));
        throw new Error(d.error || '删除失败');
      }
      await loadAccessCodes();
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除失败');
    }
  };

  const startRenameDept = (oldName: string) => { setRenamingDept(oldName); setRenameValue(oldName); };
  const cancelRenameDept = () => { setRenamingDept(null); setRenameValue(''); };

  const confirmRenameDept = async () => {
    if (!renamingDept) return;
    const newName = renameValue.trim();
    if (!newName) { alert('部门名称不能为空'); return; }
    if (newName === renamingDept) { cancelRenameDept(); return; }
    setRenameSaving(true);
    try {
      const res = await callAuthenticatedApi('/api/departments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldName: renamingDept, newName }),
      });
      if (!res || !res.ok) {
        const d = await res?.json().catch(() => ({}));
        throw new Error(d.error || '重命名失败');
      }
      const d = await res.json();
      alert(`已重命名，${d.updated ?? 0} 个成员记录已更新`);
      cancelRenameDept();
      await loadAll();
    } catch (err) {
      alert(err instanceof Error ? err.message : '重命名失败');
    } finally {
      setRenameSaving(false);
    }
  };

  const handleDeleteDept = async (deptName: string) => {
    const count = deptMemberCount[deptName] ?? 0;
    if (count > 0) {
      alert(`部门「${deptName}」下还有 ${count} 位成员，请先移除或转移这些成员后再删除。`);
      return;
    }
    if (!window.confirm(`确定删除部门「${deptName}」吗？`)) return;
    try {
      const res = await callAuthenticatedApi('/api/departments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: deptName }),
      });
      if (!res || !res.ok) {
        const d = await res?.json().catch(() => ({}));
        throw new Error(d.error || '删除失败');
      }
      alert('已删除');
      if (expandedDept === deptName) setExpandedDept(null);
      await loadAll();
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除失败');
    }
  };

  const toggleExpandDept = (deptName: string) => {
    setExpandedDept((prev) => (prev === deptName ? null : deptName));
  };

  const loadAll = useCallback(async () => {
    const [mRes, vRes, iRes, gRes, dRes, fRes] = await Promise.all([
      callAuthenticatedApi('/api/members?include_admin=1'),
      callAuthenticatedApi('/api/visitors'),
      callAuthenticatedApi('/api/inquiries'),
      callAuthenticatedApi('/api/global-notice'),
      callAuthenticatedApi('/api/department-notice'),
      callAuthenticatedApi('/api/files'),
    ]);
    if (mRes?.ok) { const d = await mRes.json(); setMembers(d.members ?? []); }
    if (vRes?.ok) { const d = await vRes.json(); setVisitors(d.visitors ?? []); setVisitorMap(Object.fromEntries((d.visitors ?? []).map((v: any) => [v.id, v]))); }
    if (iRes?.ok) { const d = await iRes.json(); setInquiries(d.inquiries ?? []); }
    if (gRes?.ok) { const d = await gRes.json(); setGlobalNotices(d.notices ?? []); }
    if (dRes?.ok) { const d = await dRes.json(); setAllDeptNotices(d.notices ?? []); }
    if (fRes?.ok) { const d = await fRes.json(); setFileList(d.files ?? []); }
    await loadAccessRequests();
    await loadActions();
    await loadActionAccessRequests();
    await loadActionInvites();
    await loadAccessCodes();
    await loadFeedbacks();
  }, [loadAccessRequests, loadActions, loadActionAccessRequests, loadActionInvites, loadAccessCodes, loadFeedbacks]);

  const refreshSection = useCallback(async (key: SectionKey) => {
    if (key === 'members' || key === 'notices' || key === 'inquiries' || key === 'visitors') {
      await loadAll();
    } else if (key === 'files') {
      await Promise.all([loadFiles(), loadAccessRequests()]);
    } else if (key === 'actions') {
      await Promise.all([loadActions(), loadActionInvites(), loadActionAccessRequests()]);
    } else if (key === 'chat') {
      await loadAll();
      if (chatTarget?.user_id) await loadChatMessages(chatTarget.user_id);
    } else if (key === 'feedback') {
      await loadFeedbacks();
    } else if (key === 'platform') {
      await loadAccessCodes();
    }
  }, [
    loadAll,
    loadFiles,
    loadAccessRequests,
    loadActions,
    loadActionInvites,
    loadActionAccessRequests,
    loadAccessCodes,
    loadFeedbacks,
    chatTarget?.user_id,
    loadChatMessages,
  ]);

  const handleManualRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await refreshSection(activeSection);
    } finally {
      window.setTimeout(() => setRefreshing(false), 300);
    }
  }, [refreshing, activeSection, refreshSection]);

  const handleSectionChange = useCallback(async (key: SectionKey) => {
    setActiveSection(key);
    try {
      await refreshSection(key);
    } catch (e) {
      console.error('切换分区刷新失败', e);
    }
  }, [refreshSection]);

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await callAuthenticatedApi('/api/me');
      if (!active) return;
      if (!res || !res.ok) { router.replace('/login'); return; }
      const data = await res.json();
      if (!active) return;
      setMe(data);
      if (data.member?.role !== 'admin') { setLoading(false); return; }
      await loadAll();
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [router, loadAll]);

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[#f2f3f5] text-sm font-light text-[#9b9ea4]">加载中…</div>;
  if (me?.member?.role !== 'admin') return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-[#f2f3f5] px-6 text-center">
      <p className="text-sm font-light text-[#55585e]">此页面仅对管理员开放</p>
    </div>
  );

  const resetMemberForm = () => {
    setEditingMember(null); setFName(''); setFMemberNo(''); setFEmail(''); setFBio('');
    setFRole('staff'); setFStatus('active'); setFShowHome(true); setFInitialPw('');
    setFDeptTitles([{ dept: '', title: '成员' }]); setFMsg(null);
  };
  const openAddMember = () => { resetMemberForm(); setMemberDialogOpen(true); };
  const openEditMember = (m: InternalMember) => {
    setEditingMember(m);
    setFName(m.name); setFMemberNo(m.member_no ?? ''); setFEmail(m.email ?? ''); setFBio(m.bio ?? '');
    setFRole(m.role); setFStatus(m.status); setFShowHome(m.show_on_homepage !== false); setFInitialPw('');
    setFDeptTitles(parseDeptTitles(m.department, m.title));
    setFMsg(null); setMemberDialogOpen(true);
  };
  const addDeptRow = () => setFDeptTitles((prev) => [...prev, { dept: '', title: '成员' }]);
  const removeDeptRow = (idx: number) => setFDeptTitles((prev) => prev.filter((_, i) => i !== idx));
  const updateDeptRow = (idx: number, field: 'dept' | 'title', value: string) =>
    setFDeptTitles((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));

  const handleSaveMember = async () => {
    if (!fName.trim()) { setFMsg('请填写姓名'); return; }
    const validPairs = fDeptTitles.filter((p) => p.dept.trim());
    if (validPairs.length === 0) { setFMsg('至少添加一个部门'); return; }
    const { department, title } = serializeDeptTitles(validPairs);
    setFSaving(true); setFMsg(null);
    try {
      if (editingMember) {
        const res = await callAuthenticatedApi('/api/members', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingMember.id,
            name: fName.trim(),
            email: fEmail.trim() || null,
            title,
            department: validPairs.map((p) => p.dept.trim()),
            bio: fBio.trim() || null,
            role: fRole,
            status: fStatus,
            show_on_homepage: fShowHome,
          }),
        });
        if (!res?.ok) { setFMsg(await parseError(res)); return; }
      } else {
        if (!fMemberNo.trim()) { setFMsg('请填写工号'); return; }
        if (fInitialPw.length < 6) { setFMsg('初始密码至少6位'); return; }
        const res = await callAuthenticatedApi('/api/members', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'admin_create', name: fName.trim(), member_no: fMemberNo.trim(), initial_password: fInitialPw, title, department: validPairs.map((p) => p.dept.trim()), bio: fBio.trim() || null, role: fRole, status: fStatus, show_on_homepage: fShowHome }),
        });
        if (!res?.ok) { setFMsg(await parseError(res)); return; }
      }
      setMemberDialogOpen(false); resetMemberForm(); await loadAll();
    } catch { setFMsg('网络异常'); }
    finally { setFSaving(false); }
  };

  const handleDeleteMember = async (m: InternalMember) => {
    if (!window.confirm(`确定删除成员「${m.name}」吗？`)) return;
    const res = await callAuthenticatedApi(`/api/members?id=${m.id}`, { method: 'DELETE' });
    if (res?.ok) { await loadAll(); } else { alert(await parseError(res)); }
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

  const submitGlobalNotice = async () => {
    if (!newGlobalNotice.trim() || submittingGlobal) return;
    setSubmittingGlobal(true);
    try {
      const res = await callAuthenticatedApi('/api/global-notice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: newGlobalNotice.trim() }) });
      if (!res?.ok) { alert(await parseError(res)); return; }
      setNewGlobalNotice(''); await loadAll(); alert('已发布');
    } finally { setSubmittingGlobal(false); }
  };

  const submitDeptNotice = async () => {
    if (!newDeptNotice.trim() || !selectedDept || submittingDept) return;
    setSubmittingDept(true);
    try {
      const res = await callAuthenticatedApi('/api/department-notice', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newDeptNotice.trim(), department: selectedDept }),
      });
      if (!res?.ok) { alert(await parseError(res)); return; }
      const deptName = selectedDept;
      setNewDeptNotice(''); setSelectedDept('');
      await loadAll();
      alert(`已发布到「${deptName}」部门`);
    } finally { setSubmittingDept(false); }
  };

  const handleReviewDept = async (id: string, status: 'approved' | 'rejected') => {
    const res = await callAuthenticatedApi('/api/department-notice', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) });
    if (res?.ok) { await loadAll(); } else { alert(await parseError(res)); }
  };

  const handleStatusChange = async (id: string, status: string) => {
    setUpdatingId(id);
    const res = await callAuthenticatedApi('/api/inquiries', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) });
    if (res?.ok) setInquiries((prev) => prev.map((q) => (q.id === id ? { ...q, status } : q)));
    setUpdatingId(null);
  };

  const renderMembers = () => (
    <div className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: '成员总数', value: stats.members },
          { label: '注册访客', value: stats.visitors },
          { label: '合作意向', value: stats.inquiries },
          { label: '待处理', value: stats.pending },
        ].map((s) => (
          <div key={s.label} className={`${panelCls} p-6`}>
            <p className="text-xs font-light tracking-[0.15em] text-[#9b9ea4]">{s.label}</p>
            <p className="mt-2 text-3xl font-light text-[#1b1c1e]">{s.value}</p>
          </div>
        ))}
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-light tracking-[0.25em] text-[#1b1c1e]">成员管理（{members.length}）</h2>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className={btnGhost} onClick={() => { setNewDeptName(''); cancelRenameDept(); setExpandedDept(null); setDeptDialogOpen(true); }}>部门管理</Button>
            <Button size="sm" className={btnSolid} onClick={openAddMember}>添加成员</Button>
          </div>
        </div>
        <div className={`${panelCls} overflow-x-auto`}>
          <table className="w-full min-w-[900px] text-sm font-light">
            <thead><tr className="border-b border-[#e3e4e8] text-left text-[11px] tracking-[0.15em] text-[#9b9ea4]">
              <th className="px-5 py-3 font-light">工号</th><th className="px-5 py-3 font-light">姓名</th>
              <th className="px-5 py-3 font-light">部门 / 职务</th><th className="px-5 py-3 font-light">邮箱</th>
              <th className="px-5 py-3 font-light">角色</th><th className="px-5 py-3 font-light">状态</th>
              <th className="px-5 py-3 font-light">首页展示</th><th className="px-5 py-3 font-light">操作</th>
            </tr></thead>
            <tbody>
              {members.map((m) => {
                const pairs = parseDeptTitles(m.department, m.title);
                return (
                  <tr key={m.id} className="border-b border-[#f0f1f3] text-[#55585e] last:border-0">
                    <td className="px-5 py-3 text-[#1b1c1e]">{m.member_no || '—'}</td>
                    <td className="px-5 py-3">{m.name}</td>
                    <td className="px-5 py-3">
                      <div className="flex flex-col gap-0.5">
                        {pairs.length === 0 ? <span className="text-[#9b9ea4]">—</span> : pairs.map((p, i) => (
                          <span key={i} className="text-xs">{p.dept} · <span className={p.title === '负责人' ? 'text-[#e8704a]' : ''}>{p.title || '成员'}</span></span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-[#85888e]">{m.email || '—'}</td>
                    <td className="px-5 py-3"><Badge variant="outline" className={`rounded-none border-0 font-light ${m.role === 'admin' ? 'bg-[#1b1c1e] text-white' : 'bg-[#eef0f2] text-[#55585e]'}`}>{m.role === 'admin' ? '管理员' : '成员'}</Badge></td>
                    <td className="px-5 py-3"><Badge variant="outline" className={`rounded-none border-0 font-light ${m.status === 'active' ? 'bg-[#dcfce7] text-[#166534]' : 'bg-[#eef0f2] text-[#9b9ea4]'}`}>{m.status === 'active' ? '在职' : '停用'}</Badge></td>
                    <td className="px-5 py-3">{m.show_on_homepage !== false ? '是' : '否'}</td>
                    <td className="px-5 py-3">
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" className={btnGhost} onClick={() => openEditMember(m)}>编辑</Button>
                        <Button size="sm" variant="outline" className="rounded-none border-[#fecaca] text-[#dc2626] hover:bg-[#fef2f2] hover:text-[#dc2626]" onClick={() => handleDeleteMember(m)}>删除</Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );

  const renderNotices = () => (
    <div className="space-y-4">
      <h2 className="text-sm font-light tracking-[0.25em] text-[#1b1c1e]">通知管理</h2>
      <div className={`${panelCls} space-y-3 p-5`}>
        <p className="text-xs font-light tracking-[0.15em] text-[#85888e]">📢 发布全局通知（所有成员可见，立即生效）</p>
        <div className="flex gap-2">
          <Input value={newGlobalNotice} onChange={(e) => setNewGlobalNotice(e.target.value)} placeholder="输入全局通知内容，回车发布" className={fieldCls} onKeyDown={(e) => { if (e.key === 'Enter') submitGlobalNotice(); }} />
          <Button onClick={submitGlobalNotice} disabled={submittingGlobal} className={`${btnSolid} shrink-0`}>{submittingGlobal ? '发布中' : '发布'}</Button>
        </div>
      </div>
      <div className={`${panelCls} space-y-3 p-5`}>
        <p className="text-xs font-light tracking-[0.15em] text-[#85888e]">📋 发布部门通知（选择部门，直接发布无需审核）</p>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={selectedDept} onValueChange={setSelectedDept}>
            <SelectTrigger className="w-[160px] rounded-none border-[#e3e4e8] bg-white text-xs font-light text-[#1b1c1e]">
              <SelectValue placeholder="选择部门" />
            </SelectTrigger>
            <SelectContent className="rounded-none border-[#e3e4e8] bg-white text-xs font-light">
              {allDepts.length === 0 ? (
                <div className="px-3 py-2 text-xs text-[#9b9ea4]">暂无部门，请先添加成员</div>
              ) : allDepts.map((d) => (<SelectItem key={d} value={d}>{d}</SelectItem>))}
            </SelectContent>
          </Select>
          <Input value={newDeptNotice} onChange={(e) => setNewDeptNotice(e.target.value)} placeholder="输入部门通知内容，回车发布" className={`${fieldCls} flex-1 min-w-[200px]`} onKeyDown={(e) => { if (e.key === 'Enter') submitDeptNotice(); }} />
          <Button onClick={submitDeptNotice} disabled={submittingDept || !selectedDept || !newDeptNotice.trim()} className={`${btnSolid} shrink-0`}>{submittingDept ? '发布中…' : '发布'}</Button>
        </div>
      </div>
      {pendingDeptNotices.length > 0 && (
        <div className={`${panelCls} space-y-3 p-5`}>
          <p className="text-xs font-light tracking-[0.15em] text-[#85888e]">⏳ 待审核部门通知（{pendingDeptNotices.length}）</p>
          {pendingDeptNotices.map((n) => (
            <div key={n.id} className="flex items-start justify-between gap-3 border border-[#e3e4e8] p-3">
              <div>
                <p className="text-xs text-[#1b1c1e]">{n.content}</p>
                <p className="mt-1 text-[10px] text-[#9b9ea4]">部门：{n.department} · {new Date(n.created_at).toLocaleString('zh-CN')}</p>
              </div>
              <div className="flex gap-1">
                <Button size="sm" className={btnSolid} onClick={() => handleReviewDept(n.id, 'approved')}>通过</Button>
                <Button size="sm" variant="outline" className={btnGhost} onClick={() => handleReviewDept(n.id, 'rejected')}>拒绝</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-light tracking-[0.25em] text-[#1b1c1e]">历史通知（{historyItems.length}）</h2>
          {hasMoreHistory && (
            <Button size="sm" variant="outline" className={btnGhost} onClick={() => setHistoryExpanded((v) => !v)}>
              {historyExpanded ? '收起' : `展开全部（共 ${historyItems.length} 条）`}
            </Button>
          )}
        </div>
        {historyItems.length === 0 ? (
          <p className={`${panelCls} p-8 text-center text-xs text-[#9b9ea4]`}>暂无历史通知</p>
        ) : (
          <div className={`${panelCls} divide-y divide-[#f0f1f3]`}>
            {displayedHistory.map((item) => {
              if (item.type === 'global') {
                const n = item.notice;
                return (
                  <div key={`g-${n.id}`} className="flex items-start justify-between gap-3 p-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="rounded-none border-0 bg-[#fef3c7] text-[10px] font-light text-[#b45309]">全局</Badge>
                        <p className="text-xs font-light text-[#1b1c1e] break-words">{n.content}</p>
                      </div>
                      <p className="mt-1 text-[10px] text-[#9b9ea4]">{new Date(n.created_at).toLocaleString('zh-CN')}</p>
                    </div>
                    <Badge variant="outline" className="rounded-none border-0 bg-[#dcfce7] text-[10px] font-light text-[#166534] shrink-0">已发布</Badge>
                  </div>
                );
              }
              const n = item.notice;
              const statusMap: Record<string, { text: string; cls: string }> = {
                pending: { text: '待审核', cls: 'bg-[#fef3c7] text-[#b45309]' },
                approved: { text: '已通过', cls: 'bg-[#dcfce7] text-[#166534]' },
                rejected: { text: '已拒绝', cls: 'bg-[#eef0f2] text-[#85888e]' },
              };
              const st = statusMap[n.status] ?? { text: n.status, cls: 'bg-[#eef0f2] text-[#85888e]' };
              return (
                <div key={`d-${n.id}`} className="flex items-start justify-between gap-3 p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="rounded-none border-0 bg-[#f0f9ff] text-[10px] font-light text-[#0369a1]">部门</Badge>
                      <p className="text-xs font-light text-[#1b1c1e] break-words">{n.content}</p>
                    </div>
                    <p className="mt-1 text-[10px] text-[#9b9ea4]">部门：{n.department} · {new Date(n.created_at).toLocaleString('zh-CN')}</p>
                  </div>
                  <Badge variant="outline" className={`rounded-none border-0 text-[10px] font-light shrink-0 ${st.cls}`}>{st.text}</Badge>
                </div>
              );
            })}
          </div>
        )}
        {historyItems.length > 0 && (
          <p className="text-[11px] font-light tracking-wider text-[#b9bcc2]">
            显示 {displayedHistory.length} / {historyItems.length} 条
          </p>
        )}
      </div>
    </div>
  );

  const renderFiles = () => (    <div className="space-y-8">
    {pendingAccessRequests.length > 0 && (
      <section className="space-y-3">
        <h2 className="text-sm font-light tracking-[0.25em] text-[#1b1c1e]">
          权限申请（{pendingAccessRequests.length}）
        </h2>
        <div className={`${panelCls} divide-y divide-[#f0f1f3]`}>
          {pendingAccessRequests.map((r) => (
            <div key={r.id} className="flex items-start justify-between gap-3 p-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="rounded-none border-0 bg-[#fdecea] text-[10px] font-light text-[#c62828]">
                    机密
                  </Badge>
                  <p className="text-xs font-light text-[#1b1c1e] break-words">
                    {resolveDisplayName(r.requesterName)} 申请查看「{r.fileName}」
                  </p>
                </div>
                <p className="mt-1 text-[10px] text-[#9b9ea4] font-mono">
                  编号：{r.fileCode} · {new Date(r.createdAt).toLocaleString('zh-CN')}
                </p>
                {r.reason && (
                  <p className="mt-1 text-[11px] text-[#55585e]">理由：{r.reason}</p>
                )}
              </div>
              <div className="flex shrink-0 gap-1">
                <Button size="sm" className={btnSolid} onClick={() => handleAccessReview(r.id, 'approve')}>通过</Button>
                <Button size="sm" variant="outline" className={btnGhost} onClick={() => handleAccessReview(r.id, 'reject')}>拒绝</Button>
              </div>
            </div>
          ))}
        </div>
      </section>
    )}

    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-light tracking-[0.25em] text-[#1b1c1e]">文件管理</h2>
          <p className="mt-1 text-[11px] font-light text-[#9b9ea4]">
            {pendingFileCount > 0 ? `${pendingFileCount} 个待审核` : '全部已处理'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(['pending', 'all'] as const).map((key) => {
            const label = key === 'pending' ? '待审核' : '全部';
            const active = fileFilter === key;
            return (
              <button
                key={key}
                onClick={() => setFileFilter(key)}
                className={`px-3 py-1.5 text-xs font-light tracking-wider transition-colors ${active ? 'bg-[#1b1c1e] text-white' : 'bg-[#f5f6f7] text-[#85888e] hover:text-[#1b1c1e]'}`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {fileMsg && (
        <p className={`text-xs font-light ${fileMsg.type === 'ok' ? 'text-[#e8704a]' : 'text-red-500'}`}>
          {fileMsg.text}
        </p>
      )}

      <div className={`${panelCls} overflow-x-auto`}>
        <table className="w-full min-w-[1100px] text-sm font-light">
          <thead>
            <tr className="border-b border-[#e3e4e8] text-left text-[11px] tracking-[0.15em] text-[#9b9ea4]">
              <th className="px-5 py-3 font-light">编号</th>
              <th className="px-5 py-3 font-light">文件名</th>
              <th className="px-5 py-3 font-light">大小</th>
              <th className="px-5 py-3 font-light">上传者名称</th>
              <th className="px-5 py-3 font-light">文件等级</th>
              <th className="px-5 py-3 font-light">可查看人员</th>
              <th className="px-5 py-3 font-light">上传时间</th>
              <th className="px-5 py-3 font-light">状态</th>
              <th className="px-5 py-3 font-light text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {fileLoading ? (
              <tr><td colSpan={9} className="px-5 py-8 text-center text-xs text-[#9b9ea4]">加载中…</td></tr>
            ) : displayedFiles.length === 0 ? (
              <tr><td colSpan={9} className="px-5 py-8 text-center text-xs text-[#9b9ea4]">暂无待审核文件</td></tr>
            ) : displayedFiles.map((f) => {
              const canPreview = getPreviewKind(f) !== null;
              const levelInfo = FILE_LEVEL_MAP[f.level] ?? FILE_LEVEL_MAP.internal;
              return (
                <tr key={f.id} className="border-b border-[#f0f1f3] text-[#55585e] last:border-0">
                  <td className="px-5 py-3.5 font-mono text-[11px] text-[#9b9ea4]">{f.code || '—'}</td>
                  <td className="max-w-[220px] px-5 py-3.5">
                    <button onClick={() => handleDownload(f)} className="block max-w-full truncate text-left text-[#1b1c1e] hover:text-[#e8704a]" title={f.displayName}>
                      {f.displayName}
                    </button>
                    {f.status === 'rejected' && f.rejectReason && (
                      <p className="mt-1 text-[10px] font-light text-[#c62828]">原因：{f.rejectReason}</p>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-[#85888e]">{formatSize(f.size)}</td>
                  <td className="px-5 py-3.5">{resolveDisplayName(f.uploaderName)}</td>
                  <td className="px-5 py-3.5">
                    <Badge variant="outline" className={`rounded-none border-0 font-light ${levelInfo.cls}`}>{levelInfo.text}</Badge>
                  </td>
                  <td className="max-w-[180px] px-5 py-3.5">
                    {(f.visibleTo && f.visibleTo.length > 0) ? (
                      <span className="block truncate text-xs text-[#55585e]" title={f.visibleTo.map(resolveDisplayName).join('、')}>
                        {f.visibleTo.map(resolveDisplayName).join('、')}
                      </span>
                    ) : (<span className="text-xs text-[#9b9ea4]">不限</span>)}
                  </td>
                  <td className="px-5 py-3.5 text-[#85888e]">
                    {new Date(f.uploadedAt).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge variant="outline" className={`rounded-none border-0 font-light ${FILE_STATUS_MAP[f.status].cls}`}>{FILE_STATUS_MAP[f.status].text}</Badge>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-right">
                    {f.status === 'pending' && (
                      <>
                        <button onClick={() => handleFileReview(f.id, 'approve')} className="mr-3 text-xs text-[#e8704a] hover:underline">通过</button>
                        <button onClick={() => handleFileReview(f.id, 'reject')} className="mr-3 text-xs text-red-500 hover:underline">拒绝</button>
                      </>
                    )}
                    {canPreview && (
                      <button onClick={() => handlePreview(f)} className="mr-3 text-xs text-[#1b1c1e] hover:text-[#e8704a] hover:underline">预览</button>
                    )}
                    <button onClick={() => handleDownload(f)} className="text-xs text-[#85888e] hover:text-[#1b1c1e]">下载</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {hasMoreFiles && (
        <div className="flex justify-center">
          <Button size="sm" variant="outline" className={btnGhost} onClick={() => setFileExpanded((v) => !v)}>
            {fileExpanded ? '收起' : `展开全部（共 ${visibleFiles.length} 个）`}
          </Button>
        </div>
      )}
      <p className="text-[11px] font-light tracking-wider text-[#b9bcc2]">显示 {displayedFiles.length} / {visibleFiles.length} 个文件</p>
    </section>

    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-light tracking-[0.25em] text-[#1b1c1e]">已上传文件（{approvedFiles.length}）</h2>
          <p className="mt-1 text-[11px] font-light text-[#9b9ea4]">仅显示已通过审核的文件</p>
        </div>
        {hasMoreAllFiles && (
          <Button size="sm" variant="outline" className={btnGhost} onClick={() => setAllFilesExpanded((v) => !v)}>
            {allFilesExpanded ? '收起' : `展开全部（共 ${approvedFiles.length} 个）`}
          </Button>
        )}
      </div>
      {fileLoading ? (
        <p className={`${panelCls} p-8 text-center text-xs text-[#9b9ea4]`}>加载中…</p>
      ) : approvedFiles.length === 0 ? (
        <p className={`${panelCls} p-8 text-center text-xs text-[#9b9ea4]`}>暂无已通过的文件</p>
      ) : (
        <div className={`${panelCls} overflow-x-auto`}>
          <table className="w-full min-w-[880px] text-sm font-light">
            <thead>
              <tr className="border-b border-[#e3e4e8] text-left text-[11px] tracking-[0.15em] text-[#9b9ea4]">
                <th className="px-5 py-3 font-light">编号</th>
                <th className="px-5 py-3 font-light">文件名</th>
                <th className="px-5 py-3 font-light">大小</th>
                <th className="px-5 py-3 font-light">上传者名称</th>
                <th className="px-5 py-3 font-light">文件等级</th>
                <th className="px-5 py-3 font-light">可查看人员</th>
                <th className="px-5 py-3 font-light">上传时间</th>
                <th className="px-5 py-3 font-light text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {displayedAllFiles.map((f) => {
                const levelInfo = FILE_LEVEL_MAP[f.level] ?? FILE_LEVEL_MAP.internal;
                return (
                  <tr key={f.id} className="border-b border-[#f0f1f3] text-[#55585e] last:border-0">
                    <td className="px-5 py-3.5 font-mono text-[11px] text-[#9b9ea4]">{f.code || '—'}</td>
                    <td className="max-w-[240px] px-5 py-3.5">
                      <button onClick={() => handleDownload(f)} className="block max-w-full truncate text-left text-[#1b1c1e] hover:text-[#e8704a]" title={f.displayName}>
                        {f.displayName}
                      </button>
                    </td>
                    <td className="px-5 py-3.5 text-[#85888e]">{formatSize(f.size)}</td>
                    <td className="px-5 py-3.5">{resolveDisplayName(f.uploaderName)}</td>
                    <td className="px-5 py-3.5">
                      <Badge variant="outline" className={`rounded-none border-0 font-light ${levelInfo.cls}`}>{levelInfo.text}</Badge>
                    </td>
                    <td className="max-w-[180px] px-5 py-3.5">
                      {(f.visibleTo && f.visibleTo.length > 0) ? (
                        <span className="block truncate text-xs text-[#55585e]" title={f.visibleTo.map(resolveDisplayName).join('、')}>
                          {f.visibleTo.map(resolveDisplayName).join('、')}
                        </span>
                      ) : (<span className="text-xs text-[#9b9ea4]">不限</span>)}
                    </td>
                    <td className="px-5 py-3.5 text-[#85888e]">
                      {new Date(f.uploadedAt).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right">
                      {f.level === 'secret' && (
                        <button
                          onClick={() => { setInviteFile(f); setInviteSelected([]); }}
                          className="mr-3 text-xs text-[#c62828] hover:text-[#e8704a] hover:underline"
                        >
                          邀请查看
                        </button>
                      )}
                      <button onClick={() => openMetaEdit(f)} className="mr-3 text-xs text-[#1b1c1e] hover:text-[#e8704a] hover:underline">编辑</button>
                      <button onClick={() => handleDownload(f)} className="text-xs text-[#85888e] hover:text-[#1b1c1e]">下载</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {approvedFiles.length > 0 && (
        <p className="text-[11px] font-light tracking-wider text-[#b9bcc2]">显示 {displayedAllFiles.length} / {approvedFiles.length} 个文件</p>
      )}
    </section>
  </div>
);

const renderInquiries = () => (
  <section className="space-y-4">
    <h2 className="text-sm font-light tracking-[0.25em] text-[#1b1c1e]">合作意向管理</h2>
    {inquiries.length === 0 ? <p className={`${panelCls} p-8 text-center text-xs text-[#9b9ea4]`}>暂无</p> : inquiries.map((q) => {
      const visitor = q.visitor_id ? visitorMap[q.visitor_id] : undefined;
      return (
        <div key={q.id} className={`${panelCls} space-y-3 p-6`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-light text-[#1b1c1e]">{q.subject}</h3>
              <Badge variant="outline" className={`${STATUS_CLASS_MAP[q.status] ?? ''} rounded-none border-0 font-light`}>{INQUIRY_STATUS_MAP[q.status]?.label}</Badge>
            </div>
            <Select value={q.status} onValueChange={(v) => handleStatusChange(q.id, v)} disabled={updatingId === q.id}>
              <SelectTrigger size="sm" className="w-[110px] rounded-none border-[#e3e4e8] bg-white text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{INQUIRY_STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <p className="whitespace-pre-wrap text-xs leading-6 text-[#55585e]">{q.message}</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-[#9b9ea4]">
            <span>访客：{visitor?.name ?? '—'}</span>
            {visitor?.company && <span>公司：{visitor.company}</span>}
            {visitor?.phone && <span>电话：{visitor.phone}</span>}
            {visitor?.email && (
              <span className="inline-flex items-center gap-2">
                邮箱：{visitor.email}
                <button
                  type="button"
                  onClick={() => copyToClipboard(visitor.email ?? '')}
                  className="text-[11px] text-[#1b1c1e] hover:text-[#e8704a] hover:underline"
                  title="复制邮箱"
                >
                  复制
                </button>
              </span>
            )}
            <span>{new Date(q.created_at).toLocaleString('zh-CN')}</span>
          </div>
        </div>
      );
    })}
  </section>
);

const renderVisitors = () => (
  <section className="space-y-4">
    <div className="flex items-center justify-between">
      <h2 className="text-sm font-light tracking-[0.25em] text-[#1b1c1e]">注册访客（{visitors.length}）</h2>
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <Input
        value={visitorSearch}
        onChange={(e) => setVisitorSearch(e.target.value)}
        placeholder="按名称或邮箱搜索…"
        className={`${fieldCls} max-w-xs text-xs`}
      />
      {visitorSearch && (
        <button onClick={() => setVisitorSearch('')} className="text-[11px] text-[#85888e] hover:text-[#1b1c1e]">清空</button>
      )}
      {visitorSearch && (
        <span className="text-[11px] text-[#9b9ea4]">找到 {filteredVisitors.length} 条</span>
      )}
    </div>
    <div className={`${panelCls} overflow-x-auto`}>
      <table className="w-full min-w-[680px] text-sm font-light">
        <thead><tr className="border-b border-[#e3e4e8] text-left text-[11px] text-[#9b9ea4]">
          <th className="px-5 py-3">称呼</th><th className="px-5 py-3">邮箱</th><th className="px-5 py-3">公司</th><th className="px-5 py-3">电话</th><th className="px-5 py-3">兴趣</th><th className="px-5 py-3">注册时间</th>
        </tr></thead>
        <tbody>
          {filteredVisitors.length === 0 ? (
            <tr><td colSpan={6} className="px-5 py-8 text-center text-xs text-[#9b9ea4]">
              {visitorSearch ? '没有匹配的访客' : '暂无注册访客'}
            </td></tr>
          ) : filteredVisitors.map((v) => (
            <tr key={v.id} className="border-b border-[#f0f1f3] text-[#55585e] last:border-0">
              <td className="px-5 py-3 text-[#1b1c1e]">{v.name}</td>
              <td className="px-5 py-3 text-[#85888e]">
                {v.email ? (
                  <span className="inline-flex items-center gap-2">
                    {v.email}
                    <button
                      type="button"
                      onClick={() => copyToClipboard(v.email ?? '')}
                      className="text-[11px] text-[#1b1c1e] hover:text-[#e8704a] hover:underline"
                      title="复制邮箱"
                    >
                      复制
                    </button>
                  </span>
                ) : '—'}
              </td>
              <td className="px-5 py-3">{v.company || '—'}</td>
              <td className="px-5 py-3">{v.phone || '—'}</td>
              <td className="px-5 py-3">{v.interest || '—'}</td>
              <td className="px-5 py-3 text-[#b9bcc2]">{new Date(v.created_at).toLocaleDateString('zh-CN')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
);

const renderFeedback = () => (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <h2 className="text-sm font-light tracking-[0.25em] text-[#1b1c1e]">问题反馈（{feedbacks.length}）</h2>
      {pendingFeedbackCount > 0 && (
        <span className="text-[11px] text-[#b45309]">{pendingFeedbackCount} 条待处理</span>
      )}
    </div>

    <div className="flex flex-wrap items-center gap-2">
      {([
        { key: 'all', label: '全部' },
        { key: 'pending', label: '待处理' },
        { key: 'processing', label: '处理中' },
        { key: 'resolved', label: '已解决' },
        { key: 'rejected', label: '已关闭' },
      ] as const).map((item) => {
        const active = feedbackFilter === item.key;
        return (
          <button
            key={item.key}
            onClick={() => setFeedbackFilter(item.key)}
            className={`px-3 py-1.5 text-xs font-light tracking-wider transition-colors ${
              active ? 'bg-[#1b1c1e] text-white' : 'bg-[#f5f6f7] text-[#85888e] hover:text-[#1b1c1e]'
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>

    {feedbackLoading ? (
      <p className={`${panelCls} p-8 text-center text-xs text-[#9b9ea4]`}>加载中…</p>
    ) : filteredFeedbacks.length === 0 ? (
      <p className={`${panelCls} p-8 text-center text-xs text-[#9b9ea4]`}>
        {feedbackFilter === 'all' ? '暂无反馈' : '该状态下暂无反馈'}
      </p>
    ) : (
      <div className="space-y-3">
        {filteredFeedbacks.map((f) => {
          const stMap: Record<string, { text: string; cls: string }> = {
            pending: { text: '待处理', cls: 'bg-[#fef3c7] text-[#b45309]' },
            processing: { text: '处理中', cls: 'bg-[#cffafe] text-[#0e7490]' },
            resolved: { text: '已解决', cls: 'bg-[#dcfce7] text-[#166534]' },
            rejected: { text: '已关闭', cls: 'bg-[#eef0f2] text-[#85888e]' },
          };
          const st = stMap[f.status] ?? { text: f.status, cls: 'bg-[#eef0f2] text-[#85888e]' };
          const catLabel = FEEDBACK_CATEGORIES.find((c) => c.value === f.category)?.label ?? f.category;
          return (
            <div key={f.id} className={`${panelCls} p-5`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="rounded-none border-0 bg-[#f0f9ff] text-[10px] font-light text-[#0369a1]">{catLabel}</Badge>
                    <Badge variant="outline" className={`rounded-none border-0 text-[10px] font-light ${st.cls}`}>{st.text}</Badge>
                    <span className="text-[11px] text-[#9b9ea4]">{f.name || f.email || '匿名用户'}</span>
                    <span className="text-[10px] text-[#b9bcc2] font-mono">{new Date(f.created_at).toLocaleString('zh-CN')}</span>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap break-words text-xs leading-6 text-[#1b1c1e]">{f.content}</p>
                  {f.admin_reply && (
                    <div className="mt-3 border-l-2 border-[#e8704a] bg-[#fafbfc] p-3">
                      <p className="text-[10px] tracking-[0.2em] text-[#9b9ea4]">回复</p>
                      <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-6 text-[#1b1c1e]">{f.admin_reply}</p>
                      {f.replied_at && (
                        <p className="mt-1 text-[10px] text-[#b9bcc2]">{new Date(f.replied_at).toLocaleString('zh-CN')}</p>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <button
                    onClick={() => openReplyFeedback(f)}
                    className="text-xs text-[#1b1c1e] hover:text-[#e8704a] hover:underline"
                  >
                    {f.admin_reply ? '编辑回复' : '回复'}
                  </button>
                  <select
                    value={f.status}
                    onChange={(e) => handleFeedbackStatus(f.id, e.target.value)}
                    className="rounded-none border border-[#e3e4e8] bg-white px-2 py-1 text-[11px] font-light text-[#55585e] focus:border-[#1b1c1e] focus:outline-none"
                  >
                    {FEEDBACK_STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    )}
  </div>
);

const renderActions = () => (    <section className="space-y-4">
  {pendingActionAccessRequests.length > 0 && (
    <section className="space-y-3">
      <h2 className="text-sm font-light tracking-[0.25em] text-[#1b1c1e]">
        档案权限申请（{pendingActionAccessRequests.length}）
      </h2>
      <div className={`${panelCls} divide-y divide-[#f0f1f3]`}>
        {pendingActionAccessRequests.map((r) => (
          <div key={r.id} className="flex items-start justify-between gap-3 p-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="rounded-none border-0 bg-[#fdecea] text-[10px] font-light text-[#c62828]">
                  绝密
                </Badge>
                <p className="text-xs font-light text-[#1b1c1e] break-words">
                  {resolveDisplayName(r.requesterName)} 申请查看「{r.actionCodename}」
                </p>
              </div>
              <p className="mt-1 text-[10px] text-[#9b9ea4] font-mono">
                编号：{r.actionCode} · {new Date(r.createdAt).toLocaleString('zh-CN')}
              </p>
              {r.reason && (
                <p className="mt-1 text-[11px] text-[#55585e]">理由：{r.reason}</p>
              )}
            </div>
            <div className="flex shrink-0 gap-1">
              <Button size="sm" className={btnSolid} onClick={() => handleActionAccessReview(r.id, 'approve')}>通过</Button>
              <Button size="sm" variant="outline" className={btnGhost} onClick={() => handleActionAccessReview(r.id, 'reject')}>拒绝</Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )}

  {(() => {
    const handled = actionAccessRequests.filter((r) => r.status !== 'pending');
    if (handled.length === 0) return null;
    const displayed = actionAccessExpanded ? handled : handled.slice(0, 5);
    return (
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-light tracking-[0.25em] text-[#1b1c1e]">
            已处理档案申请（{handled.length}）
          </h2>
          {handled.length > 5 && (
            <Button size="sm" variant="outline" className={btnGhost} onClick={() => setActionAccessExpanded((v) => !v)}>
              {actionAccessExpanded ? '收起' : `展开全部（共 ${handled.length} 条）`}
            </Button>
          )}
        </div>
        <div className={`${panelCls} divide-y divide-[#f0f1f3]`}>
          {displayed.map((r) => {
            const st = r.status === 'approved'
              ? { text: '已通过', cls: 'bg-[#dcfce7] text-[#166534]' }
              : { text: '已拒绝', cls: 'bg-[#fdecea] text-[#c62828]' };
            return (
              <div key={r.id} className="flex items-start justify-between gap-3 p-4">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-light text-[#1b1c1e] break-words">
                    {resolveDisplayName(r.requesterName)} 申请查看「{r.actionCodename}」
                  </p>
                  <p className="mt-1 text-[10px] text-[#9b9ea4] font-mono">
                    编号：{r.actionCode} · {new Date(r.createdAt).toLocaleString('zh-CN')}
                  </p>
                  {r.reason && <p className="mt-1 text-[11px] text-[#55585e]">理由：{r.reason}</p>}
                </div>
                <Badge variant="outline" className={`rounded-none border-0 text-[10px] font-light shrink-0 ${st.cls}`}>{st.text}</Badge>
              </div>
            );
          })}
        </div>
      </section>
    );
  })()}

  <div>
    <h2 className="text-sm font-light tracking-[0.25em] text-[#1b1c1e]">行动档案（{actionList.length}）</h2>
    <p className="mt-1 text-[11px] font-light text-[#9b9ea4]">管理员可查看并修改所有档案</p>
  </div>

  <div className={`${panelCls} overflow-x-auto`}>
    <table className="w-full min-w-[1100px] text-sm font-light">
      <thead>
        <tr className="border-b border-[#e3e4e8] text-left text-[11px] tracking-[0.15em] text-[#9b9ea4]">
          <th className="px-5 py-3 font-light">档案编号</th>
          <th className="px-5 py-3 font-light">行动代号</th>
          <th className="px-5 py-3 font-light">时间</th>
          <th className="px-5 py-3 font-light">小组</th>
          <th className="px-5 py-3 font-light">空中支援</th>
          <th className="px-5 py-3 font-light">信息支援</th>
          <th className="px-5 py-3 font-light">等级</th>
          <th className="px-5 py-3 font-light">可查看人员</th>
          <th className="px-5 py-3 font-light">创建者</th>
          <th className="px-5 py-3 font-light text-right">操作</th>
        </tr>
      </thead>
      <tbody>
        {actionLoading ? (
          <tr><td colSpan={10} className="px-5 py-8 text-center text-xs text-[#9b9ea4]">加载中…</td></tr>
        ) : actionList.length === 0 ? (
          <tr><td colSpan={10} className="px-5 py-8 text-center text-xs text-[#9b9ea4]">暂无行动档案</td></tr>
        ) : actionList.map((a) => {
          const lv = ACTION_LEVEL_MAP[a.level] ?? ACTION_LEVEL_MAP.secret;
          const isExpanded = expandedActionId === a.id;
          return (
            <Fragment key={a.id}>
              <tr className="border-b border-[#f0f1f3] text-[#55585e] last:border-0">
                <td className="px-5 py-3.5 font-mono text-[11px] text-[#1b1c1e]">{a.code}</td>
                <td className="px-5 py-3.5 text-[#1b1c1e]">{a.codename}</td>
                <td className="px-5 py-3.5 text-[#85888e]">{new Date(a.actionTime).toLocaleString('zh-CN')}</td>
                <td className="px-5 py-3.5 font-mono">{a.team}</td>
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
                <td className="px-5 py-3.5">
                  <Badge variant="outline" className={`rounded-none border-0 font-light ${lv.cls}`}>{lv.text}</Badge>
                </td>
                <td className="max-w-[240px] px-5 py-3.5">
                  {(() => {
                    const accessors = getActionAccessors(a);
                    if (accessors.length === 0) {
                      return <span className="text-xs text-[#9b9ea4]">不限</span>;
                    }
                    return (
                      <div className="flex flex-wrap gap-1">
                        {accessors.map((uid) => (
                          <span
                            key={uid}
                            className="inline-flex items-center gap-1 border border-[#e3e4e8] bg-[#f5f6f7] px-1.5 py-0.5 text-[11px] text-[#55585e]"
                          >
                            {resolveDisplayName(uid)}
                            <button
                              type="button"
                              onClick={() => handleRevokeActionAccess(a, uid)}
                              className="text-[#9b9ea4] hover:text-red-500"
                              title="撤回查看权限"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    );
                  })()}
                </td>
                <td className="px-5 py-3.5 text-[#85888e] text-xs">{resolveDisplayName(a.creatorName)}</td>
                <td className="whitespace-nowrap px-5 py-3.5 text-right">
                  <button
                    onClick={() => setExpandedActionId((prev) => (prev === a.id ? null : a.id))}
                    className="mr-3 text-xs text-[#1b1c1e] hover:text-[#e8704a] hover:underline"
                  >
                    {isExpanded ? '收起' : '展开'}
                  </button>
                  <button
                    onClick={() => { setInviteActionFile(a); setInviteActionSelected([]); }}
                    className="mr-3 text-xs text-[#c62828] hover:text-[#e8704a] hover:underline"
                  >
                    邀请查看
                  </button>
                  <button onClick={() => openEditAction(a)} className="mr-3 text-xs text-[#1b1c1e] hover:text-[#e8704a] hover:underline">编辑</button>
                  <button onClick={() => handleDeleteAction(a.id)} className="text-xs text-[#9b9ea4] hover:text-red-500">删除</button>
                </td>
              </tr>

              {isExpanded && (
                <tr className="border-b border-[#f0f1f3] bg-[#fafbfc] last:border-0">
                  <td colSpan={10} className="px-5 py-5">
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
                        <p className="mt-1"><Badge variant="outline" className={`rounded-none border-0 font-light ${lv.cls}`}>{lv.text}</Badge></p>
                      </div>
                      <div>
                        <p className="text-[10px] font-light tracking-[0.15em] text-[#9b9ea4]">创建者</p>
                        <p className="mt-1 text-xs text-[#1b1c1e]">{resolveDisplayName(a.creatorName)}</p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-[10px] font-light tracking-[0.15em] text-[#9b9ea4]">可查看人员</p>
                        <p className="mt-1 text-xs text-[#1b1c1e]">
                          {(() => {
                            const accessors = getActionAccessors(a);
                            return accessors.length === 0 ? '不限' : accessors.map((uid) => resolveDisplayName(uid)).join('、');
                          })()}
                        </p>
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
</section>
);

/* ===== 聊天 ===== */
const renderChat = () => (
<div className="flex h-[calc(100vh-9rem)] flex-col">
  <h2 className="mb-4 text-sm font-light tracking-[0.25em] text-[#1b1c1e]">内部聊天</h2>

  <div className={`${panelCls} flex flex-1 overflow-hidden`}>
    <aside className="flex w-[220px] shrink-0 flex-col border-r border-[#e3e4e8]">
      <div className="border-b border-[#e3e4e8] px-4 py-3">
        <p className="text-xs font-light tracking-[0.15em] text-[#85888e]">
          联系人（{chatContacts.length}）
        </p>
      </div>
      <div className="flex-1 overflow-y-auto">
        {chatContacts.length === 0 ? (
          <p className="p-4 text-xs text-[#9b9ea4]">暂无联系人</p>
        ) : chatContacts.map((m) => {
          const active = chatTarget?.id === m.id;
          const pairs = parseDeptTitles(m.department, m.title);
          return (
            <button
              key={m.id}
              onClick={() => openChat(m)}
              className={`flex w-full items-center gap-3 border-b border-[#f0f1f3] px-4 py-3 text-left transition-colors ${
                active ? 'bg-[#1b1c1e] text-white' : 'hover:bg-[#f5f6f7]'
              }`}
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-light ${
                active ? 'bg-white/15 text-white' : 'bg-[#eef0f2] text-[#55585e]'
              }`}>
                {m.name.slice(0, 1)}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-sm font-light ${active ? 'text-white' : 'text-[#1b1c1e]'}`}>
                  {m.name}
                </span>
                <span className={`mt-0.5 block truncate text-[10px] ${active ? 'text-white/60' : 'text-[#9b9ea4]'}`}>
                  {pairs.map((p) => `${p.dept}：${p.title || '成员'}`).join(' / ') || '—'}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </aside>

    <section className="flex min-w-0 flex-1 flex-col">
      {!chatTarget ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-xs font-light text-[#b9bcc2]">点击左侧联系人开始对话</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between border-b border-[#e3e4e8] px-5 py-3">
            <div>
              <p className="text-sm font-light text-[#1b1c1e]">{chatTarget.name}</p>
              <p className="mt-0.5 text-[10px] text-[#9b9ea4]">{chatTarget.member_no || '—'}</p>
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto bg-[#fafbfc] p-5">
            {chatLoading ? (
              <p className="text-center text-xs text-[#9b9ea4]">加载中…</p>
            ) : chatMessages.length === 0 ? (
              <p className="text-center text-xs text-[#b9bcc2]">还没有消息，打个招呼吧</p>
            ) : chatMessages.map((msg) => {
              const mine = msg.sender_id === myUserId;
              return (
                <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex max-w-[70%] flex-col gap-1 ${mine ? 'items-end' : 'items-start'}`}>
                    {msg.content && (
                      <div className={`whitespace-pre-wrap break-words px-3 py-2 text-xs font-light leading-5 ${
                        mine ? 'bg-[#1b1c1e] text-white' : 'border border-[#e3e4e8] bg-white text-[#1b1c1e]'
                      }`}>
                        {msg.content}
                      </div>
                    )}
                    {msg.file_url && (
                      <a
                        href={msg.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs ${
                          mine ? 'bg-[#1b1c1e] text-white' : 'border border-[#e3e4e8] bg-white text-[#1b1c1e]'
                        }`}
                      >
                        📎 {msg.file_name || '附件'}
                        {msg.file_size ? <span className="opacity-60">（{formatSize(msg.file_size)}）</span> : null}
                      </a>
                    )}
                    <span className="px-1 text-[10px] text-[#b9bcc2]">
                      {new Date(msg.created_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            })}
            <div ref={chatBottomRef} />
          </div>

          <div className="border-t border-[#e3e4e8] p-3">
            {chatError && (
              <p className="mb-2 text-[11px] text-red-500">{chatError}</p>
            )}
            {chatFile && (
              <div className="mb-2 flex items-center justify-between border border-[#e3e4e8] bg-[#f5f6f7] px-3 py-1.5">
                <span className="truncate text-[11px] text-[#55585e]">📎 {chatFile.name}</span>
                <button
                  onClick={() => { setChatFile(null); if (chatFileInputRef.current) chatFileInputRef.current.value = ''; }}
                  className="ml-2 text-[#9b9ea4] hover:text-red-500"
                >×</button>
              </div>
            )}
            <div className="flex items-end gap-2">
              <input
                ref={chatFileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => setChatFile(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                onClick={() => chatFileInputRef.current?.click()}
                className="flex h-9 w-9 shrink-0 items-center justify-center border border-[#e3e4e8] text-[#85888e] hover:border-[#1b1c1e] hover:text-[#1b1c1e]"
                title="添加附件（≤10MB）"
              >
                📎
              </button>
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendChat(); }
                }}
                rows={1}
                placeholder="输入消息，回车发送（Shift+Enter 换行）"
                className="min-h-[36px] flex-1 resize-none rounded-none border border-[#e3e4e8] bg-white px-3 py-2 text-xs font-light text-[#1b1c1e] placeholder:text-[#b9bcc2] focus:border-[#1b1c1e] focus:outline-none"
              />
              <Button
                onClick={handleSendChat}
                disabled={chatSending || (!chatInput.trim() && !chatFile)}
                className={`${btnSolid} h-9 shrink-0`}
              >
                {chatUploading ? '上传中…' : chatSending ? '发送中…' : '发送'}
              </Button>
            </div>
          </div>
        </>
      )}
    </section>

    <aside className="hidden w-[240px] shrink-0 flex-col border-l border-[#e3e4e8] xl:flex">
      <div className="border-b border-[#e3e4e8] px-4 py-3">
        <p className="text-xs font-light tracking-[0.15em] text-[#85888e]">
          全部成员（{members.length}）
        </p>
      </div>
      <div className="flex-1 overflow-y-auto">
        {members.length === 0 ? (
          <p className="p-4 text-xs text-[#9b9ea4]">暂无成员</p>
        ) : members.map((m) => {
          const pairs = parseDeptTitles(m.department, m.title);
          const isMe = m.user_id === myUserId;
          return (
            <button
              key={m.id}
              disabled={isMe}
              onClick={() => openChat(m)}
              className={`flex w-full items-start gap-2.5 border-b border-[#f0f1f3] px-4 py-3 text-left transition-colors ${
                isMe ? 'cursor-default opacity-60' : 'hover:bg-[#f5f6f7]'
              }`}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#eef0f2] text-[11px] font-light text-[#55585e]">
                {m.name.slice(0, 1)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-light text-[#1b1c1e]">
                  {m.name}{isMe && <span className="ml-1 text-[10px] text-[#9b9ea4]">（我）</span>}
                </span>
                {pairs.map((p, i) => (
                  <span key={i} className="mt-0.5 block truncate text-[10px] text-[#9b9ea4]">
                    {p.dept}：{p.title || '成员'}
                  </span>
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  </div>
</div>
);

const renderPlatform = () => (
<div className="space-y-6">
  <div>
    <h2 className="text-sm font-light tracking-[0.25em] text-[#1b1c1e]">平台 · 验证码</h2>
    <p className="mt-1 text-[11px] font-light text-[#9b9ea4]">
      64 位十六进制验证码，用于 MAGIC SE Beta 登入。
    </p>
  </div>

  <section className={`${panelCls} space-y-4 p-5`}>
    <p className="text-xs font-light tracking-[0.15em] text-[#85888e]">创建验证码</p>
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setNewCodeMode('single')}
          className={`px-3 py-1.5 text-xs font-light tracking-wider transition-colors ${
            newCodeMode === 'single' ? 'bg-[#1b1c1e] text-white' : 'bg-[#f5f6f7] text-[#85888e] hover:text-[#1b1c1e]'
          }`}
        >
          同一成员使用
        </button>
        <button
          type="button"
          onClick={() => setNewCodeMode('unlimited')}
          className={`px-3 py-1.5 text-xs font-light tracking-wider transition-colors ${
            newCodeMode === 'unlimited' ? 'bg-[#1b1c1e] text-white' : 'bg-[#f5f6f7] text-[#85888e] hover:text-[#1b1c1e]'
          }`}
        >
          无限使用
        </button>
      </div>
      <Input
        value={newCodeNote}
        onChange={(e) => setNewCodeNote(e.target.value)}
        placeholder="备注（可选）"
        className={`${fieldCls} max-w-xs text-xs`}
      />
      <Button onClick={handleCreateCode} disabled={creatingCode} className={btnSolid}>
        {creatingCode ? '创建中…' : '创建'}
      </Button>
    </div>
    {codeMsg && (
      <p className={`text-xs font-light ${codeMsg === '创建成功' ? 'text-[#e8704a]' : 'text-red-500'}`}>
        {codeMsg}
      </p>
    )}
    {revealedCode && (
      <div className="border border-[#e3e4e8] bg-[#f5f6f7] p-3">
        <p className="text-[10px] font-light tracking-wider text-[#9b9ea4]">新验证码（请立即保存）</p>
        <p className="mt-1 break-all font-mono text-xs text-[#1b1c1e]">{revealedCode}</p>
        <button
          type="button"
          onClick={() => { navigator.clipboard.writeText(revealedCode); }}
          className="mt-2 text-[11px] text-[#85888e] hover:text-[#1b1c1e]"
        >
          复制
        </button>
      </div>
    )}
  </section>

  <section className="space-y-3">
    <h3 className="text-xs font-light tracking-[0.25em] text-[#85888e]">
      已创建的验证码（{accessCodes.length}）
    </h3>
    <div className={`${panelCls} overflow-x-auto`}>
      <table className="w-full min-w-[1100px] text-sm font-light">
        <thead>
          <tr className="border-b border-[#e3e4e8] text-left text-[11px] tracking-[0.15em] text-[#9b9ea4]">
            <th className="px-5 py-3 font-light">验证码</th>
            <th className="px-5 py-3 font-light">类型</th>
            <th className="px-5 py-3 font-light">备注</th>
            <th className="px-5 py-3 font-light">使用者</th>
            <th className="px-5 py-3 font-light">使用时间</th>
            <th className="px-5 py-3 font-light">创建时间</th>
            <th className="px-5 py-3 font-light text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          {accessCodesLoading ? (
            <tr><td colSpan={7} className="px-5 py-8 text-center text-xs text-[#9b9ea4]">加载中…</td></tr>
          ) : accessCodes.length === 0 ? (
            <tr><td colSpan={7} className="px-5 py-8 text-center text-xs text-[#9b9ea4]">暂无验证码</td></tr>
          ) : accessCodes.map((c) => (
            <tr key={c.id} className="border-b border-[#f0f1f3] text-[#55585e] last:border-0">
              <td className="max-w-[280px] px-5 py-3.5">
                <span className="block truncate font-mono text-[11px] text-[#1b1c1e]" title={c.code}>
                  {c.code}
                </span>
              </td>
              <td className="px-5 py-3.5">
                <Badge variant="outline" className={`rounded-none border-0 font-light ${c.mode === 'unlimited' ? 'bg-[#dcfce7] text-[#166534]' : 'bg-[#eef0f2] text-[#55585e]'}`}>
                  {c.mode === 'unlimited' ? '无限使用' : '同一成员'}
                </Badge>
              </td>
              <td className="px-5 py-3.5 text-[#85888e]">{c.note || '—'}</td>
              <td className="px-5 py-3.5">
                {c.used_by_name ? (
                  <span className="text-[#1b1c1e]">{c.used_by_name}</span>
                ) : (
                  <span className="text-[#b9bcc2]">未使用</span>
                )}
              </td>
              <td className="px-5 py-3.5 text-[#85888e]">
                {c.used_at ? new Date(c.used_at).toLocaleString('zh-CN') : '—'}
              </td>
              <td className="px-5 py-3.5 text-[#85888e]">
                {new Date(c.created_at).toLocaleString('zh-CN')}
              </td>
              <td className="whitespace-nowrap px-5 py-3.5 text-right">
                <button onClick={() => handleDeleteCode(c.id)} className="text-xs text-[#9b9ea4] hover:text-red-500">删除</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
</div>
);

const SECTION_RENDER: Record<SectionKey, () => React.ReactNode> = {
members: renderMembers,
notices: renderNotices,
files: renderFiles,
inquiries: renderInquiries,
visitors: renderVisitors,
feedback: renderFeedback,
actions: renderActions,
chat: renderChat,
platform: renderPlatform,
};

return (
<div className="min-h-screen bg-[#f2f3f5]">
  <header className="border-b border-[#e3e4e8] bg-white">
    <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-[#e8704a]" />
        <span className="text-sm font-light tracking-[0.35em] text-[#1b1c1e]">番茄鱼工作室</span>
        <Badge variant="outline" className="ml-2 rounded-none border-0 bg-[#1b1c1e] px-2 py-0.5 text-[10px] font-light text-white">管理员控制台</Badge>
      </div>
      <div className="flex items-center gap-4">
        <span className="hidden text-xs font-light text-[#85888e] sm:inline">{me.email}</span>
        <Button
          size="sm"
          variant="outline"
          className={btnGhost}
          onClick={handleManualRefresh}
          disabled={refreshing}
        >
          {refreshing ? '刷新中…' : '刷新'}
        </Button>
        <Button size="sm" variant="outline" className={btnGhost} onClick={() => { setPwMsg(null); setPwNew(''); setPwConfirm(''); setPwOpen(true); }}>修改密码</Button>
        <Button size="sm" variant="outline" className={btnGhost} onClick={handleLogout}>退出登录</Button>
      </div>
    </div>
  </header>

  <div className="mx-auto flex max-w-7xl gap-6 px-6 py-8">
    <aside className="sticky top-8 h-fit w-[88px] shrink-0 border border-[#e3e4e8] bg-white">
      <nav className="flex flex-col">
        {SECTIONS.map((s) => {
          const active = activeSection === s.key;
          return (
            <button
              key={s.key}
              onClick={() => handleSectionChange(s.key)}
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

  {/* 成员编辑 Dialog */}
  <Dialog open={memberDialogOpen} onOpenChange={(v) => { if (!fSaving) { setMemberDialogOpen(v); if (!v) resetMemberForm(); } }}>
    <DialogContent className="rounded-none border-[#e3e4e8] bg-white max-w-2xl">
      <DialogHeader>
        <DialogTitle className="text-base font-light tracking-[0.15em]">{editingMember ? '编辑成员' : '添加成员'}</DialogTitle>
        <DialogDescription className="text-xs text-[#9b9ea4]">部门与职务一一对应，可添加多行</DialogDescription>
      </DialogHeader>
      <div className="space-y-4 max-h-[70vh] overflow-y-auto">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label className="text-xs text-[#85888e]">姓名 *</Label><Input value={fName} onChange={(e) => setFName(e.target.value)} className={fieldCls} /></div>
          <div className="space-y-2"><Label className="text-xs text-[#85888e]">工号 {editingMember ? '' : '*'}</Label><Input value={fMemberNo} onChange={(e) => setFMemberNo(e.target.value)} disabled={!!editingMember} className={`${fieldCls} ${editingMember ? 'opacity-60' : ''}`} /></div>
        </div>
        {!editingMember && (
          <div className="space-y-2"><Label className="text-xs text-[#85888e]">初始密码 *</Label><Input type="text" value={fInitialPw} onChange={(e) => setFInitialPw(e.target.value)} className={fieldCls} placeholder="至少6位" /></div>
        )}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-[#85888e]">部门 / 职务 *</Label>
            <Button size="sm" variant="outline" className={btnGhost} onClick={addDeptRow}>+ 添加一行</Button>
          </div>
          <div className="space-y-2">
            {fDeptTitles.map((row, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input value={row.dept} onChange={(e) => updateDeptRow(idx, 'dept', e.target.value)} placeholder="部门名称" className={`${fieldCls} flex-1`} list="dept-options" />
                <Select value={row.title} onValueChange={(v) => updateDeptRow(idx, 'title', v)}>
                  <SelectTrigger className="w-[130px] rounded-none border-[#e3e4e8] bg-white text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{TITLE_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
                {fDeptTitles.length > 1 && (
                  <Button size="sm" variant="outline" className="rounded-none border-[#fecaca] text-[#dc2626] hover:bg-[#fef2f2] shrink-0" onClick={() => removeDeptRow(idx)}>删</Button>
                )}
              </div>
            ))}
          </div>
          <datalist id="dept-options">{allDepts.map((d) => <option key={d} value={d} />)}</datalist>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label className="text-xs text-[#85888e]">邮箱</Label><Input value={fEmail} onChange={(e) => setFEmail(e.target.value)} className={fieldCls} /></div>
          <div className="space-y-2"><Label className="text-xs text-[#85888e]">简介</Label><Input value={fBio} onChange={(e) => setFBio(e.target.value)} className={fieldCls} /></div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2"><Label className="text-xs text-[#85888e]">角色</Label>
            <Select value={fRole} onValueChange={setFRole}><SelectTrigger className={`${fieldCls} text-xs`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="staff">成员</SelectItem><SelectItem value="admin">管理员</SelectItem></SelectContent></Select>
          </div>
          <div className="space-y-2"><Label className="text-xs text-[#85888e]">状态</Label>
            <Select value={fStatus} onValueChange={setFStatus}><SelectTrigger className={`${fieldCls} text-xs`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">在职</SelectItem><SelectItem value="inactive">停用</SelectItem></SelectContent></Select>
          </div>
          <div className="space-y-2"><Label className="text-xs text-[#85888e]">首页展示</Label>
            <div className="flex items-center gap-2 h-9">
              <button
                type="button"
                onClick={() => setFShowHome(!fShowHome)}
                className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${fShowHome ? 'bg-[#1b1c1e]' : 'bg-[#d4d6da]'}`}
              >
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all duration-200 ${fShowHome ? 'left-[18px]' : 'left-0.5'}`} />
              </button>
              <span className="text-xs text-[#55585e]">{fShowHome ? '展示' : '隐藏'}</span>
            </div>
          </div>
        </div>
        {fMsg && <p className="text-xs text-[#c2410c] break-all">{fMsg}</p>}
      </div>
      <DialogFooter>
        <Button variant="outline" className={btnGhost} onClick={() => { setMemberDialogOpen(false); resetMemberForm(); }} disabled={fSaving}>取消</Button>
        <Button onClick={handleSaveMember} disabled={fSaving} className={btnSolid}>{fSaving ? '保存中…' : '保存'}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  {/* 部门管理 Dialog */}
  <Dialog open={deptDialogOpen} onOpenChange={(v) => { if (!renameSaving) { setDeptDialogOpen(v); if (!v) { cancelRenameDept(); setExpandedDept(null); } } }}>
    <DialogContent className="rounded-none border-[#e3e4e8] bg-white max-w-lg">
      <DialogHeader>
        <DialogTitle className="text-base font-light tracking-[0.15em]">部门管理</DialogTitle>
        <DialogDescription className="text-xs text-[#9b9ea4]">重命名会同步更新所有拥有该部门的成员；删除仅限没有成员的部门</DialogDescription>
      </DialogHeader>
      <div className="space-y-4 max-h-[60vh] overflow-y-auto">
        {allDepts.length === 0 ? (
          <p className="py-6 text-center text-xs text-[#9b9ea4]">暂无部门</p>
        ) : (
          <div className="divide-y divide-[#f0f1f3] border border-[#e3e4e8]">
            {allDepts.map((d) => {
              const isRenaming = renamingDept === d;
              const isExpanded = expandedDept === d;
              const deptMembers = deptMembersMap[d] ?? [];
              return (
                <div key={d} className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {isRenaming ? (
                      <>
                        <Input
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          className={`${fieldCls} flex-1 text-xs`}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') confirmRenameDept();
                            if (e.key === 'Escape') cancelRenameDept();
                          }}
                          autoFocus
                        />
                        <Button size="sm" className={btnSolid} onClick={confirmRenameDept} disabled={renameSaving}>{renameSaving ? '保存中…' : '保存'}</Button>
                        <Button size="sm" variant="outline" className={btnGhost} onClick={cancelRenameDept} disabled={renameSaving}>取消</Button>
                      </>
                    ) : (
                      <>
                        <div className="flex-1">
                          <p className="text-sm font-light text-[#1b1c1e]">{d}</p>
                          <p className="mt-0.5 text-[10px] text-[#9b9ea4]">{deptMembers.length} 位成员</p>
                        </div>
                        <Button size="sm" variant="outline" className={btnGhost} onClick={() => toggleExpandDept(d)}>
                          {isExpanded ? '收起' : '展开'}
                        </Button>
                        <Button size="sm" variant="outline" className={btnGhost} onClick={() => startRenameDept(d)}>重命名</Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-none border-[#fecaca] text-[#dc2626] hover:bg-[#fef2f2] hover:text-[#dc2626]"
                          onClick={() => handleDeleteDept(d)}
                        >
                          删除
                        </Button>
                      </>
                    )}
                  </div>
                  {isExpanded && !isRenaming && (
                    <div className="mt-3 border-t border-[#f0f1f3] pt-3">
                      {deptMembers.length === 0 ? (
                        <p className="text-xs text-[#9b9ea4]">该部门暂无成员</p>
                      ) : (
                        <div className="space-y-1.5">
                          {deptMembers.map((m) => {
                            const pairs = parseDeptTitles(m.department, m.title);
                            const thisPair = pairs.find((p) => p.dept === d);
                            return (
                              <div key={m.id} className="flex items-center justify-between text-xs">
                                <span className="text-[#55585e]">
                                  {m.name}
                                  <span className="ml-2 text-[10px] text-[#9b9ea4]">{m.member_no || '—'}</span>
                                </span>
                                <span className="text-[10px] text-[#9b9ea4]">{thisPair?.title || '成员'}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" className={btnGhost} onClick={() => { setDeptDialogOpen(false); cancelRenameDept(); setExpandedDept(null); }} disabled={renameSaving}>关闭</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  {/* 文件元数据编辑 Dialog */}
  <Dialog open={!!metaFile} onOpenChange={(v) => { if (!v && !metaSaving) closeMetaEdit(); }}>
    <DialogContent className="rounded-none border-[#e3e4e8] bg-white max-w-lg">
      <DialogHeader>
        <DialogTitle className="text-base font-light tracking-[0.15em]">编辑文件权限</DialogTitle>
        <DialogDescription className="text-xs text-[#9b9ea4] truncate">{metaFile?.displayName}</DialogDescription>
      </DialogHeader>
      <div className="space-y-5">
        <div className="space-y-2">
          <Label className="text-xs font-light tracking-[0.15em] text-[#85888e]">文件等级</Label>
          <Select value={metaLevel} onValueChange={(v) => setMetaLevel(v as FileLevel)}>
            <SelectTrigger className={`${fieldCls} text-xs`}><SelectValue /></SelectTrigger>
            <SelectContent>
              {FILE_LEVEL_OPTIONS.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-light tracking-[0.15em] text-[#85888e]">可查看人员</Label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setMetaVisibleTo(members.map((m) => m.name))} className="text-[11px] text-[#85888e] hover:text-[#1b1c1e]">全选</button>
              <span className="text-[#e3e4e8]">|</span>
              <button type="button" onClick={() => setMetaVisibleTo([])} className="text-[11px] text-[#85888e] hover:text-[#1b1c1e]">清空</button>
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto border border-[#e3e4e8] bg-white p-3">
            {members.length === 0 ? (
              <p className="text-xs text-[#9b9ea4]">暂无成员</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {members.map((m) => {
                  const checked = metaVisibleTo.includes(m.name);
                  return (
                    <label key={m.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleMetaMember(m.name)}
                        className="h-3.5 w-3.5 accent-[#1b1c1e]"
                      />
                      <span className="text-xs text-[#55585e]">
                        {m.name}
                        {m.department && <span className="ml-1 text-[10px] text-[#9b9ea4]">（{m.department}）</span>}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
          <p className="text-[10px] text-[#9b9ea4]">留空表示不限；勾选后仅选中成员可查看该文件</p>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" className={btnGhost} onClick={closeMetaEdit} disabled={metaSaving}>取消</Button>
        <Button onClick={handleSaveMeta} disabled={metaSaving} className={btnSolid}>{metaSaving ? '保存中…' : '保存'}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  {/* 邀请查看文件 Dialog */}
  <Dialog open={!!inviteFile} onOpenChange={(v) => { if (!inviteSaving && !v) { setInviteFile(null); setInviteSelected([]); } }}>
    <DialogContent className="rounded-none border-[#e3e4e8] bg-white max-w-lg">
      <DialogHeader>
        <DialogTitle className="text-base font-light tracking-[0.15em]">邀请查看</DialogTitle>
        <DialogDescription className="text-xs text-[#9b9ea4] truncate">
          {inviteFile?.displayName}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-[#85888e]">选择要邀请的成员</Label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setInviteSelected(members.map((m) => m.name))}
              className="text-[11px] text-[#85888e] hover:text-[#1b1c1e]"
            >
              全选
            </button>
            <span className="text-[#e3e4e8]">|</span>
            <button
              type="button"
              onClick={() => setInviteSelected([])}
              className="text-[11px] text-[#85888e] hover:text-[#1b1c1e]"
            >
              清空
            </button>
          </div>
        </div>

        <div className="max-h-64 overflow-y-auto border border-[#e3e4e8] bg-white p-3">
          {members.length === 0 ? (
            <p className="text-xs text-[#9b9ea4]">暂无成员</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {members.map((m) => {
                const checked = inviteSelected.includes(m.name);
                return (
                  <label key={m.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setInviteSelected((prev) =>
                          prev.includes(m.name) ? prev.filter((x) => x !== m.name) : [...prev, m.name]
                        )
                      }
                      className="h-3.5 w-3.5 accent-[#1b1c1e]"
                    />
                    <span className="text-xs text-[#55585e]">
                      {m.name}
                      {m.department && <span className="ml-1 text-[10px] text-[#9b9ea4]">（{m.department}）</span>}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
        <p className="text-[10px] text-[#9b9ea4]">
          被邀请成员会收到一条邀请通知，选择接受后即可查看该文件。
        </p>
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          className={btnGhost}
          onClick={() => { setInviteFile(null); setInviteSelected([]); }}
          disabled={inviteSaving}
        >
          取消
        </Button>
        <Button
          className={btnSolid}
          disabled={inviteSaving || inviteSelected.length === 0}
          onClick={handleSendInvites}
        >
          {inviteSaving ? '发送中…' : `发送邀请（${inviteSelected.length}）`}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  {/* 编辑行动档案 Dialog */}
  <Dialog open={editActionOpen} onOpenChange={(v) => { if (!eaSaving) { setEditActionOpen(v); if (!v) setEditingAction(null); } }}>
    <DialogContent className="rounded-none border-[#e3e4e8] bg-white max-w-xl">
      <DialogHeader>
        <DialogTitle className="text-base font-light tracking-[0.15em]">编辑行动档案</DialogTitle>
        <DialogDescription className="text-xs text-[#9b9ea4]">
          编号 {editingAction?.code}（不可修改）
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 max-h-[70vh] overflow-y-auto">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-xs text-[#85888e]">行动代号 *</Label>
            <Input value={eaCodename} onChange={(e) => setEaCodename(e.target.value)} className={fieldCls} />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-[#85888e]">时间 *</Label>
            <Input type="datetime-local" value={eaTime} onChange={(e) => setEaTime(e.target.value)} className={fieldCls} />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-[#85888e]">小组 *</Label>
          <Input
            value={eaTeam}
            onChange={(e) => setEaTeam(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
            className={`${fieldCls} font-mono`}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-xs text-[#85888e]">空中支援</Label>
            <div className="flex items-center gap-2 h-9">
              <button
                type="button"
                onClick={() => setEaAir(!eaAir)}
                className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${eaAir ? 'bg-[#1b1c1e]' : 'bg-[#d4d6da]'}`}
              >
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all duration-200 ${eaAir ? 'left-[18px]' : 'left-0.5'}`} />
              </button>
              <span className="text-xs text-[#55585e]">{eaAir ? '有' : '无'}</span>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-[#85888e]">信息支援</Label>
            <div className="flex items-center gap-2 h-9">
              <button
                type="button"
                onClick={() => setEaInfo(!eaInfo)}
                className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${eaInfo ? 'bg-[#1b1c1e]' : 'bg-[#d4d6da]'}`}
              >
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all duration-200 ${eaInfo ? 'left-[18px]' : 'left-0.5'}`} />
              </button>
              <span className="text-xs text-[#55585e]">{eaInfo ? '有' : '无'}</span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-[#85888e]">简介</Label>
          <textarea
            value={eaDesc}
            onChange={(e) => setEaDesc(e.target.value)}
            rows={4}
            className="w-full rounded-none border border-[#e3e4e8] bg-white px-3 py-2 text-xs font-light text-[#1b1c1e] placeholder:text-[#b9bcc2] focus:border-[#1b1c1e] focus:outline-none"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-[#85888e]">档案等级</Label>
          <Select value={eaLevel} onValueChange={(v) => setEaLevel(v as ActionLevel)}>
            <SelectTrigger className={`${fieldCls} text-xs`}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="public">公开 - 所有综合防务部成员可见</SelectItem>
              <SelectItem value="confidential">机密 - 仅指定人员可见</SelectItem>
              <SelectItem value="secret">绝密 - 仅管理员可见</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {eaLevel === 'confidential' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-[#85888e]">可查看人员</Label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setEaVisibleTo(members.map((m) => m.user_id))} className="text-[11px] text-[#85888e] hover:text-[#1b1c1e]">全选</button>
                <span className="text-[#e3e4e8]">|</span>
                <button type="button" onClick={() => setEaVisibleTo([])} className="text-[11px] text-[#85888e] hover:text-[#1b1c1e]">清空</button>
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto border border-[#e3e4e8] bg-white p-3">
              {members.map((m) => {
                const checked = eaVisibleTo.includes(m.user_id);
                return (
                  <label key={m.id} className="flex items-center gap-2 cursor-pointer py-1">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setEaVisibleTo((prev) =>
                          prev.includes(m.user_id) ? prev.filter((x) => x !== m.user_id) : [...prev, m.user_id]
                        )
                      }
                      className="h-3.5 w-3.5 accent-[#1b1c1e]"
                    />
                    <span className="text-xs text-[#55585e]">
                      {m.name}
                      {m.department && <span className="ml-1 text-[10px] text-[#9b9ea4]">（{m.department}）</span>}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {eaMsg && <p className="text-xs text-red-500">{eaMsg}</p>}
      </div>

      <DialogFooter>
        <Button variant="outline" className={btnGhost} onClick={() => setEditActionOpen(false)} disabled={eaSaving}>取消</Button>
        <Button onClick={handleSaveActionEdit} disabled={eaSaving} className={btnSolid}>
          {eaSaving ? '保存中…' : '保存'}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  {/* 邀请查看行动档案 Dialog */}
  <Dialog
    open={!!inviteActionFile}
    onOpenChange={(v) => { if (!inviteActionSaving && !v) { setInviteActionFile(null); setInviteActionSelected([]); } }}
  >
    <DialogContent className="rounded-none border-[#e3e4e8] bg-white max-w-lg">
      <DialogHeader>
        <DialogTitle className="text-base font-light tracking-[0.15em]">邀请查看行动档案</DialogTitle>
        <DialogDescription className="text-xs text-[#9b9ea4] truncate">
          {inviteActionFile?.code} · {inviteActionFile?.codename}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-[#85888e]">选择要邀请的成员</Label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setInviteActionSelected(members.map((m) => m.user_id))}
              className="text-[11px] text-[#85888e] hover:text-[#1b1c1e]"
            >
              全选
            </button>
            <span className="text-[#e3e4e8]">|</span>
            <button
              type="button"
              onClick={() => setInviteActionSelected([])}
              className="text-[11px] text-[#85888e] hover:text-[#1b1c1e]"
            >
              清空
            </button>
          </div>
        </div>

        <div className="max-h-64 overflow-y-auto border border-[#e3e4e8] bg-white p-3">
          {members.length === 0 ? (
            <p className="text-xs text-[#9b9ea4]">暂无成员</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {members
                .filter((m) => {
                  const depts = (m.department ?? '').split(/[,，;；]/).map((s) => s.trim()).filter(Boolean);
                  return depts.includes('综合防务部');
                })
                .map((m) => {
                  const checked = inviteActionSelected.includes(m.user_id);
                  return (
                    <label key={m.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setInviteActionSelected((prev) =>
                            prev.includes(m.user_id) ? prev.filter((x) => x !== m.user_id) : [...prev, m.user_id]
                          )
                        }
                        className="h-3.5 w-3.5 accent-[#1b1c1e]"
                      />
                      <span className="text-xs text-[#55585e]">
                        {m.name}
                        {m.department && <span className="ml-1 text-[10px] text-[#9b9ea4]">（{m.department}）</span>}
                      </span>
                    </label>
                  );
                })}
            </div>
          )}
        </div>
        <p className="text-[10px] text-[#9b9ea4]">
          仅列出综合防务部成员。被邀请成员会收到邀请通知，接受后即可查看该档案。
        </p>
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          className={btnGhost}
          onClick={() => { setInviteActionFile(null); setInviteActionSelected([]); }}
          disabled={inviteActionSaving}
        >
          取消
        </Button>
        <Button
          className={btnSolid}
          disabled={inviteActionSaving || inviteActionSelected.length === 0}
          onClick={async () => {
            if (!inviteActionFile) return;
            const invitees = members
              .filter((m) => inviteActionSelected.includes(m.user_id))
              .map((m) => ({ userId: m.user_id, name: m.name }));
            if (invitees.length === 0) { alert('请至少选择一位邀请对象'); return; }
            setInviteActionSaving(true);
            try {
              const res = await callAuthenticatedApi('/api/actions/invite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ actionId: inviteActionFile.id, invitees }),
              });
              if (!res || !res.ok) {
                const d = await res?.json().catch(() => ({}));
                throw new Error(d.error || '邀请失败');
              }
              alert(`已向 ${invitees.length} 位成员发送邀请`);
              setInviteActionFile(null);
              setInviteActionSelected([]);
              await loadActionInvites();
            } catch (err) {
              alert(err instanceof Error ? err.message : '邀请失败');
            } finally {
              setInviteActionSaving(false);
            }
          }}
        >
          {inviteActionSaving ? '发送中…' : `发送邀请（${inviteActionSelected.length}）`}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  {/* 回复反馈 Dialog */}
  <Dialog open={!!replyingFeedback} onOpenChange={(v) => { if (!replySaving && !v) { setReplyingFeedback(null); setReplyText(''); } }}>
    <DialogContent className="rounded-none border-[#e3e4e8] bg-white max-w-lg">
      <DialogHeader>
        <DialogTitle className="text-base font-light tracking-[0.15em]">回复反馈</DialogTitle>
        <DialogDescription className="text-xs text-[#9b9ea4] truncate">
          {replyingFeedback?.name || replyingFeedback?.email || '匿名用户'} · {replyingFeedback ? new Date(replyingFeedback.created_at).toLocaleString('zh-CN') : ''}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="border border-[#e3e4e8] bg-[#fafbfc] p-4">
          <p className="text-[10px] tracking-[0.2em] text-[#9b9ea4]">反馈内容</p>
          <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-6 text-[#1b1c1e]">{replyingFeedback?.content}</p>
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-[#85888e]">回复内容</Label>
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            rows={5}
            placeholder="输入回复内容…"
            className="w-full rounded-none border border-[#e3e4e8] bg-white px-3 py-2 text-xs font-light text-[#1b1c1e] focus:border-[#1b1c1e] focus:outline-none"
          />
          <p className="text-[10px] text-[#9b9ea4]">回复后，反馈状态会自动变为「已解决」</p>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" className={btnGhost} onClick={() => { setReplyingFeedback(null); setReplyText(''); }} disabled={replySaving}>取消</Button>
        <Button onClick={handleSubmitReply} disabled={replySaving} className={btnSolid}>{replySaving ? '发送中…' : '发送回复'}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  {/* 文件预览 Dialog */}
  <Dialog open={!!previewFile} onOpenChange={(v) => { if (!v) closePreview(); }}>
    <DialogContent className="rounded-none border-[#e3e4e8] bg-white max-w-4xl">
      <DialogHeader>
        <DialogTitle className="text-base font-light tracking-[0.15em] truncate pr-6">{previewFile?.displayName}</DialogTitle>
        <DialogDescription className="text-xs text-[#9b9ea4]">
          {previewFile ? `${formatSize(previewFile.size)} · 上传者 ${resolveDisplayName(previewFile.uploaderName)}` : ''}
        </DialogDescription>
      </DialogHeader>
      <div className="max-h-[70vh] overflow-auto bg-[#f5f6f7] border border-[#e3e4e8] flex items-center justify-center">
        {previewFile && previewKind === 'image' && (
          <img src={`/api/files/download?id=${previewFile.id}`} alt={previewFile.displayName} className="max-w-full max-h-[70vh] object-contain" />
        )}
        {previewFile && previewKind === 'pdf' && (
          <iframe src={`/api/files/download?id=${previewFile.id}`} className="w-full h-[70vh] bg-white" title={previewFile.displayName} />
        )}
        {previewFile && previewKind === 'video' && (
          <video src={`/api/files/download?id=${previewFile.id}`} controls className="max-w-full max-h-[70vh]" />
        )}
        {previewFile && previewKind === 'audio' && (
          <div className="w-full p-8">
            <audio src={`/api/files/download?id=${previewFile.id}`} controls className="w-full" />
          </div>
        )}
        {previewFile && previewKind === 'text' && (
          <div className="w-full bg-white p-5">
            {previewTextLoading ? (
              <p className="text-xs text-[#9b9ea4]">加载中…</p>
            ) : (
              <pre className="whitespace-pre-wrap break-words text-xs leading-6 text-[#1b1c1e] font-mono">
                {previewText || '（空文件）'}
              </pre>
            )}
          </div>
        )}
      </div>
      <DialogFooter>
        <button onClick={() => previewFile && handleDownload(previewFile)} className={`${btnGhost} inline-flex items-center border px-3 py-1.5`}>
          下载原文件
        </button>
        <Button variant="outline" className={btnGhost} onClick={closePreview}>关闭</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</div>
);
}