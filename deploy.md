# Deployment Kepala Babi (Vercel + Neon)

Panduan dari nol sampai game teruji di production.

## 0. Prasyarat

- Node.js 20+
- Akun GitHub, Vercel, Neon, dan BotFather
- Repo sudah berisi `api/`, `backend/`, `package.json` root, dan `vercel.json`

## 1. Buat Bot Telegram

1. Chat @BotFather → `/newbot` → simpan **token**.
2. Simpan **username** bot (tanpa `@`).
3. Opsional: `/setprivacy` → Disable bila ingin bot membaca pesan grup (command dan tombol tetap jalan tanpanya).

## 2. Buat Database Neon

### Opsi A — lewat Vercel Marketplace (paling mudah)

1. Buka dashboard Vercel → **Storage** → **Create Database** → **Neon**.
2. Pilih region terdekat, buat database.
3. Connect ke project Vercel. Environment variable `DATABASE_URL` akan ter-inject otomatis (versi pooled). Ada juga `DATABASE_URL_UNPOOLED` untuk migrasi; aplikasi ini memakai `DATABASE_URL`.

### Opsi B — langsung di neon.tech

1. Buat project di https://console.neon.tech
2. Salin connection string **pooled** (host mengandung `-pooler`):

```text
postgresql://user:password@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require
```

Catatan: serverless Vercel **wajib** memakai database. Tanpa `DATABASE_URL`, state in-memory tidak bertahan antar request.

## 3. Migrasi Database (dari lokal)

```bash
cd backend
cp .env.example .env
```

Isi `backend/.env`:

```text
DATABASE_URL=postgresql://...-pooler...neon.tech/neondb?sslmode=require
```

Jalankan:

```bash
npm install
npm run migrate
```

Output yang diharapkan:

```text
applied 001_init.sql
Migrasi selesai.
```

Verifikasi di Neon SQL Editor:

```sql
SELECT filename, applied_at FROM schema_migrations;
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
```

Tabel yang harus ada: `users`, `games`, `game_players`, `game_cards`, `schema_migrations`.

## 4. Push ke GitHub

```bash
git init
git add .
git commit -m "Kepala Babi: bot Telegram + game engine"
git branch -M main
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin main
```

Pastikan `backend/.env` tidak ikut ter-commit (sudah ada di `.gitignore`).

## 5. Deploy ke Vercel

### Opsi A — Dashboard

1. **Add New → Project** → import repo GitHub.
2. Framework Preset: **Other**. Root Directory: **root repo** (biarkan default).
3. Tambahkan Environment Variables (semua environment: Production, Preview, Development):

| Variable | Wajib | Contoh |
| --- | --- | --- |
| `DATABASE_URL` | ya | `postgresql://...-pooler...neon.tech/neondb?sslmode=require` |
| `TELEGRAM_BOT_TOKEN` | ya | `123456:ABC...` |
| `TELEGRAM_BOT_USERNAME` | ya | `kepalababi_bot` |
| `TELEGRAM_WEBHOOK_SECRET` | disarankan | string acak panjang |
| `PUBLIC_URL` | disarankan | `https://kepala-babi.vercel.app` |

4. **Deploy**.

### Opsi B — Vercel CLI

```bash
npm i -g vercel
vercel link
vercel env add DATABASE_URL
vercel env add TELEGRAM_BOT_TOKEN
vercel env add TELEGRAM_BOT_USERNAME
vercel env add TELEGRAM_WEBHOOK_SECRET
vercel env add PUBLIC_URL
vercel --prod
```

Jangan set `PORT` dan `BOT_MODE` di Vercel; keduanya hanya untuk lokal.

## 6. Registrasi Webhook

Auto-registrasi terjadi saat update Telegram pertama masuk, bila `PUBLIC_URL` terisi atau `VERCEL_ENV=production`.

Registrasi manual:

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<PROJECT>.vercel.app/api/bot&secret_token=<SECRET>"
```

Cek status webhook:

```bash
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

Yang harus terlihat:

- `"url"` = `https://<PROJECT>.vercel.app/api/bot`
- `"pending_update_count": 0`
- `"last_error_message"` tidak ada

Cek health:

```bash
curl https://<PROJECT>.vercel.app/api
```

Harus menampilkan:

```json
{
  "success": true,
  "status": "ok",
  "storage": "postgres",
  "database": "connected",
  "bot": "configured"
}
```

Jika `"storage": "memory"` → `DATABASE_URL` belum terbaca, perbaiki Environment Variables lalu redeploy.

## 7. Test Game di Deployment

### 7.1 Persiapan

- Buat grup Telegram baru untuk tes, tambahkan bot.
- Siapkan minimal 2 akun Telegram (satu akun tidak bisa join dua kali).

### 7.2 Skenario 1 — Lobby

1. Akun A kirim `/newgame` di grup.
   - Harapan: pesan lobby muncul berisi daftar pemain, tombol **Join** dan **Mulai**.
2. Akun A tekan **Mulai** (baru 1 pemain).
   - Harapan: alert "Minimal 2 pemain untuk memulai game."
3. Akun B tekan **Join**.
   - Harapan: DM bot terbuka, balasan "Berhasil join", pesan lobby ter-update menampilkan B.
