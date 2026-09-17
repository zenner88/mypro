/**
 * PPMS — Login Seeder
 * Membuat / memperbarui akun login (owner) secara aman & idempotent.
 *
 * Pakai:
 *   npm run db:seed-login
 *   npm run db:seed-login -- --email nama@email.com --password rahasia123 --name "Nama Saya"
 *
 * Default (tanpa argumen / tanpa env):
 *   email:    admin@ppms.local
 *   password: admin123
 *
 * Bisa juga via environment (dipakai oleh Docker):
 *   SEED_EMAIL, SEED_PASSWORD, SEED_NAME
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

function readArg(flag: string): string | undefined {
  const argv = process.argv.slice(2);
  const idx = argv.indexOf(flag);
  return idx >= 0 ? argv[idx + 1] : undefined;
}

async function main() {
  const email = (readArg("--email") ?? process.env.SEED_EMAIL ?? "admin@ppms.local")
    .toLowerCase()
    .trim();
  const password = readArg("--password") ?? process.env.SEED_PASSWORD ?? "admin123";
  const name = readArg("--name") ?? process.env.SEED_NAME ?? "Owner";

  if (password.length < 8) {
    console.error("❌ Password minimal 8 karakter.");
    process.exit(1);
  }
  if (!email.includes("@")) {
    console.error("❌ Format email tidak valid.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const existing = await db.user.findUnique({ where: { email } });

  if (existing) {
    await db.user.update({
      where: { email },
      data: { passwordHash, name },
    });
    console.log(`✅ Akun diperbarui : ${email}`);
    console.log(`   Nama            : ${name}`);
    console.log(`   Password        : (sesuai yang diberikan)`);
  } else {
    // Jika database masih kosong, akun ini menjadi owner pertama.
    const total = await db.user.count();
    await db.user.create({
      data: { email, passwordHash, name, phone: null },
    });
    console.log(`✅ Akun login dibuat${total === 0 ? " (owner pertama)" : ""}: ${email}`);
    console.log(`   Nama            : ${name}`);
  }

  console.log("");
  console.log("Silakan login dengan email & password tersebut.");
}

main()
  .catch((e) => {
    console.error("❌ Gagal seeding login:", e.message);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
