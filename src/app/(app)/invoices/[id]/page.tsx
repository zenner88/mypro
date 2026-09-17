"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Printer, Copy, CheckCircle2, Ban, Send, Wallet, Plus, Trash2, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge, LoadingSpinner } from "@/components/shared";
import { toast } from "@/components/ui/toaster";
import { formatIDR, formatDateID, toInputDate } from "@/lib/format";

type IItem = { id: string; name: string; description: string | null; qty: string; unitPrice: string; discount: string };
type Invoice = {
  id: string; number: string; invoiceDate: string; dueDate: string | null; currency: string;
  description: string | null; subtotal: string; discount: string; taxPercent: string;
  taxAmount: string; total: string; amountPaid: string; status: string;
  notes: string | null; paymentInstructions: string | null;
  client: {
    companyName: string; contactPerson: string; address: string | null;
    email: string | null; phone: string | null;
  };
  project: { id: string; name: string; code: string } | null;
  payment: { id: string; terminNumber: number } | null;
  items: IItem[];
  settings: Record<string, string>;
};

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [invoice, setInvoice] = React.useState<Invoice | null>(null);
  const [payModal, setPayModal] = React.useState(false);
  const [payAmount, setPayAmount] = React.useState("");
  const [payMethod, setPayMethod] = React.useState("BANK_TRANSFER");
  const [saving, setSaving] = React.useState(false);

  function load() {
    fetch(`/api/invoices/${id}`).then((r) => r.json()).then(setInvoice).catch(() => {});
  }
  React.useEffect(load, [id]);

  if (!invoice) return <LoadingSpinner />;
  if (!invoice.id) {
    return <div className="py-16 text-center text-muted-foreground">Invoice tidak ditemukan</div>;
  }

  const outstanding = Number(invoice.total) - Number(invoice.amountPaid);

  async function action(body: Record<string, unknown>, successMsg: string) {
    setSaving(true);
    const res = await fetch(`/api/invoices/${id}/actions`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    setSaving(false);
    if (res.ok) {
      toast({ title: successMsg, variant: "success" });
      load();
      return true;
    }
    const d = await res.json().catch(() => ({}));
    toast({ title: "Gagal", description: d.error, variant: "error" });
    return false;
  }

  async function saveEdit(body: Record<string, unknown>) {
    const res = await fetch(`/api/invoices/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (res.ok) { toast({ title: "Invoice diperbarui", variant: "success" }); load(); }
    else {
      const d = await res.json().catch(() => ({}));
      toast({ title: "Gagal", description: d.error, variant: "error" });
    }
  }

  const s = invoice.settings ?? {};
  const paidPct = Number(invoice.total) > 0 ? Math.round((Number(invoice.amountPaid) / Number(invoice.total)) * 100) : 0;

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 no-print">
        <Link href="/invoices" className="mb-3 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Kembali ke Invoices
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={invoice.status} />
          <span className="text-sm text-muted-foreground">
            {formatIDR(invoice.amountPaid)} / {formatIDR(invoice.total)} dibayar ({paidPct}%)
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => window.print()}><Printer /> Print / PDF</Button>
            <Button variant="outline" onClick={() => action({ action: "duplicate" }, "Invoice diduplikasi")}>
              <Copy /> Duplicate
            </Button>
            {invoice.status === "DRAFT" && (
              <Button variant="outline" onClick={() => action({ action: "mark-sent" }, "Invoice ditandai terkirim")}>
                <Send /> Mark Sent
              </Button>
            )}
            {outstanding > 0 && invoice.status !== "CANCELLED" && (
              <>
                <Button onClick={() => { setPayAmount(String(outstanding)); setPayModal(true); }}>
                  <Wallet /> Catat Pembayaran
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => action({ action: "mark-paid", paymentMethod: "BANK_TRANSFER" }, "Invoice lunas — receipt dibuat")}
                >
                  <CheckCircle2 /> Mark as Paid
                </Button>
              </>
            )}
            {invoice.status !== "CANCELLED" && Number(invoice.amountPaid) === 0 && (
              <Button variant="ghost" onClick={() => action({ action: "cancel" }, "Invoice dibatalkan")}>
                <Ban /> Cancel
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ===== A4 Invoice ===== */}
      <div className="print-area mx-auto max-w-[210mm] border bg-white p-12 text-slate-900 shadow-sm">
        {/* Header */}
        <div className="flex items-start justify-between border-b-2 border-slate-900 pb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{s.business_name || "Freelancer Studio"}</h1>
            {s.business_address && <p className="mt-1 max-w-xs text-sm text-slate-600">{s.business_address}</p>}
            <div className="mt-1 space-y-0.5 text-sm text-slate-600">
              {s.business_email && <p>{s.business_email}</p>}
              {s.business_phone && <p>{s.business_phone}</p>}
              {s.business_website && <p>{s.business_website}</p>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold tracking-[0.3em] text-slate-400">INVOICE</p>
            <p className="mt-1 text-xl font-bold">{invoice.number}</p>
            <div className="mt-3 space-y-0.5 text-sm">
              <p><span className="text-slate-500">Tanggal: </span><span className="font-medium">{formatDateID(invoice.invoiceDate)}</span></p>
              <p><span className="text-slate-500">Jatuh Tempo: </span><span className="font-medium">{formatDateID(invoice.dueDate)}</span></p>
            </div>
          </div>
        </div>

        {/* Bill to */}
        <div className="mt-6 flex justify-between gap-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bill To</p>
            <p className="mt-1 font-semibold">{invoice.client.companyName}</p>
            <p className="text-sm text-slate-600">attn. {invoice.client.contactPerson}</p>
            {invoice.client.address && <p className="max-w-xs text-sm text-slate-600">{invoice.client.address}</p>}
            {invoice.client.email && <p className="text-sm text-slate-600">{invoice.client.email}</p>}
            {invoice.client.phone && <p className="text-sm text-slate-600">{invoice.client.phone}</p>}
          </div>
          {invoice.project && (
            <div className="text-right">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Project</p>
              <p className="mt-1 font-semibold">{invoice.project.name}</p>
              <p className="text-sm text-slate-600">{invoice.project.code}</p>
            </div>
          )}
        </div>

        {/* Items */}
        <table className="mt-8 w-full text-sm">
          <thead>
            <tr className="border-y bg-slate-50 text-left">
              <th className="w-8 px-2 py-2.5">No</th>
              <th className="px-2 py-2.5">Deskripsi</th>
              <th className="px-2 py-2.5 text-right whitespace-nowrap">Qty</th>
              <th className="px-2 py-2.5 text-right whitespace-nowrap">Harga</th>
              <th className="px-2 py-2.5 text-right whitespace-nowrap">Jumlah</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((it, i) => (
              <tr key={it.id} className="border-b">
                <td className="px-2 py-3 text-slate-500">{i + 1}</td>
                <td className="px-2 py-3">
                  <p className="font-medium">{it.name}</p>
                  {it.description && <p className="text-xs text-slate-500">{it.description}</p>}
                </td>
                <td className="px-2 py-3 text-right whitespace-nowrap">{Number(it.qty)}</td>
                <td className="px-2 py-3 text-right whitespace-nowrap">{formatIDR(it.unitPrice)}</td>
                <td className="px-2 py-3 text-right font-medium whitespace-nowrap">
                  {formatIDR(Number(it.qty) * Number(it.unitPrice) - Number(it.discount))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="mt-4 flex justify-between gap-8">
          {/* Payment info */}
          <div className="flex-1 text-sm">
            {s.bank_name && (
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payment Information</p>
                <div className="mt-2 space-y-0.5">
                  <p><span className="text-slate-500">Bank: </span><span className="font-medium">{s.bank_name}</span></p>
                  <p><span className="text-slate-500">Atas Nama: </span><span className="font-medium">{s.bank_account_name}</span></p>
                  <p><span className="text-slate-500">No. Rekening: </span><span className="font-bold tracking-wide">{s.bank_account_number}</span></p>
                </div>
                {invoice.paymentInstructions && (
                  <p className="mt-2 text-xs text-slate-600">{invoice.paymentInstructions}</p>
                )}
              </div>
            )}
          </div>
          <div className="w-72 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span className="whitespace-nowrap">{formatIDR(invoice.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Diskon</span><span className="whitespace-nowrap">-{formatIDR(invoice.discount)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Pajak ({Number(invoice.taxPercent)}%)</span><span className="whitespace-nowrap">{formatIDR(invoice.taxAmount)}</span></div>
            <div className="flex justify-between border-t-2 border-slate-900 pt-2 text-lg font-bold">
              <span>TOTAL</span><span className="whitespace-nowrap">{formatIDR(invoice.total)}</span>
            </div>
            {Number(invoice.amountPaid) > 0 && (
              <>
                <div className="flex justify-between text-emerald-700"><span>Dibayar</span><span className="whitespace-nowrap">-{formatIDR(invoice.amountPaid)}</span></div>
                <div className="flex justify-between font-bold">
                  <span>Sisa</span><span className="whitespace-nowrap">{formatIDR(outstanding)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div className="mt-8 border-t pt-4 text-sm text-slate-600">
            <p className="whitespace-pre-wrap">{invoice.notes}</p>
          </div>
        )}

        <div className="mt-10 border-t pt-4 text-center text-sm font-medium text-slate-700">
          Thank you for your business.
        </div>
      </div>

      {/* Record payment modal */}
      <Dialog open={payModal} onOpenChange={(o) => !o && setPayModal(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Catat Pembayaran — {invoice.number}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Jumlah (Rp) — sisa {formatIDR(outstanding)}</Label>
              <Input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Metode</Label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                  <SelectItem value="EWALLET">E-Wallet</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayModal(false)}>Batal</Button>
            <Button
              disabled={saving}
              onClick={async () => {
                const ok = await action(
                  { action: "record-payment", amount: Number(payAmount), paymentMethod: payMethod },
                  "Pembayaran dicatat"
                );
                if (ok) setPayModal(false);
              }}
            >
              {saving ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
