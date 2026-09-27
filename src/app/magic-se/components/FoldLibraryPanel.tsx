'use client';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/app/magic-se/data/icons';
import type { PlacedNode, Connection, PortType } from '@/app/magic-se/data/nodeLibrary';

const GOLD = '#c8a96a';
const GOLD_SOFT = 'rgba(200,169,106,0.32)';
const MINT = '#6ba89a';
const MACRO_COLOR = '#a78bfa';

/* ==================== 对外类型 ==================== */

/** 引脚定义：宏/函数对外暴露的一个端口 */
export interface FoldPinDef {
  id: string;
  name: string;
  type: PortType;
  desc?: string;
  /** 定义内部：把外部连线"穿透"到内部的哪个节点哪个端口 */
  internalNodeId?: string;
  internalPortIndex?: number;
  /** 内部端口方向（用于穿透校验） */
  internalSide?: 'in' | 'out';
}

/** 宏 / 函数的定义（UE 里的"蓝图类" / "函数库"） */
export interface FoldDefinition {
  id: string;
  kind: 'macro' | 'function';
  name: string;
  desc: string;
  isPure?: boolean;
  inputs: FoldPinDef[];
  outputs: FoldPinDef[];
  nodes: PlacedNode[];
  connections: Connection[];
  createdAt: number;
  updatedAt: number;
}

/** 画布上的一个实例（引用某个定义） */
export interface FoldInstance {
  instanceId: string;
  definitionId: string;
}

/** 折叠前的对外连线快照（保留供将来展开使用） */
export interface FoldConnectionSnapshot {
  side: 'in' | 'out';
  portIndex: number;
  externalInstance: string;
  externalSide: 'in' | 'out';
  externalPort: number;
  type: PortType;
}

/* ==================== 组件 ==================== */

