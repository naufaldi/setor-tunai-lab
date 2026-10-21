# Plan: Batas Setoran Harian per Rekening (Rp 50.000.000 per hari WIB)

## Context
PRD `docs/take-home/prd.md` (disetujui, termasuk D8: hari dari `deposits.created_at`) meminta total setoran
`POSTED` + `PENDING` per rekening per hari WIB maksimal Rp 50.000.000, dicek di `recordCount` dan `confirm`.
Baseline: 11 file test, 167 test hijau (`npx vitest run`). Tidak ada perubahan skema, ledger, atau `server.ts`.

## File yang diubah
| File | Perubahan |
|---|---|
| `src/domain/money.ts` | tambah `DAILY_DEPOSIT_LIMIT = 50_000_000` |
| `src/domain/daily-limit.ts` (baru) | `wibDayBounds(iso)` -> `{ fromUtc, toUtc }` (offset tetap +7, tanpa DST); `assertWithinDailyLimit(used, amount)` melempar `DepositError("DAILY_LIMIT_EXCEEDED", "batas setoran harian terlampaui, sisa kuota hari ini Rp {sisa}")`, `sisa = max(0, LIMIT - used)`, pakai `formatRupiah`. Batas inklusif (`used + amount > LIMIT` ditolak). |
| `src/deposit.service.ts` | helper privat `usedToday(accountNo, createdAt, excludeId)`; cek di `recordCount`; `confirm` dibungkus `inTransaction` |
| `test/helpers.ts` | `setup()` menerima clock opsional/settable; helper `postedDeposit(svc, {amount, accountNo, terminalId})` dengan STAN dan requestId unik |
| `test/daily-limit.domain.test.ts` (baru) | konstanta, `wibDayBounds`, format pesan, sisa minimum 0 |
| `test/daily-limit.service.test.ts` (baru) | AC1-AC13, AC15 |
| `test/api.daily-limit.test.ts` (baru) | AC14 |

`src/server.ts` tidak berubah: kode tak dikenal sudah jatuh ke 400 (`server.ts:42`).

## Urutan test-first
**Langkah 0:** `npx vitest run` hijau (167). Tulis `test/helpers.ts` dulu (bukan test, tidak memerlukan fitur baru).

**Langkah 1: tulis semua test, jalankan, pastikan yang seharusnya merah memang merah.**

Merah di awal (inilah test yang membuktikan fitur):
1. AC3 `recordCount` 10,1 jt saat terpakai 40 jt -> `DAILY_LIMIT_EXCEEDED`, status `OPEN`, `amount` 0, ledger tidak bertambah, pesan memuat `sisa kuota hari ini Rp 10.000.000`. Saat ini gagal: setoran jadi `COUNTED`.
2. AC4 (15 jt, sisa 10 jt, ditolak penuh), AC5 (sisa `Rp 0`), AC6 (`PENDING` dihitung), AC12 (lintas terminal), AC11 bagian kedua (23:30 WIB ditolak).
3. AC9 tiga setoran `COUNTED` 20 jt, `confirm` berurutan: S3 ditolak, tetap `COUNTED`, tidak ada ledger S3, **dan tidak ada baris `host_requests` untuk requestId S3** (kunci rollback; lihat risiko).
4. AC14 lewat HTTP: 400 + body `{error, message}`, pesan tidak memuat nomor rekening (cek tidak ada 4 digit terakhir maupun substring nomor).
5. `test/daily-limit.domain.test.ts`: merah karena import belum ada. Batas: `16:59:59.999Z` hari 20 Okt, `17:00:00.000Z` hari 21 Okt (R3).

Hijau sejak awal (penjaga agar fitur tidak memblokir berlebihan, tulis tetap):
AC1, AC2 (tepat 50 jt lolos), AC7 (`REVERSED` mengembalikan kuota), AC8, AC10 (retry idempoten), AC11 bagian pertama, AC13, AC15.
Karena tidak pernah merah, setelah implementasi lakukan cek mutasi singkat (misalnya sementara ikutkan `REVERSED` ke total, AC7 harus gagal; hapus cek idempoten, AC10 harus gagal).

