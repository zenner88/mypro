"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Printer, CheckCircle2, XCircle, FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge, LoadingSpinner } from "@/components/shared";
import { toast } from "@/components/ui/toaster";
import { formatIDR, formatDateID, formatDateShort } from "@/lib/format";

type QItem = { id: string; name: string; description: string | null; qty: string; unitPrice: string; discount: string };
type Quotation = {
  id: string; number: string; subject: string; subtotal: string; discount: string;
  taxPercent: string; taxAmount: string; total: string; status: string;
  quotationDate: string; validUntil: string | null; terms: string | null; notes: string | null;
  convertedToProjectId: string | null;
  client: { companyName: string; contactPerson: string; address: string | null; email: string | null; phone: string | null };
  items: QItem[];
  project: { id: string; name: string; code: string } | null;
  settings: Record<string, string>;
};

export default function QuotationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [quotation, setQuotation] = React.useState<Quotation | null>(null);
  const [converting, setConverting] = React.useState(false);
  const s = quotation?.settings ?? {};

  function load() {
    fetch(`/api/quotations/${id}`).then((r) => r.json()).then(setQuotation).catch(() => {});
  }
  React.useEffect(load, [id]);

  if (!quotation) return <LoadingSpinner />;
  if (!quotation.id) {
    return <div className="py-16 text-center text-muted-foreground">Quotation tidak ditemukan</div>;
  }

  async function updateStatus(status: string) {
    const res = await fetch(`/api/quotations/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
    });
    if (res.ok) { toast({ title: "Status diperbarui", variant: "success" }); load(); }
  }

  async function convertToProject() {
    setConverting(true);
    const res = await fetch(`/api/quotations/${id}/convert`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
    });
    setConverting(false);
    if (res.ok) {
      const project = await res.json();
      toast({ title: `Project ${project.code} dibuat dari quotation`, variant: "success" });
      router.push(`/projects/${project.id}`);
    } else {
      const d = await res.json().catch(() => ({}));
      toast({ title: "Gagal konversi", description: d.error, variant: "error" });
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between no-print">
        <Link href="/quotations" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={quotation.status} onValueChange={updateStatus}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["DRAFT", "SENT", "APPROVED", "REJECTED", "EXPIRED"].map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => window.print()}><Printer /> Print / PDF</Button>
          {!quotation.convertedToProjectId && (
            <Button onClick={convertToProject} disabled={converting}>
              <FolderPlus /> {converting ? "Mengonversi..." : "Convert to Project"}
            </Button>
          )}
          {quotation.convertedToProjectId && (
            <Button asChild variant="secondary">
              <Link href={`/projects/${quotation.convertedToProjectId}`}>Lihat Project</Link>
            </Button>
          )}
        </div>
      </div>

      {/* Printable A4 */}
      <div className="print-area mx-auto max-w-[210mm] border bg-white p-10 text-slate-900 shadow-sm">
        {/* Header */}
        <div className="flex items-start justify-between border-b-2 border-slate-900 pb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {s.business_name || "(Atur nama bisnis Anda di menu Settings)"}
            </h1>
            {s.business_address && <p className="mt-1 max-w-xs text-sm text-slate-600">{s.business_address}</p>}
            <div className="mt-1 space-y-0.5 text-sm text-slate-600">
              {s.business_email && <p>{s.business_email}</p>}
              {s.business_phone && <p>{s.business_phone}</p>}
              {s.business_website && <p>{s.business_website}</p>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold tracking-[0.3em] text-slate-400">QUOTATION</p>
            <p className="mt-1 text-lg font-bold">{quotation.number}</p>
          </div>
        </div>

        {/* Info */}
        <div className="mt-6 flex justify-between gap-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Kepada</p>
            <p className="mt-1 font-semibold">{quotation.client.companyName}</p>
            <p className="text-sm text-slate-600">attn. {quotation.client.contactPerson}</p>
            {quotation.client.address && <p className="text-sm text-slate-600">{quotation.client.address}</p>}
            {quotation.client.email && <p className="text-sm text-slate-600">{quotation.client.email}</p>}
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex gap-6">
              <span className="text-slate-500">Tanggal</span>
              <span className="font-medium">{formatDateID(quotation.quotationDate)}</span>
            </div>
            <div className="flex gap-6">
              <span className="text-slate-500">Berlaku s/d</span>
              <span className="font-medium">{formatDateID(quotation.validUntil)}</span>
            </div>
            <div className="flex gap-6">
              <span className="text-slate-500">Status</span>
              <StatusBadge status={quotation.status} />
            </div>
          </div>
        </div>

        {/* Subject */}
        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Subjek</p>
          <p className="mt-0.5 text-lg font-semibold">{quotation.subject}</p>
        </div>

        {/* Items */}
        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="border-y bg-slate-50 text-left">
              <th className="w-8 px-2 py-2">No</th>
              <th className="px-2 py-2">Deskripsi</th>
              <th className="px-2 py-2 text-right whitespace-nowrap">Qty</th>
              <th className="px-2 py-2 text-right whitespace-nowrap">Harga</th>
              <th className="px-2 py-2 text-right whitespace-nowrap">Jumlah</th>
            </tr>
          </thead>
          <tbody>
            {quotation.items.map((it, i) => (
              <tr key={it.id} className="border-b">
                <td className="px-2 py-2.5 text-slate-500">{i + 1}</td>
                <td className="px-2 py-2.5">
                  <p className="font-medium">{it.name}</p>
                  {it.description && <p className="text-xs text-slate-500">{it.description}</p>}
                </td>
                <td className="px-2 py-2.5 text-right whitespace-nowrap">{Number(it.qty)}</td>
                <td className="px-2 py-2.5 text-right whitespace-nowrap">{formatIDR(it.unitPrice)}</td>
                <td className="px-2 py-2.5 text-right font-medium whitespace-nowrap">
                  {formatIDR(Number(it.qty) * Number(it.unitPrice) - Number(it.discount))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="mt-4 flex justify-end">
          <div className="w-72 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span className="whitespace-nowrap">{formatIDR(quotation.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Diskon</span><span className="whitespace-nowrap">-{formatIDR(quotation.discount)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Pajak ({Number(quotation.taxPercent)}%)</span><span className="whitespace-nowrap">{formatIDR(quotation.taxAmount)}</span></div>
            <div className="flex justify-between border-t-2 border-slate-900 pt-2 text-base font-bold">
              <span>TOTAL</span><span className="whitespace-nowrap">{formatIDR(quotation.total)}</span>
            </div>
          </div>
        </div>

        {/* Terms */}
        {quotation.terms && (
          <div className="mt-8 border-t pt-4 text-sm">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Syarat &amp; Ketentuan</p>
            <p className="whitespace-pre-wrap text-slate-700">{quotation.terms}</p>
          </div>
        )}

        <div className="mt-10 border-t pt-4 text-center text-xs text-slate-500">
          Quotation ini berlaku sampai {formatDateID(quotation.validUntil)}. Terima kasih atas kepercayaan Anda.
        </div>
      </div>
    </div>
  );
}
