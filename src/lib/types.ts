export interface InternalMember {
  id: string;
  user_id: string;
  member_no: string | null;
  role: string;
  name: string;
  title: string | null;
  department: string | null;
  email: string | null;
  bio: string | null;
  status: string;
  show_on_homepage: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface Visitor {
  id: string;
  user_id: string;
  name: string;
  company: string | null;
  phone: string | null;
  interest: string | null;
  email: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface Inquiry {
  id: string;
  visitor_id: string;
  user_id: string;
  subject: string;
  message: string;
  contact: string | null;
  status: string;
  created_at: string;
  updated_at: string | null;
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string | null;
  created_at: string;
  file_url?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  file_mime?: string | null;
}

export interface GlobalNotice {
  id: string;
  content: string;
  created_at: string;
  created_by: string;
}

export interface GlobalNoticeRead {
  notice_id: string;
  user_id: string;
}

export interface DepartmentNotice {
  id: string;
  content: string;
  submitter_user_id: string;
  department: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  approved_at: string | null;
  approved_by: string | null;
}

export interface DepartmentNoticeRead {
  notice_id: string;
  user_id: string;
}

export type UserRole = 'internal' | 'visitor' | 'none';

export interface MeResponse {
  email: string;
  role: UserRole;
  member?: InternalMember | null;
  visitor?: Visitor | null;
}

export const INQUIRY_STATUS_MAP: Record<string, { label: string; className: string }> = {
  pending: { label: '待处理', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  contacted: { label: '已联系', className: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30' },
  closed: { label: '已关闭', className: 'bg-slate-500/15 text-slate-400 border-slate-500/30' },
};

export const INQUIRY_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'pending', label: '待处理' },
  { value: 'contacted', label: '已联系' },
  { value: 'closed', label: '已关闭' },
];
