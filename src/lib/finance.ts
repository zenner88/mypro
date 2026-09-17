import { db } from "@/lib/db";

/**
 * Recompute invoice status from amountPaid / dueDate.
 * Skips CANCELLED invoices. DRAFT stays DRAFT until it has payments or is sent.
 */
export async function recomputeInvoiceStatus(invoiceId: string, tx?: any): Promise<void> {
  const client = tx ?? db;
  const inv = await client.invoice.findUnique({ where: { id: invoiceId } });
  if (!inv || inv.status === "CANCELLED") return;

  const total = Number(inv.total);
  const paid = Number(inv.amountPaid);

  let status: string;
  if (total > 0 && paid >= total) status = "PAID";
  else if (paid > 0) status = "PARTIALLY_PAID";
  else if (inv.status === "DRAFT") status = "DRAFT";
  else if (inv.dueDate && new Date(inv.dueDate) < new Date()) status = "OVERDUE";
  else status = inv.status === "OVERDUE" ? "OVERDUE" : "SENT";

  await client.invoice.update({ where: { id: invoiceId }, data: { status } });
}

/** Keep a payment (termin) in sync with its linked invoice paid amount. */
export async function syncPaymentFromInvoice(paymentId: string, tx?: any): Promise<void> {
  const client = tx ?? db;
  // A payment (termin) may have several invoices over its lifetime
  // (e.g. deleted & re-issued). Only the latest active one drives the status.
  const payment = await client.payment.findUnique({
    where: { id: paymentId },
    include: {
      invoices: {
        where: { deletedAt: null },
        orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }],
        take: 1,
      },
    },
  });
  if (!payment) return;

  const activeInvoice = payment.invoices?.[0] ?? null;

  if (activeInvoice) {
    const paid = Number(activeInvoice.amountPaid);
    const amount = Number(payment.amount);
    let status = payment.status;
    if (Number(payment.amountPaid) < paid || paid > 0) {
      if (paid >= amount && amount > 0) status = "PAID";
      else if (paid > 0) status = "PARTIALLY_PAID";
    }
    await client.payment.update({
      where: { id: paymentId },
      data: {
        amountPaid: paid,
        status,
        paidDate: paid >= amount ? activeInvoice.invoiceDate : null,
      },
    });
  }
}

/** Keep a project's invoice (if linked) in sync when a payment is recorded. */
export async function syncInvoiceFromPayment(invoiceId: string, addedAmount: number, tx?: any): Promise<void> {
  const client = tx ?? db;
  await client.invoice.update({
    where: { id: invoiceId },
    data: { amountPaid: { increment: addedAmount } },
  });
  await recomputeInvoiceStatus(invoiceId, client);
}

/**
 * Recompute a project's totalValue from its pricing items.
 * If the project has no items, value stays as entered manually.
 */
export async function recomputeProjectValue(projectId: string, tx?: any): Promise<number> {
  const client = tx ?? db;
  const items: any[] = await client.projectItem.findMany({ where: { projectId } });
  if (items.length === 0) {
    const project = await client.project.findUnique({ where: { id: projectId } });
    return Number(project?.totalValue ?? 0);
  }
  const total = items.reduce((sum, it) => {
    const line = Number(it.qty) * Number(it.unitPrice) - Number(it.discount);
    return sum + Math.max(0, line);
  }, 0);
  await client.project.update({ where: { id: projectId }, data: { totalValue: Math.max(0, total) } });
  return Math.max(0, total);
}
