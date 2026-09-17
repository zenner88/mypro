import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleServerError } from "@/lib/api-utils";
import { logActivity } from "@/lib/activity";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAuth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    if (!body.title) return Response.json({ error: "Judul timeline wajib diisi" }, { status: 400 });

    const count = await db.projectTimeline.count({ where: { projectId: params.id } });

    const timeline = await db.projectTimeline.create({
      data: {
        projectId: params.id,
        title: body.title,
        description: body.description || null,
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        status: body.status || "PENDING",
        progress: Math.min(100, Math.max(0, Number(body.progress) || 0)),
        notes: body.notes || null,
        sortOrder: count,
      },
    });

    await logActivity({
      userId: session.user.id,
      action: "CREATED",
      module: "PROJECT",
      recordId: params.id,
      description: `Timeline "${timeline.title}" ditambahkan`,
    });

    return Response.json(timeline, { status: 201 });
  } catch (err) {
    return handleServerError(err);
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAuth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    if (!body.id) return Response.json({ error: "ID timeline wajib" }, { status: 400 });

    const data: any = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.description !== undefined) data.description = body.description;
    if (body.startDate !== undefined) data.startDate = body.startDate ? new Date(body.startDate) : null;
    if (body.endDate !== undefined) data.endDate = body.endDate ? new Date(body.endDate) : null;
    if (body.status !== undefined) data.status = body.status;
    if (body.progress !== undefined) data.progress = Math.min(100, Math.max(0, Number(body.progress)));
    if (body.notes !== undefined) data.notes = body.notes;

    const timeline = await db.projectTimeline.update({ where: { id: body.id }, data });

    // Auto-sync project progress from timeline average
    const timelines = await db.projectTimeline.findMany({ where: { projectId: params.id } });
    if (timelines.length > 0) {
      const avg = Math.round(timelines.reduce((s, t) => s + t.progress, 0) / timelines.length);
      await db.project.update({ where: { id: params.id }, data: { progress: avg } });
    }

    return Response.json(timeline);
  } catch (err) {
    return handleServerError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAuth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const sp = new URL(req.url).searchParams;
    const timelineId = sp.get("timelineId");
    if (!timelineId) return Response.json({ error: "timelineId wajib" }, { status: 400 });

    await db.projectTimeline.delete({ where: { id: timelineId } });
    return Response.json({ ok: true });
  } catch (err) {
    return handleServerError(err);
  }
}
