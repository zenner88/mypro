import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const count = await db.user.count();
  return NextResponse.json({ needsSetup: count === 0 });
}
