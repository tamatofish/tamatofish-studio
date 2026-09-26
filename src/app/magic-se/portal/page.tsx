'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
// src/app/magic-se/portal/page.tsx
import {
  PortType, Port, NodeData, PlacedNode, Connection, EditorState, Template,
  PORT_COLORS, PORT_LABELS, NODE_COLORS, NODE_WIDTH, HEADER_H, PORT_ROW_H, PORT_AREA_PT, PORT_DOT_OFFSET, DRAG_MIME,
  BASE_VARIABLES, NODE_LIBRARY, makeGetNode, makeSetNode, TEMPLATES, TUTORIAL_CHAPTERS, TutorialChapter,
  sortPorts, getPortPosition, bezierPath, uid,
} from '../data/nodeLibrary';   // ← 注意这里是 .. 不是 .

/* ==================== 首次引导 Tour 步骤 ==================== */
interface TourStep {
  key: 'chapters' | 'nodelib' | 'canvas' | 'chapter-card';
  title: string;
  body: string;
  placement?: 'right' | 'left' | 'bottom' | 'top';
}

const TOUR_STEPS: TourStep[] = [
  {
    key: 'chapters',
    title: '从教程开始',
    body: '不知从哪下手？左栏顶部是 12 章教程，从入门到实战，每章都能一键加载示例蓝图。',
    placement: 'right',
  },
  {
    key: 'nodelib',
    title: '节点库',
    body: '这里列出所有可用节点。点击或拖拽到画布即可使用。鼠标悬停能看到每个节点的说明。',
    placement: 'right',
  },
  {
    key: 'canvas',
    title: '画布',
    body: '把节点拖到这里，组成你的蓝图。每个节点左边是输入端口、右边是输出端口。',
    placement: 'bottom',
  },
  {
    key: 'chapter-card',
    title: '章节目标卡',
    body: '点开一章教程后，这里会显示该章的目标、步骤、检查点，还会实时勾选你的进度。',
    placement: 'left',
  },
];

/* ==================== Tour 卡片 ==================== */
function TourCard({ step, onNext, onPrev, onSkip, isLast }: {
  step: TourStep; onNext: () => void; onPrev: () => void; onSkip: () => void; isLast: boolean;
}) {
  return (
    <div className="p-5">
      <p className="text-sm font-medium text-[#4a9eff]">{step.title}</p>
      <p className="mt-2 text-[12px] leading-6 text-[#c9c9cd]">{step.body}</p>
      <div className="mt-4 flex items-center justify-between">
        <button type="button" onClick={onSkip} className="text-[11px] text-[#6b6b70] hover:text-white">跳过引导</button>
        <div className="flex gap-2">
          <button type="button" onClick={onPrev} className="border border-[#2a2a2e] bg-[#151517] px-3 py-1 text-[11px] text-[#c9c9cd] hover:border-[#4a9eff]">上一步</button>
          <button type="button" onClick={onNext} className="border border-[#4a9eff] bg-[#4a9eff]/10 px-3 py-1 text-[11px] text-[#4a9eff] hover:bg-[#4a9eff]/20">
            {isLast ? '完成' : '下一步'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ==================== Tour 主组件 ==================== */
function Tour({ step, targetRef, onNext, onPrev, onSkip, isLast }: {
  step: TourStep;
  targetRef: React.RefObject<HTMLElement | null>;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  isLast: boolean;
}) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const update = () => {
      const el = targetRef.current;
      if (!el) { setRect(null); return; }
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) { setRect(null); return; }
      setRect(r);
    };
    update();
    const id = window.setInterval(update, 300);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [targetRef]);

  if (!mounted) return null;

  // 兜底：目标找不到 → 居中卡片
  if (!rect) {
    return createPortal(
      <div className="pointer-events-none fixed inset-0 z-[300]">
        <div className="pointer-events-auto absolute inset-0 bg-black/60" />
        <div className="pointer-events-auto absolute left-1/2 top-1/2 w-[380px] -translate-x-1/2 -translate-y-1/2 border border-[#4a9eff] bg-[#141922] shadow-2xl">
          <TourCard step={step} onNext={onNext} onPrev={onPrev} onSkip={onSkip} isLast={isLast} />
        </div>
      </div>,
      document.body
    );
  }

  const PAD = 8;
  const left = Math.max(0, rect.left - PAD);
  const top = Math.max(0, rect.top - PAD);
  const right = Math.min(window.innerWidth, rect.right + PAD);
  const bottom = Math.min(window.innerHeight, rect.bottom + PAD);
  const boxW = right - left;
  const boxH = bottom - top;

  // ===== 卡片位置：防出界 =====
  const CARD_W = 360;
  const CARD_H = 220;
  const GAP = 16;
  const placement = step.placement ?? 'right';

  let cardLeft = 0, cardTop = 0;
  const tryPlace = (p: 'right' | 'left' | 'bottom' | 'top') => {
    switch (p) {
      case 'right': cardLeft = right + GAP; cardTop = top; break;
      case 'left': cardLeft = left - CARD_W - GAP; cardTop = top; break;
      case 'bottom': cardLeft = left; cardTop = bottom + GAP; break;
      case 'top': cardLeft = left; cardTop = top - CARD_H - GAP; break;
    }
  };
  tryPlace(placement);

  const fits = (p: 'right' | 'left' | 'bottom' | 'top') => {
    let cl = 0, ct = 0;
    switch (p) {
      case 'right': cl = right + GAP; ct = top; break;
      case 'left': cl = left - CARD_W - GAP; ct = top; break;
      case 'bottom': cl = left; ct = bottom + GAP; break;
      case 'top': cl = left; ct = top - CARD_H - GAP; break;
    }
    return cl >= 8 && ct >= 8 && cl + CARD_W <= window.innerWidth - 8 && ct + CARD_H <= window.innerHeight - 8;
  };

  if (!fits(placement)) {
    const fallbacks: Array<'right' | 'left' | 'bottom' | 'top'> = ['right', 'left', 'bottom', 'top'];
    const alt = fallbacks.find((p) => p !== placement && fits(p));
    if (alt) tryPlace(alt);
    else {
      cardLeft = window.innerWidth / 2 - CARD_W / 2;
      cardTop = window.innerHeight / 2 - CARD_H / 2;
    }
  }
  cardLeft = Math.max(8, Math.min(window.innerWidth - CARD_W - 8, cardLeft));
  cardTop = Math.max(8, Math.min(window.innerHeight - CARD_H - 8, cardTop));

  const tourNode = (
    <div className="pointer-events-none fixed inset-0 z-[300]">
      {/* 4 块黑色遮罩 */}
      <div className="pointer-events-auto absolute bg-black/60" style={{ left: 0, top: 0, right: 0, height: top }} />
      <div className="pointer-events-auto absolute bg-black/60" style={{ left: 0, bottom: 0, right: 0, top: bottom }} />
      <div className="pointer-events-auto absolute bg-black/60" style={{ left: 0, top, width: left, height: boxH }} />
      <div className="pointer-events-auto absolute bg-black/60" style={{ right: 0, top, left: right, height: boxH }} />

      {/* 高亮框 */}
      <div
        className="pointer-events-none absolute border-2 border-[#4a9eff]"
        style={{
          left, top, width: boxW, height: boxH,
          boxShadow: '0 0 0 1px rgba(74,158,255,0.5), 0 0 24px rgba(74,158,255,0.5)',
        }}
      />

      {/* 卡片 */}
      <div
        className="pointer-events-auto absolute border border-[#4a9eff] bg-[#141922] shadow-2xl"
        style={{ left: cardLeft, top: cardTop, width: CARD_W }}
      >
        <TourCard step={step} onNext={onNext} onPrev={onPrev} onSkip={onSkip} isLast={isLast} />
      </div>
    </div>
  );

  return createPortal(tourNode, document.body);
}

