# Design: status PENDING dan reversal setoran

Tanggal: 2026-10-19. Konteks: setor-tunai-api (ilustrasi training, semua data dummy).

## Latar belakang

Setoran yang sudah COUNTED bisa gagal di tahap host dengan dua cara. Contoh (ilustrasi): nasabah setor Rp 2.500.000 di ATM-0412, mesin sudah menghitung, lalu request ke host timeout 30 detik.

1. **Host timeout.** Setoran macet di COUNTED. Tidak ada status yang menjelaskan posisi uangnya. Kalau host ternyata sudah approve tetapi responsnya terlambat, ledger bisa sudah terkredit padahal nasabah melihat layar gagal.
2. **Uang ditolak mesin.** Sebagian lembar ditolak, nasabah membatalkan, uang dikembalikan. Tidak ada catatan pembatalan.

Akibatnya tidak ada jejak, dan koreksi ledger tidak mungkin dilakukan tanpa update atau delete, padahal ledger bersifat append-only.

## Tujuan

- Setoran COUNTED yang host-nya timeout atau uangnya ditolak mesin bisa dipindah ke status **PENDING**.
- PENDING punya dua jalan keluar: **POSTED** (host ternyata approve) atau **REVERSED** (host tidak approve atau uang dikembalikan).
- Setiap perpindahan tercatat: siapa, kapan, alasan.
- Ledger tetap benar dan append-only. Koreksi hanya lewat entri baru.

## Bukan tujuan

- Integrasi langsung ke host. Hasil akhir PENDING diputuskan dari luar lewat API, oleh operator atau job rekonsiliasi yang memanggil endpoint.
- UI.
- PENDING dari status POSTED. Kasus setoran yang sudah diposting tetapi ternyata tidak di-approve host di luar scope (lihat Batasan).
- Autentikasi. Field `actor` adalah string yang dikirim pemanggil.
- Mengubah perilaku `confirm`, `count`, `start`, atau test yang sudah ada.

## Anti-goal

- Entri ledger yang di-update atau di-delete.
- Reversal yang tercatat dua kali karena endpoint dipanggil ulang.
- Posting ganda untuk STAN yang sama.
- Nominal non-integer, atau nomor rekening lengkap di log.

## Keputusan (dari diskusi)

**Status.** Tambah `PENDING` dan `REVERSED` ke `DepositStatus`. Kolom `deposits.status` berupa TEXT tanpa CHECK, jadi tidak perlu migrasi. Transisi yang diizinkan:

| Dari | Ke | Lewat |
| --- | --- | --- |
| COUNTED | PENDING | mark pending |
| PENDING | POSTED | resolve |
| PENDING | REVERSED | reverse |

PENDING hanya boleh dari COUNTED. Transisi lain mengembalikan error `INVALID_STATE`, yang oleh `server.ts` sudah dipetakan ke HTTP 409.

**Resolve (POSTED).** Host ternyata approve. Posting ledger dengan ref `${terminalId}/${stan}` (pola yang sama dengan `confirm`) jika belum pernah diposting. Idempotent per STAN: kalau entri dengan ref itu sudah ada, tidak memposting lagi dan hanya mengubah status.

**Reverse (REVERSED).** Host tidak approve atau uang dikembalikan. Jika ledger sudah terkredit untuk setoran ini, buat dua entri pembalik: DR rekening nasabah, CR kas mesin (`KAS-${terminalId}`), dengan ref yang sama ditambah akhiran `/REV`. Status akhir REVERSED. Jika ledger belum terkredit, status langsung REVERSED tanpa entri ledger.

**Jejak audit.** Tabel baru `deposit_events`, append-only: deposit_id, action, actor, reason, created_at. Dibuat dengan `CREATE TABLE IF NOT EXISTS` di `openDb`, jadi tidak menyentuh tabel lama dan tidak butuh migrasi. Semua aksi di atas menulis satu baris. `actor` dan `reason` wajib dan tidak boleh kosong.

**API.** Mengikuti pola `node:http` dan `parts[2]` yang ada di `server.ts`:

- `POST /deposits/:id/pending` body `{ actor, reason }`
- `POST /deposits/:id/resolve` body `{ actor, reason, stan }`
- `POST /deposits/:id/reverse` body `{ actor, reason }`

Transisi tidak valid mengembalikan 409 dengan `{ error: "INVALID_STATE", message }`, sama dengan pola yang ada.

**Cancel.** `cancel()` menolak setoran PENDING dan REVERSED dengan INVALID_STATE. Jalan keluar PENDING hanya resolve atau reverse. Perilaku cancel untuk OPEN dan COUNTED tidak berubah.

**Aturan code (dari CLAUDE.md).** TypeScript strict, tanpa `any` di luar batas HTTP. Nominal integer rupiah. Setiap perubahan aturan bisnis ada test di `test/`. Test lama tidak diubah: test baru ditulis di file baru (misalnya `test/deposit.pending.test.ts`, `test/api.pending.test.ts`).

## Keputusan saya (belum diperiksa pemilik)

