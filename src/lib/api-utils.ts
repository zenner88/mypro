import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function requireAuth() {
  const session = await getServerSession(authOptions);
  return session;
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function jsonOk(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function handleServerError(err: unknown) {
  console.error("[api]", err);
  const message = err instanceof Error ? err.message : "Internal server error";
  return NextResponse.json({ error: message }, { status: 500 });
}

export function parseQuery(req: Request) {
  const sp = new URL(req.url).searchParams;
  const num = (key: string, fallback: number) => {
    const n = parseInt(sp.get(key) ?? "", 10);
    return Number.isNaN(n) ? fallback : n;
  };
  return {
    page: Math.max(1, num("page", 1)),
    limit: Math.min(200, Math.max(1, num("limit", 20))),
    get skip() {
      return (this.page - 1) * this.limit;
    },
    q: sp.get("q") ?? "",
    sort: sp.get("sort") ?? "",
    order: sp.get("order") === "asc" ? ("asc" as const) : ("desc" as const),
    status: sp.get("status") ?? "",
    clientId: sp.get("clientId") ?? "",
    projectId: sp.get("projectId") ?? "",
    category: sp.get("category") ?? "",
    from: sp.get("from") ?? "",
    to: sp.get("to") ?? "",
  };
}

/** Escape user text for safe CSV export */
export function csvEscape(value: unknown): string {
  const s = String(value ?? "");
  if (/[",\n;]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows.map((r) => r.map(csvEscape).join(";")).join("\n");
}