**Langkah 2: implementasi minimal sampai hijau, per lapis.**
1. Domain: konstanta + `daily-limit.ts` -> test domain hijau.
2. Service `usedToday`: `SELECT COALESCE(SUM(amount),0) FROM deposits WHERE account_no=? AND status IN ('POSTED','PENDING') AND created_at >= ? AND created_at < ? AND id <> ?` (string ISO UTC seragam dari `toISOString()`, jadi perbandingan leksikal aman). Batas hari dari `wibDayBounds(dep.createdAt)` (D8), bukan `now()`.
3. `recordCount`: setelah `countAmount` (error validasi tetap lebih dulu), sebelum `UPDATE`. Jangan memanggil `now()` di sini supaya jumlah tick clock test lama tidak bergeser. -> AC3-AC6, AC11-AC13 hijau.
4. `confirm`: lihat bagian berikut. -> AC9 hijau.
5. `npx vitest run` penuh + `npm run typecheck`.

## Perubahan `confirm` (inTransaction)
`validateStan` tetap di luar transaksi. Sisanya di dalam `inTransaction(() => { ... })` dengan urutan:
1. `seen` (requestId sudah ada) -> `return get(seen.deposit_id)`.
2. `get(id)`; jika `POSTED` dan `stan` sama -> return (D7, **sebelum** cek batas).
3. `canConfirm` else `INVALID_STATE`.
4. **Baru:** `assertWithinDailyLimit(usedToday(dep.accountNo, dep.createdAt, id), dep.amount)`.
5. `at = now()`, INSERT `host_requests`, `postDepositEntries`, UPDATE status `POSTED`.

Alasan: bila cek gagal setelah INSERT `host_requests` tanpa transaksi, retry requestId yang sama akan kena jalur `seen` dan mengembalikan setoran `COUNTED` tanpa error. Dengan transaksi, error memicu ROLLBACK sehingga retry dievaluasi ulang. Urutan pemanggilan `now()` tidak berubah. `inTransaction` adalah function declaration (hoisted), boleh dipindah di atas `confirm` agar mudah dibaca. Verifikasi tidak ada pemanggil `confirm` di dalam transaksi lain (`BEGIN` bersarang gagal di SQLite).

## Risiko
- **R1 jangan dilebih-klaim.** `DatabaseSync` sinkron, jadi dalam satu proses tidak ada interleaving. Transaksi memberi atomisitas (rollback) dan perlindungan multi-proses/koneksi. AC9 serial mengunci perilaku cek ulang, bukan konkurensi sungguhan.
- **Test AC11/AC7 butuh clock settable.** `setup()` sekarang clock auto-tick tetap di 2026-10-14. Setoran 50 jt butuh 3 setoran (maks 20 jt per setoran), jadi lewat helper, bukan INSERT manual.
- **AC14 memakai clock sistem** (`createApp(db)` tanpa parameter clock; `server.ts` sengaja tidak diubah). Hindari flake tengah malam WIB: `vi.useFakeTimers({ toFake: ["Date"] })` + `vi.setSystemTime(<tengah hari WIB>)`, jangan fake timer lain agar `fetch` tidak menggantung.
- **Test lama** bisa terpengaruh bila ada yang menumpuk >50 jt pada ACC_A di hari yang sama; terdeteksi di Langkah 2.5.
- **Pesan bergantung ICU `id-ID`** (`formatRupiah`, titik pemisah ribuan). Node resmi full-ICU; `money.test.ts` sudah mengandalkannya.
- **R2/D8**: setoran mulai 23:59 WIB, `confirm` 00:01 dihitung ke hari sebelumnya. Diterima, perlu konfirmasi bisnis, tulis di deskripsi PR.
- **R7**: kode `DAILY_LIMIT_EXCEEDED` belum dipetakan ke response code host; tiket lanjutan, tulis di deskripsi PR.
- `recordCount` tidak transaksional. Dua `COUNTED` bisa lolos bersamaan; itu memang tujuan cek ulang di `confirm` (D3).

## Verifikasi
- `npx vitest run`: seluruh test lama (167) + test baru hijau; Langkah 1 terdokumentasi (daftar test merah sebelum implementasi).
- `npm run typecheck` bersih, tanpa `any` baru, nominal integer.
- `grep -n "UPDATE\|DELETE" src/ledger.ts` tidak menemukan UPDATE/DELETE pada `ledger_entries`.
- Manual (opsional): `npm run seed && npm start`, tiga setoran 20 jt untuk satu rekening lewat curl, yang ketiga `POST /deposits/:id/count` Rp 10,1 jt mengembalikan 400.
- Review PR dengan `docs/checklist-review.md`; cek apakah ada CHANGELOG; deskripsi PR memuat R2, R5, R7.
