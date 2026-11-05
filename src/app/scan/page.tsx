"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ScanLine, Camera, Check, Search, AlertCircle, BookPlus, Image as ImageIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { BookCover } from "@/components/ui/book-cover";
import { BottomNav } from "@/components/bottom-nav";
import { PageHeader } from "@/components/page-header";
import { Loading } from "@/components/ui/loading";
import { CoverPicker } from "@/components/ui/cover-picker";

interface BookInfo {
  title: string;
  author: string;
  publisher: string;
  coverUrl: string;
  isbn: string;
  summary: string;
  found: boolean;
  source?: string;
}

export default function ScanPage() {
  const router = useRouter();
  const [isbn, setIsbn] = useState("");
  const [querying, setQuerying] = useState(false);
  const [bookInfo, setBookInfo] = useState<BookInfo | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [identifying, setIdentifying] = useState(false);
  const [scanError, setScanError] = useState("");
  const [duplicate, setDuplicate] = useState<{ id: string; title: string } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoScanRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [autoScanning, setAutoScanning] = useState(false);

  // 表单字段
  const [form, setForm] = useState({
    isbn: "",
    title: "",
    author: "",
    publisher: "",
    coverUrl: "",
    coverLocal: null as string | null,
    ageMin: "" as string,
    ageMax: "" as string,
    category: "",
    buyDate: new Date().toISOString().slice(0, 10),
    buyPrice: "",
    note: "",
  });
  const [saving, setSaving] = useState(false);

  // 打开摄像头取景（高分辨率后置，便于拍照识别）
  async function startCamera() {
    setScanError("");
    setCameraOpen(true);
    await new Promise((r) => setTimeout(r, 150));
    try {
      if (typeof window === "undefined" || !window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          "当前环境不支持摄像头：请使用系统浏览器（Chrome/Safari）通过 HTTPS 访问，或改用「从相册选择照片识别」。"
        );
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      // 摄像头就绪后启动自动扫描
      startAutoScan();
    } catch (err) {
      setScanError((err as Error)?.message || "无法访问摄像头，请检查权限设置");
      setCameraOpen(false);
    }
  }

  function stopCamera() {
    setCameraOpen(false);
    stopAutoScan();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  // 轻量级单帧识别（自动扫描用，只做原生检测 + ZBar 上部区域，不做多区域多策略）
  async function scanFrame(video: HTMLVideoElement): Promise<string | null> {
    if (!video.videoWidth) return null;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(video, 0, 0);

    // 1. 原生 BarcodeDetector（快，支持的浏览器优先）
    try {
      const blob: Blob = await new Promise((r) => canvas.toBlob((b) => r(b!), "image/jpeg", 0.85));
      const text = await detectWithNative(new File([blob], "frame.jpg", { type: "image/jpeg" }));
      if (text) return text;
    } catch { /* 忽略，继续 ZBar */ }

    // 2. ZBar 上部区域（条码通常在书背面上部）
    try {
      const bitmap = await createImageBitmap(canvas);
      const bw = bitmap.width, bh = bitmap.height;
      const imageData = await cropToImageData(bitmap, bw * 0.03, bh * 0.02, bw * 0.94, bh * 0.45, 1600);
      bitmap.close?.();
      const text = await scanWithZBar(imageData);
      if (text) return text;
    } catch { /* 忽略 */ }

    return null;
  }

  // 自动扫描循环：每 500ms 截帧识别，成功后自动填充
  function startAutoScan() {
    if (autoScanRef.current) return;
    setAutoScanning(true);
    autoScanRef.current = setInterval(async () => {
      const video = videoRef.current;
      if (!video || !video.videoWidth || identifying) return;
      try {
        const text = await scanFrame(video);
        if (text) {
          const code = text.trim();
          if (/^\d{10,13}$/.test(code)) {
            stopAutoScan();
            stopCamera();
            setIsbn(code);
            queryIsbn(code);
          }
        }
      } catch { /* 单帧失败静默，继续扫描 */ }
    }, 500);
  }

  function stopAutoScan() {
    setAutoScanning(false);
    if (autoScanRef.current) {
      clearInterval(autoScanRef.current);
      autoScanRef.current = null;
    }
  }

  // 浏览器原生 BarcodeDetector 识别（华为/安卓 Chrome 支持，抗倾斜强）
  async function detectWithNative(source: File | Blob): Promise<string> {
    const w = window as unknown as { BarcodeDetector?: any };
    if (typeof w.BarcodeDetector === "undefined") return "";
    const supported: string[] = await w.BarcodeDetector.getSupportedFormats();
    const want = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code"];
    const use = want.filter((f) => supported.includes(f));
    if (!use.length) return "";
    const detector = new w.BarcodeDetector({ formats: use });
    const bitmap = await createImageBitmap(source);
    const codes = await detector.detect(bitmap);
    bitmap.close?.();
    return codes?.length && codes[0].rawValue ? (codes[0].rawValue as string) : "";
  }

  // html5-qrcode 解码单张图片
  async function scanViaLib(file: File): Promise<string> {
    const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
    if (!scanAreaRef.current) throw new Error("识别组件未就绪");
    const scanner = new Html5Qrcode(scanAreaRef.current.id, {
      verbose: false,
      formatsToSupport: [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.QR_CODE,
      ],
    });
    try {
      const result = await scanner.scanFileV2(file, false);
      return result.decodedText;
    } finally {
      try { scanner.clear(); } catch { /* ignore */ }
    }
  }

  // 裁剪 bitmap 的指定区域（可旋转），缩放到目标边长后导出 File
  async function cropToFile(
    bitmap: ImageBitmap,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    outEdge: number,
    rotateDeg = 0
  ): Promise<File> {
    const scale = Math.min(outEdge / Math.max(sw, sh), 4);
    const w = Math.max(1, Math.round(sw * scale));
    const h = Math.max(1, Math.round(sh * scale));
    const canvas = document.createElement("canvas");
    const rad = (rotateDeg * Math.PI) / 180;
    if (rotateDeg) {
      const cos = Math.abs(Math.cos(rad));
      const sin = Math.abs(Math.sin(rad));
      canvas.width = Math.round(w * cos + h * sin);
      canvas.height = Math.round(w * sin + h * cos);
      const ctx = canvas.getContext("2d")!;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(rad);
      ctx.drawImage(bitmap, sx, sy, sw, sh, -w / 2, -h / 2, w, h);
    } else {
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(bitmap, sx, sy, sw, sh, 0, 0, w, h);
    }
    return canvasToFile(canvas);
  }

  // ZBar 引擎识别（对 ISBN/EAN-13 识别率最高，抗反光、低对比度、部分遮挡）
  async function scanWithZBar(imageData: ImageData): Promise<string> {
    const { scanImageData } = await import("@undecaf/zbar-wasm");
    const symbols = await scanImageData(imageData);
    if (symbols?.length) {
      const text = symbols[0].decode();
      if (text) return text;
    }
    return "";
  }

  // 裁剪 bitmap 区域并缩放到目标边长，输出 ImageData（供 ZBar 使用）
  async function cropToImageData(
    bitmap: ImageBitmap,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    outEdge: number
  ): Promise<ImageData> {
    const scale = Math.min(outEdge / Math.max(sw, sh), 4);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(sw * scale));
    canvas.height = Math.max(1, Math.round(sh * scale));
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  // 多策略识别：原生检测 → ZBar 多区域 → html5-qrcode 多尺度/旋转，逐次尝试
  async function scanWithRetries(file: File): Promise<string> {
    // 1. 原生检测优先
    try {
      const text = await detectWithNative(file);
      if (text) return text;
    } catch (e) {
      console.error("[scan] 原生检测失败:", e);
    }
    // 2. ZBar 多区域识别（全图 + 上部放大 + 中部放大）
    const bitmap = await createImageBitmap(file);
    const bw = bitmap.width;
    const bh = bitmap.height;
    try {
      const zbarRegions: Array<[number, number, number, number]> = [
        [0, 0, bw, bh],
        [bw * 0.05, bh * 0.04, bw * 0.9, bh * 0.42],
        [bw * 0.03, bh * 0.28, bw * 0.94, bh * 0.4],
      ];
      for (const [sx, sy, sw, sh] of zbarRegions) {
        try {
          const text = await scanWithZBar(await cropToImageData(bitmap, sx, sy, sw, sh, 1600));
          if (text) return text;
        } catch (e) {
          console.error("[scan] ZBar 失败:", e);
        }
      }
      // 3. html5-qrcode(zxing) 多策略解码
      const attempts: Array<() => Promise<File>> = [
        () => cropToFile(bitmap, 0, 0, bw, bh, 1600), // 全图
        () => cropToFile(bitmap, bw * 0.05, bh * 0.04, bw * 0.9, bh * 0.42, 1600), // 上部放大
        () => cropToFile(bitmap, bw * 0.03, bh * 0.28, bw * 0.94, bh * 0.4, 1600), // 中部放大
        () => cropToFile(bitmap, 0, 0, bw, bh, 1000), // 全图小尺度
        () => cropToFile(bitmap, bw * 0.05, bh * 0.04, bw * 0.9, bh * 0.42, 1200, 6), // 上部 +6°
        () => cropToFile(bitmap, bw * 0.05, bh * 0.04, bw * 0.9, bh * 0.42, 1200, -6), // 上部 -6°
      ];
      for (const attempt of attempts) {
        try {
          const text = await scanViaLib(await attempt());
          if (text) return text;
        } catch (e) {
          console.error("[scan] zxing 失败:", e);
        }
      }
    } finally {
      bitmap.close?.();
    }
    throw new Error("未识别到条码");
  }

  function canvasToFile(canvas: HTMLCanvasElement): Promise<File> {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(new File([blob], "photo.jpg", { type: "image/jpeg" })) : reject(new Error("截图失败"))),
        "image/jpeg",
        0.9
      );
    });
  }

  // 拍照并识别
  async function takePhoto() {
    const video = videoRef.current;
    if (!video || !video.videoWidth || identifying) return;
    setIdentifying(true);
    setScanError("");
    try {
      const full = document.createElement("canvas");
      full.width = video.videoWidth;
      full.height = video.videoHeight;
      full.getContext("2d")!.drawImage(video, 0, 0);
      const text = await scanWithRetries(await canvasToFile(full));
      const code = text.trim();
      if (!/^\d{10,13}$/.test(code)) {
        throw new Error(`识别到内容但不是 ISBN：${code.slice(0, 20)}`);
      }
      stopCamera();
      setIsbn(code);
      queryIsbn(code);
    } catch (err) {
      const msg = (err as Error)?.message || "";
      setScanError(
        msg.startsWith("识别到内容")
          ? msg
          : "未识别到条码，请将书背面 ISBN 条形码对准取景框、保持光线充足后重新拍摄。"
      );
    } finally {
      setIdentifying(false);
    }
  }

  // 相册选图识别
  async function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || identifying) return;
    setIdentifying(true);
    setScanError("");
    try {
      const text = await scanWithRetries(file);
      const code = text.trim();
      if (!/^\d{10,13}$/.test(code)) throw new Error("不是ISBN");
      setIsbn(code);
      queryIsbn(code);
    } catch {
      setScanError("未能从该图片识别出条码，请拍摄清晰的 ISBN 条形码后重试。");
    } finally {
      setIdentifying(false);
    }
  }

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // 检查库内是否已有相同 ISBN 的图书
  function checkDuplicate(code: string) {
    if (!code) {
      setDuplicate(null);
      return;
    }
    fetch(`/api/books?keyword=${encodeURIComponent(code)}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success && Array.isArray(res.data)) {
          const dup = res.data.find((b: { isbn: string | null; title: string }) => b.isbn === code);
          setDuplicate(dup ? { id: dup.id, title: dup.title } : null);
        } else {
          setDuplicate(null);
        }
      })
      .catch(() => setDuplicate(null));
  }

  async function queryIsbn(code: string) {
    setQuerying(true);
    setBookInfo(null);
    setDuplicate(null);
    checkDuplicate(code);
    try {
      const res = await fetch(`/api/scan-isbn?isbn=${encodeURIComponent(code)}`);
      const result = await res.json();
      if (result.success && result.data) {
        const info = result.data as BookInfo;
        setBookInfo(info);
        setForm((prev) => ({
          isbn: code,
          title: info.title || "",
          author: info.author || "",
          publisher: info.publisher || "",
          coverUrl: info.coverUrl || "",
          coverLocal: prev.coverLocal,
          ageMin: "",
          ageMax: "",
          category: "",
          buyDate: new Date().toISOString().slice(0, 10),
          buyPrice: "",
          note: info.summary ? info.summary.slice(0, 200) : "",
        }));
      } else {
        setForm((prev) => ({ ...prev, isbn: code, title: "", author: "" }));
      }
    } catch (e) {
      console.error(e);
      setForm((prev) => ({ ...prev, isbn: code }));
    } finally {
      setQuerying(false);
    }
  }

  async function saveBook() {
    if (!form.title.trim()) {
      alert("请填写书名");
      return;
    }
    // ISBN 查重兜底：已入库则阻止保存（轻量点查接口，毫秒级）
    if (form.isbn) {
      try {
        const res = await fetch(`/api/books/check?isbn=${encodeURIComponent(form.isbn)}`);
        const result = await res.json();
        if (result.success && result.data) {
          alert(`《${result.data.title}》已入库，请扫描下一本`);
          return;
        }
      } catch {
        // 查重失败不阻塞保存
      }
    }
    setSaving(true);
    const res = await fetch("/api/books", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        ageMin: form.ageMin === "" ? null : Number(form.ageMin),
        ageMax: form.ageMax === "" ? null : Number(form.ageMax),
        buyPrice: form.buyPrice === "" ? null : Number(form.buyPrice),
        status: "在库",
      }),
    });
    const result = await res.json();
    setSaving(false);
    if (result.success) {
      // 直接跳转详情页，不再 alert 阻塞
      router.push(`/books/${result.data.id}`);
    } else {
      alert(result.message || "入库失败");
    }
  }

  return (
    <div className="min-h-screen">
      <PageHeader title="扫码录入" subtitle="扫一扫 ISBN，自动获取书籍信息" />

      <div className="px-4 space-y-4">
        {/* 拍照识别区 */}
        <Card>
          <CardContent className="p-4">
            {!cameraOpen ? (
              <div className="text-center py-2 space-y-3">
                <button
                  onClick={startCamera}
                  className="w-20 h-20 mx-auto rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg active:scale-95 transition"
                >
                  <Camera size={32} />
                </button>
                <p className="text-sm text-muted-foreground">拍照识别 ISBN 条形码</p>
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={identifying}>
                  <ImageIcon size={14} className="mr-1" /> 从相册选择照片识别
                </Button>
              </div>
            ) : (
              <div>
                <div className="relative rounded-lg overflow-hidden bg-black">
                  {/* 固定预览高度，顶部对齐裁切显示，避免撑满整屏 */}
                  <video ref={videoRef} playsInline muted className="w-full h-[45vh] object-cover object-top" />
                  {/* 取景框：宽大框贴近近拍，横向长条贴合书背面条形码 */}
                  <div className="absolute left-3 right-3 top-[8%] h-36 border-2 border-white/90 rounded-lg pointer-events-none shadow-[0_0_0_9999px_rgba(0,0,0,0.25)]" />
                  {/* 扫描中动效指示 */}
                  <div className="absolute left-3 right-3 top-[8%] h-36 overflow-hidden pointer-events-none">
                    <div className="absolute inset-x-0 h-0.5 bg-green-400 shadow-[0_0_8px_2px_rgba(74,222,128,0.6)] animate-[scanscan_1.5s_ease-in-out_infinite]" style={{ animationName: "scanline" }} />
                  </div>
                  <style dangerouslySetInnerHTML={{ __html: `@keyframes scanline{0%{top:0}50%{top:100%}100%{top:0}}` }} />
                </div>
                <div className="flex items-center justify-center gap-3 mt-3">
                  <Button size="sm" variant="outline" onClick={stopCamera}>取消</Button>
                </div>
                <p className="text-xs text-green-600 text-center mt-2 font-medium">
                  {autoScanning ? "正在自动扫描，将条形码对准取景框即可..." : "准备中..."}
                </p>
              </div>
            )}
            {/* 相册选图入口（隐藏 input，识别容器离屏） */}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFilePicked} />
            <div ref={scanAreaRef} id="photo-scan-area" className="fixed left-[-9999px] top-0 w-[1600px] h-[1600px] overflow-hidden" />
          </CardContent>
        </Card>

        {/* 识别错误提示 */}
        {scanError && (
          <Card className="border-red-400 bg-red-50">
            <CardContent className="p-3 flex items-start gap-2">
              <AlertCircle size={16} className="text-red-600 mt-0.5" />
              <div className="text-sm text-red-800">{scanError}</div>
            </CardContent>
          </Card>
        )}

        {/* 手动输入 */}
        <div>
          <Label>或手动输入 ISBN</Label>
          <div className="flex gap-2 mt-1">
            <Input
              value={isbn}
              onChange={(e) => setIsbn(e.target.value)}
              placeholder="输入10/13位ISBN"
              onKeyDown={(e) => e.key === "Enter" && isbn && queryIsbn(isbn)}
            />
            <Button onClick={() => isbn && queryIsbn(isbn)} disabled={!isbn || querying}>
              {querying ? <Loading size={16} /> : <Search size={16} />}
              查询
            </Button>
          </div>
        </div>

        {/* ISBN 查重提示 */}
        {duplicate && (
          <Card className="border-orange-400 bg-orange-50">
            <CardContent className="p-3 flex items-start gap-2">
              <AlertCircle size={16} className="text-orange-600 mt-0.5" />
              <div className="text-sm text-orange-800 flex-1">
                《{duplicate.title}》已入库，请扫描下一本。
                <Link href={`/books/${duplicate.id}`} className="underline ml-1">查看详情</Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 查询结果提示 */}
        {bookInfo && !bookInfo.found && (
          <Card className="border-yellow-400 bg-yellow-50">
            <CardContent className="p-3 flex items-start gap-2">
              <AlertCircle size={16} className="text-yellow-600 mt-0.5" />
              <div className="text-sm text-yellow-800">
                未在豆瓣/当当找到该书信息，请填写下方字段后入库。
              </div>
            </CardContent>
          </Card>
        )}
        {bookInfo && bookInfo.found && (
          <Card className="border-green-400 bg-green-50">
            <CardContent className="p-3 flex items-center gap-2">
              <Check size={16} className="text-green-600" />
              <div className="text-sm text-green-800">
                已查询到信息（来源：{bookInfo.source}）
              </div>
            </CardContent>
          </Card>
        )}

        {/* 书籍表单 */}
        {(bookInfo || isbn) && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="font-semibold flex items-center gap-1.5">
                <BookPlus size={16} /> 书籍信息（可编辑）
              </h3>

              {(form.coverUrl || form.coverLocal) && (
                <div className="flex justify-center">
                  <BookCover src={form.coverUrl} fallback={form.coverLocal} title={form.title} className="w-24 h-32 shadow" />
                </div>
              )}

              <div>
                <Label>书名 *</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <Label>作者</Label>
                <Input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} />
              </div>
              <div>
                <Label>出版社</Label>
                <Input value={form.publisher} onChange={(e) => setForm({ ...form, publisher: e.target.value })} />
              </div>
              <div>
                <Label>自定义封面（可选）</Label>
                <div className="pt-1">
                  <CoverPicker value={form.coverLocal} onChange={(v) => setForm({ ...form, coverLocal: v })} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">拍照或从相册选取书籍实拍封面，优先于下方网络封面显示</p>
              </div>
              <div>
                <Label>封面URL</Label>
                <Input value={form.coverUrl} onChange={(e) => setForm({ ...form, coverUrl: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>适读年龄-最小</Label>
                  <Input type="number" min={0} max={18} value={form.ageMin} onChange={(e) => setForm({ ...form, ageMin: e.target.value })} placeholder="如 3" />
                </div>
                <div>
                  <Label>适读年龄-最大</Label>
                  <Input type="number" min={0} max={99} value={form.ageMax} onChange={(e) => setForm({ ...form, ageMax: e.target.value })} placeholder="如 6" />
                </div>
              </div>
              <div>
                <Label>分类</Label>
                <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  <option value="">请选择</option>
                  <option value="绘本">绘本</option>
                  <option value="童话">童话</option>
                  <option value="科普">科普</option>
                  <option value="益智">益智</option>
                  <option value="文学">文学</option>
                  <option value="英文">英文</option>
                  <option value="其他">其他</option>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>购买日期</Label>
                  <Input type="date" value={form.buyDate} onChange={(e) => setForm({ ...form, buyDate: e.target.value })} />
                </div>
                <div>
                  <Label>购买价格</Label>
                  <Input type="number" step="0.01" value={form.buyPrice} onChange={(e) => setForm({ ...form, buyPrice: e.target.value })} placeholder="如 28.50" />
                </div>
              </div>
              <div>
                <Label>备注</Label>
                <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
              </div>

              <Button className="w-full" onClick={saveBook} disabled={saving}>
                {saving ? <Loading size={16} /> : <Check size={16} />}
                确认入库
              </Button>
            </CardContent>
          </Card>
        )}

        {!isbn && !cameraOpen && (
          <div className="text-center py-8 text-sm text-muted-foreground">
            <ScanLine size={48} className="mx-auto opacity-30 mb-2" />
            拍照识别或输入ISBN开始录入
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
