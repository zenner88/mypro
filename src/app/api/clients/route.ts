import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleServerError, parseQuery } from "@/lib/api-utils";
import { logActivity } from "@/lib/activity";
import { nextDocumentNumber } from "@/lib/numbering";

export async function GET(req: NextRequest) {
  const session = await requireAuth();
  if (!session) return handleServerError(new Error("Unauthorized"));

  try {
    const p = parseQuery(req);
    const where: any = { deletedAt: null };

    if (session.user.role !== "ADMIN") {
      where.userId = session.user.id;
    }

    if (p.q) {
      where.OR = [
        { companyName: { contains: p.q } },
        { contactPerson: { contains: p.q } },
        { email: { contains: p.q } },
        { phone: { contains: p.q } },
      ];
    }
    if (p.status === "active") where.isActive = true;
    if (p.status === "inactive") where.isActive = false;

    const [items, total] = await Promise.all([
      db.client.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: p.skip,
        take: p.limit,
        include: { _count: { select: { projects: true } } },
      }),
      db.client.count({ where }),
    ]);

    return Response.json({ items, total, page: p.page, limit: p.limit });
  } catch (err) {
    return handleServerError(err);
  }
}

export async function POST(req: NextRequest) {
  const session = await requireAuth();
  if (!session) return handleServerError(new Error("Unauthorized"));

  try {
    const body = await req.json();
    if (!body.companyName || !body.contactPerson) {
      return Response.json({ error: "Nama perusahaan dan contact person wajib diisi" }, { status: 400 });
    }

    const code = await nextDocumentNumber("CLI");

    const client = await db.client.create({
      data: {
        code,
        userId: session.user.id,
        companyName: body.companyName.trim(),
        contactPerson: body.contactPerson.trim(),
        email: body.email || null,
        phone: body.phone || null,
        whatsapp: body.whatsapp || null,
        address: body.address || null,
        npwp: body.npwp ?? null,
        website: body.website || null,
        notes: body.notes || null,
        isActive: body.isActive ?? true,
      },
    });

    await logActivity({
      userId: session.user.id,
      action: "CREATED",
      module: "CLIENT",
      recordId: client.id,
      description: `Client dibuat: ${client.companyName} (${client.code})`,
    });

    return Response.json(client, { status: 201 });
  } catch (err) {
    return handleServerError(err);
  }
}
