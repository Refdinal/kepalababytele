# Kepala Babi — Telegram Bot Game (Chat)

## 1. Gambaran Proyek

**Kepala Babi** adalah permainan kartu multiplayer yang dimainkan sepenuhnya melalui chat Telegram Bot. Tidak ada Telegram Mini App dan tidak ada frontend web.

Game menggunakan:

* 52 kartu remi standar
* 1 Joker
* Total 53 kartu
* Minimal 2 pemain
* Tidak ada batas maksimal pemain secara aturan game
* Pemain menggunakan identitas Telegram
* Game berlangsung secara turn-based
* Pemain terakhir yang masih memegang Joker menjadi **Kepala Babi**

Interaksi dilakukan melalui:

* **Grup Telegram** sebagai ruang publik (lobby, pengumuman, giliran)
* **Private chat (DM) dengan bot** sebagai tempat rahasia (kartu milik pemain, aksi mengambil kartu)

Bot tidak dapat memulai DM ke user yang belum pernah membuka chat bot. Karena itu setiap pemain wajib `/start` bot terlebih dahulu melalui deep link yang dibagikan di grup.

---

# 2. Tech Stack

## Backend / Bot

* Node.js 20+
* JavaScript (ESM)
* Express.js (webhook Telegram + health check)
* grammY (library Bot Telegram)
* PostgreSQL (Neon) dengan raw SQL — opsional
* In-memory store bila `DATABASE_URL` kosong (state hilang saat restart)
* Tanpa ORM
* Tanpa frontend

## Library

```text
express
grammy
pg
dotenv
```

## Testing

* `node:test` bawaan Node.js
* `scripts/simulateGame.js` untuk simulasi ribuan game

---

# 3. Arsitektur & Deployment

```text
Telegram User
      |
      v
Telegram Bot API
      |
      +---- long polling (development)
      |
      +---- webhook HTTPS (production)
                 |
                 v
          Express + grammY
                 |
                 +---- game engine (src/game)
                 |
                 +---- room / game service
                 |
                 v
            Neon PostgreSQL
```

* Development: long polling (tidak butuh URL publik).
* Production: webhook melalui Express.
* Vercel (serverless): webhook di `api/bot`, health di `api`; long polling tidak dipakai.
* Server menjadi satu-satunya sumber kebenaran game state.
* Penyimpanan memakai Postgres bila `DATABASE_URL` diisi; jika kosong memakai in-memory (tanpa persistensi).
* In-memory tidak boleh dipakai di Vercel; serverless wajib `DATABASE_URL`.

---

# 4. Tujuan MVP

1. `/newgame` di grup membuat room
2. Pemain join melalui tombol / deep link
3. Lobby pemain di grup
4. Host start game
5. Generate 53 kartu
6. Shuffle kartu menggunakan server (crypto)
7. Membagi kartu kepada pemain
8. Otomatis membuang pasangan awal
9. Menentukan urutan pemain
10. Tangan kartu dikirim ke DM masing-masing pemain
11. Pemain memilih posisi kartu tertutup dari pemain berikutnya
12. Cek pasangan setelah mengambil
13. Pemain dengan 0 kartu dilewati
14. Game berlanjut sampai Joker tersisa pada satu pemain
15. Mengumumkan pemain yang menjadi Kepala Babi
16. Menyimpan hasil game

---

# 5. Aturan Kartu

Deck terdiri dari:

```text
♥ A 2 3 4 5 6 7 8 9 10 J Q K
♦ A 2 3 4 5 6 7 8 9 10 J Q K
♠ A 2 3 4 5 6 7 8 9 10 J Q K
♣ A 2 3 4 5 6 7 8 9 10 J Q K
JOKER
```

Total:

```text
13 × 4 = 52
52 + 1 Joker = 53
```

---

# 6. Definisi Pasangan

Dua kartu dianggap pasangan jika:

1. Rank sama
2. Warna sama
3. Suit/simbol boleh berbeda

Warna:

```text
RED:
♥ Heart
♦ Diamond

BLACK:
♠ Spade
♣ Club
```

Contoh pasangan valid:

```text
♥7 + ♦7       VALID
♦J + ♥J       VALID
♠5 + ♣5       VALID
♣K + ♠K       VALID
```

Contoh bukan pasangan:

