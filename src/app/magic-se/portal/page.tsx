'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  PortType, Port, NodeData, PlacedNode, Connection, EditorState, Template,
  PORT_COLORS, PORT_LABELS, NODE_COLORS, NODE_WIDTH, HEADER_H, PORT_ROW_H, PORT_AREA_PT, PORT_DOT_OFFSET, DRAG_MIME,
  NODE_LIBRARY, TEMPLATES, TUTORIAL_CHAPTERS, TutorialChapter,
  sortPorts, getPortPosition, bezierPath, uid, isTypeCompatible,
} from '@/app/magic-se/data/nodeLibrary';
import { BASE_VARIABLES, makeGetNode, makeSetNode } from '@/app/magic-se/data/variables';
import { GLOSSARY } from '@/app/magic-se/data/glossary';
import { runStaticChecks, type CheckResult } from '@/app/magic-se/data/checks';
import { simulate, type SimResult } from '@/app/magic-se/data/simulator';
import {
  saveBlueprint, loadBlueprint, exportBlueprint, importBlueprint,
  loadFavorites, saveFavorites, loadTabs, saveTabs, type TabData,
} from '@/app/magic-se/data/storage';

const VAR_PICK_MIME = 'application/x-magic-var';
const GOLD = '#e8b04a';
const GOLD_SOFT = 'rgba(232,176,74,0.5)';
const MINT = '#4cc9a8';

/* ==================== 粒子背景 ==================== */
function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let w = canvas.width = window.innerWidth;
    let h = canvas.height = window.innerHeight;
    const particles: { x: number; y: number; vx: number; vy: number; r: number; a: number; c: string }[] = [];
    for (let i = 0; i < 70; i++) {
      particles.push({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.22, vy: (Math.random() - 0.5) * 0.22,
        r: Math.random() * 1.8 + 0.3, a: Math.random() * 0.55 + 0.15,
        c: Math.random() < 0.55 ? GOLD : MINT,
      });
    }
    const onResize = () => { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; };
    window.addEventListener('resize', onResize);
    let raf = 0;
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < -10) p.x = w + 10; if (p.x > w + 10) p.x = -10;
        if (p.y < -10) p.y = h + 10; if (p.y > h + 10) p.y = -10;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.c === GOLD ? `rgba(232, 176, 74, ${p.a})` : `rgba(76, 201, 168, ${p.a})`;
        ctx.fill();
      }
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 140) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(232, 176, 74, ${(1 - dist / 140) * 0.09})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); };
  }, []);
  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-0" aria-hidden="true" />;
}

/* ==================== 分段渲染 ==================== */
function renderCommonScene(text: string) {
  const segments: { title: string; body: string }[] = [];
  const regex = /【([^】]+)】([^【]*)/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) segments.push({ title: m[1], body: m[2].trim() });
  if (segments.length === 0) return <p className="text-[10px] leading-5 text-[#a0a0a5]">{text}</p>;
  return (
    <>
      {segments.map((seg, i) => (
        <div key={i} className={i === 0 ? '' : 'mt-2'}>
          <p className="text-[10px] font-medium leading-4" style={{ color: GOLD }}>【{seg.title}】</p>
          <p className="mt-0.5 text-[10px] leading-5 text-[#a0a0a5]">{seg.body}</p>
        </div>
      ))}
    </>
  );
}

/* ==================== 快捷键 ==================== */
const SHORTCUTS: { keys: string; desc: string }[] = [
  { keys: 'Del / Backspace', desc: '删除选中的节点' },
  { keys: 'Ctrl + Z',        desc: '撤销上一步' },
  { keys: 'Ctrl + Shift + Z',desc: '重做（或 Ctrl + Y）' },
  { keys: 'Ctrl + C',        desc: '复制选中的节点' },
  { keys: 'Ctrl + V',        desc: '粘贴节点' },
  { keys: 'Ctrl + D',        desc: '原地复制节点' },
  { keys: 'Ctrl + A',        desc: '全选所有节点' },
  { keys: 'F',               desc: '聚焦到选中的节点' },
  { keys: 'Esc',             desc: '取消选中 / 关闭菜单' },
  { keys: 'Alt + 左键 (端口)', desc: '切断该端口上的所有连线' },
  { keys: 'Alt + 左键 (连线)', desc: '切断该条连线' },
  { keys: '右键点击连线',      desc: '弹出菜单 → 删除此连线' },
  { keys: '左键拖拽空白',      desc: '框选多个节点' },
  { keys: '右键拖拽画布',      desc: '平移画布' },
  { keys: '右键单击画布',      desc: '打开节点添加菜单' },
  { keys: '滚轮',             desc: '缩放画布' },
  { keys: 'Ctrl + 拖动变量',   desc: '快速添加 Get 节点' },
  { keys: 'Alt + 拖动变量',    desc: '快速添加 Set 节点' },
];

/* ==================== Tour ==================== */
interface TourStep {
  key: 'chapters' | 'nodelib' | 'canvas' | 'chapter-card';
  title: string; body: string;
  placement?: 'right' | 'left' | 'bottom' | 'top';
}
const TOUR_STEPS: TourStep[] = [
  { key: 'chapters', title: '从教程开始', body: '不知从哪下手？左栏顶部是 12 章教程，从入门到实战，每章都能一键加载示例蓝图。', placement: 'right' },
  { key: 'nodelib', title: '节点库', body: '这里列出所有可用节点。点击或拖拽到画布即可使用。鼠标悬停能看到每个节点的说明。', placement: 'right' },
  { key: 'canvas', title: '画布', body: '把节点拖到这里，组成你的蓝图。每个节点左边是输入端口、右边是输出端口。', placement: 'bottom' },
  { key: 'chapter-card', title: '章节目标卡', body: '点开一章教程后，这里会显示该章的目标、步骤、检查点，还会实时勾选你的进度。', placement: 'left' },
];

function TourCard({ step, onNext, onPrev, onSkip, isLast }: {
  step: TourStep; onNext: () => void; onPrev: () => void; onSkip: () => void; isLast: boolean;
}) {
  return (
    <div className="p-5">
      <p className="text-sm font-medium" style={{ color: GOLD }}>{step.title}</p>
      <p className="mt-2 text-[12px] leading-6 text-[#c9c9cd]">{step.body}</p>
      <div className="mt-4 flex items-center justify-between">
        <button type="button" onClick={onSkip} className="text-[11px] text-[#6b6b70] hover:text-white">跳过引导</button>
        <div className="flex gap-2">
          <button type="button" onClick={onPrev} className="border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-[#c9c9cd] hover:border-[#e8b04a]">上一步</button>
          <button type="button" onClick={onNext} className="border px-3 py-1 text-[11px]"
            style={{ borderColor: GOLD, color: GOLD, background: 'rgba(232,176,74,0.08)' }}>
            {isLast ? '完成' : '下一步'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Tour({ step, targetRef, onNext, onPrev, onSkip, isLast }: {
  step: TourStep; targetRef: React.RefObject<HTMLElement | null>;
  onNext: () => void; onPrev: () => void; onSkip: () => void; isLast: boolean;
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
    return () => { window.clearInterval(id); window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true); };
  }, [targetRef]);
  if (!mounted) return null;
  if (!rect) {
    return createPortal(
      <div className="pointer-events-none fixed inset-0 z-[300]">
        <div className="pointer-events-auto absolute inset-0 bg-black/70 backdrop-blur-sm" />
        <div className="pointer-events-auto absolute left-1/2 top-1/2 w-[380px] -translate-x-1/2 -translate-y-1/2 border border-white/10 bg-black/70 shadow-2xl backdrop-blur-xl">
          <TourCard step={step} onNext={onNext} onPrev={onPrev} onSkip={onSkip} isLast={isLast} />
        </div>
      </div>, document.body);
  }
  const PAD = 8;
  const left = Math.max(0, rect.left - PAD);
  const top = Math.max(0, rect.top - PAD);
  const right = Math.min(window.innerWidth, rect.right + PAD);
  const bottom = Math.min(window.innerHeight, rect.bottom + PAD);
  const boxW = right - left, boxH = bottom - top;
  const CARD_W = 360, CARD_H = 220, GAP = 16;
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
    else { cardLeft = window.innerWidth / 2 - CARD_W / 2; cardTop = window.innerHeight / 2 - CARD_H / 2; }
  }
  cardLeft = Math.max(8, Math.min(window.innerWidth - CARD_W - 8, cardLeft));
  cardTop = Math.max(8, Math.min(window.innerHeight - CARD_H - 8, cardTop));
  const tourNode = (
    <div className="pointer-events-none fixed inset-0 z-[300]">
      <div className="pointer-events-auto absolute bg-black/60 backdrop-blur-[2px]" style={{ left: 0, top: 0, right: 0, height: top }} />
      <div className="pointer-events-auto absolute bg-black/60 backdrop-blur-[2px]" style={{ left: 0, bottom: 0, right: 0, top: bottom }} />
      <div className="pointer-events-auto absolute bg-black/60 backdrop-blur-[2px]" style={{ left: 0, top, width: left, height: boxH }} />
      <div className="pointer-events-auto absolute bg-black/60 backdrop-blur-[2px]" style={{ right: 0, top, left: right, height: boxH }} />
      <div className="pointer-events-none absolute border-2"
        style={{ left, top, width: boxW, height: boxH, borderColor: GOLD, boxShadow: `0 0 0 1px ${GOLD_SOFT}, 0 0 32px ${GOLD_SOFT}` }} />
      <div className="pointer-events-auto absolute border border-white/10 bg-black/70 shadow-2xl backdrop-blur-xl"
        style={{ left: cardLeft, top: cardTop, width: CARD_W }}>
        <TourCard step={step} onNext={onNext} onPrev={onPrev} onSkip={onSkip} isLast={isLast} />
      </div>
    </div>
  );
  return createPortal(tourNode, document.body);
}

/* ==================== 磨砂面板 ==================== */
function DraggablePanel({ title, initial, children, onMinimize, onClose, zIndex, onFocus }: {
  title: string; initial: { x: number; y: number }; children: React.ReactNode;
  onMinimize?: () => void; onClose?: () => void; zIndex: number; onFocus: () => void;
}) {
  const [pos, setPos] = useState(initial);
  const dragRef = useRef<{ active: boolean; dx: number; dy: number } | null>(null);
  const onDown = (e: React.MouseEvent) => { dragRef.current = { active: true, dx: e.clientX - pos.x, dy: e.clientY - pos.y }; };
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d?.active) return;
      setPos({ x: Math.max(0, Math.min(window.innerWidth - 200, e.clientX - d.dx)), y: Math.max(0, Math.min(window.innerHeight - 40, e.clientY - d.dy)) });
    };
    const onUp = () => { if (dragRef.current) dragRef.current.active = false; };
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);
  return (
    <div className="fixed overflow-hidden rounded-md border border-white/10 bg-black/50 shadow-[0_8px_40px_rgba(0,0,0,0.65)] backdrop-blur-2xl"
      style={{ left: pos.x, top: pos.y, minWidth: 280, zIndex }} onMouseDown={onFocus}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e8b04a]/60 to-transparent" />
      <div onMouseDown={onDown}
        className="flex cursor-move items-center justify-between border-b border-white/5 bg-white/[0.03] px-3 py-2 select-none">
        <p className="text-xs font-light tracking-wider text-[#e8e8e8]">{title}</p>
        <div className="flex items-center gap-2">
          {onMinimize && <button type="button" onClick={onMinimize} className="text-[12px] text-[#6b6b70] hover:text-white">—</button>}
          {onClose && <button type="button" onClick={onClose} className="text-[12px] text-[#6b6b70] hover:text-white">✕</button>}
        </div>
      </div>
      {children}
    </div>
  );
}

/* ==================== 快捷键面板 ==================== */
function ShortcutPanel({ onClose, zIndex = 200 }: { onClose: () => void; zIndex?: number }) {
  const [show, setShow] = useState(false);
  useEffect(() => { const id = requestAnimationFrame(() => setShow(true)); return () => cancelAnimationFrame(id); }, []);
  const close = () => { setShow(false); setTimeout(onClose, 180); };
  return createPortal(
    <div className="fixed inset-0 flex items-start justify-center pt-20 transition-opacity duration-200"
      style={{ opacity: show ? 1 : 0, zIndex }} onClick={close}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative w-[420px] overflow-hidden rounded-md border border-white/10 bg-black/60 shadow-2xl backdrop-blur-2xl transition-all duration-200"
        style={{ transform: show ? 'scale(1)' : 'scale(0.95)', opacity: show ? 1 : 0 }} onClick={(e) => e.stopPropagation()}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e8b04a]/60 to-transparent" />
        <div className="flex items-center justify-between border-b border-white/5 bg-white/[0.03] px-4 py-3">
          <p className="flex items-center gap-2 text-xs font-light tracking-wider text-[#e8e8e8]">
            <span style={{ color: GOLD }}>⌨</span> 快捷键提示
          </p>
          <button type="button" onClick={close} className="text-[12px] text-[#6b6b70] hover:text-white">✕</button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-3">
          {SHORTCUTS.map((s, i) => (
            <div key={i} className="flex items-center justify-between border-b border-white/5 px-1 py-2 last:border-b-0">
              <span className="text-[11px] text-[#c9c9cd]">{s.desc}</span>
              <span className="ml-3 shrink-0 rounded border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[10px]"
                style={{ color: GOLD }}>{s.keys}</span>
            </div>
          ))}
        </div>
      </div>
    </div>, document.body);
}

