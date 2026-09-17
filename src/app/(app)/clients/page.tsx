"use client";

import * as React from "react";
import { Plus, Pencil, Trash2, ExternalLink, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { PageHeader, StatusBadge, ConfirmDialog } from "@/components/shared";
import { DataTable, type Column } from "@/components/DataTable";
import { toast } from "@/components/ui/toaster";
import { formatDateShort } from "@/lib/format";

type Client = {
  id: string; code: string; companyName: string; contactPerson: string;
  email: string | null; phone: string | null; isActive: boolean; createdAt: string;
  _count?: { projects: number };
};

const emptyForm = {
  companyName: "", contactPerson: "", email: "", phone: "", whatsapp: "",
  address: "", npwp: "", website: "", notes: "", isActive: true,
};

export default function ClientsPage() {
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Client | null>(null);
  const [form, setForm] = React.useState(emptyForm);
  const [saving, setSaving] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<Client | null>(null);

  const columns: Column<Client>[] = [
    {
      key: "company",
      header: "Perusahaan",
      render: (c) => (
        <div>
          <p className="font-medium">{c.companyName}</p>
          <p className="text-xs text-muted-foreground">{c.code}</p>
        </div>
      ),
    },
    { key: "contact", header: "Contact Person", render: (c) => c.contactPerson },
    {
      key: "contactinfo",
      header: "Kontak",
      render: (c) => (
        <div className="space-y-0.5 text-xs text-muted-foreground">
          {c.email && <p className="flex items-center gap-1"><Mail className="h-3 w-3" /> {c.email}</p>}
          {c.phone && <p className="flex items-center gap-1"><Phone className="h-3 w-3" /> {c.phone}</p>}
        </div>
      ),
    },
    { key: "projects", header: "Project", render: (c) => c._count?.projects ?? 0 },
    {
      key: "status",
      header: "Status",
      render: (c) => (
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${c.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
          {c.isActive ? "Aktif" : "Nonaktif"}
        </span>
      ),
    },
    { key: "created", header: "Dibuat", render: (c) => formatDateShort(c.createdAt) },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (c) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" onClick={() => openEdit(c)} title="Edit">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(c)} title="Hapus">
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      ),
    },
  ];

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(c: Client) {
    setEditing(c);
    setForm({
      companyName: c.companyName,
      contactPerson: c.contactPerson,
      email: c.email ?? "",
      phone: c.phone ?? "",
      whatsapp: "",
      address: "",
      npwp: "",
      website: "",
      notes: "",
      isActive: c.isActive,
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.companyName || !form.contactPerson) {
      toast({ title: "Nama perusahaan & contact person wajib diisi", variant: "error" });
      return;
    }
    setSaving(true);
    const res = await fetch(editing ? `/api/clients/${editing.id}` : "/api/clients", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) {
      toast({ title: editing ? "Client diperbarui" : "Client ditambahkan", variant: "success" });
      setModalOpen(false);
      setRefreshKey((k) => k + 1);
    } else {
      const d = await res.json().catch(() => ({}));
      toast({ title: "Gagal menyimpan", description: d.error, variant: "error" });
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    const res = await fetch(`/api/clients/${deleteTarget.id}`, { method: "DELETE" });
    setSaving(false);
    if (res.ok) {
      toast({ title: "Client dihapus", variant: "success" });
      setRefreshKey((k) => k + 1);
    } else {
      const d = await res.json().catch(() => ({}));
      toast({ title: "Gagal menghapus", description: d.error, variant: "error" });
    }
    setDeleteTarget(null);
  }

  return (
    <div>
      <PageHeader title="Clients" description="Kelola data client Anda">
        <Button onClick={openCreate}>
          <Plus /> Tambah Client
        </Button>
      </PageHeader>

      <DataTable
        columns={columns}
        fetchUrl="/api/clients"
        searchPlaceholder="Cari perusahaan / contact / email..."
        refreshKey={refreshKey}
        onRowClick={(c) => (window.location.href = `/clients/${c.id}`)}
        emptyTitle="Belum ada client"
        emptyDescription="Tambahkan client pertama Anda untuk mulai membuat project"
      />

      {/* Create/Edit modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Client" : "Tambah Client"}</DialogTitle>
            <DialogDescription>Data client untuk penagihan dan komunikasi</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Nama Perusahaan *</Label>
              <Input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Contact Person *</Label>
              <Input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Telepon</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>WhatsApp</Label>
              <Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Website</Label>
              <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Alamat</Label>
              <Textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>NPWP (opsional)</Label>
              <Input value={form.npwp} onChange={(e) => setForm({ ...form, npwp: e.target.value })} />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} id="active" />
              <Label htmlFor="active">Client aktif</Label>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Catatan</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Batal</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Menyimpan..." : "Simpan"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={`Hapus client "${deleteTarget?.companyName}"?`}
        description="Data akan disembunyikan (soft delete). Client dengan project aktif tidak dapat dihapus."
        onConfirm={handleDelete}
        loading={saving}
      />
    </div>
  );
}
