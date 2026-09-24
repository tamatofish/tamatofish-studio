import { createClient, SupabaseClient } from '@supabase/supabase-js';

/* ==================== 客户端 ==================== */

let _client: SupabaseClient | null = null;
function getClient(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('缺少 Supabase 环境变量');
  }
  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}

/* ==================== 文件 ==================== */

export type FileStatus = 'pending' | 'approved' | 'rejected';
export type FileLevel = 'public' | 'internal' | 'confidential' | 'secret';

export interface FileRecord {
  id: string;
  name: string;
  displayName: string;
  code: string;
  size: number;
  mimeType: string;
  uploaderId: string;
  uploaderName: string;
  uploadedAt: number;
  status: FileStatus;
  reviewedBy?: string;
  reviewedAt?: number;
  rejectReason?: string;
  storagePath: string;
  level: FileLevel;
  visibleTo: string[];
}

function rowToFile(r: any): FileRecord {
  return {
    id: r.id,
    name: r.name,
    displayName: r.display_name ?? r.name,
    code: r.code ?? '',
    size: Number(r.size ?? 0),
    mimeType: r.mime_type ?? '',
    uploaderId: r.uploader_id,
    uploaderName: r.uploader_name ?? '',
    uploadedAt: Number(r.uploaded_at ?? 0),
    status: r.status,
    reviewedBy: r.reviewed_by ?? undefined,
    reviewedAt: r.reviewed_at != null ? Number(r.reviewed_at) : undefined,
    rejectReason: r.reject_reason ?? undefined,
    storagePath: r.storage_path ?? '',
    level: r.level ?? 'internal',
    visibleTo: r.visible_to ?? [],
  };
}

function fileToRow(f: FileRecord) {
  return {
    id: f.id,
    name: f.name,
    display_name: f.displayName,
    code: f.code,
    size: f.size,
    mime_type: f.mimeType,
    uploader_id: f.uploaderId,
    uploader_name: f.uploaderName,
    uploaded_at: f.uploadedAt,
    status: f.status,
    reviewed_by: f.reviewedBy ?? null,
    reviewed_at: f.reviewedAt ?? null,
    reject_reason: f.rejectReason ?? null,
    storage_path: f.storagePath,
    level: f.level,
    visible_to: f.visibleTo,
  };
}

export async function readFiles(): Promise<FileRecord[]> {
  const { data, error } = await getClient()
    .from('files')
    .select('*')
    .order('uploaded_at', { ascending: false });
  if (error) throw new Error(`读取文件失败: ${error.message}`);
  return (data ?? []).map(rowToFile);
}

export async function addFile(record: FileRecord): Promise<void> {
  const { error } = await getClient().from('files').insert(fileToRow(record));
  if (error) throw new Error(`写入文件失败: ${error.message}`);
}

export async function updateFile(id: string, patch: Partial<FileRecord>): Promise<FileRecord | null> {
  const row: any = {};
  if (patch.displayName !== undefined) row.display_name = patch.displayName;
  if (patch.code !== undefined) row.code = patch.code;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.reviewedBy !== undefined) row.reviewed_by = patch.reviewedBy;
  if (patch.reviewedAt !== undefined) row.reviewed_at = patch.reviewedAt;
  if (patch.rejectReason !== undefined) row.reject_reason = patch.rejectReason;
  if (patch.level !== undefined) row.level = patch.level;
  if (patch.visibleTo !== undefined) row.visible_to = patch.visibleTo;
  if (Object.keys(row).length === 0) return null;

  const { data, error } = await getClient()
    .from('files')
    .update(row)
    .eq('id', id)
    .select()
    .maybeSingle();
  if (error) throw new Error(`更新文件失败: ${error.message}`);
  return data ? rowToFile(data) : null;
}

export async function deleteFile(id: string): Promise<FileRecord | null> {
  const { data, error } = await getClient()
    .from('files')
    .delete()
    .eq('id', id)
    .select()
    .maybeSingle();
  if (error) throw new Error(`删除文件失败: ${error.message}`);
  return data ? rowToFile(data) : null;
}

