# 🐷 Kepala Babi — Telegram Bot Game

Permainan kartu multiplayer untuk grup Telegram. Pemain terakhir yang memegang Joker menjadi **Kepala Babi**.

Aturan lengkap: [PLAN.md](PLAN.md).

## Struktur

```text
api/                 entrypoint Vercel (health + webhook bot)
backend/
├── src/
│   ├── game/        engine murni (deck, pairing, dealing, turn, draw)
│   ├── bot/         handler grammY (lobby, gameplay, render, webhook)
│   ├── services/    storage: memory (default) atau PostgreSQL
│   ├── migrations/  skema + migration runner
│   ├── routes/      Express (health)
│   └── index.js     entry point lokal (long polling)
├── tests/           unit test engine (node:test)
└── scripts/         simulateGame.js
```

## 1. Database (opsional untuk lokal, wajib untuk Vercel)

Game lokal berjalan **tanpa database**. Jika `DATABASE_URL` kosong, state disimpan di memori: semua fitur tetap jalan, tetapi game aktif hilang saat proses restart.

Di Vercel (serverless), in-memory **tidak bisa dipakai** karena tiap request bisa ditangani instance berbeda. Jadi Vercel wajib memakai Neon:

1. Buat project di https://console.neon.tech
2. Salin connection string **pooled** (host mengandung `-pooler`).

```text
postgresql://user:password@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require
```

## 2. Siapkan Bot Telegram

1. Chat @BotFather, kirim `/newbot`, simpan token.
2. Simpan username bot (tanpa `@`).
3. Opsional: set command manual via `/setcommands`, atau bot mengaturnya otomatis.
4. Command dan tombol tetap bekerja tanpa mematikan privacy mode.

## 3. Jalankan Lokal

```bash
cd backend
cp .env.example .env
# isi minimal TELEGRAM_BOT_TOKEN dan TELEGRAM_BOT_USERNAME
npm install
npm run dev

# jika memakai Neon:
npm run migrate
```

Server health: `GET http://localhost:3000/health` (menampilkan `storage`: `memory` atau `postgres`).

Isi `.env`:

```text
PORT=3000
DATABASE_URL=
TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_BOT_USERNAME=kepalababi_bot
TELEGRAM_WEBHOOK_SECRET=
PUBLIC_URL=
BOT_MODE=polling
NODE_ENV=development
```

`BOT_MODE=webhook` membuat server lokal melayani webhook di `/api/bot` (butuh `PUBLIC_URL` dan HTTPS untuk Telegram).

## 4. Cara Main

1. Tambahkan bot ke grup.
2. `/newgame` di grup → pesan lobby muncul dengan tombol **Join** dan **Mulai**.
3. Pemain menekan **Join** (membuka chat pribadi bot agar kartu bisa dikirim via DM).
4. Host menekan **Mulai**.
5. Bot mengirim kartu ke DM masing-masing pemain.
6. Saat giliran, pemain memilih tombol `?` di DM untuk mengambil kartu tertutup dari pemain berikutnya.
7. Pasangan otomatis dibuang. Pemain 0 kartu selesai.
8. Pemain terakhir yang memegang Joker diumumkan sebagai Kepala Babi.

Command: `/newgame`, `/lobby`, `/endgame`, `/help`.

## 5. Deploy ke Vercel

Panduan langkah demi langkah termasuk test game di production: [deploy.md](deploy.md).

Prasyarat: repo di GitHub dan database Neon aktif.

1. Import repo ke Vercel (framework preset: **Other**, root directory: root repo).
2. Set **Environment Variables**:

```text
DATABASE_URL=postgresql://...neon.tech/neondb?sslmode=require
TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_BOT_USERNAME=kepalababi_bot
TELEGRAM_WEBHOOK_SECRET=rahasia-acak          # opsional tapi disarankan
PUBLIC_URL=https://nama-project.vercel.app    # opsional, untuk auto-registrasi webhook
```

3. Jalankan migrasi dari lokal (sekali saja):

```bash
cd backend
npm run migrate
```

4. Deploy. Endpoint yang tersedia:
   - `GET /api` — health check.
   - `POST /api/bot` — webhook Telegram (auto-registrasi saat request pertama bila `PUBLIC_URL` diisi atau di production).

Registrasi manual bila perlu:

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<PROJECT>.vercel.app/api/bot"
```

Catatan Vercel:

- Long polling tidak dipakai; `api/bot` selalu webhook.
- Wajib `DATABASE_URL`; tanpa itu health akan memperingatkan dan state tidak konsisten.
- Setelah ganti domain, perbarui webhook (otomatis bila `PUBLIC_URL` diperbarui, atau pakai curl di atas).

## Test

```bash
npm test                              # dari root, unit test engine
node backend/scripts/simulateGame.js 1000
node backend/scripts/simulateGame.js 10000 2 11
```

Invariant yang diperiksa: 53 kartu selalu utuh, tanpa duplikat, turn selalu berpindah, tidak deadlock, tepat satu Kepala Babi, dan Kepala Babi memegang Joker.
