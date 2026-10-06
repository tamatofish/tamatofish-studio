/** @type {import('next').NextConfig} */
const nextConfig = {
  // 如果你需要静态导出（Capacitor/Tauri 用），取消下面这行注释
  // output: 'export',

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