"use client";
// 手机扫码接力页：二维码打开后直接调用手机摄像头，扫码结果实时回传 NAS
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Camera, CameraOff, CheckCircle2, Image as ImageIcon, Loader2, ScanLine, AlertCircle } from "lucide-react";

type Scanner = {
  start: (
    camera: { facingMode: string },
    config: Record<string, unknown>,
    onSuccess: (text: string) => void,
    onError: (message: string) => void
  ) => Promise<void>;
  stop: () => Promise<void>;
  clear: () => void;
};

export default function MobileScanPage() {
  const params = useParams<{ token: string }>();
  const token = Array.isArray(params.token) ? params.token[0] : params.token;

  const [running, setRunning] = useState(false);
  const [count, setCount] = useState(0);
  const [last, setLast] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [secure, setSecure] = useState(true);
  const scannerRef = useRef<Scanner | null>(null);
  const lastSubmitRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tokenRef = useRef(token);
  tokenRef.current = token;

  useEffect(() => {
    setSecure(typeof window !== "undefined" && window.isSecureContext);
  }, []);

  // 扫码打开后尝试自动唤起摄像头；浏览器要求用户手势时会退回手动点击
  useEffect(() => {
    if (!window.isSecureContext) return;
    const timer = setTimeout(() => {
      startCamera();
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(code: string) {
    const now = Date.now();
    if (lastSubmitRef.current.code === code && now - lastSubmitRef.current.at < 2500) return;
    lastSubmitRef.current = { code, at: now };

    try {
      const res = await fetch(`/api/scan/session/${tokenRef.current}/isbn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isbn: code }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message || "提交失败");
        return;
      }
      setError("");
      setLast(code);
      setCount(json.data.total ?? 0);
      setMessage(json.data.duplicate ? `已录入过：${code}` : `已回传：${code}`);
      navigator.vibrate?.(60);
      setTimeout(() => setMessage(""), 2500);
    } catch {
      setError("网络连接失败，请确认手机与 NAS 在同一局域网");
    }
  }

  async function startCamera() {
    setError("");
    setMessage("");
    if (!window.isSecureContext) {
      setSecure(false);
      setError("当前是 HTTP 访问，浏览器禁止调用摄像头。请使用下方「拍照识别」，或通过 HTTPS 打开本页。");
      return;
    }
    if (scannerRef.current) return;
    setBusy(true);
    try {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("m-scan-reader", {
        verbose: false,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
        ],
      }) as unknown as Scanner;
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          // 横向长条取景框，贴合书背 ISBN 条码
          qrbox: (width: number, height: number) => {
            const boxWidth = Math.min(Math.round(width * 0.86), 340);
            return { width: boxWidth, height: Math.min(Math.round(boxWidth * 0.42), 170) };
          },
          aspectRatio: 1.6,
        },
        (text) => {
          const code = (text || "").replace(/\D/g, "");
          if (/^\d{10,13}$/.test(code)) submit(code);
        },
        () => {
          /* 未识别到条码的每一帧，忽略 */
        }
      );
      setRunning(true);
    } catch (e) {
      setError((e as Error)?.message || "无法打开摄像头，请检查相机权限");
      try {
        scannerRef.current?.clear();
      } catch {
        /* ignore */
      }
      scannerRef.current = null;
    } finally {
      setBusy(false);
    }
  }

  async function stopCamera() {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    setRunning(false);
    if (!scanner) return;
    try {
      await scanner.stop();
      scanner.clear();
    } catch {
      /* ignore */
    }
  }

  async function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || busy) return;
    setBusy(true);
    setError("");
    if (running) await stopCamera();
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("m-file-reader", { verbose: false });
      try {
        const result = await scanner.scanFileV2(file, false);
        const code = (result.decodedText || "").replace(/\D/g, "");
        if (!/^\d{10,13}$/.test(code)) throw new Error("不是 ISBN 条码");
        await submit(code);
      } finally {
        try {
          scanner.clear();
        } catch {
          /* ignore */
        }
      }
    } catch {
      setError("未能从照片中识别出 ISBN，请对准书背条形码再拍一次");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    return () => {
      const scanner = scannerRef.current;
      scannerRef.current = null;
      try {
        scanner?.stop().then(() => scanner.clear()).catch(() => undefined);
      } catch {
        /* ignore */
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="px-5 pt-6 pb-4 text-center">
        <div className="inline-flex items-center gap-2 text-emerald-400">
          <ScanLine size={20} />
          <span className="font-semibold tracking-wide">FBM 手机扫码枪</span>
        </div>
        <p className="mt-2 text-sm text-slate-400">
          扫码结果会实时传回 NAS 的「扫码录入」页
        </p>
      </header>

      <main className="px-4 pb-10 space-y-4">
        <div className="rounded-2xl overflow-hidden bg-black border border-slate-800 min-h-[240px] flex items-center justify-center relative">
          <div id="m-scan-reader" className="w-full" />
          {!running && !busy && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
              <Camera size={40} className="text-slate-500" />
              <p className="text-sm text-slate-400">点击下方按钮开启摄像头</p>
            </div>
          )}
          {running && (
            <div className="absolute left-3 right-3 top-3 flex items-center gap-1.5 text-xs text-emerald-400 bg-black/60 rounded-full px-3 py-1 w-fit">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              正在自动识别 ISBN 条码
            </div>
          )}
          {/* 供相册/拍照识别使用的离屏容器 */}
          <div id="m-file-reader" className="fixed left-[-9999px] top-0 w-[1200px] h-[1200px] overflow-hidden" />
        </div>

        {(message || error) && (
          <div
            className={`flex items-start gap-2 text-sm rounded-xl px-3 py-2 ${
              error ? "bg-red-950 text-red-300" : "bg-emerald-950 text-emerald-300"
            }`}
          >
            {error ? <AlertCircle size={16} className="mt-0.5" /> : <CheckCircle2 size={16} className="mt-0.5" />}
            <span className="flex-1">{error || message}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {running ? (
            <button
              onClick={stopCamera}
              className="py-3.5 rounded-xl bg-slate-800 text-slate-200 font-medium flex items-center justify-center gap-2 active:scale-95 transition"
            >
              <CameraOff size={18} /> 停止扫码
            </button>
          ) : (
            <button
              onClick={startCamera}
              disabled={busy}
              className="py-3.5 rounded-xl bg-emerald-500 text-white font-medium flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-60"
            >
              {busy ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
              开启摄像头
            </button>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            className="py-3.5 rounded-xl bg-slate-800 text-slate-200 font-medium flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-60"
          >
            <ImageIcon size={18} /> 拍照识别
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={onFilePicked}
        />

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">本次已回传</span>
            <span className="text-emerald-400 font-semibold">{count} 本</span>
          </div>
          {last && (
            <p className="text-xs text-slate-500 font-mono">最近一本：{last}</p>
          )}
          <p className="text-xs text-slate-500 leading-relaxed pt-1 border-t border-slate-800">
            {secure
              ? "提示：首次打开若提示「证书不受信任」，选择继续访问即可。"
              : "当前为 HTTP 访问（无法调用摄像头），请使用「拍照识别」；或在 NAS 上启用 HTTPS 后重新扫码。"}
            扫描成功后无需再次点击，可连续扫多本书；在 NAS 页面上点击对应条目即可填入信息。
          </p>
        </div>
      </main>
    </div>
  );
}