4. Akun B (bukan host) tekan **Mulai**.
   - Harapan: alert "Hanya host yang dapat melakukan aksi ini."
5. Akun A tekan **Mulai**.
   - Harapan: game dimulai, tiap pemain menerima DM kartunya, grup menampilkan papan permainan.

### 7.3 Skenario 2 — Draw dan Pasangan

1. Pemain yang giliran menerima DM berisi tombol `?` sejumlah kartu target.
2. Tekan salah satu tombol.
   - Harapan: pesan DM berubah menampilkan kartu yang didapat, pasangan yang dibuang (jika ada), dan sisa kartu.
3. Grup menampilkan "X mengambil 1 kartu dari Y." dan giliran pindah.
   - Harapan: giliran selalu pindah ke pemain ACTIVE berikutnya.
4. Anti-cheat:
   - Minta pemain lain menekan tombol lama di DM-nya → alert "Bukan giliran Anda."
   - Kirim `/lobby` saat game berjalan → board tampil dan DM giliran dikirim ulang ke pemain yang berhak.

### 7.4 Skenario 3 — OUT dan Game Over

1. Mainkan sampai ada pemain kehabisan kartu.
   - Harapan: pengumuman "X selesai! 🎉", pemain tersebut dilewati.
2. Lanjutkan sampai hanya satu pemain tersisa.
   - Harapan: grup menampilkan "🐷 KEPALA BABI", mention pemain, jumlah pemain, dan durasi.
3. Tekan tombol `?` dari pesan lama.
   - Harapan: alert "Game sudah selesai."

### 7.5 Skenario 4 — Edge Case

| Aksi | Harapan |
| --- | --- |
| `/newgame` saat masih ada game aktif di grup | Ditolak "Masih ada game aktif di chat ini." |
| `/endgame` oleh non-host | Ditolak "Hanya host..." |
| `/endgame` oleh host saat WAITING | Room dibatalkan, tombol hilang |
| `/newgame` setelah game selesai | Berhasil, room baru dibuat |
| Player memblokir bot lalu mulai game | Grup menampilkan peringatan bahwa pemain belum membuka chat bot |
| Redeploy saat game PLAYING lalu `/lobby` | State tetap ada (dari database), DM giliran dikirim ulang |

### 7.6 Verifikasi Database

Di Neon SQL Editor, ganti `<game_id>` dengan ID dari tabel `games`:

```sql
SELECT id, status, turn_number, started_at, finished_at, pig_head_player_id
FROM games
ORDER BY created_at DESC
LIMIT 5;

SELECT COUNT(*) AS total_kartu
FROM game_cards
WHERE game_id = '<game_id>';

SELECT status, COUNT(*)
FROM game_cards
WHERE game_id = '<game_id>'
GROUP BY status;

SELECT card_code
FROM game_cards
WHERE game_id = '<game_id>' AND status = 'DISCARDED';
```

Invariant yang harus benar:

- `total_kartu` = **53**
- `IN_HAND + DISCARDED` = **53**
- Kartu `DISCARDED` berjumlah genap
- `games.pig_head_player_id` terisi hanya setelah `status = 'FINISHED'`
- Pemain `OUT` di `game_players` memiliki `card_count = 0`

### 7.7 Simulasi Lokal (sanity check)

```bash
npm test
node backend/scripts/simulateGame.js 10000 2 11
```

Harus lulus tanpa deadlock, duplikat, atau kartu hilang.

## 8. Update Deployment

```bash
git add .
git commit -m "perubahan"
git push
```

Vercel otomatis redeploy. Webhook tidak perlu didaftarkan ulang selama domain dan `TELEGRAM_WEBHOOK_SECRET` tidak berubah.

## 9. Troubleshooting

| Gejala | Penyebab / solusi |
| --- | --- |
| Bot tidak merespons | Cek `getWebhookInfo`; cek Vercel → Functions → Logs; pastikan env lengkap lalu redeploy |
| Health menampilkan `"storage":"memory"` | `DATABASE_URL` tidak terbaca; isi ulang env Vercel, redeploy |
| `password authentication failed` / SSL error | Gunakan connection string **pooled** dan `?sslmode=require` |
| DM kartu tidak terkirim | Pemain belum pernah `/start` bot; mereka harus klik tombol **Join** |
| Tombol tidak berfungsi | Pesan lama sudah kedaluwarsa; kirim `/lobby` untuk memuat ulang |
| Webhook salah domain | Perbarui `PUBLIC_URL`, jalankan ulang `setWebhook` |
| Function timeout | Naikkan `maxDuration` di `vercel.json` (maksimal sesuai plan Vercel) |
| Migrasi gagal sebagian | Runner memakai `schema_migrations`; perbaiki SQL lalu jalankan ulang `npm run migrate` |

## 10. Checklist Selesai

- [ ] `GET /api` → `storage: postgres`, `database: connected`, `bot: configured`
- [ ] `getWebhookInfo` → url benar, tanpa error
- [ ] `/newgame` → lobby tampil
- [ ] Join via deep link → pemain tercatat
- [ ] Game 2+ pemain berjalan sampai selesai
- [ ] `game_cards` berjumlah 53 untuk game tersebut
- [ ] Kepala Babi tercatat dan memegang Joker
- [ ] Redeploy saat PLAYING tidak menghilangkan state
