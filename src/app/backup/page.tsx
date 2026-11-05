"use client";
// 数据备份页：导出/导入图书、成员、阅读记录（移动端优先，不使用原生 confirm）
import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Upload, Database, CheckCircle2, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

interface ImportCounts {
  books: number;
  members: number;
  readings: number;
}

interface BackupData {
  books: unknown[];
  members: unknown[];
  readings: unknown[];
}

interface PendingImport {
  data: BackupData;
  counts: ImportCounts;
}

export default function BackupPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<PendingImport | null>(null);

  function resetFile() {
    if (fileRef.current) fileRef.current.value = "";
  }

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
      resetFile();
      return;
    }
    const data = (parsed as { data?: BackupData })?.data;
    if (!data || !Array.isArray(data.books) || !Array.isArray(data.members) || !Array.isArray(data.readings)) {
      setError("备份文件格式不正确");
      resetFile();
      return;
    }
    // 用应用内弹窗确认，避免移动端浏览器/WebView 屏蔽原生 confirm
    setPending({
      data,
      counts: { books: data.books.length, members: data.members.length, readings: data.readings.length },
    });
  }

  async function confirmImport() {
    if (!pending || importing) return;
    setImporting(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: pending.data }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.message || "导入失败");
      const counts = result.data as ImportCounts;
      setPending(null);
      setMessage(`导入完成：${counts.books} 本图书、${counts.members} 位成员、${counts.readings} 条阅读记录`);
    } catch (e) {
      setPending(null);
      setError(e instanceof Error ? e.message : "导入失败，请检查备份文件");
    } finally {
      setImporting(false);
      resetFile();
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
            {/* label 直接触发文件选择，移动端 WebView 中比隐藏 input + click() 更可靠 */}
            <label
              className={`${buttonVariants({ variant: "outline" })} w-full mt-3 cursor-pointer ${
                importing ? "pointer-events-none opacity-50" : ""
              }`}
            >
              <Upload size={16} className="mr-1.5" />
              {importing ? "正在导入..." : "选择备份文件并导入"}
              <input
                ref={fileRef}
                type="file"
                accept=".json,application/json,text/plain,application/octet-stream"
                className="sr-only"
                disabled={importing}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
            </label>
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

      {/* 导入确认弹窗 */}
      <Dialog open={!!pending} onClose={() => { if (!importing) { setPending(null); resetFile(); } }}>
        <h2 className="text-lg font-bold mb-2">确认导入数据</h2>
        <p className="text-sm text-muted-foreground">
          将导入 {pending?.counts.books ?? 0} 本图书、{pending?.counts.members ?? 0} 位成员、
          {pending?.counts.readings ?? 0} 条阅读记录。
        </p>
        <p className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-md px-3 py-2 mt-3">
          导入会覆盖现有全部数据，且不可恢复。建议先导出当前数据做好备份。
        </p>
        <div className="flex gap-2 pt-4">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => { setPending(null); resetFile(); }}
            disabled={importing}
          >
            取消
          </Button>
          <Button variant="destructive" className="flex-1" onClick={confirmImport} disabled={importing}>
            {importing ? "正在导入..." : "确认导入"}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
