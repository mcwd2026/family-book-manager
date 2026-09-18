// 成员管理 API
// GET: 获取成员列表（含统计信息）
// POST: 新建成员

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calcAge, calcAgeDetailed } from "@/lib/age";
import { apiSuccess, apiError } from "@/lib/utils";

// 获取成员列表（含统计信息）
export async function GET() {
  try {
    const members = await prisma.member.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        _count: { select: { readings: true } },
      },
    });

    // 获取所有在库书籍用于计算适合数量
    const allBooks = await prisma.book.findMany({ where: { status: "在库" } });

    const data = members.map((m) => {
      const age = calcAge(m.birthDate);
      const suitableBookCount =
        m.type !== "成人"
          ? allBooks.filter((b) => {
              if (b.ageMin === null && b.ageMax === null) return true;
              if (age === null) return false;
              const min = b.ageMin ?? 0;
              const max = b.ageMax ?? 999;
              return age >= min && age <= max;
            }).length
          : undefined;
      return {
        id: m.id,
        name: m.name,
        type: m.type,
        birthDate: m.birthDate,
        avatar: m.avatar,
        createdAt: m.createdAt,
        age,
        ageDetail: calcAgeDetailed(m.birthDate),
        readCount: m._count.readings,
        suitableBookCount,
      };
    });

    return NextResponse.json(apiSuccess(data, "获取成员列表成功"));
  } catch (error) {
    console.error("获取成员列表失败:", error);
    return NextResponse.json(apiError("获取成员列表失败"), { status: 500 });
  }
}

// 新建成员
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, type, birthDate, avatar } = body;

    if (!name || !type) {
      return NextResponse.json(apiError("姓名和类型为必填项"), { status: 400 });
    }

    if (type !== "成人" && !birthDate) {
      return NextResponse.json(apiError("请填写出生日期"), { status: 400 });
    }

    const member = await prisma.member.create({
      data: {
        name,
        type,
        birthDate: birthDate ? new Date(birthDate) : null,
        avatar: avatar || null,
      },
    });

    return NextResponse.json(apiSuccess(member, "创建成员成功"), { status: 201 });
  } catch (error) {
    console.error("创建成员失败:", error);
    return NextResponse.json(apiError("创建成员失败"), { status: 500 });
  }
}
