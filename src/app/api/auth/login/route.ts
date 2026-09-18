// 登录接口：校验账号密码，签发 JWT 写入 httpOnly cookie
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signToken, verifyPassword, AUTH_COOKIE, cookieOptions } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();
    if (!username || !password) {
      return NextResponse.json({ success: false, message: "请输入账号和密码" }, { status: 400 });
    }
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return NextResponse.json({ success: false, message: "账号或密码错误" }, { status: 401 });
    }
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      return NextResponse.json({ success: false, message: "账号或密码错误" }, { status: 401 });
    }
    const token = await signToken(user.id);
    const res = NextResponse.json({ success: true, data: { username: user.username } });
    res.cookies.set(AUTH_COOKIE, token, cookieOptions());
    return res;
  } catch (e) {
    console.error("[auth/login] 错误:", e);
    return NextResponse.json({ success: false, message: "服务器错误" }, { status: 500 });
  }
}
