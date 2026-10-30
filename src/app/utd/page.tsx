'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

// ================= 数据定义 =================
const SQUADS = [
  { 
    id: 'arc-01', name: 'ARC-01', subName: '先驱', type: '空间畸变', image: '/ARC-1.png', motto: '“我们即是边界”', desc: 'ARC-01特遣队，代号“先驱”，成立于1981年，是A.R.C第一支独立武装部队，现专门用于应对因空间畸变等引发的异常事件', 
    stats: [
      { label: '步兵作战系统', value: '「界碑」系统|空间震荡系统|引力坍缩场|单兵空间感知雷达' }, 
      { label: '入场播报', value: '“由于本地区已被证实出现空间类异常事件，A.R.C已正式接管本地区，ARC-01特遣队已通过蜂巢部署，请无关人员立刻退出到警戒线以外。”' }
    ] 
  },
  { 
    id: 'arc-02', name: 'ARC-02', subName: '时间溯流', type: '时间错位', image: '/ARC-2.png', motto: '“时间是条运河，我们是摆渡人”', desc: 'ARC-02特遣队，代号“时间溯流”，成立于2000年，专门用于应对时间错位等引发的异常事件', 
    stats: [
      { label: '步兵作战系统', value: '「沙漏」时序同步系统|因果律狙击平台|时序干扰陷阱|时序校准目镜' }, 
      { label: '入场播报', value: '“由于本地区出现时间类异常，特遣队ARC-02已在本地区执行投送。所有人立刻撤出管制区域，注意时刻留意当前时间。”' }
    ] 
  },
  { 
    id: 'arc-03', name: 'ARC-03', subName: '梦魇', type: '认知篡改', image: '/ARC-3.png', motto: '“你能看到的，皆是我们允许的”', desc: 'ARC-03特遣队，代号“梦魇”，成立于2000年，专门用于应对认知篡改、精神控制等引发的异常事件', 
    stats: [
      { label: '步兵作战系统', value: '「脑域」系统|主动模因发生系统|神经阻断系统|脑波共振探测仪' }, 
      { label: '入场播报', value: '“由于当前地区存在范围性认知异常，故派遣ARC-03特遣队在本地区部署。同时，GAIA-01特遣队会时刻关注战场情况，并在必要情况下进行支援。”' }
    ] 
  },
  { 
    id: 'arc-04', name: 'ARC-04', subName: '魅影', type: '实体拟态', image: '/ARC-4.png', motto: '“眼见为虚”', desc: 'ARC-04特遣队，代号“魅影”，成立于2001年，专门用于应对实体拟态、类人伪装等引发的异常事件', 
    stats: [
      { label: '步兵作战系统', value: '「剥皮行者」生物扫描仪|高频激光切割系统|拟态干扰烟雾|复合生物检测仪' }, 
      { label: '入场播报', value: '“ARC-04特遣队已通过蜂巢在本地区部署。在警戒解除广播鸣笛前，请尽量结伴而行，不要相信任何离开过你视野的人。”' }
    ] 
  },
  { 
    id: 'arc-05', name: 'ARC-05', subName: '回声', type: '信息媒介', image: '/ARC-5.png', motto: '“嘘！”', desc: 'ARC-05特遣队，代号“回声”，成立于2001年，专门用于应对信息媒介污染引发的异常事件', 
    stats: [
      { label: '步兵作战系统', value: '「无声」模因隔离系统|定向EMP震荡系统|高能噪音发生器|信息素追踪器' }, 
      { label: '入场播报', value: '“特遣队ARC-05，代号‘回声’，已部署在本地区。由于本地出现范围性信息媒介污染，所有广播将暂时停止工作。在ARC-05宣布戒严解除前，所有人尽量保持沉默，且尽可能远离可以传播信息的媒介。”' }
    ] 
  },
  { 
    id: 'arc-06', name: 'ARC-06', subName: '腐朽', type: '生命逆反', image: '/ARC-6.png', motto: '“生死界限，不容逾越”', desc: 'ARC-06特遣队，代号“腐朽”，成立于2003年，专门用于应对生命逆反引发的异常事件', 
    stats: [
      { label: '步兵作战系统', value: '「枯骨」系统|生化溶剂喷射器|喷火器|生命体征雷达' }, 
      { label: '入场播报', value: '“由于本地区出现生命逆反现象，故派遣ARC-06在本地区部署。请所有人离开警戒区，切忌与复生者发生任何形式的接触。”' }
    ] 
  },
  { 
    id: 'arc-07', name: 'ARC-07', subName: '现实法则', type: '规则置换', image: '/ARC-7.png', motto: '“黑即是白，白即是黑”', desc: 'ARC-07特遣队，代号“现实法则”，成立于2003年，专门用于应对规则置换、常识失效引发的异常事件', 
    stats: [
      { label: '步兵作战系统', value: '「重启」系统|振动长矛|引力发生器|结构分析仪' }, 
      { label: '入场播报', value: '“ARC已证实本地区遭受异常规则污染，ARC-07‘现实法则’已奉命在本地区部署。GAIA-03特遣队将临时协助撤离区域内幸存者，GAIA-02将全程关注ARC-07行动，并在必要情况下执行九号预案。”' }
    ] 
  },
  { 
    id: 'arc-08', name: 'ARC-08', subName: '虚无主义', type: '存在消长', image: '/ARC-8.png', motto: '“善恶有报，因果绑定”', desc: 'ARC-08特遣队，代号“虚无主义”，成立于2001年，专门用于应对存在消长引发的异常事件', 
    stats: [
      { label: '步兵作战系统', value: '「锚点」因果溯源系统|场切割系统|灯塔信标|因果律追踪器' }, 
      { label: '入场播报', value: '“特遣队ARC-08已通过蜂巢在本地区部署，同时，ARC-6‘腐朽’将全程配合ARC-8行动。请无关人员立刻离开警戒区，切忌与异常实体发生任何形式的接触。”' }
    ] 
  },
  { 
    id: 'arc-09', name: 'ARC-09', subName: '侵蚀', type: '交互反常', image: '/ARC-9.png', motto: '“灯亮了。灯灭了”', desc: 'ARC-09特遣队，代号“侵蚀”，成立于2008年，专门用于应对交互反常引发的异常事件', 
    stats: [
      { label: '步兵作战系统', value: '「绝缘体」力场隔绝系统|定向动能震荡系统|惰性气体发生器|宏探测器' }, 
      { label: '入场播报', value: '“ARC-09特遣队已在本地区部署，所有无关人员请立刻退出警戒区，严禁与ARC-09队员发生肢体接触或语言交流，违者后果自负。”' }
    ] 
  },
  { 
    id: 'arc-10', name: 'ARC-10', subName: '混沌', type: '现实重叠', image: '/ARC-10.png', motto: '“假亦真时，真亦假”', desc: 'ARC-10特遣队，代号“混沌”，成立于2012年，专门用于应对现实重叠引发的异常事件', 
    stats: [
      { label: '步兵作战系统', value: '「奇点」多维折射仪|切割枪|相位穿梭系统|视界目镜' }, 
      { label: '入场播报', value: '“由于G.A.I.A暂无法确定本地区空间是否异常，故派遣特遣队ARC-10在本地区部署。ARC-01将全程配合行动。请时刻留意身处空间是否合乎常理，并在异常发生时第一时间与ARC-10取得联系。”' }
    ] 
  },
  { 
    id: 'arc-11', name: 'ARC-11', subName: '轮回', type: '不死鸟', image: '/ARC-11.png', motto: '“死亡，只是一个循环”', desc: 'ARC-11特遣队，代号“轮回”，成立于2018年，是A.R.C通过中继锚点组建的一支“不死人”小队。ARC-11不被用于处理某个特定类型的异常，它只会在其他小队出现严重伤亡时被派出执行收尾工作', 
    stats: [
      { label: '步兵作战系统', value: '「冥河」中继回环锚点|生命再生系统' }, 
      { label: '入场播报', value: '“ARC-11特遣队已在本地区部署。由于先前特遣队伤亡严重，故本地区危险等级已提升至五级，ARC-11已暂时取得最高指挥权。GAIA-02特遣队将全程配合ARC-11行动，请无关人员和其他特遣队立刻撤离到防辐射掩体待命。”' }
    ] 
  },
  { 
    id: 'arc-12', name: 'ARC-12', subName: '天眼', type: '信息媒介', image: '/ARC-12.png', motto: '“向身先士卒者致敬！”', desc: 'ARC-12特遣队，代号“天眼”，成立于2020年，是A.R.C最年轻的特遣小队。与其他特遣队不同，“天眼”的每次行动都是为了为管理局收集目标地情报，为其它小队的行动提供战术辅助', 
    stats: [
      { label: '步兵作战系统', value: '「天启」卫星定位系统|信息素标记系统「黄蜂」侦察无人机|智能目镜' }, 
      { label: '入场播报', value: '“各单位注意，ARC-12特遣队已在本地区部署，向身先士卒者致敬！”' }
    ] 
  },
];

