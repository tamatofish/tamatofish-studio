'use client';
import { useEffect, useRef } from 'react';

interface ParticleRepelProps {
  children: React.ReactNode;
  className?: string;
  particleCount?: number;
  color?: string;
  repelRadius?: number;
}

export function ParticleRepel({
  children,
  className = '',
  particleCount = 90,
  color = '#1b1c1e',
  repelRadius = 110,
}: ParticleRepelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const particlesRef = useRef<
    Array<{
      x: number;
      y: number;
      baseX: number;
      baseY: number;
      vx: number;
      vy: number;
      size: number;
      alpha: number;
    }>
  >([]);
  const rafRef = useRef<number>(0);
  const timeRef = useRef(0);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const initParticles = (w: number, h: number) => {
      const particles: typeof particlesRef.current = [];
      const perimeter = 2 * (w + h);
      const spacing = perimeter / particleCount;

      for (let i = 0; i < particleCount; i++) {
        let dist = i * spacing;
        let x: number, y: number;

        if (dist < w) {
          x = dist;
          y = 0;
        } else if (dist < w + h) {
          x = w;
          y = dist - w;
        } else if (dist < 2 * w + h) {
          x = w - (dist - w - h);
          y = h;
        } else {
          x = 0;
          y = h - (dist - 2 * w - h);
        }

        particles.push({
          x,
          y,
          baseX: x,
          baseY: y,
          vx: 0,
          vy: 0,
          size: Math.random() * 1.2 + 0.6,
          alpha: Math.random() * 0.4 + 0.6,
        });
      }

      particlesRef.current = particles;
    };

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      initParticles(rect.width, rect.height);
    };

    const animate = () => {
      timeRef.current += 0.015;
      const rect = container.getBoundingClientRect();

      ctx.clearRect(0, 0, rect.width, rect.height);

      const mouse = mouseRef.current;
      const repelStrength = 1.2;
      const returnStrength = 0.06;
      const damping = 0.86;

      for (const p of particlesRef.current) {
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < repelRadius && dist > 0) {
          const force = ((repelRadius - dist) / repelRadius) * repelStrength;
          p.vx += (dx / dist) * force;
          p.vy += (dy / dist) * force;
        }

        p.vx += (p.baseX - p.x) * returnStrength;
        p.vy += (p.baseY - p.y) * returnStrength;

        p.vx *= damping;
        p.vy *= damping;

        p.x += p.vx;
        p.y += p.vy;

        const breath = 0.7 + Math.sin(timeRef.current + p.baseX * 0.02) * 0.3;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = p.alpha * breath;
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(animate);
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    const onMouseLeave = () => {
      mouseRef.current = { x: -9999, y: -9999 };
    };

    resize();
    animate();

    const ro = new ResizeObserver(resize);
    ro.observe(container);

    container.addEventListener('mousemove', onMouseMove);
    container.addEventListener('mouseleave', onMouseLeave);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      container.removeEventListener('mousemove', onMouseMove);
      container.removeEventListener('mouseleave', onMouseLeave);
    };
  }, [particleCount, color, repelRadius]);

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      style={{ position: 'relative' }}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: '0',
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 30,
        }}
      />
      <div style={{ position: 'relative', zIndex: 20 }}>{children}</div>
    </div>
  );
}
