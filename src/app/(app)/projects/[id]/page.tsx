"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft, Plus, Trash2, Pencil, Upload, Download, ExternalLink, Receipt, CalendarDays,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge, LoadingSpinner, ConfirmDialog, PageHeader } from "@/components/shared";
import { toast } from "@/components/ui/toaster";
import { formatIDR, formatDateShort, toInputDate } from "@/lib/format";

type Timeline = {
  id: string; title: string; description: string | null; startDate: string | null;
  endDate: string | null; status: string; progress: number; notes: string | null;
};
type Task = {
  id: string; name: string; description: string | null; startDate: string | null;
  dueDate: string | null; status: string; priority: string; progress: number;
};
type PItem = { id: string; name: string; description: string | null; qty: string; unitPrice: string; discount: string };
type Payment = {
  id: string; terminNumber: number; description: string | null; percentage: string;
  amount: string; amountPaid: string; dueDate: string | null; paidDate: string | null;
  status: string; paymentMethod: string | null;
};
type InvoiceRow = { id: string; number: string; total: string; amountPaid: string; status: string; invoiceDate: string };
type DocRow = { id: string; name: string; category: string; version: number; fileSize: number; fileName: string; createdAt: string };
type ActivityRow = { id: string; description: string; createdAt: string; user?: { name: string } };

type ProjectDetail = {
  id: string; code: string; name: string; description: string | null; projectType: string | null;
  status: string; priority: string; progress: number; startDate: string | null;
  targetCompletionDate: string | null; actualCompletionDate: string | null;
  totalValue: string; notes: string | null;
  client: { id: string; companyName: string; code: string };
  timelines: Timeline[]; tasks: Task[]; items: PItem[]; payments: Payment[];
  invoices: InvoiceRow[]; documents: DocRow[]; activities: ActivityRow[];
  stats: {
    totalValue: number; totalPaid: number; outstanding: number; totalInvoiced: number;
    isOverdue: boolean; daysLeft: number | null; tasksDone: number; tasksTotal: number;
  };
};

