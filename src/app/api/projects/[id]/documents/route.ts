import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleServerError } from "@/lib/api-utils";
import { logActivity } from "@/lib/activity";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

const ALLOWED_EXT = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "jpg", "jpeg", "png", "zip"];

function getMaxBytes(): number {
  return (Number(process.env.MAX_UPLOAD_MB) || 25) * 1024 * 1024;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAuth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const documents = await db.document.findMany({
      where: { projectId: params.id, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });
    return Response.json({ items: documents });
  } catch (err) {
    return handleServerError(err);
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAuth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const project = await db.project.findFirst({ where: { id: params.id, deletedAt: null } });
    if (!project) return Response.json({ error: "Project tidak ditemukan" }, { status: 404 });

    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return Response.json({ error: "File wajib diupload" }, { status: 400 });

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED_EXT.includes(ext)) {
      return Response.json(
        { error: `Format tidak diizinkan. Gunakan: ${ALLOWED_EXT.join(", ").toUpperCase()}` },
        { status: 400 }
      );
    }
    if (file.size > getMaxBytes()) {
      return Response.json(
        { error: `Ukuran file melebihi batas ${process.env.MAX_UPLOAD_MB ?? 25} MB` },
        { status: 400 }
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());

    // Store as {projectId}/{timestamp}-{safe-name}
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storedName = `${Date.now()}-${safeName}`;
    const dir = path.join(process.cwd(), process.env.UPLOAD_DIR ?? "./storage/project-documents", params.id);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, storedName), bytes);

    // Simple versioning: same name & category => version+1
    const prior = await db.document.findFirst({
      where: { projectId: params.id, name: form.get("name")?.toString() || file.name, deletedAt: null },
      orderBy: { version: "desc" },
    });
    const version = prior ? prior.version + 1 : 1;

    const doc = await db.document.create({
      data: {
        projectId: params.id,
        clientId: project.clientId,
        name: (form.get("name")?.toString() || file.name).trim(),
        category: form.get("category")?.toString() || "OTHER",
        description: form.get("description")?.toString() || null,
        filePath: path.join(params.id, storedName),
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        fileSize: file.size,
        version,
        uploadedBy: session.user.id,
      },
    });

    await logActivity({
      userId: session.user.id,
      action: "UPLOADED",
      module: "DOCUMENT",
      recordId: doc.id,
      description: `Dokumen "${doc.name}" (v${doc.version}) diupload ke project ${project.name}`,
    });

    return Response.json(doc, { status: 201 });
  } catch (err) {
    return handleServerError(err);
  }
}
