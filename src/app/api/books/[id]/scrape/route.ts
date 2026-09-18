// 单本书封面刮削：用 ISBN 重新查询各数据源获取最新封面并更新数据库
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/utils";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const book = await prisma.book.findUnique({
      where: { id },
      select: { id: true, isbn: true, coverUrl: true },
    });
    if (!book) return NextResponse.json(apiError("书籍不存在"), { status: 404 });
    if (!book.isbn) return NextResponse.json(apiError("该书没有 ISBN，无法刮削"), { status: 400 });

    // 内部调用 scan-isbn 查询最新信息
    const port = process.env.PORT || 3000;
    const res = await fetch(`http://127.0.0.1:${port}/api/scan-isbn?isbn=${encodeURIComponent(book.isbn)}`, {
      signal: AbortSignal.timeout(30000),
    });
    const data = await res.json();
    if (!data.success || !data.data?.found) {
      return NextResponse.json(apiError("各数据源均未找到封面信息"), { status: 404 });
    }

    const newCoverUrl = data.data.coverUrl || "";

    // 数据源返回了书籍信息但没有封面 URL（如当当只返回标题），视为未找到封面
    if (!newCoverUrl) {
      return NextResponse.json(apiError(`数据源(${data.data.source || "未知"})未返回封面，请手动添加自定义封面`), { status: 404 });
    }

    // 封面与数据库一致，无需更新
    if (newCoverUrl === book.coverUrl) {
      return NextResponse.json(apiSuccess({ coverUrl: book.coverUrl, source: data.data.source }, "封面已是最新"));
    }

    const updated = await prisma.book.update({
      where: { id },
      data: { coverUrl: newCoverUrl },
      select: { id: true, coverUrl: true },
    });

    return NextResponse.json(apiSuccess({ ...updated, source: data.data.source }, "封面已更新"));
  } catch (error) {
    console.error("封面刮削失败:", error);
    return NextResponse.json(apiError("封面刮削失败"), { status: 500 });
  }
}
