// 单个成员 API
// GET: 获取成员详情（含阅读记录）
// PUT: 更新成员
// DELETE: 删除成员

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calcAge, calcAgeDetailed } from "@/lib/age";
import { apiSuccess, apiError } from "@/lib/utils";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const member = await prisma.member.findUnique({
      where: { id },
      include: {
        readings: {
          include: { book: true },
          orderBy: { readDate: "desc" },
        },
        _count: { select: { readings: true } },
      },
    });

    if (!member) {
      return NextResponse.json(apiError("成员不存在"), { status: 404 });
    }

    const data = {
      ...member,
      age: calcAge(member.birthDate),
      ageDetail: calcAgeDetailed(member.birthDate),
      readCount: member._count.readings,
    };

    return NextResponse.json(apiSuccess(data, "获取成员详情成功"));
  } catch (error) {
    console.error("获取成员详情失败:", error);
    return NextResponse.json(apiError("获取成员详情失败"), { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { name, type, birthDate, avatar } = body;

    if (!name || !type) {
      return NextResponse.json(apiError("姓名和类型为必填项"), { status: 400 });
    }

    const existing = await prisma.member.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(apiError("成员不存在"), { status: 404 });
    }

    const member = await prisma.member.update({
      where: { id },
      data: {
        name,
        type,
        birthDate: birthDate ? new Date(birthDate) : null,
        avatar: avatar || null,
      },
    });

    return NextResponse.json(apiSuccess(member, "更新成员成功"));
  } catch (error) {
    console.error("更新成员失败:", error);
    return NextResponse.json(apiError("更新成员失败"), { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.member.delete({ where: { id } });
    return NextResponse.json(apiSuccess(null, "删除成员成功"));
  } catch (error) {
    console.error("删除成员失败:", error);
    return NextResponse.json(apiError("删除成员失败"), { status: 500 });
  }
}
