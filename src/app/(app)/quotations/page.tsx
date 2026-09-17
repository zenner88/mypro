"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, StatusBadge, ConfirmDialog } from "@/components/shared";
import { DataTable, type Column } from "@/components/DataTable";
import { toast } from "@/components/ui/toaster";
import { formatIDR, formatDateShort, toInputDate } from "@/lib/format";

type Quotation = {
  id: string; number: string; subject: string; total: string; status: string;
  quotationDate: string; validUntil: string | null;
  client: { companyName: string };
  project: { name: string; code: string } | null;
  convertedToProjectId?: string | null;
};

type ClientOption = { id: string; companyName: string };

type ItemRow = { name: string; description: string; qty: string; unitPrice: string; discount: string };

const STATUSES = ["DRAFT", "SENT", "APPROVED", "REJECTED", "EXPIRED"];

export default function QuotationsPage() {
  const router = useRouter();
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [clients, setClients] = React.useState<ClientOption[]>([]);
  const [statusFilter, setStatusFilter] = React.useState("");
  const [modalOpen, setModalOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<Quotation | null>(null);

  // form state
  const [clientId, setClientId] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [quotationDate, setQuotationDate] = React.useState(toInputDate(new Date()));
  const [validUntil, setValidUntil] = React.useState("");
  const [discount, setDiscount] = React.useState("0");
  const [taxPercent, setTaxPercent] = React.useState("0");
  const [terms, setTerms] = React.useState("");
  const [items, setItems] = React.useState<ItemRow[]>([{ name: "", description: "", qty: "1", unitPrice: "", discount: "0" }]);

  React.useEffect(() => {
    fetch("/api/clients?limit=100").then((r) => r.json()).then((d) => setClients(d.items ?? [])).catch(() => {});
  }, []);

  const subtotal = items.reduce((s, it) => s + Number(it.qty || 0) * Number(it.unitPrice || 0) - Number(it.discount || 0), 0);
  const afterDiscount = Math.max(0, subtotal - Number(discount || 0));
  const taxAmount = (afterDiscount * Number(taxPercent || 0)) / 100;
  const grandTotal = afterDiscount + taxAmount;

  const columns: Column<Quotation>[] = [
    {
      key: "number", header: "Nomor",
      render: (q) => (
        <div>
          <p className="font-medium">{q.number}</p>
          <p className="text-xs text-muted-foreground">{formatDateShort(q.quotationDate)}</p>
        </div>
      ),
    },
    { key: "subject", header: "Subjek", render: (q) => q.subject },
    { key: "client", header: "Client", render: (q) => q.client?.companyName ?? "-" },
    { key: "total", header: "Total", render: (q) => <span className="font-medium">{formatIDR(q.total)}</span> },
    { key: "valid", header: "Berlaku s/d", render: (q) => formatDateShort(q.validUntil) },
    { key: "status", header: "Status", render: (q) => <StatusBadge status={q.status} /> },
    {
      key: "actions", header: "", className: "text-right",
      render: (q) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" onClick={() => (window.location.href = `/quotations/${q.id}`)} title="Buka">
            <FileText className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(q)} title="Hapus">
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      ),
    },
  ];

  function updateItem(idx: number, key: keyof ItemRow, value: string) {
    const next = [...items];
    next[idx] = { ...next[idx], [key]: value };
    setItems(next);
  }

  async function handleCreate() {
    if (!clientId || !subject) {
      toast({ title: "Client dan subjek wajib diisi", variant: "error" });
      return;
    }
    setSaving(true);
    const res = await fetch("/api/quotations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId, subject, quotationDate, validUntil,
        discount: Number(discount), taxPercent: Number(taxPercent), terms,
        items: items.filter((i) => i.name && Number(i.unitPrice) >= 0),
      }),
    });
    setSaving(false);
    if (res.ok) {
      const q = await res.json();
      toast({ title: `Quotation ${q.number} dibuat`, variant: "success" });
      setModalOpen(false);
      resetForm();
      setRefreshKey((k) => k + 1);
      router.push(`/quotations/${q.id}`);
    } else {
      const d = await res.json().catch(() => ({}));
      toast({ title: "Gagal membuat quotation", description: d.error, variant: "error" });
    }
  }

  function resetForm() {
    setClientId(""); setSubject(""); setQuotationDate(toInputDate(new Date()));
    setValidUntil(""); setDiscount("0"); setTaxPercent("0"); setTerms("");
    setItems([{ name: "", description: "", qty: "1", unitPrice: "", discount: "0" }]);
  }

  return (
    <div>
      <PageHeader title="Quotations" description="Penawaran harga untuk calon project">
        <Button onClick={() => setModalOpen(true)}><Plus /> Quotation Baru</Button>
      </PageHeader>

      <div className="mb-3">
        <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Semua status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua status</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns} fetchUrl="/api/quotations" searchPlaceholder="Cari nomor / subjek..."
        refreshKey={refreshKey} extraQuery={{ status: statusFilter }}
        onRowClick={(q) => router.push(`/quotations/${q.id}`)}
        emptyTitle="Belum ada quotation"
      />

      {/* Create modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Quotation Baru</DialogTitle>
            <DialogDescription>Nomor otomatis: QUO-YYYY-NNNN</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Client *</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger><SelectValue placeholder="Pilih client" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Subjek *</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Pembuatan Website Company Profile" />
            </div>
            <div className="space-y-1.5">
              <Label>Tanggal</Label>
              <Input type="date" value={quotationDate} onChange={(e) => setQuotationDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Berlaku sampai</Label>
              <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Items</Label>
            {items.map((it, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2">
                <Input className="col-span-4" placeholder="Nama item" value={it.name} onChange={(e) => updateItem(idx, "name", e.target.value)} />
                <Input className="col-span-3" placeholder="Keterangan" value={it.description} onChange={(e) => updateItem(idx, "description", e.target.value)} />
                <Input className="col-span-1" type="number" placeholder="Qty" value={it.qty} onChange={(e) => updateItem(idx, "qty", e.target.value)} />
                <Input className="col-span-2" type="number" placeholder="Harga" value={it.unitPrice} onChange={(e) => updateItem(idx, "unitPrice", e.target.value)} />
                <Input className="col-span-1" type="number" placeholder="Disc" value={it.discount} onChange={(e) => updateItem(idx, "discount", e.target.value)} />
                <Button type="button" variant="ghost" size="icon" className="col-span-1"
                  onClick={() => setItems(items.filter((_, i) => i !== idx))}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm"
              onClick={() => setItems([...items, { name: "", description: "", qty: "1", unitPrice: "", discount: "0" }])}>
              <Plus /> Tambah Baris
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Terms &amp; Conditions</Label>
              <Textarea rows={3} value={terms} onChange={(e) => setTerms(e.target.value)}
                placeholder={"1. DP 50%\n2. Revisi maksimal 2x\n3. Delivery 14 hari kerja"} />
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>Diskon (Rp)</Label>
                  <Input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Pajak (%)</Label>
                  <Input type="number" value={taxPercent} onChange={(e) => setTaxPercent(e.target.value)} />
                </div>
              </div>
              <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
                <div className="flex justify-between"><span>Subtotal</span><span>{formatIDR(subtotal)}</span></div>
                <div className="flex justify-between"><span>Diskon</span><span>-{formatIDR(discount)}</span></div>
                <div className="flex justify-between"><span>Pajak</span><span>{formatIDR(taxAmount)}</span></div>
                <div className="flex justify-between border-t pt-1 font-bold"><span>Total</span><span>{formatIDR(grandTotal)}</span></div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Batal</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? "Menyimpan..." : "Buat Quotation"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={`Hapus quotation ${deleteTarget?.number}?`}
        onConfirm={async () => {
          if (!deleteTarget) return;
          const res = await fetch(`/api/quotations/${deleteTarget.id}`, { method: "DELETE" });
          if (res.ok) { toast({ title: "Quotation dihapus", variant: "success" }); setRefreshKey((k) => k + 1); }
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
