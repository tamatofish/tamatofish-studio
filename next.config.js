/** @type {import('next').NextConfig} */
const nextConfig = {
  // 如果你需要静态导出（Capacitor/Tauri 用），取消下面这行注释
  // output: 'export',

  // ===== 解决 OpenNext 打包时找不到 pg-cloudflare 的问题 =====
  // pg/lib/stream.js 里用 navigator.userAgent 动态判断是否在 Cloudflare 环境，
  // Next.js 的文件追踪器无法静态解析这个动态 require，
  // 结果只复制了 pg-cloudflare 的 package.json，没复制真正的 dist/index.js。
  // 这里强制把它整个 dist 和 esm 目录追踪进构建产物。
  outputFileTracingIncludes: {
    "**/*": [
      "./node_modules/pg-cloudflare/dist/**",
      "./node_modules/pg-cloudflare/esm/**",
    ],
  },

  images: {
    // 如果启用了 output: 'export'，必须加这行
    // unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },

  // 你的项目用到的其他配置，比如 experimental、eslint 等，保持原样
};

// ===== PWA 可选：需要离线缓存时启用 =====
// const withPWA = require('@brainwires/next-pwa')({
//   dest: 'public',
//   disable: process.env.NODE_ENV === 'development',
//   register: true,
// });
// module.exports = withPWA(nextConfig);

module.exports = nextConfig;