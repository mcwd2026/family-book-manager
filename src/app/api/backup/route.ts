// 数据备份：导出/导入图书、成员、阅读记录（JSON，含关联 ID，便于整库迁移）
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function toDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export async function GET() {
  const [books, members, readings] = await Promise.all([
    prisma.book.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.member.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.readingRecord.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  const payload = {
    app: "fbm",
    version: 1,
    exportedAt: new Date().toISOString(),
    counts: { books: books.length, members: members.length, readings: readings.length },
    data: { books, members, readings },
  };

  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="fbm-backup-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: "文件不是有效的 JSON" }, { status: 400 });
  }

  const data = (body as { data?: unknown })?.data;
  if (!data || typeof data !== "object") {
    return NextResponse.json({ success: false, message: "备份文件缺少 data 字段" }, { status: 400 });
  }

  const { books, members, readings } = data as {
    books?: unknown;
    members?: unknown;
    readings?: unknown;
  };
  if (!Array.isArray(books) || !Array.isArray(members) || !Array.isArray(readings)) {
    return NextResponse.json(
      { success: false, message: "备份文件格式不正确（需要 books/members/readings 数组）" },
      { status: 400 }
    );
  }

  const memberRows = members.map((raw) => {
    const m = raw as Record<string, unknown>;
    return {
      id: asString(m.id) || undefined,
      name: asString(m.name).trim(),
      type: asString(m.type, "儿童"),
      birthDate: toDate(m.birthDate),
      avatar: m.avatar ? asString(m.avatar) : null,
      createdAt: toDate(m.createdAt),
      updatedAt: toDate(m.updatedAt),
    };
  });
  if (memberRows.some((m) => !m.name)) {
    return NextResponse.json({ success: false, message: "成员数据缺少 name" }, { status: 400 });
  }

  const bookRows = books.map((raw) => {
    const b = raw as Record<string, unknown>;
    return {
      id: asString(b.id) || undefined,
      isbn: b.isbn ? asString(b.isbn) : null,
      title: asString(b.title).trim(),
      author: b.author ? asString(b.author) : null,
      coverUrl: b.coverUrl ? asString(b.coverUrl) : null,
      coverLocal: b.coverLocal ? asString(b.coverLocal) : null,
      publisher: b.publisher ? asString(b.publisher) : null,
      ageMin: typeof b.ageMin === "number" ? b.ageMin : null,
      ageMax: typeof b.ageMax === "number" ? b.ageMax : null,
      category: b.category ? asString(b.category) : null,
      status: asString(b.status, "在库"),
      buyDate: toDate(b.buyDate),
      sellDate: toDate(b.sellDate),
      buyPrice: typeof b.buyPrice === "number" ? b.buyPrice : null,
      note: b.note ? asString(b.note) : null,
      createdAt: toDate(b.createdAt),
      updatedAt: toDate(b.updatedAt),
    };
  });
  if (bookRows.some((b) => !b.title)) {
    return NextResponse.json({ success: false, message: "图书数据缺少 title" }, { status: 400 });
  }

  const seen = new Set<string>();
  const readingRows = readings
    .map((raw) => {
      const r = raw as Record<string, unknown>;
      return {
        id: asString(r.id) || undefined,
        bookId: asString(r.bookId),
        memberId: asString(r.memberId),
        readDate: toDate(r.readDate) ?? new Date(),
        rating: typeof r.rating === "number" ? r.rating : null,
        note: r.note ? asString(r.note) : null,
        createdAt: toDate(r.createdAt),
      };
    })
    .filter((r) => {
      if (!r.bookId || !r.memberId) return false;
      const key = `${r.bookId}:${r.memberId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  const memberIds = new Set(memberRows.map((m) => m.id).filter(Boolean));
  const bookIds = new Set(bookRows.map((b) => b.id).filter(Boolean));
  if (readingRows.some((r) => !memberIds.has(r.memberId) || !bookIds.has(r.bookId))) {
    return NextResponse.json(
      { success: false, message: "阅读记录引用了不存在的图书或成员，请检查备份文件" },
      { status: 400 }
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.readingRecord.deleteMany();
      await tx.book.deleteMany();
      await tx.member.deleteMany();
      await tx.member.createMany({ data: memberRows });
      await tx.book.createMany({ data: bookRows });
      if (readingRows.length) {
        await tx.readingRecord.createMany({ data: readingRows });
      }
    });
  } catch (error) {
    console.error("[backup/import] 失败:", error);
    return NextResponse.json({ success: false, message: "导入失败，请检查备份文件" }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    data: {
      books: bookRows.length,
      members: memberRows.length,
      readings: readingRows.length,
    },
  });
}
