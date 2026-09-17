import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleServerError } from "@/lib/api-utils";
import { logActivity } from "@/lib/activity";
import { formatIDR } from "@/lib/format";

/** Derive payment status from dates & paid amount */
function deriveStatus(input: {
  status: string;
  amount: number;
  amountPaid: number;
  dueDate: Date | null;
}): string {
  if (input.status === "CANCELLED") return "CANCELLED";
  if (input.amountPaid >= input.amount && input.amount > 0) return "PAID";
  if (input.amountPaid > 0) return "PARTIALLY_PAID";
  if (input.dueDate && input.dueDate < new Date()) return "OVERDUE";
  if (input.dueDate && input.dueDate <= new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)) return "DUE";
  return "PENDING";
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAuth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const project = await db.project.findFirst({ where: { id: params.id, deletedAt: null } });
    if (!project) return Response.json({ error: "Project tidak ditemukan" }, { status: 404 });

    const terminCount = await db.payment.count({ where: { projectId: params.id } });
    const percentage = Number(body.percentage) || 0;
    let amount = Number(body.amount) || 0;
    if (!amount && percentage > 0) amount = (percentage / 100) * Number(project.totalValue);

    const payment = await db.payment.create({
      data: {
        projectId: params.id,
        clientId: project.clientId,
        terminNumber: terminCount + 1,
        description: body.description || `Termin ${terminCount + 1}`,
        percentage,
        amount,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        status: "PENDING",
        notes: body.notes || null,
      },
    });

    await logActivity({
      userId: session.user.id,
      action: "CREATED",
      module: "PAYMENT",
      recordId: payment.id,
      description: `Termin ${payment.terminNumber} ditambahkan: ${formatIDR(amount)}`,
    });

    return Response.json(payment, { status: 201 });
  } catch (err) {
    return handleServerError(err);
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAuth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const existing = await db.payment.findUnique({ where: { id: body.id } });
    if (!existing) return Response.json({ error: "Payment tidak ditemukan" }, { status: 404 });

    const data: any = {};
    if (body.description !== undefined) data.description = body.description;
    if (body.percentage !== undefined) data.percentage = Number(body.percentage) || 0;
    if (body.amount !== undefined) data.amount = Number(body.amount) || 0;
    if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    if (body.paymentMethod !== undefined) data.paymentMethod = body.paymentMethod;
    if (body.referenceNumber !== undefined) data.referenceNumber = body.referenceNumber;
    if (body.notes !== undefined) data.notes = body.notes;

    // Record a payment instalment
    if (body.recordPaidAmount !== undefined) {
      const project = await db.project.findUnique({ where: { id: params.id } });
      const allPayments = await db.payment.findMany({ where: { projectId: params.id, status: { not: "CANCELLED" } } });
      const otherPaid = allPayments
        .filter((p) => p.id !== body.id)
        .reduce((s, p) => s + Number(p.amountPaid), 0);
      const projectTotal = Number(project?.totalValue ?? 0);

      const addAmount = Number(body.recordPaidAmount) || 0;
      const newPaid = Number(existing.amountPaid) + addAmount;

      // Business rule #8: warn (require confirm) when total paid would exceed project value
      if (otherPaid + newPaid > projectTotal && !body.confirmed) {
        return Response.json(
          { error: "CONFIRM_NEEDED", message: "Total pembayaran akan melebihi nilai project. Kirim confirmed:true untuk melanjutkan." },
          { status: 409 }
        );
      }

      data.amountPaid = newPaid;
      data.paidDate = new Date();
      if (!data.paymentMethod && body.paymentMethod) data.paymentMethod = body.paymentMethod;
    }

    if (body.status !== undefined) data.status = body.status;

    const amount = data.amount ?? Number(existing.amount);
    const amountPaid = data.amountPaid ?? Number(existing.amountPaid);
    const dueDate = data.dueDate ?? (existing.dueDate ? new Date(existing.dueDate) : null);
    let status = data.status ?? existing.status;
    if (!body.status) status = deriveStatus({ status, amount, amountPaid, dueDate });
    data.status = status;
    if (status === "PAID" && !data.paidDate) data.paidDate = new Date();

    const payment = await db.payment.update({ where: { id: body.id }, data });

    await logActivity({
      userId: session.user.id,
      action: addAmountLogged(body) ? "PAID" : "UPDATED",
      module: "PAYMENT",
      recordId: payment.id,
      description: addAmountLogged(body)
        ? `Pembayaran ${formatIDR(Number(body.recordPaidAmount))} dicatat untuk Termin ${payment.terminNumber}`
        : `Termin ${payment.terminNumber} diperbarui`,
    });

    return Response.json(payment);
  } catch (err) {
    return handleServerError(err);
  }
}

function addAmountLogged(body: any): boolean {
  return body.recordPaidAmount !== undefined && Number(body.recordPaidAmount) > 0;
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAuth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const sp = new URL(req.url).searchParams;
    const paymentId = sp.get("paymentId");
    if (!paymentId) return Response.json({ error: "paymentId wajib" }, { status: 400 });

    const existing = await db.payment.findUnique({ where: { id: paymentId } });
    if (!existing) return Response.json({ error: "Payment tidak ditemukan" }, { status: 404 });

    if (Number(existing.amountPaid) > 0) {
      return Response.json({ error: "Payment yang sudah memiliki pembayaran tidak dapat dihapus" }, { status: 400 });
    }

    await db.payment.delete({ where: { id: paymentId } });
    return Response.json({ ok: true });
  } catch (err) {
    return handleServerError(err);
  }
}
