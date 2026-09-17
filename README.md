# PPMS — Personal Project Management & Billing System

Aplikasi web untuk freelancer/developer mengelola project pribadi: dari client masuk, penawaran, pengerjaan, pembayaran bertahap (termin), invoice, sampai project selesai dan dokumentasi.

**Stack:** Next.js 14 (React 18) · Prisma ORM · SQLite (dev) / MySQL (prod) · Tailwind CSS · NextAuth · Recharts

---

## ✨ Fitur

| Modul | Fitur |
|---|---|
| **Dashboard** | Statistik project (total/aktif/selesai/pending/overdue), ringkasan keuangan (nilai project, diterima, piutang, overdue), grafik penerimaan 6 bulan, project berjalan, pembayaran mendatang, aktivitas terakhir |
| **Clients** | CRUD, search, filter status, halaman detail (project, invoice, dokumen, total nilai/pembayaran/outstanding) |
| **Projects** | CRUD, kode otomatis `PRJ-YYYY-NNNN`, status 8 tahap, prioritas, progress bar |
| **Project Detail** | 7 tab: Overview, Timeline visual, Tasks, Pricing (item harga otomatis menghitung total), Payments (termin %), Invoices, Documents, Activity |
| **Quotations** | Nomor otomatis `QUO-YYYY-NNNN`, item dinamis, pajak & diskon, print A4, **Convert to Project** (item ikut tersalin) |
| **Invoices** | Nomor otomatis **race-safe** `INV-YYYY-NNNN`, print A4 profesional, duplicate, mark-sent, mark-paid (+receipt), record partial payment, cancel |
| **Payments** | Termin %, status otomatis (PENDING/DUE/OVERDUE/PAID), catat pembayaran, **Receipt PDF** `REC-YYYY-NNNN` |
| **Documents** | Upload per project, kategori, **versi otomatis**, download tervalidasi, batas ukuran & tipe file |
| **Reports** | 4 jenis laporan + filter tanggal/status + **Export CSV** + print |
| **Lainnya** | Global search, notifikasi (invoice overdue, deadline), activity log, settings lengkap, responsive (desktop/tablet/mobile) |

---

## 🚀 Menjalankan

```bash
cd ppms
npm install        # install dependencies + generate prisma client
npx prisma db push # buat schema database
npm run db:seed    # sample data
npm run dev        # http://localhost:3000
```

**Login sample:**
```
Email:    admin@ppms.local
Password: admin123
```

> Jika port 3000 sudah dipakai aplikasi lain: `npm run dev -- -p 3100` (atau set `PORT=3100`).

---

## 🐳 Jalankan dengan Docker (port 3088)

```bash
cd ppms
docker-compose up -d --build
```

Aplikasi berjalan di **http://localhost:3088**

| Hal | Detail |
|---|---|
| Akun login awal | Otomatis dibuat saat container start dari `SEED_EMAIL` / `SEED_PASSWORD` (default `admin@ppms.local` / `admin123`) |
| Data persisten | Database (volume `ppms_db`) & file upload (volume `ppms_storage`) bertahan walau container dihapus |
| Sample data penuh | Default Docker hanya membuat akun login; untuk data contoh jalankan: `docker exec ppms-app npx tsx prisma/seed.ts` |
| Ganti login | Edit `SEED_EMAIL`/`SEED_PASSWORD` di `docker-compose.yml` lalu `docker-compose up -d` (password akun lama ikut di-reset) |
| Lihat log | `docker logs -f ppms-app` |
| Stop | `docker-compose down` (data tetap aman di volume) |

MySQL via Docker: lihat komentar di bagian bawah `docker-compose.yml`.

---

## 🔑 Seeder Login (tanpa Docker)

Membuat / reset akun login kapan saja (idempotent, aman diulang):

```bash
npm run db:seed-login                                          # default admin@ppms.local / admin123
npm run db:seed-login -- --email saya@mail.com --password rahasia123 --name "Nama Saya"
```

Atau via environment: `SEED_EMAIL`, `SEED_PASSWORD`, `SEED_NAME`.

> Saat pertama dijalankan dengan database kosong, halaman login otomatis menampilkan form **Setup Awal** untuk membuat akun owner.

---

## 📂 Struktur

