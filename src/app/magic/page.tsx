'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { SiteNav } from '@/components/site-nav';
import { ParticleRepel } from '@/components/particle-repel';

interface Product {
  key: string;
  series: string;
  name: string;
  tag: string;
  desc: string;
  price: string;
  period: string;
  meta: string;
  features: { title: string; desc: string }[];
  stats: { value: string; label: string }[];
  audienceTitle: string;
  audienceDesc: string;
}

const PRODUCTS: Product[] = [
  {
    key: 'magic',
    series: 'MAGIC SERIES',
    name: 'MAGIC',
    tag: '标准辅助开发平台',
    desc: '面向个人开发者与初学者，内置数百个虚幻引擎常用模块的一般用法与样例，让虚幻引擎的海量节点不再令初学者望而却步。',
    price: '29 RMB',
    period: '/ 月',
    meta: '模块 299+ · 个人开发者 / 初学者',
    features: [
      { title: '模块库', desc: '内置数百个虚幻引擎常用模块，覆盖蓝图、C++、Niagara、动画、UI 等核心开发领域。' },
      { title: '用法示例', desc: '每个模块附带可直接运行的示例工程与分步说明，复制即可用，降低上手门槛。' },
      { title: '多维检索', desc: '按功能分类、引擎版本、难度标签多维筛选，几秒内定位所需模块。' },
      { title: '持续迭代', desc: '跟随虚幻引擎版本更新节奏，模块库持续扩充、修复与维护。' },
    ],
    stats: [
      { value: '299+', label: '功能模块' },
      { value: 'UE5', label: '核心引擎' },
      { value: '100%', label: '示例覆盖' },
    ],
    audienceTitle: '独立开发者 · 初学者',
    audienceDesc: '如果你刚接触虚幻引擎，面对海量节点无从下手；或者你是独立开发者，希望快速复用成熟方案、把精力集中在创意本身——MAGIC 标准版就是为你准备的。',
  },
  {
    key: 'magic-pro',
    series: 'MAGIC SERIES',
    name: 'MAGIC PRO',
    tag: '旗舰辅助开发平台',
    desc: '在标准版能力之上，支持调用本地部署 AI，为专业团队提供更完整的辅助开发能力。',
    price: '999 RMB',
    period: '/ 月',
    meta: '模块 699+ · 专业开发者 / 企业用户',
    features: [
      { title: '全模块库', desc: '包含标准版全部模块，并额外提供 400+ 进阶模块，覆盖 GAS、Chaos、路径追踪等专业领域。' },
      { title: '本地 AI 辅助', desc: '支持调用本地部署的 AI 模型，离线完成节点生成、代码补全与语义检索。' },
      { title: '团队协作', desc: '支持多人共享模块集与自定义示例，团队资产统一管理与同步。' },
      { title: '优先支持', desc: '专属技术支持通道，紧急问题 24 小时内响应，版本升级优先适配。' },
    ],
    stats: [
      { value: '699+', label: '功能模块' },
      { value: 'AI', label: '本地推理' },
      { value: '24h', label: '响应支持' },
    ],
    audienceTitle: '专业开发者 · 企业团队',
    audienceDesc: '如果你已经在使用虚幻引擎开发商业项目，需要更高效的工具链与更深度的模块支持；或者你的团队需要统一的资产管理和本地 AI 能力——MAGIC PRO 是你的选择。',
  },
  {
    key: 'magic-se',
    series: 'MAGIC SERIES',
    name: 'MAGIC SE',
    tag: '即将上线',
    desc: '面向学生开发者与爱好者的免费版本，让更多人有零门槛开始创作的机会。',
    price: '永久免费',
    period: '敬请期待',
    meta: '模块 199+ · 学生开发者 / 爱好者',
    features: [
      { title: '核心模块', desc: '精选 199+ 最常用模块，覆盖入门必备的蓝图、动画、UI 等基础领域。' },
      { title: '学习示例', desc: '每个模块配以循序渐进的教程示例，从零开始跟着做即可掌握。' },
      { title: '社区共建', desc: '学生与爱好者可提交自己的模块与示例，优质内容将进入正式模块库。' },
      { title: '永久免费', desc: '面向个人学习与非商业用途永久免费，不设任何功能限制。' },
    ],
    stats: [
      { value: '199+', label: '精选模块' },
      { value: '免费', label: '永久使用' },
      { value: 'UE5', label: '核心引擎' },
    ],
    audienceTitle: '学生 · 爱好者',
    audienceDesc: '如果你是学生，正在学习虚幻引擎；或者你只是出于兴趣想尝试游戏开发——MAGIC SE 为你提供零门槛的起点，让创意先于技术发生。',
  },
];

