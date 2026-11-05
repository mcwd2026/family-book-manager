"use client";
// 数据备份页：导出/导入图书、成员、阅读记录（移动端优先）
import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Upload, Database, CheckCircle2, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ImportResult {
  books: number;
  members: number;
  readings: number;
}

export default function BackupPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleExport() {
    setExporting(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/backup");
      if (!res.ok) throw new Error("导出失败");
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] || "fbm-backup.json";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setMessage("导出完成，备份文件已开始下载");
    } catch {
      setError("导出失败，请重试");
    } finally {
      setExporting(false);
    }
  }

  async function handleFile(file: File) {
    setError("");
    setMessage("");
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      setError("文件不是有效的 JSON 备份");
      return;
    }
    const data = (parsed as { data?: { books?: unknown; members?: unknown; readings?: unknown } })?.data;
    if (!data || !Array.isArray(data.books) || !Array.isArray(data.members) || !Array.isArray(data.readings)) {
      setError("备份文件格式不正确");
      return;
    }
    const ok = window.confirm(
      `将导入 ${data.books.length} 本图书、${data.members.length} 位成员、${data.readings.length} 条阅读记录。\n\n导入会覆盖现有全部数据，确定继续吗？`
    );
    if (!ok) return;

    setImporting(true);
    try {
      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.message || "导入失败");
      const counts = result.data as ImportResult;
      setMessage(`导入完成：${counts.books} 本图书、${counts.members} 位成员、${counts.readings} 条阅读记录`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "导入失败，请检查备份文件");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="min-h-screen pb-20">
      <div className="px-4 pt-4">
        <Link href="/members" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
          <ArrowLeft size={16} /> 返回
        </Link>
      </div>

      <div className="px-4 mt-2">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Database size={20} /> 数据备份与迁移
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          导出的 JSON 文件包含全部图书信息、家庭成员和阅读记录，可用于换机迁移或定期备份。
        </p>
      </div>

      <div className="px-4 mt-5 space-y-3">
        <Card>
          <CardContent className="p-4">
            <h2 className="font-medium">导出数据</h2>
            <p className="text-xs text-muted-foreground mt-1">
              生成完整备份文件，包含封面、成员头像与阅读评分等全部字段。
            </p>
            <Button className="w-full mt-3" onClick={handleExport} disabled={exporting}>
              <Download size={16} className="mr-1.5" />
              {exporting ? "正在导出..." : "导出全部数据"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <h2 className="font-medium">导入数据</h2>
            <p className="text-xs text-muted-foreground mt-1">
              选择之前导出的 JSON 备份文件。导入会覆盖当前全部数据，请先做好备份。
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            <Button
              variant="outline"
              className="w-full mt-3"
              onClick={() => fileRef.current?.click()}
              disabled={importing}
            >
              <Upload size={16} className="mr-1.5" />
              {importing ? "正在导入..." : "选择备份文件并导入"}
            </Button>
          </CardContent>
        </Card>

        {message && (
          <div className="flex items-start gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
            <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
            <span>{message}</span>
          </div>
        )}
        {error && (
          <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-lg p-3">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}
