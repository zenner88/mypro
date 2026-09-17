import { db } from "@/lib/db";

type LogInput = {
  userId?: string | null;
  action: string;
  module: "PROJECT" | "CLIENT" | "INVOICE" | "PAYMENT" | "QUOTATION" | "DOCUMENT" | "SETTINGS" | "AUTH" | "RECEIPT";
  recordId?: string | null;
  description: string;
  metadata?: Record<string, unknown>;
};

/** Fire-and-forget activity logging; never throws. */
export async function logActivity(input: LogInput, tx?: any): Promise<void> {
  try {
    const client = tx ?? db;
    await client.activityLog.create({
      data: {
        userId: input.userId ?? null,
        action: input.action,
        module: input.module,
        recordId: input.recordId ?? null,
        description: input.description,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      },
    });
  } catch (err) {
    console.error("[activity-log]", err);
  }
}