/* ==================== 术语速查 ==================== */
function GlossaryPanel({ onClose, zIndex = 210 }: { onClose: () => void; zIndex?: number }) {
  const [show, setShow] = useState(false);
  const [kw, setKw] = useState('');
  const [cat, setCat] = useState<string>('全部');
  useEffect(() => { const id = requestAnimationFrame(() => setShow(true)); return () => cancelAnimationFrame(id); }, []);
  const close = () => { setShow(false); setTimeout(onClose, 180); };
  const categories = ['全部', '基础', '事件', '流程', '类型', '变换', 'UI', '音频', '存档'];
  const filtered = GLOSSARY.filter((g) => {
    if (cat !== '全部' && g.category !== cat) return false;
    const q = kw.trim().toLowerCase();
    if (!q) return true;
    return g.term.toLowerCase().includes(q) || g.cn.includes(q) || g.desc.toLowerCase().includes(q);
  });
  return createPortal(
    <div className="fixed inset-0 flex items-start justify-center pt-20 transition-opacity duration-200"
      style={{ opacity: show ? 1 : 0, zIndex }} onClick={close}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative flex max-h-[80vh] w-[640px] flex-col overflow-hidden rounded-md border border-white/10 bg-black/70 shadow-2xl backdrop-blur-2xl transition-all duration-200"
        style={{ transform: show ? 'scale(1)' : 'scale(0.95)', opacity: show ? 1 : 0 }} onClick={(e) => e.stopPropagation()}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e8b04a]/60 to-transparent" />
        <div className="flex items-center justify-between border-b border-white/5 bg-white/[0.03] px-4 py-3">
          <p className="flex items-center gap-2 text-xs font-light tracking-wider text-[#e8e8e8]">
            <span style={{ color: GOLD }}>📖</span> 术语速查表
            <span className="text-[10px] text-[#6b6b70]">（{GLOSSARY.length} 条）</span>
          </p>
          <button type="button" onClick={close} className="text-[12px] text-[#6b6b70] hover:text-white">✕</button>
        </div>
        <div className="border-b border-white/5 p-3">
          <input type="text" value={kw} onChange={(e) => setKw(e.target.value)}
            placeholder="搜索术语（英文 / 中文 / 描述）"
            className="w-full rounded-sm border border-white/10 bg-black/40 px-3 py-2 text-[11px] text-[#e8e8e8] placeholder:text-[#4a4f56] focus:border-[#e8b04a] focus:outline-none" />
          <div className="mt-2 flex flex-wrap gap-1">
            {categories.map((c) => (
              <button key={c} type="button" onClick={() => setCat(c)}
                className={`rounded-sm border px-2 py-0.5 text-[10px] transition-colors ${
                  cat === c ? 'border-[#e8b04a]/60 bg-[#e8b04a]/15 text-[#e8b04a]' : 'border-white/10 bg-white/[0.02] text-[#8b8b8f] hover:border-[#e8b04a]/40 hover:text-[#e8b04a]'
                }`}>{c}</button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-[11px] text-[#4a4f56]">没有匹配的术语</p>
          ) : (
            filtered.map((g) => (
              <div key={g.term} className="mb-2 overflow-hidden rounded-md border border-white/5 bg-white/[0.02] p-3">
                <div className="flex items-baseline justify-between">
                  <p className="text-[12px] font-medium text-[#e8e8e8]">
                    {g.term}<span className="ml-2 text-[10px]" style={{ color: GOLD }}>{g.cn}</span>
                  </p>
                  <span className="rounded-sm border border-white/10 px-1.5 py-0.5 text-[9px] text-[#8b8b8f]">{g.category}</span>
                </div>
                <p className="mt-1.5 text-[11px] leading-5 text-[#a0a0a5]">{g.desc}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>, document.body);
}

/* ==================== 静态检查 ==================== */
function CheckPanel({ results, onClose, onFocusNode, zIndex = 215 }: {
  results: CheckResult[]; onClose: () => void; onFocusNode?: (nodeId: string) => void; zIndex?: number;
}) {
  const [show, setShow] = useState(false);
  useEffect(() => { const id = requestAnimationFrame(() => setShow(true)); return () => cancelAnimationFrame(id); }, []);
  const close = () => { setShow(false); setTimeout(onClose, 180); };
  const errCount = results.filter((r) => r.level === 'error').length;
  const warnCount = results.filter((r) => r.level === 'warning').length;
  const okCount = results.filter((r) => r.level === 'info').length;
  const colorOf = (level: string) => level === 'error' ? '#ff6b6b' : level === 'warning' ? GOLD : MINT;
  const iconOf = (level: string) => level === 'error' ? '✕' : level === 'warning' ? '⚠' : 'ℹ';
  return createPortal(
    <div className="fixed inset-0 flex items-start justify-center pt-20 transition-opacity duration-200"
      style={{ opacity: show ? 1 : 0, zIndex }} onClick={close}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative flex max-h-[80vh] w-[560px] flex-col overflow-hidden rounded-md border border-white/10 bg-black/70 shadow-2xl backdrop-blur-2xl transition-all duration-200"
        style={{ transform: show ? 'scale(1)' : 'scale(0.95)', opacity: show ? 1 : 0 }} onClick={(e) => e.stopPropagation()}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e8b04a]/60 to-transparent" />
        <div className="flex items-center justify-between border-b border-white/5 bg-white/[0.03] px-4 py-3">
          <p className="flex items-center gap-2 text-xs font-light tracking-wider text-[#e8e8e8]">
            <span style={{ color: GOLD }}>🔍</span> 静态检查
            <span className="ml-2 flex gap-2 text-[10px]">
              {errCount > 0 && <span className="text-[#ff6b6b]">✕ {errCount}</span>}
              {warnCount > 0 && <span style={{ color: GOLD }}>⚠ {warnCount}</span>}
              <span style={{ color: MINT }}>ℹ {okCount}</span>
            </span>
          </p>
          <button type="button" onClick={close} className="text-[12px] text-[#6b6b70] hover:text-white">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {results.map((r) => (
            <div key={r.id}
              className={`mb-2 flex items-start gap-2 rounded-md border border-white/5 bg-white/[0.02] p-3 ${r.relatedNodeIds ? 'cursor-pointer hover:bg-white/[0.04]' : ''}`}
              onClick={() => { if (r.relatedNodeIds && onFocusNode) { onFocusNode(r.relatedNodeIds[0]); close(); } }}>
              <span className="mt-0.5 shrink-0 font-mono text-[12px]" style={{ color: colorOf(r.level) }}>{iconOf(r.level)}</span>
              <p className="text-[11px] leading-5 text-[#c9c9cd]">{r.message}</p>
            </div>
          ))}
        </div>
      </div>
    </div>, document.body);
}/* ==================== 模拟运行面板 ==================== */
function SimPanel({ result, onClose, onFocusNode, zIndex = 320 }: {
  result: SimResult; onClose: () => void;
  onFocusNode?: (nodeId: string) => void; zIndex?: number;
}) {
  const [show, setShow] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  useEffect(() => { const id = requestAnimationFrame(() => setShow(true)); return () => cancelAnimationFrame(id); }, []);
  const close = () => { setShow(false); setTimeout(onClose, 180); };
  const isLast = currentStep >= result.steps.length - 1;
  return createPortal(
    <div className="fixed inset-0 flex items-start justify-center pt-20 transition-opacity duration-200"
      style={{ opacity: show ? 1 : 0, zIndex }} onClick={close}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative flex max-h-[80vh] w-[560px] flex-col overflow-hidden rounded-md border border-white/10 bg-black/70 shadow-2xl backdrop-blur-2xl transition-all duration-200"
        style={{ transform: show ? 'scale(1)' : 'scale(0.95)', opacity: show ? 1 : 0 }} onClick={(e) => e.stopPropagation()}>
        <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e8b04a]/60 to-transparent" />
        <div className="flex items-center justify-between border-b border-white/5 bg-white/[0.03] px-4 py-3">
          <p className="flex items-center gap-2 text-xs font-light tracking-wider text-[#e8e8e8]">
            <span style={{ color: MINT }}>▶</span> 模拟运行
            <span className="text-[10px] text-[#6b6b70]">
              {result.error ? '出错' : `第 ${currentStep + 1} / ${result.steps.length} 步`}
            </span>
          </p>
          <button type="button" onClick={close} className="text-[12px] text-[#6b6b70] hover:text-white">✕</button>
        </div>
        {result.error ? (
          <div className="p-4 text-[12px] text-[#ff6b6b]">{result.error}</div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-3">
              {result.steps.slice(0, currentStep + 1).map((s, i) => (
                <div key={i}
                  className={`mb-2 flex items-start gap-2 rounded-md border p-3 transition-all ${
                    i === currentStep ? 'border-[#e8b04a]/50 bg-[#e8b04a]/[0.08] shadow-[0_0_16px_rgba(232,176,74,0.2)]' : 'border-white/5 bg-white/[0.02]'
                  }`}
                  onClick={() => { setCurrentStep(i); onFocusNode?.(s.nodeId); }}>
                  <span className="mt-0.5 shrink-0 font-mono text-[10px]" style={{ color: GOLD }}>{i + 1}</span>
                  <div className="flex-1">
                    <p className="text-[11px] font-medium text-[#e8e8e8]">{s.title}</p>
                    {s.outputs.length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        {s.outputs.map((o) => (
                          <p key={o.portIndex} className="text-[10px] text-[#8b8b8f]">
                            · {o.portName} = <span style={{ color: MINT }}>{o.value}</span>
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {result.logs.length > 0 && (
              <div className="border-t border-white/5 bg-black/40 p-3">
                <p className="mb-1 text-[10px] tracking-wider text-[#6b6b70]">📋 输出日志</p>
                {result.logs.map((l, i) => (
                  <p key={i} className="font-mono text-[11px]" style={{ color: MINT }}>&gt; {l}</p>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between border-t border-white/5 px-4 py-3">
              <button type="button"
                onClick={() => {
                  if (currentStep > 0) { setCurrentStep(currentStep - 1); onFocusNode?.(result.steps[currentStep - 1].nodeId); }
                }}
                disabled={currentStep === 0}
                className={`rounded-sm border px-3 py-1 text-[11px] ${
                  currentStep > 0 ? 'border-white/10 bg-white/[0.02] text-[#c9c9cd] hover:border-[#e8b04a]/50' : 'border-white/5 text-[#4a4f56] cursor-not-allowed'
                }`}>上一步</button>
              <span className="text-[10px] text-[#6b6b70]">{isLast ? '✓ 执行完毕' : '点击下一步继续'}</span>
              <button type="button"
                onClick={() => {
                  if (!isLast) { setCurrentStep(currentStep + 1); onFocusNode?.(result.steps[currentStep + 1].nodeId); }
                }}
                disabled={isLast}
                className={`rounded-sm border px-3 py-1 text-[11px] ${
                  !isLast ? 'border-[#e8b04a]/50 bg-[#e8b04a]/10 text-[#e8b04a] hover:bg-[#e8b04a]/20' : 'border-white/5 text-[#4a4f56] cursor-not-allowed'
                }`}>{isLast ? '已完成' : '下一步'}</button>
            </div>
          </>
        )}
      </div>
    </div>, document.body);
}

/* ==================== 收藏夹面板 ==================== */
function FavoritesPanel({ favorites, allNodes, onAdd, onRemove, onDragStart, onClose, zIndex = 220 }: {
  favorites: string[]; allNodes: NodeData[];
  onAdd: (node: NodeData) => void;
  onRemove: (id: string) => void;
  onDragStart: (e: React.DragEvent, node: NodeData) => void;
  onClose: () => void; zIndex?: number;
}) {
  const [show, setShow] = useState(false);
  useEffect(() => { const id = requestAnimationFrame(() => setShow(true)); return () => cancelAnimationFrame(id); }, []);
  const close = () => { setShow(false); setTimeout(onClose, 180); };
  const favNodes = favorites.map((id) => allNodes.find((n) => n.id === id)).filter(Boolean) as NodeData[];
  return createPortal(
    <div className="fixed inset-0 flex items-start justify-center pt-20 transition-opacity duration-200"
      style={{ opacity: show ? 1 : 0, zIndex }} onClick={close}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative flex max-h-[70vh] w-[400px] flex-col overflow-hidden rounded-md border border-white/10 bg-black/70 shadow-2xl backdrop-blur-2xl transition-all duration-200"
        style={{ transform: show ? 'scale(1)' : 'scale(0.95)', opacity: show ? 1 : 0 }} onClick={(e) => e.stopPropagation()}>
        <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e8b04a]/60 to-transparent" />
        <div className="flex items-center justify-between border-b border-white/5 bg-white/[0.03] px-4 py-3">
          <p className="flex items-center gap-2 text-xs font-light tracking-wider text-[#e8e8e8]">
            <span style={{ color: GOLD }}>⭐</span> 我的收藏
            <span className="text-[10px] text-[#6b6b70]">（{favNodes.length} 个）</span>
          </p>
          <button type="button" onClick={close} className="text-[12px] text-[#6b6b70] hover:text-white">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {favNodes.length === 0 ? (
            <p className="py-8 text-center text-[11px] leading-5 text-[#4a4f56]">
              还没有收藏任何节点<br />点击节点卡片右上角的 ☆ 收藏
            </p>
          ) : (
            <div className="space-y-2">
              {favNodes.map((n) => (
                <div key={n.id} className="group relative flex items-center gap-2 rounded-md border border-white/5 bg-white/[0.02] p-2 transition-all hover:border-[#e8b04a]/40">
                  <span className="absolute left-0 top-0 h-full w-[2px]" style={{ background: n.color }} />
                  <button type="button" draggable onClick={() => { onAdd(n); close(); }}
                    onDragStart={(e) => onDragStart(e, n)}
                    className="flex-1 cursor-grab text-left">
                    <p className="text-[11px] text-[#e8e8e8]">{n.title}</p>
                    <p className="mt-0.5 text-[10px] text-[#6b6b70]">{n.category}</p>
                  </button>
                  <button type="button" onClick={() => onRemove(n.id)}
                    className="shrink-0 text-[11px] text-[#6b6b70] opacity-0 transition-opacity hover:text-[#ff6b6b] group-hover:opacity-100"
                    title="取消收藏">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>, document.body);
}

/* ==================== 画布缩略图 ==================== */
function Minimap({ placed, pan, scale, canvasSize, onJump }: {
  placed: PlacedNode[];
  pan: { x: number; y: number };
  scale: number;
  canvasSize: { w: number; h: number };
  onJump: (worldX: number, worldY: number) => void;
}) {
  const MAP_W = 180, MAP_H = 120;
  const WORLD_W = 3000, WORLD_H = 2000;
  const toMap = (x: number, y: number) => ({
    mx: (x / WORLD_W) * MAP_W,
    my: (y / WORLD_H) * MAP_H,
  });
  const vpWorldX = -pan.x / scale;
  const vpWorldY = -pan.y / scale;
  const vpWorldW = canvasSize.w / scale;
  const vpWorldH = canvasSize.h / scale;
  const vp = toMap(vpWorldX, vpWorldY);
  const vpW = (vpWorldW / WORLD_W) * MAP_W;
  const vpH = (vpWorldH / WORLD_H) * MAP_H;
  return (
    <div className="pointer-events-auto fixed bottom-12 right-4 z-40 overflow-hidden rounded-md border border-white/10 bg-black/60 backdrop-blur-xl"
      style={{ width: MAP_W, height: MAP_H, cursor: 'crosshair' }}
      onClick={(e) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        onJump((mx / MAP_W) * WORLD_W, (my / MAP_H) * WORLD_H);
      }}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e8b04a]/60 to-transparent" />
      {placed.map((n) => {
        const { mx, my } = toMap(n.x, n.y);
        return (
          <div key={n.instanceId} className="pointer-events-none absolute rounded-sm"
            style={{
              left: mx, top: my,
              width: Math.max(2, (NODE_WIDTH / WORLD_W) * MAP_W),
              height: Math.max(2, (60 / WORLD_H) * MAP_H),
              background: n.color, opacity: 0.7,
            }} />
        );
      })}
      <div className="pointer-events-none absolute border"
        style={{
          left: vp.mx, top: vp.my,
          width: Math.max(4, vpW), height: Math.max(4, vpH),
          borderColor: GOLD, background: 'rgba(232,176,74,0.12)',
          boxShadow: `0 0 8px ${GOLD_SOFT}`,
        }} />
    </div>
  );
}

/* ==================== 内联输入框 ==================== */
function InlineInput({ port, value, connected, onChange }: {
  port: Port; value: string; connected: boolean; onChange: (v: string) => void;
}) {
  if (connected) return <span className="ml-1 shrink-0 text-[10px] text-[#6b6b70] italic">{value || '已连线'}</span>;
  const isText = port.type === 'string';
  const isBool = port.type === 'bool';
  const isVec = port.type === 'vector';
  const isRot = port.type === 'rotator';
  if (isBool) {
    return (
      <label className="ml-1 flex shrink-0 cursor-pointer items-center gap-1 text-[10px] text-[#c9c9cd]">
        <input type="checkbox" checked={value === 'true'}
          onChange={(e) => onChange(e.target.checked ? 'true' : 'false')}
          className="h-3 w-3 cursor-pointer" style={{ accentColor: GOLD }} />
      </label>
    );
  }
  if (isVec || isRot) {
    const parts = (value || '0,0,0').split(',');
    const labels = isVec ? ['X', 'Y', 'Z'] : ['P', 'Y', 'R'];
    return (
      <div className="ml-1 flex shrink-0 items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
        {labels.map((lbl, i) => (
          <div key={i} className="flex items-center">
            <span className="text-[9px] text-[#6b6b70]">{lbl}</span>
            <input type="text" value={parts[i] ?? '0'}
              onChange={(e) => { const next = [...parts]; next[i] = e.target.value; onChange(next.join(',')); }}
              className="w-8 rounded-sm border border-white/10 bg-black/40 px-1 py-0.5 text-[10px] text-[#e0e0e0] focus:border-[#e8b04a] focus:outline-none" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <input type="text" value={value}
      onChange={(e) => onChange(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      placeholder={isText ? '输入文本' : '0'}
      className={`ml-1 shrink-0 rounded-sm border border-white/10 bg-black/40 px-1 py-0.5 text-[10px] text-[#e0e0e0] placeholder:text-[#4a4f56] focus:border-[#e8b04a] focus:outline-none ${isText ? 'w-28' : 'w-16'}`} />
  );
}

/* ==================== 基础变量条目 ==================== */
function VariableItem({ variable, onPick }: {
  variable: typeof BASE_VARIABLES[0];
  onPick: (variable: typeof BASE_VARIABLES[0], mode: 'get' | 'set' | null) => void;
}) {
  const [hover, setHover] = useState(false);
  const [tipPos, setTipPos] = useState({ x: 0, y: 0 });
  const itemRef = useRef<HTMLDivElement>(null);
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData(VAR_PICK_MIME, variable.key);
    e.dataTransfer.setData('text/plain', variable.key);
    e.dataTransfer.effectAllowed = 'copy';
  };
  const updateTipPos = () => {
    const el = itemRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const tipWidth = 340;
    let x = r.right + 8;
    if (x + tipWidth > window.innerWidth - 8) x = r.left - tipWidth - 8;
    if (x < 8) x = Math.max(8, window.innerWidth - tipWidth - 8);
    const tipHeight = 300;
    let y = r.top;
    if (y + tipHeight > window.innerHeight - 8) y = window.innerHeight - tipHeight - 8;
    if (y < 8) y = 8;
    setTipPos({ x, y });
  };
  return (
    <>
      <div ref={itemRef} draggable onDragStart={handleDragStart}
        onMouseEnter={() => { setHover(true); updateTipPos(); }}
        onMouseLeave={() => setHover(false)}
        className="group relative mb-2 cursor-grab overflow-hidden rounded-md border border-white/5 bg-white/[0.02] p-2 transition-all hover:border-[#e8b04a]/40 hover:bg-white/[0.04] hover:shadow-[0_0_20px_rgba(232,176,74,0.15)] active:cursor-grabbing"
        title="拖到画布：Ctrl 拖 = 获取，Alt 拖 = 设置，直接拖 = 弹窗选择">
        <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e8b04a]/70 to-transparent opacity-0 group-hover:opacity-100" />
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-light text-[#e8e8e8]">
            {variable.label}<span className="ml-1 text-[10px] text-[#6b6b70]">{variable.key}</span>
          </span>
          <span className="h-2 w-2 rounded-full" style={{ background: PORT_COLORS[variable.type], boxShadow: `0 0 6px ${PORT_COLORS[variable.type]}80` }} />
        </div>
        <p className="mt-1 text-[10px] leading-4 text-[#8b8b8f]">{variable.desc}</p>
        <div className="mt-1.5 flex gap-1">
          <button type="button" onClick={(e) => { e.stopPropagation(); onPick(variable, 'get'); }}
            className="flex-1 rounded-sm border border-white/10 bg-white/[0.02] px-2 py-1 text-[10px] text-[#c9c9cd] transition-all hover:border-[#e8b04a]/50 hover:bg-[#e8b04a]/10 hover:text-[#e8b04a]">Get</button>
          <button type="button" onClick={(e) => { e.stopPropagation(); onPick(variable, 'set'); }}
            className="flex-1 rounded-sm border border-white/10 bg-white/[0.02] px-2 py-1 text-[10px] text-[#c9c9cd] transition-all hover:border-[#e8b04a]/50 hover:bg-[#e8b04a]/10 hover:text-[#e8b04a]">Set</button>
        </div>
      </div>
      {hover && createPortal(
        <div className="pointer-events-none fixed z-[500] w-[340px] overflow-hidden rounded-md border border-white/10 bg-black/70 p-3 text-left shadow-[0_8px_40px_rgba(0,0,0,0.65)] backdrop-blur-2xl"
          style={{ left: tipPos.x, top: tipPos.y }}>
          <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e8b04a]/70 to-transparent" />
          <p className="text-xs font-medium text-[#f0f0f0]">
            {variable.label}<span className="ml-1 text-[10px] text-[#6b6b70]">{variable.key}</span>
          </p>
          <p className="mt-1 text-[10px]" style={{ color: PORT_COLORS[variable.type] }}>类型：{variable.type}</p>
          <p className="mt-2 text-[10px] leading-5 text-[#a0a0a5]">{variable.desc}</p>
          {variable.commonScene && <div className="mt-2 border-t border-white/5 pt-2">{renderCommonScene(variable.commonScene)}</div>}
          {variable.source && (
            <a href={variable.source} target="_blank" rel="noreferrer"
              className="mt-2 inline-block border-t border-white/5 pt-2 text-[10px] hover:underline"
              style={{ color: GOLD }} onClick={(e) => e.stopPropagation()}>资料来源：UE 官方文档 ↗</a>
          )}
        </div>, document.body)}
    </>
  );
}

/* ==================== 端口 ==================== */
function PortView({
  port, side, onStartDrag, onEndDrag, connecting, highlight,
  onHoverChange, onPortEnter, onPortLeave,
  inlineValue, inlineConnected, onInlineChange, onAltClick,
}: {
  port: Port; side: 'in' | 'out';
  onStartDrag?: (side: 'in' | 'out', e: React.MouseEvent) => void;
  onEndDrag?: (side: 'in' | 'out', e: React.MouseEvent) => void;
  connecting: boolean; highlight: boolean;
  onHoverChange: (hovering: boolean) => void;
  onPortEnter?: () => void; onPortLeave?: () => void;
  inlineValue?: string; inlineConnected?: boolean;
  onInlineChange?: (v: string) => void;
  onAltClick?: (e: React.MouseEvent) => void;
}) {
  const [hover, setHover] = useState(false);
  const color = PORT_COLORS[port.type];
  const canInline = side === 'in' && (
    port.type === 'float' || port.type === 'int' || port.type === 'string' ||
    port.type === 'bool' || port.type === 'vector' || port.type === 'rotator'
  );
  return (
    <div data-port className={`relative flex items-center gap-2 ${side === 'in' ? 'flex-row' : 'flex-row-reverse'}`}
      onMouseEnter={(e) => { e.stopPropagation(); setHover(true); onHoverChange(true); onPortEnter?.(); }}
      onMouseLeave={(e) => { e.stopPropagation(); setHover(false); onHoverChange(false); onPortLeave?.(); }}>
      <div className="h-3 w-3 shrink-0 cursor-crosshair rounded-full border border-black/40 transition-all"
        style={{
          background: color,
          transform: hover || highlight ? 'scale(1.6)' : 'scale(1)',
          boxShadow: highlight ? `0 0 10px ${color}, 0 0 4px ${color}` : hover ? `0 0 6px ${color}80` : 'none',
          outline: inlineConnected ? `1px solid ${color}` : 'none', outlineOffset: 1,
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
          if ((e.altKey || e.metaKey) && inlineConnected) { e.preventDefault(); onAltClick?.(e); return; }
          onStartDrag?.(side, e);
        }}
        onMouseUp={(e) => { e.stopPropagation(); onEndDrag?.(side, e); }}
        title={inlineConnected ? 'Alt/Cmd + 左键切断此连线' : undefined} />
      <span className="text-[11px] font-light text-[#c9c9cd]">{port.name || ' '}</span>
      {canInline && <InlineInput port={port} value={inlineValue ?? ''} connected={!!inlineConnected} onChange={(v) => onInlineChange?.(v)} />}
      {hover && (
        <div className={`pointer-events-none absolute top-full z-[80] mt-1 w-64 overflow-hidden rounded-md border border-white/10 bg-black/70 p-3 text-left shadow-2xl backdrop-blur-xl ${side === 'in' ? 'left-0' : 'right-0'}`}>
          <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e8b04a]/50 to-transparent" />
          <p className="text-[11px] font-medium text-[#f0f0f0]">{port.name || (side === 'in' ? '执行输入' : '执行输出')}</p>
          <p className="mt-1 text-[10px] text-[#8b8b8f]">类型：<span style={{ color }}>{PORT_LABELS[port.type]}</span></p>
          <p className="mt-2 text-[10px] leading-5 text-[#a0a0a5]">{port.desc}</p>
        </div>
      )}
    </div>
  );
}/* ==================== 画布节点（含双击重命名 + 模拟高亮） ==================== */
function PlacedNodeView({
  node, selected, onDrag, onStartConnect, onEndConnect, connecting, highlightedPorts,
  onContextMenu, onPortEnter, onPortLeave, onMouseDownSelect,
  onInlineChange, connections, onPortAltClick, simHighlight,

}: {
  node: PlacedNode; selected: boolean;
  onDrag: (id: string, dx: number, dy: number) => void;
  onStartConnect: (instanceId: string, side: 'in' | 'out', portIndex: number, e: React.MouseEvent) => void;
  onEndConnect: (instanceId: string, side: 'in' | 'out', portIndex: number, e: React.MouseEvent) => void;
  connecting: boolean; highlightedPorts: Set<string>;
  onContextMenu: (e: React.MouseEvent, instanceId: string) => void;
  onPortEnter: (instanceId: string, side: 'in' | 'out', portIndex: number) => void;
  onPortLeave: () => void;
  onMouseDownSelect: (e: React.MouseEvent, instanceId: string) => void;
  onInlineChange: (instanceId: string, portIndex: number, value: string) => void;
  connections: Connection[];
  onPortAltClick: (instanceId: string, side: 'in' | 'out', portIndex: number) => void;
  simHighlight?: boolean;
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

  const typeTag = (() => {
    if (node.category === '事件') return 'EVENT';
    if (node.category === '变量') return node.id.startsWith('var_get') ? 'GET' : 'SET';
    const hasExecOut = node.outputs.some((p) => p.type === 'exec');
    const hasExecIn = node.inputs.some((p) => p.type === 'exec');
    if (!hasExecOut) return 'PURE';
    if (hasExecOut && !hasExecIn) return 'FUNC';
    return 'FUNC';
  })();

  return (
    <div className="absolute select-none" data-node style={{ left: node.x, top: node.y, width: NODE_WIDTH }}
      onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
      onContextMenu={(e) => onContextMenu(e, node.instanceId)}>
      <div className="overflow-hidden rounded-md border bg-black/40 backdrop-blur-md transition-shadow"
        style={{
          borderColor: selected ? GOLD : hoverTarget === 'node' ? '#e8a04c' : 'rgba(255,255,255,0.08)',
          boxShadow: simHighlight
            ? `0 0 0 2px ${GOLD}, 0 0 32px ${GOLD}, 0 8px 32px rgba(0,0,0,0.6)`
            : selected
            ? `0 0 0 1px ${GOLD_SOFT}, 0 0 24px ${GOLD_SOFT}, 0 8px 32px rgba(0,0,0,0.6)`
            : hoverTarget === 'node'
            ? `0 0 20px rgba(232,160,76,0.25), 0 8px 32px rgba(0,0,0,0.6)`
            : '0 4px 24px rgba(0,0,0,0.5)',
        }}
        onMouseEnter={() => setHoverTarget('node')}
        onMouseLeave={(e) => {
          const related = e.relatedTarget as HTMLElement | null;
          if (related?.closest('[data-port]')) return;
          setHoverTarget(null);
        }}>
               <div onMouseDown={onMouseDown} className="cursor-grab border-b border-black/40 px-3 py-2 active:cursor-grabbing"
          style={{ background: `linear-gradient(180deg, ${node.color}, ${node.color}cc)`, height: HEADER_H }}>
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-xs font-light tracking-wider text-white select-none">
              {node.title}
            </p>
            <span className="shrink-0 rounded-sm bg-black/30 px-1 py-0.5 text-[8px] font-mono uppercase tracking-wider text-white/80">{typeTag}</span>
          </div>
          <p className="mt-0.5 text-[10px] text-white/70">{node.category}</p>
        </div>
        <div className="flex justify-between gap-3 px-3 py-2" style={{ minHeight: 40 }}>
          <div className="flex flex-col gap-1.5">
            {node.inputs.map((p, i) => {
              const isConnected = connections.some((c) => c.toInstance === node.instanceId && c.toPort === i);
              return (
                <PortView key={i} port={p} side="in" connecting={connecting}
                  highlight={highlightedPorts.has(`${node.instanceId}:in:${i}`)}
                  onStartDrag={(s, e) => onStartConnect(node.instanceId, s, i, e)}
                  onEndDrag={(s, e) => onEndConnect(node.instanceId, s, i, e)}
                  onHoverChange={(h) => setHoverTarget(h ? 'port' : 'node')}
                  onPortEnter={() => onPortEnter(node.instanceId, 'in', i)} onPortLeave={onPortLeave}
                  inlineValue={node.defaultValues?.[i] ?? ''}
                  inlineConnected={isConnected}
                  onInlineChange={(v) => onInlineChange(node.instanceId, i, v)}
                  onAltClick={() => onPortAltClick(node.instanceId, 'in', i)} />
              );
            })}
          </div>
          <div className="flex flex-col items-end gap-1.5">
            {node.outputs.map((p, i) => {
              const isConnected = connections.some((c) => c.fromInstance === node.instanceId && c.fromPort === i);
              return (
                <PortView key={i} port={p} side="out" connecting={connecting}
                  highlight={highlightedPorts.has(`${node.instanceId}:out:${i}`)}
                  onStartDrag={(s, e) => onStartConnect(node.instanceId, s, i, e)}
                  onEndDrag={(s, e) => onEndConnect(node.instanceId, s, i, e)}
                  onHoverChange={(h) => setHoverTarget(h ? 'port' : 'node')}
                  onPortEnter={() => onPortEnter(node.instanceId, 'out', i)} onPortLeave={onPortLeave}
                  inlineConnected={isConnected}
                  onAltClick={() => onPortAltClick(node.instanceId, 'out', i)} />
              );
            })}
          </div>
        </div>
      </div>
      {hoverTarget === 'node' && (
        <div className="pointer-events-none absolute left-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-md border border-white/10 bg-black/70 p-3 text-left shadow-2xl backdrop-blur-xl">
          <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e8b04a]/60 to-transparent" />
          <p className="text-xs font-medium text-[#f0f0f0]">{node.title}</p>
          <p className="mt-1 text-[10px] text-[#8b8b8f]">{node.category}</p>
          <p className="mt-2 text-[10px] leading-5 text-[#a0a0a5]">{node.desc}</p>
          {node.commonScene && <div className="mt-2 border-t border-white/5 pt-2">{renderCommonScene(node.commonScene)}</div>}
          {node.source && (
            <a href={node.source} target="_blank" rel="noreferrer"
              className="mt-2 inline-block border-t border-white/5 pt-2 text-[10px] hover:underline"
              style={{ color: GOLD }} onClick={(e) => e.stopPropagation()}>资料来源：UE 官方文档 ↗</a>
          )}
        </div>
      )}
    </div>
  );
}

/* ==================== 左侧库项（含右上角星标） ==================== */
function LibraryItem({ node, onAdd, onDragStart, onContextMenu, isFavorite, onToggleFavorite }: {
  node: NodeData; onAdd: () => void;
  onDragStart: (e: React.DragEvent, node: NodeData) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}) {
  const [hover, setHover] = useState(false);
  const [tipPos, setTipPos] = useState({ x: 0, y: 0 });
  const itemRef = useRef<HTMLDivElement>(null);

  const updateTipPos = () => {
    const el = itemRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const tipWidth = 340;
    let x = r.right + 8;
    if (x + tipWidth > window.innerWidth - 8) x = r.left - tipWidth - 8;
    if (x < 8) x = Math.max(8, window.innerWidth - tipWidth - 8);
    const tipHeight = 320;
    let y = r.top;
    if (y + tipHeight > window.innerHeight - 8) y = window.innerHeight - tipHeight - 8;
    if (y < 8) y = 8;
    setTipPos({ x, y });
  };

  return (
    <>
      <div ref={itemRef} role="button" tabIndex={0} draggable onClick={onAdd}
        onKeyDown={(e) => { if (e.key === 'Enter') onAdd(); }}
        onDragStart={(e) => onDragStart(e, node)} onContextMenu={onContextMenu}
        onMouseEnter={() => { setHover(true); updateTipPos(); }}
        onMouseLeave={() => setHover(false)}
        className="group relative w-full cursor-grab overflow-hidden rounded-md border border-white/5 bg-white/[0.02] p-3 pl-4 pr-7 text-left transition-all duration-200 hover:border-[#e8b04a]/40 hover:bg-white/[0.04] hover:shadow-[0_0_20px_rgba(232,176,74,0.12)] active:cursor-grabbing">
        <span className="absolute left-0 top-0 h-full w-[3px]" style={{ background: node.color, boxShadow: `0 0 8px ${node.color}80` }} />
        <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e8b04a]/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        {/* 右上角星标 */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
          className="absolute right-2 top-2 text-[13px] leading-none transition-all hover:scale-125"
          style={{ color: isFavorite ? GOLD : '#8b8b8f', opacity: isFavorite ? 1 : 0.4 }}
          title={isFavorite ? '取消收藏' : '收藏此节点'}
        >
          {isFavorite ? '★' : '☆'}
        </button>
        <p className="text-xs font-light text-[#e8e8e8]">{node.title}</p>
        <p className="mt-0.5 text-[10px] text-[#6b6b70]">{node.category}</p>
        <p className="mt-1.5 line-clamp-2 text-[10px] leading-4 text-[#8b8b8f]">{node.desc}</p>
      </div>
      {hover && createPortal(
        <div className="pointer-events-none fixed z-[500] w-[340px] overflow-hidden rounded-md border border-white/10 bg-black/70 p-3 text-left shadow-[0_8px_40px_rgba(0,0,0,0.65)] backdrop-blur-2xl"
          style={{ left: tipPos.x, top: tipPos.y }}>
          <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e8b04a]/70 to-transparent" />
          <p className="text-xs font-medium text-[#f0f0f0]">{node.title}</p>
          <p className="mt-1 text-[10px] text-[#8b8b8f]">{node.category}</p>
          <p className="mt-2 text-[10px] leading-5 text-[#a0a0a5]">{node.desc}</p>
          {node.commonScene && <div className="mt-2 border-t border-white/5 pt-2">{renderCommonScene(node.commonScene)}</div>}
          {node.source && (
            <a href={node.source} target="_blank" rel="noreferrer"
              className="mt-2 inline-block border-t border-white/5 pt-2 text-[10px] hover:underline"
              style={{ color: GOLD }} onClick={(e) => e.stopPropagation()}>资料来源：UE 官方文档 ↗</a>
          )}
        </div>, document.body)}
    </>
  );
}

/* ==================== 主组件 ==================== */
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
  const [menu, setMenu] = useState<{ x: number; y: number; kind: 'canvas' | 'node' | 'connection'; instanceId?: string; connectionId?: string } | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const [shortcutOpen, setShortcutOpen] = useState(false);
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const [checkOpen, setCheckOpen] = useState(false);
  const [checkResults, setCheckResults] = useState<CheckResult[]>([]);
  const [librarySearch, setLibrarySearch] = useState('');
  const [docNode, setDocNode] = useState<PlacedNode | null>(null);
  const [marquee, setMarquee] = useState<{ active: boolean; startX: number; startY: number; curX: number; curY: number } | null>(null);


  // 对齐辅助线
  const [alignGuides, setAlignGuides] = useState<{ vx: number[]; hy: number[] }>({ vx: [], hy: [] });

  const [activeChapter, setActiveChapter] = useState<TutorialChapter | null>(null);

  const [varsPanelOpen, setVarsPanelOpen] = useState(false);
  const [templatePanelOpen, setTemplatePanelOpen] = useState(false);
  const [chaptersPanelOpen, setChaptersPanelOpen] = useState(false);
  const [nodelibPanelOpen, setNodelibPanelOpen] = useState(false);
  const [minimizedVars, setMinimizedVars] = useState(false);
  const [minimizedTemplates, setMinimizedTemplates] = useState(false);
  const [minimizedChapters, setMinimizedChapters] = useState(false);
  const [minimizedNodelib, setMinimizedNodelib] = useState(false);

  const [panelZ, setPanelZ] = useState<{ vars: number; template: number; chapters: number; nodelib: number }>({ vars: 120, template: 121, chapters: 122, nodelib: 123 });
  const bumpPanel = (key: 'vars' | 'template' | 'chapters' | 'nodelib') => {
    setPanelZ((prev) => {
      const max = Math.max(prev.vars, prev.template, prev.chapters, prev.nodelib);
      return { ...prev, [key]: max + 1 };
    });
  };

  const [varPicker, setVarPicker] = useState<{ x: number; y: number; worldX: number; worldY: number; variable: typeof BASE_VARIABLES[0] } | null>(null);
  const [completedChapters, setCompletedChapters] = useState<Set<string>>(new Set());

  const [simResult, setSimResult] = useState<SimResult | null>(null);
  const [simHighlight, setSimHighlight] = useState<Set<string>>(new Set());

  const [favorites, setFavorites] = useState<string[]>([]);
  const [favoritesOpen, setFavoritesOpen] = useState(false);

  const [canvasSize, setCanvasSize] = useState({ w: 1000, h: 700 });

  const [tabs, setTabs] = useState<TabData[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('tab-1');

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
  const canvasRectRef = useRef<DOMRect | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const nextX = useRef(60);
  const nextY = useRef(60);

  /* ==================== 历史 ==================== */
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

  useEffect(() => { pushHistory({ placed: [], connections: [] }); }, []);

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

  useEffect(() => {
    try {
      const raw = localStorage.getItem('magic-se-chapters-done-v1');
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) setCompletedChapters(new Set(arr));
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    setFavorites(loadFavorites());
    const savedTabs = loadTabs();
    if (savedTabs.length > 0) {
      setTabs(savedTabs);
      setActiveTabId(savedTabs[0].id);
      setPlaced(savedTabs[0].placed);
      setConnections(savedTabs[0].connections);
    } else {
      const t: TabData = { id: 'tab-1', name: '蓝图 1', placed: [], connections: [] };
      setTabs([t]);
      setActiveTabId('tab-1');
    }
    const saved = loadBlueprint();
    if (saved && savedTabs.length === 0) {
      setPlaced(saved.placed);
      setConnections(saved.connections);
    }
  }, []);

  useEffect(() => {
    const update = () => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) setCanvasSize({ w: rect.width, h: rect.height });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      saveBlueprint(placed, connections);
      setTabs((prev) => {
        const next = prev.map((t) => t.id === activeTabId ? { ...t, placed, connections } : t);
        saveTabs(next);
        return next;
      });
    }, 800);
    return () => clearTimeout(id);
  }, [placed, connections, activeTabId]);

  const markChapterDone = useCallback((chapterId: string) => {
    setCompletedChapters((prev) => {
      const next = new Set(prev);
      next.add(chapterId);
      try { localStorage.setItem('magic-se-chapters-done-v1', JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const startTour = () => { setTourActive(true); setTourStep(0); };
  const finishTour = () => {
    setTourActive(false);
    try { localStorage.setItem('magic-se-tour-done-v1', '1'); } catch { /* ignore */ }
  };

  const toggleFavorite = useCallback((nodeId: string) => {
    setFavorites((prev) => {
      const next = prev.includes(nodeId) ? prev.filter((x) => x !== nodeId) : [...prev, nodeId];
      saveFavorites(next);
      return next;
    });
  }, []);

  const addTab = () => {
    const id = `tab-${Date.now()}`;
    const t: TabData = { id, name: `蓝图 ${tabs.length + 1}`, placed: [], connections: [] };
    setTabs((prev) => { const next = [...prev, t]; saveTabs(next); return next; });
    setActiveTabId(id);
    setPlaced([]); setConnections([]); setSelectedIds(new Set());
  };
  const switchTab = (id: string) => {
    const t = tabs.find((x) => x.id === id);
    if (!t) return;
    setActiveTabId(id);
    setPlaced(t.placed);
    setConnections(t.connections);
    setSelectedIds(new Set());
  };
  const closeTab = (id: string) => {
    if (tabs.length <= 1) return;
    const next = tabs.filter((t) => t.id !== id);
    setTabs(next);
    saveTabs(next);
    if (activeTabId === id) {
      setActiveTabId(next[0].id);
      setPlaced(next[0].placed);
      setConnections(next[0].connections);
    }
  };

  const onExport = () => exportBlueprint(placed, connections);
  const onImport = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const data = await importBlueprint(file);
        setPlaced(data.placed); setConnections(data.connections);
        pushHistory({ placed: data.placed, connections: data.connections });
      } catch (err) { alert('导入失败：' + (err as Error).message); }
    };
    input.click();
  };

  const runSimulation = useCallback(() => {
    const result = simulate(placed, connections);
    setSimResult(result);
    if (result.steps.length > 0) setSimHighlight(new Set([result.steps[0].nodeId]));
  }, [placed, connections]);

  const handleInlineChange = useCallback((instanceId: string, portIndex: number, value: string) => {
    setPlaced((prev) =>
      prev.map((n) => n.instanceId === instanceId
        ? { ...n, defaultValues: { ...(n.defaultValues ?? {}), [portIndex]: value } }
        : n)
    );
  }, []);

    const addNode = useCallback((node: NodeData, worldX?: number, worldY?: number) => {
    const instanceId = uid(node.id);
    const x = worldX ?? nextX.current;
    const y = worldY ?? nextY.current;
    setPlaced((prev) => {
      const next = [...prev, {
        ...node, instanceId, x, y,
        inputs: sortPorts(node.inputs),
        outputs: sortPorts(node.outputs),
        defaultValues: node.defaultValues ? { ...node.defaultValues } : undefined,
      }];
      pushHistory({ placed: next, connections });
      return next;
    });
    if (worldX === undefined) {
      nextX.current += 40; nextY.current += 40;
      if (nextY.current > 500) { nextY.current = 60; nextX.current += 220; }
      if (nextX.current > 800) nextX.current = 60;
    }
  }, [connections, pushHistory]);

  const addVariableNode = useCallback((variable: typeof BASE_VARIABLES[0], mode: 'get' | 'set', worldX?: number, worldY?: number) => {
    const node = mode === 'get' ? makeGetNode(variable) : makeSetNode(variable);
    addNode(node, worldX, worldY);
  }, [addNode]);

  const handleVariablePick = useCallback((variable: typeof BASE_VARIABLES[0], mode: 'get' | 'set' | null) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const centerX = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const centerY = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
    const worldX = rect ? (centerX - rect.left - pan.x) / scale - NODE_WIDTH / 2 : 100;
    const worldY = rect ? (centerY - rect.top - pan.y) / scale - 20 : 100;
    if (mode === 'get' || mode === 'set') {
      addVariableNode(variable, mode, worldX, worldY);
      return;
    }
    setVarPicker({ x: centerX, y: centerY, worldX, worldY, variable });
  }, [pan, scale, addVariableNode]);

  const loadTemplate = useCallback((tpl: Template) => {
    const refMap: Record<string, PlacedNode> = {};
    const newNodes: PlacedNode[] = [];
    const varGetNodes = BASE_VARIABLES.map(makeGetNode);
    const varSetNodes = BASE_VARIABLES.map(makeSetNode);

    tpl.nodes.forEach((tn) => {
      const base = NODE_LIBRARY.find((n) => n.id === tn.nodeId)
        || varGetNodes.find((n) => n.id === tn.nodeId)
        || varSetNodes.find((n) => n.id === tn.nodeId);
      if (!base) return;
      const instanceId = uid(base.id);
      const placedNode: PlacedNode = {
        ...base, instanceId, x: tn.x, y: tn.y,
        inputs: sortPorts(base.inputs),
        outputs: sortPorts(base.outputs),
        defaultValues: base.defaultValues ? { ...base.defaultValues } : undefined,
      };
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
      if (!fromPort || !toPort) return;
      const compatible = isTypeCompatible(fromPort.type, toPort.type) || isTypeCompatible(toPort.type, fromPort.type);
      if (!compatible) return;
      newConns.push({
        id: uid(`${from.instanceId}:${tc.fromPort}->${to.instanceId}:${tc.toPort}`),
        fromInstance: from.instanceId, fromPort: tc.fromPort,
        toInstance: to.instanceId, toPort: tc.toPort, type: fromPort.type,
      });
    });

    const nextPlaced = [...placed, ...newNodes];
    const nextConns = [...connections, ...newConns];

    if (newNodes.length > 0) {
      const minX = Math.min(...newNodes.map((n) => n.x));
      const minY = Math.min(...newNodes.map((n) => n.y));
      const maxX = Math.max(...newNodes.map((n) => n.x + NODE_WIDTH));
      const maxY = Math.max(...newNodes.map((n) => n.y + 240));
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      setTimeout(() => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const fitScale = Math.min(rect.width / (maxX - minX + 120), rect.height / (maxY - minY + 120));
        const newScale = Math.min(1.1, Math.max(0.4, fitScale));
        setScale(newScale);
        setPan({ x: rect.width / 2 - cx * newScale, y: rect.height / 2 - cy * newScale });
      }, 60);
    }

    setPlaced(nextPlaced);
    setConnections(nextConns);
    pushHistory({ placed: nextPlaced, connections: nextConns });
    setTemplatePanelOpen(false);
  }, [placed, connections, pushHistory]);

  const openChapter = useCallback((chapter: TutorialChapter) => {
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
    const nextPlaced = placed.filter((n) => !selectedIds.has(n.instanceId));
    const nextConns = connections.filter((c) => !selectedIds.has(c.fromInstance) && !selectedIds.has(c.toInstance));
    setPlaced(nextPlaced); setConnections(nextConns);
    pushHistory({ placed: nextPlaced, connections: nextConns });
    setSelectedIds(new Set());
  }, [selectedIds, placed, connections, pushHistory]);

  const deleteConnection = (id: string) => {
    const next = connections.filter((c) => c.id !== id);
    if (next.length === connections.length) return;
    setConnections(next);
    pushHistory({ placed, connections: next });
    setHoverConnectionId(null);
  };

  const disconnectPort = useCallback((instanceId: string, side: 'in' | 'out', portIndex: number) => {
    const next = connections.filter((c) =>
      side === 'in'
        ? !(c.toInstance === instanceId && c.toPort === portIndex)
        : !(c.fromInstance === instanceId && c.fromPort === portIndex)
    );
    if (next.length === connections.length) return;
    setConnections(next);
    pushHistory({ placed, connections: next });
  }, [placed, connections, pushHistory]);

  /* ==================== 拖动 + 对齐辅助线 ==================== */
  const handleDrag = (instanceId: string, dx: number, dy: number) => {
    setPlaced((prev) => {
      const next = prev.map((n) => (n.instanceId === instanceId ? { ...n, x: n.x + dx, y: n.y + dy } : n));
      const dragging = next.find((n) => n.instanceId === instanceId);
      if (dragging) {
        const THRESHOLD = 6;
        const vx: number[] = [];
        const hy: number[] = [];
        const dL = dragging.x;
        const dR = dragging.x + NODE_WIDTH;
        const dCx = dragging.x + NODE_WIDTH / 2;
        const dT = dragging.y;
        const dB = dragging.y + 100;
        const dCy = dragging.y + 50;
        next.forEach((n) => {
          if (n.instanceId === instanceId) return;
          const nL = n.x;
          const nR = n.x + NODE_WIDTH;
          const nCx = n.x + NODE_WIDTH / 2;
          const nT = n.y;
          const nB = n.y + 100;
          const nCy = n.y + 50;
          if (Math.abs(dL - nL) < THRESHOLD) vx.push(nL);
          if (Math.abs(dR - nR) < THRESHOLD) vx.push(nR);
          if (Math.abs(dCx - nCx) < THRESHOLD) vx.push(nCx);
          if (Math.abs(dT - nT) < THRESHOLD) hy.push(nT);
          if (Math.abs(dB - nB) < THRESHOLD) hy.push(nB);
          if (Math.abs(dCy - nCy) < THRESHOLD) hy.push(nCy);
        });
        setAlignGuides({ vx, hy });
      }
      return next;
    });
  };
  const commitDragEnd = () => {
    // 移动节点不进历史栈（避免撤销时一步一步挪回去）
    setAlignGuides({ vx: [], hy: [] });
  };

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
    const compatible = isTypeCompatible(pendingFrom.type, targetPort.type) || isTypeCompatible(targetPort.type, pendingFrom.type);
    if (!compatible) { setPendingFrom(null); setHoverPort(null); return; }
    const fromIsOut = pendingFrom.side === 'out';
    const fromInstance = fromIsOut ? pendingFrom.instanceId : instanceId;
    const fromPort = fromIsOut ? pendingFrom.portIndex : portIndex;
    const toInstance = fromIsOut ? instanceId : pendingFrom.instanceId;
    const toPort = fromIsOut ? portIndex : pendingFrom.portIndex;
    const filtered = connections.filter((c) => !(c.fromInstance === fromInstance && c.fromPort === fromPort));
    const next = [...filtered, {
      id: uid(`${fromInstance}:${fromPort}->${toInstance}:${toPort}`),
      fromInstance, fromPort, toInstance, toPort,
      type: pendingFrom.type,
    }];
    setConnections(next);
    pushHistory({ placed, connections: next });
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
    const compatible = isTypeCompatible(pendingFrom.type, targetPort.type) || isTypeCompatible(targetPort.type, pendingFrom.type);
    setPendingValid(compatible);
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
    const varKey = e.dataTransfer.getData(VAR_PICK_MIME);
    if (varKey) {
      const variable = BASE_VARIABLES.find((v) => v.key === varKey);
      if (!variable) return;
      let resolved: 'get' | 'set' | null = null;
      if (e.ctrlKey || e.metaKey) resolved = 'get';
      else if (e.altKey) resolved = 'set';
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const worldX = (e.clientX - rect.left - pan.x) / scale - NODE_WIDTH / 2;
      const worldY = (e.clientY - rect.top - pan.y) / scale - 20;
      if (resolved) addVariableNode(variable, resolved, worldX, worldY);
      else setVarPicker({ x: e.clientX, y: e.clientY, worldX, worldY, variable });
      return;
    }
    const nodeId = e.dataTransfer.getData(DRAG_MIME) || e.dataTransfer.getData('text/plain');
    if (!nodeId) return;
    const node = NODE_LIBRARY.find((n) => n.id === nodeId)
      || BASE_VARIABLES.map(makeGetNode).find((n) => n.id === nodeId)
      || BASE_VARIABLES.map(makeSetNode).find((n) => n.id === nodeId);
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

  /* ==================== 快捷键 ==================== */
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
          const nextPlaced = [...placed, ...pasted];
          setPlaced(nextPlaced);
          pushHistory({ placed: nextPlaced, connections });
          setSelectedIds(new Set(pasted.map((p) => p.instanceId)));
          return;
        }
        if (e.key.toLowerCase() === 'd') {
          e.preventDefault();
          const duplicated = placed.filter((n) => selectedIds.has(n.instanceId))
            .map((n) => ({ ...n, instanceId: uid(n.id), x: n.x + 30, y: n.y + 30 }));
          if (duplicated.length === 0) return;
          const nextPlaced = [...placed, ...duplicated];
          setPlaced(nextPlaced);
          pushHistory({ placed: nextPlaced, connections });
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
        setSelectedIds(new Set());
        setPendingFrom(null);
        setHoverPort(null);
        setMenu(null);
        setVarPicker(null);
        setShortcutOpen(false);
        setGlossaryOpen(false);
        setCheckOpen(false);
        setDocNode(null);
        setMarquee(null);
        setSimResult(null);
        setSimHighlight(new Set());
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
        setPan({ x: rect.width / 2 - cx * newScale, y: rect.height / 2 - cy * newScale });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedIds, placed, connections, pushHistory, undo, redo, deleteSelected]);

  /* ==================== 画布指针 ==================== */
  const onCanvasPointerDown = (e: React.PointerEvent) => {
    canvasRectRef.current = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (e.button === 2) {
      e.preventDefault(); e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      rightDragRef.current = { active: true, startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y, moved: false };
      return;
    }
    if (e.button === 1) {
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      panningRef.current = { active: true, startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
      return;
    }
    if (e.button === 0) {
      const el = e.target as HTMLElement;
      const isNode = el.closest('[data-node]');
      const isPort = el.closest('[data-port]');
      const isConn = el.closest('[data-connection]');
      if (!isNode && !isPort && !isConn) {
        setSelectedIds(new Set());
        setMarquee({ active: true, startX: e.clientX, startY: e.clientY, curX: e.clientX, curY: e.clientY });
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }
    }
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      setMarquee((prev) => {
        if (!prev?.active) return prev;
        const next = { ...prev, curX: e.clientX, curY: e.clientY };
        const rect = canvasRectRef.current;
        if (rect) {
          const x1 = Math.min(next.startX, next.curX);
          const y1 = Math.min(next.startY, next.curY);
          const x2 = Math.max(next.startX, next.curX);
          const y2 = Math.max(next.startY, next.curY);
          if (Math.abs(x2 - x1) >= 4 || Math.abs(y2 - y1) >= 4) {
            const sel = new Set<string>();
            placed.forEach((n) => {
              const nodeScreenX = rect.left + pan.x + n.x * scale;
              const nodeScreenY = rect.top + pan.y + n.y * scale;
              const nodeW = NODE_WIDTH * scale;
              const nodeH = (HEADER_H + 40 + Math.max(n.inputs.length, n.outputs.length) * PORT_ROW_H + 20) * scale;
              const intersect = nodeScreenX < x2 && nodeScreenX + nodeW > x1 && nodeScreenY < y2 && nodeScreenY + nodeH > y1;
              if (intersect) sel.add(n.instanceId);
            });
            setSelectedIds(sel);
          }
        }
        return next;
      });
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
        setPan({ x: p.panX + (e.clientX - p.startX), y: p.panY + (e.clientY - p.startY) });
      }
    };
    const onUp = (e: PointerEvent) => {
      setMarquee((prev) => (prev?.active ? null : prev));
      const rd = rightDragRef.current;
      if (rd?.active) {
        rd.active = false;
        if (!rd.moved) {
          const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
          const connEl = el?.closest('[data-connection]') as HTMLElement | null;
          if (connEl) {
            const connId = connEl.getAttribute('data-connection-id') || '';
            setMenu({ x: rd.startX, y: rd.startY, kind: 'connection', connectionId: connId });
          } else {
            const rect = canvasRef.current?.getBoundingClientRect();
            const world = rect
              ? { x: (rd.startX - rect.left - pan.x) / scale, y: (rd.startY - rect.top - pan.y) / scale }
              : { x: 100, y: 100 };
            (window as any).__contextWorld = world;
            setMenu({ x: rd.startX, y: rd.startY, kind: 'canvas' });
          }
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
  }, [pan, scale, placed]);

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

  /* ==================== 渲染路径 ==================== */
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

  const focusOnNode = useCallback((nodeId: string) => {
    const n = placed.find((x) => x.instanceId === nodeId);
    if (!n) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPan({ x: rect.width / 2 - (n.x + NODE_WIDTH / 2) * scale, y: rect.height / 2 - (n.y + 120) * scale });
    setSimHighlight(new Set([nodeId]));
  }, [placed, scale]);  const renderChapterList = () => (
    <div className="max-h-[60vh] w-80 overflow-y-auto py-1">
      {Object.entries(chaptersByGroup).map(([groupName, chapters]) => (
        <div key={groupName}>
          <p className="px-3 py-1.5 text-[10px] font-light tracking-[0.2em] text-[#4a4f56]">{groupName}</p>
          {chapters.map((ch) => {
            const isActive = activeChapter?.id === ch.id;
            const isDone = completedChapters.has(ch.id);
            return (
              <button key={ch.id} type="button" onClick={() => openChapter(ch)}
                className={`flex w-full flex-col items-start gap-0.5 border-l-2 px-3 py-2 text-left transition-colors ${
                  isActive ? 'border-[#e8b04a] bg-[#e8b04a]/10' : 'border-transparent hover:border-[#e8b04a] hover:bg-white/[0.03]'
                }`}>
                <span className="flex w-full items-center gap-1.5">
                  <span className={`flex-1 text-[11px] font-light ${isActive ? 'text-[#e8b04a]' : 'text-[#e8e8e8]'}`}>{ch.title}</span>
                  {isDone && <span className="text-[10px] font-mono" style={{ color: MINT }}>✓</span>}
                  <span role="button" tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); markChapterDone(ch.id); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); markChapterDone(ch.id); } }}
                    className="shrink-0 cursor-pointer text-[9px] text-[#4a4f56] transition-colors hover:text-[#4cc9a8]"
                    title={isDone ? '已标记完成' : '标记为已完成'}>{isDone ? '●' : '○'}</span>
                </span>
                <span className="flex items-center gap-2 text-[10px] text-[#6b6b70]">
                  <span>{ch.lessonNo}</span><span>·</span>
                  <span>{'★'.repeat(ch.difficulty)}{'☆'.repeat(5 - ch.difficulty)}</span>
                  <span>·</span><span>{ch.duration}</span>
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );

  const renderNodeLibraryList = () => (
    <div className="max-h-[60vh] w-80 overflow-y-auto p-2">
      <div className="mb-2">
        <input type="text" value={librarySearch} onChange={(e) => setLibrarySearch(e.target.value)}
          placeholder="搜索节点（名称 / 类别 / 说明）"
          className="w-full rounded-sm border border-white/10 bg-black/40 px-3 py-2 text-[11px] font-light text-[#e8e8e8] placeholder:text-[#4a4f56] focus:border-[#e8b04a] focus:outline-none" />
      </div>
      {filteredLibrary.length === 0 ? (
        <p className="py-6 text-center text-[11px] text-[#4a4f56]">没有匹配的节点</p>
      ) : (
        <div className="space-y-2">
          {filteredLibrary.map((node) => (
            <LibraryItem key={node.id} node={node}
              onAdd={() => addNode(node)}
              onDragStart={handleLibraryDragStart}
              onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, kind: 'canvas' }); }}
              isFavorite={favorites.includes(node.id)}
              onToggleFavorite={() => toggleFavorite(node.id)} />
          ))}
        </div>
      )}
      <p className="mt-2 border-t border-white/5 pt-2 text-[10px] font-light tracking-wider text-[#6b6b70]">
        共 {NODE_LIBRARY.length} 个节点
        {librarySearch && <span className="ml-2" style={{ color: GOLD }}>已筛选 {filteredLibrary.length} 个</span>}
      </p>
    </div>
  );

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a0d10] font-sans text-[#e8e8e8] antialiased">
      <ParticleBackground />

      <div className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            'radial-gradient(circle at 20% 10%, rgba(232,176,74,0.08) 0%, transparent 45%),' +
            'radial-gradient(circle at 80% 90%, rgba(76,201,168,0.06) 0%, transparent 50%)',
        }} />

      {/* ========== 顶栏 ========== */}
      <header className="relative z-10 flex h-11 items-center justify-between border-b border-white/5 bg-black/40 px-4 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <span className="h-2 w-2 rounded-full" style={{ background: GOLD, boxShadow: `0 0 12px ${GOLD}, 0 0 4px ${GOLD}` }} />
          <span className="text-[11px] font-light tracking-[0.3em] text-[#e8e8e8]">MAGIC SE</span>
          <span className="text-[10px] text-[#4a4f56]">·</span>
          <span className="text-[10px] font-light tracking-[0.15em] text-[#8b8b8f]">蓝图节点编辑器</span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button"
            onClick={() => { setChaptersPanelOpen(true); setMinimizedChapters(false); bumpPanel('chapters'); }}
            className="flex h-6 items-center gap-1 rounded-sm border border-white/10 bg-white/[0.02] px-2 text-[10px] text-[#e8b04a] transition-all hover:border-[#e8b04a]/50 hover:bg-[#e8b04a]/10">教程</button>
          <button type="button"
            onClick={() => { setNodelibPanelOpen(true); setMinimizedNodelib(false); bumpPanel('nodelib'); }}
            className="flex h-6 items-center gap-1 rounded-sm border border-white/10 bg-white/[0.02] px-2 text-[10px] text-[#c9c9cd] transition-all hover:border-[#4cc9a8]/50 hover:bg-[#4cc9a8]/10 hover:text-[#4cc9a8]">节点库</button>
          <button type="button"
            onClick={() => { setTemplatePanelOpen(true); setMinimizedTemplates(false); bumpPanel('template'); }}
            className="flex h-6 items-center gap-1 rounded-sm border border-white/10 bg-white/[0.02] px-2 text-[10px] text-[#e8b04a] transition-all hover:border-[#e8b04a]/50 hover:bg-[#e8b04a]/10">模板</button>
          <a href="https://www.bilibili.com/video/BV1qYSvBHELW/" target="_blank" rel="noreferrer"
            className="flex h-6 items-center gap-1 rounded-sm border border-white/10 bg-white/[0.02] px-2 text-[10px] text-[#e05a8a] transition-all hover:border-[#e05a8a]/50 hover:bg-[#e05a8a]/10">视频教程</a>
          <button type="button" onClick={startTour}
            className="flex h-6 w-6 items-center justify-center rounded-sm border border-white/10 bg-white/[0.02] text-[11px] text-[#e8b04a] transition-all hover:border-[#e8b04a]/50 hover:bg-[#e8b04a]/10">?</button>
          <button type="button" onClick={() => setShortcutOpen(true)}
            className="flex h-6 items-center gap-1 rounded-sm border border-white/10 bg-white/[0.02] px-2 text-[10px] text-[#e8b04a] transition-all hover:border-[#e8b04a]/50 hover:bg-[#e8b04a]/10">⌨ 快捷键</button>
          <button type="button" onClick={() => setGlossaryOpen(true)}
            className="flex h-6 items-center gap-1 rounded-sm border border-white/10 bg-white/[0.02] px-2 text-[10px] text-[#e8b04a] transition-all hover:border-[#e8b04a]/50 hover:bg-[#e8b04a]/10">📖 术语</button>
          <button type="button"
            onClick={() => { setCheckResults(runStaticChecks(placed, connections)); setCheckOpen(true); }}
            className="flex h-6 items-center gap-1 rounded-sm border border-white/10 bg-white/[0.02] px-2 text-[10px] text-[#4cc9a8] transition-all hover:border-[#4cc9a8]/50 hover:bg-[#4cc9a8]/10">🔍 检查</button>
          <button type="button" onClick={runSimulation}
            className="flex h-6 items-center gap-1 rounded-sm border border-white/10 bg-white/[0.02] px-2 text-[10px] text-[#4cc9a8] transition-all hover:border-[#4cc9a8]/50 hover:bg-[#4cc9a8]/10">▶ 运行</button>
          <button type="button" onClick={() => setFavoritesOpen(true)}
            className="flex h-6 items-center gap-1 rounded-sm border border-white/10 bg-white/[0.02] px-2 text-[10px] text-[#e8b04a] transition-all hover:border-[#e8b04a]/50 hover:bg-[#e8b04a]/10">⭐ 收藏</button>
          <button type="button" onClick={onExport}
            className="flex h-6 items-center gap-1 rounded-sm border border-white/10 bg-white/[0.02] px-2 text-[10px] text-[#8b8b8f] transition-all hover:border-white/20 hover:text-white">导出</button>
          <button type="button" onClick={onImport}
            className="flex h-6 items-center gap-1 rounded-sm border border-white/10 bg-white/[0.02] px-2 text-[10px] text-[#8b8b8f] transition-all hover:border-white/20 hover:text-white">导入</button>
          <div className="mx-1 h-4 w-px bg-white/10" />
          <button type="button" onClick={undo} disabled={historyIndex <= 0}
            className={`flex h-6 items-center gap-1 rounded-sm border px-2 text-[10px] ${
              historyIndex > 0 ? 'border-white/10 bg-white/[0.02] text-[#c9c9cd] hover:border-[#e8b04a]/50 hover:text-[#e8b04a]' : 'border-white/5 bg-white/[0.01] text-[#4a4f56] cursor-not-allowed'
            }`}>撤销</button>
          <button type="button" onClick={redo} disabled={historyIndex >= history.length - 1}
            className={`flex h-6 items-center gap-1 rounded-sm border px-2 text-[10px] ${
              historyIndex < history.length - 1 ? 'border-white/10 bg-white/[0.02] text-[#c9c9cd] hover:border-[#e8b04a]/50 hover:text-[#e8b04a]' : 'border-white/5 bg-white/[0.01] text-[#4a4f56] cursor-not-allowed'
            }`}>重做</button>
          <span className="ml-2 font-mono text-[10px] text-[#4a4f56]">{Math.round(scale * 100)}%</span>
        </div>
      </header>

      {/* ========== 标签栏 ========== */}
      <div className="relative z-10 flex h-8 items-center gap-1 border-b border-white/5 bg-black/30 px-2 backdrop-blur-xl">
        {tabs.map((t) => (
          <button key={t.id} type="button" onClick={() => switchTab(t.id)}
            className={`group flex h-6 items-center gap-1 rounded-sm border px-2 text-[10px] transition-all ${
              activeTabId === t.id ? 'border-[#e8b04a]/60 bg-[#e8b04a]/10 text-[#e8b04a]' : 'border-white/5 bg-white/[0.02] text-[#8b8b8f] hover:border-white/20 hover:text-white'
            }`}>
            <span>{t.name}</span>
            {tabs.length > 1 && (
              <span role="button" tabIndex={0}
                onClick={(e) => { e.stopPropagation(); closeTab(t.id); }}
                className="opacity-0 transition-opacity hover:text-[#ff6b6b] group-hover:opacity-100">✕</span>
            )}
          </button>
        ))}
        <button type="button" onClick={addTab}
          className="flex h-6 w-6 items-center justify-center rounded-sm border border-dashed border-white/10 text-[11px] text-[#6b6b70] transition-colors hover:border-[#e8b04a]/50 hover:text-[#e8b04a]"
          title="新建蓝图标签">+</button>
      </div>

      <div className="relative z-10 flex h-[calc(100vh-44px-32px)]">
        {/* ========== 左栏 ========== */}
        <aside className="flex w-72 shrink-0 flex-col border-r border-white/5 bg-black/30 p-3 backdrop-blur-xl">
          <p className="mb-3 text-[10px] font-light tracking-[0.25em] text-[#6b6b70]">面板</p>
          <button type="button" ref={tourChaptersRef as any}
            onClick={() => { setChaptersPanelOpen(true); setMinimizedChapters(false); bumpPanel('chapters'); }}
            className="group mb-2 flex w-full items-center justify-between overflow-hidden rounded-md border border-white/10 bg-white/[0.02] px-3 py-2 text-left transition-all hover:border-[#e8b04a]/50 hover:bg-[#e8b04a]/[0.06]">
            <span className="flex items-center gap-2">
              <span className="text-[10px] font-light tracking-[0.25em] text-[#e8b04a]">📖 教程章节</span>
              <span className="text-[10px] text-[#6b6b70]">({completedChapters.size}/{TUTORIAL_CHAPTERS.length})</span>
            </span>
            <span className="text-[10px] text-[#e8b04a] transition-transform group-hover:translate-x-0.5">↗</span>
          </button>
          <button type="button" ref={tourNodeLibRef as any}
            onClick={() => { setNodelibPanelOpen(true); setMinimizedNodelib(false); bumpPanel('nodelib'); }}
            className="group mb-2 flex w-full items-center justify-between overflow-hidden rounded-md border border-white/10 bg-white/[0.02] px-3 py-2 text-left transition-all hover:border-[#4cc9a8]/50 hover:bg-[#4cc9a8]/[0.06]">
            <span className="flex items-center gap-2">
              <span className="text-[10px] font-light tracking-[0.25em] text-[#4cc9a8]">📚 节点库</span>
              <span className="text-[10px] text-[#6b6b70]">({NODE_LIBRARY.length} 个)</span>
            </span>
            <span className="text-[10px] text-[#4cc9a8] transition-transform group-hover:translate-x-0.5">↗</span>
          </button>
          <button type="button"
            onClick={() => { setVarsPanelOpen(true); setMinimizedVars(false); bumpPanel('vars'); }}
            className="group mb-2 flex w-full items-center justify-between overflow-hidden rounded-md border border-white/10 bg-white/[0.02] px-3 py-2 text-left transition-all hover:border-[#e8b04a]/50 hover:bg-[#e8b04a]/[0.06]">
            <span className="flex items-center gap-2">
              <span className="text-[10px] font-light tracking-[0.25em] text-[#e8b04a]">📦 基础变量</span>
              <span className="text-[10px] text-[#6b6b70]">({BASE_VARIABLES.length} 个)</span>
            </span>
            <span className="text-[10px] text-[#e8b04a] transition-transform group-hover:translate-x-0.5">↗</span>
          </button>
          <button type="button"
            onClick={() => { setTemplatePanelOpen(true); setMinimizedTemplates(false); bumpPanel('template'); }}
            className="group mb-2 flex w-full items-center justify-between overflow-hidden rounded-md border border-white/10 bg-white/[0.02] px-3 py-2 text-left transition-all hover:border-[#e8b04a]/50 hover:bg-[#e8b04a]/[0.06]">
            <span className="flex items-center gap-2">
              <span className="text-[10px] font-light tracking-[0.25em] text-[#e8b04a]">📋 蓝图模板</span>
              <span className="text-[10px] text-[#6b6b70]">({TEMPLATES.length} 个)</span>
            </span>
            <span className="text-[10px] text-[#e8b04a] transition-transform group-hover:translate-x-0.5">↗</span>
          </button>
        </aside>

        {/* ========== 画布区 ========== */}
        <div
          ref={(el) => { (canvasRef as any).current = el; (tourCanvasRef as any).current = el; }}
          className={`relative flex-1 overflow-hidden transition-colors ${dropActive ? 'bg-[#0c1013]' : ''}`}
          onWheel={onWheel}
          onContextMenu={(e) => e.preventDefault()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onPointerDown={onCanvasPointerDown}
          onPointerUp={commitDragEnd}
          style={{
            backgroundImage:
              'radial-gradient(circle at 50% 30%, rgba(232,176,74,0.05) 0%, transparent 55%),' +
              'linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px),' +
              'linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)',
            backgroundSize: `100% 100%, ${24 * scale}px ${24 * scale}px, ${24 * scale}px ${24 * scale}px`,
            backgroundPosition: `0 0, ${pan.x}px ${pan.y}px, ${pan.x}px ${pan.y}px`,
            cursor: rightDragRef.current?.active ? 'grabbing' : panningRef.current?.active ? 'grabbing' : 'default',
            touchAction: 'none',
            userSelect: 'none',
            overscrollBehavior: 'contain',
          }}>
          {dropActive && (
            <div className="pointer-events-none absolute inset-0 z-30 border-2 border-dashed" style={{ borderColor: GOLD_SOFT }} />
          )}

          {/* 框选矩形 */}
          {marquee?.active && canvasRectRef.current && (() => {
            const rect = canvasRectRef.current;
            if (!rect) return null;
            const x1 = Math.min(marquee.startX, marquee.curX) - rect.left;
            const y1 = Math.min(marquee.startY, marquee.curY) - rect.top;
            const w = Math.max(Math.abs(marquee.curX - marquee.startX), 1);
            const h = Math.max(Math.abs(marquee.curY - marquee.startY), 1);
            return (
              <div className="pointer-events-none absolute z-[60] border"
                style={{ left: x1, top: y1, width: w, height: h, borderColor: GOLD, background: 'rgba(232,176,74,0.08)', boxShadow: `0 0 12px ${GOLD_SOFT}` }} />
            );
          })()}

          {/* 章节目标卡 */}
          {activeChapter && (
            <div ref={tourCardRef}
              className="absolute right-4 top-4 z-40 w-[340px] overflow-hidden rounded-md border bg-black/60 shadow-2xl backdrop-blur-xl"
              style={{ borderColor: 'rgba(232,176,74,0.35)' }}>
              <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e8b04a]/70 to-transparent" />
              <div className="flex items-center justify-between border-b border-white/5 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-light tracking-[0.2em]" style={{ color: GOLD }}>📖 当前章节</span>
                  <span className="text-[10px] text-[#6b6b70]">{activeChapter.lessonNo}</span>
                </div>
                <button type="button" onClick={() => setActiveChapter(null)} className="text-[11px] text-[#6b6b70] hover:text-white">✕</button>
              </div>
              <div className="px-3 py-2">
                <p className="text-[12px] font-light text-[#e8e8e8]">{activeChapter.title}</p>
                <p className="mt-1 text-[10px] text-[#6b6b70]">
                  {'★'.repeat(activeChapter.difficulty)}{'☆'.repeat(5 - activeChapter.difficulty)} · {activeChapter.duration}
                </p>
                <p className="mt-2 text-[11px] leading-5 text-[#a0a0a5]"><span style={{ color: GOLD }}>目标：</span>{activeChapter.goal}</p>
              </div>
              {activeChapter.concepts.length > 0 && (
                <div className="border-t border-white/5 px-3 py-2">
                  <p className="text-[10px] tracking-[0.15em] text-[#6b6b70]">涉及概念</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {activeChapter.concepts.map((c, i) => (
                      <span key={i} className="rounded-sm border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-[10px] text-[#a0a0a5]">{c}</span>
                    ))}
                  </div>
                </div>
              )}
              <div className="max-h-[180px] overflow-y-auto border-t border-white/5 px-3 py-2">
                <p className="text-[10px] tracking-[0.15em] text-[#6b6b70]">步骤</p>
                <ol className="mt-1 space-y-1">
                  {activeChapter.steps.map((s, i) => (
                    <li key={i} className="flex gap-2 text-[11px] leading-5 text-[#c9c9cd]">
                      <span className="shrink-0" style={{ color: GOLD }}>{i + 1}.</span><span>{s}</span>
                    </li>
                  ))}
                </ol>
              </div>
              {chapterChecks.length > 0 && (
                <div className="border-t border-white/5 px-3 py-2">
                  <p className="text-[10px] tracking-[0.15em] text-[#6b6b70]">检查点</p>
                  <ul className="mt-1 space-y-1">
                    {chapterChecks.map((ck, i) => (
                      <li key={i} className={`flex items-center gap-2 text-[11px] ${ck.done ? '' : 'text-[#6b6b70]'}`}
                        style={{ color: ck.done ? GOLD : undefined }}>
                        <span className="font-mono">{ck.done ? '✓' : '□'}</span><span>{ck.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-white/5 px-3 py-2">
                <button type="button" onClick={() => markChapterDone(activeChapter.id)}
                  className="text-[10px] transition-colors"
                  style={{ color: completedChapters.has(activeChapter.id) ? MINT : GOLD }}>
                  {completedChapters.has(activeChapter.id) ? '✓ 已完成本章' : '○ 标记完成'}
                </button>
                {activeChapter.templateId && <span className="text-[10px]" style={{ color: GOLD }}>✓ 已加载示例</span>}
              </div>
            </div>
          )}

          {/* 节点 + 连线层 */}
          <div className="relative"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
              transformOrigin: '0 0',
              width: 3000, height: 2000,
            }}>
            <svg className="pointer-events-auto absolute inset-0" width={3000} height={2000}>
              {/* 对齐辅助线 */}
              {alignGuides.vx.map((x, i) => (
                <line key={`vx-${i}`} x1={x} y1={0} x2={x} y2={2000}
                  stroke={GOLD} strokeWidth={1} strokeDasharray="4 4" opacity={0.6}
                  style={{ pointerEvents: 'none', filter: `drop-shadow(0 0 4px ${GOLD})` }} />
              ))}
              {alignGuides.hy.map((y, i) => (
                <line key={`hy-${i}`} x1={0} y1={y} x2={3000} y2={y}
                  stroke={GOLD} strokeWidth={1} strokeDasharray="4 4" opacity={0.6}
                  style={{ pointerEvents: 'none', filter: `drop-shadow(0 0 4px ${GOLD})` }} />
              ))}
              {/* 连线 */}
              {connectionPaths.map(({ c, d, p1, p2 }, idx) => {
                const isHighlight = highlighted.conns.has(c.id) || hoverConnectionId === c.id;
                const isSimActive = simResult !== null;
                const fromNodeInSim = simHighlight.has(c.fromInstance);
                const color = PORT_COLORS[c.type];
                return (
                  <g key={`${c.id}-${idx}`}>
                    <path d={d} fill="none" stroke="transparent" strokeWidth={18}
                      data-connection data-connection-id={c.id}
                      style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        if (e.altKey || e.metaKey) { e.preventDefault(); deleteConnection(c.id); }
                      }}
                      onMouseEnter={() => setHoverConnectionId(c.id)}
                      onMouseLeave={() => setHoverConnectionId(null)}
                      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setMenu({ x: e.clientX, y: e.clientY, kind: 'connection', connectionId: c.id }); }} />
                    <path d={d} fill="none" stroke={color} strokeWidth={isHighlight ? 3 : 2}
                      strokeOpacity={isHighlight ? 1 : 0.8}
                      style={{ filter: isHighlight && c.type === 'exec' ? `drop-shadow(0 0 8px ${color})` : undefined, pointerEvents: 'none' }} />
                    {/* 模拟运行时流动电流 */}
                    {isSimActive && fromNodeInSim && c.type === 'exec' && (
                      <path d={d} fill="none" stroke={GOLD} strokeWidth={2.5} strokeDasharray="6 12"
                        style={{ pointerEvents: 'none', filter: `drop-shadow(0 0 6px ${GOLD})`, animation: 'simFlow 0.8s linear infinite' }} />
                    )}
                    <circle cx={p1.x} cy={p1.y} r={3} fill={color} opacity={isHighlight ? 1 : 0.8} style={{ pointerEvents: 'none' }} />
                    <circle cx={p2.x} cy={p2.y} r={3} fill={color} opacity={isHighlight ? 1 : 0.8} style={{ pointerEvents: 'none' }} />
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
                onMouseDownSelect={onNodeMouseDownSelect}
                onInlineChange={handleInlineChange}
                connections={connections}
                onPortAltClick={disconnectPort}
                simHighlight={simHighlight.has(n.instanceId)}
                />
            ))}
          </div>
        </div>
      </div>

      {/* 电流流动动画 */}
      <style jsx>{`
        @keyframes simFlow {
          from { stroke-dashoffset: 0; }
          to { stroke-dashoffset: -18; }
        }
      `}</style>

      {/* 缩略图 */}
      <Minimap placed={placed} pan={pan} scale={scale} canvasSize={canvasSize}
        onJump={(worldX, worldY) => {
          setPan({ x: canvasSize.w / 2 - worldX * scale, y: canvasSize.h / 2 - worldY * scale });
        }} />

      {/* 浮动面板 */}
      {chaptersPanelOpen && !minimizedChapters && (
        <DraggablePanel title="教程章节" initial={{ x: 24, y: 90 }}
          zIndex={panelZ.chapters} onFocus={() => bumpPanel('chapters')}
          onMinimize={() => setMinimizedChapters(true)} onClose={() => setChaptersPanelOpen(false)}>
          {renderChapterList()}
        </DraggablePanel>
      )}
      {nodelibPanelOpen && !minimizedNodelib && (
        <DraggablePanel title="节点库" initial={{ x: 320, y: 90 }}
          zIndex={panelZ.nodelib} onFocus={() => bumpPanel('nodelib')}
          onMinimize={() => setMinimizedNodelib(true)} onClose={() => setNodelibPanelOpen(false)}>
          {renderNodeLibraryList()}
        </DraggablePanel>
      )}
      {varsPanelOpen && !minimizedVars && (
        <DraggablePanel title="基础变量" initial={{ x: 24, y: 340 }}
          zIndex={panelZ.vars} onFocus={() => bumpPanel('vars')}
          onMinimize={() => setMinimizedVars(true)} onClose={() => setVarsPanelOpen(false)}>
          <div className="max-h-[60vh] w-80 overflow-y-auto p-3">
            <p className="mb-2 text-[10px] leading-4 text-[#6b6b70]">
              拖动整个卡片到画布：<br />
              <span style={{ color: GOLD }}>Ctrl + 拖动</span> = 获取（Get）<br />
              <span style={{ color: MINT }}>Alt + 拖动</span> = 设置（Set）<br />
              <span className="text-[#c9c9cd]">直接拖动</span> = 松手后弹出选择
            </p>
            {BASE_VARIABLES.map((v) => (
              <VariableItem key={v.key} variable={v} onPick={handleVariablePick} />
            ))}
          </div>
        </DraggablePanel>
      )}
      {templatePanelOpen && !minimizedTemplates && (
        <DraggablePanel title="蓝图模板"
          initial={typeof window !== 'undefined' ? { x: Math.max(0, window.innerWidth - 340), y: 90 } : { x: 800, y: 90 }}
          zIndex={panelZ.template} onFocus={() => bumpPanel('template')}
          onMinimize={() => setMinimizedTemplates(true)} onClose={() => setTemplatePanelOpen(false)}>
          <div className="max-h-[60vh] w-80 overflow-y-auto p-2">
            {TEMPLATES.map((tpl) => (
              <button key={tpl.id} type="button" onClick={() => loadTemplate(tpl)}
                className="group relative mb-2 block w-full overflow-hidden rounded-md border border-white/5 bg-white/[0.02] p-3 text-left transition-all hover:border-[#e8b04a]/40 hover:bg-[#e8b04a]/[0.05]">
                <p className="text-xs font-light text-[#e8e8e8]">{tpl.name}</p>
                <p className="mt-0.5 text-[10px] text-[#8b8b8f]">{tpl.desc}</p>
                <p className="mt-1 text-[10px] text-[#6b6b70]">{tpl.nodes.length} 个节点 · {tpl.connections.length} 条连线</p>
              </button>
            ))}
          </div>
        </DraggablePanel>
      )}

      {shortcutOpen && <ShortcutPanel onClose={() => setShortcutOpen(false)} zIndex={300} />}
      {glossaryOpen && <GlossaryPanel onClose={() => setGlossaryOpen(false)} zIndex={310} />}
      {checkOpen && <CheckPanel results={checkResults} onClose={() => setCheckOpen(false)} onFocusNode={focusOnNode} zIndex={315} />}
      {favoritesOpen && (
        <FavoritesPanel favorites={favorites} allNodes={NODE_LIBRARY}
          onAdd={addNode} onRemove={toggleFavorite}
          onDragStart={handleLibraryDragStart}
          onClose={() => setFavoritesOpen(false)} zIndex={310} />
      )}
      {simResult && (
        <SimPanel result={simResult}
          onClose={() => { setSimResult(null); setSimHighlight(new Set()); }}
          onFocusNode={focusOnNode} zIndex={320} />
      )}

      {docNode && (
        <div className="fixed inset-0 z-[320] flex items-start justify-center pt-24" onClick={() => setDocNode(null)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative max-h-[70vh] w-[480px] overflow-y-auto rounded-md border border-white/10 bg-black/80 p-5 shadow-2xl backdrop-blur-2xl"
            onClick={(e) => e.stopPropagation()}>
            <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e8b04a]/60 to-transparent" />
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-[#f0f0f0]">{docNode.title}</p>
                <p className="mt-1 text-[10px] text-[#8b8b8f]">{docNode.category}</p>
              </div>
              <button type="button" onClick={() => setDocNode(null)} className="text-[12px] text-[#6b6b70] hover:text-white">✕</button>
            </div>
            <p className="mt-3 text-[11px] leading-5 text-[#c9c9cd]">{docNode.desc}</p>
            {docNode.commonScene && <div className="mt-3 border-t border-white/5 pt-3">{renderCommonScene(docNode.commonScene)}</div>}
            {docNode.source && (
              <a href={docNode.source} target="_blank" rel="noreferrer"
                className="mt-3 inline-block border-t border-white/5 pt-3 text-[10px] hover:underline"
                style={{ color: GOLD }}>资料来源：UE 官方文档 ↗</a>
            )}
          </div>
        </div>
      )}

      {varPicker && (
        <div className="fixed z-[110] w-40 overflow-hidden rounded-md border border-white/10 bg-black/70 py-1 shadow-2xl backdrop-blur-xl"
          style={{ left: Math.min(varPicker.x, typeof window !== 'undefined' ? window.innerWidth - 180 : varPicker.x), top: varPicker.y }}
          onClick={(e) => e.stopPropagation()}>
          <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e8b04a]/60 to-transparent" />
          <p className="px-3 py-1.5 text-[10px] tracking-wider text-[#6b6b70]">{varPicker.variable.label}</p>
          <button type="button"
            className="block w-full px-3 py-1.5 text-left text-[11px] transition-colors hover:bg-[#e8b04a]/10"
            style={{ color: GOLD }}
            onClick={() => { addVariableNode(varPicker.variable, 'get', varPicker.worldX, varPicker.worldY); setVarPicker(null); }}>获取（Get）</button>
          <button type="button"
            className="block w-full px-3 py-1.5 text-left text-[11px] transition-colors hover:bg-[#4cc9a8]/10"
            style={{ color: MINT }}
            onClick={() => { addVariableNode(varPicker.variable, 'set', varPicker.worldX, varPicker.worldY); setVarPicker(null); }}>设置（Set）</button>
        </div>
      )}

      {menu && (
        <div className="fixed z-[100] w-48 overflow-hidden rounded-md border border-white/10 bg-black/70 py-1 shadow-2xl backdrop-blur-xl"
          style={{ left: menu.x, top: menu.y }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}>
          <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e8b04a]/50 to-transparent" />
          {menu.kind === 'canvas' && (
            <>
              <p className="px-3 py-1.5 text-[10px] tracking-wider text-[#6b6b70]">添加节点</p>
              <div className="max-h-80 overflow-y-auto">
                {NODE_LIBRARY.map((n) => (
                  <button key={n.id} type="button"
                    className="block w-full px-3 py-1.5 text-left text-[11px] text-[#c9c9cd] transition-colors hover:bg-white/[0.06]"
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
            <>
              <button type="button"
                className="block w-full px-3 py-1.5 text-left text-[11px] transition-colors hover:bg-white/[0.06]"
                style={{ color: GOLD }}
                onClick={() => {
                  const n = placed.find((x) => x.instanceId === menu.instanceId);
                  if (n) setDocNode(n);
                  setMenu(null);
                }}>查看文档</button>
              <button type="button"
                className="block w-full px-3 py-1.5 text-left text-[11px] text-[#ff6b6b] transition-colors hover:bg-white/[0.06]"
                onClick={() => {
                  const nextPlaced = placed.filter((n) => n.instanceId !== menu.instanceId);
                  const nextConns = connections.filter((c) => c.fromInstance !== menu.instanceId && c.toInstance !== menu.instanceId);
                  setPlaced(nextPlaced); setConnections(nextConns);
                  pushHistory({ placed: nextPlaced, connections: nextConns });
                  setMenu(null);
                }}>删除节点</button>
            </>
          )}
          {menu.kind === 'connection' && menu.connectionId && (
            <button type="button"
              className="block w-full px-3 py-1.5 text-left text-[11px] text-[#ff6b6b] transition-colors hover:bg-white/[0.06]"
              onClick={() => { deleteConnection(menu.connectionId!); setMenu(null); }}>删除此连线</button>
          )}
        </div>
      )}

      <div className="pointer-events-none fixed bottom-3 right-4 z-40 flex items-center gap-3 rounded-md border border-white/5 bg-black/40 px-3 py-1.5 text-[10px] text-[#4a4f56] backdrop-blur-md">
        <span>节点 <span className="text-[#8b8b8f]">{placed.length}</span></span>
        <span className="text-[#2a2f36]">·</span>
        <span>连线 <span className="text-[#8b8b8f]">{connections.length}</span></span>
        <span className="text-[#2a2f36]">·</span>
        <span>选中 <span className="text-[#8b8b8f]">{selectedIds.size}</span></span>
        <span className="text-[#2a2f36]">·</span>
        <span>历史 <span className="text-[#8b8b8f]">{historyIndex + 1}/{history.length}</span></span>
        <span className="text-[#2a2f36]">·</span>
        <span>教程 <span style={{ color: MINT }}>{completedChapters.size}/{TUTORIAL_CHAPTERS.length}</span></span>
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