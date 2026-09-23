import type { Metadata } from 'next';
import { SupabaseConfigProvider } from '@/lib/supabase-config-inject';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: '番茄鱼工作室 | 跃然而起 腾飞万里',
    template: '%s | 番茄鱼工作室',
  },
  description:
    '番茄鱼工作室（TomatoFish Studio）成立于 2023 年，是一家致力于游戏开发和软件开发的独立工作室，正在开发新一代「港湾」与 MAGIC 辅助开发平台。',
  keywords: ['番茄鱼工作室', 'TomatoFish', '游戏开发', '港湾', 'MAGIC', '辅助开发平台', '软件开发'],
  openGraph: {
    title: '番茄鱼工作室 | 跃然而起 腾飞万里',
    description: '致力于游戏开发与软件开发的独立工作室。',
    siteName: '番茄鱼工作室',
    locale: 'zh_CN',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-[#f2f3f5] text-[#1b1c1e] antialiased">
        <SupabaseConfigProvider>{children}</SupabaseConfigProvider>
      </body>
    </html>
  );
}
