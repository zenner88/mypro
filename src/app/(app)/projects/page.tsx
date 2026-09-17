"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Pencil, Trash2, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, StatusBadge, ConfirmDialog, LoadingSpinner } from "@/components/shared";
import { DataTable, type Column } from "@/components/DataTable";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/components/ui/toaster";
import { formatIDR, formatDateShort } from "@/lib/format";

type Project = {
  id: string; code: string; name: string; status: string; priority: string;
  progress: number; totalValue: number; paid: number; outstanding: number;
  isOverdue: boolean; daysLeft: number | null;
  client: { companyName: string };
  targetCompletionDate: string | null;
};

type ClientOption = { id: string; companyName: string };

const STATUSES = ["DRAFT", "PROPOSAL", "NEGOTIATION", "APPROVED", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED"];
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const TYPES = ["website", "mobile", "desktop", "api", "maintenance", "other"];

const emptyForm = {
  name: "", clientId: "", description: "", projectType: "website",
  status: "DRAFT", priority: "MEDIUM",
  startDate: "", targetCompletionDate: "", totalValue: "", notes: "",
};

export default function ProjectsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [clients, setClients] = React.useState<ClientOption[]>([]);
  const [statusFilter, setStatusFilter] = React.useState(searchParams.get("status") ?? "");
  const [modalOpen, setModalOpen] = React.useState(searchParams.get("new") === "1");
  const [form, setForm] = React.useState(emptyForm);
  const [saving, setSaving] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<Project | null>(null);

  React.useEffect(() => {
    fetch("/api/clients?limit=100")
      .then((r) => r.json())
      .then((d) => setClients(d.items ?? []))
      .catch(() => {});
  }, []);

  const columns: Column<Project>[] = [
    {
      key: "name",
      header: "Project",
      render: (p) => (
        <div>
          <p className="font-medium">{p.name}</p>
          <p className="text-xs text-muted-foreground">{p.code}</p>
        </div>
      ),
    },
    { key: "client", header: "Client", render: (p) => p.client?.companyName ?? "-" },
    {
      key: "value",
      header: "Nilai",
      render: (p) => (
        <div>
          <p className="font-medium">{formatIDR(p.totalValue)}</p>
          <p className="text-xs text-muted-foreground">Belum dibayar: {formatIDR(p.outstanding)}</p>
        </div>
      ),
    },
    {
      key: "progress",
      header: "Progress",
      className: "w-36",
      render: (p) => (
        <div className="flex items-center gap-2">
          <Progress value={p.progress} className="h-1.5" />
          <span className="text-xs text-muted-foreground">{p.progress}%</span>
        </div>
      ),
    },
    {
      key: "deadline",
      header: "Deadline",
      render: (p) => {
        if (!p.targetCompletionDate) return "-";
        const overdue = p.isOverdue;
        return (
          <span className={overdue ? "text-red-600 font-medium" : ""}>
            {formatDateShort(p.targetCompletionDate)}
            {overdue && " ⚠"}
          </span>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      render: (p) => (
        <div className="flex flex-col gap-1">
          <StatusBadge status={p.status} />
          {p.priority === "URGENT" && <StatusBadge status="URGENT" />}
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (p) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(p)} title="Hapus">
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      ),
    },
  ];

  async function handleSave() {
    if (!form.name || !form.clientId) {
      toast({ title: "Nama project dan client wajib diisi", variant: "error" });
      return;
    }
    setSaving(true);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        totalValue: Number(form.totalValue) || 0,
      }),
    });
    setSaving(false);
    if (res.ok) {
      const project = await res.json();
      toast({ title: `Project ${project.code} dibuat`, variant: "success" });
      setModalOpen(false);
      setForm(emptyForm);
      router.push(`/projects/${project.id}`);
    } else {
      const d = await res.json().catch(() => ({}));
      toast({ title: "Gagal membuat project", description: d.error, variant: "error" });
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const res = await fetch(`/api/projects/${deleteTarget.id}`, { method: "DELETE" });
    if (res.ok) {
      toast({ title: "Project dihapus", variant: "success" });
      setRefreshKey((k) => k + 1);
    } else {
      const d = await res.json().catch(() => ({}));
      toast({ title: "Gagal menghapus", description: d.error, variant: "error" });
    }
    setDeleteTarget(null);
  }

  return (
    <div>
      <PageHeader title="Projects" description="Semua project Anda">
        <Button onClick={() => setModalOpen(true)}>
          <Plus /> New Project
        </Button>
      </PageHeader>

      <div className="mb-3 flex flex-wrap gap-2">
        <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Semua status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua status</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{s.replaceAll("_", " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        fetchUrl="/api/projects"
        searchPlaceholder="Cari nama / kode project..."
        refreshKey={refreshKey}
        extraQuery={{ status: statusFilter }}
        onRowClick={(p) => router.push(`/projects/${p.id}`)}
        emptyTitle="Belum ada project"
        emptyDescription="Buat project pertama Anda — mulai dari client, nilai, dan deadline"
      />

      {/* Create modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Project Baru</DialogTitle>
            <DialogDescription>Project code akan dibuat otomatis (PRJ-YYYY-NNNN)</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Nama Project *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Website Company Profile PT ABC" />
            </div>
            <div className="space-y-1.5">
              <Label>Client *</Label>
              <Select value={form.clientId} onValueChange={(v) => setForm({ ...form, clientId: v })}>
                <SelectTrigger><SelectValue placeholder="Pilih client" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Jenis</Label>
              <Select value={form.projectType} onValueChange={(v) => setForm({ ...form, projectType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Start Date</Label>
              <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Target Selesai</Label>
              <Input type="date" value={form.targetCompletionDate} onChange={(e) => setForm({ ...form, targetCompletionDate: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Nilai Project (Rp)</Label>
              <Input type="number" min="0" value={form.totalValue} onChange={(e) => setForm({ ...form, totalValue: e.target.value })} placeholder="15000000" />
            </div>
            <div className="space-y-1.5">
              <Label>Prioritas</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Deskripsi</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Batal</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Menyimpan..." : "Save Project"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={`Hapus project "${deleteTarget?.name}"?`}
        description="Project yang memiliki invoice terbayar tidak dapat dihapus."
        onConfirm={handleDelete}
      />
    </div>
  );
}
