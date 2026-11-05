// 查询扫码会话中手机提交的 ISBN 列表
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const session = await prisma.scanSession.findUnique({
      where: { token },
      include: { items: { orderBy: { createdAt: "asc" } } },
    });

    if (!session) {
      return NextResponse.json({ success: false, message: "扫码会话不存在" }, { status: 404 });
    }
    const expired = session.expiresAt.getTime() < Date.now();

    return NextResponse.json({
      success: true,
      data: {
        expired,
        expiresAt: session.expiresAt.toISOString(),
        items: session.items.map((item) => ({
          id: item.id,
          isbn: item.isbn,
          createdAt: item.createdAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    console.error("[scan/session] 查询失败:", error);
    return NextResponse.json({ success: false, message: "查询失败" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    await prisma.scanSession.deleteMany({ where: { token } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[scan/session] 删除失败:", error);
    return NextResponse.json({ success: false, message: "删除失败" }, { status: 500 });
  }
}
