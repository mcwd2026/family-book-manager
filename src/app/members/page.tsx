"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, ChevronRight, UserPlus, KeyRound, LogOut, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Empty } from "@/components/ui/empty";
import { FullLoading } from "@/components/ui/loading";
import { PageHeader } from "@/components/page-header";
import { BottomNav } from "@/components/bottom-nav";
import { formatDate } from "@/lib/utils";

interface Member {
  id: string;
  name: string;
  type: string;
  birthDate: string | null;
  avatar: string | null;
  createdAt: string;
  age: number | null;
  ageDetail: string;
  readCount: number;
  suitableBookCount?: number;
}

export default function MembersPage() {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [form, setForm] = useState({ name: "", type: "儿童", birthDate: "", avatar: "" });
  const [submitting, setSubmitting] = useState(false);

  // 改密码弹窗
  const [pwdOpen, setPwdOpen] = useState(false);
  const [pwdForm, setPwdForm] = useState({ oldPassword: "", newPassword: "", confirmPassword: "" });
  const [pwdSubmitting, setPwdSubmitting] = useState(false);
  const [pwdError, setPwdError] = useState("");
  const [pwdSuccess, setPwdSuccess] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/members")
      .then((r) => r.json())
      .then((res) => res.success && setMembers(res.data))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    // 获取当前登录用户名
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((res) => res.success && setUsername(res.data.username))
      .catch(() => {});
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm({ name: "", type: "儿童", birthDate: "", avatar: "" });
    setDialogOpen(true);
  }

  function openEdit(m: Member) {
    setEditing(m);
    setForm({
      name: m.name,
      type: m.type,
      birthDate: m.birthDate ? formatDate(m.birthDate) : "",
      avatar: m.avatar || "",
    });
    setDialogOpen(true);
  }

  async function submit() {
    if (!form.name.trim()) return alert("请填写姓名");
    if (form.type !== "成人" && !form.birthDate) return alert("请填写出生日期");
    setSubmitting(true);
    const method = editing ? "PUT" : "POST";
    const url = editing ? `/api/members/${editing.id}` : "/api/members";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const result = await res.json();
    setSubmitting(false);
    if (result.success) {
      setDialogOpen(false);
      load();
    } else {
      alert(result.message);
    }
  }

  async function remove(m: Member) {
    if (!confirm(`确认删除「${m.name}」？相关阅读记录也会一并删除。`)) return;
    const res = await fetch(`/api/members/${m.id}`, { method: "DELETE" });
    const result = await res.json();
    if (result.success) load();
    else alert(result.message);
  }

  function openChangePassword() {
    setPwdForm({ oldPassword: "", newPassword: "", confirmPassword: "" });
    setPwdError("");
    setPwdSuccess(false);
    setPwdOpen(true);
  }

  async function submitPassword() {
    setPwdError("");
    setPwdSuccess(false);
    if (!pwdForm.oldPassword || !pwdForm.newPassword || !pwdForm.confirmPassword) {
      setPwdError("请填写所有字段");
      return;
    }
    if (pwdForm.newPassword.length < 6) {
      setPwdError("新密码至少 6 位");
      return;
    }
    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      setPwdError("两次输入的新密码不一致");
      return;
    }
    if (pwdForm.oldPassword === pwdForm.newPassword) {
      setPwdError("新密码不能与旧密码相同");
      return;
    }
    setPwdSubmitting(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oldPassword: pwdForm.oldPassword,
          newPassword: pwdForm.newPassword,
        }),
      });
      const result = await res.json();
      if (result.success) {
        setPwdSuccess(true);
        setPwdForm({ oldPassword: "", newPassword: "", confirmPassword: "" });
        setTimeout(() => setPwdOpen(false), 1200);
      } else {
        setPwdError(result.message || "修改失败");
      }
    } catch {
      setPwdError("网络错误，请重试");
    } finally {
      setPwdSubmitting(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  if (loading) return <FullLoading tip="加载中..." />;

  return (
    <div className="min-h-screen pb-20">
      <PageHeader title="我的" />

      {/* 我的账号 */}
      <div className="px-4 mt-3">
        <h2 className="text-sm font-semibold text-muted-foreground mb-2 px-1">我的账号</h2>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <User size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{username || "未登录"}</div>
                <div className="text-xs text-muted-foreground">登录账号</div>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" size="sm" className="flex-1" onClick={openChangePassword}>
                <KeyRound size={14} className="mr-1.5" />
                修改密码
              </Button>
              <Button variant="outline" size="sm" className="flex-1 text-destructive hover:text-destructive" onClick={handleLogout}>
                <LogOut size={14} className="mr-1.5" />
                退出登录
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 家庭成员管理 */}
      <div className="px-4 mt-5">
        <div className="flex items-center justify-between mb-2 px-1">
          <h2 className="text-sm font-semibold text-muted-foreground">家庭成员管理</h2>
          <Button size="sm" variant="ghost" onClick={openCreate} className="h-7 px-2">
            <Plus size={14} className="mr-1" />添加
          </Button>
        </div>

        {members.length === 0 ? (
          <Empty
            icon={<UserPlus size={48} className="opacity-40" />}
            title="还没有成员"
            description="点击右上角添加家庭成员"
            action={<Button onClick={openCreate}><Plus size={16} className="mr-1" />添加成员</Button>}
          />
        ) : (
          <div className="space-y-2">
            {members.map((m) => (
              <Card key={m.id}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <Link href={`/members/${m.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                      <Avatar src={m.avatar} name={m.name} size={48} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{m.name}</span>
                          <Badge variant={m.type !== "成人" ? "default" : "secondary"}>{m.type}</Badge>
                        </div>
                        {m.type !== "成人" ? (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {m.birthDate && <>出生 {formatDate(m.birthDate)} · </>}
                            {m.ageDetail} · 适合TA的书 {m.suitableBookCount ?? 0} 本
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground mt-0.5">已读 {m.readCount} 本</div>
                        )}
                      </div>
                      <ChevronRight size={16} className="text-muted-foreground" />
                    </Link>
                    <div className="flex flex-col gap-1">
                      <button onClick={() => openEdit(m)} className="p-1.5 text-muted-foreground hover:text-primary">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => remove(m)} className="p-1.5 text-muted-foreground hover:text-destructive">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* 添加/编辑成员弹窗 */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <h2 className="text-lg font-bold mb-4">{editing ? "编辑成员" : "添加成员"}</h2>
        <div className="space-y-4">
          <div>
            <Label>姓名 *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="请输入姓名" />
          </div>
          <div>
            <Label>类型 *</Label>
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="儿童">儿童</option>
              <option value="青少年">青少年</option>
              <option value="成人">成人</option>
            </Select>
          </div>
          {form.type !== "成人" && (
            <div>
              <Label>出生日期 *</Label>
              <Input
                type="date"
                value={form.birthDate}
                onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
              />
            </div>
          )}
          <div>
            <Label>头像URL（可选）</Label>
            <Input value={form.avatar} onChange={(e) => setForm({ ...form, avatar: e.target.value })} placeholder="https://..." />
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button className="flex-1" onClick={submit} disabled={submitting}>
              {submitting ? "保存中..." : "保存"}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* 修改密码弹窗 */}
      <Dialog open={pwdOpen} onClose={() => setPwdOpen(false)}>
        <h2 className="text-lg font-bold mb-4">修改密码</h2>
        <div className="space-y-4">
          <div>
            <Label>旧密码</Label>
            <Input
              type="password"
              value={pwdForm.oldPassword}
              onChange={(e) => setPwdForm({ ...pwdForm, oldPassword: e.target.value })}
              placeholder="请输入当前密码"
            />
          </div>
          <div>
            <Label>新密码</Label>
            <Input
              type="password"
              value={pwdForm.newPassword}
              onChange={(e) => setPwdForm({ ...pwdForm, newPassword: e.target.value })}
              placeholder="至少 6 位"
            />
          </div>
          <div>
            <Label>确认新密码</Label>
            <Input
              type="password"
              value={pwdForm.confirmPassword}
              onChange={(e) => setPwdForm({ ...pwdForm, confirmPassword: e.target.value })}
              placeholder="再次输入新密码"
            />
          </div>
          {pwdError && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{pwdError}</div>
          )}
          {pwdSuccess && (
            <div className="text-sm text-green-600 bg-green-50 rounded-md px-3 py-2">密码修改成功</div>
          )}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setPwdOpen(false)}>取消</Button>
            <Button className="flex-1" onClick={submitPassword} disabled={pwdSubmitting}>
              {pwdSubmitting ? "提交中..." : "确认修改"}
            </Button>
          </div>
        </div>
      </Dialog>

      <BottomNav />
    </div>
  );
}
