// 推荐页 API - 按年龄段或成员ID获取书籍推荐
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calcAge } from "@/lib/age";
import { apiSuccess, apiError } from "@/lib/utils";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const memberId = searchParams.get("memberId");
    const ageMin = searchParams.get("ageMin");
    const ageMax = searchParams.get("ageMax");

    const books = await prisma.book.findMany({
      where: { status: "在库" },
      include: {
        readings: {
          include: { member: { select: { id: true, name: true, avatar: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    let targetAgeMin = ageMin !== null ? Number(ageMin) : null;
    let targetAgeMax = ageMax !== null ? Number(ageMax) : null;
    let memberInfo: { id: string; name: string; age: number | null } | null = null;

    if (memberId) {
      const member = await prisma.member.findUnique({ where: { id: memberId } });
      if (!member) return NextResponse.json(apiError("成员不存在"), { status: 404 });
      const age = calcAge(member.birthDate);
      memberInfo = { id: member.id, name: member.name, age };
      if (age !== null) {
        targetAgeMin = age;
        targetAgeMax = age;
      }
    }

    const filtered = books.filter((b) => {
      if (targetAgeMin === null || targetAgeMax === null) return true;
      const bMin = b.ageMin ?? 0;
      const bMax = b.ageMax ?? 999;
      return bMin <= targetAgeMax && bMax >= targetAgeMin;
    });

    const data = filtered.map((b) => {
      const ratings = b.readings.filter((r) => r.rating !== null).map((r) => r.rating as number);
      const avgRating = ratings.length > 0 ? ratings.reduce((a, c) => a + c, 0) / ratings.length : null;
      return {
        id: b.id,
        title: b.title,
        author: b.author,
        coverUrl: b.coverUrl,
        ageMin: b.ageMin,
        ageMax: b.ageMax,
        category: b.category,
        avgRating,
        readMembers: b.readings.map((r) => r.member),
        readCount: b.readings.length,
      };
    });

    return NextResponse.json(apiSuccess({ member: memberInfo, books: data }, "获取推荐书籍成功"));
  } catch (error) {
    console.error("获取推荐书籍失败:", error);
    return NextResponse.json(apiError("获取推荐书籍失败"), { status: 500 });
  }
}