export async function generateFileCode(): Promise<string> {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}${mm}${dd}`;
  const prefix = `F-${dateStr}-`;

  const { data } = await getClient()
    .from('files')
    .select('code')
    .like('code', `${prefix}%`);
  let maxSeq = 0;
  for (const r of data ?? []) {
    const seq = parseInt(String(r.code).slice(prefix.length), 10);
    if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
  }
  const next = String(maxSeq + 1).padStart(3, '0');
  return `${prefix}${next}`;
}

/* ==================== 文件权限申请 ==================== */

export type RequestStatus = 'pending' | 'approved' | 'rejected';

export interface FileAccessRequest {
  id: string;
  fileId: string;
  fileCode: string;
  fileName: string;
  requesterId: string;
  requesterName: string;
  requesterMemberNo?: string;
  reason?: string;
  status: RequestStatus;
  createdAt: number;
  reviewedBy?: string;
  reviewedAt?: number;
}

function rowToFileReq(r: any): FileAccessRequest {
  return {
    id: r.id,
    fileId: r.file_id,
    fileCode: r.file_code ?? '',
    fileName: r.file_name ?? '',
    requesterId: r.requester_id,
    requesterName: r.requester_name ?? '',
    requesterMemberNo: r.requester_member_no ?? undefined,
    reason: r.reason ?? undefined,
    status: r.status,
    createdAt: Number(r.created_at_ms ?? 0),
    reviewedBy: r.reviewed_by ?? undefined,
    reviewedAt: r.reviewed_at != null ? Number(r.reviewed_at) : undefined,
  };
}

export async function readRequests(): Promise<FileAccessRequest[]> {
  const { data, error } = await getClient()
    .from('file_requests')
    .select('*')
    .order('created_at_ms', { ascending: false });
  if (error) throw new Error(`读取文件申请失败: ${error.message}`);
  return (data ?? []).map(rowToFileReq);
}

export async function addRequest(record: FileAccessRequest): Promise<void> {
  const { error } = await getClient().from('file_requests').insert({
    id: record.id,
    file_id: record.fileId,
    file_code: record.fileCode,
    file_name: record.fileName,
    requester_id: record.requesterId,
    requester_name: record.requesterName,
    requester_member_no: record.requesterMemberNo ?? null,
    reason: record.reason ?? null,
    status: record.status,
    created_at_ms: record.createdAt,
    reviewed_by: record.reviewedBy ?? null,
    reviewed_at: record.reviewedAt ?? null,
  });
  if (error) throw new Error(`写入文件申请失败: ${error.message}`);
}

export async function updateRequest(id: string, patch: Partial<FileAccessRequest>): Promise<FileAccessRequest | null> {
  const row: any = {};
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.reviewedBy !== undefined) row.reviewed_by = patch.reviewedBy;
  if (patch.reviewedAt !== undefined) row.reviewed_at = patch.reviewedAt;
  if (Object.keys(row).length === 0) return null;
  const { data, error } = await getClient()
    .from('file_requests')
    .update(row)
    .eq('id', id)
    .select()
    .maybeSingle();
  if (error) throw new Error(`更新文件申请失败: ${error.message}`);
  return data ? rowToFileReq(data) : null;
}

/* ==================== 文件查看邀请 ==================== */

export type InviteStatus = 'pending' | 'accepted' | 'declined';

export interface FileViewInvite {
  id: string;
  fileId: string;
  fileCode: string;
  fileName: string;
  inviteeId: string;
  inviteeName: string;
  inviteeEmail?: string;
  inviterName: string;
  status: InviteStatus;
  createdAt: number;
  respondedAt?: number;
}

function rowToFileInvite(r: any): FileViewInvite {
  return {
    id: r.id,
    fileId: r.file_id,
    fileCode: r.file_code ?? '',
    fileName: r.file_name ?? '',
    inviteeId: r.invitee_id,
    inviteeName: r.invitee_name ?? '',
    inviteeEmail: r.invitee_email ?? undefined,
    inviterName: r.inviter_name ?? '',
    status: r.status,
    createdAt: Number(r.created_at_ms ?? 0),
    respondedAt: r.responded_at != null ? Number(r.responded_at) : undefined,
  };
}

export async function readInvites(): Promise<FileViewInvite[]> {
  const { data, error } = await getClient()
    .from('file_invites')
    .select('*')
    .order('created_at_ms', { ascending: false });
  if (error) throw new Error(`读取文件邀请失败: ${error.message}`);
  return (data ?? []).map(rowToFileInvite);
}

export async function addInvite(record: FileViewInvite): Promise<void> {
  const { error } = await getClient().from('file_invites').insert({
    id: record.id,
    file_id: record.fileId,
    file_code: record.fileCode,
    file_name: record.fileName,
    invitee_id: record.inviteeId,
    invitee_name: record.inviteeName,
    invitee_email: record.inviteeEmail ?? null,
    inviter_name: record.inviterName,
    status: record.status,
    created_at_ms: record.createdAt,
    responded_at: record.respondedAt ?? null,
  });
  if (error) throw new Error(`写入文件邀请失败: ${error.message}`);
}

export async function updateInvite(id: string, patch: Partial<FileViewInvite>): Promise<FileViewInvite | null> {
  const row: any = {};
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.respondedAt !== undefined) row.responded_at = patch.respondedAt;
  if (Object.keys(row).length === 0) return null;
  const { data, error } = await getClient()
    .from('file_invites')
    .update(row)
    .eq('id', id)
    .select()
    .maybeSingle();
  if (error) throw new Error(`更新文件邀请失败: ${error.message}`);
  return data ? rowToFileInvite(data) : null;
}

/* ==================== 行动档案 ==================== */

export type ActionLevel = 'public' | 'confidential' | 'secret';

export interface ActionRecord {
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

function rowToAction(r: any): ActionRecord {
  return {
    id: r.id,
    code: r.code,
    codename: r.codename,
    actionTime: Number(r.action_time ?? 0),
    team: r.team ?? '',
    airSupport: !!r.air_support,
    infoSupport: !!r.info_support,
    description: r.description ?? '',
    level: r.level ?? 'secret',
    visibleTo: r.visible_to ?? [],
    creatorId: r.creator_id,
    creatorName: r.creator_name ?? '',
    createdAt: Number(r.created_at_ms ?? 0),
  };
}

export async function readActions(): Promise<ActionRecord[]> {
  const { data, error } = await getClient()
    .from('actions')
    .select('*')
    .order('created_at_ms', { ascending: false });
  if (error) throw new Error(`读取行动档案失败: ${error.message}`);
  return (data ?? []).map(rowToAction);
}

export async function writeActions(records: ActionRecord[]): Promise<void> {
  if (records.length === 0) return;
  const { error } = await getClient().from('actions').upsert(records.map((r) => ({
    id: r.id,
    code: r.code,
    codename: r.codename,
    action_time: r.actionTime,
    team: r.team,
    air_support: r.airSupport,
    info_support: r.infoSupport,
    description: r.description,
    level: r.level,
    visible_to: r.visibleTo,
    creator_id: r.creatorId,
    creator_name: r.creatorName,
    created_at_ms: r.createdAt,
  })));
  if (error) throw new Error(`写入行动档案失败: ${error.message}`);
}

export async function addAction(record: ActionRecord): Promise<void> {
  const { error } = await getClient().from('actions').insert({
    id: record.id,
    code: record.code,
    codename: record.codename,
    action_time: record.actionTime,
    team: record.team,
    air_support: record.airSupport,
    info_support: record.infoSupport,
    description: record.description,
    level: record.level,
    visible_to: record.visibleTo,
    creator_id: record.creatorId,
    creator_name: record.creatorName,
    created_at_ms: record.createdAt,
  });
  if (error) throw new Error(`写入行动档案失败: ${error.message}`);
}

export async function deleteAction(id: string): Promise<boolean> {
  const { error, count } = await getClient()
    .from('actions')
    .delete({ count: 'exact' })
    .eq('id', id);
  if (error) throw new Error(`删除行动档案失败: ${error.message}`);
  return (count ?? 0) > 0;
}

export function generateActionCode(actionTime: number): string {
  const d = new Date(actionTime);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const rand = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
  return `DEC${yyyy}${mm}${dd}${rand}`;
}

/* ==================== 行动档案查看邀请 ==================== */

export type ActionInviteStatus = 'pending' | 'accepted' | 'declined';

export interface ActionViewInvite {
  id: string;
  actionId: string;
  actionCode: string;
  actionCodename: string;
  inviteeId: string;
  inviteeName: string;
  inviterName: string;
  status: ActionInviteStatus;
  createdAt: number;
  respondedAt?: number;
}

function rowToActionInvite(r: any): ActionViewInvite {
  return {
    id: r.id,
    actionId: r.action_id,
    actionCode: r.action_code ?? '',
    actionCodename: r.action_codename ?? '',
    inviteeId: r.invitee_id,
    inviteeName: r.invitee_name ?? '',
    inviterName: r.inviter_name ?? '',
    status: r.status,
    createdAt: Number(r.created_at_ms ?? 0),
    respondedAt: r.responded_at != null ? Number(r.responded_at) : undefined,
  };
}

export async function readActionInvites(): Promise<ActionViewInvite[]> {
  const { data, error } = await getClient()
    .from('action_invites')
    .select('*')
    .order('created_at_ms', { ascending: false });
  if (error) throw new Error(`读取行动邀请失败: ${error.message}`);
  return (data ?? []).map(rowToActionInvite);
}

export async function writeActionInvites(records: ActionViewInvite[]): Promise<void> {
  if (records.length === 0) return;
  const { error } = await getClient().from('action_invites').upsert(records.map((r) => ({
    id: r.id,
    action_id: r.actionId,
    action_code: r.actionCode,
    action_codename: r.actionCodename,
    invitee_id: r.inviteeId,
    invitee_name: r.inviteeName,
    inviter_name: r.inviterName,
    status: r.status,
    created_at_ms: r.createdAt,
    responded_at: r.respondedAt ?? null,
  })));
  if (error) throw new Error(`写入行动邀请失败: ${error.message}`);
}

export async function addActionInvite(record: ActionViewInvite): Promise<void> {
  await writeActionInvites([record]);
}

export async function updateActionInvite(id: string, patch: Partial<ActionViewInvite>): Promise<ActionViewInvite | null> {
  const row: any = {};
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.respondedAt !== undefined) row.responded_at = patch.respondedAt;
  if (Object.keys(row).length === 0) return null;
  const { data, error } = await getClient()
    .from('action_invites')
    .update(row)
    .eq('id', id)
    .select()
    .maybeSingle();
  if (error) throw new Error(`更新行动邀请失败: ${error.message}`);
  return data ? rowToActionInvite(data) : null;
}

/* ==================== 行动档案查看申请 ==================== */

export type ActionAccessRequestStatus = 'pending' | 'approved' | 'rejected';

export interface ActionAccessRequest {
  id: string;
  actionId: string;
  actionCode: string;
  actionCodename: string;
  requesterId: string;
  requesterName: string;
  reason?: string;
  status: ActionAccessRequestStatus;
  createdAt: number;
  reviewedBy?: string;
  reviewedAt?: number;
}

function rowToActionReq(r: any): ActionAccessRequest {
  return {
    id: r.id,
    actionId: r.action_id,
    actionCode: r.action_code ?? '',
    actionCodename: r.action_codename ?? '',
    requesterId: r.requester_id,
    requesterName: r.requester_name ?? '',
    reason: r.reason ?? undefined,
    status: r.status,
    createdAt: Number(r.created_at_ms ?? 0),
    reviewedBy: r.reviewed_by ?? undefined,
    reviewedAt: r.reviewed_at != null ? Number(r.reviewed_at) : undefined,
  };
}

export async function readActionRequests(): Promise<ActionAccessRequest[]> {
  const { data, error } = await getClient()
    .from('action_requests')
    .select('*')
    .order('created_at_ms', { ascending: false });
  if (error) throw new Error(`读取行动申请失败: ${error.message}`);
  return (data ?? []).map(rowToActionReq);
}

export async function addActionRequest(record: ActionAccessRequest): Promise<void> {
  const { error } = await getClient().from('action_requests').insert({
    id: record.id,
    action_id: record.actionId,
    action_code: record.actionCode,
    action_codename: record.actionCodename,
    requester_id: record.requesterId,
    requester_name: record.requesterName,
    reason: record.reason ?? null,
    status: record.status,
    created_at_ms: record.createdAt,
    reviewed_by: record.reviewedBy ?? null,
    reviewed_at: record.reviewedAt ?? null,
  });
  if (error) throw new Error(`写入行动申请失败: ${error.message}`);
}

export async function updateActionRequest(id: string, patch: Partial<ActionAccessRequest>): Promise<ActionAccessRequest | null> {
  const row: any = {};
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.reviewedBy !== undefined) row.reviewed_by = patch.reviewedBy;
  if (patch.reviewedAt !== undefined) row.reviewed_at = patch.reviewedAt;
  if (Object.keys(row).length === 0) return null;
  const { data, error } = await getClient()
    .from('action_requests')
    .update(row)
    .eq('id', id)
    .select()
    .maybeSingle();
  if (error) throw new Error(`更新行动申请失败: ${error.message}`);
  return data ? rowToActionReq(data) : null;
}