```text
♥7 + ♠7       BUKAN PASANGAN
♥7 + ♦8       BUKAN PASANGAN
♠J + ♣Q       BUKAN PASANGAN
```

Kartu Joker tidak memiliki pasangan.

---

# 7. Representasi Kartu

```js
{
  id: "H7",
  rank: "7",
  suit: "HEART",
  color: "RED"
}
```

Joker:

```js
{
  id: "JOKER",
  rank: "JOKER",
  suit: null,
  color: null
}
```

`id` setiap kartu harus unik.

---

# 8. Algoritma Pembuatan Deck

Server membuat deck baru setiap game.

```text
for each suit:
    for each rank:
        create card

create Joker

shuffle deck using server-side secure randomness
```

Gunakan `crypto.randomInt()` dari Node.js.

Jangan menggunakan `Math.random()` untuk menentukan hasil permainan.

---

# 9. Pembagian Kartu

53 kartu dibagikan semerata mungkin (round-robin dari deck yang sudah di-shuffle).

Contoh 2 pemain:

```text
27 kartu
26 kartu
```

Contoh 3 pemain:

```text
18
18
17
```

Contoh 4 pemain:

```text
14
13
13
13
```

Contoh 5 pemain:

```text
11
11
11
10
10
```

Selisih jumlah kartu antar pemain maksimal 1.

---

# 10. Pembuangan Pasangan Awal

Setelah semua pemain mendapatkan kartu:

```text
SETIAP PEMAIN:
    cari semua pasangan
    buang semua pasangan
```

Pasangan diproses otomatis oleh server. Pemain tidak memilih pasangan secara manual.

Contoh:

```text
Tangan:

♥7
♦7
♠K
♣K
♥3
♠9
JOKER
```

Setelah pasangan:

```text
♥7 + ♦7 → dibuang
♠K + ♣K → dibuang

tersisa:

♥3
♠9
JOKER
```

---

# 11. Urutan Giliran

```text
A → B → C → D → A
```

Pemain dengan 0 kartu (status OUT) dilewati.

Contoh jika C sudah 0 kartu:

```text
A → B → D → A
```

Pemain pertama adalah pemain ACTIVE dengan `seatNumber` terkecil.

---

# 12. Mekanik Mengambil Kartu

Pada giliran pemain A:

```text
A mengambil 1 kartu dari pemain ACTIVE berikutnya (B)
```

Target **ditentukan server**, bukan frontend.

Di DM, A melihat tombol kartu tertutup milik B:

```text
B memiliki 5 kartu:

[ ? ] [ ? ] [ ? ] [ ? ] [ ? ]

Pilih satu kartu
```

A menekan salah satu tombol. Server menentukan kartu sebenarnya.

---

# 13. Setelah Mengambil Kartu

Kartu yang diambil langsung masuk ke tangan pemain.

Contoh:

```text
A memiliki:

♥K
♠7
♦3
```

A mengambil:

```text
♦K
```

Server menemukan:

```text
♥K + ♦K
```

Maka pasangan langsung dibuang. Pemain tidak perlu aksi tambahan.

---

# 14. Jika Tidak Ada Pasangan

Kartu disimpan di tangan. Giliran selesai dan berpindah ke pemain ACTIVE berikutnya.

---

# 15. Jika Pemain Kehabisan Kartu

Jika `player.hand.length === 0`:

```text
ACTIVE → OUT
```

Pemain OUT tetap tercatat di room tetapi dilewati dalam turn.

---

# 16. Ketika Tinggal 2 Pemain

Game tetap berjalan:

```text
A mengambil dari B
B mengambil dari A
A mengambil dari B
...
```

Pemain yang mencapai 0 kartu keluar. Pemain terakhir yang masih memegang kartu otomatis memegang Joker (karena Joker tidak pernah bisa dibuang).

---

# 17. Kondisi Game Over

Game selesai ketika hanya satu pemain ACTIVE yang tersisa.

```js
winner = null
pigHead = playerWhoHasJoker
```

Karena total kartu ganjil dan Joker tidak bisa dibuang, pemain terakhir tersebut pasti memegang Joker.

Yang dicatat adalah:

```text
Kepala Babi
```

---

# 18. Game State

Server adalah sumber kebenaran utama.

```js
{
  gameId,
  chatId,
  status: "WAITING" | "PLAYING" | "FINISHED",
  players: [],
  currentPlayerId,
  turnNumber,
  startedAt,
  finishedAt,
  pigHeadPlayerId
}
```

