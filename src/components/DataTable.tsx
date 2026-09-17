"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LoadingSpinner, EmptyState } from "@/components/shared";
import { cn } from "@/lib/utils";

export type Column<T> = {
  key: string;
  header: React.ReactNode;
  render: (row: T) => React.ReactNode;
  className?: string;
};

export function DataTable<T extends { id: string }>({
  columns,
  fetchUrl,
  searchPlaceholder = "Cari...",
  pageSize = 20,
  extraQuery,
  refreshKey,
  emptyTitle = "Belum ada data",
  emptyDescription,
  onRowClick,
}: {
  columns: Column<T>[];
  fetchUrl: string;
  searchPlaceholder?: string;
  pageSize?: number;
  extraQuery?: Record<string, string | undefined>;
  refreshKey?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  onRowClick?: (row: T) => void;
}) {
  const [items, setItems] = React.useState<T[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [q, setQ] = React.useState("");
  const [qDebounced, setQDebounced] = React.useState("");
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const t = setTimeout(() => setQDebounced(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  React.useEffect(() => {
    setPage(1);
  }, [qDebounced, extraQuery]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(pageSize) });
    if (qDebounced) params.set("q", qDebounced);
    for (const [k, v] of Object.entries(extraQuery ?? {})) {
      if (v) params.set(k, v);
    }
    fetch(`${fetchUrl}?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setItems(d.items ?? []);
        setTotal(d.total ?? 0);
        setLoading(false);
      })
      .catch(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [fetchUrl, page, qDebounced, JSON.stringify(extraQuery), refreshKey]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={searchPlaceholder} className="pl-8" />
        </div>
        <span className="ml-auto text-xs text-muted-foreground">{total} data</span>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : items.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {columns.map((c) => (
                    <TableHead key={c.key} className={c.className}>{c.header}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row) => (
                  <TableRow
                    key={row.id}
                    className={onRowClick ? "cursor-pointer" : ""}
                    onClick={() => onRowClick?.(row)}
                  >
                    {columns.map((c) => (
                      <TableCell key={c.key} className={c.className}>{c.render(row)}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="mt-3 flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="h-4 w-4" /> Prev
              </Button>
              <span className="text-xs text-muted-foreground">
                Hal {page} / {totalPages}
              </span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
