# CLAUDE.md: setor-tunai-api

API setoran tunai lewat mesin CRM (cash recycling). Ilustrasi untuk training Hacktiv8. Semua data dummy.

## Perintah

- Install: `npm install`
- Test: `npm test`
- Type check: `npm run typecheck`
- Jalankan lokal: `npm run seed && npm start` (port 8787)

## Struktur

- `src/domain/`: aturan bisnis (nominal, validasi, hitung jumlah)
- `src/deposit.service.ts`: alur setoran (start, count, confirm, cancel)
- `src/ledger.ts`: entri ledger (debit kas mesin, kredit rekening)
- `src/journal/`: parser dan rekap journal mesin CRM
- `src/server.ts`: HTTP API (node:http)
- `test/`: Vitest, database node:sqlite in-memory

## Aturan code

- TypeScript strict. Jangan pakai `any` kecuali di batas HTTP.
- Nominal uang selalu integer rupiah. Jangan pakai float.
- Ledger tidak boleh di-update atau di-delete. Koreksi selalu lewat entri baru.
- Setiap perubahan aturan bisnis wajib ada test di `test/`.
- Jangan log nomor rekening lengkap. Pakai format `****1234`.

## Prosedur release (hanya saat release)

1. Pastikan branch `main` hijau di CI.
   - Catatan: dokumentasikan bukti langkah 1 di tiket release (screenshot atau link).
2. Update CHANGELOG.md dengan format Keep a Changelog.
   - Catatan: dokumentasikan bukti langkah 2 di tiket release (screenshot atau link).
3. Naikkan versi di package.json sesuai SemVer.
   - Catatan: dokumentasikan bukti langkah 3 di tiket release (screenshot atau link).
4. Buat tag `vX.Y.Z` dan push tag.
   - Catatan: dokumentasikan bukti langkah 4 di tiket release (screenshot atau link).
5. Buat release note berisi daftar perubahan, risiko, dan langkah rollback.
   - Catatan: dokumentasikan bukti langkah 5 di tiket release (screenshot atau link).
6. Minta approval dari Lead Software Application.
   - Catatan: dokumentasikan bukti langkah 6 di tiket release (screenshot atau link).
7. Kirim jadwal deploy ke tim Operasional ATM minimal H-2.
   - Catatan: dokumentasikan bukti langkah 7 di tiket release (screenshot atau link).
8. Deploy ke staging, jalankan smoke test setoran Rp 50.000 dan Rp 100.000.
   - Catatan: dokumentasikan bukti langkah 8 di tiket release (screenshot atau link).
9. Cek dashboard error rate 30 menit setelah deploy staging.
   - Catatan: dokumentasikan bukti langkah 9 di tiket release (screenshot atau link).
10. Deploy ke production di jendela 22:00-24:00 WIB.
   - Catatan: dokumentasikan bukti langkah 10 di tiket release (screenshot atau link).
11. Pantau journal 5 terminal sampel selama 1 jam.
   - Catatan: dokumentasikan bukti langkah 11 di tiket release (screenshot atau link).
12. Tutup tiket release dan arsipkan release note.
   - Catatan: dokumentasikan bukti langkah 12 di tiket release (screenshot atau link).

## Prosedur migrasi database (hanya saat ubah skema)

1. Tulis migrasi di `migrations/NNNN_nama.sql`.
   - Contoh: untuk langkah 1, lihat migrasi sebelumnya sebagai acuan format dan penamaan.
2. Migrasi harus bisa dijalankan dua kali tanpa error (IF NOT EXISTS).
   - Contoh: untuk langkah 2, lihat migrasi sebelumnya sebagai acuan format dan penamaan.
3. Jangan menghapus kolom di migrasi yang sama dengan perubahan code.
   - Contoh: untuk langkah 3, lihat migrasi sebelumnya sebagai acuan format dan penamaan.
4. Tambahkan test yang membuka database kosong lalu menjalankan semua migrasi.
   - Contoh: untuk langkah 4, lihat migrasi sebelumnya sebagai acuan format dan penamaan.
