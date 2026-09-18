// 阅读记录 API
// GET: 获取阅读记录列表（支持按 bookId/memberId 筛选）
// POST: 创建阅读记录（标记已读）

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/utils";

// 获取阅读记录
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const bookId = searchParams.get("bookId");
    const memberId = searchParams.get("memberId");

    const where: Record<string, unknown> = {};
    if (bookId) where.bookId = bookId;
    if (memberId) where.memberId = memberId;

    const records = await prisma.readingRecord.findMany({
      where,
      orderBy: { readDate: "desc" },
      include: {
        member: { select: { id: true, name: true, avatar: true, type: true } },
        book: {
          select: {
            id: true,
            title: true,
            author: true,
            coverUrl: true,
            ageMin: true,
            ageMax: true,
          },
        },
      },
    });

    return NextResponse.json(apiSuccess(records, "获取阅读记录成功"));
  } catch (error) {
    console.error("获取阅读记录失败:", error);
    return NextResponse.json(apiError("获取阅读记录失败"), { status: 500 });
  }
}

// 创建阅读记录（标记已读）
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { bookId, memberId, readDate, rating, note } = body;

    if (!bookId || !memberId) {
      return NextResponse.json(apiError("书籍ID和成员ID为必填项"), { status: 400 });
    }

    // 检查书籍和成员是否存在
    const [book, member] = await Promise.all([
      prisma.book.findUnique({ where: { id: bookId } }),
      prisma.member.findUnique({ where: { id: memberId } }),
    ]);
    if (!book) return NextResponse.json(apiError("书籍不存在"), { status: 404 });
    if (!member) return NextResponse.json(apiError("成员不存在"), { status: 404 });

    // 同一人同一本书只允许一条记录，已存在则更新
    const existing = await prisma.readingRecord.findUnique({
      where: { bookId_memberId: { bookId, memberId } },
    });

    let record;
    if (existing) {
      record = await prisma.readingRecord.update({
        where: { id: existing.id },
        data: {
          readDate: readDate ? new Date(readDate) : new Date(),
          rating: rating !== undefined ? Number(rating) : null,
          note: note || null,
        },
      });
      return NextResponse.json(apiSuccess(record, "更新阅读记录成功"));
    }

    record = await prisma.readingRecord.create({
      data: {
        bookId,
        memberId,
        readDate: readDate ? new Date(readDate) : new Date(),
        rating: rating !== undefined ? Number(rating) : null,
        note: note || null,
      },
    });

    return NextResponse.json(apiSuccess(record, "标记已读成功"), { status: 201 });
  } catch (error) {
    console.error("创建阅读记录失败:", error);
    return NextResponse.json(apiError("创建阅读记录失败"), { status: 500 });
  }
}
