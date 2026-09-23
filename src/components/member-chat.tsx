'use client';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { callAuthenticatedApi } from '@/lib/auth-client';
import type { MeResponse, Message, InternalMember } from '@/lib/types';

/** 拆分部门 / 职位字符串：支持中英文逗号、分号 */
function splitDepts(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return raw
    .split(/[,，;；]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 把部门+职位解析成 [{dept, title}] 数组（一一对应） */
function parseDeptTitlePairs(m: { department?: string | null; title?: string | null }): { dept: string; title: string }[] {
  const depts = splitDepts(m.department);
  const titles = splitDepts(m.title);
  if (depts.length === 0) return [];
  return depts.map((dept, i) => ({
    dept,
    title: titles[i] ?? titles[0] ?? '成员',
  }));
}

/** 生成「部门1：职位1\n部门2：职位2」格式的文本 */
function formatDeptTitleMultiLine(m: { department?: string | null; title?: string | null; role?: string }): string {
  const pairs = parseDeptTitlePairs(m);
  if (pairs.length === 0) {
    return m.role === 'admin' ? '管理员' : '成员';
  }
  return pairs.map((p) => `${p.dept}：${p.title}`).join('\n');
}

/** 单行版本（用于副标题、截断场景）：多部门时用「部门1：职位1 / 部门2：职位2」 */
function formatDeptTitleSingleLine(m: { department?: string | null; title?: string | null; role?: string }): string {
  const pairs = parseDeptTitlePairs(m);
  if (pairs.length === 0) {
    return m.role === 'admin' ? '管理员' : '成员';
  }
  return pairs.map((p) => `${p.dept}：${p.title}`).join(' / ');
}

export function MemberChat({ me }: { me: MeResponse }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messageCacheRef = useRef<Record<string, Message[]>>({});
  const activeIdRef = useRef<string | null>(null);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeMemberName, setActiveMemberName] = useState('');
  const [members, setMembers] = useState<InternalMember[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const myUserId = me?.member?.user_id ?? '';
  const myName = me?.member?.name ?? '我';
  const myDepts = splitDepts(me?.member?.department);

  const downloadFile = async (url: string, filename: string) => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('下载失败');
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename || 'file';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, '_blank');
    }
  };

  const compressImage = async (file: File, maxWidth = 1280, quality = 0.75): Promise<File> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.src = url;
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement('canvas');
        let width = img.width, height = img.height;
        if (width > maxWidth) {
          const ratio = maxWidth / width;
          width = maxWidth;
          height = height * ratio;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas不支持'));
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error('图片压缩失败'));
            resolve(new File([blob], file.name, { type: file.type, lastModified: Date.now() }));
          },
          file.type,
          quality
        );
      };
      img.onerror = () => reject(new Error('图片加载失败'));
    });
  };

  const mergeMessages = (serverMsgs: Message[], localMsgs: Message[]): Message[] => {
    const map = new Map<string, Message>();
    serverMsgs.forEach((m) => map.set(m.id, m));
    localMsgs.forEach((m) => { if (!map.has(m.id)) map.set(m.id, m); });
    return Array.from(map.values()).sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  };

  const loadMembers = async () => {
    try {
      const res = await callAuthenticatedApi('/api/members?include_admin=1');
      if (res && res.ok) {
        const data = await res.json();
        const all = (data.members as InternalMember[]) ?? [];
        const filtered = all.filter((m) => {
          if (m.user_id === myUserId) return false;
          const mDepts = splitDepts(m.department);
          if (mDepts.length === 0 || myDepts.length === 0) return false;
          return mDepts.some((d) => myDepts.includes(d));
        });
        setMembers(filtered);
      }
    } catch (e) { console.error('加载成员失败', e); }
  };

  const loadMessages = async (withId: string, isInitial = false) => {
    if (withId !== activeIdRef.current) return;
    if (isInitial) setInitialLoading(true);
    try {
      const res = await callAuthenticatedApi(`/api/member-chat?receiver_id=${withId}`);
      if (res && res.ok && withId === activeIdRef.current) {
        const data = await res.json();
        const incoming = data.messages ?? [];
        if (isInitial) {
          setMessages(incoming);
          messageCacheRef.current[withId] = incoming;
        } else {
          setMessages((prev) => {
            const merged = mergeMessages(incoming, prev);
            messageCacheRef.current[withId] = merged;
            return merged;
          });
        }
      }
    } catch (e) { console.error('加载消息失败'); }
    if (isInitial && withId === activeIdRef.current) setInitialLoading(false);
  };

  const handleSend = async () => {
    if (!activeId || !input.trim() || sending) return;
    setSending(true);
    const tempId = 'temp-' + Date.now();
    const temp: Message = {
      id: tempId, sender_id: myUserId, receiver_id: activeId,
      content: input.trim(), created_at: new Date().toISOString(),
    };
    const content = input.trim();
    setInput('');
    setMessages((prev) => [...prev, temp]);
    try {
      const res = await callAuthenticatedApi('/api/member-chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiver_id: activeId, content, file_url: null, file_name: null, file_size: null, file_mime: null }),
      });
      if (!res || !res.ok) {
        const err = await res?.json().catch(() => ({}));
        alert(err.error || '发送失败');
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        return;
      }
      const d = await res.json();
      if (d.message || d.id) {
        const realMsg = d.message || d;
        setMessages((prev) => {
          const next = prev.map((m) => (m.id === tempId ? realMsg : m));
          if (activeIdRef.current) messageCacheRef.current[activeIdRef.current] = next;
          return next;
        });
      }
    } catch {
      alert('网络异常，请稍后重试');
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setSending(false);
    }
  };

  const uploadAndSendFile = async () => {
    if (!selectedFile || !activeId) return;
    const MAX_SIZE = 10 * 1024 * 1024;
    let uploadFile = selectedFile;
    if (selectedFile.type.startsWith('image/')) {
      try { uploadFile = await compressImage(selectedFile); } catch { console.warn('压缩失败，用原图'); }
    }
    if (uploadFile.size > MAX_SIZE) { alert('文件不能超过10MB'); return; }
    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      const res = await callAuthenticatedApi('/api/upload-chat-file', { method: 'POST', body: formData });
      if (!res || !res.ok) {
        const json = await res?.json().catch(() => ({}));
        throw new Error(json.error || '上传失败');
      }
      const json = await res.json();
      const msgRes = await callAuthenticatedApi('/api/member-chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiver_id: activeId, content: null,
          file_url: json.publicUrl, file_name: json.fileName, file_size: json.fileSize, file_mime: json.fileMime,
        }),
      });
      if (!msgRes || !msgRes.ok) {
        const e = await msgRes?.json().catch(() => ({}));
        throw new Error(e.error || '发送失败');
      }
      setSelectedFile(null);
      loadMessages(activeId, true);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUploadingFile(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  };

  const getLastPreview = (userId: string) => {
    const msgs = messageCacheRef.current[userId];
    if (!msgs || msgs.length === 0) return '';
    const last = msgs[msgs.length - 1];
    if (last.content) return last.content.length > 20 ? last.content.slice(0, 20) + '…' : last.content;
    if (last.file_mime?.startsWith('image/')) return '[图片]';
    return '[文件]';
  };

  const handleSelectMember = (member: InternalMember) => {
    if (sending || uploadingFile) return;
    setActiveId(member.user_id);
    activeIdRef.current = member.user_id;
    setActiveMemberName(member.name);
    const cached = messageCacheRef.current[member.user_id];
    setMessages(cached ?? []);
    loadMessages(member.user_id, true);
  };

  const getSenderName = (senderId: string) => {
    if (senderId === myUserId) return myName;
    return members.find((m) => m.user_id === senderId)?.name ?? '成员';
  };

  useEffect(() => { loadMembers(); }, [myUserId]);

  useEffect(() => {
    if (!activeId) return;
    const t = setInterval(() => loadMessages(activeId, false), 2500);
    return () => clearInterval(t);
  }, [activeId]);

  useEffect(() => {
    const el = messagesContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const hasCache = activeId ? !!messageCacheRef.current[activeId] : false;
  const allMembersForRight = [me.member, ...members].filter(Boolean) as InternalMember[];

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-light tracking-[0.25em] text-[#1b1c1e]">内部聊天</h2>

      <div className="flex h-[620px] overflow-hidden border border-[#e3e4e8] bg-[#f5f6f7]">
        {/* ===== 左栏：联系人 ===== */}
        <div className="flex w-56 shrink-0 flex-col border-r border-[#e3e4e8] bg-white">
          <div className="border-b border-[#e3e4e8] px-4 py-3">
            <p className="text-xs font-light tracking-[0.15em] text-[#85888e]">联系人（{members.length}）</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {members.length === 0 && (
              <p className="px-4 py-6 text-center text-xs font-light text-[#b9bcc2]">暂无同部门成员</p>
            )}
            {members.map((m) => {
              const isActive = activeId === m.user_id;
              return (
                <button
                  key={m.id}
                  onClick={() => handleSelectMember(m)}
                  disabled={sending || uploadingFile}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors disabled:cursor-not-allowed ${
                    isActive ? 'bg-[#1b1c1e] text-white' : 'hover:bg-[#f0f1f3]'
                  }`}
                >
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-light ${
                    isActive ? 'bg-white/15 text-white' : 'bg-[#f0f1f3] text-[#55585e]'
                  }`}>
                    {m.name.slice(0, 1)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-xs font-medium ${isActive ? 'text-white' : 'text-[#1b1c1e]'}`}>{m.name}</p>
                    <p className={`truncate text-[10px] ${isActive ? 'text-white/60' : 'text-[#9b9ea4]'}`}>
                      {getLastPreview(m.user_id) || formatDeptTitleSingleLine(m)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ===== 中栏：聊天区域 ===== */}
        <div className="flex flex-1 flex-col bg-[#f5f6f7]">
          {activeId ? (
            <>
              <div className="flex items-center justify-between border-b border-[#e3e4e8] bg-white px-5 py-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-medium text-[#1b1c1e] shrink-0">{activeMemberName}</span>
                  <span className="text-[10px] text-[#9b9ea4] truncate">
                    {(() => {
                      const m = members.find((x) => x.user_id === activeId);
                      return m ? formatDeptTitleSingleLine(m) : '成员';
                    })()}
                  </span>
                </div>
              </div>

              <div ref={messagesContainerRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
                {messages.length === 0 && (
                  <p className="pt-16 text-center text-xs font-light text-[#b9bcc2]">
                    {initialLoading ? (hasCache ? '刷新中…' : '加载中…') : `开始和 ${activeMemberName} 对话`}
                  </p>
                )}
                {messages.map((msg) => {
                  const isMine = msg.sender_id === myUserId;
                  const senderName = getSenderName(msg.sender_id);
                  return (
                    <div key={msg.id} className={`flex gap-2.5 ${isMine ? 'flex-row-reverse' : ''}`}>
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-xs font-light text-[#55585e] ring-1 ring-[#e3e4e8]">
                        {senderName.slice(0, 1)}
                      </div>
                      <div className={`flex max-w-[60%] flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                        <p className={`mb-1 text-[10px] text-[#9b9ea4]`}>{isMine ? '我' : senderName}</p>
                        <div className={`rounded-lg px-3 py-2 text-xs font-light leading-5 ${
                          isMine ? 'bg-[#1b1c1e] text-[#f5f6f7]' : 'bg-white text-[#1b1c1e] ring-1 ring-[#e3e4e8]'
                        }`}>
                          {msg.content && <p className="whitespace-pre-wrap break-words">{msg.content}</p>}
                          {msg.file_url && (
                            <div className="mt-1">
                              {msg.file_mime?.startsWith('image/') ? (
                                <img
                                  src={msg.file_url}
                                  alt={msg.file_name || ''}
                                  className="h-auto max-w-[200px] cursor-pointer rounded object-cover transition hover:opacity-90"
                                  style={{ maxHeight: '200px' }}
                                  loading="lazy"
                                  onClick={() => setPreviewImageUrl(msg.file_url!)}
                                />
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className="flex items-center gap-1">📄 {msg.file_name}</span>
                                  <button
                                    type="button"
                                    onClick={() => downloadFile(msg.file_url!, msg.file_name || 'file')}
                                    className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] underline transition ${
                                      isMine ? 'text-white/70 hover:text-white' : 'text-[#55585e] hover:text-[#1b1c1e]'
                                    }`}
                                  >下载</button>
                                </div>
                              )}
                              {msg.file_size && <p className="mt-1 text-[10px] opacity-60">{formatFileSize(msg.file_size)}</p>}
                            </div>
                          )}
                        </div>
                        <p className={`mt-1 text-[10px] text-[#b9bcc2]`}>
                          {new Date(msg.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-[#e3e4e8] bg-white">
                <div className="flex items-center gap-2 px-4 py-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) setSelectedFile(f); }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={sending || uploadingFile || !activeId}
                    className="shrink-0 text-base"
                  >📎</Button>
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder={initialLoading && !hasCache ? '加载中…' : `发送消息给 ${activeMemberName}...`}
                    disabled={sending || uploadingFile}
                    className="rounded-none border-[#e3e4e8] bg-white text-xs font-light placeholder:text-[#b9bcc2] focus-visible:border-[#1b1c1e] focus-visible:ring-[#1b1c1e]/15 disabled:opacity-50"
                  />
                  {selectedFile ? (
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="max-w-[80px] truncate text-xs">{selectedFile.name}</span>
                      <Button onClick={uploadAndSendFile} disabled={uploadingFile || sending} className="rounded-none bg-[#1b1c1e] text-xs text-white hover:bg-[#3a3c40]">
                        {uploadingFile ? '上传中' : '发送'}
                      </Button>
                      <Button variant="ghost" onClick={() => setSelectedFile(null)}>✕</Button>
                    </div>
                  ) : (
                    <Button
                      onClick={handleSend}
                      disabled={sending || !input.trim() || !activeId}
                      className="rounded-none bg-[#1b1c1e] text-xs text-white hover:bg-[#3a3c40] disabled:opacity-40"
                    >{sending ? '发送中…' : '发送'}</Button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-xs font-light text-[#9b9ea4]">
              点击左侧联系人开始对话
            </div>
          )}
        </div>

        {/* ===== 右栏：同部门成员 ===== */}
        <div className="flex w-44 shrink-0 flex-col border-l border-[#e3e4e8] bg-white">
          <div className="border-b border-[#e3e4e8] px-4 py-3">
            <p className="text-xs font-light tracking-[0.15em] text-[#85888e]">同部门（{allMembersForRight.length}）</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {allMembersForRight.map((m) => (
              <div key={m.id} className="flex items-start gap-2 px-4 py-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f0f1f3] text-[11px] font-light text-[#55585e]">
                  {m.name.slice(0, 1)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-[#1b1c1e]">
                    {m.name}
                    {m.user_id === myUserId && <span className="ml-1 text-[9px] text-[#9b9ea4]">（我）</span>}
                  </p>
                  <p className="whitespace-pre-line text-[10px] leading-4 text-[#9b9ea4]">
                    {formatDeptTitleMultiLine(m)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {previewImageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreviewImageUrl(null)}
        >
          <img src={previewImageUrl} alt="预览大图" className="max-h-[90vh] max-w-[90vw] rounded object-contain" />
          <button className="absolute right-4 top-4 text-2xl text-white" onClick={() => setPreviewImageUrl(null)}>✕</button>
        </div>
      )}
    </section>
  );
}