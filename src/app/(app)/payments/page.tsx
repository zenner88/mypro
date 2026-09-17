"use client";

import * as React from "react";
import Link from "next/link";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, StatusBadge, LoadingSpinner } from "@/components/shared";
import { DataTable, type Column } from "@/components/DataTable";
import { toast } from "@/components/ui/toaster";
import { formatIDR, formatDateShort } from "@/lib/format";

type Payment = {
  id: string; projectId: string; terminNumber: number; description: string | null;
  amount: string; amountPaid: string; dueDate: string | null; paidDate: string | null;
  status: string; paymentMethod: string | null;
  project: { name: string; code: string };
  client: { companyName: string };
};

type Receipt = {
  id: string; number: string; amount: string; paymentMethod: string; paidDate: string;
  payment: { terminNumber: number; project: { name: string; code: string }; client: { companyName: string } };
};

export default function PaymentsPage() {
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [statusFilter, setStatusFilter] = React.useState("");
  const [payModal, setPayModal] = React.useState<Payment | null>(null);
  const [amount, setAmount] = React.useState("");
  const [method, setMethod] = React.useState("BANK_TRANSFER");
  const [reference, setReference] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [lastReceipt, setLastReceipt] = React.useState<Receipt | null>(null);

  const columns: Column<Payment>[] = [
    {
      key: "termin", header: "Termin",
      render: (p) => (
        <div>
          <p className="font-medium">Termin {p.terminNumber} — {p.project?.name}</p>
          <p className="text-xs text-muted-foreground">{p.project?.code} · {p.description}</p>
        </div>
      ),
    },
    { key: "client", header: "Client", render: (p) => p.client?.companyName ?? "-" },
    {
      key: "amount", header: "Jumlah",
      render: (p) => (
        <div>
          <p className="font-medium">{formatIDR(p.amount)}</p>
          {Number(p.amountPaid) > 0 && (
            <p className="text-xs text-emerald-600">Dibayar {formatIDR(p.amountPaid)}</p>
          )}
        </div>
      ),
    },
    { key: "due", header: "Jatuh Tempo", render: (p) => formatDateShort(p.dueDate) },
    { key: "status", header: "Status", render: (p) => <StatusBadge status={p.status} /> },
    {
      key: "actions", header: "", className: "text-right",
      render: (p) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {p.status !== "PAID" && p.status !== "CANCELLED" && (
            <Button size="sm" variant="outline" onClick={() => {
              setPayModal(p);
              setAmount(String(Number(p.amount) - Number(p.amountPaid)));
            }}>
              <Wallet className="h-3.5 w-3.5" /> Bayar
            </Button>
          )}
          {Number(p.amountPaid) > 0 && (
            <Button size="sm" variant="ghost" onClick={() => printReceipt(p)}>
              <Wallet className="h-3.5 w-3.5" /> Receipt
            </Button>
          )}
        </div>
      ),
    },
  ];

  async function printReceipt(payment: Payment) {
    // Fetch latest receipt for this payment
    const res = await fetch(`/api/receipts?projectId=${payment.projectId}&limit=1`);
    const d = await res.json();
    const receipt = (d.items ?? []).find((r: Receipt) => r.payment.terminNumber === payment.terminNumber);
    if (receipt) {
      setLastReceipt(receipt);
      setTimeout(() => window.print(), 150);
    } else {
      toast({ title: "Receipt tidak ditemukan", variant: "error" });
    }
  }

  async function recordPayment() {
    if (!payModal) return;
    setSaving(true);
    const res = await fetch("/api/receipts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId: payModal.id, amount: Number(amount), paymentMethod: method, referenceNumber: reference || undefined }),
    });
    setSaving(false);
    if (res.ok) {
      const receipt = await res.json();
      toast({ title: `Pembayaran dicatat — Receipt ${receipt.number}`, variant: "success" });
      setPayModal(null);
      setRefreshKey((k) => k + 1);
    } else {
      const d = await res.json().catch(() => ({}));
      toast({ title: "Gagal", description: d.error, variant: "error" });
    }
  }

  return (
    <div>
      <PageHeader title="Payments" description="Semua termin pembayaran project" />

      <div className="mb-3">
        <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Semua status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua status</SelectItem>
            {["PENDING", "DUE", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED"].map((s) => (
              <SelectItem key={s} value={s}>{s.replaceAll("_", " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns} fetchUrl="/api/payments" searchPlaceholder="Cari project..."
        refreshKey={refreshKey} extraQuery={{ status: statusFilter }}
        emptyTitle="Belum ada termin pembayaran"
      />

      {/* Record payment modal */}
      <Dialog open={!!payModal} onOpenChange={(o) => !o && setPayModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Catat Pembayaran — Termin {payModal?.terminNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Jumlah (Rp)</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                Sisa: {payModal ? formatIDR(Number(payModal.amount) - Number(payModal.amountPaid)) : "-"}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Metode</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                  <SelectItem value="EWALLET">E-Wallet</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>No. Referensi (opsional)</Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayModal(null)}>Batal</Button>
            <Button onClick={recordPayment} disabled={saving}>{saving ? "Menyimpan..." : "Simpan"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt print area */}
      {lastReceipt && (
        <div className="print-area fixed inset-0 z-[90] bg-white p-10">
          <button className="absolute right-6 top-6 no-print" onClick={() => setLastReceipt(null)}>
            <span className="text-sm text-muted-foreground">✕ tutup</span>
          </button>
          <div className="mx-auto max-w-[180mm] text-slate-900">
            <div className="border-b-2 border-slate-900 pb-4 text-center">
              <p className="text-2xl font-bold tracking-[0.3em]">RECEIPT</p>
              <p className="mt-1 font-semibold">{lastReceipt.number}</p>
            </div>
            <div className="mt-6 space-y-3 text-sm">
              <div className="flex justify-between border-b pb-2">
                <span className="text-slate-500">Received From</span>
                <span className="font-semibold">{lastReceipt.payment.client.companyName}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-slate-500">For</span>
                <span className="font-semibold">
                  {lastReceipt.payment.project.name} — Termin {lastReceipt.payment.terminNumber}
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-slate-500">Jumlah</span>
                <span className="text-xl font-bold">{formatIDR(lastReceipt.amount)}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-slate-500">Metode Pembayaran</span>
                <span className="font-semibold">{lastReceipt.paymentMethod.replaceAll("_", " ")}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-slate-500">Tanggal</span>
                <span className="font-semibold">{formatDateShort(lastReceipt.paidDate)}</span>
              </div>
            </div>
            <div className="mt-10 text-center text-sm text-slate-600">
              <p>Terima kasih telah melakukan pembayaran.</p>
              <p className="mt-6">_______________</p>
              <p className="text-xs">Tanda tangan &amp; stempel</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
