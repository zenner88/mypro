import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleServerError, parseQuery } from "@/lib/api-utils";

export async function GET(req: NextRequest) {
  const session = await requireAuth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const p = parseQuery(req);
    const where: any = { deletedAt: null };
    if (session.user.role !== "ADMIN") {
      where.project = { userId: session.user.id };
    }
    if (p.q) where.name = { contains: p.q };
    if (p.category) where.category = p.category;
    if (p.projectId) where.projectId = p.projectId;

    const [items, total] = await Promise.all([
      db.document.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: p.skip,
        take: p.limit,
        include: {
          project: { select: { id: true, name: true, code: true } },
          client: { select: { id: true, companyName: true } },
        },
      }),
      db.document.count({ where }),
    ]);

    return Response.json({ items, total, page: p.page, limit: p.limit });
  } catch (err) {
    return handleServerError(err);
  }
}
