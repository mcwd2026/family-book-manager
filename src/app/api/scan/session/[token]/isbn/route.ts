// 手机端提交 ISBN（凭二维码中的一次性 token，无需登录）
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = (await req.json().catch(() => ({}))) as { isbn?: string };
    const isbn = (body.isbn || "").replace(/\D/g, "");

    if (!/^\d{10,13}$/.test(isbn)) {
      return NextResponse.json({ success: false, message: "ISBN 格式不正确" }, { status: 400 });
    }

    const session = await prisma.scanSession.findUnique({ where: { token } });
    if (!session) {
      return NextResponse.json({ success: false, message: "二维码已失效，请在 NAS 上重新生成" }, { status: 404 });
    }
    if (session.expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ success: false, message: "二维码已过期，请在 NAS 上重新生成" }, { status: 410 });
    }

    let duplicate = false;
    try {
      await prisma.scanItem.create({ data: { sessionId: session.id, isbn } });
    } catch (error) {
      // 同一会话重复扫码：唯一索引冲突，按幂等处理
      const code = (error as { code?: string })?.code;
      if (code === "P2002") duplicate = true;
      else throw error;
    }

    const total = await prisma.scanItem.count({ where: { sessionId: session.id } });
    return NextResponse.json({ success: true, data: { isbn, duplicate, total } });
  } catch (error) {
    console.error("[scan/session] 提交 ISBN 失败:", error);
    return NextResponse.json({ success: false, message: "提交失败，请重试" }, { status: 500 });
  }
}
