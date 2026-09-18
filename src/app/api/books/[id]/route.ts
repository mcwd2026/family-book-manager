// 单本书 API
// GET: 获取书籍详情（含阅读记录）
// PUT: 更新书籍
// DELETE: 删除书籍

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/utils";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const book = await prisma.book.findUnique({
      where: { id },
      include: {
        readings: {
          include: {
            member: { select: { id: true, name: true, avatar: true, type: true } },
          },
          orderBy: { readDate: "desc" },
        },
      },
    });

    if (!book) {
      return NextResponse.json(apiError("书籍不存在"), { status: 404 });
    }

    const ratings = book.readings.filter((r) => r.rating !== null).map((r) => r.rating as number);
    const avgRating = ratings.length > 0 ? ratings.reduce((a, c) => a + c, 0) / ratings.length : null;

    return NextResponse.json(apiSuccess({ ...book, avgRating }, "获取书籍详情成功"));
  } catch (error) {
    console.error("获取书籍详情失败:", error);
    return NextResponse.json(apiError("获取书籍详情失败"), { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
      sellDate,
      buyPrice,
      note,
    } = body;

    const existing = await prisma.book.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(apiError("书籍不存在"), { status: 404 });
    }

    const book = await prisma.book.update({
      where: { id },
      data: {
        isbn: isbn !== undefined ? isbn || null : undefined,
        title: title !== undefined ? title : undefined,
        author: author !== undefined ? author || null : undefined,
        coverUrl: coverUrl !== undefined ? coverUrl || null : undefined,
        coverLocal: coverLocal !== undefined ? coverLocal || null : undefined,
        publisher: publisher !== undefined ? publisher || null : undefined,
        ageMin: ageMin !== undefined ? (ageMin === null ? null : Number(ageMin)) : undefined,
        ageMax: ageMax !== undefined ? (ageMax === null ? null : Number(ageMax)) : undefined,
        category: category !== undefined ? category || null : undefined,
        status: status !== undefined ? status : undefined,
        buyDate: buyDate !== undefined ? (buyDate ? new Date(buyDate) : null) : undefined,
        sellDate: sellDate !== undefined ? (sellDate ? new Date(sellDate) : null) : undefined,
        buyPrice: buyPrice !== undefined ? (buyPrice === null ? null : Number(buyPrice)) : undefined,
        note: note !== undefined ? note || null : undefined,
      },
    });

    return NextResponse.json(apiSuccess(book, "更新书籍成功"));
  } catch (error) {
    console.error("更新书籍失败:", error);
    return NextResponse.json(apiError("更新书籍失败"), { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.book.delete({ where: { id } });
    return NextResponse.json(apiSuccess(null, "删除书籍成功"));
  } catch (error) {
    console.error("删除书籍失败:", error);
    return NextResponse.json(apiError("删除书籍失败"), { status: 500 });
  }
}
