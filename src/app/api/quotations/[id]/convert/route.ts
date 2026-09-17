import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleServerError } from "@/lib/api-utils";
import { logActivity } from "@/lib/activity";
import { nextDocumentNumber } from "@/lib/numbering";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAuth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const quotation = await db.quotation.findFirst({
      where: { id: params.id, deletedAt: null },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });
    if (!quotation) return Response.json({ error: "Quotation tidak ditemukan" }, { status: 404 });

    if (quotation.convertedToProjectId) {
      return Response.json(
        { error: "Quotation sudah dikonversi", projectId: quotation.convertedToProjectId },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));

    const project = await db.$transaction(async (tx: any) => {
      const code = await nextDocumentNumber("PRJ", tx);

      const proj = await tx.project.create({
        data: {
          code,
          name: body.name || quotation.subject,
          clientId: quotation.clientId,
          description: body.description || quotation.notes || null,
          projectType: body.projectType || null,
          status: "APPROVED",
          priority: body.priority || "MEDIUM",
          startDate: body.startDate ? new Date(body.startDate) : new Date(),
          targetCompletionDate: body.targetCompletionDate ? new Date(body.targetCompletionDate) : null,
          totalValue: quotation.total,
          notes: `Dibuat dari quotation ${quotation.number}`,
        },
      });

      // Copy quotation items to project pricing
      if (quotation.items.length > 0) {
        await tx.projectItem.createMany({
          data: quotation.items.map((it, idx) => ({
            projectId: proj.id,
            name: it.name,
            description: it.description,
            qty: it.qty,
            unitPrice: it.unitPrice,
            discount: it.discount,
            sortOrder: idx,
          })),
        });
      }

      await tx.quotation.update({
        where: { id: quotation.id },
        data: { status: "APPROVED", convertedToProjectId: proj.id, projectId: proj.id },
      });

      return proj;
    });

    await logActivity({
      userId: session.user.id,
      action: "CONVERTED",
      module: "QUOTATION",
      recordId: quotation.id,
      description: `Quotation ${quotation.number} dikonversi menjadi project ${project.code}`,
    });

    return Response.json(project, { status: 201 });
  } catch (err) {
    return handleServerError(err);
  }
}