Player:

```js
{
  playerId,
  telegramUserId,
  username,
  displayName,
  seatNumber,
  status: "ACTIVE" | "OUT",
  cardCount
}
```

Kartu asli hanya boleh diketahui server dan pemilik kartu.

---

# 19. Security — Server Authoritative

Semua update Telegram diterima langsung dari server Telegram, sehingga identitas pengirim (`from.id`) dapat dipercaya. Tidak ada `initData` Mini App.

Namun tetap:

* Jangan mempercayai `callback_data` mentah dari tombol. Validasi terhadap state di database.
* Server menentukan target draw, bukan tombol.
* Semua validasi dilakukan server.

Validasi setiap aksi draw:

```text
Apakah ini benar giliran pemain?
Apakah target benar (pemain ACTIVE berikutnya)?
Apakah index valid?
Kartu apa sebenarnya?
Apakah target masih aktif?
Apakah game masih berlangsung?
```

---

# 20. Identitas Telegram

Gunakan `ctx.from.id` dari update Telegram.

* Simpan `telegram_user_id` di tabel `users`.
* Username dan display name diambil dari update terakhir.
* Pemain yang belum `/start` bot tidak bisa menerima DM; bot mengirim deep link:

```text
https://t.me/<BOT_USERNAME>?start=join_<GAME_ID>
```

---

# 21. Database (Neon PostgreSQL — Opsional)

Database diperlukan untuk persistensi, history, dan reconnect lintas restart. Tanpa database, bot memakai in-memory store dengan aturan game yang sama.

Raw SQL, tanpa ORM.

## users

```sql
id
telegram_user_id
username
first_name
last_name
created_at
updated_at
```

## games

```sql
id
chat_id
host_user_id
status
current_player_id
turn_number
pig_head_player_id
started_at
finished_at
created_at
```

## game_players

```sql
id
game_id
user_id
seat_number
status
card_count
joined_at
finished_at
```

## game_cards

```sql
id
game_id
card_code
player_id
status
created_at
```

Status kartu:

```text
IN_HAND
DISCARDED
```

Kartu milik pemain lain tidak boleh pernah bocor ke DM pemain lain atau ke grup.

---

# 22. Game History

Setelah game selesai, simpan:

```text
game ID
jumlah pemain
tanggal
durasi
urutan pemain
Kepala Babi
```

Contoh pengumuman di grup:

```text
🐷 KEPALA BABI

Refdinal
@refdinal

4 pemain
Durasi: 03:42
```

---

# 23. Bot Commands & Deep Link

```text
/newgame          buat room di grup
/lobby            tampilkan lobby sekarang
/start            start bot / join room via deep link
/help             cara bermain
/endgame          host membatalkan room (WAITING)
/leaderboard      (post-MVP)
```

Deep link join:

```text
https://t.me/<BOT_USERNAME>?start=join_<GAME_ID>
```

`callback_data` maksimal 64 byte, gunakan format pendek:

```text
join:<gameId>
start:<gameId>
draw:<gameId>:<cardIndex>
lobby:<gameId>
```

---

# 24. Alur Room

```text
/newgame (grup)
      ↓
Pesan lobby + tombol Join
      ↓
Pemain tekan Join (deep link /start bila belum pernah chat bot)
      ↓
Host tekan Start Game
      ↓
Validasi minimal 2 pemain
      ↓
GAME DIMULAI
      ↓
Join ditutup
```

Host adalah pembuat room.

---

# 25. Alur Permainan (Chat)

```text
START:
  bot cek DM setiap pemain
  jika DM gagal (belum /start), minta pemain /start bot dulu
  bot kirim tangan ke DM masing-masing
  bot umumkan giliran pertama di grup
  bot tag pemain yang giliran di grup

GILIRAN A:
  bot kirim/ubah pesan DM A:
      "Ambil kartu dari B"
      [ ? ] [ ? ] [ ? ] ...
  A menekan salah satu tombol
  server memproses draw dalam transaction
  bot kirim hasil ke DM A (kartu yang didapat + pasangan yang dibuang)
  bot umumkan di grup (tanpa identitas kartu rahasia):
      "A mengambil 1 kartu dari B"
      "A membuang 1 pasangan" (jika ada)
      "A selesai" (jika OUT)
      "Giliran B"
  ulangi sampai GAME OVER

GAME OVER:
  bot umumkan Kepala Babi di grup
  bot kirim hasil + durasi
  simpan history
```

