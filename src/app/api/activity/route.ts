import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleServerError, parseQuery } from "@/lib/api-utils";

export async function GET(req: NextRequest) {
  const session = await requireAuth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const p = parseQuery(req);
    const where: any = {};
    if (session.user.role !== "ADMIN") {
      where.userId = session.user.id;
    }
    if (p.q) where.description = { contains: p.q };
    if (p.status) where.module = p.status; // reuse status param as module filter

    const [items, total] = await Promise.all([
      db.activityLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: p.skip,
        take: p.limit,
        include: { user: { select: { name: true } } },
      }),
      db.activityLog.count({ where }),
    ]);

    return Response.json({ items, total, page: p.page, limit: p.limit });
  } catch (err) {
    return handleServerError(err);
  }
}
