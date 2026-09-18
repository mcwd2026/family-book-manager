"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Users, Calendar, ScanLine, Sparkles, ChevronRight, TrendingUp, RefreshCw, LogOut } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FullLoading } from "@/components/ui/loading";
import { Avatar } from "@/components/ui/avatar";
import { BookCover } from "@/components/ui/book-cover";
import { Empty } from "@/components/ui/empty";
import { BottomNav } from "@/components/bottom-nav";
import { formatDate } from "@/lib/utils";

interface DashboardData {
  totalBooks: number;
  totalMembers: number;
  totalReadings: number;
  monthReadCount: number;
  memberStats: Array<{
    id: string;
    name: string;
    type: string;
    avatar: string | null;
    age: number | null;
    ageDetail: string;
    totalReadCount: number;
    monthReadCount: number;
  }>;
  recommendations: Array<{
    memberId: string;
    memberName: string;
    memberAge: number | null;
    memberAgeDetail: string;
    books: Array<{
      id: string;
      title: string;
      author: string | null;
      coverUrl: string | null;
      coverLocal: string | null;
      ageMin: number | null;
      ageMax: number | null;
      category: string | null;
    }>;
  }>;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [scrapingAll, setScrapingAll] = useState(false);
  const [scrapeMsg, setScrapeMsg] = useState("");

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setData(res.data);
      })
      .finally(() => setLoading(false));
  }, []);

  // 批量刮削所有图书封面
  async function scrapeAllCovers() {
    setScrapingAll(true);
    setScrapeMsg("正在批量更新封面，请稍候...");
    try {
      const res = await fetch("/api/books/scrape-all", { method: "POST" });
      const result = await res.json();
      setScrapeMsg(result.message || "批量更新完成");
    } catch {
      setScrapeMsg("批量更新失败");
    } finally {
      setScrapingAll(false);
    }
  }

  if (loading) return <FullLoading tip="加载仪表盘..." />;

  if (!data) return <Empty title="加载失败" description="请刷新重试" />;

  return (
    <div className="min-h-screen">
      {/* 顶部欢迎区 */}
      <div className="bg-gradient-to-br from-primary to-blue-600 text-primary-foreground px-4 pt-6 pb-8 rounded-b-3xl">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">家庭绘本馆</h1>
            <p className="text-primary-foreground/80 text-sm mt-1">{formatDate(new Date())}</p>
          </div>
          <button
            onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/login"; }}
            className="text-primary-foreground/80 hover:text-primary-foreground text-sm flex items-center gap-1 shrink-0 mt-1"
          >
            <LogOut size={16} /> 退出
          </button>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          <div className="bg-white/15 backdrop-blur rounded-lg p-3">
            <BookOpen size={18} className="opacity-90" />
            <div className="text-2xl font-bold mt-1">{data.totalBooks}</div>
            <div className="text-xs opacity-80">藏书</div>
          </div>
          <div className="bg-white/15 backdrop-blur rounded-lg p-3">
            <Users size={18} className="opacity-90" />
            <div className="text-2xl font-bold mt-1">{data.totalMembers}</div>
            <div className="text-xs opacity-80">成员</div>
          </div>
          <div className="bg-white/15 backdrop-blur rounded-lg p-3">
            <Calendar size={18} className="opacity-90" />
            <div className="text-2xl font-bold mt-1">{data.monthReadCount}</div>
            <div className="text-xs opacity-80">本月阅读</div>
          </div>
        </div>
      </div>

      {/* 快捷入口 */}
      <div className="grid grid-cols-3 gap-2 px-4 -mt-4">
        <Link href="/scan" className="bg-card border rounded-xl p-3 text-center shadow-sm hover:shadow-md transition">
          <div className="w-10 h-10 mx-auto rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <ScanLine size={20} />
          </div>
          <div className="text-xs mt-1.5 font-medium">扫码录入</div>
        </Link>
        <Link href="/recommend" className="bg-card border rounded-xl p-3 text-center shadow-sm hover:shadow-md transition">
          <div className="w-10 h-10 mx-auto rounded-full bg-orange-500/10 text-orange-500 flex items-center justify-center">
            <Sparkles size={20} />
          </div>
          <div className="text-xs mt-1.5 font-medium">按年龄找书</div>
        </Link>
        <Link href="/members" className="bg-card border rounded-xl p-3 text-center shadow-sm hover:shadow-md transition">
          <div className="w-10 h-10 mx-auto rounded-full bg-green-500/10 text-green-600 flex items-center justify-center">
            <Users size={20} />
          </div>
          <div className="text-xs mt-1.5 font-medium">成员管理</div>
        </Link>
      </div>

      {/* 批量刮削封面 */}
      <div className="px-4 mt-3">
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={scrapeAllCovers}
          disabled={scrapingAll}
        >
          <RefreshCw size={14} className={`mr-1.5 ${scrapingAll ? "animate-spin" : ""}`} />
          {scrapingAll ? "正在批量更新封面..." : "批量更新图书封面"}
        </Button>
        {scrapeMsg && (
          <p className="text-xs text-muted-foreground text-center mt-1.5">{scrapeMsg}</p>
        )}
      </div>

      {/* 本月各成员阅读统计 */}
      <section className="px-4 mt-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-semibold flex items-center gap-1.5">
            <TrendingUp size={16} /> 本月阅读
          </h2>
        </div>
        <Card>
          <CardContent className="p-0">
            {data.memberStats.length === 0 ? (
              <Empty title="暂无成员" description="请先添加家庭成员" />
            ) : (
              <ul className="divide-y">
                {data.memberStats.map((m) => (
                  <li key={m.id}>
                    <Link href={`/members/${m.id}`} className="flex items-center gap-3 p-3 hover:bg-accent">
                      <Avatar src={m.avatar} name={m.name} size={40} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{m.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {m.type !== "成人" ? m.ageDetail : "成人"}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          本月阅读 {m.monthReadCount} 本 / 累计 {m.totalReadCount} 本
                        </div>
                      </div>
                      <div className="text-2xl font-bold text-primary">{m.monthReadCount}</div>
                      <ChevronRight size={16} className="text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      {/* 智能推荐 */}
      <section className="px-4 mt-6 pb-4">
        <h2 className="text-base font-semibold mb-2 flex items-center gap-1.5">
          <Sparkles size={16} /> 为孩子推荐
        </h2>
        {data.recommendations.length === 0 ? (
          <Empty title="暂无推荐" description="请先添加儿童/青少年成员和书籍" />
        ) : (
          <div className="space-y-4">
            {data.recommendations.map((rec) => (
              <Card key={rec.memberId}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="text-sm font-semibold">{rec.memberName}</div>
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      {rec.memberAgeDetail}
                    </span>
                  </div>
                  {rec.books.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">暂无适龄未读书籍</p>
                  ) : (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {rec.books.map((b) => (
                        <Link href={`/books/${b.id}`} key={b.id} className="shrink-0 w-20">
                          <BookCover src={b.coverUrl} fallback={b.coverLocal} title={b.title} width={80} height={108} />
                          <div className="text-xs mt-1 line-clamp-2 leading-tight">{b.title}</div>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <BottomNav />
    </div>
  );
}