const N = PRODUCTS.length;
const SLIDES: Product[] = [PRODUCTS[N - 1], ...PRODUCTS, PRODUCTS[0]];

const SWIPE_THRESHOLD = 200;
const TRANSITION_MS = 600;

export default function MagicPage() {
  const [index, setIndex] = useState(0);
  const [slide, setSlide] = useState(1);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [noTransition, setNoTransition] = useState(false);

  const dragStartX = useRef(0);
  const dragStartTime = useRef(0);
  const lastX = useRef(0);
  const lastTime = useRef(0);
  const velocity = useRef(0);
  const isJumping = useRef(false);

  const finishTransition = () => {
    if (slide === 0) {
      setNoTransition(true);
      setSlide(N);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setNoTransition(false));
      });
    } else if (slide === N + 1) {
      setNoTransition(true);
      setSlide(1);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setNoTransition(false));
      });
    }
  };

  useEffect(() => {
    if (noTransition) return;
    if (slide === 0 || slide === N + 1) {
      const t = window.setTimeout(() => {
        isJumping.current = true;
        finishTransition();
      }, TRANSITION_MS);
      return () => window.clearTimeout(t);
    }
  }, [slide, noTransition]);

  useEffect(() => {
    if (slide >= 1 && slide <= N) {
      setIndex(slide - 1);
    }
  }, [slide]);

  const goPrev = () => {
    if (dragging) return;
    setSlide((s) => s - 1);
  };
  const goNext = () => {
    if (dragging) return;
    setSlide((s) => s + 1);
  };
  const goTo = (realIndex: number) => {
    setSlide(realIndex + 1);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (isJumping.current) return;
    setDragging(true);
    dragStartX.current = e.clientX;
    dragStartTime.current = performance.now();
    lastX.current = e.clientX;
    lastTime.current = performance.now();
    velocity.current = 0;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const now = performance.now();
    const dt = now - lastTime.current || 16;
    velocity.current = (e.clientX - lastX.current) / dt;
    lastX.current = e.clientX;
    lastTime.current = now;

    setDragX(e.clientX - dragStartX.current);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragging) return;
    setDragging(false);

    const dx = e.clientX - dragStartX.current;
    const dt = performance.now() - dragStartTime.current;
    const v = velocity.current;

    const fastSwipe = Math.abs(v) > 0.6 && dt < 400;

    let next = slide;
    if (dx < -SWIPE_THRESHOLD || (fastSwipe && dx < -20)) next = slide + 1;
    else if (dx > SWIPE_THRESHOLD || (fastSwipe && dx > 20)) next = slide - 1;

    setSlide(next);
    setDragX(0);
  };

  const p = PRODUCTS[index];

  return (
    <div className="min-h-screen bg-[#f2f3f5] font-sans text-[#1b1c1e] antialiased">
      <SiteNav />

      <main className="mx-auto max-w-5xl px-6 py-24">
        {/* ===== 轮播区 ===== */}
        <div className="relative">
          <button
            type="button"
            onClick={goPrev}
            aria-label="上一个"
            className="absolute left-0 top-1/2 z-20 -translate-y-1/2 -translate-x-3 flex h-11 w-11 items-center justify-center rounded-full border border-[#e3e4e8] bg-white/90 text-[#55585e] backdrop-blur transition-all hover:border-[#1b1c1e] hover:text-[#1b1c1e]"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            onClick={goNext}
            aria-label="下一个"
            className="absolute right-0 top-1/2 z-20 -translate-y-1/2 translate-x-3 flex h-11 w-11 items-center justify-center rounded-full border border-[#e3e4e8] bg-white/90 text-[#55585e] backdrop-blur transition-all hover:border-[#1b1c1e] hover:text-[#1b1c1e]"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className={`select-none overflow-hidden ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
            style={{ touchAction: 'pan-y' }}
          >
            <div
              className="flex"
              style={{
                transform: `translateX(calc(${-slide * 100}% + ${dragX}px))`,
                transition: dragging || noTransition
                  ? 'none'
                  : `transform ${TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
              }}
              onTransitionEnd={() => {
                if (isJumping.current) {
                  isJumping.current = false;
                  return;
                }
                if (slide === 0 || slide === N + 1) finishTransition();
              }}
            >
              {SLIDES.map((prod, i) => (
                <div key={`${prod.key}-${i}`} className="w-full shrink-0 px-2">
                  <section className="text-center">
                    <p className="text-xs font-light tracking-[0.5em] text-[#a3a6ac]">{prod.series}</p>
                    <h1 className="mt-6 text-5xl font-light tracking-[0.2em] text-[#1b1c1e] sm:text-6xl">{prod.name}</h1>
                    <p className="mt-4 text-sm font-light tracking-[0.3em] text-[#85888e]">{prod.tag}</p>
                    <p className="mx-auto mt-8 max-w-xl text-sm font-light leading-7 text-[#55585e]">{prod.desc}</p>

                    <div className="mt-8 flex items-center justify-center gap-3">
                      <span className="text-3xl font-light tracking-wider text-[#1b1c1e]">{prod.price}</span>
                      <span className="text-xs font-light text-[#9b9ea4]">{prod.period}</span>
                      {prod.key === 'magic-se' && (
                        <Link
                          href="/magic-se"
                          onPointerDown={(e) => e.stopPropagation()}
                          className="ml-2 inline-flex items-center gap-1.5 border border-[#1b1c1e] bg-[#1b1c1e] px-4 py-2 text-xs font-light tracking-[0.15em] text-[#f5f6f7] transition-colors hover:bg-[#3a3c40]"
                        >
                          Beta版测试
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M3 9l6-6M5 3h4v4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </Link>
                      )}
                    </div>

                    <div className="mt-6 text-xs font-light text-[#85888e]">{prod.meta}</div>
                  </section>
                </div>
              ))}
            </div>
          </div>

          {/* 指示器 */}
          <div className="mt-10 flex justify-center gap-2">
            {PRODUCTS.map((prod, i) => (
              <button
                key={prod.key}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`切换到 ${prod.name}`}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? 'w-8 bg-[#1b1c1e]' : 'w-1.5 bg-[#d4d6da] hover:bg-[#9b9ea4]'
                }`}
              />
            ))}
          </div>
        </div>

        {/* ===== 特性卡片 ===== */}
        <section className="mt-24 grid gap-6 sm:grid-cols-2">
          {p.features.map((f) => (
            <ParticleRepel key={`${p.key}-${f.title}`} className="border border-[#e3e4e8] bg-white p-8" particleCount={80}>
              <h3 className="text-lg font-light tracking-wider text-[#1b1c1e]">{f.title}</h3>
              <div className="mt-3 h-px w-8 bg-[#e8704a]" />
              <p className="mt-4 text-sm font-light leading-6 text-[#55585e]">{f.desc}</p>
            </ParticleRepel>
          ))}
        </section>

        {/* ===== 数据统计 ===== */}
        <section className="mt-24 border-t border-[#e3e4e8] pt-16">
          <div className="grid grid-cols-3 gap-8 text-center">
            {p.stats.map((s) => (
              <div key={`${p.key}-${s.label}`}>
                <p className="text-3xl font-light tracking-wider text-[#1b1c1e]">{s.value}</p>
                <p className="mt-2 text-xs font-light tracking-[0.2em] text-[#9b9ea4]">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ===== 适用人群 ===== */}
        <section className="mt-24">
          <ParticleRepel key={`${p.key}-audience`} className="border border-[#e3e4e8] bg-white p-10 text-center" particleCount={120}>
            <p className="text-xs font-light tracking-[0.4em] text-[#b9bcc2]">适合谁</p>
            <h2 className="mt-4 text-2xl font-light tracking-[0.15em] text-[#1b1c1e]">{p.audienceTitle}</h2>
            <p className="mx-auto mt-6 max-w-lg text-sm font-light leading-7 text-[#55585e]">{p.audienceDesc}</p>
          </ParticleRepel>
        </section>
      </main>

      <footer className="border-t border-[#e3e4e8] bg-[#fbfbfc] py-10 text-center">
        <p className="text-[11px] font-light tracking-wider text-[#9b9ea4]">
          © 2026 番茄鱼工作室 TAMATOFISH STUDIO · 跃然而起 腾飞万里
        </p>
      </footer>
    </div>
  );
}