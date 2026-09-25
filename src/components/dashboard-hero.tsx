'use client';
import { useEffect, useRef } from 'react';

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  size: number; alpha: number;
  phase: number;
}

interface DashboardHeroProps {
  name: string;
  company: string;
}

export function DashboardHero({ name, company }: DashboardHeroProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: -9999, y: -9999, inside: false });
  const sizeRef = useRef({ w: 0, h: 0 });
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    const REPEL_RADIUS = 90;
    const REPEL_STRENGTH = 0.9;
    const COUNT_RATIO = 1 / 9000;

    const rebuild = () => {
      const { w, h } = sizeRef.current;
      if (w < 2 || h < 2) return;
      const count = Math.max(30, Math.min(120, Math.floor(w * h * COUNT_RATIO)));
      const pts: Particle[] = [];
      for (let i = 0; i < count; i++) {
        pts.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.25,
          vy: (Math.random() - 0.5) * 0.25,
          size: 0.8 + Math.random() * 1.4,
          alpha: 0.25 + Math.random() * 0.45,
          phase: Math.random() * Math.PI * 2,
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

    const tick = () => {
      const { w, h } = sizeRef.current;
      if (w < 2 || h < 2) { rafRef.current = requestAnimationFrame(tick); return; }
      timeRef.current += 1 / 60;
      const t = timeRef.current;
      ctx.clearRect(0, 0, w, h);

      const particles = particlesRef.current;
      const mx = mouseRef.current.x, my = mouseRef.current.y;
      const mouseInside = mouseRef.current.inside;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;

        if (mouseInside) {
          const dx = p.x - mx, dy = p.y - my;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < REPEL_RADIUS && dist > 0.5) {
            const falloff = 1 - dist / REPEL_RADIUS;
            p.x += (dx / dist) * falloff * falloff * REPEL_STRENGTH * 3;
            p.y += (dy / dist) * falloff * falloff * REPEL_STRENGTH * 3;
          }
        }

        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
        if (p.y < -10) p.y = h + 10;
        if (p.y > h + 10) p.y = -10;

        const breath = Math.sin(t * 1.6 + p.phase) * 0.5 + 0.5;
        const alpha = p.alpha * (0.5 + breath * 0.6);
        const size = p.size * (0.85 + breath * 0.35);

        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(27, 28, 30, ${alpha.toFixed(3)})`;
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    const onMove = (e: MouseEvent) => {
      const rect = wrap.getBoundingClientRect();
      mouseRef.current.x = e.clientX - rect.left;
      mouseRef.current.y = e.clientY - rect.top;
      mouseRef.current.inside = true;
    };
    const onLeave = () => {
      mouseRef.current.inside = false;
      mouseRef.current.x = -9999;
      mouseRef.current.y = -9999;
    };

    requestAnimationFrame(() => requestAnimationFrame(resize));
    const t1 = setTimeout(resize, 100);
    const t2 = setTimeout(resize, 300);
    rafRef.current = requestAnimationFrame(tick);
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    wrap.addEventListener('mousemove', onMove);
    wrap.addEventListener('mouseleave', onLeave);
    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      clearTimeout(t1);
      clearTimeout(t2);
      wrap.removeEventListener('mousemove', onMove);
      wrap.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  const displayCompany = company.trim() ? company.trim() : '个人';

  return (
    <div
      ref={wrapRef}
      className="relative mb-8 overflow-hidden border border-[#e3e4e8] bg-white"
      style={{ minHeight: '180px' }}
    >
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-0 h-full w-full" />
      <div className="relative z-10 flex flex-col items-start gap-3 px-10 py-12">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[#e8704a]" />
          <span className="text-[10px] font-light tracking-[0.4em] text-[#b9bcc2]">VISITOR</span>
        </div>
        <h1 className="text-2xl font-light tracking-[0.2em] text-[#1b1c1e] sm:text-3xl">
          {name || '未命名'}
        </h1>
        <p className="text-xs font-light tracking-[0.25em] text-[#85888e]">{displayCompany}</p>
      </div>
    </div>
  );
}