5. Untuk tabel ledger, migrasi hanya boleh menambah kolom nullable.
   - Contoh: untuk langkah 5, lihat migrasi sebelumnya sebagai acuan format dan penamaan.
6. Backup database staging sebelum migrasi.
   - Contoh: untuk langkah 6, lihat migrasi sebelumnya sebagai acuan format dan penamaan.
7. Catat durasi migrasi di staging.
   - Contoh: untuk langkah 7, lihat migrasi sebelumnya sebagai acuan format dan penamaan.
8. Jika lebih dari 5 menit, jadwalkan di luar jam operasional ATM.
   - Contoh: untuk langkah 8, lihat migrasi sebelumnya sebagai acuan format dan penamaan.
9. Siapkan skrip rollback.
   - Contoh: untuk langkah 9, lihat migrasi sebelumnya sebagai acuan format dan penamaan.
10. Review migrasi oleh dua orang.
   - Contoh: untuk langkah 10, lihat migrasi sebelumnya sebagai acuan format dan penamaan.

## Catatan format pesan host (referensi)

| Field | Nama | Keterangan |
|---|---|---|
| MTI | Message type | 0200 request, 0210 response |
| 2 | PAN | nomor kartu, selalu di-mask |
| 3 | Processing code | 21xxxx untuk setor tunai |
| 4 | Amount | 12 digit, tanpa desimal |
| 7 | Transmission date time | MMDDhhmmss |
| 11 | STAN | 6 digit, unik per terminal per hari |
| 12 | Local time | hhmmss |
| 13 | Local date | MMDD |
| 32 | Acquirer ID | kode bank |
| 37 | RRN | 12 karakter |
| 39 | Response code | 00 approve, 51 dana tidak cukup, 91 issuer down |
| 41 | Terminal ID | ATM-NNNN |
| 49 | Currency | 360 (IDR) |
| 102 | Account | rekening tujuan |

- Response code 00: Approved. Tampilkan pesan umum ke nasabah, simpan kode asli di log.
- Response code 05: Do not honor. Tampilkan pesan umum ke nasabah, simpan kode asli di log.
- Response code 12: Invalid transaction. Tampilkan pesan umum ke nasabah, simpan kode asli di log.
- Response code 13: Invalid amount. Tampilkan pesan umum ke nasabah, simpan kode asli di log.
- Response code 14: Invalid account. Tampilkan pesan umum ke nasabah, simpan kode asli di log.
- Response code 30: Format error. Tampilkan pesan umum ke nasabah, simpan kode asli di log.
- Response code 51: Insufficient funds. Tampilkan pesan umum ke nasabah, simpan kode asli di log.
- Response code 55: Incorrect PIN. Tampilkan pesan umum ke nasabah, simpan kode asli di log.
- Response code 57: Not permitted. Tampilkan pesan umum ke nasabah, simpan kode asli di log.
- Response code 58: Not permitted terminal. Tampilkan pesan umum ke nasabah, simpan kode asli di log.
- Response code 61: Exceeds limit. Tampilkan pesan umum ke nasabah, simpan kode asli di log.
- Response code 68: Response received too late. Tampilkan pesan umum ke nasabah, simpan kode asli di log.
- Response code 76: Invalid account. Tampilkan pesan umum ke nasabah, simpan kode asli di log.
- Response code 91: Issuer inoperative. Tampilkan pesan umum ke nasabah, simpan kode asli di log.
- Response code 94: Duplicate transmission. Tampilkan pesan umum ke nasabah, simpan kode asli di log.
- Response code 96: System malfunction. Tampilkan pesan umum ke nasabah, simpan kode asli di log.

## Checklist review PR (hanya saat review)

- [ ] Nama variabel jelas
  - Jika tidak terpenuhi, tulis komentar dengan label `perlu-diperbaiki` dan alasan singkat.
- [ ] Tidak ada magic number
  - Jika tidak terpenuhi, tulis komentar dengan label `perlu-diperbaiki` dan alasan singkat.
- [ ] Satu fungsi satu tugas
  - Jika tidak terpenuhi, tulis komentar dengan label `perlu-diperbaiki` dan alasan singkat.
