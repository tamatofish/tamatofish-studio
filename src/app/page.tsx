'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { SiteNav } from '@/components/site-nav';
import { ParticleVortex } from '@/components/particle-vortex';
import { ProductParticleBoxes } from '@/components/product-particle-boxes';
import { TeamSection } from '@/components/team-section';
import { InquirySection } from '@/components/inquiry-section';

const STATS = [
  { value: '2023', label: '工作室成立', suffix: '' },
  { value: '999+', label: '平台功能模块', suffix: '' },
  { value: '3', label: 'MAGIC 产品线', suffix: '' },
  { value: 'UE5', label: '核心技术引擎', suffix: '' },
];

const TIMELINE = [
  { time: '2023.06', text: '《港湾》正式立项，聚焦硬核拟真生存玩法，开始长达两年半的持续研发。' },
  { time: '2026.01', text: '受限于技术条件与资金，《港湾》早期版本研发终止，团队沉淀了完整的引擎与玩法资产。' },
  { time: '2026.01 —', text: '以多项目并行的技术验证方式，开发新一代《港湾》，让理想继续生长。' },
];

const PRODUCTS = [
  {
    name: 'MAGIC',
    tag: '标准辅助开发平台',
    audience: '个人开发者 / 初学者',
    price: '模块 299+',
    period: '29 RMB / 月',
    note: '内置数百个常用模块的一般用法与样例，让虚幻引擎的海量节点不再令初学者望而却步。',
    href: '/magic',
  },
  {
    name: 'MAGIC PRO',
    tag: '旗舰辅助开发平台',
    audience: '专业开发者 / 企业用户',
    price: '模块 699+',
    period: '999 RMB / 月',
    note: '在标准版能力之上，支持调用本地部署 AI，为专业团队提供更完整的辅助开发能力。',
    href: '/magic',
  },
  {
    name: 'MAGIC SE',
    tag: '即将上线',
    audience: '学生开发者 / 爱好者',
    price: '永久免费',
    period: '敬请期待',
    note: '面向学生开发者与爱好者的免费版本，让更多人有零门槛开始创作的机会。',
    href: '/magic',
  },
];

// ===== 更新日志（直接写在这里，随代码一起上传） =====
interface ChangelogItem {
  version: string;
  date: string;
  badge?: string;
  entries: string[];
}
const CHANGELOG: ChangelogItem[] = [
  {
    version: 'v1.0.1B',
    date: '2026-09-26',
    badge: '正式版',
    entries: [
      '修复已知问题',
      '添加日志系统',
      '优化显示效果和部分界面的操作逻辑',
    ],
  },
  {
    version: 'v1.0.0',
    date: '2026-09-24',
    badge: '正式版',
    entries: [
      '官网上线，展示工作室介绍、产品线与团队成员',
      '访客注册 / 登录系统',
      '合作意向提交与跟进',
      '内部文件管理与权限控制',
    ],
  },
  // 后续版本往这里追加，格式照抄即可
];

const FOOTER_LINKS = [
  { href: '/', label: '官网首页' },
  { href: '/login', label: '访客登录' },
  { href: '/register', label: '访客注册' },
  { href: '/staff-login', label: '成员入口' },
  { href: '/admin-login', label: '管理员入口' },
];

