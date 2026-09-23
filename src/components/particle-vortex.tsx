'use client';

import { useEffect, useRef } from 'react';

export function ParticleVortex({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = 0;
    let height = 0;
    // 优化1：DPR 从2降到1.5，像素数减少44%，肉眼几乎无差别
    let dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let raf = 0;
    let time = 0;
    let isVisible = true;
    let isPageVisible = true;
    let running = false;

    type Layer = 'dust' | 'far' | 'mid' | 'near' | 'spark';

    interface Particle {
      angle: number;
      radius: number;
      baseSize: number;
      alpha: number;
      speed: number;
      arm: number;
      armOffset: number;
      layer: Layer;
      depth: number;
      pullVx: number;
      pullVy: number;
      twinkle: number;
      twinkleSpeed: number;
      turbulence: number;
      turbulenceSpeed: number;
      densityPhase: number;
    }

    let particles: Particle[] = [];
    let noiseCanvas: HTMLCanvasElement | null = null;
    let noisePattern: CanvasPattern | null = null; // 优化2：预创建噪点pattern，不每帧新建

    const mouse = {
      x: 0, y: 0, targetX: 0, targetY: 0,
      active: false, vx: 0, vy: 0,
      lastX: -9999, lastY: -9999, initialized: false,
    };

    const vortex = {
      cx: 0, cy: 0, targetCx: 0, targetCy: 0,
      scale: 1, targetScale: 1, rotation: 0,
    };

    const ARM_COUNT = 4;
    const armAngles = Array.from({ length: ARM_COUNT }, (_, i) => (i / ARM_COUNT) * Math.PI * 2);

    const CLEAR_RADIUS = 0.38;
    const VANISH_RADIUS = 0.26;

    const gaussian = (): number => {
      const u1 = Math.max(Math.random(), 0.0001);
      const u2 = Math.random();
      return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    };

    const generateNoise = () => {
      noiseCanvas = document.createElement('canvas');
      noiseCanvas.width = 256;
      noiseCanvas.height = 256;
      const nctx = noiseCanvas.getContext('2d');
      if (!nctx) return;
      const imgData = nctx.createImageData(256, 256);
      for (let i = 0; i < imgData.data.length; i += 4) {
        const v = 200 + Math.random() * 40;
        imgData.data[i] = v;
        imgData.data[i + 1] = v;
        imgData.data[i + 2] = v - 2;
        imgData.data[i + 3] = 8 + Math.random() * 12;
      }
      nctx.putImageData(imgData, 0, 0);
      // 预创建pattern
      noisePattern = ctx.createPattern(noiseCanvas, 'repeat');
    };

    const spawn = (fromOutside = false): Particle => {
      const roll = Math.random();
      let layer: Layer = 'far';
      let depth = 0.7 + Math.random() * 0.3;
      let baseSize = 0.14 + Math.random() * 0.3;
      let alpha = 0.12 + Math.random() * 0.28;
      let speed = 0.0003 + Math.random() * 0.0005;

      if (roll > 0.28 && roll <= 0.48) {
        layer = 'dust';
        depth = 0.85 + Math.random() * 0.15;
        baseSize = 0.1 + Math.random() * 0.2;
        alpha = 0.07 + Math.random() * 0.15;
        speed = 0.00025 + Math.random() * 0.00035;
      } else if (roll > 0.48 && roll <= 0.76) {
        layer = 'mid';
        depth = 0.3 + Math.random() * 0.4;
        baseSize = 0.24 + Math.random() * 0.4;
        alpha = 0.28 + Math.random() * 0.42;
        speed = 0.00038 + Math.random() * 0.0006;
      } else if (roll > 0.76 && roll <= 0.95) {
        layer = 'near';
        depth = 0.06 + Math.random() * 0.26;
        baseSize = 0.36 + Math.random() * 0.52;
        alpha = 0.36 + Math.random() * 0.45;
        speed = 0.00045 + Math.random() * 0.0008;
      } else if (roll > 0.95) {
        layer = 'spark';
        depth = 0.02 + Math.random() * 0.12;
        baseSize = 0.44 + Math.random() * 0.44;
        alpha = 0.42 + Math.random() * 0.4;
        speed = 0.0005 + Math.random() * 0.0009;
      }

      const arm = Math.floor(Math.random() * ARM_COUNT);
      const armOffset = gaussian() * 0.16;
      const radius = fromOutside
        ? 1.0 + Math.random() * 0.35
        : CLEAR_RADIUS + Math.random() * (1.0 - CLEAR_RADIUS);

      return {
        angle: Math.random() * Math.PI * 2,
        radius,
        baseSize,
        alpha,
        speed,
        arm,
        armOffset,
        layer,
        depth,
        pullVx: 0,
        pullVy: 0,
        twinkle: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.008 + Math.random() * 0.035,
        turbulence: Math.random() * Math.PI * 2,
        turbulenceSpeed: 0.004 + Math.random() * 0.012,
        densityPhase: Math.random() * Math.PI * 2,
      };
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (!mouse.initialized) {
        mouse.x = width / 2;
        mouse.y = height / 2;
        mouse.targetX = width / 2;
        mouse.targetY = height / 2;
        mouse.initialized = true;
      }
      vortex.cx = width / 2;
      vortex.cy = height / 2;
      vortex.targetCx = width / 2;
      vortex.targetCy = height / 2;

      const area = width * height;
      // 优化3：粒子上限 22000→15000，密度 area/70→area/100，减少约30%粒子
      const count = Math.min(15000, Math.max(3000, Math.floor(area / 100)));
      particles = Array.from({ length: count }, () => spawn(false));
    };

    // 优化4：简化噪声函数，去掉一组三角函数
    const noise2D = (x: number, y: number): number => {
      return Math.sin(x * 1.2 + y * 0.8) * 0.5 + 0.5;
    };

    const drawFrame = () => {
      time += 0.016;

      // 背景
      ctx.fillStyle = '#e6e6e4';
      ctx.fillRect(0, 0, width, height);

      // 噪点：用预创建的pattern，不每帧新建
      if (noisePattern) {
        ctx.fillStyle = noisePattern;
        ctx.fillRect(0, 0, width, height);
      }

      // 漩涡中心跟随鼠标
      const offsetX = (mouse.targetX - width / 2) * 0.14;
      const offsetY = (mouse.targetY - height / 2) * 0.14;
      vortex.targetCx = width / 2 + offsetX;
      vortex.targetCy = height / 2 + offsetY;

      const distFromCenter = Math.sqrt(
        (mouse.targetX - width / 2) ** 2 +
        (mouse.targetY - height / 2) ** 2
      );
      const maxDist = Math.min(width, height) * 0.5;
      vortex.targetScale = 1 + (1 - Math.min(distFromCenter / maxDist, 1)) * 0.07;

      vortex.cx += (vortex.targetCx - vortex.cx) * 0.05;
      vortex.cy += (vortex.targetCy - vortex.cy) * 0.05;
      vortex.scale += (vortex.targetScale - vortex.scale) * 0.04;
      vortex.rotation += 0.0005;

      const cx = vortex.cx;
      const cy = vortex.cy;
      const maxR = Math.min(width, height) * 0.8 * vortex.scale;

      // 暗角
      const vignette = ctx.createRadialGradient(cx, cy, maxR * 0.2, cx, cy, maxR * 1.4);
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(1, 'rgba(0,0,0,0.06)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, width, height);

      // 中心光团
      const glow1 = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR * 0.92);
      glow1.addColorStop(0, 'rgba(255,255,255,1)');
      glow1.addColorStop(0.12, 'rgba(255,255,255,0.97)');
      glow1.addColorStop(0.32, 'rgba(255,255,255,0.78)');
      glow1.addColorStop(0.52, 'rgba(255,255,255,0.48)');
      glow1.addColorStop(0.75, 'rgba(255,255,255,0.18)');
      glow1.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = glow1;
      ctx.beginPath();
      ctx.arc(cx, cy, maxR * 0.92, 0, Math.PI * 2);
      ctx.fill();

      const glow2 = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR * 0.32);
      glow2.addColorStop(0, 'rgba(255,255,255,0.65)');
      glow2.addColorStop(0.5, 'rgba(255,255,255,0.22)');
      glow2.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = glow2;
      ctx.beginPath();
      ctx.arc(cx, cy, maxR * 0.32, 0, Math.PI * 2);
      ctx.fill();

      const SPIRAL_STRENGTH = 4.2;
      const sin = Math.sin;
      const cos = Math.cos;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // 粒子运动
        const rNorm = Math.min(p.radius, 1);
        const inwardSpeed = 0.0003 + (1 - rNorm) ** 2.5 * 0.0022;
        p.radius -= inwardSpeed;
        p.angle += p.speed * (1 + (1 - rNorm) * 3);
        p.twinkle += p.twinkleSpeed;
        p.turbulence += p.turbulenceSpeed;
        p.densityPhase += 0.008;

        if (p.radius <= VANISH_RADIUS) {
          Object.assign(p, spawn(true));
          continue;
        }

        const armBaseAngle = armAngles[p.arm];
        const dynamicArmOffset = p.armOffset + sin(p.turbulence + time * p.armOffset * 50) * 0.03;
        const spiralAngle = p.angle + armBaseAngle + (1 - rNorm) * SPIRAL_STRENGTH + dynamicArmOffset + vortex.rotation;
        const r = rNorm ** 1.35 * maxR;

        let x = cx + cos(spiralAngle) * r;
        let y = cy + sin(spiralAngle) * r * 0.92;

        // 湍流（简化）
        const turbStrength = (1 - rNorm) * 4;
        x += (noise2D(p.angle * 2 + time, p.radius * 3) - 0.5) * 2 * turbStrength;
        y += (noise2D(p.radius * 3, p.angle * 1.5 + time * 0.5) - 0.5) * 2 * turbStrength;

        // 视差
        let parallaxFactor = 1.0;
        if (p.layer === 'dust') parallaxFactor = 1.45;
        else if (p.layer === 'far') parallaxFactor = 1.2;
        else if (p.layer === 'mid') parallaxFactor = 0.78;
        else if (p.layer === 'near') parallaxFactor = 0.38;
        else parallaxFactor = 0.22;

        x += (mouse.targetX - width / 2) * 0.045 * parallaxFactor;
        y += (mouse.targetY - height / 2) * 0.045 * parallaxFactor;

        // 鼠标吸引力
        if (mouse.active) {
          const dx = mouse.x - x;
          const dy = mouse.y - y;
          const dist2 = dx * dx + dy * dy;
          const influenceR2 = 44100; // 210*210
          if (dist2 < influenceR2 && dist2 > 0.001) {
            const dist = Math.sqrt(dist2);
            const falloff = 1 - dist / 210;
            const force = falloff * falloff * 1.35;
            p.pullVx += (dx / dist) * force * 2.2 + mouse.vx * force * 0.32;
            p.pullVy += (dy / dist) * force * 2.2 + mouse.vy * force * 0.32;
            p.pullVx += (-dy / dist) * force * 0.65;
            p.pullVy += (dx / dist) * force * 0.65;
          }
        }

        x += p.pullVx;
        y += p.pullVy;
        p.pullVx *= 0.95;
        p.pullVy *= 0.95;

        // 中心淡出
        let centerFade = 1;
        let centerShrink = 1;
        if (p.radius < CLEAR_RADIUS) {
          const t = (p.radius - VANISH_RADIUS) / (CLEAR_RADIUS - VANISH_RADIUS);
          centerFade = t > 1 ? 1 : t < 0 ? 0 : t;
          centerShrink = centerFade;
        }

        const edgeFadeIn = p.radius > 1 ? Math.max(0, 1 - (p.radius - 1) / 0.35) : 1;
        const densityWave = 0.7 + 0.3 * sin(p.angle * 1.8 + p.densityPhase + p.arm * 1.2);

        const twinkleFade = (p.layer === 'near' || p.layer === 'spark')
          ? 0.72 + sin(p.twinkle) * 0.28
          : 0.92 + sin(p.twinkle) * 0.08;

        // 颜色和深度（简化为预计算映射）
        let depthAlpha = 1, depthSize = 1, color = 40;
        if (p.layer === 'dust') { depthAlpha = 0.38; depthSize = 0.68; color = 28; }
        else if (p.layer === 'far') { depthAlpha = 0.52; depthSize = 0.78; color = 31; }
        else if (p.layer === 'mid') { depthAlpha = 0.82; depthSize = 1.0; color = 39; }
        else if (p.layer === 'near') { depthAlpha = 1.0; depthSize = 1.12; color = 49; }
        else { depthAlpha = 1.0; depthSize = 1.15; color = 52; }

        const radialFade = Math.min(1, rNorm * 1.8);
        const fade = p.alpha * radialFade * depthAlpha * twinkleFade * densityWave * centerFade * edgeFadeIn;
        const finalSize = p.baseSize * depthSize * centerShrink;

        if (fade < 0.01 || finalSize < 0.04) continue;

        // 优化5：小粒子用 fillRect 代替 arc，性能提升显著（<1.5px的粒子方圆几乎无差别）
        if (finalSize < 1.5) {
          ctx.fillStyle = `rgba(${color},${color},${color + 4},${fade.toFixed(3)})`;
          ctx.fillRect(x - finalSize, y - finalSize, finalSize * 2, finalSize * 2);
        } else {
          ctx.beginPath();
          ctx.arc(x, y, finalSize, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${color},${color},${color + 4},${fade.toFixed(3)})`;
          ctx.fill();
        }
      }

      mouse.vx *= 0.9;
      mouse.vy *= 0.9;
    };

    const startAnimation = () => {
      if (running || reducedMotion) return;
      running = true;
      const loop = () => {
        if (!isVisible || !isPageVisible) {
          running = false;
          return;
        }
        drawFrame();
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    };

    const stopAnimation = () => {
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      running = false;
    };

    const handleVisibilityChange = () => {
      isPageVisible = !document.hidden;
      if (isPageVisible && isVisible) startAnimation();
      else stopAnimation();
    };

    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          isVisible = entry.isIntersecting;
          if (isVisible && isPageVisible) startAnimation();
          else stopAnimation();
        }
      },
      { threshold: 0.01 }
    );

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const nx = e.clientX - rect.left;
      const ny = e.clientY - rect.top;
      if (nx >= -100 && nx <= width + 100 && ny >= -100 && ny <= height + 100) {
        if (mouse.lastX > -9000) {
          mouse.vx = nx - mouse.lastX;
          mouse.vy = ny - mouse.lastY;
        }
        mouse.lastX = nx;
        mouse.lastY = ny;
        mouse.x = nx;
        mouse.y = ny;
        mouse.targetX = nx;
        mouse.targetY = ny;
        mouse.active = true;
      }
    };

    const onMouseLeaveWindow = () => {
      mouse.active = false;
      mouse.vx = 0;
      mouse.vy = 0;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!e.touches[0]) return;
      const rect = canvas.getBoundingClientRect();
      const nx = e.touches[0].clientX - rect.left;
      const ny = e.touches[0].clientY - rect.top;
      if (mouse.lastX > -9000) {
        mouse.vx = nx - mouse.lastX;
        mouse.vy = ny - mouse.lastY;
      }
      mouse.lastX = nx;
      mouse.lastY = ny;
      mouse.x = nx;
      mouse.y = ny;
      mouse.targetX = nx;
      mouse.targetY = ny;
      mouse.active = true;
    };

    const onTouchEnd = () => {
      mouse.active = false;
      mouse.vx = 0;
      mouse.vy = 0;
    };

    generateNoise();
    resize();

    if (reducedMotion) {
      drawFrame();
    } else {
      startAnimation();
    }

    const onResize = () => {
      resize();
      if (reducedMotion) drawFrame();
    };

    intersectionObserver.observe(canvas);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('resize', onResize);
    window.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseleave', onMouseLeaveWindow);
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);

    return () => {
      stopAnimation();
      intersectionObserver.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseleave', onMouseLeaveWindow);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
    />
  );
}