const TIMELINE_DATA = [
  { id: 't1', timeLabel: '起源', title: '异常管理局\n起源', desc: '在一颗小行星从地球近旁掠过的夜晚，流星雨倾泻而下。与此同时，世界范围内发生了大规模停电。不久之后，各地开始出现“异常”。A.M.B（异常管理局）应运而生。A.M.B隶属于中华人民共和国国防部，拥有多支武装力量,是中国政府对抗异常的一把利剑', subTitle: '在那个夜晚之后……', subDesc: '漫漫长夜开始了。人类是长夜下的猎物，时刻提防这隐匿于夜幕之下的猎手' },
  { id: 't2', timeLabel: '先驱', title: 'A.R.C\n正式介入', desc: '常规武装力量在异常面前彻底失效。A.R.C通过蜂巢系统大量部署在战斗一线，通过武力强行封锁异常传播', subTitle: '防线建立', subDesc: '十二支特遣队陆续成立，A.R.C从一颗幼苗萌发成为巨树。人类开始用血肉与理智，在不可名状的恐惧中筑起高墙' },
  { id: 't3', timeLabel: '长夜', title: '长夜之下\n我即先锋！', desc: '“星盾”技术的成功突破，稳定了全国范围内99.8%以上区域。然而，仍有异常通过星盾的漏洞迈进现实', subTitle: 'A.M.B感谢你们的服务与牺牲', subDesc: '那些消失在历史中的队员，他们的死因被严格保密，化作了一份份绝密档案。但他们的血不会白流，他们用生命铸成的钢铁长城将永远屹立在共和国的脊梁上！' },
  { id: 't4', timeLabel: '爆发日', title: '爆发日\n这是人类的末日', desc: 'A.M.B多处雷达预警系统检测出大量空间线波动。模因污染正在突破安全阈值。这是人类的末日', subTitle: '终端已连接', subDesc: '无论你是谁，如果你看到了这份档案，请立刻执行你的使命。' }
];