export default function Home() {
  const [entered, setEntered] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [heroOffset, setHeroOffset] = useState({ x: 0, y: 0 });
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [changelogVisible, setChangelogVisible] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);

  // 首屏滚动锁定
  useEffect(() => {
    if (!entered) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [entered]);

  // 首屏文字跟随鼠标偏移
  useEffect(() => {
    if (entered) return;
    const onMove = (e: MouseEvent) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const ox = (e.clientX - w / 2) * 0.14;
      const oy = (e.clientY - h / 2) * 0.14;
      setHeroOffset((prev) => ({
        x: prev.x + (ox - prev.x) * 0.05,
        y: prev.y + (oy - prev.y) * 0.05,
      }));
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [entered]);

  // 更新日志弹窗：禁止背景滚动 + Esc 关闭
  useEffect(() => {
    if (!changelogOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeChangelog(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = original;
      window.removeEventListener('keydown', onKey);
    };
  }, [changelogOpen]);

  const openChangelog = () => {
    setChangelogOpen(true);
    setChangelogVisible(false);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setChangelogVisible(true));
    });
  };

  const closeChangelog = () => {
    setChangelogVisible(false);
    window.setTimeout(() => setChangelogOpen(false), 220);
  };

  // 点击向下箭头：过渡后进入主内容
  const handleEnter = () => {
    if (exiting || entered) return;
    setExiting(true);
    window.setTimeout(() => {
      setEntered(true);
      setExiting(false);
      window.scrollTo(0, 0);
    }, 700);
  };

  const handleProductClick = (href: string) => {
    if (exiting) return;
    setExiting(true);
    window.setTimeout(() => {
      window.location.href = href;
    }, 750);
  };

  const handleFooterClick = (e: React.MouseEvent, href: string) => {
    e.preventDefault();
    if (exiting) return;
    setExiting(true);
    if (href === '/') {
      window.setTimeout(() => {
        setEntered(false);
        setExiting(false);
        window.scrollTo(0, 0);
      }, 700);
    } else {
      window.setTimeout(() => {
        window.location.href = href;
      }, 750);
    }
  };

  return (
    <div className="min-h-screen bg-[#f2f3f5] font-sans text-[#1b1c1e] antialiased">
      <SiteNav entered={entered} onOpenChangelog={openChangelog} />

      {/* ===== 首屏：粒子漩涡（刷新默认显示） ===== */}
      {!entered && (
        <section
          ref={heroRef}
          className={`fixed inset-0 z-40 flex h-screen min-h-[640px] flex-col overflow-hidden bg-gradient-to-b from-[#eceef0] via-[#f0f1f3] to-[#f5f6f7] transition-all duration-700 ${
            exiting ? 'scale-105 opacity-0' : 'scale-100 opacity-100'
          }`}
        >
          <ParticleVortex />
          <div
            className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 text-center"
            style={{
              transform: `translate(${heroOffset.x}px, ${heroOffset.y}px)`,
              transition: 'transform 0.05s linear',
            }}
          >
            <p className="text-[11px] font-light tracking-[0.5em] text-[#a3a6ac]">TAMATOFISH STUDIO</p>
            <h1 className="mt-7 text-4xl font-light tracking-[0.28em] text-[#1b1c1e] sm:text-5xl">
              番茄鱼工作室
            </h1>
            <p className="mt-6 text-sm font-light tracking-[0.65em] text-[#85888e]">
              跃然而起&ensp;腾飞万里
            </p>
            <p className="mt-10 max-w-xl text-[13px] font-light leading-7 text-[#9b9ea4]">
              成立于 2023 年的小型独立工作室，致力于游戏开发与软件开发。
            </p>
          </div>
          <div className="relative z-10 flex flex-col items-center pb-10">
            <button
              onClick={handleEnter}
              aria-label="向下了解更多"
              className="group flex h-11 w-11 items-center justify-center rounded-full border border-[#d4d6da] text-[#85888e] transition-colors hover:border-[#1b1c1e] hover:text-[#1b1c1e]"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="animate-bounce">
                <path d="M7 1v11M2.5 8.5 7 13l4.5-4.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </section>
      )}

      {/* ===== 主内容 ===== */}
      <div
        className={`transition-all duration-700 ${
          entered ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-8 opacity-0'
        } ${exiting ? 'scale-105 opacity-0' : ''}`}
      >
        {/* 数据条 */}
        <section className="border-y border-[#e3e4e8] bg-[#fbfbfc]">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-y-8 px-6 py-12 sm:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-3xl font-light tracking-wider text-[#1b1c1e]">{s.value}</p>
                <p className="mt-2 text-xs font-light tracking-[0.2em] text-[#9b9ea4]">{s.label}</p>
              </div>
            ))}
          </div>
        </section>
        {/* 01 关于我们 */}
        <section id="about" className="mx-auto max-w-6xl px-6 py-24">
          <div className="grid gap-12 lg:grid-cols-[220px_1fr]">
            <div>
              <p className="text-xs font-light tracking-[0.4em] text-[#b9bcc2]">01</p>
              <h2 className="mt-3 text-2xl font-light tracking-[0.2em] text-[#1b1c1e]">关于我们</h2>
              <div className="mt-4 h-px w-10 bg-[#e8704a]" />
            </div>
            <div className="space-y-6 text-[15px] font-light leading-8 text-[#55585e]">
              <p>
                番茄鱼工作室成立于 2023 年，是一家致力于<strong className="font-normal text-[#1b1c1e]">游戏开发</strong>与
                <strong className="font-normal text-[#1b1c1e]">软件开发</strong>的小型独立工作室。我们倾尽数年心血，
                自主开发 PC 游戏，并打造新一代开发辅助平台。
              </p>
              <p>
                我们相信，真正打动人的作品来自长期主义的技术积累与不肯将就的执着。
                从《港湾》到 MAGIC 平台，每一步都在为「跃然而起，腾飞万里」蓄力。
              </p>
            </div>
          </div>
        </section>
        {/* 02 游戏开发 · 港湾 */}
        <section className="border-t border-[#e3e4e8] bg-[#fbfbfc]">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <div className="grid gap-12 lg:grid-cols-[220px_1fr]">
              <div>
                <p className="text-xs font-light tracking-[0.4em] text-[#b9bcc2]">02</p>
                <h2 className="mt-3 text-2xl font-light tracking-[0.2em] text-[#1b1c1e]">游戏开发</h2>
                <p className="mt-2 text-xs font-light tracking-[0.3em] text-[#9b9ea4]">PC GAME · 港湾</p>
                <div className="mt-4 h-px w-10 bg-[#e8704a]" />
              </div>
              <div>
                <p className="text-[15px] font-light leading-8 text-[#55585e]">
                  《港湾》是一款硬核拟真生存端游，也是工作室倾尽数年心血的核心项目。
                  研发之路并非一帆风顺，但每一次沉没都是为了更稳的起航。
                </p>
                <ol className="mt-10 space-y-0 border-l border-[#e3e4e8]">
                  {TIMELINE.map((t) => (
                    <li key={t.time} className="relative pb-10 pl-8 last:pb-0">
                      <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full border border-[#c9ccd1] bg-[#fbfbfc]" />
                      <p className="text-xs font-light tracking-[0.3em] text-[#9b9ea4]">{t.time}</p>
                      <p className="mt-2 max-w-2xl text-sm font-light leading-7 text-[#55585e]">{t.text}</p>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </section>
        {/* 03 辅助开发平台 MAGIC */}
        <section className="border-t border-[#e3e4e8]">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <div className="grid gap-12 lg:grid-cols-[220px_1fr]">
              <div>
                <p className="text-xs font-light tracking-[0.4em] text-[#b9bcc2]">03</p>
                <h2 className="mt-3 text-2xl font-light tracking-[0.2em] text-[#1b1c1e]">辅助开发平台</h2>
                <p className="mt-2 text-xs font-light tracking-[0.3em] text-[#9b9ea4]">MAGIC SERIES</p>
                <div className="mt-4 h-px w-10 bg-[#e8704a]" />
                <p className="mt-6 max-w-[220px] text-xs font-light leading-6 text-[#9b9ea4]">
                  为 UE 引擎与部分开发环境设计的开发辅助系统。
                </p>
              </div>
              <ProductParticleBoxes className="w-full">
                <div className="grid gap-5 md:grid-cols-3">
                  {PRODUCTS.map((p) => (
                    <div key={p.name} className="group h-full">
                      <Link
                        href={p.href}
                        onClick={(e) => {
                          e.preventDefault();
                          handleProductClick(p.href);
                        }}
                        className="flex h-full w-full flex-col bg-white p-7 text-left"
                      >
                        <p className="text-lg font-light tracking-wider text-[#1b1c1e]">{p.name}</p>
                        <p className="mt-1 text-[11px] font-light tracking-[0.2em] text-[#9b9ea4]">{p.tag}</p>
                        <p className="mt-5 text-xs font-light text-[#85888e]">{p.audience}</p>
                        <p className="mt-4 text-sm font-light text-[#1b1c1e]">
                          {p.price}
                          <span className="ml-2 text-xs text-[#9b9ea4]">{p.period}</span>
                        </p>
                        <p className="mt-5 flex-1 text-xs font-light leading-6 text-[#55585e]">{p.note}</p>
                      </Link>
                    </div>
                  ))}
                </div>
              </ProductParticleBoxes>
            </div>
          </div>
        </section>
        {/* 04 团队 */}
        <section className="border-t border-[#e3e4e8] bg-[#fbfbfc]">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <div className="grid gap-12 lg:grid-cols-[220px_1fr]">
              <div>
                <p className="text-xs font-light tracking-[0.4em] text-[#b9bcc2]">04</p>
                <h2 className="mt-3 text-2xl font-light tracking-[0.2em] text-[#1b1c1e]">团队成员</h2>
                <div className="mt-4 h-px w-10 bg-[#e8704a]" />
              </div>
              <TeamSection />
            </div>
          </div>
        </section>
        {/* 05 合作意向 */}
        <section id="contact" className="border-t border-[#e3e4e8]">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <div className="grid gap-12 lg:grid-cols-[220px_1fr]">
              <div>
                <p className="text-xs font-light tracking-[0.4em] text-[#b9bcc2]">05</p>
                <h2 className="mt-3 text-2xl font-light tracking-[0.2em] text-[#1b1c1e]">合作意向</h2>
                <div className="mt-4 h-px w-10 bg-[#e8704a]" />
                <p className="mt-6 max-w-[220px] text-xs font-light leading-6 text-[#9b9ea4]">
                  注册成为访客并提交合作意向，工作室会尽快与你联系。
                </p>
              </div>
              <InquirySection />
            </div>
          </div>
        </section>
        {/* 底部黑色通栏 */}
        <footer className="bg-[#0a0a0b] text-[#8a8a8f]">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 py-12 text-center">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#e8704a]" />
              <span className="text-sm font-light tracking-[0.35em] text-[#c9c9cd]">番茄鱼工作室</span>
            </div>
            <nav className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs font-light">
              {FOOTER_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={(e) => handleFooterClick(e, link.href)}
                  className="transition-colors hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <p className="text-[11px] font-light tracking-wider text-[#55555a]">
              © 2026 番茄鱼工作室 TAMATOFISH STUDIO · 跃然而起 腾飞万里
            </p>
          </div>
        </footer>
      </div>

      {/* ===== 更新日志弹窗 ===== */}
      {changelogOpen && (
        <div
          onClick={closeChangelog}
          className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 transition-opacity duration-200 ${
            changelogVisible ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-[0_20px_60px_-15px_rgba(0,0,0,0.25)] transition-all duration-200 ${
              changelogVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
            }`}
          >
            {/* 顶部装饰线 */}
            <div className="h-px w-full bg-gradient-to-r from-transparent via-[#e8704a]/40 to-transparent" />

            {/* 关闭按钮 */}
            <button
              type="button"
              onClick={closeChangelog}
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-[#b9bcc2] transition-all hover:bg-[#f5f6f7] hover:text-[#1b1c1e]"
              aria-label="关闭"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>

            {/* 头部 */}
            <div className="px-8 pt-10 pb-6">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#e8704a]" />
                <span className="text-[10px] font-light tracking-[0.4em] text-[#b9bcc2]">CHANGELOG</span>
              </div>
              <h2 className="mt-3 text-2xl font-light tracking-[0.2em] text-[#1b1c1e]">更新日志</h2>
              <p className="mt-2 text-xs font-light text-[#9b9ea4]">记录番茄鱼工作室的每一次进化</p>
            </div>

            {/* 更新列表 */}
            <div className="max-h-[60vh] overflow-y-auto px-8 pb-8">
              {CHANGELOG.length === 0 ? (
                <p className="py-12 text-center text-xs font-light text-[#9b9ea4]">暂无更新记录</p>
              ) : (
                <div className="space-y-8">
                  {CHANGELOG.map((item, idx) => (
                    <div key={item.version + item.date} className="relative">
                      {/* 时间线竖线 */}
                      {idx < CHANGELOG.length - 1 && (
                        <span className="absolute left-[3px] top-3 h-full w-px bg-[#e3e4e8]" />
                      )}
                      <div className="flex gap-4">
                        {/* 圆点 */}
                        <span className="relative z-10 mt-1.5 h-[7px] w-[7px] shrink-0 rounded-full bg-[#e8704a]" />
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-light tracking-[0.1em] text-[#1b1c1e]">{item.version}</span>
                            {item.badge && (
                              <span className="rounded-sm bg-[#fef3c7] px-1.5 py-0.5 text-[10px] font-light tracking-wider text-[#b45309]">
                                {item.badge}
                              </span>
                            )}
                            <span className="text-[11px] font-light tracking-wider text-[#9b9ea4]">{item.date}</span>
                          </div>
                          <ul className="mt-3 space-y-1.5">
                            {item.entries.map((entry, i) => (
                              <li key={i} className="flex gap-2 text-xs font-light leading-6 text-[#55585e]">
                                <span className="mt-2.5 h-0.5 w-0.5 shrink-0 rounded-full bg-[#b9bcc2]" />
                                <span>{entry}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}