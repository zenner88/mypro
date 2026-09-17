import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, password, otp } = body ?? {};

    if (!name || !email || !password || String(password).length < 8) {
      return NextResponse.json(
        { error: "Nama, email, dan password (min 8 karakter) wajib diisi" },
        { status: 400 }
      );
    }

    if (!otp || String(otp).trim().length !== 6) {
      return NextResponse.json(
        { error: "Kode OTP 6-digit wajib diisi" },
        { status: 400 }
      );
    }

    const cleanEmail = String(email).toLowerCase().trim();
    const cleanOtp = String(otp).trim();

    // Check OTP record in database
    const otpRecord = await db.otpVerification.findUnique({
      where: { email: cleanEmail },
    });

    if (!otpRecord || otpRecord.code !== cleanOtp) {
      return NextResponse.json(
        { error: "Kode OTP yang Anda masukkan salah" },
        { status: 400 }
      );
    }

    if (new Date() > otpRecord.expiresAt) {
      return NextResponse.json(
        { error: "Kode OTP sudah kedaluwarsa. Silakan minta kode OTP baru." },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existing = await db.user.findFirst({
      where: { email: cleanEmail, deletedAt: null },
    });
    if (existing) {
      return NextResponse.json({ error: "Email sudah terdaftar. Silakan masuk." }, { status: 400 });
    }

    const userCount = await db.user.count({ where: { deletedAt: null } });
    const isFirstUser = userCount === 0;

    const user = await db.user.create({
      data: {
        name: String(name).trim(),
        email: cleanEmail,
        passwordHash: await bcrypt.hash(String(password), 12),
        role: isFirstUser ? "ADMIN" : "USER",
        plan: isFirstUser ? "PRO" : "FREE",
        maxProjects: isFirstUser ? 9999 : 1,
        maxInvoices: isFirstUser ? 9999 : 3,
      },
    });

    // Delete verified OTP record
    await db.otpVerification.delete({ where: { email: cleanEmail } }).catch(() => {});

    await logActivity({
      userId: user.id,
      action: "CREATED",
      module: "AUTH",
      recordId: user.id,
      description: `Akun ${isFirstUser ? "Admin/Owner" : "User"} terdaftar (OTP Verified): ${user.email}`,
    });

    return NextResponse.json(
      { ok: true, user: { id: user.id, email: user.email, plan: user.plan } },
      { status: 201 }
    );
  } catch (err) {
    console.error("[register error]", err);
    return NextResponse.json({ error: "Gagal membuat akun" }, { status: 500 });
  }
}