```
ppms/
├── prisma/
│   ├── schema.prisma      # 15 tabel relasional
│   └── seed.ts            # sample data
├── src/
│   ├── app/
│   │   ├── api/           # REST API (route handlers)
│   │   ├── login/         # halaman login + setup owner
│   │   └── (app)/         # halaman terproteksi (sidebar layout)
│   │       ├── dashboard/
│   │       ├── projects/  # list + [id] 7 tab
│   │       ├── clients/   # list + [id]
│   │       ├── quotations/
│   │       ├── invoices/
│   │       ├── payments/
│   │       ├── documents/
│   │       ├── reports/
│   │       ├── activity/
│   │       ├── search/
│   │       └── settings/
│   ├── components/        # UI kit + DataTable + shared
│   ├── lib/               # db, auth, numbering, finance, settings, format
│   └── middleware.ts      # proteksi route
└── storage/project-documents/  # file upload (di luar public/)
```

---

## 🔌 API Ringkas

| Endpoint | Method | Keterangan |
|---|---|---|
| `/api/clients` | GET, POST | List (search/pagination) / create |
| `/api/clients/[id]` | GET, PUT, DELETE | Detail + stats / update / soft-delete |
| `/api/projects` | GET, POST | List (filter status/client) / create |
| `/api/projects/[id]` | GET, PUT, DELETE | Detail + stats / update / delete |
| `/api/projects/[id]/timelines` | POST, PUT, DELETE | CRUD timeline |
| `/api/projects/[id]/tasks` | POST, PUT, DELETE | CRUD task |
| `/api/projects/[id]/items` | POST, PUT, DELETE | CRUD item harga (auto total) |
| `/api/projects/[id]/payments` | POST, PUT, DELETE | CRUD termin + catat pembayaran |
| `/api/projects/[id]/documents` | GET, POST | List / upload (multipart) |
| `/api/quotations` | GET, POST | List / create |
| `/api/quotations/[id]` | GET, PUT, DELETE | Detail / update / delete |
| `/api/quotations/[id]/convert` | POST | Convert quotation → project |
| `/api/invoices` | GET, POST | List / create (dari project/termin) |
| `/api/invoices/[id]` | GET, PUT, DELETE | Detail+settings / update / delete |
| `/api/invoices/[id]/actions` | POST | duplicate, mark-paid, mark-sent, record-payment, cancel |
| `/api/receipts` | GET, POST | List / create dari termin |
| `/api/documents` | GET | List global |
| `/api/documents/[id]` | GET, PUT, DELETE | Download (auth) / rename / delete |
| `/api/dashboard` | GET | Statistik agregat |
| `/api/notifications` | GET | Notifikasi overdue/deadline |
| `/api/reports?type=` | GET | 4 jenis laporan, `&format=csv` untuk export |
| `/api/activity` | GET | Activity log |
| `/api/search?q=` | GET | Global search |
| `/api/settings` | GET, PUT | Pengaturan aplikasi |
| `/api/profile` | PUT, POST | Update profil / ganti password |

---

## 🔒 Business Rules yang Diimplementasikan

1. ✅ Kode otomatis & unik: `PRJ-`, `QUO-`, `INV-`, `REC-`, `CLI-` + tahun + counter 4 digit
2. ✅ Penomoran **aman dari race condition** — upsert+increment dalam satu transaction
3. ✅ Invoice dengan pembayaran **tidak bisa dihapus**
4. ✅ Project dengan invoice terbayar **tidak bisa dihapus**
5. ✅ Client dengan project aktif **tidak bisa dihapus**
6. ✅ Pembayaran melebihi nilai project → perlu konfirmasi eksplisit (HTTP 409 + `confirmed:true`)
7. ✅ Status payment/invoice overdu dihitung otomatis dari due date
8. ✅ Total paid & outstanding dihitung otomatis
9. ✅ Semua perubahan penting tercatat di Activity Log
10. ✅ Uang disimpan sebagai **Decimal** (bukan string), diformat `Rp 1.500.000` hanya di tampilan

## 🔐 Security

- Password bcrypt (12 rounds), tidak pernah plaintext
- Session JWT httpOnly via NextAuth + middleware route protection
- Semua API mengecek sesi; download dokumen lewat endpoint tervalidasi (anti path-traversal)
- Prisma = parameterized queries (anti SQL injection)
- React auto-escaping (anti XSS); validasi tipe & ukuran file upload

---

## 🗄️ Migrasi ke MySQL (Produksi)

1. Ganti provider di `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "mysql"
     url      = env("DATABASE_URL")
   }
   ```
2. Update `.env`:
   ```
   DATABASE_URL="mysql://ppms_user:PASSWORD@localhost:3306/ppms"
   ```
3. Jalankan:
   ```bash
   npx prisma db push
   npm run db:seed
   ```
Panduan server lengkap: **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**

## 📐 Arsitektur & ERD

Lihat **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — ERD, relasi antar tabel, business flow, dan daftar keputusan teknis.
