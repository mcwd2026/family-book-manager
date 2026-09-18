// 仪表盘 API

// 强制动态渲染，避免构建时预生成空响应
export const dynamic = "force-dynamic";

// GET: 返回首页所需统计数据

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calcAge, calcAgeDetailed } from "@/lib/age";
import { apiSuccess, apiError } from "@/lib/utils";

export async function GET(_req: NextRequest) {
  try {
    // 所有成员
    const members = await prisma.member.findMany({
      include: { _count: { select: { readings: true } } },
      orderBy: { createdAt: "asc" },
    });

    // 所有在库书籍
    const books = await prisma.book.findMany({
      where: { status: "在库" },
      include: {
        readings: {
          select: { memberId: true, rating: true },
        },
      },
    });

    // 所有阅读记录
    const allReadings = await prisma.readingRecord.findMany({
      include: { book: { select: { id: true, status: true } } },
    });

    // 本月起止
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // 统计每个成员本月阅读数
    const memberStats = members.map((m) => {
      const age = calcAge(m.birthDate);
      const ageDetail = calcAgeDetailed(m.birthDate);

      // 本月阅读数
      const monthReadings = allReadings.filter((r) => {
        const rd = new Date(r.readDate);
        return r.memberId === m.id && r.book && r.book.status !== "已移除" && rd >= monthStart && rd <= monthEnd;
      });

      return {
        id: m.id,
        name: m.name,
        type: m.type,
        avatar: m.avatar,
        birthDate: m.birthDate,
        age,
        ageDetail,
        totalReadCount: m._count.readings,
        monthReadCount: monthReadings.length,
      };
    });

    // 智能推荐：为每个有年龄成员推荐未读的适龄书
    const recommendations = members
      .filter((m) => m.type !== "成人")
      .map((m) => {
        const age = calcAge(m.birthDate);
        // 该成员已读的 bookId
        const readBookIds = new Set(
          allReadings.filter((r) => r.memberId === m.id).map((r) => r.bookId)
        );
        // 适龄且未读且在库
        const suitable = books.filter((b) => {
          if (readBookIds.has(b.id)) return false;
          if (age === null) return false;
          if (b.ageMin === null && b.ageMax === null) return true;
          const min = b.ageMin ?? 0;
          const max = b.ageMax ?? 999;
          return age >= min && age <= max;
        });
        return {
          memberId: m.id,
          memberName: m.name,
          memberAge: age,
          memberAgeDetail: calcAgeDetailed(m.birthDate),
          books: suitable.slice(0, 5).map((b) => ({
            id: b.id,
            title: b.title,
            author: b.author,
            coverUrl: b.coverUrl,
            ageMin: b.ageMin,
            ageMax: b.ageMax,
            category: b.category,
          })),
        };
      });

    const data = {
      totalBooks: books.length,
      totalMembers: members.length,
      totalReadings: allReadings.length,
      monthReadCount: allReadings.filter((r) => {
        const rd = new Date(r.readDate);
        return rd >= monthStart && rd <= monthEnd;
      }).length,
      memberStats,
      recommendations,
    };

    return NextResponse.json(apiSuccess(data, "获取仪表盘数据成功"));
  } catch (error) {
    console.error("获取仪表盘数据失败:", error);
    return NextResponse.json(apiError("获取仪表盘数据失败"), { status: 500 });
  }
}
