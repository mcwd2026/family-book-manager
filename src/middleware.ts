// 中间件：路由级登录保护
// Edge 运行时，校验 JWT 有效性；数据鉴权由各 API Route 二次校验
import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "fbm_token";

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET || "fbm-unsafe-default-secret-change-me";
  return new TextEncoder().encode(secret);
}

export async function middleware(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const loginUrl = new URL("/login", req.url);
  if (!token) {
    loginUrl.searchParams.set("redirect", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  try {
    await jwtVerify(token, getSecret());
    return NextResponse.next();
  } catch {
    // token 无效或过期，跳登录页
    loginUrl.searchParams.set("redirect", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: [
    // 保护所有路径，排除：登录页、认证 API、Next 静态资源、PWA 文件、图标
    "/((?!login|api/auth|_next/static|_next/image|favicon|sw.js|manifest.json|icons|.*\\.(?:png|jpg|jpeg|svg|ico|webp|gif)$).*)",
  ],
};
