import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({
  default: {
    // 让 esbuild 不打包 pg-cloudflare，
    // 它在 Cloudflare Workers 里由运行环境注入
    external: ["pg-cloudflare"],
  },
});