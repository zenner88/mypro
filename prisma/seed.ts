import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  console.log("🌱 Seeding PPMS sample data...");

  const passwordHash = await bcrypt.hash("admin123", 12);

  // Owner account
  const owner = await db.user.upsert({
    where: { email: "admin@ppms.local" },
    update: {},
    create: {
      name: "Owner",
      email: "admin@ppms.local",
      passwordHash,
      phone: "081234567890",
    },
  });

  // Settings
  const settings: [string, string][] = [
    ["business_name", "John Freelance Studio"],
    ["business_address", "Jl. Sudirman No. 123, Jakarta Selatan 12190"],
    ["business_email", "hello@johnstudio.id"],
    ["business_phone", "+62 812-3456-7890"],
    ["business_website", "www.johnstudio.id"],
    ["invoice_prefix", "INV"],
    ["invoice_number_format", "{PREFIX}-{YEAR}-{NUMBER}"],
    ["invoice_default_tax_percent", "0"],
    ["invoice_default_payment_terms_days", "7"],
    ["invoice_notes", "Pembayaran dapat ditransfer ke rekening di atas. Mohon konfirmasi setelah transfer."],
    ["bank_name", "Bank Mandiri"],
    ["bank_account_name", "John Freelance Studio"],
    ["bank_account_number", "1234567890123"],
    ["payment_instructions", "Sertakan nomor invoice pada berita transfer."],
    ["timezone", "Asia/Jakarta"],
    ["currency", "IDR"],
    ["date_format", "DD/MM/YYYY"],
  ];
  for (const [key, value] of settings) {
    await db.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
  }

  // Number sequences for 2026 (so sample docs have nice numbers)
  for (const prefix of ["PRJ", "QUO", "INV", "REC", "CLI"]) {
    await db.numberSequence.upsert({
      where: { id: `${prefix}-2026` },
      create: { id: `${prefix}-2026`, current: 0 },
      update: {},
    });
  }

  // ---- Clients ----
  const client1 = await db.client.create({
    data: {
      code: "CLI-2026-0001",
      companyName: "PT ABC",
      contactPerson: "Budi Santoso",
      email: "budi@ptabc.co.id",
      phone: "021-5551234",
      whatsapp: "0812-1111-2222",
      address: "Jl. Gatot Subroto Kav. 5, Jakarta",
      website: "www.ptabc.co.id",
      isActive: true,
    },
  });

  const client2 = await db.client.create({
    data: {
      code: "CLI-2026-0002",
      companyName: "CV Maju Jaya",
      contactPerson: "Siti Rahayu",
      email: "siti@cvmajujaya.id",
      phone: "0271-555678",
      address: "Jl. Slamet Riyadi No. 88, Surakarta",
      isActive: true,
    },
  });

  const client3 = await db.client.create({
    data: {
      code: "CLI-2026-0003",
      companyName: "Yayasan Edukasi Nusantara",
      contactPerson: "Andi Wijaya",
      email: "andi@edukasi.or.id",
      phone: "022-5559090",
      isActive: true,
    },
  });

  // ---- Project 1: sesuai contoh spesifikasi ----
  const p1 = await db.project.create({
    data: {
      code: "PRJ-2026-0001",
      name: "Website Company Profile PT ABC",
      clientId: client1.id,
      description: "Company profile 8 halaman + blog + CMS sederhana",
      projectType: "website",
      status: "IN_PROGRESS",
      priority: "HIGH",
      startDate: new Date("2026-09-01"),
      targetCompletionDate: new Date("2026-09-30"),
      totalValue: 15000000,
      progress: 65,
    },
  });

  await db.projectItem.createMany({
    data: [
      { projectId: p1.id, name: "Development Website", description: "Frontend + backend + CMS", qty: 1, unitPrice: 12000000, sortOrder: 0 },
      { projectId: p1.id, name: "Copywriting", description: "8 halaman konten", qty: 1, unitPrice: 2000000, sortOrder: 1 },
      { projectId: p1.id, name: "Maintenance 3 bulan", description: "Update & backup mingguan", qty: 3, unitPrice: 300000, sortOrder: 2 },
    ],
  });

  await db.projectTimeline.createMany({
    data: [
      { projectId: p1.id, title: "Project Start", startDate: new Date("2026-09-01"), endDate: new Date("2026-09-01"), status: "COMPLETED", progress: 100, sortOrder: 0 },
      { projectId: p1.id, title: "UI Design", startDate: new Date("2026-09-03"), endDate: new Date("2026-09-06"), status: "COMPLETED", progress: 100, sortOrder: 1 },
      { projectId: p1.id, title: "Frontend Development", startDate: new Date("2026-09-07"), endDate: new Date("2026-09-14"), status: "COMPLETED", progress: 100, sortOrder: 2 },
      { projectId: p1.id, title: "Backend Development", startDate: new Date("2026-09-15"), endDate: new Date("2026-09-22"), status: "IN_PROGRESS", progress: 60, sortOrder: 3 },
      { projectId: p1.id, title: "Testing", startDate: new Date("2026-09-23"), endDate: new Date("2026-09-26"), status: "PENDING", progress: 0, sortOrder: 4 },
      { projectId: p1.id, title: "Client Review", startDate: new Date("2026-09-27"), endDate: new Date("2026-09-28"), status: "PENDING", progress: 0, sortOrder: 5 },
      { projectId: p1.id, title: "Final Delivery", startDate: new Date("2026-09-30"), endDate: new Date("2026-09-30"), status: "PENDING", progress: 0, sortOrder: 6 },
    ],
  });

  await db.task.createMany({
    data: [
      { projectId: p1.id, name: "Setup domain & hosting", status: "DONE", priority: "HIGH", progress: 100, dueDate: new Date("2026-09-02") },
      { projectId: p1.id, name: "Desain homepage", status: "DONE", priority: "HIGH", progress: 100, dueDate: new Date("2026-09-06") },
      { projectId: p1.id, name: "Integrasi CMS blog", status: "IN_PROGRESS", priority: "MEDIUM", progress: 50, dueDate: new Date("2026-09-20") },
      { projectId: p1.id, name: "Uji coba form kontak", status: "TODO", priority: "MEDIUM", progress: 0, dueDate: new Date("2026-09-25") },
    ],
  });

  const pay1 = await db.payment.create({
    data: { projectId: p1.id, clientId: client1.id, terminNumber: 1, description: "DP (Down Payment)", percentage: 30, amount: 4500000, amountPaid: 4500000, dueDate: new Date("2026-09-05"), paidDate: new Date("2026-09-03"), status: "PAID", paymentMethod: "BANK_TRANSFER", referenceNumber: "TRF-0903-01" },
  });
  await db.payment.create({
    data: { projectId: p1.id, clientId: client1.id, terminNumber: 2, description: "Development selesai", percentage: 40, amount: 6000000, amountPaid: 0, dueDate: new Date("2026-09-20"), status: "DUE" },
  });
  await db.payment.create({
    data: { projectId: p1.id, clientId: client1.id, terminNumber: 3, description: "Final delivery", percentage: 30, amount: 4500000, amountPaid: 0, dueDate: new Date("2026-09-30"), status: "PENDING" },
  });

  // Invoice for termin 1 (PAID)
  await db.invoice.create({
    data: {
      number: "INV-2026-0001",
      clientId: client1.id,
      projectId: p1.id,
      paymentId: pay1.id,
      invoiceDate: new Date("2026-09-01"),
      dueDate: new Date("2026-09-08"),
      description: "Termin 1 — Down Payment",
      subtotal: 4500000, discount: 0, taxPercent: 0, taxAmount: 0, total: 4500000,
      amountPaid: 4500000, status: "PAID",
      notes: "Pembayaran dapat ditransfer ke rekening di atas.",
      items: { create: [{ name: "Termin 1 — Down Payment 30%", qty: 1, unitPrice: 4500000, sortOrder: 0 }] },
    },
  });

  await db.receipt.create({
    data: {
      number: "REC-2026-0001",
      paymentId: pay1.id,
      amount: 4500000,
      paymentMethod: "BANK_TRANSFER",
      paidDate: new Date("2026-09-03"),
      notes: "Pembayaran penuh invoice INV-2026-0001",
    },
  });

  // ---- Project 2: quotation → project flow ----
  const q1 = await db.quotation.create({
    data: {
      number: "QUO-2026-0001",
      clientId: client2.id,
      subject: "Aplikasi Kasir (POS) CV Maju Jaya",
      quotationDate: new Date("2026-09-10"),
      validUntil: new Date("2026-09-30"),
      subtotal: 25000000, discount: 1000000, taxPercent: 0, taxAmount: 0, total: 24000000,
      status: "SENT",
      terms: "1. DP 30%\n2. Revisi maksimal 2x\n3. Delivery 30 hari kerja",
      items: {
        create: [
          { name: "Development Aplikasi POS", description: "Web-based, multi outlet", qty: 1, unitPrice: 20000000, sortOrder: 0 },
          { name: "Training & Dokumentasi", qty: 1, unitPrice: 3000000, sortOrder: 1 },
          { name: "Maintenance 6 bulan", qty: 6, unitPrice: 333333, sortOrder: 2 },
        ],
      },
    },
  });

  const p2 = await db.project.create({
    data: {
      code: "PRJ-2026-0002",
      name: "Aplikasi Kasir CV Maju Jaya",
      clientId: client2.id,
      description: "POS web-based 2 outlet",
      projectType: "desktop",
      status: "PROPOSAL",
      priority: "MEDIUM",
      startDate: new Date("2026-10-01"),
      targetCompletionDate: new Date("2026-11-15"),
      totalValue: 0, // will be filled when quotation approved
    },
  });

  await db.quotation.update({
    where: { id: q1.id },
    data: { projectId: p2.id },
  });

  // ---- Project 3: completed ----
  const p3 = await db.project.create({
    data: {
      code: "PRJ-2026-0003",
      name: "Landing Page Yayasan Edukasi",
      clientId: client3.id,
      projectType: "website",
      status: "COMPLETED",
      priority: "LOW",
      startDate: new Date("2026-07-01"),
      targetCompletionDate: new Date("2026-07-31"),
      actualCompletionDate: new Date("2026-07-28"),
      totalValue: 5000000,
      progress: 100,
    },
  });

  const pay3 = await db.payment.create({
    data: { projectId: p3.id, clientId: client3.id, terminNumber: 1, description: "Pembayaran penuh", percentage: 100, amount: 5000000, amountPaid: 5000000, dueDate: new Date("2026-07-10"), paidDate: new Date("2026-07-05"), status: "PAID", paymentMethod: "BANK_TRANSFER" },
  });

  await db.invoice.create({
    data: {
      number: "INV-2026-0002",
      clientId: client3.id,
      projectId: p3.id,
      paymentId: pay3.id,
      invoiceDate: new Date("2026-07-01"),
      dueDate: new Date("2026-07-08"),
      description: "Landing page — pembayaran penuh",
      subtotal: 5000000, discount: 0, taxPercent: 0, taxAmount: 0, total: 5000000,
      amountPaid: 5000000, status: "PAID",
      items: { create: [{ name: "Landing page 1 halaman + hosting 1 tahun", qty: 1, unitPrice: 5000000, sortOrder: 0 }] },
    },
  });

  // ---- Activity logs ----
  await db.activityLog.createMany({
    data: [
      { userId: owner.id, action: "CREATED", module: "CLIENT", recordId: client1.id, description: "Client dibuat: PT ABC (CLI-2026-0001)" },
      { userId: owner.id, action: "CREATED", module: "PROJECT", recordId: p1.id, description: "Project dibuat: Website Company Profile PT ABC (PRJ-2026-0001)" },
      { userId: owner.id, action: "CREATED", module: "QUOTATION", recordId: q1.id, description: "Quotation QUO-2026-0001 dibuat" },
      { userId: owner.id, action: "CREATED", module: "INVOICE", recordId: null, description: "Invoice INV-2026-0001 dibuat" },
      { userId: owner.id, action: "PAID", module: "INVOICE", recordId: null, description: "Invoice INV-2026-0001 lunas (Rp 4.500.000). Receipt REC-2026-0001 dibuat." },
      { userId: owner.id, action: "STATUS_CHANGED", module: "PROJECT", recordId: p3.id, description: "Status project \"Landing Page Yayasan Edukasi\" berubah dari IN_PROGRESS ke COMPLETED" },
    ],
  });

  // Update sequences to reflect seeded docs
  await db.numberSequence.update({ where: { id: "PRJ-2026" }, data: { current: 3 } });
  await db.numberSequence.update({ where: { id: "QUO-2026" }, data: { current: 1 } });
  await db.numberSequence.update({ where: { id: "INV-2026" }, data: { current: 2 } });
  await db.numberSequence.update({ where: { id: "REC-2026" }, data: { current: 1 } });
  await db.numberSequence.update({ where: { id: "CLI-2026" }, data: { current: 3 } });

  console.log("✅ Seed selesai!");
  console.log("   Login: admin@ppms.local / admin123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
