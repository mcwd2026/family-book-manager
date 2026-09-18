// 批量封面刮削：遍历所有有 ISBN 的书，逐个重新查询更新封面
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    // 可选：只刮削没有 coverLocal（自定义封面）的书籍，优先刷新互联网封面
    const books = await prisma.book.findMany({
      where: { isbn: { not: null } },
      select: { id: true, isbn: true, coverUrl: true },
    });

    const port = process.env.PORT || 3000;
    let updated = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const book of books) {
      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/scan-isbn?isbn=${encodeURIComponent(book.isbn!)}`, {
          signal: AbortSignal.timeout(15000),
        });
        const data = await res.json();
        if (data.success && data.data?.found && data.data.coverUrl && data.data.coverUrl !== book.coverUrl) {
          await prisma.book.update({
            where: { id: book.id },
            data: { coverUrl: data.data.coverUrl },
          });
          updated++;
        }
      } catch (e) {
        failed++;
        errors.push(`${book.isbn}: ${(e as Error).message}`);
      }
      // 避免请求过快被数据源限流
      await new Promise((r) => setTimeout(r, 500));
    }

    return NextResponse.json(
      apiSuccess({ total: books.length, updated, failed, errors: errors.slice(0, 10) }, `批量刮削完成：更新 ${updated}/${books.length} 本，失败 ${failed} 本`)
    );
  } catch (error) {
    console.error("批量刮削失败:", error);
    return NextResponse.json(apiError("批量刮削失败"), { status: 500 });
  }
}
