"use client";

import * as React from "react";
import Link from "next/link";
import {
  FolderKanban, CheckCircle2, Clock, XCircle, Wallet, Receipt,
  TrendingUp, AlertTriangle, Plus,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatusBadge, PageHeader, LoadingSpinner } from "@/components/shared";
import { formatIDR, formatDateShort } from "@/lib/format";

type DashboardData = {
  project: { total: number; active: number; completed: number; pending: number; cancelled: number; overdue: number };
  financial: {
    totalProjectValue: number; totalInvoiced: number; totalPaid: number;
    outstanding: number; totalInvoices: number; unpaidInvoices: number; overdueInvoices: number;
  };
  monthlyReceipts: { month: string; amount: number }[];
  activeProjects: {
    id: string; code: string; name: string; client: string; status: string;
    progress: number; targetCompletionDate: string | null;
  }[];
  upcomingPayments: {
    id: string; projectId: string; projectName: string; terminNumber: number;
    amount: number; amountPaid: number; dueDate: string | null; status: string;
  }[];
  nearestDeadlines: { id: string; name: string; code: string; progress: number; targetCompletionDate: string | null }[];
  recentActivities: { id: string; description: string; module: string; user: string; createdAt: string }[];
};

export default function DashboardPage() {
  const [data, setData] = React.useState<DashboardData | null>(null);

  React.useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setData(d))
      .catch(() => {});
  }, []);

  if (!data) return <LoadingSpinner />;

  const paidPct = data.financial.totalProjectValue > 0
    ? Math.round((data.financial.totalPaid / data.financial.totalProjectValue) * 100)
    : 0;

  const chartData = data.monthlyReceipts.map((m) => ({
    month: new Date(m.month + "-01").toLocaleDateString("id-ID", { month: "short" }),
    amount: m.amount,
  }));

  const todayStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="space-y-6">
      {/* Header section — Aurora style */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{todayStr}</span>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl">
            Good morning, Captain! 👋
          </h1>
          <p className="mt-1 text-xs text-slate-500 font-medium">
            Here's what's happening with your projects and financial performance today.
          </p>
        </div>
        <div className="flex items-center gap-2 pt-2 sm:pt-0">
          <Button asChild size="sm" className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20">
            <Link href="/projects?new=1">
              <Plus className="h-4 w-4" /> New Project
            </Link>
          </Button>
        </div>
      </div>

      {/* Main Grid — Aurora Banner + Primary Stats */}
      <div className="grid gap-5 lg:grid-cols-12">
        {/* Left Side: Summary Metrics */}
        <div className="space-y-4 lg:col-span-4 flex flex-col justify-between">
          <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Updates from today</span>
              <span className="rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 border border-emerald-200/50">Live</span>
            </div>

            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between rounded-xl bg-slate-50/80 p-3.5 border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100/70 text-emerald-600">
                    <FolderKanban className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-lg font-extrabold text-slate-900">{data.project.active}</p>
                    <p className="text-xs font-semibold text-slate-500">Active Projects</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">+2 this week</span>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-slate-50/80 p-3.5 border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100/70 text-teal-600">
                    <Wallet className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-lg font-extrabold text-slate-900">{formatIDR(data.financial.totalPaid)}</p>
                    <p className="text-xs font-semibold text-slate-500">Total Earnings</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-teal-600 bg-teal-50 px-2 py-1 rounded-lg">+14.2%</span>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-slate-50/80 p-3.5 border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100/70 text-sky-600">
                    <Receipt className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-lg font-extrabold text-slate-900">{formatIDR(data.financial.outstanding)}</p>
                    <p className="text-xs font-semibold text-slate-500">Outstanding Invoices</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">
                  {data.financial.unpaidInvoices} Unpaid
                </span>
              </div>
            </div>
          </div>

          {/* Quick Payment Progress Card */}
          <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700">Billing Collection Rate</span>
              <span className="text-sm font-extrabold text-emerald-600">{paidPct}%</span>
            </div>
            <Progress value={paidPct} className="h-2 rounded-full bg-slate-100" />
            <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500 font-medium">
              <span>{formatIDR(data.financial.totalPaid)} collected</span>
              <span>{formatIDR(data.financial.totalProjectValue)} target</span>
            </div>
          </div>
        </div>

        {/* Right Side: Aurora Featured Banner Card + Monthly Chart */}
        <div className="space-y-4 lg:col-span-8">
          {/* Featured Emerald Banner Card (like the reference image) */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 p-6 text-white shadow-xl shadow-emerald-600/15">
            {/* Background Wave Graphic */}
            <div className="absolute -right-10 -top-10 h-64 w-64 rounded-full bg-white/10 blur-2xl pointer-events-none" />
            <div className="absolute -bottom-10 right-20 h-40 w-40 rounded-full bg-cyan-400/20 blur-xl pointer-events-none" />

            <div className="relative z-10 flex flex-col justify-between h-full space-y-4">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-white/20 px-3 py-1 text-[11px] font-bold tracking-wider backdrop-blur-md">
                  PORTFOLIO HEALTH
                </span>
                <span className="text-xs text-emerald-100 font-medium">Updated 5m ago</span>
              </div>

              <div>
                <h2 className="text-2xl font-extrabold tracking-tight md:text-3xl leading-snug">
                  Boost your billing rate <br className="hidden sm:inline" />
                  by <span className="text-emerald-200 underline underline-offset-4 decoration-emerald-300">2.5x</span> this quarter
                </h2>
                <p className="mt-2 max-w-md text-xs text-emerald-100/90 leading-relaxed font-medium">
                  You have {data.financial.unpaidInvoices} open invoices waiting for collection. Send reminders or generate new receipts in one click.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button asChild size="sm" className="rounded-xl bg-white text-emerald-800 font-bold hover:bg-emerald-50 shadow-md">
                  <Link href="/invoices">View Open Invoices</Link>
                </Button>
                <Button asChild size="sm" variant="ghost" className="rounded-xl text-white hover:bg-white/10 font-semibold">
                  <Link href="/reports">Financial Reports →</Link>
                </Button>
              </div>
            </div>
          </div>

          {/* Revenue Chart Card */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Revenue & Monthly Receipts</h3>
                <p className="text-xs text-slate-500 font-medium">Penerimaan kas bersih 6 bulan terakhir</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/50">
                <TrendingUp className="h-3.5 w-3.5" /> +18.5% Growth
              </div>
            </div>
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="emeraldBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#059669" stopOpacity={1} />
                    <stop offset="100%" stopColor="#0d9488" stopOpacity={0.8} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" fontSize={11} tickLine={false} axisLine={false} tick={{ fill: "#64748b" }} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${Math.round(v / 1000000)}jt`} tick={{ fill: "#64748b" }} />
                <Tooltip
                  formatter={(value: number) => [formatIDR(value), "Penerimaan"]}
                  contentStyle={{ fontSize: 12, borderRadius: 12, border: "1px solid #e2e8f0", boxShadow: "0 4px 20px rgba(0,0,0,0.05)" }}
                />
                <Bar dataKey="amount" fill="url(#emeraldBar)" radius={[6, 6, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      </div>

      {/* Active Projects + Upcoming Payments Grid */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Active Projects */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Project Berjalan</h3>
              <p className="text-xs text-slate-500 font-medium">Daftar project aktif yang sedang dalam proses</p>
            </div>
            <Link href="/projects" className="text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors">
              Lihat semua →
            </Link>
          </div>

          <div className="space-y-3">
            {data.activeProjects.length === 0 && (
              <p className="py-8 text-center text-xs text-slate-400 font-medium">Belum ada project aktif</p>
            )}
            {data.activeProjects.map((p) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="group flex flex-col gap-2.5 rounded-xl border border-slate-200/60 bg-slate-50/50 p-3.5 transition-all duration-200 hover:bg-white hover:border-emerald-300 hover:shadow-md"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">
                      {p.name}
                    </p>
                    <p className="text-xs font-medium text-slate-500">
                      {p.code} · <span className="text-slate-700 font-semibold">{p.client}</span>
                    </p>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-semibold text-slate-500">
                    <span>Progress</span>
                    <span className="text-slate-900 font-bold">{p.progress}%</span>
                  </div>
                  <Progress value={p.progress} className="h-1.5 rounded-full bg-slate-200/80" />
                </div>
              </Link>
            ))}
          </div>
        </Card>

        {/* Upcoming Payments */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" /> Pembayaran Mendatang
              </h3>
              <p className="text-xs text-slate-500 font-medium">Termin pembayaran yang harus ditagihkan</p>
            </div>
            <Link href="/payments" className="text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors">
              Lihat semua →
            </Link>
          </div>

          <div className="space-y-3">
            {data.upcomingPayments.length === 0 && (
              <p className="py-8 text-center text-xs text-slate-400 font-medium">Tidak ada tagihan mendatang</p>
            )}
            {data.upcomingPayments.map((pay) => (
              <Link
                key={pay.id}
                href={`/projects/${pay.projectId}?tab=payments`}
                className="group flex items-center justify-between gap-3 rounded-xl border border-slate-200/60 bg-slate-50/50 p-3.5 transition-all duration-200 hover:bg-white hover:border-emerald-300 hover:shadow-md"
              >
                <div className="min-w-0 space-y-1">
                  <p className="truncate text-sm font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">
                    Termin {pay.terminNumber} — {pay.projectName}
                  </p>
                  <p className="text-xs font-medium text-slate-500">
                    Jatuh tempo: <span className="font-semibold text-slate-700">{formatDateShort(pay.dueDate)}</span>
                  </p>
                </div>
                <div className="text-right whitespace-nowrap">
                  <p className="text-sm font-extrabold text-slate-900">{formatIDR(pay.amount)}</p>
                  <StatusBadge status={pay.status} className="mt-1" />
                </div>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      {/* Recent Activity Card */}
      <Card className="p-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">Aktivitas Terakhir</h3>
            <p className="text-xs text-slate-500 font-medium">Catatan log aktivitas perubahan data pada sistem</p>
          </div>
        </div>
        <ul className="divide-y divide-slate-100">
          {data.recentActivities.map((a) => (
            <li key={a.id} className="flex items-start gap-3 py-3 text-xs first:pt-0 last:pb-0">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-500 ring-4 ring-emerald-50" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-slate-800">{a.description}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {formatDateShort(a.createdAt)} · <span className="font-semibold text-slate-600">{a.user}</span>
                </p>
              </div>
            </li>
          ))}
          {data.recentActivities.length === 0 && (
            <p className="py-4 text-center text-xs text-slate-400">Belum ada aktivitas</p>
          )}
        </ul>
      </Card>
    </div>
  );
}