/* ==================== 基础变量条目 ==================== */
function VariableItem({
  variable,
  onAdd,
}: {
  variable: typeof BASE_VARIABLES[0];
  onAdd: (node: NodeData, isSet: boolean) => void;
}) {
  return (
    <div className="mb-2 border border-[#2a2a2e] bg-[#151517] p-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-light text-[#f0f0f0]">
          {variable.label}
          <span className="ml-1 text-[10px] text-[#6b6b70]">{variable.key}</span>
        </span>
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: PORT_COLORS[variable.type] }}
        />
      </div>

      <p className="mt-1 text-[10px] leading-4 text-[#8b8b8f]">{variable.desc}</p>

      <div className="mt-1.5 flex gap-1">
        <button
          type="button"
          onClick={() => onAdd(makeGetNode(variable), false)}
          className="flex-1 border border-[#2a2a2e] bg-[#0f0f11] px-2 py-1 text-[10px] text-[#c9c9cd] transition-colors hover:border-[#4a9eff] hover:text-[#4a9eff]"
          title="添加到画布：读取该类型变量"
        >
          Get
        </button>
        <button
          type="button"
          onClick={() => onAdd(makeSetNode(variable), true)}
          className="flex-1 border border-[#2a2a2e] bg-[#0f0f11] px-2 py-1 text-[10px] text-[#c9c9cd] transition-colors hover:border-[#4a9eff] hover:text-[#4a9eff]"
          title="添加到画布：写入该类型变量"
        >
          Set
        </button>
      </div>
    </div>
  );
}

/* ==================== 端口组件 ==================== */
function PortView({ port, side, onStartDrag, onEndDrag, connecting, highlight, onHoverChange, onPortEnter, onPortLeave }: {
  port: Port; side: 'in' | 'out';
  onStartDrag?: (side: 'in' | 'out', e: React.MouseEvent) => void;
  onEndDrag?: (side: 'in' | 'out', e: React.MouseEvent) => void;
  connecting: boolean; highlight: boolean;
  onHoverChange: (hovering: boolean) => void;
  onPortEnter?: () => void; onPortLeave?: () => void;
}) {
  const [hover, setHover] = useState(false);
  const color = PORT_COLORS[port.type];
  return (
    <div data-port className={`relative flex items-center gap-2 ${side === 'in' ? 'flex-row' : 'flex-row-reverse'}`}
      onMouseEnter={(e) => { e.stopPropagation(); setHover(true); onHoverChange(true); onPortEnter?.(); }}
      onMouseLeave={(e) => { e.stopPropagation(); setHover(false); onHoverChange(false); onPortLeave?.(); }}
    >
      <div className="h-3 w-3 shrink-0 cursor-crosshair rounded-full border border-black/40 transition-transform"
        style={{ background: color, transform: hover || highlight ? 'scale(1.6)' : 'scale(1)', boxShadow: highlight ? `0 0 8px ${color}` : 'none' }}
        onMouseDown={(e) => { e.stopPropagation(); onStartDrag?.(side, e); }}
        onMouseUp={(e) => { e.stopPropagation(); onEndDrag?.(side, e); }}
      />
      <span className="text-[11px] font-light text-[#c9c9cd]">{port.name || ' '}</span>
      {hover && (
        <div className={`pointer-events-none absolute top-full z-[80] mt-1 w-64 border border-[#333] bg-[#1a1a1c] p-3 text-left shadow-xl ${side === 'in' ? 'left-0' : 'right-0'}`}>
          <p className="text-[11px] font-medium text-[#f0f0f0]">{port.name || (side === 'in' ? '执行输入' : '执行输出')}</p>
          <p className="mt-1 text-[10px] text-[#8b8b8f]">类型：<span style={{ color }}>{PORT_LABELS[port.type]}</span></p>
          <p className="mt-2 text-[10px] leading-5 text-[#a0a0a5]">{port.desc}</p>
        </div>
      )}
    </div>
  );
}

/* ==================== 画布节点 ==================== */
function PlacedNodeView({ node, selected, onDrag, onStartConnect, onEndConnect, connecting, highlightedPorts, onContextMenu, onPortEnter, onPortLeave, onMouseDownSelect }: {
  node: PlacedNode; selected: boolean;
  onDrag: (id: string, dx: number, dy: number) => void;
  onStartConnect: (instanceId: string, side: 'in' | 'out', portIndex: number, e: React.MouseEvent) => void;
  onEndConnect: (instanceId: string, side: 'in' | 'out', portIndex: number, e: React.MouseEvent) => void;
  connecting: boolean; highlightedPorts: Set<string>;
  onContextMenu: (e: React.MouseEvent, instanceId: string) => void;
  onPortEnter: (instanceId: string, side: 'in' | 'out', portIndex: number) => void;
  onPortLeave: () => void;
  onMouseDownSelect: (e: React.MouseEvent, instanceId: string) => void;
}) {
  const [hoverTarget, setHoverTarget] = useState<'node' | 'port' | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const onMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    onMouseDownSelect(e, node.instanceId);
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    dragStart.current = { x: e.clientX, y: e.clientY };
    onDrag(node.instanceId, dx, dy);
  };
  const onMouseUp = () => setDragging(false);

  return (
    <div className="absolute select-none" data-node style={{ left: node.x, top: node.y, width: NODE_WIDTH }}
      onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp} onContextMenu={(e) => onContextMenu(e, node.instanceId)}>
      <div className="border bg-[#151517] shadow-lg"
        style={{ borderColor: selected ? '#ffd700' : hoverTarget === 'node' ? '#e8704a' : '#2a2a2e' }}
        onMouseEnter={() => setHoverTarget('node')}
        onMouseLeave={(e) => {
          const related = e.relatedTarget as HTMLElement | null;
          if (related?.closest('[data-port]')) return;
          setHoverTarget(null);
        }}>
        <div onMouseDown={onMouseDown} className="cursor-grab border-b border-black/40 px-3 py-2 active:cursor-grabbing"
          style={{ background: `linear-gradient(180deg, ${node.color}, ${node.color}cc)`, height: HEADER_H }}>
          <p className="text-xs font-light tracking-wider text-white">{node.title}</p>
          <p className="mt-0.5 text-[10px] text-white/70">{node.category}</p>
        </div>
        <div className="flex justify-between gap-3 px-3 py-2" style={{ minHeight: 40 }}>
          <div className="flex flex-col gap-1.5">
            {node.inputs.map((p, i) => (
              <PortView key={i} port={p} side="in" connecting={connecting}
                highlight={highlightedPorts.has(`${node.instanceId}:in:${i}`)}
                onStartDrag={(s, e) => onStartConnect(node.instanceId, s, i, e)}
                onEndDrag={(s, e) => onEndConnect(node.instanceId, s, i, e)}
                onHoverChange={(h) => setHoverTarget(h ? 'port' : 'node')}
                onPortEnter={() => onPortEnter(node.instanceId, 'in', i)} onPortLeave={onPortLeave}
              />
            ))}
          </div>
          <div className="flex flex-col items-end gap-1.5">
            {node.outputs.map((p, i) => (
              <PortView key={i} port={p} side="out" connecting={connecting}
                highlight={highlightedPorts.has(`${node.instanceId}:out:${i}`)}
                onStartDrag={(s, e) => onStartConnect(node.instanceId, s, i, e)}
                onEndDrag={(s, e) => onEndConnect(node.instanceId, s, i, e)}
                onHoverChange={(h) => setHoverTarget(h ? 'port' : 'node')}
                onPortEnter={() => onPortEnter(node.instanceId, 'out', i)} onPortLeave={onPortLeave}
              />
            ))}
          </div>
        </div>
      </div>
      {hoverTarget === 'node' && (
        <div className="pointer-events-none absolute left-0 top-full z-50 mt-2 w-72 border border-[#333] bg-[#1a1a1c] p-3 text-left shadow-xl">
          <p className="text-xs font-medium text-[#f0f0f0]">{node.title}</p>
          <p className="mt-1 text-[10px] text-[#8b8b8f]">{node.category}</p>
          <p className="mt-2 text-[10px] leading-5 text-[#a0a0a5]">{node.desc}</p>
          {node.commonScene && <p className="mt-1 text-[10px] leading-5 text-[#4ade80]">常用场景：{node.commonScene}</p>}
          {node.source && (
            <a href={node.source} target="_blank" rel="noreferrer" className="mt-1 block text-[10px] text-[#4a9eff] hover:underline" onClick={(e) => e.stopPropagation()}>
              资料来源：UE 官方文档 ↗
            </a>
          )}
        </div>
      )}
    </div>
  );
}

