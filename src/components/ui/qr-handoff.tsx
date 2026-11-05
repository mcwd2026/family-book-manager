"use client";
// 手机摄像头接力面板：桌面端展示二维码，手机扫码后 ISBN 自动回传
import { useCallback, useEffect, useRef, useState } from "react";
import { QrCode, RefreshCw, Smartphone, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface SessionData {
  token: string;
  phoneUrl: string;
  qrDataUrl: string;
  expiresAt: string;
}

interface Item {
  id: string;
  isbn: string;
  createdAt: string;
}

interface Enriched {
  title?: string;
  coverUrl?: string;
  found?: boolean;
  loading?: boolean;
}

export function QrHandoff({ onPick }: { onPick: (isbn: string) => void }) {
  const [session, setSession] = useState<SessionData | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [enriched, setEnriched] = useState<Record<string, Enriched>>({});
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const queriedRef = useRef<Set<string>>(new Set());

  const createSession = useCallback(async () => {
    setCreating(true);
    setError("");
    setItems([]);
    setEnriched({});
    queriedRef.current = new Set();
    try {
      const res = await fetch("/api/scan/session", { method: "POST" });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || "创建失败");
      setSession(json.data as SessionData);
    } catch (e) {
      setError((e as Error).message || "二维码生成失败");
    } finally {
      setCreating(false);
    }
  }, []);

  useEffect(() => {
    createSession();
  }, [createSession]);

  // 轮询手机端提交的 ISBN，并异步补全书名/封面
  useEffect(() => {
    if (!session) return;
    let stopped = false;

    async function poll() {
      try {
        const res = await fetch(`/api/scan/session/${session!.token}`, { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        if (stopped || !json.success) return;
        const list = json.data.items as Item[];
        setItems(list);

        for (const item of list) {
          if (queriedRef.current.has(item.isbn)) continue;
          queriedRef.current.add(item.isbn);
          setEnriched((prev) => ({ ...prev, [item.isbn]: { loading: true } }));
          fetch(`/api/scan-isbn?isbn=${encodeURIComponent(item.isbn)}`)
            .then((r) => r.json())
            .then((result) => {
              if (stopped) return;
              const info = result?.data;
              setEnriched((prev) => ({
                ...prev,
                [item.isbn]: {
                  loading: false,
                  found: Boolean(info?.found),
                  title: info?.title || "未查到书籍信息",
                  coverUrl: info?.coverUrl || "",
                },
              }));
            })
            .catch(() => {
              if (stopped) return;
              setEnriched((prev) => ({
                ...prev,
                [item.isbn]: { loading: false, found: false, title: "查询失败" },
              }));
            });
        }
      } catch {
        /* 单次轮询失败忽略 */
      }
    }

    poll();
    const timer = setInterval(poll, 2000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [session]);

  return (
    <Card className="border-primary/30">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <QrCode size={18} className="text-primary" />
          <h3 className="font-semibold">用手机摄像头扫码</h3>
          <span className="text-xs text-muted-foreground ml-auto">扫码后自动回传到本页</span>
        </div>

        {error && (
          <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 rounded-md p-2 mb-3">
            <AlertCircle size={16} className="mt-0.5" />
            {error}
          </div>
        )}

        {creating && !session && (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            <Loader2 size={16} className="animate-spin mr-2" /> 正在生成二维码...
          </div>
        )}

        {session && (
          <div className="grid gap-4 sm:grid-cols-[200px_1fr] items-start">
            <div className="text-center">
              {/* 二维码由服务端生成 dataURL，避免额外前端依赖 */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={session.qrDataUrl}
                alt="手机扫码入口二维码"
                className="w-[200px] h-[200px] mx-auto rounded-lg border bg-white p-1"
              />
              <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                <Smartphone size={12} className="inline mr-1" />
                手机扫码打开后，直接用手机摄像头扫书背 ISBN
              </p>
            </div>

            <div className="min-w-0 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">
                  已接收 <span className="text-primary">{items.length}</span> 个 ISBN
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={createSession} disabled={creating}>
                    {creating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    刷新二维码
                  </Button>
                </div>
              </div>

              {items.length === 0 ? (
                <div className="text-sm text-muted-foreground rounded-md border border-dashed p-4 leading-relaxed">
                  等待手机扫码…
                  <br />
                  <span className="text-xs">
                    首次用 HTTPS 打开会提示证书不受信任，选择「继续访问」即可调用摄像头。
                  </span>
                </div>
              ) : (
                <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                  {items.map((item) => {
                    const info = enriched[item.isbn];
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onPick(item.isbn)}
                        className="w-full text-left rounded-md border p-2 hover:bg-muted/60 active:scale-[0.99] transition"
                      >
                        <div className="flex items-center gap-2">
                          {info?.coverUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={info.coverUrl} alt="" className="w-8 h-11 object-cover rounded" />
                          ) : (
                            <div className="w-8 h-11 rounded bg-muted flex items-center justify-center text-[10px] text-muted-foreground">
                              书
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm truncate">
                              {info?.loading ? "查询书名中…" : info?.title || "点击查询书籍信息"}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono">{item.isbn}</p>
                          </div>
                          <CheckCircle2 size={16} className="text-green-600 shrink-0" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              <p className="text-[11px] text-muted-foreground break-all">
                手机地址：{session.phoneUrl}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
