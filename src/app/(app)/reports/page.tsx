"use client";

import * as React from "react";
import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, StatusBadge, LoadingSpinner } from "@/components/shared";
import { formatIDR, formatDateShort } from "@/lib/format";

type ReportPayload = {
  type: string;
  summary?: {
    totalProjects: number; totalProjectValue: number; totalInvoices: number;
    totalInvoiced: number; totalPaid: number; outstanding: number;
    overdueCount: number; overdueAmount: number;
  };
  byStatus?: { status: string; count: number }[];
  overdueInvoices?: { number: string; client: string; due: string | null; outstanding: number }[];
  rows?: Record<string, unknown>[];
};

const REPORT_TYPES = [
  { value: "financial", label: "Ringkasan Keuangan" },
  { value: "project", label: "Laporan Project" },
  { value: "payment", label: "Laporan Pembayaran" },
  { value: "invoice", label: "Laporan Invoice" },
];

export default function ReportsPage() {
  const [type, setType] = React.useState("financial");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [data, setData] = React.useState<ReportPayload | null>(null);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ type });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (status) params.set("status", status);
    fetch(`/api/reports?${params}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [type, from, to, status]);

  React.useEffect(load, [load]);

  function exportCsv() {
    const params = new URLSearchParams({ type, format: "csv" });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (status) params.set("status", status);
    window.location.href = `/api/reports?${params}`;
  }

  const columns = data?.rows && data.rows.length > 0 ? Object.keys(data.rows[0]) : [];

  function renderCell(key: string, value: unknown) {
    if (value === null || value === undefined) return "-";
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) return formatDateShort(value);
    if (key === "status") return <StatusBadge status={String(value)} />;
    if (["value", "amount", "amountPaid", "total", "paid", "outstanding"].includes(key)) {
      return formatIDR(Number(value));
    }
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  }

  return (
    <div>
      <PageHeader title="Reports" description="Laporan project & keuangan">
        <Button variant="outline" onClick={exportCsv}><Download /> Export CSV</Button>
        <Button variant="outline" onClick={() => window.print()}><Printer /> Print</Button>
      </PageHeader>

      {/* Filters */}
      <Card className="mb-4 no-print">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="space-y-1.5">
            <Label>Jenis Laporan</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                {REPORT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Dari</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-1.5">
            <Label>Sampai</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Semua" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem>
                {["DRAFT", "PROPOSAL", "NEGOTIATION", "APPROVED", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED", "PENDING", "PAID", "OVERDUE", "SENT", "PARTIALLY_PAID"].map((s) => (
                  <SelectItem key={s} value={s}>{s.replaceAll("_", " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="print-area space-y-4">
          {/* Financial summary */}
          {data?.type === "financial" && data.summary && (
            <>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <SummaryCard label="Total Project" value={String(data.summary.totalProjects)} />
                <SummaryCard label="Nilai Project" value={formatIDR(data.summary.totalProjectValue)} />
                <SummaryCard label="Total Invoiced" value={formatIDR(data.summary.totalInvoiced)} />
                <SummaryCard label="Diterima" value={formatIDR(data.summary.totalPaid)} accent="text-emerald-600" />
                <SummaryCard label="Outstanding" value={formatIDR(data.summary.outstanding)} accent="text-amber-600" />
                <SummaryCard label="Invoice Overdue" value={String(data.summary.overdueCount)} accent="text-red-600" />
                <SummaryCard label="Nilai Overdue" value={formatIDR(data.summary.overdueAmount)} accent="text-red-600" />
              </div>

              {data.byStatus && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">Project per Status</CardTitle></CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    {data.byStatus.map((s) => (
                      <span key={s.status} className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm">
                        <StatusBadge status={s.status} /> <span className="font-semibold">{s.count}</span>
                      </span>
                    ))}
                  </CardContent>
                </Card>
              )}

              {data.overdueInvoices && data.overdueInvoices.length > 0 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base text-red-600">Invoice Overdue</CardTitle></CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nomor</TableHead><TableHead>Client</TableHead>
                          <TableHead>Jatuh Tempo</TableHead><TableHead className="text-right">Outstanding</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.overdueInvoices.map((i) => (
                          <TableRow key={i.number}>
                            <TableCell className="font-medium">{i.number}</TableCell>
                            <TableCell>{i.client}</TableCell>
                            <TableCell>{formatDateShort(i.due)}</TableCell>
                            <TableCell className="text-right text-red-600 font-medium">{formatIDR(i.outstanding)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* Table reports */}
          {data?.rows && (
            <Card>
              <CardContent className="p-0">
                {data.rows.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">Tidak ada data untuk filter ini</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        {columns.map((c) => (
                          <TableHead key={c} className="capitalize">{c.replaceAll(/([A-Z])/g, " $1").replaceAll("_", " ")}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.rows.map((row, idx) => (
                        <TableRow key={idx}>
                          {columns.map((c) => (
                            <TableCell key={c}>{renderCell(c, row[c])}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`mt-1 text-lg font-bold ${accent ?? ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