- [ ] Test mencakup kasus gagal
  - Jika tidak terpenuhi, tulis komentar dengan label `perlu-diperbaiki` dan alasan singkat.
- [ ] Tidak ada nomor rekening lengkap di log
  - Jika tidak terpenuhi, tulis komentar dengan label `perlu-diperbaiki` dan alasan singkat.
- [ ] Nominal integer
  - Jika tidak terpenuhi, tulis komentar dengan label `perlu-diperbaiki` dan alasan singkat.
- [ ] Ledger append-only
  - Jika tidak terpenuhi, tulis komentar dengan label `perlu-diperbaiki` dan alasan singkat.
- [ ] Error code konsisten
  - Jika tidak terpenuhi, tulis komentar dengan label `perlu-diperbaiki` dan alasan singkat.
- [ ] Response HTTP sesuai (400, 404, 409)
  - Jika tidak terpenuhi, tulis komentar dengan label `perlu-diperbaiki` dan alasan singkat.
- [ ] Tidak ada dependency baru tanpa alasan
  - Jika tidak terpenuhi, tulis komentar dengan label `perlu-diperbaiki` dan alasan singkat.
- [ ] Komentar menjelaskan alasan, bukan apa
  - Jika tidak terpenuhi, tulis komentar dengan label `perlu-diperbaiki` dan alasan singkat.
- [ ] Tidak ada code mati
  - Jika tidak terpenuhi, tulis komentar dengan label `perlu-diperbaiki` dan alasan singkat.
- [ ] Tidak ada console.log tertinggal
  - Jika tidak terpenuhi, tulis komentar dengan label `perlu-diperbaiki` dan alasan singkat.
- [ ] CHANGELOG diperbarui jika perlu
  - Jika tidak terpenuhi, tulis komentar dengan label `perlu-diperbaiki` dan alasan singkat.
- [ ] Deskripsi PR menjelaskan risiko
  - Jika tidak terpenuhi, tulis komentar dengan label `perlu-diperbaiki` dan alasan singkat.
- [ ] Screenshot atau output test dilampirkan
  - Jika tidak terpenuhi, tulis komentar dengan label `perlu-diperbaiki` dan alasan singkat.

## Onboarding anggota tim baru

- Minta akses repo ke Lead. Tanyakan ke buddy jika ada kendala.
- Install Node 22.5 atau lebih baru. Tanyakan ke buddy jika ada kendala.
- Clone repo dan jalankan `npm install`. Tanyakan ke buddy jika ada kendala.
- Jalankan `npm test`, pastikan hijau. Tanyakan ke buddy jika ada kendala.
- Baca `docs/` dan contoh journal di `logs/`. Tanyakan ke buddy jika ada kendala.
- Pelajari alur setoran: start, count, confirm. Tanyakan ke buddy jika ada kendala.
- Pelajari format journal CRM. Tanyakan ke buddy jika ada kendala.
- Ikut shadowing on-call satu minggu. Tanyakan ke buddy jika ada kendala.
- Kerjakan satu tiket kecil berlabel `good-first-issue`. Tanyakan ke buddy jika ada kendala.
- Presentasikan hasil di sync mingguan. Tanyakan ke buddy jika ada kendala.

## Glosarium

- **CRM**: Cash Recycling Machine, mesin yang menerima dan mengeluarkan uang.
- **EJ**: Electronic Journal, log transaksi mesin.
- **STAN**: System Trace Audit Number, nomor urut transaksi per terminal.
- **RRN**: Retrieval Reference Number.
- **Reject bin**: tempat uang yang ditolak mesin.
- **Cassette**: tempat uang per nominal di dalam mesin.
- **Host**: sistem core banking atau switching yang meng-approve transaksi.
- **Timeout**: host tidak membalas dalam batas waktu.
- **Retry**: mesin mengirim ulang request setelah timeout.
- **Reversal**: pembatalan transaksi yang sudah diposting.
- **Settlement**: penyelesaian dana antar pihak di akhir hari.
- **Rekonsiliasi**: mencocokkan journal mesin, ledger, dan hitungan fisik.