---

# 26. UI Chat (Mockup)

## Grup

```text
┌──────────────────────────────┐
│ 🐷 KEPALA BABI               │
├──────────────────────────────┤
│ Pemain:                      │
│ 1. Andi      7 kartu          │
│ 2. Budi      4 kartu          │
│ 3. Citra     6 kartu          │
│                              │
│ Giliran: Andi                │
│                              │
│ [Lobby] [Join] [Start]        │
└──────────────────────────────┘
```

## DM pemain saat gilirannya

```text
Giliran kamu!

Ambil kartu dari Budi:

[ ? ] [ ? ] [ ? ] [ ? ]

Kartu kamu: 🂠 🂠 🂠 🂠 🂠
```

Kartu sendiri boleh ditampilkan penuh. Kartu pemain lain selalu tertutup.

---

# 27. Informasi yang Boleh Dilihat Pemain

Boleh:

```text
Nama pemain
Username
Jumlah kartu
Giliran siapa
Jumlah kartu target (posisi tertutup)
Kartu miliknya sendiri
Status game
```

Tidak boleh:

```text
Kartu asli pemain lain
Joker berada di tangan siapa (sebelum waktunya)
Game state internal
Random seed
```

---

# 28. Anti-Cheat

* `currentPlayerId === pengirim callback`
* Target ditentukan server (pemain ACTIVE berikutnya)
* `0 <= cardIndex < target.hand.length`
* Target harus `ACTIVE`
* `game.status === 'PLAYING'`
* Tombol lama (message lama) tidak boleh diproses jika state sudah berubah
* Jangan mengirim kartu pemain lain ke DM mana pun

---

# 29. Concurrency

Gunakan PostgreSQL transaction untuk aksi penting:

```text
DRAW CARD
REMOVE CARD
ADD CARD
CHECK PAIR
UPDATE TURN
UPDATE PLAYER STATUS
```

Gunakan row locking:

```sql
SELECT ... FOR UPDATE
```

Tujuan: satu kartu tidak bisa diambil dua kali, dua callback hampir bersamaan tidak merusak state.

---

# 30. Game Engine

Pisahkan aturan game dari bot handler dan Express route.

```text
backend/
├── src/
│   ├── game/
│   │   ├── cards.js
│   │   ├── deck.js
│   │   ├── shuffle.js
│   │   ├── pairing.js
│   │   ├── dealing.js
│   │   ├── turnManager.js
│   │   ├── errors.js
│   │   └── gameEngine.js
│   ├── bot/
│   ├── services/
│   ├── db/
│   ├── migrations/
│   ├── middleware/
│   ├── config.js
│   └── index.js
├── tests/
├── scripts/
│   └── simulateGame.js
├── package.json
└── .env.example
```

Game logic tidak ditulis langsung di handler bot.

---

# 31. Pair Detection

```js
findPairs(cards)
```

Logika:

```text
kelompokkan kartu berdasarkan:
color + rank
```

Jika terdapat 2 kartu pada kelompok yang sama, pair ditemukan. Joker selalu diabaikan.

Return:

```js
{
  pairs: [...],
  remainingCards: [...]
}
```

---

# 32. Turn Manager

```js
getNextActivePlayer(players, currentSeat)
```

```text
mulai dari seat berikutnya
loop pemain
jika status ACTIVE:
    return player
```

---

# 33. Draw Algorithm

```text
drawCard(state, playerId, cardIndex)

1. validasi game PLAYING
2. validasi currentPlayerId === playerId
3. tentukan target = pemain ACTIVE berikutnya
4. validasi target ACTIVE
5. validasi cardIndex (integer, dalam rentang)
6. shuffle posisi tangan target (agar posisi tidak bisa dilacak)
7. pindahkan kartu target → current player
8. cek pasangan current player
9. discard pasangan
10. update card counts
11. cek player OUT (current dan target)
12. cek game over (hanya 1 ACTIVE)
13. jika belum selesai: tentukan next active player
14. simpan dalam satu transaction
```

---

# 34. Realtime & Update Pesan

