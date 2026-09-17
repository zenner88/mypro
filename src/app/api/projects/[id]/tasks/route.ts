import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleServerError } from "@/lib/api-utils";
import { logActivity } from "@/lib/activity";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAuth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    if (!body.name) return Response.json({ error: "Nama task wajib diisi" }, { status: 400 });

    const task = await db.task.create({
      data: {
        projectId: params.id,
        name: body.name,
        description: body.description || null,
        startDate: body.startDate ? new Date(body.startDate) : null,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        status: body.status || "TODO",
        priority: body.priority || "MEDIUM",
        progress: Math.min(100, Math.max(0, Number(body.progress) || 0)),
        notes: body.notes || null,
      },
    });

    await logActivity({
      userId: session.user.id,
      action: "CREATED",
      module: "PROJECT",
      recordId: params.id,
      description: `Task "${task.name}" ditambahkan`,
    });

    return Response.json(task, { status: 201 });
  } catch (err) {
    return handleServerError(err);
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAuth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    if (!body.id) return Response.json({ error: "ID task wajib" }, { status: 400 });

    const data: any = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.description !== undefined) data.description = body.description;
    if (body.startDate !== undefined) data.startDate = body.startDate ? new Date(body.startDate) : null;
    if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    if (body.status !== undefined) data.status = body.status;
    if (body.priority !== undefined) data.priority = body.priority;
    if (body.progress !== undefined) data.progress = Math.min(100, Math.max(0, Number(body.progress)));
    if (body.notes !== undefined) data.notes = body.notes;

    // Keep progress & status consistent
    if (data.status === "DONE" && data.progress === undefined) data.progress = 100;

    const task = await db.task.update({ where: { id: body.id }, data });

    // Auto-sync project progress from tasks average
    const tasks = await db.task.findMany({ where: { projectId: params.id } });
    if (tasks.length > 0) {
      const avg = Math.round(tasks.reduce((s, t) => s + t.progress, 0) / tasks.length);
      await db.project.update({ where: { id: params.id }, data: { progress: avg } });
    }

    return Response.json(task);
  } catch (err) {
    return handleServerError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAuth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const sp = new URL(req.url).searchParams;
    const taskId = sp.get("taskId");
    if (!taskId) return Response.json({ error: "taskId wajib" }, { status: 400 });

    await db.task.delete({ where: { id: taskId } });
    return Response.json({ ok: true });
  } catch (err) {
    return handleServerError(err);
  }
}
