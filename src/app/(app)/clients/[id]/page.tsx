"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Building2, Mail, Phone, Globe, MapPin, FileText, Receipt, FolderKanban } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge, LoadingSpinner, PageHeader } from "@/components/shared";
import { Progress } from "@/components/ui/progress";
import { formatIDR, formatDateShort } from "@/lib/format";

type ClientDetail = {
  id: string; code: string; companyName: string; contactPerson: string;
  email: string | null; phone: string | null; whatsapp: string | null;
  address: string | null; npwp: string | null; website: string | null;
  notes: string | null; isActive: boolean; createdAt: string;
  projects: {
    id: string; code: string; name: string; status: string; progress: number;
    totalValue: string; targetCompletionDate: string | null;
  }[];
  invoices: { id: string; number: string; total: string; amountPaid: string; status: string; invoiceDate: string }[];
  documents: { id: string; name: string; category: string; version: number; fileSize: number; createdAt: string }[];
  stats: {
    totalProjects: number; totalProjectValue: number; totalInvoiced: number;
    totalPaid: number; outstanding: number;
  };
};

export default function ClientDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [client, setClient] = React.useState<ClientDetail | null>(null);

  React.useEffect(() => {
    fetch(`/api/clients/${id}`).then((r) => r.json()).then(setClient).catch(() => {});
  }, [id]);

  if (!client) return <LoadingSpinner />;
  if (!client.id) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">Client tidak ditemukan</p>
        <Button asChild variant="outline" className="mt-3">
          <Link href="/clients">Kembali ke Clients</Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 no-print">
        <Link href="/clients" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Link>
      </div>

      <PageHeader
        title={client.companyName}
        description={`${client.code} · Contact: ${client.contactPerson}`}
      >
        <StatusBadge status={client.isActive ? "APPROVED" : "DRAFT"} className={client.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"} />
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <MiniStat label="Total Project" value={String(client.stats.totalProjects)} />
        <MiniStat label="Nilai Project" value={formatIDR(client.stats.totalProjectValue)} />
        <MiniStat label="Total Invoice" value={formatIDR(client.stats.totalInvoiced)} />
        <MiniStat label="Dibayar" value={formatIDR(client.stats.totalPaid)} accent="text-emerald-600" />
        <MiniStat label="Outstanding" value={formatIDR(client.stats.outstanding)} accent="text-amber-600" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {/* Info card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4 text-muted-foreground" /> Informasi Client
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {client.email && (
              <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /> {client.email}</p>
            )}
            {client.phone && (
              <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> {client.phone}</p>
            )}
            {client.whatsapp && (
              <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> WA: {client.whatsapp}</p>
            )}
            {client.address && (
              <p className="flex items-start gap-2"><MapPin className="h-4 w-4 text-muted-foreground mt-0.5" /> {client.address}</p>
            )}
            {client.website && (
              <p className="flex items-center gap-2"><Globe className="h-4 w-4 text-muted-foreground" /> {client.website}</p>
            )}
            {client.npwp && <p className="text-xs text-muted-foreground">NPWP: {client.npwp}</p>}
            {client.notes && <p className="border-t pt-2 text-xs text-muted-foreground">{client.notes}</p>}
          </CardContent>
        </Card>

        {/* Tabs */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="projects">
            <TabsList>
              <TabsTrigger value="projects">Project</TabsTrigger>
              <TabsTrigger value="invoices">Invoice</TabsTrigger>
              <TabsTrigger value="documents">Dokumen</TabsTrigger>
            </TabsList>

            <TabsContent value="projects" className="space-y-2">
              {client.projects.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Belum ada project</p>}
              {client.projects.map((p) => (
                <Link key={p.id} href={`/projects/${p.id}`} className="block rounded-lg border p-3 hover:bg-accent/50">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.code}</p>
                    </div>
                    <div className="text-right">
                      <StatusBadge status={p.status} />
                      <p className="mt-1 text-xs font-medium">{formatIDR(p.totalValue)}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Progress value={p.progress} className="h-1.5" />
                    <span className="text-xs text-muted-foreground">{p.progress}%</span>
                  </div>
                </Link>
              ))}
            </TabsContent>

            <TabsContent value="invoices" className="space-y-2">
              {client.invoices.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Belum ada invoice</p>}
              {client.invoices.map((inv) => (
                <Link key={inv.id} href={`/invoices/${inv.id}`} className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent/50">
                  <div>
                    <p className="text-sm font-medium">{inv.number}</p>
                    <p className="text-xs text-muted-foreground">{formatDateShort(inv.invoiceDate)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatIDR(inv.total)}</p>
                    <StatusBadge status={inv.status} />
                  </div>
                </Link>
              ))}
            </TabsContent>

            <TabsContent value="documents">
              {client.documents.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Belum ada dokumen</p>}
              <div className="space-y-2">
                {client.documents.map((d) => (
                  <a
                    key={d.id}
                    href={`/api/documents/${d.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent/50"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{d.name}</p>
                        <p className="text-xs text-muted-foreground">{d.category} · v{d.version}</p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">{formatDateShort(d.createdAt)}</span>
                  </a>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`mt-1 text-lg font-bold ${accent ?? ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
