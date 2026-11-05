import withSerwistInit from "@serwist/next";

// PWA：通过 Serwist 生成 Service Worker（替代已不维护的 next-pwa）
const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  // 开发环境关闭，避免缓存干扰调试；统一网关（basePath）模式不启用 PWA
  disable: process.env.NODE_ENV === "development" || Boolean(process.env.NEXT_BASE_PATH),
  reloadOnOnline: true,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // fnOS 统一网关入口固定为 /app/fbm；Docker 版本不设置 basePath
  basePath: process.env.NEXT_BASE_PATH || undefined,
  // 输出独立运行包，便于 Docker 部署
  output: "standalone",
  // 允许 next/image 加载远程封面图
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
};

export default withSerwist(nextConfig);
