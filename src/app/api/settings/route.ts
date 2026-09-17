import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, handleServerError } from "@/lib/api-utils";
import { getAllSettings, setSettings } from "@/lib/settings";
import { logActivity } from "@/lib/activity";

export async function GET() {
  const session = await requireAuth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const settings = await getAllSettings();
    return Response.json({ settings });
  } catch (err) {
    return handleServerError(err);
  }
}

export async function PUT(req: NextRequest) {
  const session = await requireAuth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const values: Record<string, string> = {};
    for (const [k, v] of Object.entries(body)) {
      if (typeof v === "string" || typeof v === "number") values[k] = String(v);
    }
    await setSettings(values);

    await logActivity({
      userId: session.user.id,
      action: "UPDATED",
      module: "SETTINGS",
      recordId: null,
      description: `Pengaturan diperbarui (${Object.keys(values).join(", ")})`,
    });

    const settings = await getAllSettings();
    return Response.json({ settings });
  } catch (err) {
    return handleServerError(err);
  }
}
