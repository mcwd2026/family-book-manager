// 创建手机扫码会话：桌面端拿到二维码，手机扫码后把 ISBN 回传
import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { buildPhoneUrl } from "@/lib/scan-handoff";

export const runtime = "nodejs";

const SESSION_TTL_MS = 30 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    const now = new Date();
    // 清理过期会话（避免表无限增长）
    await prisma.scanSession.deleteMany({ where: { expiresAt: { lt: now } } });

    const token = crypto.randomBytes(24).toString("base64url");
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
    await prisma.scanSession.create({ data: { token, expiresAt } });

    const phoneUrl = buildPhoneUrl(req, token);
    const qrDataUrl = await QRCode.toDataURL(phoneUrl, {
      width: 560,
      margin: 1,
      errorCorrectionLevel: "M",
    });

    return NextResponse.json({
      success: true,
      data: { token, phoneUrl, qrDataUrl, expiresAt: expiresAt.toISOString() },
    });
  } catch (error) {
    console.error("[scan/session] 创建失败:", error);
    return NextResponse.json({ success: false, message: "创建扫码会话失败" }, { status: 500 });
  }
}