// ================= 独立图片层 =================
const ImageLayer = ({ activeIndex }: { activeIndex: number }) => {
  return (
    <div className="pointer-events-none fixed inset-0 z-[0]">
      <div className="absolute top-[45%] left-[65%] -translate-x-1/2 -translate-y-1/2 w-[330px] h-[330px] md:w-[495px] md:h-[495px]">
        {SQUADS.map((squad, idx) => {
          const isActive = activeIndex === idx;
          return (
            <div
              key={squad.id}
              className="absolute inset-0 transition-all duration-700 ease-in-out"
              style={{
                opacity: isActive ? 1 : 0,
                transform: isActive ? 'scale(1)' : 'scale(0.95)',
              }}
            >
              <img
                src={squad.image}
                alt={squad.name}
                className="w-full h-full object-contain mix-blend-screen"
                style={{
                  filter: 'grayscale(100%) sepia(30%) hue-rotate(160deg) brightness(0.6) contrast(2) drop-shadow(0 0 10px rgba(90, 138, 157, 0.2))',
                  opacity: 0.15,
                }}
              />
            </div>
          );
        })}
        
        {/* 旋转的外围战术光环 */}
        {SQUADS.map((_, idx) => idx === activeIndex && (
          <div key={`ring-${idx}`} className="absolute -inset-10 border border-[#5a8a9d]/20 rounded-full animate-[spin_12s_linear_infinite] opacity-50 pointer-events-none">
            <div className="absolute top-0 left-1/2 w-1 h-1 bg-[#5a8a9d] rounded-full -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 left-1/2 w-1 h-1 bg-[#5a8a9d] rounded-full -translate-x-1/2 translate-y-1/2" />
          </div>
        ))}

        {/* 左侧边缘的融黑遮罩，确保图片左侧边缘平滑消失 */}
        <div className="absolute inset-y-0 -left-10 w-[50%] bg-gradient-to-r from-[#0a0d10] via-[#0a0d10]/80 to-transparent z-10 pointer-events-none" />
      </div>
    </div>
  );
};

