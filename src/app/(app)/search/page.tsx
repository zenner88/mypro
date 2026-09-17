"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { PageHeader, LoadingSpinner } from "@/components/shared";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Group = { label: string; items: { id: string; title: string; subtitle?: string; href: string }[] };

export default function SearchPage() {
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") ?? "";
  const [q, setQ] = React.useState(initialQ);
  const [groups, setGroups] = React.useState<Group[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (initialQ.length < 2) return;
    setLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(initialQ)}`)
      .then((r) => r.json())
      .then((d) => setGroups(d.groups ?? []))
      .finally(() => setLoading(false));
  }, [initialQ]);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Pencarian" description={`Hasil untuk "${initialQ}"`} />

      <form
        className="mb-6 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          window.location.href = `/search?q=${encodeURIComponent(q)}`;
        }}
      >
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari client, project, invoice..." />
        <Button type="submit"><Search /> Cari</Button>
      </form>

      {loading ? (
        <LoadingSpinner />
      ) : groups.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Tidak ada hasil</p>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <div key={g.label}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.label}</h3>
              <div className="space-y-1">
                {g.items.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-accent/50"
                  >
                    <div>
                      <p className="text-sm font-medium">{item.title}</p>
                      {item.subtitle && <p className="text-xs text-muted-foreground">{item.subtitle}</p>}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
