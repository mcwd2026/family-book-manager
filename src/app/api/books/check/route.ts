// ISBN 查重轻量接口：点查避免全量拉取（配合保存前的快速查重）
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess } from "@/lib/utils";

export async function GET(req: NextRequest) {
  try {
    const isbn = new URL(req.url).searchParams.get("isbn") || "";
    if (!isbn) {
      return NextResponse.json(apiSuccess(null));
    }
    const book = await prisma.book.findFirst({
      where: { isbn },
      select: { id: true, title: true },
    });
    return NextResponse.json(apiSuccess(book));
  } catch (error) {
    console.error("ISBN 查重失败:", error);
    // 查重失败不阻塞保存流程
    return NextResponse.json(apiSuccess(null));
  }
}