- **Pengulangan aksi yang sama.** Pending pada setoran PENDING, resolve pada setoran yang sudah POSTED dengan STAN sama, dan reverse pada setoran yang sudah REVERSED, mengembalikan 200 dengan state saat ini tanpa efek samping. Ini mengikuti pola retry `confirm`. Semua transisi lain yang tidak valid, termasuk resolve dengan STAN berbeda pada setoran POSTED, mengembalikan 409.
- **STAN yang dikenal untuk sebuah setoran.** Gabungan semua `stan` di `host_requests` untuk deposit itu (diisi `confirm` sebelum posting) dan `deposits.stan`. Kalau tidak ada satu pun, setoran dianggap belum pernah diposting.
- **Mendeteksi "ledger sudah terkredit" saat reverse.** Untuk setiap STAN yang dikenal, cek entri `ledger_entries` dengan ref `${terminalId}/${stan}`. Setiap ref yang terkredit dan belum punya entri `…/REV` dibalik, jadi bisa lebih dari satu kalau ada retry dengan STAN berbeda. Nominal reversal diambil dari entri asli, bukan dari `deposits.amount`. Pemeriksaan `…/REV` sebelum menulis membuat reverse aman diulang setelah kegagalan di tengah.
- **Resolve dan STAN.** Jika setoran sudah punya STAN yang dikenal dan `stan` di body tidak termasuk di dalamnya, resolve ditolak dengan INVALID_STATE (409). Jika sudah ada entri ledger untuk salah satu STAN yang dikenal, resolve tidak memposting lagi dan hanya mengubah status. Hanya jika tidak ada STAN dikenal, `stan` dari body dipakai untuk posting baru. Ini mencegah kredit ganda lewat STAN berbeda.
- **Nominal resolve.** `deposits.amount`, seperti `confirm`. Nilai itu sudah hanya menghitung lembar yang diterima mesin (`recordCount`).
- **Mark pending diulang.** Pending pada setoran yang sudah PENDING mengembalikan 200 tanpa baris event baru, supaya job rekonsiliasi aman melakukan retry.
- **Urutan validasi.** Input dulu (400: `actor`, `reason`, STAN), baru state (409), mengikuti `confirm`.
- **Atomicity.** Setiap aksi baru (entri ledger, update status, baris event) berjalan dalam satu transaksi SQLite yang dibuka oleh method service itu sendiri. Helper ledger (`postDepositEntries` dan helper baru) hanya melakukan insert dan tidak membuka transaksi, jadi tidak ada `BEGIN` bersarang. Kalau gagal di tengah, tidak ada yang tersimpan.
- **Flow lain terhadap PENDING.** `confirm` dan `recordCount` sudah menolak PENDING lewat pemeriksaan status yang ada (INVALID_STATE), tanpa perubahan. Setoran baru di terminal atau rekening yang sama tidak diblokir.
- **Format `reason`.** String bebas, wajib, panjang maksimum wajar (misalnya 200 karakter). Tidak ada daftar kode alasan.
- **Kode error baru** untuk `actor` atau `reason` kosong atau STAN tidak valid memakai pola 400 yang ada (`validateStan` dipakai ulang).

## Temuan dari membaca code

- `confirm()` memposting ledger lalu mengubah status dalam dua langkah tanpa transaksi. Jika proses mati di antaranya, ledger sudah terkredit tetapi status masih COUNTED. Inilah jalur nyata sebuah setoran PENDING (dari COUNTED) bisa punya ledger yang sudah terkredit, dan alasan reverse harus mengecek ledger, bukan mengasumsikannya. Memperbaiki `confirm()` bukan bagian dari fitur ini.
- `ledger_entries` tidak punya unique constraint pada ref. Idempotency fitur ini dijaga di level aplikasi di dalam transaksi, bukan oleh constraint database.
- `GET /deposits/:id` mengembalikan nomor rekening lengkap. Tidak diubah di fitur ini.

## Batasan

- Setoran yang sudah POSTED tetapi ternyata tidak di-approve host tidak bisa dibalik lewat fitur ini. Penanganannya perlu keputusan terpisah.
- `actor` hanya klaim dari pemanggil, bukan identitas yang terverifikasi.
- Ref `${terminalId}/${stan}` tidak dijamin unik karena ledger tidak punya kolom deposit_id. `reverse` menolak dengan 409 jika entri asli suatu ref bukan tepat satu pasang DR/CR dengan rekening nasabah, kas mesin, dan nominal setoran ini. Ini hanya jaring pengaman: STAN yang dipakai ulang pada rekening, terminal, dan nominal yang sama tetap tidak bisa dibedakan, dan `resolve` tidak mencegah ref bentrok. Perbaikan penuh butuh menautkan entri ledger ke setoran (perubahan skema ledger), di luar scope.
- Tidak ada endpoint untuk mendaftar setoran PENDING atau membaca `deposit_events`. Job rekonsiliasi harus sudah tahu id setoran.

## Diserahkan ke builder

Struktur function dan nama (misalnya `markPending`, `resolve`, `reverse` di `createDepositService`, helper ledger seperti `hasEntries` dan `postReversalEntries`), pembagian test, teks pesan error, dan skema kolom `deposit_events` secara rinci.

## Kriteria selesai

- `npx vitest run` dan `npm run typecheck` lulus, termasuk semua test lama tanpa perubahan.
- Test baru mencakup: tiap transisi valid, tiap transisi tidak valid (409), idempotency resolve per STAN, idempotency reverse, reverse dengan dan tanpa ledger terkredit (saldo rekening dan kas mesin kembali benar), `cancel` pada PENDING ditolak, `actor` dan `reason` wajib, dan baris `deposit_events` tercatat.
