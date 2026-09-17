import { db } from "@/lib/db";

/**
 * Atomic, race-safe document numbering.
 * Uses an upsert + increment inside a transaction so two concurrent
 * creations can never receive the same number.
 *
 * Sequence id format: {PREFIX}-{YEAR} e.g. "INV-2026"
 * Output format:      INV-2026-0001
 */
export async function nextDocumentNumber(
  prefix: "PRJ" | "QUO" | "INV" | "REC" | "CLI",
  tx?: { $transaction: (fn: (tx: any) => Promise<unknown>) => Promise<unknown> } | any
): Promise<string> {
  const client = tx ?? db;
  const year = new Date().getFullYear();

  const seq = await client.numberSequence.upsert({
    where: { id: `${prefix}-${year}` },
    create: { id: `${prefix}-${year}`, current: 1 },
    update: { current: { increment: 1 } },
  });

  return `${prefix}-${year}-${String(seq.current).padStart(4, "0")}`;
}

/** Run a callback inside a transaction (helper for combined operations). */
export async function withTransaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
  return db.$transaction(fn);
}