/* ==================== 左侧库项 ==================== */
function LibraryItem({ node, onAdd, onDragStart, onContextMenu }: {
  node: NodeData; onAdd: () => void;
  onDragStart: (e: React.DragEvent, node: NodeData) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div role="button" tabIndex={0} draggable onClick={onAdd}
      onKeyDown={(e) => { if (e.key === 'Enter') onAdd(); }}
      onDragStart={(e) => onDragStart(e, node)} onContextMenu={onContextMenu}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      className="relative w-full cursor-grab border border-[#2a2a2e] bg-[#151517] p-3 pl-4 text-left transition-colors hover:border-[#e8704a] active:cursor-grabbing">
      <span className="absolute left-0 top-0 h-full w-1" style={{ background: node.color }} />
      <p className="text-xs font-light text-[#f0f0f0]">{node.title}</p>
      <p className="mt-0.5 text-[10px] text-[#6b6b70]">{node.category}</p>
      <p className="mt-1.5 line-clamp-2 text-[10px] leading-4 text-[#8b8b8f]">{node.desc}</p>
      {hover && (
        <div className="pointer-events-none absolute left-full top-0 z-50 ml-2 w-72 border border-[#333] bg-[#1a1a1c] p-3 text-left shadow-xl">
          <p className="text-xs font-medium text-[#f0f0f0]">{node.title}</p>
          <p className="mt-1 text-[10px] text-[#8b8b8f]">{node.category}</p>
          <p className="mt-2 text-[10px] leading-5 text-[#a0a0a5]">{node.desc}</p>
          {node.commonScene && <p className="mt-1 text-[10px] leading-5 text-[#4ade80]">常用场景：{node.commonScene}</p>}
          {node.source && (
            <a href={node.source} target="_blank" rel="noreferrer" className="mt-1 block text-[10px] text-[#4a9eff] hover:underline" onClick={(e) => e.stopPropagation()}>
              资料来源：UE 官方文档 ↗
            </a>
          )}
        </div>
      )}
    </div>
  );
}

