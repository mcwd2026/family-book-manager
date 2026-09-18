"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Search, LayoutGrid, List, Library as LibraryIcon, Filter } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookCover } from "@/components/ui/book-cover";
import { Avatar } from "@/components/ui/avatar";
import { StarRating } from "@/components/ui/star-rating";
import { Empty } from "@/components/ui/empty";
import { FullLoading } from "@/components/ui/loading";
import { PageHeader } from "@/components/page-header";
import { BottomNav } from "@/components/bottom-nav";
import { cn, formatDate } from "@/lib/utils";

interface Book {
  id: string;
  title: string;
  author: string | null;
  coverUrl: string | null;
  coverLocal: string | null;
  ageMin: number | null;
  ageMax: number | null;
  category: string | null;
  status: string;
  isbn: string | null;
  buyDate: string | null;
  readMembers: { id: string; name: string; avatar: string | null }[];
  avgRating: number | null;
}

export default function LibraryPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [ageRange, setAgeRange] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (keyword) params.set("keyword", keyword);
    if (status) params.set("status", status);
    if (category) params.set("category", category);
    if (ageRange) {
      const [min, max] = ageRange.split("-");
      params.set("ageMin", min);
      params.set("ageMax", max);
    }
    fetch(`/api/books?${params.toString()}`)
      .then((r) => r.json())
      .then((res) => res.success && setBooks(res.data))
      .finally(() => setLoading(false));
  }, [keyword, status, category, ageRange]);

  useEffect(() => { load(); }, [load]);

  // 防抖
  useEffect(() => {
    const t = setTimeout(() => load(), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword]);

  return (
    <div className="min-h-screen">
      <PageHeader
        title="全部藏书"
        subtitle={`共 ${books.length} 本`}
        action={
          <div className="flex gap-1 border rounded-md p-0.5">
            <button
              onClick={() => setView("grid")}
              className={cn("p-1.5 rounded", view === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setView("list")}
              className={cn("p-1.5 rounded", view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
            >
              <List size={16} />
            </button>
          </div>
        }
      />

      {/* 搜索栏 */}
      <div className="px-4 space-y-2">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索书名、作者、ISBN"
            className="pl-9"
          />
        </div>

        {/* 筛选 */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto min-w-[100px]">
            <option value="">全部状态</option>
            <option value="在库">在库</option>
            <option value="已出售">已出售</option>
            <option value="已移除">已移除</option>
          </Select>
          <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-auto min-w-[100px]">
            <option value="">全部分类</option>
            <option value="绘本">绘本</option>
            <option value="童话">童话</option>
            <option value="科普">科普</option>
            <option value="益智">益智</option>
            <option value="文学">文学</option>
            <option value="英文">英文</option>
            <option value="其他">其他</option>
          </Select>
          <Select value={ageRange} onChange={(e) => setAgeRange(e.target.value)} className="w-auto min-w-[110px]">
            <option value="">全部年龄</option>
            <option value="0-2">0-2岁</option>
            <option value="3-6">3-6岁</option>
            <option value="7-10">7-10岁</option>
            <option value="11-14">11-14岁</option>
            <option value="15-99">成人</option>
          </Select>
        </div>
      </div>

      {/* 书籍列表 */}
      <div className="px-4 mt-3 pb-4">
        {loading ? (
          <FullLoading tip="加载书库..." />
        ) : books.length === 0 ? (
          <Empty
            icon={<LibraryIcon size={48} className="opacity-40" />}
            title="没有找到书籍"
            description="试试调整筛选条件，或扫码录入新书"
            action={<Link href="/scan"><Button>去扫码录入</Button></Link>}
          />
        ) : view === "grid" ? (
          <div className="grid grid-cols-2 gap-3">
            {books.map((b) => (
              <Link href={`/books/${b.id}`} key={b.id}>
                <Card className="hover:shadow-md transition overflow-hidden">
                  <CardContent className="p-2">
                    <BookCover src={b.coverUrl} fallback={b.coverLocal} title={b.title} className="w-full aspect-[2/3]" />
                    <div className="text-xs font-medium mt-1.5 line-clamp-2 leading-tight">{b.title}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{b.author || "未知"}</div>
                    {b.status !== "在库" && (
                      <Badge variant="warning" className="mt-1 text-[10px]">{b.status}</Badge>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {books.map((b) => (
              <Link href={`/books/${b.id}`} key={b.id}>
                <Card className="hover:shadow-md transition">
                  <CardContent className="p-3 flex gap-3">
                    <BookCover src={b.coverUrl} fallback={b.coverLocal} title={b.title} width={56} height={76} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-medium text-sm line-clamp-2 flex-1">{b.title}</div>
                        {b.status !== "在库" && <Badge variant="warning" className="shrink-0 text-[10px]">{b.status}</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{b.author || "未知作者"}</div>
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        {b.ageMin !== null && b.ageMax !== null && (
                          <Badge variant="secondary" className="text-[10px]">{b.ageMin}-{b.ageMax}岁</Badge>
                        )}
                        {b.category && <Badge variant="outline" className="text-[10px]">{b.category}</Badge>}
                      </div>
                      <div className="flex items-center justify-between mt-1.5">
                        <StarRating value={b.avgRating} readOnly size={12} />
                        <div className="flex items-center gap-1">
                          {b.readMembers.slice(0, 3).map((m) => (
                            <Avatar key={m.id} src={m.avatar} name={m.name} size={16} />
                          ))}
                          {b.readMembers.length > 0 && (
                            <span className="text-[10px] text-muted-foreground">{b.readMembers.length}人读过</span>
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
