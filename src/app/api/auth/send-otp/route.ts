import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendOtpEmail } from "@/lib/mailer";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, password } = body ?? {};

    if (!name || !email || !password || String(password).length < 8) {
      return NextResponse.json(
        { error: "Nama, email, dan password (min 8 karakter) wajib diisi" },
        { status: 400 }
      );
    }

    const cleanEmail = String(email).toLowerCase().trim();
    const existing = await db.user.findFirst({
      where: { email: cleanEmail, deletedAt: null },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Email sudah terdaftar. Silakan masuk menggunakan akun Anda." },
        { status: 400 }
      );
    }

    // Generate 6-digit numeric OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Upsert OTP verification record
    await db.otpVerification.upsert({
      where: { email: cleanEmail },
      create: {
        email: cleanEmail,
        code,
        name: String(name).trim(),
        password: String(password),
        expiresAt,
      },
      update: {
        code,
        name: String(name).trim(),
        password: String(password),
        expiresAt,
      },
    });

    const mailRes = await sendOtpEmail(cleanEmail, code, String(name).trim());

    return NextResponse.json({
      ok: true,
      message: `Kode OTP 6-digit telah dikirim ke ${cleanEmail}. Silakan cek email Anda.`,
      devCode: mailRes.provider === "dev_log" ? mailRes.code : undefined,
    });
  } catch (err) {
    console.error("[send-otp error]", err);
    return NextResponse.json({ error: "Gagal mengirimkan kode OTP" }, { status: 500 });
  }
}