/* ==================== 主页面 ==================== */
export default function MagicSEPortalPage() {
  const [placed, setPlaced] = useState<PlacedNode[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const [pendingFrom, setPendingFrom] = useState<{ instanceId: string; side: 'in' | 'out'; portIndex: number; type: PortType } | null>(null);
  const [pendingValid, setPendingValid] = useState(true);
  const [hoverPort, setHoverPort] = useState<{ instanceId: string; side: 'in' | 'out'; portIndex: number } | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [hoverConnectionId, setHoverConnectionId] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; kind: 'canvas' | 'node'; instanceId?: string } | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [librarySearch, setLibrarySearch] = useState('');

  const [tutorialOpen, setTutorialOpen] = useState(true);
  const [activeChapter, setActiveChapter] = useState<TutorialChapter | null>(null);
  const [chaptersCollapsed, setChaptersCollapsed] = useState(false);
  const [varsCollapsed, setVarsCollapsed] = useState(false);

  const [tourActive, setTourActive] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const tourNodeLibRef = useRef<HTMLDivElement>(null);
  const tourCanvasRef = useRef<HTMLDivElement>(null);
  const tourChaptersRef = useRef<HTMLDivElement>(null);
  const tourCardRef = useRef<HTMLDivElement>(null);

  const [history, setHistory] = useState<EditorState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const historyRef = useRef<{ history: EditorState[]; index: number }>({ history: [], index: -1 });

  const clipboard = useRef<PlacedNode[]>([]);
  const panningRef = useRef<{ active: boolean; startX: number; startY: number; panX: number; panY: number } | null>(null);
  const rightDragRef = useRef<{ active: boolean; startX: number; startY: number; panX: number; panY: number; moved: boolean } | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const nextX = useRef(60);
  const nextY = useRef(60);

  /* ==================== 历史记录 ==================== */
  const pushHistory = useCallback((state: EditorState) => {
    const ref = historyRef.current;
    const trimmed = ref.history.slice(0, ref.index + 1);
    const next = [...trimmed, { placed: state.placed, connections: state.connections }];
    const MAX = 50;
    const final = next.length > MAX ? next.slice(next.length - MAX) : next;
    historyRef.current = { history: final, index: final.length - 1 };
    setHistory(final);
    setHistoryIndex(final.length - 1);
  }, []);

  const undo = useCallback(() => {
    const ref = historyRef.current;
    if (ref.index <= 0) return;
    const idx = ref.index - 1;
    const s = ref.history[idx];
    historyRef.current = { ...ref, index: idx };
    setHistoryIndex(idx);
    setPlaced(s.placed);
    setConnections(s.connections);
  }, []);

  const redo = useCallback(() => {
    const ref = historyRef.current;
    if (ref.index >= ref.history.length - 1) return;
    const idx = ref.index + 1;
    const s = ref.history[idx];
    historyRef.current = { ...ref, index: idx };
    setHistoryIndex(idx);
    setPlaced(s.placed);
    setConnections(s.connections);
  }, []);

  useEffect(() => {
    pushHistory({ placed: [], connections: [] });
  }, []);

  useEffect(() => {
    const KEY = 'magic-se-tour-done-v1';
    try {
      const done = localStorage.getItem(KEY);
      if (!done) {
        const id = window.setTimeout(() => { setTourActive(true); setTourStep(0); }, 800);
        return () => window.clearTimeout(id);
      }
    } catch { /* ignore */ }
  }, []);

  const startTour = () => { setTourActive(true); setTourStep(0); };
  const finishTour = () => {
    setTourActive(false);
    try { localStorage.setItem('magic-se-tour-done-v1', '1'); } catch { /* ignore */ }
  };

  /* ==================== 节点操作 ==================== */
  const addNode = useCallback((node: NodeData, worldX?: number, worldY?: number) => {
    const instanceId = uid(node.id);
    const x = worldX ?? nextX.current;
    const y = worldY ?? nextY.current;
    setPlaced((prev) => {
      const next = [...prev, { ...node, instanceId, x, y, inputs: sortPorts(node.inputs), outputs: sortPorts(node.outputs) }];
      pushHistory({ placed: next, connections });
      return next;
    });
    if (worldX === undefined) {
      nextX.current += 40;
      nextY.current += 40;
      if (nextY.current > 500) { nextY.current = 60; nextX.current += 220; }
      if (nextX.current > 800) nextX.current = 60;
    }
  }, [connections, pushHistory]);

  const loadTemplate = useCallback((tpl: Template) => {
    const refMap: Record<string, PlacedNode> = {};
    const newNodes: PlacedNode[] = [];
    tpl.nodes.forEach((tn) => {
      const base = NODE_LIBRARY.find((n) => n.id === tn.nodeId);
      if (!base) return;
      const instanceId = uid(base.id);
      const placedNode: PlacedNode = { ...base, instanceId, x: tn.x, y: tn.y, inputs: sortPorts(base.inputs), outputs: sortPorts(base.outputs) };
      refMap[tn.refId] = placedNode;
      newNodes.push(placedNode);
    });
    const newConns: Connection[] = [];
    tpl.connections.forEach((tc) => {
      const from = refMap[tc.fromRef];
      const to = refMap[tc.toRef];
      if (!from || !to) return;
      const fromPort = from.outputs[tc.fromPort];
      const toPort = to.inputs[tc.toPort];
      if (!fromPort || !toPort || fromPort.type !== toPort.type) return;
      newConns.push({
        id: uid(`${from.instanceId}:${tc.fromPort}->${to.instanceId}:${tc.toPort}`),
        fromInstance: from.instanceId, fromPort: tc.fromPort,
        toInstance: to.instanceId, toPort: tc.toPort, type: fromPort.type,
      });
    });
    setPlaced((prev) => {
      const next = [...prev, ...newNodes];
      setConnections((prevConns) => {
        const nextConns = [...prevConns, ...newConns];
        pushHistory({ placed: next, connections: nextConns });
        return nextConns;
      });
      return next;
    });
    setTemplateOpen(false);
  }, [pushHistory]);

  const openChapter = useCallback((chapter: TutorialChapter) => {
    setActiveChapter(chapter);
    if (chapter.templateId) {
      const tpl = TEMPLATES.find((t) => t.id === chapter.templateId);
      if (tpl) {
        setPlaced([]); setConnections([]); setSelectedIds(new Set());
        setTimeout(() => loadTemplate(tpl), 50);
      }
    } else {
      setPlaced([]); setConnections([]); setSelectedIds(new Set());
      pushHistory({ placed: [], connections: [] });
    }
  }, [loadTemplate, pushHistory]);

  const closeChapter = useCallback(() => setActiveChapter(null), []);

  const chapterChecks = useMemo(() => {
    if (!activeChapter) return [];
    const hasNodes = placed.length > 0;
    const hasConns = connections.length > 0;
    return activeChapter.checks.map((text, idx) => {
      if (idx === 0) return { text, done: hasNodes };
      if (idx === 1) return { text, done: hasConns };
      return { text, done: false };
    });
  }, [activeChapter, placed.length, connections.length]);

  const deleteSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    setPlaced((prev) => {
      const next = prev.filter((n) => !selectedIds.has(n.instanceId));
      const nextConns = connections.filter((c) => !selectedIds.has(c.fromInstance) && !selectedIds.has(c.toInstance));
      setConnections(nextConns);
      pushHistory({ placed: next, connections: nextConns });
      return next;
    });
    setSelectedIds(new Set());
  }, [selectedIds, connections, pushHistory]);

  const deleteConnection = (id: string) => {
    setConnections((prev) => {
      const next = prev.filter((c) => c.id !== id);
      pushHistory({ placed, connections: next });
      return next;
    });
  };

  const handleDrag = (instanceId: string, dx: number, dy: number) => {
    setPlaced((prev) => prev.map((n) => (n.instanceId === instanceId ? { ...n, x: n.x + dx, y: n.y + dy } : n)));
  };
  const commitDragEnd = () => { pushHistory({ placed, connections }); };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    setScale((s) => Math.min(2.5, Math.max(0.35, s + delta)));
  };

  const onPortEnter = (instanceId: string, side: 'in' | 'out', portIndex: number) => setHoverPort({ instanceId, side, portIndex });
  const onPortLeave = () => setHoverPort(null);

  const startConnect = (instanceId: string, side: 'in' | 'out', portIndex: number) => {
    const node = placed.find((n) => n.instanceId === instanceId);
    if (!node) return;
    const ports = side === 'in' ? node.inputs : node.outputs;
    const port = ports[portIndex];
    if (!port) return;
    setPendingFrom({ instanceId, side, portIndex, type: port.type });
    setPendingValid(true);
  };

  const endConnect = (instanceId: string, side: 'in' | 'out', portIndex: number) => {
    if (!pendingFrom) return;
    if (pendingFrom.side === side) { setPendingFrom(null); setHoverPort(null); return; }
    const targetNode = placed.find((n) => n.instanceId === instanceId);
    if (!targetNode) { setPendingFrom(null); setHoverPort(null); return; }
    const targetPorts = side === 'in' ? targetNode.inputs : targetNode.outputs;
    const targetPort = targetPorts[portIndex];
    if (!targetPort) { setPendingFrom(null); setHoverPort(null); return; }
    if (targetPort.type !== pendingFrom.type) { setPendingFrom(null); setHoverPort(null); return; }

    const fromIsOut = pendingFrom.side === 'out';
    const fromInstance = fromIsOut ? pendingFrom.instanceId : instanceId;
    const fromPort = fromIsOut ? pendingFrom.portIndex : portIndex;
    const toInstance = fromIsOut ? instanceId : pendingFrom.instanceId;
    const toPort = fromIsOut ? portIndex : pendingFrom.portIndex;

    setConnections((prev) => {
      const filtered = prev.filter((c) => !(c.fromInstance === fromInstance && c.fromPort === fromPort));
      const next = [...filtered, {
        id: uid(`${fromInstance}:${fromPort}->${toInstance}:${toPort}`),
        fromInstance, fromPort, toInstance, toPort, type: pendingFrom.type,
      }];
      pushHistory({ placed, connections: next });
      return next;
    });
    setPendingFrom(null); setHoverPort(null);
  };

  useEffect(() => {
    if (!pendingFrom || !hoverPort) { setPendingValid(true); return; }
    if (pendingFrom.side === hoverPort.side) { setPendingValid(false); return; }
    const targetNode = placed.find((n) => n.instanceId === hoverPort.instanceId);
    if (!targetNode) { setPendingValid(true); return; }
    const targetPorts = hoverPort.side === 'in' ? targetNode.inputs : targetNode.outputs;
    const targetPort = targetPorts[hoverPort.portIndex];
    if (!targetPort) { setPendingValid(true); return; }
    setPendingValid(targetPort.type === pendingFrom.type);
  }, [pendingFrom, hoverPort, placed]);

  useEffect(() => {
    if (!pendingFrom) return;
    const onMove = (e: MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [pendingFrom]);

  useEffect(() => {
    if (!pendingFrom) return;
    const onUp = (e: MouseEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const portEl = el?.closest('[data-port]');
      if (!portEl) { setPendingFrom(null); setHoverPort(null); }
    };
    window.addEventListener('mouseup', onUp);
    return () => window.removeEventListener('mouseup', onUp);
  }, [pendingFrom]);

  useEffect(() => {
    const close = () => setMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  const getNodeById = (id: string) => placed.find((n) => n.instanceId === id);

  const highlighted = useMemo(() => {
    if (!hoverConnectionId) return { conns: new Set<string>(), ports: new Set<string>() };
    const conns = new Set<string>([hoverConnectionId]);
    const ports = new Set<string>();
    const chainFrom = (startId: string) => {
      let current = startId;
      const visited = new Set<string>();
      while (current && !visited.has(current)) {
        visited.add(current);
        const next = connections.find((c) => c.type === 'exec' && c.fromInstance === current);
        if (!next) break;
        conns.add(next.id);
        ports.add(`${next.fromInstance}:out:${next.fromPort}`);
        ports.add(`${next.toInstance}:in:${next.toPort}`);
        current = next.toInstance;
      }
    };
    const hovered = connections.find((c) => c.id === hoverConnectionId);
    if (hovered) {
      ports.add(`${hovered.fromInstance}:out:${hovered.fromPort}`);
      ports.add(`${hovered.toInstance}:in:${hovered.toPort}`);
      chainFrom(hovered.fromInstance);
    }
    return { conns, ports };
  }, [hoverConnectionId, connections]);

  const handleLibraryDragStart = (e: React.DragEvent, node: NodeData) => {
    e.dataTransfer.setData(DRAG_MIME, node.id);
    e.dataTransfer.setData('text/plain', node.id);
    e.dataTransfer.effectAllowed = 'copy';
  };
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (!dropActive) setDropActive(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget === e.target) setDropActive(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDropActive(false);
    const nodeId = e.dataTransfer.getData(DRAG_MIME) || e.dataTransfer.getData('text/plain');
    if (!nodeId) return;
    const node = NODE_LIBRARY.find((n) => n.id === nodeId);
    if (!node) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const worldX = (e.clientX - rect.left - pan.x) / scale - NODE_WIDTH / 2;
    const worldY = (e.clientY - rect.top - pan.y) / scale - 20;
    addNode(node, worldX, worldY);
  };

  const onNodeContextMenu = (e: React.MouseEvent, instanceId: string) => {
    e.preventDefault(); e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY, kind: 'node', instanceId });
  };

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => e.preventDefault();
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  useEffect(() => {
    const prevent = (e: Event) => e.preventDefault();
    document.addEventListener('gesturestart', prevent);
    document.addEventListener('gesturechange', prevent);
    document.addEventListener('gestureend', prevent);
    return () => {
      document.removeEventListener('gesturestart', prevent);
      document.removeEventListener('gesturechange', prevent);
      document.removeEventListener('gestureend', prevent);
    };
  }, []);

  useEffect(() => {
    const preventZoom = (e: WheelEvent) => { if (e.ctrlKey) e.preventDefault(); };
    window.addEventListener('wheel', preventZoom, { passive: false });
    return () => window.removeEventListener('wheel', preventZoom);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if ((e.key === 'Delete' || e.key === 'Backspace') && !isInput) {
        if (selectedIds.size > 0) { e.preventDefault(); deleteSelected(); }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && !isInput) {
        if (e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
        if ((e.key.toLowerCase() === 'z' && e.shiftKey) || e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
        if (e.key.toLowerCase() === 'c') {
          e.preventDefault();
          clipboard.current = placed.filter((n) => selectedIds.has(n.instanceId));
          return;
        }
        if (e.key.toLowerCase() === 'v') {
          e.preventDefault();
          const pasted = clipboard.current.map((n) => ({ ...n, instanceId: uid(n.id), x: n.x + 30, y: n.y + 30 }));
          if (pasted.length === 0) return;
          setPlaced((prev) => {
            const next = [...prev, ...pasted];
            pushHistory({ placed: next, connections });
            return next;
          });
          setSelectedIds(new Set(pasted.map((p) => p.instanceId)));
          return;
        }
        if (e.key.toLowerCase() === 'd') {
          e.preventDefault();
          const duplicated = placed.filter((n) => selectedIds.has(n.instanceId))
            .map((n) => ({ ...n, instanceId: uid(n.id), x: n.x + 30, y: n.y + 30 }));
          if (duplicated.length === 0) return;
          setPlaced((prev) => {
            const next = [...prev, ...duplicated];
            pushHistory({ placed: next, connections });
            return next;
          });
          setSelectedIds(new Set(duplicated.map((d) => d.instanceId)));
          return;
        }
        if (e.key.toLowerCase() === 'a') {
          e.preventDefault();
          setSelectedIds(new Set(placed.map((n) => n.instanceId)));
          return;
        }
      }
      if (e.key === 'Escape') {
        setSelectedIds(new Set()); setPendingFrom(null); setHoverPort(null);
        setMenu(null); setTemplateOpen(false);
        return;
      }
      if (e.key.toLowerCase() === 'f' && !isInput && selectedIds.size > 0) {
        e.preventDefault();
        const selected = placed.filter((n) => selectedIds.has(n.instanceId));
        if (selected.length === 0) return;
        const minX = Math.min(...selected.map((n) => n.x));
        const minY = Math.min(...selected.map((n) => n.y));
        const maxX = Math.max(...selected.map((n) => n.x + NODE_WIDTH));
        const maxY = Math.max(...selected.map((n) => n.y + 200));
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const newScale = Math.min(2, Math.max(0.5, Math.min(rect.width / (maxX - minX + 200), rect.height / (maxY - minY + 200))));
        setScale(newScale);
        setPan({
          x: rect.width / 2 - cx * newScale,
          y: rect.height / 2 - cy * newScale,
        });
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedIds, placed, connections, pushHistory, undo, redo, deleteSelected]);

  const onCanvasPointerDown = (e: React.PointerEvent) => {
    if (e.button === 2) {
      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      rightDragRef.current = {
        active: true,
        startX: e.clientX,
        startY: e.clientY,
        panX: pan.x,
        panY: pan.y,
        moved: false,
      };
      return;
    }
    if (e.button === 1) {
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      panningRef.current = {
        active: true, startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y,
      };
      return;
    }
    if (e.button === 0) {
      const el = e.target as HTMLElement;
      const isNode = el.closest('[data-node]');
      const isPort = el.closest('[data-port]');
      const isConn = el.closest('[data-connection]');
      if (!isNode && !isPort && !isConn) {
        setSelectedIds(new Set());
      }
    }
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const rd = rightDragRef.current;
      if (rd?.active) {
        const dx = e.clientX - rd.startX;
        const dy = e.clientY - rd.startY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) rd.moved = true;
        setPan({ x: rd.panX + dx, y: rd.panY + dy });
        return;
      }
      const p = panningRef.current;
      if (p?.active) {
        setPan({
          x: p.panX + (e.clientX - p.startX),
          y: p.panY + (e.clientY - p.startY),
        });
      }
    };
    const onUp = () => {
      const rd = rightDragRef.current;
      if (rd?.active) {
        rd.active = false;
        if (!rd.moved) {
          const rect = canvasRef.current?.getBoundingClientRect();
          const world = rect
            ? { x: (rd.startX - rect.left - pan.x) / scale, y: (rd.startY - rect.top - pan.y) / scale }
            : { x: 100, y: 100 };
          (window as any).__contextWorld = world;
          setMenu({ x: rd.startX, y: rd.startY, kind: 'canvas' });
        }
        rightDragRef.current = null;
      }
      if (panningRef.current) panningRef.current.active = false;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [pan, scale]);

  const onNodeMouseDownSelect = (e: React.MouseEvent, instanceId: string) => {
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(instanceId)) next.delete(instanceId);
        else next.add(instanceId);
        return next;
      });
    } else {
      setSelectedIds(new Set([instanceId]));
    }
  };

  const connectionPaths = useMemo(() => {
    return connections.map((c) => {
      const fromNode = getNodeById(c.fromInstance);
      const toNode = getNodeById(c.toInstance);
      if (!fromNode || !toNode) return null;
      const p1 = getPortPosition(fromNode, 'out', c.fromPort);
      const p2 = getPortPosition(toNode, 'in', c.toPort);
      return { c, d: bezierPath(p1.x, p1.y, p2.x, p2.y), p1, p2 };
    }).filter(Boolean) as { c: Connection; d: string; p1: { x: number; y: number }; p2: { x: number; y: number } }[];
  }, [connections, placed]);

  const previewPath = useMemo(() => {
    if (!pendingFrom) return null;
    const node = getNodeById(pendingFrom.instanceId);
    if (!node) return null;
    const p = getPortPosition(node, pendingFrom.side, pendingFrom.portIndex);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const mouseWorld = {
      x: (mousePos.x - rect.left - pan.x) / scale,
      y: (mousePos.y - rect.top - pan.y) / scale,
    };
    if (pendingFrom.side === 'out') return bezierPath(p.x, p.y, mouseWorld.x, mouseWorld.y);
    return bezierPath(mouseWorld.x, mouseWorld.y, p.x, p.y);
  }, [pendingFrom, mousePos, scale, placed, pan]);

  const filteredLibrary = useMemo(() => {
    const kw = librarySearch.trim().toLowerCase();
    if (!kw) return NODE_LIBRARY;
    return NODE_LIBRARY.filter((n) =>
      n.title.toLowerCase().includes(kw) ||
      n.category.toLowerCase().includes(kw) ||
      n.desc.toLowerCase().includes(kw)
    );
  }, [librarySearch]);

  const chaptersByGroup = useMemo(() => {
    const groups: Record<string, TutorialChapter[]> = {
      '基础': [], '蓝图': [], '数学运算': [], '蓝图进阶': [], '综合实战': [],
    };
    TUTORIAL_CHAPTERS.forEach((ch) => {
      if (!groups[ch.group]) groups[ch.group] = [];
      groups[ch.group].push(ch);
    });
    return groups;
  }, []);

  return (
    <div className="min-h-screen bg-[#0d0d0f] font-sans text-[#e0e0e0] antialiased">
      <header className="flex h-12 items-center justify-between border-b border-[#1f1f22] bg-[#141416] px-5">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[#e8704a]" />
          <span className="text-xs font-light tracking-[0.35em] text-[#e0e0e0]">MAGIC SE · 蓝图节点编辑器</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[10px] text-[#6b6b70]">
            Del 删除 · Ctrl+Z 撤销 · Ctrl+Shift+Z 重做 · Ctrl+C/V 复制/粘贴 · Ctrl+D 复制 · Ctrl+A 全选 · F 聚焦 · Esc 取消 · 右键拖拽平移 · 右键单击菜单 · Alt+左键断线
          </span>

          <button type="button"
            onClick={() => { setChaptersCollapsed(false); setTutorialOpen(true); }}
            className="flex h-6 items-center gap-1 border border-[#4a9eff] bg-[#1e1e21] px-2 text-[10px] text-[#4a9eff] transition-colors hover:bg-[#26262a]"
            title="打开教程章节列表">
            教程
          </button>

          <button type="button" onClick={() => setTemplateOpen((v) => !v)}
            className="flex h-6 items-center gap-1 border border-[#e8704a] bg-[#1e1e21] px-2 text-[10px] text-[#e8704a] transition-colors hover:bg-[#26262a]">
            模板
          </button>

          <a href="https://www.bilibili.com/video/BV1qYSvBHELW/" target="_blank" rel="noreferrer"
            className="flex h-6 items-center gap-1 border border-[#fb7299] bg-[#1e1e21] px-2 text-[10px] text-[#fb7299] transition-colors hover:bg-[#26262a]"
            title="打开配套视频教程（B站）">
            视频教程
          </a>

          <button type="button" onClick={startTour}
            className="flex h-6 w-6 items-center justify-center border border-[#4a9eff] bg-[#1e1e21] text-[11px] text-[#4a9eff] transition-colors hover:bg-[#26262a]"
            title="重新播放新手引导">
            ?
          </button>

          <div className="flex items-center gap-1">
            {historyIndex > 0 && (
              <button type="button" onClick={undo} title="撤销 (Ctrl+Z)"
                className="flex h-6 items-center gap-1 border border-[#2a2a2e] bg-[#151517] px-2 text-[10px] text-[#c9c9cd] transition-colors hover:border-[#e8704a] hover:text-[#e8704a]">
                撤销
              </button>
            )}
            {historyIndex < history.length - 1 && (
              <button type="button" onClick={redo} title="重做 (Ctrl+Shift+Z)"
                className="flex h-6 items-center gap-1 border border-[#2a2a2e] bg-[#151517] px-2 text-[10px] text-[#c9c9cd] transition-colors hover:border-[#e8704a] hover:text-[#e8704a]">
                重做
              </button>
            )}
          </div>

          <span className="text-[10px] font-mono text-[#6b6b70]">{Math.round(scale * 100)}%</span>
        </div>
      </header>

      <div className="flex h-[calc(100vh-48px)]">
        <aside className="flex w-72 shrink-0 flex-col border-r border-[#1f1f22] bg-[#0f0f11]">
          {tutorialOpen && (
            <div ref={tourChaptersRef} className="border-b border-[#1f1f22]">
              <button type="button" onClick={() => setChaptersCollapsed((v) => !v)}
                className="flex w-full items-center justify-between border-b border-[#1f1f22] bg-[#141416] px-3 py-2 text-left transition-colors hover:bg-[#1a1a1d]">
                <span className="flex items-center gap-2">
                  <span className="text-[10px] font-light tracking-[0.25em] text-[#4a9eff]">📖 教程章节</span>
                  <span className="text-[10px] text-[#6b6b70]">（{TUTORIAL_CHAPTERS.length} 章）</span>
                </span>
                <span className="text-[10px] text-[#6b6b70]">{chaptersCollapsed ? '展开' : '收起'}</span>
              </button>
              {!chaptersCollapsed && (
                <div className="max-h-[340px] overflow-y-auto py-1">
                  {Object.entries(chaptersByGroup).map(([groupName, chapters]) => (
                    <div key={groupName}>
                      <p className="px-3 py-1.5 text-[10px] font-light tracking-[0.2em] text-[#4a4a4f]">{groupName}</p>
                      {chapters.map((ch) => {
                        const isActive = activeChapter?.id === ch.id;
                        return (
                          <button key={ch.id} type="button" onClick={() => openChapter(ch)}
                            className={`flex w-full flex-col items-start gap-0.5 border-l-2 px-3 py-2 text-left transition-colors ${
                              isActive ? 'border-[#4a9eff] bg-[#1a1f26]' : 'border-transparent hover:border-[#4a9eff] hover:bg-[#1a1a1d]'
                            }`}>
                            <span className={`text-[11px] font-light ${isActive ? 'text-[#4a9eff]' : 'text-[#e0e0e0]'}`}>{ch.title}</span>
                            <span className="flex items-center gap-2 text-[10px] text-[#6b6b70]">
                              <span>{ch.lessonNo}</span>
                              <span>·</span>
                              <span>{'★'.repeat(ch.difficulty)}{'☆'.repeat(5 - ch.difficulty)}</span>
                              <span>·</span>
                              <span>{ch.duration}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div ref={tourNodeLibRef} className="border-b border-[#1f1f22] p-3">
            <div className="relative">
              <input type="text" value={librarySearch} onChange={(e) => setLibrarySearch(e.target.value)}
                placeholder="搜索节点（名称 / 类别 / 说明）"
                className="w-full rounded-none border border-[#2a2a2e] bg-[#151517] px-3 py-2 pr-8 text-[11px] font-light text-[#e0e0e0] placeholder:text-[#6b6b70] focus:border-[#e8704a] focus:outline-none" />
              {librarySearch && (
                <button type="button" onClick={() => setLibrarySearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-[#6b6b70] hover:text-white" title="清空">✕</button>
              )}
            </div>
          </div>

          {/* ===== 基础变量面板 ===== */}
          <div className="border-b border-[#1f1f22]">
            <button type="button" onClick={() => setVarsCollapsed((v) => !v)}
              className="flex w-full items-center justify-between border-b border-[#1f1f22] bg-[#141416] px-3 py-2 text-left transition-colors hover:bg-[#1a1a1d]">
              <span className="flex items-center gap-2">
                <span className="text-[10px] font-light tracking-[0.25em] text-[#4a9eff]">📦 基础变量</span>
                <span className="text-[10px] text-[#6b6b70]">({BASE_VARIABLES.length} 个)</span>
              </span>
              <span className="text-[10px] text-[#6b6b70]">{varsCollapsed ? '展开' : '收起'}</span>
            </button>
            {!varsCollapsed && (
              <div className="max-h-[280px] overflow-y-auto p-3">
                <p className="mb-2 text-[10px] text-[#6b6b70]">点击 Get/Set 按钮将节点添加到画布</p>
                {BASE_VARIABLES.map((v) => (
                  <VariableItem key={v.name} variable={v} onAdd={(node, isSet) => addNode(node)} />
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            <p className="mb-3 text-[10px] font-light tracking-[0.25em] text-[#6b6b70]">节点库（点击或拖拽到画布）</p>
            {filteredLibrary.length === 0 ? (
              <p className="py-6 text-center text-[11px] text-[#4a4a4f]">没有匹配的节点</p>
            ) : (
              <div className="space-y-2">
                {filteredLibrary.map((node) => (
                  <LibraryItem key={node.id} node={node}
                    onAdd={() => addNode(node)}
                    onDragStart={handleLibraryDragStart}
                    onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, kind: 'canvas' }); }} />
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-[#1f1f22] px-3 py-2">
            <p className="text-[10px] font-light tracking-wider text-[#6b6b70]">
              共 {NODE_LIBRARY.length} 个节点
              {librarySearch && <span className="ml-2 text-[#e8704a]">已筛选 {filteredLibrary.length} 个</span>}
            </p>
          </div>
        </aside>

        <div ref={(el) => { (canvasRef as any).current = el; (tourCanvasRef as any).current = el; }}
          className={`relative flex-1 overflow-hidden transition-colors ${dropActive ? 'bg-[#111114]' : ''}`}
          onWheel={onWheel}
          onContextMenu={(e) => e.preventDefault()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onPointerDown={onCanvasPointerDown}
          onPointerUp={commitDragEnd}
          style={{
            backgroundImage: 'linear-gradient(#1a1a1d 1px, transparent 1px), linear-gradient(90deg, #1a1a1d 1px, transparent 1px)',
            backgroundSize: `${24 * scale}px ${24 * scale}px`,
            backgroundPosition: `${pan.x}px ${pan.y}px`,
            cursor: rightDragRef.current?.active ? 'grabbing' : panningRef.current?.active ? 'grabbing' : 'default',
            touchAction: 'none',
            userSelect: 'none',
            overscrollBehavior: 'contain',
          }}>
          {dropActive && <div className="pointer-events-none absolute inset-0 z-30 border-2 border-dashed border-[#e8704a]/60" />}

          {activeChapter && (
            <div ref={tourCardRef} className="absolute right-4 top-4 z-40 w-[340px] border border-[#4a9eff]/40 bg-[#141922]/95 shadow-2xl backdrop-blur-sm">
              <div className="flex items-center justify-between border-b border-[#4a9eff]/30 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-light tracking-[0.2em] text-[#4a9eff]">📖 当前章节</span>
                  <span className="text-[10px] text-[#6b6b70]">{activeChapter.lessonNo}</span>
                </div>
                <button type="button" onClick={closeChapter} className="text-[11px] text-[#6b6b70] hover:text-white" title="关闭">✕</button>
              </div>
              <div className="px-3 py-2">
                <p className="text-[12px] font-light text-[#e0e0e0]">{activeChapter.title}</p>
                <p className="mt-1 text-[10px] text-[#6b6b70]">
                  {'★'.repeat(activeChapter.difficulty)}{'☆'.repeat(5 - activeChapter.difficulty)} · {activeChapter.duration}
                </p>
                <p className="mt-2 text-[11px] leading-5 text-[#a0a0a5]">
                  <span className="text-[#4a9eff]">目标：</span>{activeChapter.goal}
                </p>
              </div>

              {activeChapter.concepts.length > 0 && (
                <div className="border-t border-[#1f1f22] px-3 py-2">
                  <p className="text-[10px] tracking-[0.15em] text-[#6b6b70]">涉及概念</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {activeChapter.concepts.map((c, i) => (
                      <span key={i} className="border border-[#2a2a2e] bg-[#151517] px-1.5 py-0.5 text-[10px] text-[#a0a0a5]">{c}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="max-h-[180px] overflow-y-auto border-t border-[#1f1f22] px-3 py-2">
                <p className="text-[10px] tracking-[0.15em] text-[#6b6b70]">步骤</p>
                <ol className="mt-1 space-y-1">
                  {activeChapter.steps.map((s, i) => (
                    <li key={i} className="flex gap-2 text-[11px] leading-5 text-[#c9c9cd]">
                      <span className="shrink-0 text-[#4a9eff]">{i + 1}.</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {chapterChecks.length > 0 && (
                <div className="border-t border-[#1f1f22] px-3 py-2">
                  <p className="text-[10px] tracking-[0.15em] text-[#6b6b70]">检查点</p>
                  <ul className="mt-1 space-y-1">
                    {chapterChecks.map((ck, i) => (
                      <li key={i} className={`flex items-center gap-2 text-[11px] ${ck.done ? 'text-[#4ade80]' : 'text-[#6b6b70]'}`}>
                        <span className="font-mono">{ck.done ? '✓' : '□'}</span>
                        <span>{ck.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex items-center justify-between border-t border-[#1f1f22] px-3 py-2">
                <a href="https://www.bilibili.com/video/BV1qYSvBHELW/" target="_blank" rel="noreferrer"
                  className="text-[10px] text-[#fb7299] hover:underline" title="打开 B站视频">
                  参考视频：{activeChapter.lessonNo} ↗
                </a>
                {activeChapter.templateId && <span className="text-[10px] text-[#4a9eff]">✓ 已加载示例</span>}
              </div>

              {activeChapter.commonErrors && activeChapter.commonErrors.length > 0 && (
                <div className="border-t border-[#1f1f22] px-3 py-2">
                  <p className="text-[10px] tracking-[0.15em] text-[#e8704a]">⚠ 常见错误</p>
                  <ul className="mt-1 space-y-0.5">
                    {activeChapter.commonErrors.map((e, i) => (
                      <li key={i} className="text-[10px] leading-5 text-[#a0a0a5]">· {e}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="relative"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
              transformOrigin: '0 0',
              width: 3000, height: 2000,
            }}>
            <svg className="pointer-events-none absolute inset-0" width={3000} height={2000}>
              {connectionPaths.map(({ c, d, p1, p2 }, idx) => {
                const isHighlight = highlighted.conns.has(c.id) || hoverConnectionId === c.id;
                const color = PORT_COLORS[c.type];
                return (
                  <g key={`${c.id}-${idx}`}>
                    <path d={d} fill="none" stroke="transparent" strokeWidth={14}
                      data-connection
                      style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                      onMouseEnter={() => setHoverConnectionId(c.id)}
                      onMouseLeave={() => setHoverConnectionId(null)}
                      onClick={(e) => { if (e.altKey) { e.stopPropagation(); deleteConnection(c.id); } }} />
                    <path d={d} fill="none" stroke={color} strokeWidth={isHighlight ? 3 : 2}
                      strokeOpacity={isHighlight ? 1 : 0.7}
                      style={{
                        filter: isHighlight && c.type === 'exec' ? `drop-shadow(0 0 6px ${color})` : undefined,
                        pointerEvents: 'none',
                      }} />
                    <circle cx={p1.x} cy={p1.y} r={3} fill={color} opacity={isHighlight ? 1 : 0.8} />
                    <circle cx={p2.x} cy={p2.y} r={3} fill={color} opacity={isHighlight ? 1 : 0.8} />
                  </g>
                );
              })}

              {previewPath && pendingFrom && (
                <path d={previewPath} fill="none"
                  stroke={pendingValid ? PORT_COLORS[pendingFrom.type] : '#ff3b3b'}
                  strokeWidth={2} strokeDasharray="6 4" opacity={0.95}
                  style={!pendingValid ? { filter: 'drop-shadow(0 0 6px #ff3b3b)' } : undefined} />
              )}
            </svg>

            {placed.map((n) => (
              <PlacedNodeView key={n.instanceId} node={n}
                selected={selectedIds.has(n.instanceId)}
                onDrag={handleDrag}
                onStartConnect={startConnect}
                onEndConnect={endConnect}
                connecting={!!pendingFrom}
                highlightedPorts={highlighted.ports}
                onContextMenu={onNodeContextMenu}
                onPortEnter={onPortEnter}
                onPortLeave={onPortLeave}
                onMouseDownSelect={onNodeMouseDownSelect} />
            ))}
          </div>
        </div>
      </div>

      {templateOpen && (
        <div className="fixed right-4 top-16 z-[120] w-80 border border-[#333] bg-[#1a1a1c] shadow-2xl">
          <div className="flex items-center justify-between border-b border-[#2a2a2e] px-3 py-2">
            <p className="text-xs font-light tracking-wider text-[#f0f0f0]">蓝图模板</p>
            <button type="button" onClick={() => setTemplateOpen(false)} className="text-[11px] text-[#6b6b70] hover:text-white">✕</button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto p-2">
            {TEMPLATES.map((tpl) => (
              <button key={tpl.id} type="button" onClick={() => loadTemplate(tpl)}
                className="mb-2 block w-full border border-[#2a2a2e] bg-[#151517] p-3 text-left transition-colors hover:border-[#e8704a]">
                <p className="text-xs font-light text-[#f0f0f0]">{tpl.name}</p>
                <p className="mt-0.5 text-[10px] text-[#8b8b8f]">{tpl.desc}</p>
                <p className="mt-1 text-[10px] text-[#6b6b70]">{tpl.nodes.length} 个节点 · {tpl.connections.length} 条连线</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {menu && (
        <div className="fixed z-[100] w-48 border border-[#333] bg-[#1a1a1c] py-1 shadow-2xl"
          style={{ left: menu.x, top: menu.y }} onClick={(e) => e.stopPropagation()}>
          {menu.kind === 'canvas' && (
            <>
              <p className="px-3 py-1.5 text-[10px] tracking-wider text-[#6b6b70]">添加节点</p>
              <div className="max-h-80 overflow-y-auto">
                {NODE_LIBRARY.map((n) => (
                  <button key={n.id} type="button"
                    className="block w-full px-3 py-1.5 text-left text-[11px] text-[#c9c9cd] hover:bg-[#26262a]"
                    onClick={() => {
                      const world = (window as any).__contextWorld ?? { x: 100, y: 100 };
                      addNode(n, world.x, world.y);
                      setMenu(null);
                    }}>
                    <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: n.color }} />
                    {n.title}
                  </button>
                ))}
              </div>
            </>
          )}
          {menu.kind === 'node' && menu.instanceId && (
            <button type="button"
              className="block w-full px-3 py-1.5 text-left text-[11px] text-[#ff6b6b] hover:bg-[#26262a]"
              onClick={() => {
                setPlaced((prev) => {
                  const next = prev.filter((n) => n.instanceId !== menu.instanceId);
                  const nextConns = connections.filter((c) => c.fromInstance !== menu.instanceId && c.toInstance !== menu.instanceId);
                  setConnections(nextConns);
                  pushHistory({ placed: next, connections: nextConns });
                  return next;
                });
                setMenu(null);
              }}>
              删除节点
            </button>
          )}
        </div>
      )}

      <div className="pointer-events-none fixed bottom-3 right-4 z-40 text-[10px] text-[#4a4a4f]">
        节点 {placed.length} · 连线 {connections.length} · 选中 {selectedIds.size} · 历史 {historyIndex + 1}/{history.length}
      </div>

      {tourActive && (() => {
        const step = TOUR_STEPS[tourStep];
        let ref: React.RefObject<HTMLElement | null> = tourChaptersRef as any;
        if (step.key === 'nodelib') ref = tourNodeLibRef as any;
        else if (step.key === 'canvas') ref = tourCanvasRef as any;
        else if (step.key === 'chapter-card') ref = tourCardRef as any;
        return (
          <Tour step={step} targetRef={ref} isLast={tourStep === TOUR_STEPS.length - 1}
            onNext={() => {
              if (tourStep < TOUR_STEPS.length - 1) setTourStep(tourStep + 1);
              else finishTour();
            }}
            onPrev={() => setTourStep((s) => Math.max(0, s - 1))}
            onSkip={finishTour} />
        );
      })()}
    </div>
  );
}