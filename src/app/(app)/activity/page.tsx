"use client";

import * as React from "react";
import { PageHeader } from "@/components/shared";
import { DataTable, type Column } from "@/components/DataTable";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";

type Activity = {
  id: string; action: string; module: string; description: string; createdAt: string;
  user?: { name: string } | null;
};

const ACTION_COLORS: Record<string, string> = {
  CREATED: "success", UPDATED: "info", DELETED: "danger", STATUS_CHANGED: "warning",
  UPLOADED: "info", PAID: "success", CONVERTED: "warning", DOWNLOADED: "muted",
};

export default function ActivityPage() {
  const columns: Column<Activity>[] = [
    { key: "time", header: "Waktu", render: (a) => formatDateTime(a.createdAt) },
    { key: "module", header: "Modul", render: (a) => <Badge variant="secondary">{a.module}</Badge> },
    { key: "action", header: "Aksi", render: (a) => <Badge variant={(ACTION_COLORS[a.action] ?? "muted") as any}>{a.action}</Badge> },
    { key: "desc", header: "Deskripsi", render: (a) => <span className="text-sm">{a.description}</span> },
    { key: "user", header: "User", render: (a) => a.user?.name ?? "System" },
  ];

  return (
    <div>
      <PageHeader title="Activity Log" description="Riwayat semua perubahan penting" />
      <DataTable columns={columns} fetchUrl="/api/activity" searchPlaceholder="Cari aktivitas..." pageSize={30} />
    </div>
  );
}
