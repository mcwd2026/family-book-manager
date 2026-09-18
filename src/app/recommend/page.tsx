"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { BookCover } from "@/components/ui/book-cover";
import { StarRating } from "@/components/ui/star-rating";
import { Empty } from "@/components/ui/empty";
import { FullLoading } from "@/components/ui/loading";
import { PageHeader } from "@/components/page-header";
import { BottomNav } from "@/components/bottom-nav";
import { cn } from "@/lib/utils";

interface Member {
  id: string;
  name: string;
  type: string;
  birthDate: string | null;
  avatar: string | null;
  age: number | null;
  ageDetail: string;
}

interface RecommendBook {
  id: string;
  title: string;
  author: string | null;
  coverUrl: string | null;
  coverLocal: string | null;
  ageMin: number | null;
  ageMax: number | null;
  category: string | null;
  avgRating: number | null;
  readMembers: { id: string; name: string; avatar: string | null }[];
  readCount: number;
}

interface RecommendData {
  member: { id: string; name: string; age: number | null } | null;
  books: RecommendBook[];
}

// 预设年龄段
const ageRanges = [
  { label: "全部", min: null as number | null, max: null as number | null },
  { label: "0-2岁", min: 0, max: 2 },
  { label: "3-6岁", min: 3, max: 6 },
  { label: "7-10岁", min: 7, max: 10 },
  { label: "11-14岁", min: 11, max: 14 },
  { label: "成人", min: 15, max: 99 },
];

export default function RecommendPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [ageRange, setAgeRange] = useState<number | null>(0); // 索引
  const [data, setData] = useState<RecommendData | null>(null);
  const [loading, setLoading] = useState(true);

  // 加载成员列表
  useEffect(() => {
    fetch("/api/members")
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setMembers(res.data);
          // 默认选第一个有年龄成员
          const firstChild = res.data.find((m: Member) => m.type !== "成人");
          if (firstChild) setSelectedMember(firstChild.id);
        }
      });
  }, []);

  const loadBooks = useCallback(async () => {
    setLoading(true);
    const range = ageRanges[ageRange ?? 0];
    const params = new URLSearchParams();
    if (selectedMember) {
      params.set("memberId", selectedMember);
    } else if (range.min !== null && range.max !== null) {
      params.set("ageMin", String(range.min));
      params.set("ageMax", String(range.max));
    }
    const res = await fetch(`/api/recommend?${params.toString()}`);
    const result = await res.json();
    if (result.success) setData(result.data);
    setLoading(false);
  }, [selectedMember, ageRange]);

  useEffect(() => { loadBooks(); }, [loadBooks]);

  return (
    <div className="min-h-screen">
      <PageHeader title="按年龄推荐" subtitle="根据成员实际年龄筛选适龄书" />

      <div className="px-4 space-y-3">
        {/* 成员切换标签 */}
        {members.filter((m) => m.type !== "成人").length > 0 && (
          <div>
            <div className="text-xs text-muted-foreground mb-2">成员</div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {members
                .filter((m) => m.type !== "成人")
                .map((m) => (
                  <button
                    key={m.id}
                    onClick={() => { setSelectedMember(m.id); setAgeRange(0); }}
                    className={cn(
                      "shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition",
                      selectedMember === m.id
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-foreground border-border"
                    )}
                  >
                    {m.name}({m.ageDetail})
                  </button>
                ))}
            </div>
          </div>
        )}

        {/* 年龄段切换 */}
        <div>
          <div className="text-xs text-muted-foreground mb-2">年龄段</div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {ageRanges.map((r, idx) => (
              <button
                key={r.label}
                onClick={() => { setAgeRange(idx); setSelectedMember(null); }}
                className={cn(
                  "shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition",
                  (ageRange ?? 0) === idx && !selectedMember
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-foreground border-border"
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* 书籍列表 */}
        {loading ? (
          <FullLoading tip="加载推荐..." />
        ) : !data || data.books.length === 0 ? (
          <Empty
            icon={<Sparkles size={48} className="opacity-40" />}
            title="暂无适龄书籍"
            description="试试切换年龄段，或先录入更多书籍"
          />
        ) : (
          <div className="space-y-2 pb-4">
            {data.member && (
              <p className="text-sm text-muted-foreground">
                为 <span className="text-primary font-medium">{data.member.name}</span>（{data.member.age}岁）推荐 {data.books.length} 本
              </p>
            )}
            {data.books.map((b) => (
              <Link href={`/books/${b.id}`} key={b.id}>
                <Card className="mb-2 hover:shadow-md transition">
                  <CardContent className="p-3 flex gap-3">
                    <BookCover src={b.coverUrl} fallback={b.coverLocal} title={b.title} width={64} height={88} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm line-clamp-2">{b.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{b.author || "未知作者"}</div>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        {b.ageMin !== null && b.ageMax !== null && (
                          <Badge variant="secondary">{b.ageMin}-{b.ageMax}岁</Badge>
                        )}
                        {b.category && <Badge variant="outline">{b.category}</Badge>}
                      </div>
                      <div className="flex items-center justify-between mt-1.5">
                        <StarRating value={b.avgRating} readOnly size={12} />
                        <div className="flex items-center gap-1">
                          {b.readMembers.slice(0, 3).map((m) => (
                            <Avatar key={m.id} src={m.avatar} name={m.name} size={18} />
                          ))}
                          {b.readMembers.length > 3 && (
                            <span className="text-xs text-muted-foreground">+{b.readMembers.length - 3}</span>
                          )}
                          {b.readCount > 0 && (
                            <span className="text-xs text-muted-foreground ml-1">{b.readCount}人读过</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
