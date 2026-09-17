"use client";

import * as React from "react";
import Link from "next/link";
import { Download, ExternalLink, Trash2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, ConfirmDialog } from "@/components/shared";
import { DataTable, type Column } from "@/components/DataTable";
import { toast } from "@/components/ui/toaster";
import { formatDateShort, formatFileSize } from "@/lib/format";

type Document = {
  id: string; name: string; category: string; version: number; fileSize: number;
  createdAt: string; project: { id: string; name: string; code: string };
  client: { companyName: string } | null;
};

const CATEGORIES = ["PROPOSAL", "QUOTATION", "CONTRACT", "AGREEMENT", "REQUIREMENT", "DESIGN", "TECHNICAL", "REPORT", "INVOICE", "RECEIPT", "FINAL", "OTHER"];

export default function DocumentsPage() {
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [categoryFilter, setCategoryFilter] = React.useState("");
  const [deleteTarget, setDeleteTarget] = React.useState<Document | null>(null);

  const columns: Column<Document>[] = [
    {
      key: "name", header: "Dokumen",
      render: (d) => (
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="font-medium">{d.name}</p>
            <p className="text-xs text-muted-foreground">{d.category} · v{d.version}</p>
          </div>
        </div>
      ),
    },
    {
      key: "project", header: "Project",
      render: (d) => (
        <Link href={`/projects/${d.project?.id}?tab=documents`} className="text-sm hover:underline">
          {d.project?.name}
        </Link>
      ),
    },
    { key: "client", header: "Client", render: (d) => d.client?.companyName ?? "-" },
    { key: "size", header: "Ukuran", render: (d) => formatFileSize(d.fileSize) },
    { key: "date", header: "Diupload", render: (d) => formatDateShort(d.createdAt) },
    {
      key: "actions", header: "", className: "text-right",
      render: (d) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button asChild variant="ghost" size="icon" title="Lihat">
            <a href={`/api/documents/${d.id}`} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a>
          </Button>
          <Button asChild variant="ghost" size="icon" title="Unduh">
            <a href={`/api/documents/${d.id}?download=1`}><Download className="h-4 w-4" /></a>
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(d)} title="Hapus">
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Documents" description="Semua dokumen project" />

      <div className="mb-3">
        <Select value={categoryFilter || "all"} onValueChange={(v) => setCategoryFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Semua kategori" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua kategori</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns} fetchUrl="/api/documents" searchPlaceholder="Cari nama dokumen..."
        refreshKey={refreshKey} extraQuery={{ category: categoryFilter }}
        emptyTitle="Belum ada dokumen"
        emptyDescription="Upload dokumen dari halaman detail project"
      />

      <ConfirmDialog
        open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={`Hapus dokumen "${deleteTarget?.name}"?`}
        onConfirm={async () => {
          if (!deleteTarget) return;
          const res = await fetch(`/api/documents/${deleteTarget.id}`, { method: "DELETE" });
          if (res.ok) { toast({ title: "Dokumen dihapus", variant: "success" }); setRefreshKey((k) => k + 1); }
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