* Development: long polling grammY.
* Production: webhook Express.
* Pesan lobby/grup diperbarui dengan `editMessageText` agar tidak spam.
* Hindari rate limit Telegram: jangan edit lebih cepat dari ~1 detik, gabungkan update.
* Tidak memakai WebSocket karena UI ada di Telegram.

---

# 35. Disconnect

Jika pemain menutup Telegram atau koneksi terputus:

```text
game state tetap tersimpan di database
```

Pemain yang kembali tetap bisa melanjutkan. Jangan hapus pemain karena disconnect.

---

# 36. UX

* Pesan singkat dan jelas
* Tombol besar (`inline keyboard`)
* Tag pemain yang giliran di grup
* DM berisi tombol `?` untuk draw
* Loading/ACK: `answerCallbackQuery`
* Notifikasi saat giliran berubah
* Notifikasi saat game selesai
* Sediakan `/help`

---

# 37. Leaderboard (Post-MVP)

```text
Total game
Jumlah menjadi Kepala Babi
Persentase Kepala Babi
Riwayat game
```

Leaderboard hanya statistik. Jangan mempengaruhi random game.

---

# 38. Monetisasi (Post-MVP)

Tidak ada monetisasi di MVP. Hindari mekanisme pay-to-win.

---

# 39. Testing

## Deck

```text
53 kartu, tidak ada duplicate id, 52 kartu standar + 1 Joker
```

## Pair

```text
♥7 + ♦7 = pair
♠7 + ♣7 = pair
♥7 + ♠7 = bukan pair
♥J + ♦J = pair
♠K + ♣K = pair
Joker + kartu apa pun = bukan pair
```

## Deal

```text
2, 3, 4, 5, 10, 11 pemain: selisih maksimal 1
```

## Turn

```text
player OUT dilewati
```

## Draw

```text
current player dapat draw
non-current player tidak dapat draw
card index valid diterima
card index invalid ditolak
target OUT ditolak
```

## Game Over

```text
satu pemain tersisa memegang Joker menjadi pigHeadPlayer
```

---

# 40. Test Simulasi

`scripts/simulateGame.js` menjalankan ribuan game tanpa Telegram.

Target:

```text
1000 games
5000 games
10000 games
```

Pastikan:

* Tidak ada deadlock
* Tidak ada duplicate card
* Tidak ada kartu hilang/bertambah
* Turn selalu berpindah
* Game selalu selesai
* Tepat satu pemain menjadi Kepala Babi
* Pemenang terakhir memegang Joker

Invariant utama:

```text
jumlah kartu di tangan + kartu discarded = 53
```

---

# 41. Logging

Event penting:

```text
GAME_CREATED
PLAYER_JOINED
GAME_STARTED
PAIR_DISCARDED
CARD_DRAWN
PLAYER_OUT
TURN_CHANGED
GAME_FINISHED
PIG_HEAD_SELECTED
```

Jangan log kartu rahasia pemain ke production log.

---

# 42. Error Handling

```json
{
  "success": false,
  "error": {
    "code": "NOT_YOUR_TURN",
    "message": "Bukan giliran Anda."
  }
}
```

Kode error:

```text
GAME_NOT_FOUND
GAME_ALREADY_STARTED
NOT_ENOUGH_PLAYERS
NOT_YOUR_TURN
INVALID_TARGET
TARGET_NOT_ACTIVE
INVALID_CARD_INDEX
GAME_FINISHED
UNAUTHORIZED
PLAYER_NOT_IN_GAME
```

---

# 43. Environment Variables

```text
PORT=
DATABASE_URL=          # opsional, kosong = in-memory (wajib di Vercel)
TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_USERNAME=
TELEGRAM_WEBHOOK_SECRET=   # opsional, divalidasi grammY
PUBLIC_URL=                # opsional, untuk auto-registrasi webhook
BOT_MODE=polling           # polling (lokal) | webhook
NODE_ENV=
```

Jangan commit `.env`. Sediakan `.env.example`.

Neon memerlukan SSL; gunakan `ssl: { rejectUnauthorized: false }` pada pool.

---

# 44. Repository Structure

```text
kepala-babi/
├── api/
│   ├── index.js     # health (Vercel function)
│   └── bot.js       # webhook Telegram (Vercel function)
├── backend/
│   ├── src/
│   ├── tests/
│   ├── scripts/
│   ├── migrations/
│   ├── package.json
│   └── .env.example
├── package.json     # workspace root untuk Vercel
├── vercel.json
├── docs/
│   └── game-rules.md
├── plan.md
└── README.md
```

