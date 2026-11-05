// 当前会话查询：返回登录用户信息（前端用于判断是否已登录）
import { NextResponse } from "next/server";
import { getGatewayIdentity, getSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const gateway = await getGatewayIdentity();
  if (gateway) {
    return NextResponse.json({
      success: true,
      data: { username: gateway.username, gateway: true },
    });
  }
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ success: false }, { status: 401 });
  }
  return NextResponse.json({ success: true, data: { username: user.username } });
}
