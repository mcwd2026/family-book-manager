// 修改密码：校验旧密码，更新为新密码
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, verifyPassword, hashPassword } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/utils";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json(apiError("未登录"), { status: 401 });
    }

    const { oldPassword, newPassword } = await req.json();
    if (!oldPassword || !newPassword) {
      return NextResponse.json(apiError("请输入旧密码和新密码"), { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json(apiError("新密码至少 6 位"), { status: 400 });
    }
    if (oldPassword === newPassword) {
      return NextResponse.json(apiError("新密码不能与旧密码相同"), { status: 400 });
    }

    const ok = await verifyPassword(oldPassword, user.passwordHash);
    if (!ok) {
      return NextResponse.json(apiError("旧密码错误"), { status: 401 });
    }

    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    return NextResponse.json(apiSuccess(null, "密码修改成功"));
  } catch (e) {
    console.error("[auth/change-password] 错误:", e);
    return NextResponse.json(apiError("服务器错误"), { status: 500 });
  }
}
