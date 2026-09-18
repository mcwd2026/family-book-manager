"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Avatar } from "@/components/ui/avatar";
import { BookCover } from "@/components/ui/book-cover";
import { FullLoading } from "@/components/ui/loading";
import { Empty } from "@/components/ui/empty";
import { StarRating } from "@/components/ui/star-rating";
import { formatMonth, formatDate } from "@/lib/utils";

interface MemberDetail {
  id: string;
  name: string;
  type: string;
  birthDate: string | null;
  avatar: string | null;
  age: number | null;
  ageDetail: string;
  readCount: number;
  readings: Array<{
    id: string;
    readDate: string;
    rating: number | null;
    note: string | null;
    book: {
      id: string;
      title: string;
      author: string | null;
      coverUrl: string | null;
      coverLocal: string | null;
      ageMin: number | null;
      ageMax: number | null;
    };
  }>;
}

export default function MemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<MemberDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(() => {
    setLoading(true);
    fetch(`/api/members/${id}`)
      .then((r) => r.json())
      .then((res) => res.success && setData(res.data))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 取消某条阅读记录：先弹确认框，确认后执行删除
  const [cancelTarget, setCancelTarget] = useState<{ id: string; title: string } | null>(null);

  async function confirmCancelReading() {
    if (!cancelTarget) return;
    const res = await fetch(`/api/reading-records/${cancelTarget.id}`, { method: "DELETE" });
    const result = await res.json();
    setCancelTarget(null);
    if (result.success) loadData();
    else alert(result.message);
  }

  if (loading) return <FullLoading tip="加载成员记录..." />;
  if (!data) return <Empty title="成员不存在" />;

  // 按月分组
  const groups: Record<string, typeof data.readings> = {};
  data.readings.forEach((r) => {
    const key = formatMonth(r.readDate);
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  });

  return (
    <div className="min-h-screen">
      {/* 顶部信息卡 */}
      <div className="bg-gradient-to-br from-primary to-blue-600 text-primary-foreground px-4 pt-6 pb-8 rounded-b-3xl">
        <button onClick={() => router.back()} className="mb-4 text-primary-foreground/90">
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-4">
          <Avatar src={data.avatar} name={data.name} size={72} className="ring-4 ring-white/30" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">{data.name}</h1>
              <Badge variant="secondary">{data.type}</Badge>
            </div>
            {data.type !== "成人" && (
              <p className="text-sm text-primary-foreground/80 mt-1">
                {data.ageDetail}{data.birthDate && ` · 出生 ${formatDate(data.birthDate)}`}
              </p>
            )}
            <p className="text-sm text-primary-foreground/80 mt-1">累计阅读 {data.readCount} 本</p>
          </div>
        </div>
      </div>

      {/* 时间线阅读记录 */}
      <section className="px-4 mt-4 pb-4">
        <h2 className="text-base font-semibold mb-2">阅读记录</h2>
        {data.readings.length === 0 ? (
          <Empty title="还没有阅读记录" description="去书库给TA标记一本书吧" action={<Link href="/library" className="text-primary text-sm">浏览书库</Link>} />
        ) : (
          <div className="space-y-4">
            {Object.entries(groups).map(([month, items]) => (
              <div key={month}>
                <div className="flex items-center gap-2 mb-2">
                  <Calendar size={14} className="text-muted-foreground" />
                  <h3 className="text-sm font-medium text-muted-foreground">{month}</h3>
                  <span className="text-xs text-muted-foreground">({items.length} 本)</span>
                </div>
                <Card>
                  <CardContent className="p-0">
                    <ul className="divide-y">
                      {items.map((r) => (
                        <li key={r.id} className="flex items-center">
                          <Link href={`/books/${r.book.id}`} className="flex items-center gap-3 p-3 hover:bg-accent flex-1 min-w-0">
                            <BookCover src={r.book.coverUrl} fallback={r.book.coverLocal} title={r.book.title} width={48} height={64} />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm line-clamp-1">{r.book.title}</div>
                              <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                {r.book.author || "未知作者"}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-muted-foreground">{formatDate(r.readDate)}</span>
                                {r.rating && <StarRating value={r.rating} readOnly size={12} />}
                              </div>
                            </div>
                          </Link>
                          <button
                            onClick={() => setCancelTarget({ id: r.id, title: r.book.title })}
                            className="p-2 mr-1 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded transition shrink-0"
                            title="取消阅读记录"
                          >
                            <X size={16} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 取消阅读记录确认弹窗 */}
      <Dialog open={!!cancelTarget} onClose={() => setCancelTarget(null)}>
        <h2 className="text-lg font-bold mb-2">取消阅读记录</h2>
        <p className="text-sm text-muted-foreground">
          确认取消《{cancelTarget?.title}》的这条阅读记录？删除后无法恢复。
        </p>
        <div className="flex gap-2 pt-4">
          <Button variant="outline" className="flex-1" onClick={() => setCancelTarget(null)}>再想想</Button>
          <Button variant="destructive" className="flex-1" onClick={confirmCancelReading}>确认取消</Button>
        </div>
      </Dialog>
    </div>
  );
}