const TABS = ["overview", "timeline", "tasks", "pricing", "payments", "invoices", "documents", "activity"];

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const [project, setProject] = React.useState<ProjectDetail | null>(null);
  const [tab, setTab] = React.useState(searchParams.get("tab") ?? "overview");

  // dialog states
  const [timelineModal, setTimelineModal] = React.useState(false);
  const [taskModal, setTaskModal] = React.useState(false);
  const [itemModal, setItemModal] = React.useState(false);
  const [paymentModal, setPaymentModal] = React.useState(false);
  const [recordPayModal, setRecordPayModal] = React.useState<Payment | null>(null);
  const [uploadModal, setUploadModal] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<{ type: string; id: string; label: string } | null>(null);

  function load() {
    fetch(`/api/projects/${id}`).then((r) => r.json()).then(setProject).catch(() => {});
  }
  React.useEffect(load, [id]);

  if (!project) return <LoadingSpinner />;
  if (!project.id) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">Project tidak ditemukan</p>
        <Button asChild variant="outline" className="mt-3"><Link href="/projects">Kembali</Link></Button>
      </div>
    );
  }

  const paidPct = project.stats.totalValue > 0
    ? Math.round((project.stats.totalPaid / project.stats.totalValue) * 100)
    : 0;

  return (
    <div>
      <div className="mb-4">
        <Link href="/projects" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Kembali ke Projects
        </Link>
      </div>

      <PageHeader
        title={project.name}
        description={`${project.code} · ${project.client.companyName}`}
      >
        <Select value={project.status} onValueChange={async (v) => {
          const res = await fetch(`/api/projects/${id}`, {
            method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: v }),
          });
          if (res.ok) { toast({ title: "Status diperbarui", variant: "success" }); load(); }
          else toast({ title: "Gagal memperbarui status", variant: "error" });
        }}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            {["DRAFT", "PROPOSAL", "NEGOTIATION", "APPROVED", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED"].map((s) => (
              <SelectItem key={s} value={s}>{s.replaceAll("_", " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PageHeader>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex w-full flex-wrap h-auto gap-1">
          {TABS.map((t) => (
            <TabsTrigger key={t} value={t} className="capitalize">{t}</TabsTrigger>
          ))}
        </TabsList>

        {/* ============ OVERVIEW ============ */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <MiniStat label="Nilai Project" value={formatIDR(project.stats.totalValue)} />
            <MiniStat label="Dibayar" value={formatIDR(project.stats.totalPaid)} accent="text-emerald-600" />
            <MiniStat label="Outstanding" value={formatIDR(project.stats.outstanding)} accent="text-amber-600" />
            <MiniStat
              label="Deadline"
              value={project.targetCompletionDate ? formatDateShort(project.targetCompletionDate) : "-"}
              accent={project.stats.isOverdue ? "text-red-600" : ""}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Detail</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Status"><StatusBadge status={project.status} /></Row>
                <Row label="Prioritas"><StatusBadge status={project.priority} /></Row>
                <Row label="Jenis">{project.projectType ?? "-"}</Row>
                <Row label="Mulai">{formatDateShort(project.startDate)}</Row>
                <Row label="Target Selesai">{formatDateShort(project.targetCompletionDate)}</Row>
                {project.actualCompletionDate && <Row label="Selesai">{formatDateShort(project.actualCompletionDate)}</Row>}
                <Row label="Task Selesai">{project.stats.tasksDone}/{project.stats.tasksTotal}</Row>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Progress</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-muted-foreground">Progress pengerjaan</span>
                    <span className="font-medium">{project.progress}%</span>
                  </div>
                  <Progress value={project.progress} />
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-muted-foreground">Pembayaran</span>
                    <span className="font-medium">{paidPct}%</span>
                  </div>
                  <Progress value={paidPct} indicatorClassName="bg-emerald-500" />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatIDR(project.stats.totalPaid)} dari {formatIDR(project.stats.totalValue)}
                  </p>
                </div>
                {project.description && (
                  <div className="border-t pt-3 text-sm">
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Deskripsi</p>
                    <p>{project.description}</p>
                  </div>
                )}
                {project.notes && (
                  <div className="border-t pt-3 text-sm">
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Catatan</p>
                    <p>{project.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ============ TIMELINE ============ */}
        <TabsContent value="timeline" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setTimelineModal(true)}><Plus /> Tambah Milestone</Button>
          </div>
          {project.timelines.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Belum ada timeline</p>
          ) : (
            <div className="relative ml-3 border-l-2 pl-6">
              {project.timelines.map((t) => (
                <div key={t.id} className="relative mb-6">
                  <span className="absolute -left-[31px] top-1 h-4 w-4 rounded-full border-2 border-primary bg-background" />
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{t.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDateShort(t.startDate)} — {formatDateShort(t.endDate)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={t.status} />
                          <Button variant="ghost" size="icon" className="h-7 w-7"
                            onClick={() => setDeleteTarget({ type: "timeline", id: t.id, label: t.title })}>
                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                          </Button>
                        </div>
                      </div>
                      {t.description && <p className="mt-1.5 text-sm text-muted-foreground">{t.description}</p>}
                      <div className="mt-2 flex items-center gap-2">
                        <Progress value={t.progress} className="h-1.5" />
                        <span className="text-xs text-muted-foreground">{t.progress}%</span>
                      </div>
                      <div className="mt-2 flex gap-2">
                        {t.status !== "IN_PROGRESS" && t.status !== "COMPLETED" && (
                          <Button size="sm" variant="outline" onClick={async () => {
                            await fetch(`/api/projects/${id}/timelines`, {
                              method: "PUT", headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ id: t.id, status: "IN_PROGRESS", progress: Math.max(t.progress, 10) }),
                            });
                            load();
                          }}>Mulai</Button>
                        )}
                        {t.status !== "COMPLETED" && (
                          <Button size="sm" variant="outline" onClick={async () => {
                            await fetch(`/api/projects/${id}/timelines`, {
                              method: "PUT", headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ id: t.id, status: "COMPLETED", progress: 100 }),
                            });
                            load();
                          }}>Selesaikan</Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ============ TASKS ============ */}
        <TabsContent value="tasks" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setTaskModal(true)}><Plus /> Tambah Task</Button>
          </div>
          {project.tasks.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Belum ada task</p>
          ) : (
            <div className="space-y-2">
              {project.tasks.map((t) => (
                <Card key={t.id}>
                  <CardContent className="flex flex-wrap items-center gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{t.name}</p>
                        <StatusBadge status={t.status} />
                        {["HIGH", "URGENT"].includes(t.priority) && <StatusBadge status={t.priority} />}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Due: {formatDateShort(t.dueDate)}
                      </p>
                    </div>
                    <div className="flex w-40 items-center gap-2">
                      <Progress value={t.progress} className="h-1.5" />
                      <span className="text-xs text-muted-foreground">{t.progress}%</span>
                    </div>
                    <div className="flex gap-1">
                      {t.status !== "DONE" && (
                        <Button size="sm" variant="outline" onClick={async () => {
                          await fetch(`/api/projects/${id}/tasks`, {
                            method: "PUT", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ id: t.id, status: "DONE", progress: 100 }),
                          });
                          load();
                        }}>✓</Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8"
                        onClick={() => setDeleteTarget({ type: "task", id: t.id, label: t.name })}>
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ============ PRICING ============ */}
        <TabsContent value="pricing" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setItemModal(true)}><Plus /> Tambah Item</Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="p-3 font-medium">Item</th>
                    <th className="p-3 font-medium text-right whitespace-nowrap">Qty</th>
                    <th className="p-3 font-medium text-right whitespace-nowrap">Harga</th>
                    <th className="p-3 font-medium text-right whitespace-nowrap">Diskon</th>
                    <th className="p-3 font-medium text-right whitespace-nowrap">Subtotal</th>
                    <th className="p-3" />
                  </tr>
                </thead>
                <tbody>
                  {project.items.length === 0 && (
                    <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Belum ada item — nilai project manual</td></tr>
                  )}
                  {project.items.map((it) => (
                    <tr key={it.id} className="border-b last:border-0">
                      <td className="p-3">{it.name}</td>
                      <td className="p-3 text-right whitespace-nowrap">{Number(it.qty)}</td>
                      <td className="p-3 text-right whitespace-nowrap">{formatIDR(it.unitPrice)}</td>
                      <td className="p-3 text-right whitespace-nowrap">{formatIDR(it.discount)}</td>
                      <td className="p-3 text-right font-medium whitespace-nowrap">
                        {formatIDR(Number(it.qty) * Number(it.unitPrice) - Number(it.discount))}
                      </td>
                      <td className="p-3 text-right">
                        <Button variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => setDeleteTarget({ type: "item", id: it.id, label: it.name })}>
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
          <div className="flex justify-end">
            <Card className="w-full max-w-xs">
              <CardContent className="p-4 space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Total Nilai Project</span><span className="font-bold">{formatIDR(project.stats.totalValue)}</span></div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ============ PAYMENTS ============ */}
        <TabsContent value="payments" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setPaymentModal(true)}><Plus /> Tambah Termin</Button>
          </div>
          <div className="space-y-2">
            {project.payments.length === 0 && (
              <p className="py-10 text-center text-sm text-muted-foreground">Belum ada termin pembayaran</p>
            )}
            {project.payments.map((pay) => {
              const pct = Number(pay.amount) > 0 ? Math.round((Number(pay.amountPaid) / Number(pay.amount)) * 100) : 0;
              return (
                <Card key={pay.id}>
                  <CardContent className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">Termin {pay.terminNumber}</p>
                          <StatusBadge status={pay.status} />
                        </div>
                        <p className="text-sm text-muted-foreground">{pay.description}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Jatuh tempo: {formatDateShort(pay.dueDate)}
                          {pay.paidDate && ` · Dibayar: ${formatDateShort(pay.paidDate)}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">{formatIDR(pay.amount)}</p>
                        <p className="text-xs text-muted-foreground">
                          Dibayar {formatIDR(pay.amountPaid)} ({Number(pay.percentage)}%)
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <Progress value={pct} className="h-1.5" indicatorClassName="bg-emerald-500" />
                      <span className="text-xs text-muted-foreground">{pct}%</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {pay.status !== "PAID" && pay.status !== "CANCELLED" && (
                        <Button size="sm" onClick={() => setRecordPayModal(pay)}>
                          <Receipt className="h-4 w-4" /> Catat Pembayaran
                        </Button>
                      )}
                      {Number(pay.amountPaid) === 0 && (
                        <Button size="sm" variant="outline" onClick={async () => {
                          const res = await fetch(`/api/invoices`, {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ clientId: project.client.id, projectId: id, paymentId: pay.id }),
                          });
                          if (res.ok) {
                            const inv = await res.json();
                            toast({ title: `Invoice ${inv.number} dibuat`, variant: "success" });
                            router.push(`/invoices/${inv.id}`);
                          } else {
                            const d = await res.json().catch(() => ({}));
                            toast({ title: "Gagal membuat invoice", description: d.error, variant: "error" });
                          }
                        }}>
                          <Receipt className="h-4 w-4" /> Buat Invoice
                        </Button>
                      )}
                      {Number(pay.amountPaid) === 0 && (
                        <Button size="sm" variant="ghost" onClick={() => setDeleteTarget({ type: "payment", id: pay.id, label: `Termin ${pay.terminNumber}` })}>
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ============ INVOICES ============ */}
        <TabsContent value="invoices" className="space-y-2">
          {project.invoices.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Belum ada invoice untuk project ini</p>
          ) : (
            project.invoices.map((inv) => (
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
            ))
          )}
        </TabsContent>

        {/* ============ DOCUMENTS ============ */}
        <TabsContent value="documents" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setUploadModal(true)}><Upload /> Upload Dokumen</Button>
          </div>
          {project.documents.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Belum ada dokumen</p>
          ) : (
            <div className="space-y-2">
              {project.documents.map((d) => (
                <Card key={d.id}>
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{d.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.category} · v{d.version} · {(d.fileSize / 1024 / 1024).toFixed(2)} MB · {formatDateShort(d.createdAt)}
                      </p>
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <a href={`/api/documents/${d.id}`} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /> Lihat</a>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <a href={`/api/documents/${d.id}?download=1`}><Download className="h-4 w-4" /> Unduh</a>
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8"
                      onClick={() => setDeleteTarget({ type: "document", id: d.id, label: d.name })}>
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ============ ACTIVITY ============ */}
        <TabsContent value="activity">
          <Card>
            <CardContent className="p-4">
              <ul className="space-y-3">
                {project.activities?.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Belum ada aktivitas</p>}
                {(project.activities ?? []).map((a) => (
                  <li key={a.id} className="flex items-start gap-3 text-sm border-b pb-3 last:border-0 last:pb-0">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <div>
                      <p>{a.description}</p>
                      <p className="text-xs text-muted-foreground">{formatDateShort(a.createdAt)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ===== Timeline modal ===== */}
      <FormDialog
        open={timelineModal} onClose={() => setTimelineModal(false)} title="Tambah Milestone"
        fields={[
          { name: "title", label: "Judul *", type: "text" },
          { name: "description", label: "Deskripsi", type: "textarea" },
          { name: "startDate", label: "Mulai", type: "date" },
          { name: "endDate", label: "Selesai", type: "date" },
        ]}
        onSubmit={async (v) => {
          const res = await fetch(`/api/projects/${id}/timelines`, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(v),
          });
          if (res.ok) { toast({ title: "Milestone ditambahkan", variant: "success" }); load(); return true; }
          return false;
        }}
      />

      {/* ===== Task modal ===== */}
      <FormDialog
        open={taskModal} onClose={() => setTaskModal(false)} title="Tambah Task"
        fields={[
          { name: "name", label: "Nama Task *", type: "text" },
          { name: "description", label: "Deskripsi", type: "textarea" },
          { name: "startDate", label: "Mulai", type: "date" },
          { name: "dueDate", label: "Due Date", type: "date" },
        ]}
        onSubmit={async (v) => {
          const res = await fetch(`/api/projects/${id}/tasks`, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(v),
          });
          if (res.ok) { toast({ title: "Task ditambahkan", variant: "success" }); load(); return true; }
          return false;
        }}
      />

      {/* ===== Pricing item modal ===== */}
      <FormDialog
        open={itemModal} onClose={() => setItemModal(false)} title="Tambah Item Harga"
        fields={[
          { name: "name", label: "Nama Item *", type: "text" },
          { name: "description", label: "Deskripsi", type: "text" },
          { name: "qty", label: "Qty", type: "number", default: "1" },
          { name: "unitPrice", label: "Harga Satuan (Rp)", type: "number" },
          { name: "discount", label: "Diskon (Rp)", type: "number", default: "0" },
        ]}
        onSubmit={async (v) => {
          const res = await fetch(`/api/projects/${id}/items`, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(v),
          });
          if (res.ok) { toast({ title: "Item ditambahkan", variant: "success" }); load(); return true; }
          return false;
        }}
      />

      {/* ===== Payment termin modal ===== */}
      <FormDialog
        open={paymentModal} onClose={() => setPaymentModal(false)} title="Tambah Termin Pembayaran"
        fields={[
          { name: "description", label: "Deskripsi", type: "text", placeholder: "DP / Development selesai / Final delivery" },
          { name: "percentage", label: "Persentase (%)", type: "number", placeholder: "30" },
          { name: "amount", label: "Jumlah (Rp) — kosongkan utk auto dari %", type: "number" },
          { name: "dueDate", label: "Jatuh Tempo", type: "date" },
        ]}
        onSubmit={async (v) => {
          const res = await fetch(`/api/projects/${id}/payments`, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(v),
          });
          if (res.ok) { toast({ title: "Termin ditambahkan", variant: "success" }); load(); return true; }
          return false;
        }}
      />

      {/* ===== Record payment modal ===== */}
      <RecordPaymentDialog
        payment={recordPayModal}
        onClose={() => setRecordPayModal(null)}
        onDone={() => { setRecordPayModal(null); load(); }}
        projectId={id}
      />

      {/* ===== Upload modal ===== */}
      <UploadDialog
        open={uploadModal} onClose={() => setUploadModal(false)}
        projectId={id}
        onDone={() => { setUploadModal(false); load(); }}
      />

      {/* ===== Delete confirm ===== */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={`Hapus "${deleteTarget?.label}"?`}
        onConfirm={async () => {
          if (!deleteTarget) return;
          const { type, id: targetId } = deleteTarget;
          let url = "";
          if (type === "timeline") url = `/api/projects/${id}/timelines?timelineId=${targetId}`;
          else if (type === "task") url = `/api/projects/${id}/tasks?taskId=${targetId}`;
          else if (type === "item") url = `/api/projects/${id}/items?itemId=${targetId}`;
          else if (type === "payment") url = `/api/projects/${id}/payments?paymentId=${targetId}`;
          else if (type === "document") url = `/api/documents/${targetId}`;
          const res = await fetch(url, { method: "DELETE" });
          if (res.ok) { toast({ title: "Dihapus", variant: "success" }); load(); }
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

/* ---------- helpers ---------- */

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
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

type Field = { name: string; label: string; type: string; placeholder?: string; default?: string };

function FormDialog({
  open, onClose, title, fields, onSubmit,
}: {
  open: boolean; onClose: () => void; title: string; fields: Field[];
  onSubmit: (values: Record<string, string>) => Promise<boolean>;
}) {
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      const init: Record<string, string> = {};
      for (const f of fields) init[f.name] = f.default ?? "";
      setValues(init);
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const ok = await onSubmit(values);
    setSaving(false);
    if (ok) onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          {fields.map((f) => (
            <div key={f.name} className="space-y-1.5">
              <Label>{f.label}</Label>
              {f.type === "textarea" ? (
                <Textarea rows={2} value={values[f.name] ?? ""} placeholder={f.placeholder}
                  onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} />
              ) : (
                <Input type={f.type} value={values[f.name] ?? ""} placeholder={f.placeholder}
                  onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} />
              )}
            </div>
          ))}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
            <Button type="submit" disabled={saving}>{saving ? "Menyimpan..." : "Simpan"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RecordPaymentDialog({
  payment, onClose, onDone, projectId,
}: {
  payment: Payment | null; onClose: () => void; onDone: () => void; projectId: string;
}) {
  const [amount, setAmount] = React.useState("");
  const [method, setMethod] = React.useState("BANK_TRANSFER");
  const [reference, setReference] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [confirmOver, setConfirmOver] = React.useState(false);

  React.useEffect(() => {
    if (payment) {
      setAmount(String(Number(payment.amount) - Number(payment.amountPaid)));
      setMethod("BANK_TRANSFER");
      setReference("");
      setConfirmOver(false);
    }
  }, [payment]);

  async function submit(confirmed = false) {
    if (!payment) return;
    setSaving(true);
    const res = await fetch(`/api/projects/${projectId}/payments`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: payment.id,
        recordPaidAmount: Number(amount),
        paymentMethod: method,
        referenceNumber: reference || undefined,
        confirmed,
      }),
    });
    setSaving(false);
    if (res.status === 409) {
      setConfirmOver(true);
      return;
    }
    if (res.ok) {
      toast({ title: "Pembayaran dicatat", variant: "success" });
      onDone();
    } else {
      const d = await res.json().catch(() => ({}));
      toast({ title: "Gagal", description: d.message ?? d.error, variant: "error" });
    }
  }

  return (
    <>
      <Dialog open={!!payment} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Catat Pembayaran — Termin {payment?.terminNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Jumlah (Rp)</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                Sisa: {payment ? formatIDR(Number(payment.amount) - Number(payment.amountPaid)) : "-"}
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
            {confirmOver && (
              <p className="rounded-md bg-amber-50 p-3 text-xs text-amber-800">
                Total pembayaran akan melebihi nilai project. Tekan simpan lagi untuk konfirmasi.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Batal</Button>
            <Button onClick={() => submit(confirmOver)} disabled={saving}>
              {saving ? "Menyimpan..." : confirmOver ? "Konfirmasi & Simpan" : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function UploadDialog({
  open, onClose, projectId, onDone,
}: {
  open: boolean; onClose: () => void; projectId: string; onDone: () => void;
}) {
  const [file, setFile] = React.useState<File | null>(null);
  const [name, setName] = React.useState("");
  const [category, setCategory] = React.useState("OTHER");
  const [description, setDescription] = React.useState("");
  const [uploading, setUploading] = React.useState(false);

  const CATEGORIES = ["PROPOSAL", "QUOTATION", "CONTRACT", "AGREEMENT", "REQUIREMENT", "DESIGN", "TECHNICAL", "REPORT", "INVOICE", "RECEIPT", "FINAL", "OTHER"];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("name", name || file.name);
    fd.append("category", category);
    if (description) fd.append("description", description);
    const res = await fetch(`/api/projects/${projectId}/documents`, { method: "POST", body: fd });
    setUploading(false);
    if (res.ok) {
      toast({ title: "Dokumen diupload", variant: "success" });
      setFile(null); setName(""); setDescription(""); setCategory("OTHER");
      onDone();
    } else {
      const d = await res.json().catch(() => ({}));
      toast({ title: "Upload gagal", description: d.error, variant: "error" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Upload Dokumen</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>File * (PDF, DOC, XLS, PPT, JPG, PNG, ZIP — maks 25MB)</Label>
            <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.zip" />
          </div>
          <div className="space-y-1.5">
            <Label>Nama Dokumen</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jika kosong, pakai nama file" />
          </div>
          <div className="space-y-1.5">
            <Label>Kategori</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Deskripsi</Label>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
            <Button type="submit" disabled={uploading || !file}>{uploading ? "Mengupload..." : "Upload"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
