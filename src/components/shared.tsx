"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between no-print">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  // Project
  DRAFT: "bg-slate-100 text-slate-700 border-slate-200",
  PROPOSAL: "bg-violet-50 text-violet-700 border-violet-200/60",
  NEGOTIATION: "bg-amber-50 text-amber-700 border-amber-200/60",
  APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
  IN_PROGRESS: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
  ON_HOLD: "bg-orange-50 text-orange-700 border-orange-200/60",
  COMPLETED: "bg-teal-50 text-teal-700 border-teal-200/60",
  CANCELLED: "bg-rose-50 text-rose-700 border-rose-200/60",
  // Payment / invoice
  PENDING: "bg-slate-100 text-slate-600 border-slate-200",
  DUE: "bg-amber-50 text-amber-700 border-amber-200/60",
  PARTIALLY_PAID: "bg-sky-50 text-sky-700 border-sky-200/60",
  PAID: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
  OVERDUE: "bg-rose-50 text-rose-700 border-rose-200/60",
  SENT: "bg-blue-50 text-blue-700 border-blue-200/60",
  // Task
  TODO: "bg-slate-100 text-slate-600 border-slate-200",
  REVIEW: "bg-violet-50 text-violet-700 border-violet-200/60",
  DONE: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
  // Priority
  LOW: "bg-slate-100 text-slate-500 border-slate-200",
  MEDIUM: "bg-blue-50 text-blue-700 border-blue-200/60",
  HIGH: "bg-amber-50 text-amber-700 border-amber-200/60",
  URGENT: "bg-rose-50 text-rose-700 border-rose-200/60",
  // Quotation
  REJECTED: "bg-rose-50 text-rose-700 border-rose-200/60",
  EXPIRED: "bg-slate-100 text-slate-500 border-slate-200",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const label = status.replaceAll("_", " ");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-tight border whitespace-nowrap",
        STATUS_STYLES[status] ?? "bg-slate-100 text-slate-600 border-slate-200",
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {label}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-14 px-6 text-center">
      <p className="text-base font-semibold">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Hapus",
  onConfirm,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  loading?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={loading}>
            {loading ? "Memproses..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center py-16", className)}>
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
    </div>
  );
}

export { Badge };
