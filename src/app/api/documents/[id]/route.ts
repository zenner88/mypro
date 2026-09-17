import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleServerError } from "@/lib/api-utils";
import { logActivity } from "@/lib/activity";
import { readFile } from "fs/promises";
import path from "path";

const STORAGE_ROOT = process.env.UPLOAD_DIR ?? "./storage/project-documents";

function resolveSafe(relPath: string): string {
  const root = path.resolve(process.cwd(), STORAGE_ROOT);
  const full = path.resolve(root, relPath);
  if (!full.startsWith(root)) throw new Error("Path traversal detected");
  return full;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAuth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const sp = new URL(req.url).searchParams;
    const asAttachment = sp.get("download") === "1";

    const doc = await db.document.findFirst({ where: { id: params.id, deletedAt: null } });
    if (!doc) return Response.json({ error: "Dokumen tidak ditemukan" }, { status: 404 });

    const filePath = resolveSafe(doc.filePath);
    const file = await readFile(filePath);

    if (!asAttachment) {
      await logActivity({
        userId: session.user.id,
        action: "DOWNLOADED",
        module: "DOCUMENT",
        recordId: doc.id,
        description: `Dokumen "${doc.name}" dilihat/diunduh`,
      });
    }

    const headers = new Headers();
    headers.set("Content-Type", doc.mimeType);
    headers.set("Content-Length", String(file.length));
    if (asAttachment) {
      headers.set("Content-Disposition", `attachment; filename="${encodeURIComponent(doc.fileName)}"`);
    } else {
      headers.set("Content-Disposition", `inline; filename="${encodeURIComponent(doc.fileName)}"`);
    }

    return new Response(new Uint8Array(file), { headers });
  } catch (err) {
    return handleServerError(err);
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAuth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const doc = await db.document.findFirst({ where: { id: params.id, deletedAt: null } });
    if (!doc) return Response.json({ error: "Dokumen tidak ditemukan" }, { status: 404 });

    const updated = await db.document.update({
      where: { id: params.id },
      data: {
        name: body.name?.trim() || doc.name,
        category: body.category || doc.category,
        description: body.description !== undefined ? body.description : doc.description,
      },
    });

    await logActivity({
      userId: session.user.id,
      action: "UPDATED",
      module: "DOCUMENT",
      recordId: doc.id,
      description: `Dokumen "${doc.name}" diubah menjadi "${updated.name}"`,
    });

    return Response.json(updated);
  } catch (err) {
    return handleServerError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAuth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const doc = await db.document.findFirst({ where: { id: params.id, deletedAt: null } });
    if (!doc) return Response.json({ error: "Dokumen tidak ditemukan" }, { status: 404 });

    await db.document.update({ where: { id: params.id }, data: { deletedAt: new Date() } });

    await logActivity({
      userId: session.user.id,
      action: "DELETED",
      module: "DOCUMENT",
      recordId: doc.id,
      description: `Dokumen "${doc.name}" dihapus`,
    });

    return Response.json({ ok: true });
  } catch (err) {
    return handleServerError(err);
  }
}
