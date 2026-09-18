"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, BookCheck, Pencil, Trash2, Calendar, Tag, Building2, DollarSign, X, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Avatar } from "@/components/ui/avatar";
import { CoverPicker } from "@/components/ui/cover-picker";
import { BookCover } from "@/components/ui/book-cover";
import { StarRating } from "@/components/ui/star-rating";
import { Dialog } from "@/components/ui/dialog";
import { Empty } from "@/components/ui/empty";
import { FullLoading } from "@/components/ui/loading";
import { formatDate } from "@/lib/utils";

interface BookDetail {
  id: string;
  isbn: string | null;
  title: string;
  author: string | null;
  coverUrl: string | null;
  coverLocal: string | null;
  publisher: string | null;
  ageMin: number | null;
  ageMax: number | null;
  category: string | null;
  status: string;
  buyDate: string | null;
  sellDate: string | null;
  buyPrice: number | null;
  note: string | null;
  createdAt: string;
  avgRating: number | null;
  readings: Array<{
    id: string;
    memberId: string;
    readDate: string;
    rating: number | null;
    note: string | null;
    member: { id: string; name: string; avatar: string | null; type: string };
  }>;
}

interface Member {
  id: string;
  name: string;
  type: string;
  avatar: string | null;
}

export default function BookDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [book, setBook] = useState<BookDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [markDialog, setMarkDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [selectedMember, setSelectedMember] = useState<string>("");
  const [rating, setRating] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  // 编辑表单
  const [editForm, setEditForm] = useState<Partial<BookDetail>>({});

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/books/${id}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setBook(res.data);
          setEditForm(res.data);
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
    fetch("/api/members")
      .then((r) => r.json())
      .then((res) => res.success && setMembers(res.data));
  }, [load]);

  function openMarkDialog() {
    if (members.length === 0) {
      alert("请先添加家庭成员");
      return;
    }
    setSelectedMember(members[0].id);
    setRating(null);
    setNote("");
    setMarkDialog(true);
  }

  async function markRead() {
    if (!selectedMember) { setErrorMsg("请选择成员"); return; }
    setSaving(true);
    const res = await fetch("/api/reading-records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookId: id, memberId: selectedMember, rating, note }),
    });
    const result = await res.json();
    setSaving(false);
    if (result.success) {
      setMarkDialog(false);
      load();
    } else {
      setErrorMsg(result.message || "操作失败");
    }
  }

  // 取消某成员的阅读记录：先弹确认框，确认后执行删除
  const [cancelTarget, setCancelTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [scraping, setScraping] = useState(false);

  async function confirmCancelReading() {
    if (!cancelTarget) return;
    const res = await fetch(`/api/reading-records/${cancelTarget.id}`, { method: "DELETE" });
    const result = await res.json();
    setCancelTarget(null);
    if (result.success) load();
    else alert(result.message);
  }

  async function saveEdit() {
    setSaving(true);
    const res = await fetch(`/api/books/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    const result = await res.json();
    setSaving(false);
    if (result.success) {
      setEditDialog(false);
      load();
    } else {
      setErrorMsg(result.message || "保存失败");
    }
  }

  async function remove() {
    setDeleteConfirm(true);
  }

  async function confirmDelete() {
    setDeleteConfirm(false);
    const res = await fetch(`/api/books/${id}`, { method: "DELETE" });
    const result = await res.json();
    if (result.success) router.push("/library");
    else setErrorMsg(result.message || "删除失败");
  }

  // 刮削封面：用 ISBN 重新查询各数据源获取最新封面
  async function scrapeCover() {
    setScraping(true);
    try {
      const res = await fetch(`/api/books/${id}/scrape`, { method: "POST" });
      const result = await res.json();
      if (result.success) {
        setEditForm((prev) => ({ ...prev, coverUrl: result.data.coverUrl }));
        load();
        setErrorMsg(result.message || "封面已更新");
      } else {
        setErrorMsg(result.message || "未找到新封面");
      }
    } catch {
      setErrorMsg("刮削请求失败");
    } finally {
      setScraping(false);
    }
  }

  if (loading) return <FullLoading tip="加载书籍..." />;
  if (!book) return <Empty title="书籍不存在" />;

  const statusVariant = book.status === "在库" ? "success" : book.status === "已出售" ? "warning" : "secondary";

  return (
    <div className="min-h-screen">
      {/* 顶部封面区 */}
      <div className="bg-gradient-to-br from-primary to-blue-600 text-primary-foreground px-4 pt-6 pb-8 rounded-b-3xl">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => router.back()} className="text-primary-foreground/90">
            <ArrowLeft size={20} />
          </button>
          <div className="flex gap-2">
            <button onClick={() => setEditDialog(true)} className="p-1.5 bg-white/15 rounded">
              <Pencil size={16} />
            </button>
            <button onClick={remove} className="p-1.5 bg-white/15 rounded">
              <Trash2 size={16} />
            </button>
          </div>
        </div>
        <div className="flex gap-4">
          <BookCover src={book.coverUrl} fallback={book.coverLocal} title={book.title} width={100} height={140} className="shadow-xl" />
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold line-clamp-2">{book.title}</h1>
            <p className="text-sm text-primary-foreground/80 mt-1 line-clamp-1">{book.author || "未知作者"}</p>
            {book.publisher && (
              <p className="text-xs text-primary-foreground/70 mt-1 line-clamp-1">{book.publisher}</p>
            )}
            <div className="flex flex-wrap gap-1 mt-2">
              {book.ageMin !== null && book.ageMax !== null && (
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">{book.ageMin}-{book.ageMax}岁</span>
              )}
              {book.category && (
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">{book.category}</span>
              )}
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">{book.status}</span>
            </div>
            {book.avgRating !== null && (
              <div className="mt-2">
                <StarRating value={book.avgRating} readOnly size={14} />
                <span className="text-xs text-primary-foreground/80 ml-1">{book.avgRating.toFixed(1)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 详细信息 */}
      <section className="px-4 mt-4">
        <Card>
          <CardContent className="p-4 space-y-2 text-sm">
            {book.isbn && (
              <div className="flex"><span className="text-muted-foreground w-20">ISBN</span><span>{book.isbn}</span></div>
            )}
            {book.buyDate && (
              <div className="flex items-center gap-2"><Calendar size={14} className="text-muted-foreground" /><span className="text-muted-foreground w-16">购买日</span><span>{formatDate(book.buyDate)}</span></div>
            )}
            {book.buyPrice !== null && (
              <div className="flex items-center gap-2"><DollarSign size={14} className="text-muted-foreground" /><span className="text-muted-foreground w-16">价格</span><span>¥{book.buyPrice.toFixed(2)}</span></div>
            )}
            {book.sellDate && (
              <div className="flex items-center gap-2"><Calendar size={14} className="text-muted-foreground" /><span className="text-muted-foreground w-16">售出日</span><span>{formatDate(book.sellDate)}</span></div>
            )}
            {book.note && (
              <div className="pt-2 border-t mt-2">
                <div className="text-muted-foreground text-xs mb-1">备注</div>
                <div className="text-sm">{book.note}</div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* 标记已读按钮 */}
      <div className="px-4 mt-4">
        <Button className="w-full" onClick={openMarkDialog} size="lg">
          <BookCheck size={18} /> 标记已读
        </Button>
      </div>

      {/* 阅读记录 */}
      <section className="px-4 mt-4 pb-4">
        <h2 className="text-base font-semibold mb-2">阅读记录（{book.readings.length}）</h2>
        {book.readings.length === 0 ? (
          <Empty title="还没有人读过" description="点击上方按钮标记已读" />
        ) : (
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y">
                {book.readings.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 p-3">
                    <Avatar src={r.member.avatar} name={r.member.name} size={40} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{r.member.name}</span>
                        <span className="text-xs text-muted-foreground">{formatDate(r.readDate)}</span>
                      </div>
                      {r.rating && <StarRating value={r.rating} readOnly size={12} />}
                      {r.note && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.note}</p>}
                    </div>
                    <button
                      onClick={() => setCancelTarget({ id: r.id, name: r.member.name })}
                      className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded transition shrink-0"
                      title="取消阅读记录"
                    >
                      <X size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </section>

      {/* 标记已读弹窗 */}
      <Dialog open={markDialog} onClose={() => setMarkDialog(false)}>
        <h2 className="text-lg font-bold mb-4">标记已读</h2>
        <div className="space-y-4">
          <div>
            <Label>谁读了这本书 *</Label>
            <Select value={selectedMember} onChange={(e) => setSelectedMember(e.target.value)}>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}（{m.type}）</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>评分</Label>
            <div className="pt-2">
              <StarRating value={rating} onChange={setRating} size={28} />
            </div>
          </div>
          <div>
            <Label>读后感（可选）</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="记录孩子的感受..." rows={3} />
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setMarkDialog(false)}>取消</Button>
            <Button className="flex-1" onClick={markRead} disabled={saving}>{saving ? "保存中..." : "确认"}</Button>
          </div>
        </div>
      </Dialog>

      {/* 编辑弹窗 */}
      <Dialog open={editDialog} onClose={() => setEditDialog(false)} className="max-w-lg">
        <h2 className="text-lg font-bold mb-4">编辑书籍</h2>
        <div className="space-y-3">
          <div>
            <Label>书名 *</Label>
            <Input value={editForm.title || ""} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
          </div>
          <div>
            <Label>作者</Label>
            <Input value={editForm.author || ""} onChange={(e) => setEditForm({ ...editForm, author: e.target.value })} />
          </div>
          <div>
            <Label>出版社</Label>
            <Input value={editForm.publisher || ""} onChange={(e) => setEditForm({ ...editForm, publisher: e.target.value })} />
          </div>
          <div>
              <Label>自定义封面</Label>
              <div className="pt-1">
                <CoverPicker value={editForm.coverLocal || null} onChange={(v) => setEditForm({ ...editForm, coverLocal: v })} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label>封面URL</Label>
                <button
                  onClick={scrapeCover}
                  disabled={scraping}
                  className="text-xs text-primary flex items-center gap-1 hover:underline disabled:opacity-50"
                >
                  <RefreshCw size={12} className={scraping ? "animate-spin" : ""} />
                  {scraping ? "刮削中..." : "刷新封面"}
                </button>
              </div>
              <Input value={editForm.coverUrl || ""} onChange={(e) => setEditForm({ ...editForm, coverUrl: e.target.value })} />
            </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>年龄-最小</Label>
              <Input type="number" value={editForm.ageMin ?? ""} onChange={(e) => setEditForm({ ...editForm, ageMin: e.target.value === "" ? null : Number(e.target.value) })} />
            </div>
            <div>
              <Label>年龄-最大</Label>
              <Input type="number" value={editForm.ageMax ?? ""} onChange={(e) => setEditForm({ ...editForm, ageMax: e.target.value === "" ? null : Number(e.target.value) })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>分类</Label>
              <Select value={editForm.category || ""} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}>
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
            <div>
              <Label>状态</Label>
              <Select value={editForm.status || "在库"} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                <option value="在库">在库</option>
                <option value="已出售">已出售</option>
                <option value="已移除">已移除</option>
              </Select>
            </div>
          </div>
          <div>
            <Label>备注</Label>
            <Textarea value={editForm.note || ""} onChange={(e) => setEditForm({ ...editForm, note: e.target.value })} rows={2} />
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setEditDialog(false)}>取消</Button>
            <Button className="flex-1" onClick={saveEdit} disabled={saving}>{saving ? "保存中..." : "保存"}</Button>
          </div>
        </div>
      </Dialog>

      {/* 取消阅读记录确认弹窗 */}
      <Dialog open={!!cancelTarget} onClose={() => setCancelTarget(null)}>
        <h2 className="text-lg font-bold mb-2">取消阅读记录</h2>
        <p className="text-sm text-muted-foreground">
          确认取消 {cancelTarget?.name} 的这条阅读记录？删除后无法恢复。
        </p>
        <div className="flex gap-2 pt-4">
          <Button variant="outline" className="flex-1" onClick={() => setCancelTarget(null)}>再想想</Button>
          <Button variant="destructive" className="flex-1" onClick={confirmCancelReading}>确认取消</Button>
        </div>
      </Dialog>

      {/* 删除书籍确认弹窗 */}
      <Dialog open={deleteConfirm} onClose={() => setDeleteConfirm(false)}>
        <h2 className="text-lg font-bold mb-2">删除书籍</h2>
        <p className="text-sm text-muted-foreground">
          确认删除《{book.title}》？相关阅读记录也会一并删除，此操作不可恢复。
        </p>
        <div className="flex gap-2 pt-4">
          <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirm(false)}>取消</Button>
          <Button variant="destructive" className="flex-1" onClick={confirmDelete}>确认删除</Button>
        </div>
      </Dialog>

      {/* 错误提示弹窗 */}
      <Dialog open={!!errorMsg} onClose={() => setErrorMsg("")}>
        <h2 className="text-lg font-bold mb-2">提示</h2>
        <p className="text-sm text-muted-foreground">{errorMsg}</p>
        <div className="flex gap-2 pt-4">
          <Button className="flex-1" onClick={() => setErrorMsg("")}>知道了</Button>
        </div>
      </Dialog>
    </div>
  );
}
