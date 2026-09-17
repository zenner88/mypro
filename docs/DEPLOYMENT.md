# PPMS — Panduan Deployment Ubuntu Server

Target: Ubuntu 22.04/24.04 + Nginx + Node.js (PM2) + MySQL 8.
(Nama aplikasi: `ppms`, domain contoh: `ppms.example.com`)

---

## 1. Install Dependency

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx mysql-server git
sudo npm install -g pm2
```

## 2. Siapkan Database MySQL

```bash
sudo mysql
```
```sql
CREATE DATABASE ppms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'ppms_user'@'localhost' IDENTIFIED BY 'GANTI_PASSWORD_KUAT';
GRANT ALL PRIVILEGES ON ppms.* TO 'ppms_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

## 3. Deploy Aplikasi

```bash
sudo mkdir -p /var/www/ppms && sudo chown $USER /var/www/ppms
git clone <repo-anda> /var/www/ppms   # atau upload via scp/rsync
cd /var/www/ppms
```

Ganti provider database di `prisma/schema.prisma`:
```prisma
datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}
```

Buat `/var/www/ppms/.env`:
```env
DATABASE_URL="mysql://ppms_user:GANTI_PASSWORD_KUAT@localhost:3306/ppms"
NEXTAUTH_URL="https://ppms.example.com"
NEXTAUTH_SECRET="hasil-dari-openssl-rand-base64-32"
UPLOAD_DIR="./storage/project-documents"
MAX_UPLOAD_MB="25"
```

```bash
npm install
npx prisma db push        # buat semua tabel
npm run db:seed           # opsional: sample data (JANGAN di produksi bila tidak perlu)
npm run build
```

> Jika memakai seed, segera login lalu ganti password default di Settings → Profil.

## 4. Jalankan dengan PM2

```bash
pm2 start npm --name ppms -- start
pm2 save
pm2 startup   # ikuti instruksi yang muncul
```

Aplikasi berjalan di port 3000 (atur `PORT` di .env bila perlu — script `start` memakai `-p 3000`; alternatif: `pm2 start "npx next start -p 3000" --name ppms`).

## 5. Konfigurasi Nginx

```bash
sudo tee /etc/nginx/sites-available/ppms > /dev/null << 'EOF'
server {
    listen 80;
    server_name ppms.example.com;

    client_max_body_size 30m;   # samakan dengan MAX_UPLOAD_MB

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF
sudo ln -s /etc/nginx/sites-available/ppms /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## 6. HTTPS (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d ppms.example.com
```

## 7. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

## 8. Backup

```bash
# Database harian
0 2 * * * mysqldump -u ppms_user -p'PASSWORD' ppms | gzip > /var/backups/ppms-$(date +\%F).sql.gz

# Dokumen (folder storage)
0 2 * * * tar -czf /var/backups/ppms-docs-$(date +\%F).tar.gz /var/www/ppms/storage
```

## 9. Update Aplikasi

```bash
cd /var/www/ppms
git pull
npm install
npx prisma db push
npm run build
pm2 restart ppms
```

## 10. Migrasi storage ke S3/MinIO (nanti)

Kode sudah terpusat di dua file: `src/app/api/projects/[id]/documents/route.ts` (upload) dan `src/app/api/documents/[id]/route.ts` (download). Ganti `fs/promises` dengan S3 client (mis. `@aws-sdk/client-s3`) dan simpan `filePath` sebagai object key — skema database tidak berubah.

---

## Troubleshooting

| Masalah | Solusi |
|---|---|
| `EADDRINUSE :3000` | `PORT` dipakai proses lain → `pm2 delete ppms` lalu start dengan port lain, atau matikan proses lama |
| Login gagal setelah deploy | Pastikan `NEXTAUTH_URL` = URL publik & `NEXTAUTH_SECRET` sama |
| Upload gagal 413 | Naikkan `client_max_body_size` Nginx & `MAX_UPLOAD_MB` |
| PDF tidak muncul rapi | Print memakai Chrome/Edge; pastikan margin "Default" & header/footer off |
