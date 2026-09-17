import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleServerError } from "@/lib/api-utils";
import { logActivity } from "@/lib/activity";
import { recomputeProjectValue } from "@/lib/finance";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAuth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    if (!body.name) return Response.json({ error: "Nama item wajib diisi" }, { status: 400 });

    const count = await db.projectItem.count({ where: { projectId: params.id } });

    const item = await db.projectItem.create({
      data: {
        projectId: params.id,
        name: body.name,
        description: body.description || null,
        qty: Number(body.qty) || 1,
        unitPrice: Number(body.unitPrice) || 0,
        discount: Number(body.discount) || 0,
        sortOrder: count,
      },
    });

    await recomputeProjectValue(params.id);

    await logActivity({
      userId: session.user.id,
      action: "UPDATED",
      module: "PROJECT",
      recordId: params.id,
      description: `Item harga "${item.name}" ditambahkan`,
    });

    return Response.json(item, { status: 201 });
  } catch (err) {
    return handleServerError(err);
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAuth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    if (!body.id) return Response.json({ error: "ID item wajib" }, { status: 400 });

    const data: any = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.description !== undefined) data.description = body.description;
    if (body.qty !== undefined) data.qty = Number(body.qty) || 1;
    if (body.unitPrice !== undefined) data.unitPrice = Number(body.unitPrice) || 0;
    if (body.discount !== undefined) data.discount = Number(body.discount) || 0;

    await db.projectItem.update({ where: { id: body.id }, data });
    await recomputeProjectValue(params.id);

    return Response.json({ ok: true });
  } catch (err) {
    return handleServerError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAuth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const sp = new URL(req.url).searchParams;
    const itemId = sp.get("itemId");
    if (!itemId) return Response.json({ error: "itemId wajib" }, { status: 400 });

    await db.projectItem.delete({ where: { id: itemId } });
    await recomputeProjectValue(params.id);

    return Response.json({ ok: true });
  } catch (err) {
    return handleServerError(err);
  }
}