export default function FoldLibraryPanel({
  kind,
  definitions,
  instances,
  onFocus,
  onEdit,
  onEditPins,
  onRemove,
  onRename,
  onClose,
  zIndex = 355,
}: {
  kind: 'macro' | 'function';
  definitions: FoldDefinition[];
  instances: FoldInstance[];
  onFocus: (defId: string) => void;
  onEdit: (defId: string) => void;
  onEditPins: (defId: string) => void;
  onRemove: (defId: string) => void;
  onRename: (defId: string, newName: string) => void;
  onClose: () => void;
  zIndex?: number;
}) {
  const [show, setShow] = useState(false);
  const [search, setSearch] = useState('');
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; def: FoldDefinition } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');

  useEffect(() => {
    const id = requestAnimationFrame(() => setShow(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const close = () => setCtxMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  const close = () => {
    setShow(false);
    setTimeout(onClose, 180);
  };

  const isMacro = kind === 'macro';
  const title = isMacro ? '宏库' : '函数库';
  const accent = isMacro ? MACRO_COLOR : GOLD;
  const desc = isMacro
    ? '宏节点：把一组节点打包成一个可复用的执行块。双击可在新标签页中打开定义编辑视图。'
    : '函数节点：把一组纯逻辑打包成可复用的函数。可设为纯函数（无副作用）。双击可编辑。';

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase();
    if (!kw) return definitions;
    return definitions.filter(
      (d) => d.name.toLowerCase().includes(kw) || d.desc.toLowerCase().includes(kw)
    );
  }, [definitions, search]);

  const countInstances = (defId: string) =>
    instances.filter((i) => i.definitionId === defId).length;

  const startRename = (def: FoldDefinition) => {
    setEditingId(def.id);
    setDraftName(def.name);
  };

  const commitRename = () => {
    if (!editingId) return;
    const t = draftName.trim();
    if (t) onRename(editingId, t);
    setEditingId(null);
  };

  return createPortal(
    <div
      className="fixed inset-0 flex items-start justify-center pt-20 transition-opacity duration-200"
      style={{ opacity: show ? 1 : 0, zIndex }}
      onClick={close}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative flex max-h-[80vh] w-[620px] flex-col overflow-hidden border shadow-2xl backdrop-blur-xl transition-all duration-200"
        style={{
          transform: show ? 'scale(1)' : 'scale(0.97)',
          opacity: show ? 1 : 0,
          borderRadius: 2,
          borderColor: 'rgba(232,230,226,0.08)',
          background: '#1b1b1e',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{ background: `linear-gradient(to right, transparent, ${GOLD_SOFT}, transparent)` }}
        />

        {/* 头部 */}
        <div
          className="flex items-center justify-between border-b px-4 py-3"
          style={{ borderColor: 'rgba(232,230,226,0.06)', background: 'rgba(255,255,255,0.015)' }}
        >
          <p className="flex items-center gap-3 text-xs font-normal tracking-[0.15em] text-[#e8e6e2]">
            {title}
            <span className="font-mono text-[10px]" style={{ color: accent }}>
              {definitions.length} 个定义
            </span>
          </p>
          <button
            type="button"
            onClick={close}
            className="grid h-4 w-4 place-items-center text-[#5b5852] transition-colors hover:text-[#e8e6e2]"
          >
            <span className="h-3 w-3">{Icon.close}</span>
          </button>
        </div>

        {/* 说明 */}
        <div
          className="border-b px-4 py-2 text-[10px] leading-5 text-[#8b8885]"
          style={{ borderColor: 'rgba(232,230,226,0.06)' }}
        >
          {desc}
          <span className="ml-2 text-[#5b5852]">
            · 双击条目名 = 打开编辑视图 · Alt + 双击 = 重命名 · 拖动条目到画布 = 添加新实例
          </span>
        </div>

        {/* 搜索 */}
        <div className="border-b p-3" style={{ borderColor: 'rgba(232,230,226,0.06)' }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`搜索${isMacro ? '宏' : '函数'}…`}
            className="w-full border bg-black/30 px-3 py-2 text-[11px] text-[#e8e6e2] placeholder:text-[#5b5852] focus:outline-none"
            style={{ borderRadius: 2, borderColor: 'rgba(232,230,226,0.08)' }}
          />
        </div>

        {/* 列表 */}
        <div className="flex-1 overflow-y-auto p-3">
          {filtered.length === 0 ? (
            <p className="py-10 text-center text-[11px] leading-6 text-[#5b5852]">
              {definitions.length === 0
                ? `还没有${isMacro ? '宏' : '函数'}定义。框选至少 2 个节点 → 右键 → 折叠到${isMacro ? '宏' : '函数'}节点`
                : '没有匹配的结果'}
            </p>
          ) : (
            <div className="space-y-2">
              {filtered.map((def) => {
                const instCount = countInstances(def.id);
                const isEditing = editingId === def.id;
                return (
                  <div
                    key={def.id}
                    draggable={!isEditing}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/x-magic-fold-def', def.id);
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setCtxMenu({ x: e.clientX, y: e.clientY, def });
                    }}
                    className="group relative flex items-center gap-3 border p-3 transition-colors hover:bg-white/[0.03]"
                    style={{
                      borderRadius: 2,
                      borderColor: isEditing ? GOLD_SOFT : 'rgba(232,230,226,0.06)',
                      background: isEditing ? 'rgba(200,169,106,0.06)' : 'rgba(255,255,255,0.015)',
                      cursor: isEditing ? 'default' : 'grab',
                    }}
                  >
                    {/* 左侧色块 */}
                    <span
                      className="absolute left-0 top-0 h-full w-[2px]"
                      style={{ background: accent }}
                    />

                    {/* 图标 */}
                    <span
                      className="grid h-8 w-8 shrink-0 place-items-center border"
                      style={{
                        borderRadius: 2,
                        borderColor: isMacro ? 'rgba(167,139,250,0.4)' : GOLD_SOFT,
                        background: isMacro ? 'rgba(167,139,250,0.1)' : 'rgba(200,169,106,0.08)',
                        color: accent,
                      }}
                    >
                      <span className="h-4 w-4">{isMacro ? Icon.macro : Icon.function}</span>
                    </span>

                    {/* 名称 + 元信息 */}
                    <div className="min-w-0 flex-1">
                      {isEditing ? (
                        <input
                          autoFocus
                          value={draftName}
                          onChange={(e) => setDraftName(e.target.value)}
                          onBlur={commitRename}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitRename();
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full border-b border-dashed bg-transparent text-[12px] text-[#e8e6e2] focus:outline-none"
                          style={{ borderColor: GOLD_SOFT }}
                        />
                      ) : (
                        <p
                          className="truncate text-[12px] text-[#e8e6e2]"
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            // 双击 = 打开编辑视图；Alt + 双击 = 重命名
                            if (e.altKey) {
                              startRename(def);
                            } else {
                              onEdit(def.id);
                            }
                          }}
                          title="双击打开编辑视图（Alt + 双击重命名）"
                        >
                          {def.name}
                          {!isMacro && def.isPure && (
                            <span
                              className="ml-2 border px-1 py-0.5 font-mono text-[9px]"
                              style={{
                                borderRadius: 2,
                                borderColor: GOLD_SOFT,
                                color: GOLD,
                              }}
                            >
                              PURE
                            </span>
                          )}
                        </p>
                      )}
                      <p className="mt-0.5 font-mono text-[10px] text-[#5b5852]">
                        {def.nodes?.length ?? 0} 节点 · {def.inputs?.length ?? 0} 入 / {def.outputs?.length ?? 0} 出 · {instCount} 个实例
                      </p>
                    </div>

                    {/* 定位 */}
                    <button
                      type="button"
                      onClick={() => onFocus(def.id)}
                      className="grid h-6 w-6 place-items-center border text-[#c9c7c2] transition-colors hover:text-[#e8e6e2]"
                      style={{ borderRadius: 2, borderColor: 'rgba(232,230,226,0.1)' }}
                      title="定位到画布中最近的实例"
                    >
                      <span className="h-3 w-3">{Icon.target}</span>
                    </button>

                    {/* 编辑（新标签页） */}
                    <button
                      type="button"
                      onClick={() => onEdit(def.id)}
                      className="border px-2 py-1 text-[10px] transition-colors"
                      style={{
                        borderRadius: 2,
                        borderColor: GOLD_SOFT,
                        color: GOLD,
                        background: 'rgba(200,169,106,0.08)',
                      }}
                      title="在新标签页中编辑定义"
                    >
                      编辑
                    </button>

                    {/* 引脚 */}
                    <button
                      type="button"
                      onClick={() => onEditPins(def.id)}
                      className="border px-2 py-1 text-[10px] transition-colors"
                      style={{
                        borderRadius: 2,
                        borderColor: 'rgba(107,168,154,0.4)',
                        color: MINT,
                        background: 'rgba(107,168,154,0.08)',
                      }}
                      title="编辑该定义的输入 / 输出引脚"
                    >
                      引脚
                    </button>

                    {/* 删除 */}
                    <button
                      type="button"
                      onClick={() => onRemove(def.id)}
                      className="grid h-6 w-6 place-items-center text-[#5b5852] transition-colors hover:text-[#c85a4a]"
                      title="删除定义及其所有实例"
                    >
                      <span className="h-3.5 w-3.5">{Icon.trash}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 底部 */}
        <div
          className="border-t px-4 py-2 font-mono text-[10px] text-[#5b5852]"
          style={{ borderColor: 'rgba(232,230,226,0.06)' }}
        >
          提示：双击条目名 = 打开编辑视图；Alt + 双击 = 重命名。
        </div>
      </div>

      {/* 右键菜单 */}
      {ctxMenu &&
        createPortal(
          <div
            className="fixed z-[360] w-44 overflow-hidden border py-1 shadow-2xl backdrop-blur-xl"
            style={{
              left: Math.min(ctxMenu.x, window.innerWidth - 180),
              top: ctxMenu.y,
              borderRadius: 2,
              borderColor: 'rgba(232,230,226,0.08)',
              background: '#1b1b1e',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <span
              className="pointer-events-none absolute inset-x-0 top-0 h-px"
              style={{ background: `linear-gradient(to right, transparent, ${GOLD_SOFT}, transparent)` }}
            />
            <p className="px-3 py-1.5 font-mono text-[10px] tracking-wider text-[#5b5852]">
              {ctxMenu.def.name}
            </p>
            <button
              type="button"
              onClick={() => {
                onFocus(ctxMenu.def.id);
                setCtxMenu(null);
              }}
              className="block w-full px-3 py-1.5 text-left text-[11px] text-[#c9c7c2] transition-colors hover:bg-white/[0.05]"
            >
              定位到画布
            </button>
            <button
              type="button"
              onClick={() => {
                onEdit(ctxMenu.def.id);
                setCtxMenu(null);
              }}
              className="block w-full px-3 py-1.5 text-left text-[11px] transition-colors hover:bg-white/[0.05]"
              style={{ color: GOLD }}
            >
              在新标签页中编辑
            </button>
            <button
              type="button"
              onClick={() => {
                onEditPins(ctxMenu.def.id);
                setCtxMenu(null);
              }}
              className="block w-full px-3 py-1.5 text-left text-[11px] transition-colors hover:bg-white/[0.05]"
              style={{ color: MINT }}
            >
              编辑引脚
            </button>
            <button
              type="button"
              onClick={() => {
                startRename(ctxMenu.def);
                setCtxMenu(null);
              }}
              className="block w-full px-3 py-1.5 text-left text-[11px] text-[#c9c7c2] transition-colors hover:bg-white/[0.05]"
            >
              重命名
            </button>
            <div className="my-1 h-px" style={{ background: 'rgba(232,230,226,0.06)' }} />
            <button
              type="button"
              onClick={() => {
                onRemove(ctxMenu.def.id);
                setCtxMenu(null);
              }}
              className="block w-full px-3 py-1.5 text-left text-[11px] transition-colors hover:bg-white/[0.05]"
              style={{ color: '#c85a4a' }}
            >
              删除（含所有实例）
            </button>
          </div>,
          document.body
        )}
    </div>,
    document.body
  );
}