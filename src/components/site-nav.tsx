'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { MeResponse } from '@/lib/types';

const NAV_LINKS = [
  { href: '/#about', label: '关于我们' },
];

// 👇 单独抽离的导航项
const SERIES_GAMES = [
  { href: '/utd', label: '长夜之下：第七首诗' }
];

interface SiteNavProps {
  entered?: boolean;
  onOpenChangelog?: () => void;
}

const ME_CACHE_KEY = 'site-nav-me-cache';

function readCachedMe(): MeResponse | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(ME_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.role && parsed.role !== 'none') {
      return parsed as MeResponse;
    }
    return null;
  } catch {
    return null;
  }
}

function writeCachedMe(data: MeResponse | null) {
  if (typeof window === 'undefined') return;
  try {
    if (data && data.role !== 'none') {
      window.localStorage.setItem(ME_CACHE_KEY, JSON.stringify(data));
    } else {
      window.localStorage.removeItem(ME_CACHE_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function SiteNav({ entered = true, onOpenChangelog }: SiteNavProps) {
  const [me, setMe] = useState<MeResponse | null>(() => readCachedMe());
  const [checked, setChecked] = useState<boolean>(() => readCachedMe() !== null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // 判断当前是否在 /utd 页面，如果是，就不让点击 Nav 里的按钮，或者给它高亮显示
  const isUtdPage = pathname === '/utd';

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
      warm: boolean;
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
          warm: i % 5 === 0,
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
        ctx.fillStyle = p.warm
          ? `rgba(232,112,74,${p.alpha.toFixed(3)})`
          : `rgba(220,222,226,${p.alpha.toFixed(3)})`;
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
    const cached = readCachedMe();
    if (cached) {
      setMe(cached);
      setChecked(true);
    }

    fetch('/api/me', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: MeResponse | null) => {
        if (!active) return;
        const resolved = data && data.role !== 'none' ? data : null;
        setMe(resolved);
        setChecked(true);
        writeCachedMe(resolved);
      })
      .catch(() => {
        if (!active) return;
        const fallback = readCachedMe();
        setMe(fallback);
        setChecked(true);
      });

    return () => {
      active = false;
    };
  }, [pathname]);

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

  const loggedInLabel: string | null = me
    ? (me.email && String(me.email).trim()) || '我的账号'
    : null;

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center pointer-events-none pt-4">
      
      <div 
        className="pointer-events-auto relative flex flex-col items-center"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        
        {/* 👇 外层：控制物理弹性动效 */}
        <div
          className={`
            relative flex items-center justify-center
            transition-all duration-700 ease-[cubic-bezier(0.175,0.885,0.32,1.1)]
            ${isHovered ? 'md:w-auto md:h-12 md:rounded-full' : 'md:w-12 md:h-12 md:rounded-full'}
            max-md:w-auto max-md:h-12 max-md:rounded-full
          `}
          style={{
            maxWidth: isHovered ? '600px' : '48px',
          }}
        >
          {/* 背景层 */}
          <div
            className={`
              absolute inset-0 rounded-full border border-[#25262a] bg-[#111215]/95 backdrop-blur-xl
              transition-all duration-700 ease-[cubic-bezier(0.175,0.885,0.32,1.1)]
              ${isHovered ? 'md:shadow-[0_10px_40px_rgba(0,0,0,0.6)]' : 'md:shadow-[0_4px_15px_rgba(0,0,0,0.4)]'}
            `}
          />

          {/* 👇 内层内容 */}
          <div
            className={`
              relative z-10 flex items-center gap-6 whitespace-nowrap px-6
              transition-all duration-700 ease-[cubic-bezier(0.175,0.885,0.32,1.1)]
              ${isHovered ? 'md:opacity-100 md:translate-x-0 md:blur-0' : 'md:opacity-0 md:translate-x-6 md:blur-sm md:pointer-events-none'}
              opacity-100 translate-x-0 blur-0 pointer-events-auto
            `}
          >
            {/* Logo */}
            <Link href="/" className="group flex items-center gap-2 outline-none">
              <span className="h-1.5 w-1.5 rounded-full bg-[#e8704a] transition-transform duration-300 group-hover:scale-125 group-hover:shadow-[0_0_8px_#e8704a]" />
              <span className="text-[13px] font-light tracking-[0.3em] text-[#e8e9eb] transition-colors group-hover:text-white">
                番茄鱼工作室
              </span>
            </Link>

            <div className="h-3.5 w-px bg-[#3a3b40]/60" />

            {/* 导航链接 */}
            <nav className="flex items-center gap-6">
              {NAV_LINKS.map((link) => {
                const isAnchor = link.href.startsWith('/#');
                const isExternal = (link as { external?: boolean }).external === true;
                const Component = (isAnchor || isExternal) ? 'a' : Link;
                return (
                  <Component
                    key={link.href}
                    href={link.href as never}
                    onClick={isAnchor ? (e) => handleAnchorClick(e, link.href) : undefined}
                    className="group relative text-xs font-light tracking-[0.25em] text-[#8a8c91] transition-colors duration-300 hover:text-[#e8e9eb] outline-none"
                  >
                    {link.label}
                    <span className="absolute -bottom-1.5 left-1/2 h-px w-0 -translate-x-1/2 bg-[#e8704a] transition-all duration-300 group-hover:w-full" />
                  </Component>
                );
              })}

              {/* 👇 长夜之下系列：直接作为主按钮展示 */}
              {SERIES_GAMES.map((game) => (
                <Link
                  key={game.href}
                  href={game.href}
                  // 如果已经在 /utd 页面，点击阻止默认跳转并强制刷新
                  onClick={(e) => {
                    if (isUtdPage) {
                      e.preventDefault();
                      router.push('/utd');
                    }
                  }}
                  className={`group relative flex items-center gap-1.5 text-xs font-light tracking-[0.25em] transition-all duration-300 outline-none ${
                    isUtdPage ? 'text-[#e8704a]' : 'text-[#e8e9eb] hover:text-[#e8704a]'
                  }`}
                >
                  <span className={`h-1 w-1 rounded-full shadow-[0_0_6px_#e8704a] transition-colors ${isUtdPage ? 'bg-[#e8704a]' : 'bg-[#e8704a]/80'}`} />
                  {game.label}
                  
                  {/* 只有在当前页面，下划线才常驻 */}
                  <span className={`absolute -bottom-1.5 left-1/2 h-px -translate-x-1/2 bg-[#e8704a] transition-all duration-300 ${
                    isUtdPage ? 'w-full' : 'w-0 group-hover:w-full'
                  }`} />
                </Link>
              ))}
            </nav>
          </div>

          {/* 未悬浮状态下的小球中心 */}
          <div 
            className={`
              absolute inset-0 flex items-center justify-center pointer-events-none
              transition-all duration-700 ease-[cubic-bezier(0.175,0.885,0.32,1.1)]
              ${isHovered ? 'md:opacity-0 md:scale-50 md:blur-sm' : 'md:opacity-100 md:scale-100 md:blur-0'}
              hidden md:flex
            `}
          >
            <div className="absolute h-6 w-6 rounded-full bg-[#e8704a]/20 animate-ping" style={{ animationDuration: '3s' }} />
            <div className="absolute h-4 w-4 rounded-full bg-[#e8704a]/30 animate-pulse" />
            <span className="relative h-2 w-2 rounded-full bg-[#e8704a] shadow-[0_0_10px_#e8704a]" />
          </div>

        </div>
      </div>

      {/* 移动端菜单 */}
      <div
        className={`pointer-events-auto absolute left-4 right-4 top-[calc(100%+8px)] overflow-hidden rounded-2xl border border-[#25262a] bg-[#0a0a0b]/95 backdrop-blur-xl transition-all duration-500 md:hidden ${
          mobileOpen ? 'max-h-[400px] opacity-100' : 'max-h-0 opacity-0 border-transparent'
        }`}
      >
        <nav className="flex flex-col px-6 py-6 gap-6">
          {NAV_LINKS.map((link) => {
            const isAnchor = link.href.startsWith('/#');
            const isExternal = (link as { external?: boolean }).external === true;
            const Component = (isAnchor || isExternal) ? 'a' : Link;
            return (
              <Component
                key={link.href}
                href={link.href as never}
                onClick={() => setMobileOpen(false)}
                className="text-sm font-light tracking-[0.3em] text-[#a0a2a8] transition-colors hover:text-[#e8e9eb]"
              >
                {link.label}
              </Component>
            );
          })}

          {/* 移动端的系列游戏 */}
          <div className="flex flex-col gap-4">
            <span className="text-[10px] font-light tracking-[0.3em] text-[#5a5c62]">网页游戏</span>
            <div className="flex flex-col gap-3 pl-4 border-l border-[#25262a]">
              {SERIES_GAMES.map((game) => (
                <Link
                  key={game.href}
                  href={game.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2 text-xs font-light tracking-wider transition-colors ${
                    isUtdPage ? 'text-[#e8704a]' : 'text-[#e8e9eb] hover:text-[#e8704a]'
                  }`}
                >
                  <span className="h-1 w-1 rounded-full bg-[#e8704a]" />
                  {game.label}
                </Link>
              ))}
            </div>
          </div>
        </nav>
      </div>
    </header>
  );
}