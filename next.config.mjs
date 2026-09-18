import withSerwistInit from "@serwist/next";

// PWA：通过 Serwist 生成 Service Worker（替代已不维护的 next-pwa）
const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  // 开发环境关闭，避免缓存干扰调试
  disable: process.env.NODE_ENV === "development",
  reloadOnOnline: true,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
