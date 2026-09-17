"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, StatusBadge, ConfirmDialog } from "@/components/shared";
import { DataTable, type Column } from "@/components/DataTable";
import { toast } from "@/components/ui/toaster";
import { formatIDR, formatDateShort, toInputDate } from "@/lib/format";

type Invoice = {
  id: string; number: string; total: string; amountPaid: string; status: string;
  invoiceDate: string; dueDate: string | null;
  client: { companyName: string };
  project: { name: string; code: string } | null;
};

type ClientOption = { id: string; companyName: string };
type ProjectOption = { id: string; name: string; clientId: string; code: string };

const STATUSES = ["DRAFT", "SENT", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED"];

export default function InvoicesPage() {
  const router = useRouter();
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [statusFilter, setStatusFilter] = React.useState("");
  const [modalOpen, setModalOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<Invoice | null>(null);
  const [clients, setClients] = React.useState<ClientOption[]>([]);
  const [projects, setProjects] = React.useState<ProjectOption[]>([]);

  const [clientId, setClientId] = React.useState("");
  const [projectId, setProjectId] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");

  React.useEffect(() => {
    fetch("/api/clients?limit=100").then((r) => r.json()).then((d) => setClients(d.items ?? [])).catch(() => {});
    fetch("/api/projects?limit=100").then((r) => r.json()).then((d) => setProjects(d.items ?? [])).catch(() => {});
  }, []);

  const columns: Column<Invoice>[] = [
    {
      key: "number", header: "Nomor",
      render: (i) => (
        <div>
          <p className="font-medium">{i.number}</p>
          <p className="text-xs text-muted-foreground">{formatDateShort(i.invoiceDate)}</p>
        </div>
      ),
    },
    { key: "client", header: "Client", render: (i) => i.client?.companyName ?? "-" },
    { key: "project", header: "Project", render: (i) => i.project?.name ?? "-" },
    {
      key: "total", header: "Total",
      render: (i) => (
        <div>
          <p className="font-medium">{formatIDR(i.total)}</p>
          {Number(i.amountPaid) > 0 && Number(i.amountPaid) < Number(i.total) && (
            <p className="text-xs text-muted-foreground">Dibayar {formatIDR(i.amountPaid)}</p>
          )}
        </div>
      ),
    },
    { key: "due", header: "Jatuh Tempo", render: (i) => formatDateShort(i.dueDate) },
    { key: "status", header: "Status", render: (i) => <StatusBadge status={i.status} /> },
    {
      key: "actions", header: "", className: "text-right",
      render: (i) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" onClick={() => router.push(`/invoices/${i.id}`)} title="Buka">
            <Receipt className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(i)} title="Hapus">
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      ),
    },
  ];

  async function handleCreate() {
    if (!clientId) {
      toast({ title: "Client wajib dipilih", variant: "error" });
      return;
    }
    setSaving(true);
    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId,
        projectId: projectId || undefined,
        amount: Number(amount) || 0,
        description: description || undefined,
        dueDate: dueDate || undefined,
      }),
    });
    setSaving(false);
    if (res.ok) {
      const inv = await res.json();
      toast({ title: `Invoice ${inv.number} dibuat`, variant: "success" });
      setModalOpen(false);
      setRefreshKey((k) => k + 1);
      router.push(`/invoices/${inv.id}`);
    } else {
      const d = await res.json().catch(() => ({}));
      toast({ title: "Gagal membuat invoice", description: d.error, variant: "error" });
    }
  }

  return (
    <div>
      <PageHeader title="Invoices" description="Semua invoice penagihan">
        <Button onClick={() => setModalOpen(true)}><Plus /> Invoice Baru</Button>
      </PageHeader>

      <div className="mb-3">
        <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Semua status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua status</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replaceAll("_", " ")}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns} fetchUrl="/api/invoices" searchPlaceholder="Cari nomor invoice..."
        refreshKey={refreshKey} extraQuery={{ status: statusFilter }}
        onRowClick={(i) => router.push(`/invoices/${i.id}`)}
        emptyTitle="Belum ada invoice"
      />

      {/* Create modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invoice Baru</DialogTitle>
            <DialogDescription>Nomor otomatis: INV-YYYY-NNNN</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Client *</Label>
              <Select value={clientId} onValueChange={(v) => { setClientId(v); setProjectId(""); }}>
                <SelectTrigger><SelectValue placeholder="Pilih client" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Project (opsional)</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger><SelectValue placeholder="Tanpa project" /></SelectTrigger>
                <SelectContent>
                  {projects.filter((p) => p.clientId === clientId).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.code} — {p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Jumlah (Rp)</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="6000000" />
            </div>
            <div className="space-y-1.5">
              <Label>Deskripsi</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Termin 1 — Down Payment" />
            </div>
            <div className="space-y-1.5">
              <Label>Jatuh Tempo</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Batal</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? "Menyimpan..." : "Buat Invoice"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={`Hapus invoice ${deleteTarget?.number}?`}
        description="Invoice dengan pembayaran tidak dapat dihapus."
        onConfirm={async () => {
          if (!deleteTarget) return;
          const res = await fetch(`/api/invoices/${deleteTarget.id}`, { method: "DELETE" });
          if (res.ok) { toast({ title: "Invoice dihapus", variant: "success" }); setRefreshKey((k) => k + 1); }
          else {
            const d = await res.json().catch(() => ({}));
            toast({ title: "Gagal menghapus", description: d.error, variant: "error" });
          }
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