Bot menyatu dengan backend. Root `package.json` memakai npm workspaces agar Vercel menginstal dependency `backend/`.

---

# 45. Development Phase

## Phase 1 — Game Engine

```text
deck, shuffle, pair detection, deal, turn manager, draw, game over
```

Lengkap dengan unit test dan simulasi. Belum perlu Telegram.

## Phase 2 — Database & Backend

```text
Neon PostgreSQL
migrasi raw SQL
Express health check
room/game service
```

## Phase 3 — Bot Telegram

```text
grammY
/newgame, lobby, join, start
DM tangan kartu
inline keyboard draw
pengumuman grup
game over
```

## Phase 4 — Integration & Security Testing

```text
Manipulasi cardIndex
Manipulasi gameId/playerId
Request di luar turn
Replay/duplicate callback
Join setelah game dimulai
Race condition pada draw
```

## Phase 5 — Production

```text
webhook HTTPS
deployment Vercel (api/bot, api/index)
DATABASE_URL Neon wajib
monitoring
```

---

# 46. Definition of Done

* [ ] 2+ pemain dapat membuat room di grup
* [ ] Pemain dapat join lewat tombol/deep link
* [ ] Game dapat dimulai oleh host
* [ ] 53 kartu dibuat dengan benar
* [ ] Kartu ter-shuffle server-side (crypto)
* [ ] Kartu terbagi dengan selisih maksimal 1
* [ ] Pasangan otomatis dibuang
* [ ] Tangan kartu terkirim ke DM masing-masing pemain
* [ ] Pemain memilih posisi kartu tertutup
* [ ] Kartu yang diambil diproses server
* [ ] Pasangan langsung dibuang
* [ ] Pemain 0 kartu dilewati
* [ ] Dua pemain terakhir dapat terus bermain
* [ ] Joker tidak pernah memiliki pasangan
* [ ] Game selalu berakhir
* [ ] Pemegang Joker terakhir menjadi Kepala Babi
* [ ] Hanya server yang mengetahui seluruh game state
* [ ] Tidak ada duplicate/lost card
* [ ] Reconnect bekerja (in-memory selama bot hidup; permanen bila database diisi)
* [ ] Unit test dan simulasi 1000+ game lulus

---

# 47. Prinsip Implementasi Untuk AI Agent

1. **Jangan mengubah aturan game tanpa persetujuan.**
2. **Game logic harus server-authoritative.**
3. **Jangan mempercayai data dari callback/chat.**
4. **Jangan menggunakan ORM. Gunakan raw SQL PostgreSQL.**
5. **Pisahkan game engine dari handler bot.**
6. **Buat unit test untuk game engine sebelum bot UI kompleks.**
7. **Jangan menyimpan kartu sebagai state rahasia di tempat yang bisa diintip pemain.**
8. **Jangan menggunakan Math.random() untuk shuffle.**
9. **Gunakan PostgreSQL transaction + row lock untuk operasi draw.**
10. **Jangan menambahkan fitur blockchain/crypto/pay-to-win pada MVP.**
11. **Utamakan game yang stabil sebelum kosmetik.**
12. **Semua aturan dalam dokumen ini adalah source of truth.**

---

# 48. Urutan Pengerjaan Agent

```text
1. Project initialization
2. Deck engine
3. Pair engine
4. Deal engine
5. Turn engine
6. Draw engine
7. Game-over engine
8. Unit tests
9. Simulation test
10. Database schema + migrasi
11. Express skeleton
12. Telegram bot (lobby → join → start → draw → game over)
13. Game service + persistence
14. Security testing
15. Production webhook deployment
16. Documentation
```

Jangan langsung membuat bot UI sebelum **game engine tervalidasi dengan automated tests**.

---

# 49. Catatan Penting

Kepala Babi adalah permainan berbasis random draw.

Server menentukan:

```text
deck
shuffle
card ownership
draw result
pair detection
turn
game over
pig head
```

Bot hanya bertugas:

```text
menampilkan state
menerima aksi pemain
mengirim aksi ke server
menampilkan hasil dari server
```

Dengan desain ini, pemain tidak dapat memanipulasi hasil draw atau mengetahui kartu pemain lain.
