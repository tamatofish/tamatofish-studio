import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '番茄鱼工作室',
    short_name: '番茄鱼',
    description: '番茄鱼工作室管理平台',
    start_url: '/',
    display: 'standalone',
    background_color: '#f2f3f5',
    theme_color: '#1b1c1e',
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}