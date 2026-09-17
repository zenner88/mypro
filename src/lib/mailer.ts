import nodemailer from "nodemailer";

export async function sendOtpEmail(toEmail: string, otpCode: string, name?: string) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || '"MYPro SaaS" <noreply@mypro.app>';

  const subject = `[MYPro] Kode OTP Verifikasi Pendaftaran: ${otpCode}`;
  const htmlContent = `
    <div style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; rounded-radius: 16px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; width: 48px; height: 48px; background: linear-gradient(135deg, #059669, #14b8a6); border-radius: 12px; color: #ffffff; font-weight: 900; font-size: 24px; line-height: 48px; text-align: center;">M</div>
        <h2 style="color: #0f172a; margin-top: 12px; font-weight: 800;">Verifikasi Akun MYPro</h2>
      </div>

      <p style="color: #334155; font-size: 14px;">Halo <strong>${name || toEmail}</strong>,</p>
      <p style="color: #334155; font-size: 14px; line-height: 1.6;">
        Terima kasih telah mendaftar di MYPro. Gunakan kode OTP 6-digit berikut untuk memverifikasi pendaftaran akun Anda:
      </p>

      <div style="background-color: #f0fdf4; border: 2px dashed #059669; border-radius: 12px; padding: 16px; text-align: center; margin: 24px 0;">
        <span style="font-size: 32px; font-weight: 900; letter-spacing: 6px; color: #047857;">${otpCode}</span>
        <p style="font-size: 11px; color: #059669; margin-top: 8px; font-weight: 600;">Kode berlaku selama 10 menit</p>
      </div>

      <p style="color: #64748b; font-size: 12px; line-height: 1.5;">
        Jika Anda tidak merasa mendaftar di MYPro, silakan abaikan email ini.
      </p>

      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />

      <p style="text-align: center; color: #94a3b8; font-size: 11px;">
        &copy; ${new Date().getFullYear()} MYPro — SaaS Project & Billing Management
      </p>
    </div>
  `;

  if (host && user && pass) {
    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });

      await transporter.sendMail({
        from,
        to: toEmail,
        subject,
        html: htmlContent,
      });

      console.log(`[MYPro Mailer] OTP ${otpCode} successfully sent to ${toEmail} via SMTP`);
      return { sent: true, provider: "smtp" };
    } catch (err) {
      console.error(`[MYPro Mailer Error] Failed sending to SMTP:`, err);
    }
  }

  // Fallback / Development mode logging
  console.log("=================================================");
  console.log(`[MYPro Mailer DEV] OTP for ${toEmail}: ${otpCode}`);
  console.log("=================================================");
  return { sent: true, provider: "dev_log", code: otpCode };
}
