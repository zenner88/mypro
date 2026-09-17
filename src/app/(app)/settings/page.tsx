"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { PageHeader, LoadingSpinner } from "@/components/shared";
import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") ?? (session?.user?.role === "ADMIN" && searchParams.get("tab") === "users" ? "users" : "profile");
  const [tab, setTab] = React.useState(initialTab);
  const [settings, setSettings] = React.useState<Record<string, string> | null>(null);
  const [saving, setSaving] = React.useState(false);

  // profile
  const [profile, setProfile] = React.useState({ name: "", email: "", phone: "" });
  const [pw, setPw] = React.useState({ currentPassword: "", newPassword: "", confirm: "" });

  const isAdmin = session?.user?.role === "ADMIN";

  React.useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((d) => setSettings(d.settings)).catch(() => {});
    fetch("/api/profile")
      .then((r) => r.json())
      .then(setProfile)
      .catch(() => {});
  }, []);

  if (!settings) return <LoadingSpinner />;

  function set(key: string, value: string) {
    setSettings((prev) => ({ ...(prev ?? {}), [key]: value }));
  }

  async function saveSettings(keys: string[]) {
    setSaving(true);
    const body: Record<string, string> = {};
    for (const k of keys) body[k] = settings?.[k] ?? "";
    const res = await fetch("/api/settings", {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    setSaving(false);
    if (res.ok) toast({ title: "Pengaturan disimpan", variant: "success" });
    else toast({ title: "Gagal menyimpan", variant: "error" });
  }

  async function saveProfile() {
    const res = await fetch("/api/profile", {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(profile),
    });
    if (res.ok) toast({ title: "Profil diperbarui", variant: "success" });
    else toast({ title: "Gagal memperbarui profil", variant: "error" });
  }

  async function changePassword() {
    if (pw.newPassword !== pw.confirm) {
      toast({ title: "Konfirmasi password tidak sama", variant: "error" });
      return;
    }
    const res = await fetch("/api/profile", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: pw.currentPassword, newPassword: pw.newPassword }),
    });
    if (res.ok) {
      toast({ title: "Password diubah", variant: "success" });
      setPw({ currentPassword: "", newPassword: "", confirm: "" });
    } else {
      const d = await res.json().catch(() => ({}));
      toast({ title: "Gagal mengubah password", description: d.error, variant: "error" });
    }
  }

  return (
    <div>
      <PageHeader title="Settings" description="Konfigurasi aplikasi, profil, dan manajemen SaaS" />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="profile">Profil</TabsTrigger>
          {isAdmin && <TabsTrigger value="users">Manajemen Users (Admin)</TabsTrigger>}
          <TabsTrigger value="business">Business</TabsTrigger>
          <TabsTrigger value="invoice">Invoice</TabsTrigger>
          <TabsTrigger value="payment">Payment</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
        </TabsList>

        {/* Profile */}
        <TabsContent value="profile" className="max-w-xl space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Profil Saya</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label>Nama</Label>
                <Input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Telepon</Label>
                <Input value={profile.phone ?? ""} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
              </div>
              <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                <div className="text-xs text-slate-500">
                  Paket: <Badge variant="outline" className="font-bold text-emerald-700 bg-emerald-50">{session?.user?.plan ?? "FREE"}</Badge> ({session?.user?.role})
                </div>
                <Button onClick={saveProfile}>Simpan Profil</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ganti Password</CardTitle>
              <CardDescription>Minimal 8 karakter</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label>Password Saat Ini</Label>
                <Input type="password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Password Baru</Label>
                <Input type="password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Konfirmasi Password Baru</Label>
                <Input type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
              </div>
              <Button onClick={changePassword} disabled={!pw.currentPassword || pw.newPassword.length < 8}>
                Ubah Password
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* User Management Tab (Admin Only) */}
        {isAdmin && (
          <TabsContent value="users">
            <UserManagementTab />
          </TabsContent>
        )}

        {/* Business */}
        <TabsContent value="business" className="max-w-xl">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Data Bisnis</CardTitle>
              <CardDescription>Muncul di header invoice &amp; quotation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label>Nama Bisnis / Brand</Label>
                <Input value={settings.business_name ?? ""} onChange={(e) => set("business_name", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Alamat</Label>
                <Textarea rows={2} value={settings.business_address ?? ""} onChange={(e) => set("business_address", e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input value={settings.business_email ?? ""} onChange={(e) => set("business_email", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Telepon</Label>
                  <Input value={settings.business_phone ?? ""} onChange={(e) => set("business_phone", e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Website</Label>
                <Input value={settings.business_website ?? ""} onChange={(e) => set("business_website", e.target.value)} />
              </div>
              <Button onClick={() => saveSettings(["business_name", "business_address", "business_email", "business_phone", "business_website"])} disabled={saving}>
                Simpan
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Invoice */}
        <TabsContent value="invoice" className="max-w-xl">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pengaturan Invoice</CardTitle>
              <CardDescription>Penomoran, pajak, dan payment terms default</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label>Prefix</Label>
                <Input value={settings.invoice_prefix ?? ""} onChange={(e) => set("invoice_prefix", e.target.value)} placeholder="INV" />
              </div>
              <div className="space-y-1.5">
                <Label>Format Nomor</Label>
                <Input value={settings.invoice_number_format ?? ""} onChange={(e) => set("invoice_number_format", e.target.value)} placeholder="INV-{YEAR}-{NUMBER}" />
                <p className="text-xs text-muted-foreground">Variabel: {"{PREFIX} {YEAR} {NUMBER}"}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Pajak Default (%)</Label>
                  <Input type="number" value={settings.invoice_default_tax_percent ?? "0"} onChange={(e) => set("invoice_default_tax_percent", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Payment Terms (hari)</Label>
                  <Input type="number" value={settings.invoice_default_payment_terms_days ?? "7"} onChange={(e) => set("invoice_default_payment_terms_days", e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Catatan Default Invoice</Label>
                <Textarea rows={2} value={settings.invoice_notes ?? ""} onChange={(e) => set("invoice_notes", e.target.value)} />
              </div>
              <Button onClick={() => saveSettings(["invoice_prefix", "invoice_number_format", "invoice_default_tax_percent", "invoice_default_payment_terms_days", "invoice_notes"])} disabled={saving}>
                Simpan
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payment */}
        <TabsContent value="payment" className="max-w-xl">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Rekening &amp; Pembayaran</CardTitle>
              <CardDescription>Ditampilkan pada invoice PDF</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Nama Bank</Label>
                  <Input value={settings.bank_name ?? ""} onChange={(e) => set("bank_name", e.target.value)} placeholder="Bank Mandiri" />
                </div>
                <div className="space-y-1.5">
                  <Label>Atas Nama</Label>
                  <Input value={settings.bank_account_name ?? ""} onChange={(e) => set("bank_account_name", e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Nomor Rekening</Label>
                <Input value={settings.bank_account_number ?? ""} onChange={(e) => set("bank_account_number", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Instruksi Pembayaran</Label>
                <Textarea rows={2} value={settings.payment_instructions ?? ""} onChange={(e) => set("payment_instructions", e.target.value)} />
              </div>
              <Button onClick={() => saveSettings(["bank_name", "bank_account_name", "bank_account_number", "payment_instructions"])} disabled={saving}>
                Simpan
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* System */}
        <TabsContent value="system" className="max-w-xl">
          <Card>
            <CardHeader><CardTitle className="text-base">Sistem</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label>Timezone</Label>
                <Select value={settings.timezone ?? "Asia/Jakarta"} onValueChange={(v) => set("timezone", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura", "UTC"].map((tz) => (
                      <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Select value={settings.currency ?? "IDR"} onValueChange={(v) => set("currency", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["IDR", "USD", "SGD", "EUR"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Format Tanggal</Label>
                <Select value={settings.date_format ?? "DD/MM/YYYY"} onValueChange={(v) => set("date_format", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"].map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => saveSettings(["timezone", "currency", "date_format"])} disabled={saving}>
                Simpan
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function UserManagementTab() {
  const [users, setUsers] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editingUser, setEditingUser] = React.useState<any | null>(null);

  const fetchUsers = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      if (res.ok) setUsers(data.users ?? []);
    } catch {}
    setLoading(false);
  }, []);

  React.useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  async function handleQuickUpgrade(user: any, plan: "PRO" | "FREE") {
    const isPro = plan === "PRO";
    const res = await fetch("/api/admin/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.id,
        plan,
        maxProjects: isPro ? 9999 : 1,
        maxInvoices: isPro ? 9999 : 3,
      }),
    });
    if (res.ok) {
      toast({ title: `Paket ${user.name || user.email} diubah ke ${plan}`, variant: "success" });
      fetchUsers();
    } else {
      toast({ title: "Gagal memperbarui paket", variant: "error" });
    }
  }

  async function handleSaveUser() {
    if (!editingUser) return;
    const res = await fetch("/api/admin/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: editingUser.id,
        role: editingUser.role,
        plan: editingUser.plan,
        maxProjects: Number(editingUser.maxProjects),
        maxInvoices: Number(editingUser.maxInvoices),
      }),
    });
    if (res.ok) {
      toast({ title: "Data user diperbarui", variant: "success" });
      setEditingUser(null);
      fetchUsers();
    } else {
      toast({ title: "Gagal memperbarui user", variant: "error" });
    }
  }

  async function handleDeleteUser(userId: string) {
    if (!confirm("Yakin ingin menonaktifkan user ini?")) return;
    const res = await fetch(`/api/admin/users?userId=${userId}`, { method: "DELETE" });
    if (res.ok) {
      toast({ title: "User dinonaktifkan", variant: "success" });
      fetchUsers();
    } else {
      const d = await res.json().catch(() => ({}));
      toast({ title: "Gagal menonaktifkan user", description: d.error, variant: "error" });
    }
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>Manajemen User MYPro (SaaS Multi-tenant)</span>
            <Badge variant="outline" className="rounded-full bg-emerald-50 text-emerald-700 font-bold border-emerald-200">
              {users.length} Registered Users
            </Badge>
          </CardTitle>
          <CardDescription>
            Kelola hak akses role (ADMIN/USER), tipe paket (FREE/PRO), dan batas kuota (Projects &amp; Invoices) pengguna.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Pengguna</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Paket SaaS</th>
                  <th className="py-3 px-4">Penggunaan Project</th>
                  <th className="py-3 px-4">Penggunaan Invoice</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {users.map((u) => {
                  const projCount = u._count?.projects ?? 0;
                  const invCount = u._count?.invoices ?? 0;
                  const isPro = u.plan === "PRO";
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{u.name || "No Name"}</div>
                        <div className="text-xs text-slate-500">{u.email}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold",
                            u.role === "ADMIN"
                              ? "bg-purple-100 text-purple-800 border border-purple-200"
                              : "bg-slate-100 text-slate-700"
                          )}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold",
                            isPro
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              : "bg-amber-100 text-amber-800 border border-amber-200"
                          )}
                        >
                          {u.plan}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs font-medium">
                        <span className={projCount >= u.maxProjects && !isPro ? "text-rose-600 font-bold" : ""}>
                          {projCount} / {u.maxProjects >= 9999 ? "∞" : u.maxProjects} Project
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs font-medium">
                        <span className={invCount >= u.maxInvoices && !isPro ? "text-rose-600 font-bold" : ""}>
                          {invCount} / {u.maxInvoices >= 9999 ? "∞" : u.maxInvoices} Invoice
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        {isPro ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-8 text-amber-700 border-amber-300 hover:bg-amber-50"
                            onClick={() => handleQuickUpgrade(u, "FREE")}
                          >
                            Set Free
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs"
                            onClick={() => handleQuickUpgrade(u, "PRO")}
                          >
                            Upgrade PRO
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs h-8"
                          onClick={() => setEditingUser({ ...u })}
                        >
                          Edit Limit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs h-8 text-rose-600 hover:text-rose-700"
                          onClick={() => handleDeleteUser(u.id)}
                        >
                          Hapus
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {editingUser && (
        <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit User &amp; Limit Kuota</DialogTitle>
              <DialogDescription>{editingUser.email}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Role User</Label>
                <Select
                  value={editingUser.role}
                  onValueChange={(v) => setEditingUser({ ...editingUser, role: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USER">USER (Regular SaaS)</SelectItem>
                    <SelectItem value="ADMIN">ADMIN (Super Admin)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Tipe Paket</Label>
                <Select
                  value={editingUser.plan}
                  onValueChange={(v) => {
                    const isPro = v === "PRO";
                    setEditingUser({
                      ...editingUser,
                      plan: v,
                      maxProjects: isPro ? 9999 : 1,
                      maxInvoices: isPro ? 9999 : 3,
                    });
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FREE">FREE Tier (1 Project, 3 Invoice)</SelectItem>
                    <SelectItem value="PRO">PRO Tier (Unlimited)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Maksimal Project</Label>
                  <Input
                    type="number"
                    value={editingUser.maxProjects}
                    onChange={(e) => setEditingUser({ ...editingUser, maxProjects: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Maksimal Invoice</Label>
                  <Input
                    type="number"
                    value={editingUser.maxInvoices}
                    onChange={(e) => setEditingUser({ ...editingUser, maxInvoices: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingUser(null)}>Batal</Button>
              <Button onClick={handleSaveUser}>Simpan Perubahan</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
