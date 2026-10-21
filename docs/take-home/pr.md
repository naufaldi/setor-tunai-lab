# PR: Batas setoran harian Rp 50.000.000 per rekening

## Ringkasan perubahan

Total setoran tunai lewat mesin CRM untuk satu rekening kini dibatasi **Rp 50.000.000 per hari WIB**, gabungan semua terminal.

- `src/domain/money.ts`: konstanta `DAILY_DEPOSIT_LIMIT = 50_000_000`.
- `src/domain/daily-limit.ts` (baru): `wibDayBounds` (batas hari WIB, offset tetap +7) dan `assertWithinDailyLimit`, yang melempar `DAILY_LIMIT_EXCEEDED`.
- `src/deposit.service.ts`: helper `usedToday`, cek batas di `recordCount` dan `confirm`. `confirm` kini dibungkus transaksi.
- `CHANGELOG.md`: entri `[Unreleased]`.
- Tidak ada perubahan skema, ledger, `server.ts`, atau `package.json`.
- Dokumen: `docs/take-home/` (PRD, plan, hasil review).

## Keputusan PRD yang penting

Selengkapnya di `docs/take-home/prd.md`.

- **D1**: "hari" = kalender WIB (00:00 sampai 23:59), bukan UTC.
- **D2**: yang dihitung `POSTED` + `PENDING`. `REVERSED`, `CANCELLED`, `OPEN`, `COUNTED` tidak dihitung.
- **D3**: ditolak seluruhnya bila melewati batas, tanpa penerimaan sebagian. Dicek di `recordCount` dan dicek ulang di `confirm`.
- **D4**: batas inklusif. Tepat Rp 50.000.000 masih boleh.
- **D5**: satu konstanta global, total digabung lintas terminal.
- **D6**: HTTP 400 lewat `DepositError`. Pesan menyebut sisa kuota, tanpa nomor rekening.
- **D7**: retry `confirm` idempoten tetap lolos tanpa cek batas.
- **D8**: hari setoran ditentukan oleh `deposits.created_at` (saat `start`).

## Risiko untuk mesin CRM di lapangan

- **R2 / D8 (perlu konfirmasi bisnis)**: setoran dimulai 23:59 WIB dan di-`confirm` 00:01 WIB dihitung ke hari sebelumnya, bisa berbeda dari tanggal posting di ledger. Memakai hari posting butuh kolom waktu konfirmasi (perubahan skema, di luar scope).
- **R7**: `DAILY_LIMIT_EXCEEDED` belum dipetakan ke response code host (`docs/format-pesan-host.md`). Host/CRM bisa menerima kode yang tidak dikenal. Perlu tiket lanjutan **sebelum dipakai di mesin nyata**.
- **R5**: setoran sebelum rilis ikut terhitung pada hari rilis. Rilis di luar jam sibuk (`docs/prosedur-release.md`).
- **R6**: `PENDING` yang akhirnya `REVERSED` menahan kuota nasabah sementara. Kuota kembali setelah `reverse`.
- **R1**: `confirm` kini transaksional (rollback bila cek gagal, aman untuk multi-koneksi). `recordCount` tidak transaksional, jadi dua setoran `COUNTED` bisa lolos bersamaan. Itu sebabnya `confirm` mengecek ulang.
- **R4**: query total jalan tanpa indeks `deposits(account_no, created_at)`. Aman untuk volume sekarang. Bila tabel membesar, tambahkan indeks lewat `docs/prosedur-migrasi.md`.
- Pesan error memakai `formatRupiah` (ICU `id-ID`, titik pemisah ribuan).

## Output test

### RED (test baru terhadap code sebelum fitur)

Direkonstruksi: dijalankan di worktree sementara pada commit induk fitur (`8349c4e~1`) dengan folder `test/` dari commit fitur (`8349c4e`). Ini bukan log asli dari saat TDD berlangsung.

```
$ npx vitest run test/daily-limit.domain.test.ts test/daily-limit.service.test.ts test/api.daily-limit.test.ts
 Test Files  3 failed (3)
      Tests  8 failed | 7 passed (15)

 FAIL test/daily-limit.domain.test.ts   (modul ../src/domain/daily-limit.js belum ada)
 × AC3  recordCount melewati batas ditolak, setoran tetap OPEN, ledger tidak bertambah
 × AC4  setoran 15 jt saat sisa 10 jt ditolak penuh
 × AC5  kuota habis: pesan sisa Rp 0
 × AC6  setoran PENDING ikut dihitung
 × AC9  tiga COUNTED 20 jt: confirm ketiga ditolak, tanpa ledger dan tanpa host_requests
 × AC11 batas hari WIB: 00:00 WIB mereset kuota, 23:30 WIB masih hari yang sama
 × AC12 dihitung lintas terminal
 × AC14 count yang melewati batas: 400, body {error, message}, tanpa nomor rekening
        (AssertionError: expected 200 to be 400)
 ✓ AC1, AC2, AC7, AC8, AC10, AC13, AC15 (penjaga, hijau sejak awal sesuai plan)
```

File domain gagal dimuat, jadi tidak masuk hitungan 15 test.

### GREEN (HEAD, setelah CHANGELOG)

```
$ npx vitest run
 Test Files  14 passed (14)
      Tests  188 passed (188)

$ npm run typecheck
> tsc --noEmit
(bersih, tanpa error)
```

Baseline sebelum fitur: 167 test.

## Hasil review

Dari `/deposit-team:review-checklist` (selengkapnya di `docs/take-home/review.md`): 13 butir `ok`, 1 `perlu-diperbaiki`, 2 `tidak relevan`.

- Temuan CHANGELOG sudah diperbaiki (`CHANGELOG.md`, bagian `[Unreleased]`).
- Dua butir `tidak relevan` ("Deskripsi PR menjelaskan risiko", "Screenshot atau output test dilampirkan") tidak terlihat dari diff. Deskripsi ini memuat risiko dan output test. Pemeriksaan akhirnya oleh reviewer di bawah.
- Catatan review: `DAILY_LIMIT_EXCEEDED` jatuh ke default 400. PRD D6 memang menetapkan 400.

## Diperiksa manual oleh reviewer

Diisi oleh trainer (manusia), bukan oleh Claude.

- [x] Keputusan D1-D8 di PRD sesuai jawaban interview.
- [x] Asumsi D8 (hari dari `created_at`) dicatat sebagai follow-up untuk konfirmasi bisnis.
- [x] Output RED direkonstruksi, bukan log asli saat TDD. Diterima, karena test terbukti gagal terhadap code sebelum fitur.
- [x] Tidak ada nomor rekening lengkap di pesan error dan log.
- [x] CI `test` lulus di PR ini.