export default function UTDLaunchPage() {
  const [mounted, setMounted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const [terminalLines, setTerminalLines] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const horizontalListRef = useRef<HTMLDivElement>(null);

  const [activeIndex, setActiveIndex] = useState(0);
  const activeData = SQUADS[activeIndex];

  const [activeTimeline, setActiveTimeline] = useState(0);
  const timelineCanvasRef = useRef<HTMLCanvasElement>(null);
  
  const [currentPage, setCurrentPage] = useState(0);
  const [pageKey, setPageKey] = useState(0); 
  const isScrolling = useRef(false);

  const changePage = (newPage: number) => {
    if (isScrolling.current || newPage === currentPage || newPage < 0 || newPage > 2) return;
    isScrolling.current = true;
    setCurrentPage(newPage);
    setPageKey(prev => prev + 1); 
    setTimeout(() => { isScrolling.current = false; }, 1000);
  };

  const handleHorizontalScroll = (e: React.WheelEvent) => {
    e.stopPropagation();
    if (horizontalListRef.current) {
      horizontalListRef.current.scrollLeft += e.deltaY;
    }
  };

  useEffect(() => {
    setMounted(true);
    const logs = [
      "> 正在接入 异常管理局 (A.M.B) 内部网络...",
      "> 验证权限等级：[ A.R.C Visitor ]",
      "> 目标档案载入中...",
      "> 警告：该档案涉及模因污染，请在逆模因部监管下查看",
      "> 实体编号：AMB-387",
      "> 档案名称：待定",
      "> 状态：无有效收容措施",
      "> AMB-02特遣队已收到连接信号",
      "> 等待指令..."
    ];
    let currentLine = 0;
    const interval = setInterval(() => {
      if (currentLine < logs.length) {
        const nextLine = logs[currentLine];
        if (nextLine) setTerminalLines(prev => [...prev, nextLine]);
        currentLine++;
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      } else {
        clearInterval(interval);
      }
    }, 300);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (isScrolling.current || isPlaying) return;
      if (e.deltaY > 30) changePage(currentPage + 1);
      else if (e.deltaY < -30) changePage(currentPage - 1);
    };
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [currentPage, isPlaying]);

  useEffect(() => {
    let touchStartY = 0;
    const handleTouchStart = (e: TouchEvent) => { touchStartY = e.touches[0].clientY; };
    const handleTouchEnd = (e: TouchEvent) => {
      if (isScrolling.current || isPlaying) return;
      const diff = touchStartY - e.changedTouches[0].clientY;
      if (diff > 50) changePage(currentPage + 1);
      else if (diff < -50) changePage(currentPage - 1);
    };
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [currentPage, isPlaying]);

  useEffect(() => {
    if (currentPage !== 2) return;
    const canvas = timelineCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = window.innerWidth;
    let height = window.innerHeight;
    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };
    resize();
    window.addEventListener('resize', resize);

    const mouse = { x: -1000, y: -1000 };
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };
    window.addEventListener('mousemove', handleMouseMove);

    const particles: { x: number; y: number; r: number; vx: number; vy: number; alpha: number }[] = [];
    for (let i = 0; i < 500; i++) {
        particles.push({
            x: Math.random() * width, y: Math.random() * height,
            r: Math.random() * 2 + 0.5,
            vx: (Math.random() - 0.5) * 0.15, vy: (Math.random() - 0.5) * 0.15 - 0.08, 
            alpha: Math.random() * 0.5 + 0.2, 
        });
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      particles.forEach(p => {
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 180) {
          const force = (180 - dist) / 180;
          p.x += (dx / dist) * force * 3;
          p.y += (dy / dist) * force * 3;
        }
        p.x += p.vx; p.y += p.vy;
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;
        if (p.y < -10) p.y = height + 10;
        if (p.y > height + 10) p.y = -10;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(160, 165, 170, ${p.alpha})`;
        ctx.fill();
      });
      animationFrameId = requestAnimationFrame(render);
    };
    render();
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [currentPage]);

  if (isPlaying) {
    return (
      <div className="fixed inset-0 z-[999] bg-black">
        <iframe src="/poem/index.html" className="h-full w-full border-0" title="游戏" allow="fullscreen" />
      </div>
    );
  }

  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#0a0d10] text-[#7a8b99] font-mono selection:bg-[#2a2b30] selection:text-white">
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        @keyframes fadeInUpSmall { 0% { opacity: 0; transform: translateY(8px); } 100% { opacity: 1; transform: translateY(0); } }
        @keyframes lineSweep { 0% { opacity: 0; transform: scaleX(0); } 100% { opacity: 1; transform: scaleX(1); } }
        @keyframes eerieFadeIn {
          0% { opacity: 0; filter: blur(8px); transform: scale(0.99); }
          100% { opacity: 1; filter: blur(0); transform: scale(1); }
        }
        @keyframes fadeIn {
          0% { opacity: 0; transform: scale(0.95); }
          100% { opacity: 0.4; transform: scale(1); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .cctv-grid {
          background-image: linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
          background-size: 20px 20px;
        }
        .tactical-grid {
          background-image: linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
          background-size: 40px 40px;
        }

        .custom-scrollbar::-webkit-scrollbar {
          height: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #2a3b45;
          border-radius: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #5a8a9d;
        }
      `}} />

      <div className="pointer-events-none fixed inset-0 z-0 tactical-grid opacity-30" />

      {/* 👇 全局常驻的图片层（不随页面销毁，通过透明度控制显隐） */}
      <div className={`transition-opacity duration-700 ${currentPage === 1 ? 'opacity-100' : 'opacity-0'}`}>
        <ImageLayer activeIndex={activeIndex} />
      </div>

      <header className="fixed top-0 left-0 z-50 flex w-full items-center justify-between border-b border-[#1e2025] bg-[#0a0d10]/80 px-6 py-3 text-[10px] tracking-widest text-[#5a5c62] backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <Link href="/" className="hover:text-white transition-colors flex items-center gap-2">
            <span className="h-2 w-2 rounded-full border border-[#5a5c62]"></span>
            断开并返回
          </Link>
          <span className="text-[#333]">|</span>
          <span className="text-[#8a8c91]">ECC SECURE TERMINAL v4.2</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-red-500/80 animate-[blink_3s_infinite]">● 信号微弱</span>
          <span className="hidden md:inline">OP: TAMATOFISH</span>
        </div>
      </header>

      <div className="fixed right-6 top-1/2 -translate-y-1/2 z-[100] flex flex-col gap-6 pointer-events-auto">
        {[0, 1, 2].map((idx) => (
          <button 
            key={idx}
            onClick={() => changePage(idx)}
            className="group flex flex-col items-center justify-center p-2 outline-none"
          >
            <div className={`relative flex h-2 w-2 items-center justify-center transition-all duration-500 ${
              currentPage === idx ? 'scale-150' : 'group-hover:scale-125'
            }`}>
              <span className={`absolute h-full w-full rounded-full transition-colors duration-500 ${
                currentPage === idx ? 'bg-[#9aaebd]' : 'bg-[#333] group-hover:bg-[#666]'
              }`} />
              {currentPage === idx && (
                <span className="absolute h-5 w-5 rounded-full border border-[#9aaebd]/30 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]" />
              )}
            </div>
          </button>
        ))}
      </div>

      <div className="relative h-full w-full">
        {currentPage === 0 && (
          <div key={`page0-${pageKey}`} className="absolute inset-0 flex flex-col md:flex-row pt-[41px] animate-[eerieFadeIn_0.6s_ease-out_both]">
            <div className="relative flex flex-1 flex-col justify-center p-8 md:p-16 lg:p-24 overflow-hidden">
              <div className="absolute top-1/2 left-0 h-[400px] w-[400px] -translate-y-1/2 bg-[#1e3440]/10 blur-[120px] rounded-full pointer-events-none" />
              
              <div className="mb-6 flex items-center gap-3">
                <span className="flex h-7 items-center bg-[#15191e] px-3 text-[10px] font-bold tracking-widest text-[#9aaebd] border border-[#2a3b45]">
                  KETER
                </span>
                <span className="text-[10px] tracking-[0.3em] text-[#5a6b76]">CLASS ANOMALY</span>
              </div>

              <h1 className="text-7xl md:text-[8rem] font-bold tracking-tighter text-[#e0e5e8] leading-none drop-shadow-[0_0_30px_rgba(255,255,255,0.05)]">
                第七首诗
              </h1>
              <h2 className="mt-4 text-3xl md:text-4xl font-light tracking-[0.3em] text-[#7a8b99] ml-1">
                《长夜之下》系列作品
              </h2>
              
              <div className="mt-14 space-y-6 border-l border-[#2a3b45] pl-8 text-xs leading-loose text-[#7a8b99] relative">
                <div className="absolute -left-1 top-0 h-2 w-2 bg-[#5a8a9d] rounded-full" />
                <div className="absolute -left-[1px] top-0 h-full w-[1px] bg-gradient-to-b from-[#5a8a9d] to-transparent" />
                <p><strong className="text-[#b0c1cc]">项目等级：</strong>待评级</p>
                <p><strong className="text-[#b0c1cc]">收容措施：</strong>暂无有效收容措施</p>
                <p><strong className="text-[#b0c1cc]">描述：</strong>待填写</p>
              </div>

              <div className="mt-16">
                <button 
                  onClick={() => setIsPlaying(true)}
                  className="group relative flex h-16 w-72 items-center justify-between border border-[#2a3b45] bg-[#11151a] px-8 transition-all duration-300 hover:border-[#5a8a9d] hover:bg-[#1e3440]/30 overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#5a8a9d]/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                  <span className="text-xs font-bold tracking-[0.2em] text-[#7a8b99] group-hover:text-[#b0c1cc] transition-colors relative z-10">
                    [ 授权接入程序 ]
                  </span>
                  <div className="flex gap-1.5 relative z-10">
                    <span className="h-4 w-1 bg-[#2a3b45] group-hover:bg-[#5a8a9d] transition-colors" />
                    <span className="h-4 w-1 bg-[#2a3b45] group-hover:bg-[#5a8a9d] transition-colors delay-75" />
                    <span className="h-4 w-1 bg-[#2a3b45] group-hover:bg-[#5a8a9d] transition-colors delay-150" />
                  </div>
                </button>
              </div>
            </div>

            <div className="relative flex w-full flex-col justify-between border-l border-[#1e2025] bg-[#0a0d10]/80 backdrop-blur-2xl p-8 md:w-[450px] lg:w-[550px] md:p-12 z-20">
              <div className="relative aspect-video w-full overflow-hidden border border-[#2a3b45] bg-black/50 shadow-[inset_0_0_20px_rgba(0,0,0,0.8)]">
                <div className="absolute inset-0 flex flex-col items-center justify-center text-[#2a3b45]">
                  <div className="cctv-grid absolute inset-0 opacity-30" />
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mb-3 relative z-10 opacity-20">
                    <path d="M2 12h20M12 2v20" />
                    <circle cx="12" cy="12" r="10" />
                  </svg>
                  <span className="text-[10px] tracking-[0.3em] relative z-10 text-[#4a5b66]">[ 信号丢失 ]</span>
                </div>
                <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-[#5a8a9d]/20" />
              </div>

              <div className="mt-10 flex-1 border border-[#2a3b45] bg-black/60 p-5 font-mono shadow-[inset_0_0_20px_rgba(0,0,0,0.8)]">
                <div className="mb-4 flex items-center justify-between border-b border-[#2a3b45] pb-3 text-[10px] text-[#4a5b66]">
                  <span>STD_OUT</span>
                  <span className="text-[#5a8a9d]/50">SECURE CONNECTION</span>
                </div>
                <div ref={scrollRef} className="h-64 overflow-y-auto text-[11px] leading-relaxed text-[#7a8b99] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  {terminalLines.map((line, i) => {
                    const safeLine = typeof line === 'string' ? line : '';
                    return (
                      <div key={i} className={safeLine.includes('警告') ? 'text-[#5a8a9d] mt-2 font-bold' : 'mb-1'}>
                        {safeLine}
                      </div>
                    );
                  })}
                  {terminalLines.length > 0 && (
                    <div className="mt-2 inline-block h-3 w-2 animate-[blink_1s_infinite] bg-[#5a8a9d]" />
                  )}
                </div>
              </div>

              <div className="mt-6 flex justify-between text-[9px] text-[#3a4b56] tracking-widest">
                <span>ENCRYPTION: AES-256</span>
                <span>LATENCY: 14ms</span>
              </div>
            </div>
          </div>
        )}

        {currentPage === 1 && (
          <div key={`page1-${pageKey}`} className="absolute inset-0 flex flex-col bg-transparent overflow-hidden animate-[eerieFadeIn_0.6s_ease-out_both]">
            
            <div className="absolute left-8 top-12 md:left-16 md:top-16 z-20 max-w-md">
              <div className="flex items-center gap-3 mb-3">
                <span className="h-px w-6 bg-[#5a8a9d]" />
                <span className="text-[10px] tracking-[0.4em] text-[#5a8a9d] uppercase">Armed Reconnaissance Corps,A.R.C</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-black tracking-widest text-[#e0e5e8] mb-4">
                武装侦察兵团
              </h2>
              <p className="border-l border-[#2a3b45] pl-4 text-[11px] leading-loose text-[#6b7b85]">
                A.R.C由十二个相对独立的特遣队组成。这些特遣队及其队员身份完全保密。如果有队员在行动中牺牲，他的死因将被归结为包括但不限于“局部冲突”、“维和行动”等常规事故。
              </p>
            </div>

            <div className="absolute inset-0 pointer-events-none z-0">
              <div className="absolute left-1/2 top-0 h-full w-px bg-white/[0.02]" />
              <div className="absolute left-0 top-1/2 h-px w-full bg-white/[0.02]" />
            </div>

            {/* 核心修改：用 relative z-[100] 强制让文字浮在最上层，彻底杜绝变暗 */}
            <div key={`center-${activeData.id}`} className="relative z-[100] flex flex-1 flex-col items-center justify-center pt-10 pointer-events-none">
              
              <div className="absolute left-10 top-1/3 flex flex-col items-end gap-1 md:left-24 w-40 z-[100] pointer-events-auto">
                <span className="text-[10px] text-[#4a5b66] opacity-0 animate-[fadeInUpSmall_0.6s_ease-out_0.3s_both]">{activeData.stats[0].label}</span>
                <div className="flex flex-col items-end gap-1.5 w-full origin-right animate-[lineSweep_0.6s_cubic-bezier(0.16,1,0.3,1)_both]">
                  {/* 核心修改：按 | 分割并换行 */}
                  {activeData.stats[0].value.split('|').map((part, i) => (
                    <div key={i} className="flex items-center gap-2 w-full justify-end">
                      <span className="text-[11px] font-bold text-[#b0c1cc] text-right whitespace-nowrap opacity-0 animate-[fadeInUpSmall_0.6s_ease-out_0.5s_both]">{part}</span>
                      <div className="h-px w-4 bg-[#5a8a9d]/40" />
                      <span className="h-1 w-1 bg-[#5a8a9d] rotate-45 flex-none" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="absolute left-16 bottom-1/4 flex flex-col items-end gap-1 md:left-32 w-32 z-[100] pointer-events-auto">
                <span className="text-[10px] text-[#4a5b66] opacity-0 animate-[fadeInUpSmall_0.6s_ease-out_0.4s_both]">小队编号</span>
                <div className="flex items-center gap-2 w-full justify-end origin-right animate-[lineSweep_0.6s_cubic-bezier(0.16,1,0.3,1)_0.1s_both]">
                  <span className="text-sm font-bold text-[#b0c1cc] opacity-0 animate-[fadeInUpSmall_0.6s_ease-out_0.6s_both]">{activeData.name}</span>
                  <div className="h-px flex-1 bg-[#5a8a9d]/40" />
                  <span className="h-1 w-1 bg-[#5a8a9d] rotate-45" />
                </div>
              </div>

              <div className="relative z-[100] flex flex-col items-center w-full mt-10">
                
                <div className="mb-8 flex items-center gap-2 border border-[#2a3b45] bg-[#15191e] px-3 py-1 text-[10px] font-bold tracking-widest text-[#7a8b99] opacity-0 animate-[fadeInUpSmall_0.8s_ease-out_0.2s_both]">
                  应对异常：{activeData.type}
                </div>
                
                <h2 className="text-5xl md:text-7xl lg:text-[6rem] font-black tracking-[0.2em] text-[#e0e5e8] opacity-0 animate-[fadeInUpSmall_0.8s_ease-out_0.4s_both]">
                  {activeData.subName}
                </h2>
                
                <p className="mt-6 text-sm tracking-[0.4em] text-[#5a8a9d] font-medium opacity-0 animate-[fadeInUpSmall_0.8s_ease-out_0.6s_both]">
                  {activeData.motto}
                </p>
              </div>

              {/* 右侧 A.R.C 编队代码（在上方） */}
              <div className="absolute right-10 top-[20%] md:right-24 flex flex-col items-start gap-1 w-32 z-[100] pointer-events-auto">
                <div className="flex items-center gap-2 w-full justify-start origin-left animate-[lineSweep_0.6s_cubic-bezier(0.16,1,0.3,1)_0.1s_both]">
                  <span className="h-1 w-1 bg-[#5a8a9d] rotate-45" />
                  <div className="h-px flex-1 bg-[#5a8a9d]/40" />
                  <span className="text-sm font-bold text-[#b0c1cc] opacity-0 animate-[fadeInUpSmall_0.6s_ease-out_0.6s_both]">A.R.C</span>
                </div>
                <span className="text-[10px] text-[#4a5b66] opacity-0 animate-[fadeInUpSmall_0.6s_ease-out_0.4s_both]">编队代码</span>
              </div>

              {/* 右侧入场播报（在下方） */}
              <div className="absolute right-10 bottom-[25%] md:right-24 flex flex-col items-end z-[100] pointer-events-auto max-w-[320px]">
                <div className="flex items-start gap-3 w-full justify-end origin-right animate-[lineSweep_0.6s_cubic-bezier(0.16,1,0.3,1)_both]">
                  <div className="flex flex-col items-end text-right mt-1">
                    <span className="text-[10px] font-medium text-[#889ba8] leading-[1.8] tracking-[0.15em] opacity-0 animate-[fadeInUpSmall_0.6s_ease-out_0.5s_both] border-l-2 border-[#5a8a9d]/40 pl-3">
                      {activeData.stats[1].value}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 h-5 mt-1.5 flex-none">
                    <div className="w-8 h-px bg-[#5a8a9d]/40" />
                    <span className="h-1 w-1 bg-[#5a8a9d] rotate-45 flex-none" />
                  </div>
                </div>
                <span className="text-[10px] text-[#4a5b66] tracking-widest mt-2 mr-12 opacity-0 animate-[fadeInUpSmall_0.6s_ease-out_0.3s_both]">
                  {activeData.stats[1].label}
                </span>
              </div>

              <div className="absolute bottom-16 flex w-full max-w-2xl flex-col items-center px-8 text-center opacity-0 animate-[fadeInUpSmall_1s_ease-out_0.8s_both] z-[100] pointer-events-auto">
                 <p className="text-[11px] leading-relaxed tracking-wider text-[#7a8b99] md:text-xs">
                   {activeData.desc}
                 </p>
              </div>

            </div>

            <div className="relative z-[100] border-t border-[#1e2025] bg-[#0a0d10]/80 backdrop-blur-md">
              <div 
                ref={horizontalListRef}
                onWheel={handleHorizontalScroll}
                className="custom-scrollbar flex h-28 w-full overflow-x-auto"
              >
                {SQUADS.map((item, idx) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveIndex(idx)}
                    className={`group relative flex h-full flex-none w-56 flex-col justify-center border-r border-[#1a1b1e] px-6 text-left transition-all duration-500 ${
                      activeIndex === idx ? 'bg-gradient-to-t from-[#15191e]/80 to-transparent' : 'bg-transparent hover:bg-white/[0.02]'
                    }`}
                  >
                    {activeIndex === idx && (
                      <div className="absolute left-0 top-0 h-[2px] w-full bg-[#5a8a9d] shadow-[0_0_10px_rgba(90,138,157,0.8)]" />
                    )}
                    
                    <h3 className={`text-lg font-black tracking-tighter transition-colors duration-300 ${activeIndex === idx ? 'text-[#e0e5e8]' : 'text-[#4a5b66] group-hover:text-[#7a8b99]'}`}>
                      {item.name}
                    </h3>
                    <p className={`mt-1 text-[10px] font-medium tracking-widest transition-colors duration-300 ${activeIndex === idx ? 'text-[#7a8b99]' : 'text-[#2a3b45] group-hover:text-[#4a5b66]'}`}>
                      {item.subName} // {item.type}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {currentPage === 2 && (
          <div key={`page2-${pageKey}`} className="absolute inset-0 flex flex-col bg-[#0a0d10] overflow-hidden animate-[eerieFadeIn_0.6s_ease-out_both]">
            <canvas ref={timelineCanvasRef} className="absolute inset-0 z-0 h-full w-full" />
            <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_center,_transparent_0%,_rgba(13,15,18,0.8)_100%)] pointer-events-none" />
            <div className="pointer-events-none absolute top-0 left-0 h-20 w-full bg-gradient-to-b from-[#0a0d10] to-transparent z-30" />
            <div className="pointer-events-none absolute bottom-32 left-0 h-20 w-full bg-gradient-to-t from-[#0a0d10] to-transparent z-30" />

            <div className="relative z-20 flex h-full w-full flex-col justify-center bg-transparent px-8 pb-40 pt-24 md:w-[65%] md:border-r md:border-white/5 lg:px-20 xl:px-28">
              <div className="mb-14 flex items-center gap-3 text-[#555]">
                <span className="text-xl font-black tracking-widest italic opacity-80">ECC</span>
                <span className="text-[10px] tracking-[0.4em] opacity-50 mt-1">/ TIMELINE</span>
              </div>

              <div key={activeTimeline} className="animate-[eerieFadeIn_1.2s_cubic-bezier(0.16,1,0.3,1)_both]">
                <h2 className="whitespace-pre-wrap text-5xl font-black leading-[1.15] text-[#e0e5e8] md:text-6xl lg:text-7xl drop-shadow-[0_0_20px_rgba(255,255,255,0.05)]">
                  {TIMELINE_DATA[activeTimeline].title}
                </h2>
                <div className="my-10 flex items-center gap-6">
                   <div className="h-[1px] w-16 bg-[#555]" />
                   <div className="h-[1px] w-full max-w-lg bg-[#1e1e1e]" />
                </div>
                <p className="max-w-xl text-sm leading-[2.2] tracking-wider text-[#7a8b99]">
                  {TIMELINE_DATA[activeTimeline].desc}
                </p>
              </div>

              <div className="mt-16 flex w-full justify-end">
                <div key={`sub-${activeTimeline}`} className="flex flex-col items-end text-right animate-[eerieFadeIn_1.5s_cubic-bezier(0.16,1,0.3,1)_0.2s_both]">
                  <h3 className="text-3xl font-bold tracking-widest text-[#b0c1cc]">
                    {TIMELINE_DATA[activeTimeline].subTitle}
                  </h3>
                  <p className="mt-4 max-w-sm text-[11px] leading-loose text-[#555]">
                    {TIMELINE_DATA[activeTimeline].subDesc}
                  </p>
                </div>
              </div>
            </div>

            <div className="absolute bottom-0 left-0 z-30 flex h-32 w-full border-t border-[#1a1a1a] bg-[#0a0d10]/95 backdrop-blur-xl">
              <div className="absolute left-0 top-[32px] h-[1px] w-full bg-[#1e1e1e]" />
              {TIMELINE_DATA.map((item, idx) => {
                const isActive = activeTimeline === idx;
                const isPassed = activeTimeline >= idx;

                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTimeline(idx)}
                    className="group relative flex flex-1 flex-col items-start px-6 md:px-12 outline-none"
                  >
                    <div className={`relative mt-4 flex h-8 w-8 items-center justify-center transition-all duration-500 z-10 ${
                      isActive ? 'text-[#9aaebd]' : 
                      isPassed ? 'text-[#444]' : 
                      'text-[#222]'
                    }`}>
                      {isActive ? (
                         <span className="h-2.5 w-2.5 rounded-full bg-[#9aaebd] animate-[blink_2s_infinite] shadow-[0_0_10px_rgba(154,174,189,0.5)]" />
                      ) : (
                         <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      )}
                    </div>
                    <div className="mt-5 flex flex-col gap-1">
                      <span className={`text-[10px] tracking-[0.3em] transition-colors duration-300 ${
                        isActive ? 'text-[#e0e5e8] font-bold' : 'text-[#444]'
                      }`}>
                        0{idx + 1}
                      </span>
                      <span className={`text-xs tracking-[0.2em] transition-colors duration-300 ${
                        isActive ? 'text-[#e0e5e8] font-bold' : 'text-[#444]'
                      }`}>
                        {item.timeLabel}
                      </span>
                    </div>
                    {isActive && (
                      <div className="absolute bottom-0 left-0 h-[1px] w-full bg-[#9aaebd]/30 shadow-[0_-5px_15px_rgba(154,174,189,0.1)]" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}