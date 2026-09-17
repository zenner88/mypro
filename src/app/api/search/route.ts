import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleServerError } from "@/lib/api-utils";

export async function GET(req: NextRequest) {
  const session = await requireAuth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
    if (q.length < 2) return Response.json({ groups: [] });

    const userFilter = session.user.role !== "ADMIN" ? { userId: session.user.id } : {};
    const docUserFilter = session.user.role !== "ADMIN" ? { project: { userId: session.user.id } } : {};

    const [clients, projects, invoices, quotations, documents] = await Promise.all([
      db.client.findMany({
        where: { deletedAt: null, ...userFilter, OR: [{ companyName: { contains: q } }, { contactPerson: { contains: q } }] },
        take: 5,
        select: { id: true, companyName: true, code: true },
      }),
      db.project.findMany({
        where: { deletedAt: null, ...userFilter, OR: [{ name: { contains: q } }, { code: { contains: q } }] },
        take: 5,
        select: { id: true, name: true, code: true, status: true },
      }),
      db.invoice.findMany({
        where: { deletedAt: null, ...userFilter, number: { contains: q } },
        take: 5,
        select: { id: true, number: true, total: true, status: true },
      }),
      db.quotation.findMany({
        where: { deletedAt: null, ...userFilter, OR: [{ number: { contains: q } }, { subject: { contains: q } }] },
        take: 5,
        select: { id: true, number: true, subject: true, status: true },
      }),
      db.document.findMany({
        where: { deletedAt: null, ...docUserFilter, name: { contains: q } },
        take: 5,
        select: { id: true, name: true, projectId: true },
      }),
    ]);

    return Response.json({
      groups: [
        { label: "Clients", items: clients.map((c) => ({ id: c.id, title: c.companyName, subtitle: c.code, href: `/clients/${c.id}` })) },
        { label: "Projects", items: projects.map((p) => ({ id: p.id, title: p.name, subtitle: `${p.code} · ${p.status}`, href: `/projects/${p.id}` })) },
        { label: "Invoices", items: invoices.map((i) => ({ id: i.id, title: i.number, subtitle: `Rp ${Number(i.total).toLocaleString("id-ID")}`, href: `/invoices/${i.id}` })) },
        { label: "Quotations", items: quotations.map((qt) => ({ id: qt.id, title: qt.number, subtitle: qt.subject, href: `/quotations/${qt.id}` })) },
        { label: "Documents", items: documents.map((d) => ({ id: d.id, title: d.name, subtitle: "Dokumen project", href: `/projects/${d.projectId}?tab=documents` })) },
      ].filter((g) => g.items.length > 0),
    });
  } catch (err) {
    return handleServerError(err);
  }
}
