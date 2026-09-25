'use client';
import { useEffect, useRef, useState } from 'react';
import { getSupabaseBrowserClientWithRetry } from '@/lib/supabase-browser';
import type { InternalMember } from '@/lib/types';

interface Particle {
  homeX: number; homeY: number; x: number; y: number;
  vx: number; vy: number; size: number; alpha: number;
  breathPhase: number; shade: number;
}

const SPACING = 3.5;
const COLLISION_RADIUS = 5.5;
const CELL_SIZE = 24;
const COOLDOWN = 0.4;
const BREATH_AMP = 3.5;
const BREATH_SPEED = 2.2;
const REPEL_RADIUS = 75;
const REPEL_STRENGTH = 4.5;
const LOCK_SPEED = 0.4;

function pointOnBorder(w: number, h: number, t: number) {
  const perimeter = 2 * (w + h);
  t = ((t % perimeter) + perimeter) % perimeter;
  if (t < w) return { x: t, y: 0 };
  if (t < w + h) return { x: w, y: t - w };
  if (t < 2 * w + h) return { x: w - (t - w - h), y: h };
  return { x: 0, y: h - (t - 2 * w - h) };
}

function MemberCard({ member, onClick }: { member: InternalMember; onClick: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: -9999, y: -9999, inside: false });
  const hoverRef = useRef(false);
  const cooldownRef = useRef(0);
  const timeRef = useRef(0);
  const sizeRef = useRef({ w: 0, h: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    const rebuild = () => {
      const { w, h } = sizeRef.current;
      if (w < 2 || h < 2) return;
      const pts: Particle[] = [];
      const perimeter = 2 * (w + h);
      const count = Math.min(600, Math.max(80, Math.floor(perimeter / SPACING)));
      for (let j = 0; j < count; j++) {
        const baseT = (j / count) * perimeter;
        const jitter = (Math.random() - 0.5) * SPACING * 0.8;
        const pt = pointOnBorder(w, h, baseT + jitter);
        pts.push({
          homeX: pt.x, homeY: pt.y, x: pt.x, y: pt.y,
          vx: 0, vy: 0, size: 0.9 + Math.random() * 1.1,
          alpha: 0.45 + Math.random() * 0.4,
          breathPhase: Math.random() * Math.PI * 2,
          shade: 35 + Math.random() * 25,
        });
      }
      particlesRef.current = pts;
    };
    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const w = rect.width, h = rect.height;
      if (w < 2 || h < 2) return;
      sizeRef.current = { w, h };
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      rebuild();
    };
    const resetAll = () => {
      for (const p of particlesRef.current) { p.x = p.homeX; p.y = p.homeY; p.vx = 0; p.vy = 0; }
    };
    const tick = () => {
      const { w, h } = sizeRef.current;
      if (w < 2 || h < 2) { rafRef.current = requestAnimationFrame(tick); return; }
      timeRef.current += 1 / 60;
      const time = timeRef.current;
      ctx.clearRect(0, 0, w, h);
      const sin = Math.sin;
      const particles = particlesRef.current;
      const bcx = w / 2, bcy = h / 2;
      const isHovered = hoverRef.current;
      const inCooldown = time < cooldownRef.current;
      const mx = mouseRef.current.x, my = mouseRef.current.y;
      const mouseInside = mouseRef.current.inside;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (inCooldown) { p.x = p.homeX; p.y = p.homeY; p.vx = 0; p.vy = 0; continue; }
        if (isHovered) {
          const dxHome = p.homeX - bcx, dyHome = p.homeY - bcy;
          const homeLen = Math.sqrt(dxHome * dxHome + dyHome * dyHome) || 1;
          const nx = dxHome / homeLen, ny = dyHome / homeLen;
          const breath = sin(time * BREATH_SPEED + p.breathPhase) * BREATH_AMP;
          p.vx += (p.homeX + nx * breath - p.x) * 0.14;
          p.vy += (p.homeY + ny * breath - p.y) * 0.14;
          p.vx *= 0.82; p.vy *= 0.82; p.x += p.vx; p.y += p.vy;
          continue;
        }
        const dx = p.x - mx, dy = p.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (!mouseInside || (dist > REPEL_RADIUS && Math.abs(p.vx) < LOCK_SPEED && Math.abs(p.vy) < LOCK_SPEED)) {
          p.x = p.homeX; p.y = p.homeY; p.vx = 0; p.vy = 0; continue;
        }
        p.vx += (p.homeX - p.x) * 0.08; p.vy += (p.homeY - p.y) * 0.08;
        if (mouseInside && dist < REPEL_RADIUS && dist > 0.5) {
          const falloff = 1 - dist / REPEL_RADIUS;
          const force = falloff * falloff * REPEL_STRENGTH;
          p.vx += (dx / dist) * force; p.vy += (dy / dist) * force;
        }
        p.vx *= 0.86; p.vy *= 0.86; p.x += p.vx; p.y += p.vy;
      }
      // 碰撞
      const grid = new Map<number, number[]>();
      const cellCols = Math.ceil(w / CELL_SIZE) + 1;
      for (let i = 0; i < particles.length; i++) {
        const cx = Math.floor(particles[i].x / CELL_SIZE);
        const cy = Math.floor(particles[i].y / CELL_SIZE);
        if (cx < 0 || cy < 0) continue;
        const key = cy * cellCols + cx;
        let cell = grid.get(key); if (!cell) { cell = []; grid.set(key, cell); }
        cell.push(i);
      }
      const cr2 = COLLISION_RADIUS * COLLISION_RADIUS;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const speed2 = p.vx * p.vx + p.vy * p.vy;
        if (speed2 < 0.15) continue;
        const cx = Math.floor(p.x / CELL_SIZE), cy = Math.floor(p.y / CELL_SIZE);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const cell = grid.get((cy + dy) * cellCols + (cx + dx));
          if (!cell) continue;
          for (const j of cell) {
            if (j === i) continue;
            const o = particles[j];
            const ddx = o.x - p.x, ddy = o.y - p.y;
            const dist2 = ddx * ddx + ddy * ddy;
            if (dist2 < cr2 && dist2 > 0.01) {
              const dist = Math.sqrt(dist2);
              const nx = ddx / dist, ny = ddy / dist;
              const overlap = (COLLISION_RADIUS - dist) * 0.4;
              p.x -= nx * overlap; p.y -= ny * overlap;
              o.x += nx * overlap; o.y += ny * overlap;
              const impulse = Math.sqrt(speed2) * 0.2;
              o.vx += nx * impulse; o.vy += ny * impulse;
              p.vx *= 0.92; p.vy *= 0.92;
            }
          }
        }
      }
      // 绘制
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        const boost = Math.min(0.25, speed * 0.03);
        let sizeMul = 1, alphaMul = 1;
        if (isHovered) {
          const bv = sin(time * BREATH_SPEED + p.breathPhase);
          sizeMul = 1 + bv * 0.2; alphaMul = 1 + bv * 0.7;
        }
        const ca = Math.min(0.95, p.alpha * alphaMul * (1 + boost));
        const cs = p.size * sizeMul * (1 + boost * 0.3);
        const shade = p.shade;
        if (cs < 1.5) {
          ctx.fillStyle = `rgba(${shade},${shade},${shade + 4},${ca.toFixed(3)})`;
          ctx.fillRect(p.x - cs, p.y - cs, cs * 2, cs * 2);
        } else {
          ctx.beginPath(); ctx.arc(p.x, p.y, cs, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${shade},${shade},${shade + 4},${ca.toFixed(3)})`; ctx.fill();
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    const onMove = (e: MouseEvent) => {
      const rect = wrap.getBoundingClientRect();
      mouseRef.current.x = e.clientX - rect.left;
      mouseRef.current.y = e.clientY - rect.top;
      mouseRef.current.inside = true; hoverRef.current = true;
    };
    const onLeave = () => {
      mouseRef.current.inside = false; mouseRef.current.x = -9999; mouseRef.current.y = -9999;
      if (hoverRef.current) { hoverRef.current = false; cooldownRef.current = timeRef.current + COOLDOWN; resetAll(); }
    };

    requestAnimationFrame(() => requestAnimationFrame(resize));
    const t1 = setTimeout(resize, 100), t2 = setTimeout(resize, 300), t3 = setTimeout(resize, 600);
    rafRef.current = requestAnimationFrame(tick);
    const ro = new ResizeObserver(resize); ro.observe(wrap);
    wrap.addEventListener('mousemove', onMove);
    wrap.addEventListener('mouseleave', onLeave);
    return () => {
      cancelAnimationFrame(rafRef.current); ro.disconnect();
      wrap.removeEventListener('mousemove', onMove); wrap.removeEventListener('mouseleave', onLeave);
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      onClick={onClick}
      className="group relative cursor-pointer overflow-hidden bg-white p-8 transition-transform hover:-translate-y-0.5"
    >
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-0 h-full w-full" />
      <div className="relative z-10 flex flex-col items-center text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full border border-[#eeeff1] bg-white text-lg font-light tracking-wider text-[#1b1c1e]">
          {member.name?.charAt(0) || '?'}
        </div>
        <h3 className="mt-5 text-base font-light tracking-[0.1em] text-[#1b1c1e]">{member.name}</h3>
      </div>
    </div>
  );
}

export function TeamSection() {
  const [members, setMembers] = useState<InternalMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<InternalMember | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const supabase = await getSupabaseBrowserClientWithRetry();
      const { data } = await supabase
        .from('internal_members')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: true });
      if (active) {
        setMembers((data ?? []).filter((m) => m.show_on_homepage !== false));
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  // 弹窗打开时禁止页面滚动
  useEffect(() => {
    if (!selected) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelected(null); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = original;
      window.removeEventListener('keydown', onKey);
    };
  }, [selected]);

  if (loading) return <p className="text-sm font-light tracking-[0.2em] text-[#9b9ea4]">加载中…</p>;
  if (members.length === 0) return <p className="text-sm font-light tracking-[0.2em] text-[#9b9ea4]">暂无成员</p>;

  return (
    <>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {members.map((m) => (
          <MemberCard key={m.id} member={m} onClick={() => setSelected(m)} />
        ))}
      </div>

      {/* 成员详情弹窗 */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setSelected(null)}
        >
          <div
            className="relative w-full max-w-md border border-[#e3e4e8] bg-white p-8 shadow-xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 关闭按钮 */}
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center text-[#9b9ea4] transition-colors hover:text-[#1b1c1e]"
              aria-label="关闭"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>

            <div className="flex flex-col items-center text-center">
              {/* 头像 */}
              <div className="flex h-24 w-24 items-center justify-center rounded-full border border-[#eeeff1] bg-white text-2xl font-light tracking-wider text-[#1b1c1e]">
                {selected.name?.charAt(0) || '?'}
              </div>

              {/* 姓名 */}
              <h3 className="mt-6 text-xl font-light tracking-[0.1em] text-[#1b1c1e]">
                {selected.name}
              </h3>

              {/* 简介 */}
              {selected.bio ? (
                <p className="mt-4 whitespace-pre-wrap text-sm font-light leading-7 text-[#55585e]">
                  {selected.bio}
                </p>
              ) : (
                <p className="mt-4 text-sm font-light text-[#b9bcc2]">暂无简介</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}