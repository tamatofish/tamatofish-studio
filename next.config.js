/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['coze-coding-dev-sdk', 'pg', 'pg-cloudflare'],
  allowedDevOrigins: ['*.dev.coze.site'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*',
        pathname: '/**',
      },
    ],
  },
};

module.exports = nextConfig;