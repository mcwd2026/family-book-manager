// 认证工具：JWT 签发/校验 + 密码哈希 + 会话获取
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/prisma";

const ALG = "HS256";
export const AUTH_COOKIE = "fbm_token";
const EXPIRES_IN = "7d";

// 从环境变量获取密钥（生产环境务必在 .env 中设置随机值）
function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.warn("[auth] 未设置 JWT_SECRET，使用不安全的默认值，请在 .env 中配置");
    return new TextEncoder().encode("fbm-unsafe-default-secret-change-me");
  }
  return new TextEncoder().encode(secret);
}

// 签发 JWT
export async function signToken(userId: string): Promise<string> {
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(EXPIRES_IN)
    .sign(getSecret());
}

// 校验 JWT，返回 userId 或 null
export async function verifyToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return (payload as { userId?: string }).userId ?? null;
  } catch {
    return null;
  }
}

// 哈希密码
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

// 校验密码
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Cookie 配置（httpOnly + secure + sameSite）
// secure 默认跟随生产环境；HTTP 直连部署（无 HTTPS）时设 COOKIE_SECURE=false 关闭
export function cookieOptions() {
  const secure =
    process.env.COOKIE_SECURE !== undefined
      ? process.env.COOKIE_SECURE === "true"
      : process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 天
  };
}

// fnOS 统一网关身份：网关校验通过后会转发 X-Trim-Userid / X-Trim-Username
export async function getGatewayIdentity() {
  if (process.env.FBM_GATEWAY_MODE !== "true") return null;
  const h = await headers();
  const uid = h.get("x-trim-userid");
  if (!uid) return null;
  return {
    uid,
    username: h.get("x-trim-username") || "fnOS",
    isAdmin: h.get("x-trim-isadmin") === "true",
    gateway: true as const,
  };
}

// 获取当前登录用户（用于 Server Component / API Route 鉴权）
export async function getSession() {
  const gateway = await getGatewayIdentity();
  if (gateway) {
    // 家庭共享数据：所有通过 fnOS 网关进入的用户共用同一份数据
    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({
        data: { username: gateway.username, passwordHash: "fnos-gateway" },
      });
    }
    return user;
  }

  const store = await cookies();
  const token = store.get(AUTH_COOKIE)?.value;
  if (!token) return null;
  const userId = await verifyToken(token);
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return user;
}

// 要求登录，未登录返回 null
export async function requireUser() {
  return getSession();
}
