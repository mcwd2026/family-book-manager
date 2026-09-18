// 单条阅读记录操作 API
// DELETE: 取消（删除）阅读记录

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/utils";

// 取消阅读记录
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const existing = await prisma.readingRecord.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(apiError("阅读记录不存在"), { status: 404 });
    }
    await prisma.readingRecord.delete({ where: { id } });
    return NextResponse.json(apiSuccess(null, "已取消该阅读记录"));
  } catch (error) {
    console.error("取消阅读记录失败:", error);
    return NextResponse.json(apiError("取消阅读记录失败"), { status: 500 });
  }
}
