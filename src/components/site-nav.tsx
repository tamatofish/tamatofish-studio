'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { MeResponse } from '@/lib/types';

const NAV_LINKS = [
  { href: '/#about', label: '关于我们' },
  { href: '/#contact', label: '合作意向' },
  { href: '/login', label: '访客登录' },
  { href: '/staff-login', label: '管理平台' },
];

interface SiteNavProps {
  entered?: boolean;
  onOpenChangelog?: () => void;
}

export function SiteNav({ entered = true, onOpenChangelog }: SiteNavProps) {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [checked, setChecked] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  const handleAnchorClick = (e: React.MouseEvent, href: string) => {
    e.preventDefault();
    const id = href.replace('/#', '');
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.location.href = href;
    }
  };

  const handleChangelogClick = () => {
    if (!entered) return;
    if (onOpenChangelog) onOpenChangelog();
  };

  // 全局鼠标点击：以点击点为圆心生成规则小圆环
  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.style.cssText =
      'position:fixed;inset:0;z-index:9996;pointer-events:none;';
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    interface P {
      cx: number; cy: number;
      angle: number;
      radius: number;
      radiusSpeed: number;
      size: number; alpha: number; life: number;
    }
    const particles: P[] = [];
    let raf = 0;

    const onMouseDown = (e: MouseEvent) => {
      const count = 42;
      const initRadius = 11;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        particles.push({
          cx: e.clientX,
          cy: e.clientY,
          angle,
          radius: initRadius + (Math.random() - 0.5) * 1.5,
          radiusSpeed: 0.18 + Math.random() * 0.3,
          size: 0.6 + Math.random() * 0.7,
          alpha: 0.6 + Math.random() * 0.3,
          life: 1,
        });
      }
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.radius += p.radiusSpeed;
        p.radiusSpeed *= 0.99;
        p.life -= 0.007;
        p.alpha = Math.max(0, p.life);
        p.size *= 0.996;

        if (p.alpha <= 0.01 || p.size < 0.15) {
          particles.splice(i, 1);
          continue;
        }

        const x = p.cx + Math.cos(p.angle) * p.radius;
        const y = p.cy + Math.sin(p.angle) * p.radius;

        ctx.beginPath();
        ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(52,52,58,${p.alpha.toFixed(3)})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(animate);
    };
    animate();

    document.addEventListener('mousedown', onMouseDown);

    const onResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('resize', onResize);
      canvas.remove();
    };
  }, []);

  useEffect(() => {
    let active = true;
    fetch('/api/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: MeResponse | null) => {
        if (active) {
          setMe(data && data.role !== 'none' ? data : null);
          setChecked(true);
        }
      })
      .catch(() => {
        if (active) setChecked(true);
      });
    return () => {
      active = false;
    };
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'border-b border-[#e3e4e8]/70 bg-[#f2f3f5]/80 backdrop-blur-md'
          : 'border-b border-transparent bg-transparent'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[#e8704a] transition-transform duration-300 group-hover:scale-125" />
          <span className="text-sm font-light tracking-[0.4em] text-[#1b1c1e]">番茄鱼工作室</span>
        </Link>

        <nav className="hidden items-center gap-10 md:flex">
          {NAV_LINKS.map((link) => {
            const isAnchor = link.href.startsWith('/#');
            const Component = isAnchor ? 'a' : Link;
            return (
              <Component
                key={link.href}
                href={link.href as never}
                onClick={isAnchor ? (e) => handleAnchorClick(e, link.href) : undefined}
                className="group relative text-xs font-light tracking-[0.25em] text-[#85888e] transition-colors duration-300 hover:text-[#1b1c1e]"
              >
                {link.label}
                <span className="absolute -bottom-1.5 left-1/2 h-px w-0 -translate-x-1/2 bg-[#1b1c1e] transition-all duration-300 group-hover:w-full" />
              </Component>
            );
          })}

          {/* 更新日志按钮 */}
          {onOpenChangelog && (
            <button
              type="button"
              onClick={handleChangelogClick}
              disabled={!entered}
              className={`group relative text-xs font-light tracking-[0.25em] transition-colors duration-300 ${
                entered
                  ? 'text-[#85888e] hover:text-[#1b1c1e]'
                  : 'cursor-not-allowed text-[#c9ccd1]'
              }`}
              title={entered ? '查看更新日志' : '请先进入主页'}
            >
              更新日志
              <span
                className={`absolute -bottom-1.5 left-1/2 h-px -translate-x-1/2 bg-[#1b1c1e] transition-all duration-300 ${
                  entered ? 'w-0 group-hover:w-full' : 'w-0'
                }`}
              />
            </button>
          )}
        </nav>

        <div className="flex items-center">
          {!checked ? (
            <span className="text-xs font-light tracking-[0.2em] text-[#b9bcc2]">…</span>
          ) : me ? (
            <Link
              href={me.role === 'internal' ? '/admin' : '/dashboard'}
              className="group hidden items-center gap-2 text-xs font-light tracking-[0.2em] text-[#1b1c1e] md:inline-flex"
            >
              {me.role === 'internal' ? '进入工作台' : '我的中心'}
              <svg
                width="10"
                height="10"
                viewBox="0 0 10 10"
                fill="none"
                className="transition-transform duration-300 group-hover:translate-x-0.5"
              >
                <path d="M1 5h8M5.5 1.5 9 5l-3.5 3.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          ) : (
            <Link
              href="/register"
              className="group hidden items-center gap-2 text-xs font-light tracking-[0.2em] text-[#1b1c1e] md:inline-flex"
            >
              注册合作
              <svg
                width="10"
                height="10"
                viewBox="0 0 10 10"
                fill="none"
                className="transition-transform duration-300 group-hover:translate-x-0.5"
              >
                <path d="M1 5h8M5.5 1.5 9 5l-3.5 3.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          )}

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="relative flex h-8 w-8 items-center justify-center md:hidden"
            aria-label="菜单"
          >
            <span
              className={`absolute h-px w-5 bg-[#1b1c1e] transition-all duration-300 ${
                mobileOpen ? 'rotate-45' : '-translate-y-1.5'
              }`}
            />
            <span
              className={`absolute h-px w-5 bg-[#1b1c1e] transition-all duration-300 ${
                mobileOpen ? 'opacity-0' : 'opacity-100'
              }`}
            />
            <span
              className={`absolute h-px w-5 bg-[#1b1c1e] transition-all duration-300 ${
                mobileOpen ? '-rotate-45' : 'translate-y-1.5'
              }`}
            />
          </button>
        </div>
      </div>

      <div
        className={`overflow-hidden border-t border-[#e3e4e8]/70 bg-[#f2f3f5]/95 backdrop-blur-md transition-all duration-500 md:hidden ${
          mobileOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <nav className="flex flex-col px-6 py-4">
          {NAV_LINKS.map((link) => {
            const isAnchor = link.href.startsWith('/#');
            const Component = isAnchor ? 'a' : Link;
            return (
              <Component
                key={link.href}
                href={link.href as never}
                onClick={() => setMobileOpen(false)}
                className="border-b border-[#e3e4e8]/50 py-4 text-xs font-light tracking-[0.3em] text-[#55585e] transition-colors last:border-0 hover:text-[#1b1c1e]"
              >
                {link.label}
              </Component>
            );
          })}

          {/* 移动端更新日志 */}
          {onOpenChangelog && (
            <button
              type="button"
              onClick={() => {
                if (!entered) return;
                setMobileOpen(false);
                onOpenChangelog();
              }}
              disabled={!entered}
              className={`border-b border-[#e3e4e8]/50 py-4 text-left text-xs font-light tracking-[0.3em] transition-colors ${
                entered ? 'text-[#55585e] hover:text-[#1b1c1e]' : 'cursor-not-allowed text-[#c9ccd1]'
              }`}
            >
              更新日志
            </button>
          )}

          {checked && !me && (
            <Link
              href="/register"
              onClick={() => setMobileOpen(false)}
              className="mt-2 inline-flex items-center gap-2 py-4 text-xs font-light tracking-[0.3em] text-[#1b1c1e]"
            >
              注册合作
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1 5h8M5.5 1.5 9 5l-3.5 3.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          )}
          {checked && me && (
            <Link
              href={me.role === 'internal' ? '/admin' : '/dashboard'}
              onClick={() => setMobileOpen(false)}
              className="mt-2 inline-flex items-center gap-2 py-4 text-xs font-light tracking-[0.3em] text-[#1b1c1e]"
            >
              {me.role === 'internal' ? '进入工作台' : '我的中心'}
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1 5h8M5.5 1.5 9 5l-3.5 3.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}