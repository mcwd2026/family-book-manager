// 书籍管理 API
// GET: 获取书籍列表（支持搜索和筛选）
// POST: 新建书籍

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/utils";

// 获取书籍列表（支持搜索和筛选）
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const keyword = searchParams.get("keyword") || "";
    const status = searchParams.get("status") || "";
    const category = searchParams.get("category") || "";
    const ageMin = searchParams.get("ageMin");
    const ageMax = searchParams.get("ageMax");

    // 构建查询条件
    const where: Record<string, unknown> = {};
    if (keyword) {
      where.OR = [
        { title: { contains: keyword } },
        { author: { contains: keyword } },
        { isbn: { contains: keyword } },
      ];
    }
    if (status) where.status = status;
    if (category) where.category = category;

    // 年龄段筛选
    if (ageMin !== null && ageMax !== null && ageMin !== "" && ageMax !== "") {
      // 书的年龄区间与查询区间有交集即匹配
      where.AND = [
        { OR: [{ ageMin: { lte: Number(ageMax) } }, { ageMin: null }] },
        { OR: [{ ageMax: { gte: Number(ageMin) } }, { ageMax: null }] },
      ];
    }

    const books = await prisma.book.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        readings: {
          include: {
            member: { select: { id: true, name: true, avatar: true } },
          },
        },
      },
    });

    // 计算平均评分和已读成员
    const data = books.map((b) => {
      const ratings = b.readings.filter((r) => r.rating !== null).map((r) => r.rating as number);
      const avgRating = ratings.length > 0 ? ratings.reduce((a, c) => a + c, 0) / ratings.length : null;
      const readMembers = b.readings.map((r) => r.member);
      return {
        ...b,
        avgRating,
        readMembers,
        readings: undefined,
      };
    });

    return NextResponse.json(apiSuccess(data, "获取书籍列表成功"));
  } catch (error) {
    console.error("获取书籍列表失败:", error);
    return NextResponse.json(apiError("获取书籍列表失败"), { status: 500 });
  }
}

// 新建书籍
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      isbn,
      title,
      author,
      coverUrl,
      coverLocal,
      publisher,
      ageMin,
      ageMax,
      category,
      status,
      buyDate,
      buyPrice,
      note,
    } = body;

    if (!title) {
      return NextResponse.json(apiError("书名为必填项"), { status: 400 });
    }

    const book = await prisma.book.create({
      data: {
        isbn: isbn || null,
        title,
        author: author || null,
        coverUrl: coverUrl || null,
        coverLocal: coverLocal || null,
        publisher: publisher || null,
        ageMin: ageMin !== null && ageMin !== undefined ? Number(ageMin) : null,
        ageMax: ageMax !== null && ageMax !== undefined ? Number(ageMax) : null,
        category: category || null,
        status: status || "在库",
        buyDate: buyDate ? new Date(buyDate) : null,
        buyPrice: buyPrice !== null && buyPrice !== undefined ? Number(buyPrice) : null,
        note: note || null,
      },
    });

    return NextResponse.json(apiSuccess(book, "创建书籍成功"), { status: 201 });
  } catch (error) {
    console.error("创建书籍失败:", error);
    return NextResponse.json(apiError("创建书籍失败"), { status: 500 });
  }
}
