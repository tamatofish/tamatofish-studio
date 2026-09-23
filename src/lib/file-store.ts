import fs from 'fs';
import path from 'path';

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

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'files.json');
const REQUEST_FILE = path.join(DATA_DIR, 'file-requests.json');
const INVITE_FILE = path.join(DATA_DIR, 'file-invites.json');
const ACTION_FILE = path.join(DATA_DIR, 'actions.json');
const ACTION_INVITE_FILE = path.join(DATA_DIR, 'action-invites.json');
const ACTION_REQUEST_FILE = path.join(DATA_DIR, 'action-requests.json');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

/* ==================== 文件 ==================== */

export function readFiles(): FileRecord[] {
  ensureDir();
  if (!fs.existsSync(DB_FILE)) return [];
  try {
    const list = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8')) as FileRecord[];
    return list.map((f) => ({
      ...f,
      displayName: f.displayName ?? f.name,
      code: f.code ?? '',
      level: f.level ?? 'internal',
      visibleTo: f.visibleTo ?? [],
    }));
  } catch {
    return [];
  }
}

export function writeFiles(records: FileRecord[]) {
  ensureDir();
  fs.writeFileSync(DB_FILE, JSON.stringify(records, null, 2), 'utf-8');
}

export function addFile(record: FileRecord) {
  const files = readFiles();
  files.unshift(record);
  writeFiles(files);
}

export function updateFile(id: string, patch: Partial<FileRecord>) {
  const files = readFiles();
  const idx = files.findIndex((f) => f.id === id);
  if (idx === -1) return null;
  files[idx] = { ...files[idx], ...patch };
  writeFiles(files);
  return files[idx];
}

export function deleteFile(id: string) {
  const files = readFiles();
  const target = files.find((f) => f.id === id);
  if (!target) return null;
  writeFiles(files.filter((f) => f.id !== id));
  if (fs.existsSync(target.storagePath)) {
    try { fs.unlinkSync(target.storagePath); } catch { /* ignore */ }
  }
  return target;
}

export function generateFileCode(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}${mm}${dd}`;
  const prefix = `F-${dateStr}-`;

  const existing = readFiles().filter((f) => f.code && f.code.startsWith(prefix));
  let maxSeq = 0;
  for (const f of existing) {
    const seq = parseInt(f.code.slice(prefix.length), 10);
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

export function readRequests(): FileAccessRequest[] {
  ensureDir();
  if (!fs.existsSync(REQUEST_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(REQUEST_FILE, 'utf-8')) as FileAccessRequest[];
  } catch {
    return [];
  }
}

export function writeRequests(records: FileAccessRequest[]) {
  ensureDir();
  fs.writeFileSync(REQUEST_FILE, JSON.stringify(records, null, 2), 'utf-8');
}

export function addRequest(record: FileAccessRequest) {
  const list = readRequests();
  list.unshift(record);
  writeRequests(list);
}

export function updateRequest(id: string, patch: Partial<FileAccessRequest>) {
  const list = readRequests();
  const idx = list.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  list[idx] = { ...list[idx], ...patch };
  writeRequests(list);
  return list[idx];
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

export function readInvites(): FileViewInvite[] {
  ensureDir();
  if (!fs.existsSync(INVITE_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(INVITE_FILE, 'utf-8')) as FileViewInvite[];
  } catch {
    return [];
  }
}

export function writeInvites(records: FileViewInvite[]) {
  ensureDir();
  fs.writeFileSync(INVITE_FILE, JSON.stringify(records, null, 2), 'utf-8');
}

export function addInvite(record: FileViewInvite) {
  const list = readInvites();
  list.unshift(record);
  writeInvites(list);
}

export function updateInvite(id: string, patch: Partial<FileViewInvite>) {
  const list = readInvites();
  const idx = list.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  list[idx] = { ...list[idx], ...patch };
  writeInvites(list);
  return list[idx];
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

export function readActions(): ActionRecord[] {
  ensureDir();
  if (!fs.existsSync(ACTION_FILE)) return [];
  try {
    const list = JSON.parse(fs.readFileSync(ACTION_FILE, 'utf-8')) as ActionRecord[];
    return list.map((a) => ({
      ...a,
      level: a.level ?? 'secret',
      visibleTo: a.visibleTo ?? [],
    }));
  } catch {
    return [];
  }
}

export function writeActions(records: ActionRecord[]) {
  ensureDir();
  fs.writeFileSync(ACTION_FILE, JSON.stringify(records, null, 2), 'utf-8');
}

export function addAction(record: ActionRecord) {
  const list = readActions();
  list.unshift(record);
  writeActions(list);
}

export function deleteAction(id: string) {
  const list = readActions();
  const next = list.filter((a) => a.id !== id);
  if (next.length === list.length) return null;
  writeActions(next);
  return true;
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

export function readActionInvites(): ActionViewInvite[] {
  ensureDir();
  if (!fs.existsSync(ACTION_INVITE_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(ACTION_INVITE_FILE, 'utf-8')) as ActionViewInvite[];
  } catch {
    return [];
  }
}

export function writeActionInvites(records: ActionViewInvite[]) {
  ensureDir();
  fs.writeFileSync(ACTION_INVITE_FILE, JSON.stringify(records, null, 2), 'utf-8');
}

export function addActionInvite(record: ActionViewInvite) {
  const list = readActionInvites();
  list.unshift(record);
  writeActionInvites(list);
}

export function updateActionInvite(id: string, patch: Partial<ActionViewInvite>) {
  const list = readActionInvites();
  const idx = list.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  list[idx] = { ...list[idx], ...patch };
  writeActionInvites(list);
  return list[idx];
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

export function readActionRequests(): ActionAccessRequest[] {
  ensureDir();
  if (!fs.existsSync(ACTION_REQUEST_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(ACTION_REQUEST_FILE, 'utf-8')) as ActionAccessRequest[];
  } catch {
    return [];
  }
}

export function writeActionRequests(records: ActionAccessRequest[]) {
  ensureDir();
  fs.writeFileSync(ACTION_REQUEST_FILE, JSON.stringify(records, null, 2), 'utf-8');
}

export function addActionRequest(record: ActionAccessRequest) {
  const list = readActionRequests();
  list.unshift(record);
  writeActionRequests(list);
}

export function updateActionRequest(id: string, patch: Partial<ActionAccessRequest>) {
  const list = readActionRequests();
  const idx = list.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  list[idx] = { ...list[idx], ...patch };
  writeActionRequests(list);
  return list[idx];
}