'use client';
import { useEffect, useRef } from 'react';

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface Particle {
  boxIndex: number;
  homeX: number;
  homeY: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseSize: number;
  alpha: number;
  breathPhase: number;
  normalX: number;
  normalY: number;
}

const SAFE_MARGIN = 40;

export function ProductParticleBoxes({
  className = '',
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let boxes: Box[] = [];
    let particles: Particle[] = [];
    let mouseX = -9999;
    let mouseY = -9999;
    let hoveredBoxIndex = -1;
    let animId: number;
    const dpr = window.devicePixelRatio || 1;

    function collectBoxes() {
      const cardContainer = container!.querySelector('[data-particle-cards]') as HTMLElement;
      if (!cardContainer) return;
      const containerRect = container!.getBoundingClientRect();
      const cardNodes = Array.from(cardContainer.children);
      boxes = [];
      cardNodes.forEach((el) => {
        const htmlEl = el as HTMLElement;
        const rect = htmlEl.getBoundingClientRect();
        boxes.push({
          x: rect.left - containerRect.left,
          y: rect.top - containerRect.top,
          w: rect.width,
          h: rect.height,
        });
      });
    }

    function spawnParticles() {
      particles = [];
      boxes.forEach((box, boxIndex) => {
        const centerX = box.x + box.w / 2;
        const centerY = box.y + box.h / 2;
        const perimeter = 2 * (box.w + box.h);
        const particleCount = Math.floor(perimeter / 3.5);
        for (let i = 0; i < particleCount; i++) {
          const dist = (i / particleCount) * perimeter;
          let px = 0, py = 0;
          if (dist < box.w) {
            px = box.x + dist;
            py = box.y;
          } else if (dist < box.w + box.h) {
            px = box.x + box.w;
            py = box.y + (dist - box.w);
          } else if (dist < box.w * 2 + box.h) {
            px = box.x + box.w - (dist - box.w - box.h);
            py = box.y + box.h;
          } else {
            px = box.x;
            py = box.y + box.h - (dist - box.w * 2 - box.h);
          }

          const nx = px - centerX;
          const ny = py - centerY;
          const len = Math.sqrt(nx * nx + ny * ny) || 1;

          const baseSize = Math.random() * 1.2 + 0.4;
          particles.push({
            boxIndex,
            homeX: px,
            homeY: py,
            x: px,
            y: py,
            vx: 0,
            vy: 0,
            baseSize,
            alpha: Math.random() * 0.3 + 0.4,
            breathPhase: Math.random() * Math.PI * 2,
            normalX: nx / len,
            normalY: ny / len,
          });
        }
      });
    }

    function resizeCanvas() {
      const rect = container!.getBoundingClientRect();
      canvas!.width = (rect.width + SAFE_MARGIN * 2) * dpr;
      canvas!.height = (rect.height + SAFE_MARGIN * 2) * dpr;
      canvas!.style.width = `${rect.width + SAFE_MARGIN * 2}px`;
      canvas!.style.height = `${rect.height + SAFE_MARGIN * 2}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, SAFE_MARGIN * dpr, SAFE_MARGIN * dpr);
      collectBoxes();
      spawnParticles();
    }

    function animate(time: number) {
      ctx!.clearRect(-SAFE_MARGIN, -SAFE_MARGIN, canvas!.width / dpr, canvas!.height / dpr);

      const repelRadius = 60;
      const repelStrength = 0.6;
      const returnSpeed = 0.06;
      const damping = 0.88;

      for (const p of particles) {
        const dx = p.x - mouseX;
        const dy = p.y - mouseY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < repelRadius && dist > 0) {
          const force = ((repelRadius - dist) / repelRadius) * repelStrength;
          p.vx += (dx / dist) * force;
          p.vy += (dy / dist) * force;
        }

        const isHovered = p.boxIndex === hoveredBoxIndex;
        let breathScale = 1;
        let alphaScale = 1;
        let breathOffset = 0;

        if (isHovered) {
          const breath = Math.sin(time / 250 + p.breathPhase);
          breathScale = 1 + breath * 0.8;
          alphaScale = 0.7 + breath * 0.5;
          breathOffset = breath * 6;
        } else {
          const idleBreath = Math.sin(time / 1200 + p.breathPhase);
          breathScale = 1 + idleBreath * 0.15;
          alphaScale = 0.85 + idleBreath * 0.15;
          breathOffset = idleBreath * 1.5;
        }

        const targetX = p.homeX + p.normalX * breathOffset;
        const targetY = p.homeY + p.normalY * breathOffset;

        p.vx += (targetX - p.x) * returnSpeed;
        p.vy += (targetY - p.y) * returnSpeed;
        p.vx *= damping;
        p.vy *= damping;
        p.x += p.vx;
        p.y += p.vy;

        const radius = Math.max(0.1, p.baseSize * breathScale);
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(30, 30, 35, ${p.alpha * alphaScale})`;
        ctx!.fill();
      }
      animId = requestAnimationFrame(animate);
    }

    const onMouseMove = (e: MouseEvent) => {
      const rect = container!.getBoundingClientRect();
      mouseX = e.clientX - rect.left + SAFE_MARGIN;
      mouseY = e.clientY - rect.top + SAFE_MARGIN;

      hoveredBoxIndex = -1;
      boxes.forEach((box, index) => {
        if (
          e.clientX - rect.left >= box.x &&
          e.clientX - rect.left <= box.x + box.w &&
          e.clientY - rect.top >= box.y &&
          e.clientY - rect.top <= box.y + box.h
        ) {
          hoveredBoxIndex = index;
        }
      });
    };

    const onMouseLeave = () => {
      mouseX = -9999;
      mouseY = -9999;
      hoveredBoxIndex = -1;
    };

    const timer = setTimeout(() => {
      resizeCanvas();
      animId = requestAnimationFrame(animate);
    }, 100);

    const ro = new ResizeObserver(() => {
      resizeCanvas();
    });
    ro.observe(container);
    container.addEventListener('mousemove', onMouseMove);
    container.addEventListener('mouseleave', onMouseLeave);

    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(animId);
      ro.disconnect();
      container.removeEventListener('mousemove', onMouseMove);
      container.removeEventListener('mouseleave', onMouseLeave);
    };
  }, []);

  return (
    <div ref={containerRef} className={`relative overflow-visible ${className}`}>
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute z-0"
        style={{ top: -40, left: -40 }}
      />

      <div className="relative z-10" data-particle-cards>
        {children}
      </div>
    </div>
  );
}