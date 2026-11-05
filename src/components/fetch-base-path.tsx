"use client";
// fnOS 统一网关模式下 Next.js 使用 basePath（/app/fbm），
// 页面里写死的 /api/... 请求需要自动补上前缀。
import { useEffect } from "react";

const BASE_PATH = process.env.NEXT_PUBLIC_FBM_BASE_PATH || "";

export function FetchBasePath() {
  useEffect(() => {
    if (!BASE_PATH) return;
    const original = window.fetch;
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      if (typeof input === "string" && input.startsWith("/api/")) {
        return original(BASE_PATH + input, init);
      }
      return original(input, init);
    };
    return () => {
      window.fetch = original;
    };
  }, []);

  return null;
}
