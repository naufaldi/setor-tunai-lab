# PRD: Batas Setoran Harian per Rekening

Status: Draft, siap direview
Cakupan code: `src/domain/`, `src/deposit.service.ts`, `test/`. `src/server.ts` tidak perlu diubah (lihat D6).

## 1. Latar belakang

Mesin CRM saat ini menerima setoran tanpa batas total per rekening. Satu setoran dibatasi 200 lembar
(maksimal Rp 20.000.000 dengan pecahan Rp 100.000), tetapi tidak ada batas jumlah setoran per hari.
Satu rekening bisa disetor berkali-kali, di mesin yang sama maupun berbeda.

Kebutuhan: total setoran tunai lewat mesin CRM untuk satu rekening tidak boleh melebihi
**Rp 50.000.000 per hari**. Batas ini mengurangi risiko pemecahan setoran (structuring) dan membatasi
eksposur kas mesin.

Kondisi code yang relevan:

- Nominal setoran baru diketahui di `recordCount` (status `COUNTED`). Ledger baru diposting di `confirm` dan `resolve`.
- Semua waktu disimpan sebagai ISO UTC (`toISOString()`), sedangkan "hari" bagi nasabah adalah hari WIB.
- `confirm` belum dibungkus transaksi, berbeda dengan `markPending`, `resolve`, dan `reverse`.
- Status `PENDING` (timeout host) bisa menjadi `POSTED` lewat `resolve`, atau `REVERSED` lewat `reverse`.
- CRM mengirim ulang `confirm` (retry) bila host tidak membalas dalam 30 detik.

## 2. Scope dan non-scope

### Dalam scope

- Aturan domain: total setoran per rekening per hari WIB tidak boleh melebihi Rp 50.000.000.
- Pengecekan di `recordCount` (setelah uang dihitung) dan di `confirm` (pengaman terakhir).
- Error baru `DAILY_LIMIT_EXCEEDED`, HTTP 400, pesan menyebut sisa kuota.
- Konstanta batas di `src/domain/money.ts`.
- Test Vitest untuk semua acceptance criteria di bawah.

### Di luar scope

- Pemetaan `DAILY_LIMIT_EXCEEDED` ke response code host (`docs/format-pesan-host.md`).
- Batas yang dapat dikonfigurasi per rekening, segmen nasabah, atau terminal.
- Penerimaan sebagian (partial accept) sampai sisa kuota.
- Perubahan skema database atau migrasi. Total dihitung dari tabel `deposits` yang sudah ada.
- Perubahan ledger. Ledger tetap insert-only.
- Endpoint untuk melihat sisa kuota. Sisa kuota hanya muncul di pesan error.
- Layar mesin CRM dan teks struk.

## 3. Keputusan dan alasan

| # | Keputusan | Alasan |
|---|-----------|--------|
| D1 | "Hari" adalah kalender WIB (00:00:00 sampai 23:59:59, UTC+7). Konversi dari `created_at` UTC dilakukan di code. | Nasabah dan operasional memakai hari WIB. Hari UTC berganti pukul 07:00 WIB dan membingungkan. |
| D2 | Total harian = setoran `POSTED` + `PENDING` untuk rekening itu. `REVERSED`, `CANCELLED`, `OPEN`, `COUNTED` tidak dihitung. | `PENDING` bisa jadi sudah sukses di host. Bila tidak dihitung, batas bisa dilewati. Setoran yang dibalik mengembalikan kuota. `OPEN` dan `COUNTED` belum final. |
| D3 | Cek di `recordCount` dan di `confirm`. Setoran yang membuat total melewati batas ditolak seluruhnya. | Nominal baru diketahui di `recordCount`, jadi nasabah langsung tahu dan uang dikembalikan. `confirm` mengecek ulang karena dua setoran `COUNTED` bisa lolos bersamaan. Penolakan penuh lebih sederhana dan tidak menimbulkan selisih antara uang yang dimasukkan dan yang diterima. |
| D4 | Batas inklusif: total tepat Rp 50.000.000 masih boleh. Ditolak bila `total > 50.000.000`. | "Tidak boleh melebihi" berarti kurang dari atau sama dengan. |
| D5 | Satu konstanta global `DAILY_DEPOSIT_LIMIT = 50_000_000` di `src/domain/money.ts`. Total digabung dari semua terminal. | Sesuai kebutuhan sekarang dan mudah dijadikan konfigurasi nanti. Penggabungan lintas terminal mencegah pemecahan setoran ke beberapa mesin. |
| D6 | Error `DAILY_LIMIT_EXCEEDED` lewat `DepositError`, HTTP 400. `server.ts` sudah memetakan kode yang tidak dikenal ke 400, jadi tidak perlu perubahan. Pesan menyebut sisa kuota, tanpa nomor rekening. | Konsisten dengan error domain lain. CLAUDE.md melarang log nomor rekening lengkap. |
| D7 | Retry `confirm` yang idempoten tetap lolos tanpa cek batas. | Setoran itu sendiri sudah dihitung dalam total. Bila dicek ulang, retry CRM ditolak padahal setorannya sudah sukses. |
| D8 | Hari suatu setoran ditentukan oleh `deposits.created_at` (saat `start`). | Itu satu-satunya timestamp pada setiap setoran, termasuk `PENDING` yang belum punya entri ledger. Lihat R2. |

Format pesan error: `batas setoran harian terlampaui, sisa kuota hari ini Rp {sisa}`, memakai `formatRupiah`
dari `src/domain/money.ts`. `sisa` = `50.000.000 - total terpakai`, minimum 0.

## 4. Acceptance criteria

"Total terpakai" = jumlah `amount` setoran `POSTED` + `PENDING` rekening itu pada hari WIB yang sama.
Pecahan: Rp 100.000 dan Rp 50.000. Test memakai clock yang bisa diatur (parameter `now` pada `createDepositService`).

**AC1: Di bawah batas, diterima**
- Given rekening A belum punya setoran hari ini
- When `recordCount` Rp 20.000.000
- Then status `COUNTED` dan `amount` = 20.000.000

**AC2: Tepat di batas, diterima (D4)**
- Given rekening A punya setoran `POSTED` Rp 30.000.000 hari ini
- When setoran baru `recordCount` Rp 20.000.000 lalu `confirm`
- Then status `POSTED` dan total kredit rekening A hari ini Rp 50.000.000

**AC3: Melewati batas ditolak di `recordCount` (D3)**
- Given rekening A punya setoran `POSTED` Rp 40.000.000 hari ini
- When `recordCount` Rp 10.100.000 (101 lembar Rp 100.000)
- Then error `DAILY_LIMIT_EXCEEDED`, setoran tetap `OPEN` dengan `amount` 0, dan tidak ada entri ledger baru
- And pesan memuat `sisa kuota hari ini Rp 10.000.000`

**AC4: Tidak ada penerimaan sebagian**
- Given sisa kuota rekening A Rp 10.000.000
- When `recordCount` Rp 15.000.000
- Then seluruhnya ditolak seperti AC3, bukan diterima Rp 10.000.000

**AC5: Kuota habis**
- Given total terpakai rekening A = Rp 50.000.000
- When `recordCount` Rp 50.000
- Then error `DAILY_LIMIT_EXCEEDED` dengan pesan `sisa kuota hari ini Rp 0`

**AC6: `PENDING` dihitung (D2)**
- Given rekening A punya setoran `PENDING` Rp 30.000.000 dan `POSTED` Rp 10.000.000 hari ini
- When `recordCount` Rp 10.100.000
- Then ditolak `DAILY_LIMIT_EXCEEDED`

**AC7: `REVERSED` mengembalikan kuota (D2)**
- Given rekening A punya dua setoran `PENDING` masing-masing Rp 20.000.000 (total terpakai Rp 40.000.000), lalu keduanya di-`reverse`
- When tiga setoran baru berturut-turut (Rp 20.000.000, Rp 20.000.000, Rp 10.000.000) di-`recordCount` dan di-`confirm`
- Then semuanya `POSTED` (total Rp 50.000.000), karena total terpakai kembali 0 setelah `reverse`

**AC8: `CANCELLED`, `OPEN`, `COUNTED` tidak dihitung (D2)**
- Given rekening A punya setoran `CANCELLED` Rp 20.000.000 dan setoran `COUNTED` Rp 20.000.000 yang belum dikonfirmasi
- When setoran baru `recordCount` Rp 20.000.000
- Then diterima di `recordCount` (benturan saat `confirm` dicakup AC9)

**AC9: Cek ulang di `confirm` (D3)**
- Given tiga setoran S1, S2, S3 untuk rekening A, semuanya `COUNTED` Rp 20.000.000 (lolos `recordCount` karena belum ada yang `POSTED`)
- When ketiganya di-`confirm` berurutan
- Then S1 dan S2 `POSTED` (total Rp 40.000.000)
- And `confirm` S3 ditolak `DAILY_LIMIT_EXCEEDED` (Rp 40.000.000 + Rp 20.000.000 > Rp 50.000.000), S3 tetap `COUNTED`, dan tidak ada entri ledger untuk S3

**AC10: Retry `confirm` idempoten tetap lolos (D7)**
- Given setoran S `POSTED` yang membuat total terpakai tepat Rp 50.000.000
- When `confirm` dikirim ulang dengan `requestId` sama, atau `requestId` baru dengan STAN sama
- Then mengembalikan setoran `POSTED` yang sama, tanpa error dan tanpa entri ledger tambahan

**AC11: Batas direset per hari WIB (D1)**
- Given rekening A punya setoran `POSTED` Rp 50.000.000 dengan `created_at` `2026-10-20T16:59:00Z` (23:59 WIB, 20 Okt)
- When setoran baru dibuat pada `2026-10-20T17:01:00Z` (00:01 WIB, 21 Okt) lalu `recordCount` Rp 20.000.000
- Then diterima, karena sudah hari WIB berikutnya
- And bila setoran baru dibuat pada `2026-10-20T16:30:00Z` (23:30 WIB, 20 Okt), ditolak

**AC12: Satu rekening, banyak terminal (D5)**
- Given rekening A punya setoran `POSTED` Rp 40.000.000 di `ATM-0001` hari ini
- When setoran di `ATM-0002` untuk rekening A `recordCount` Rp 20.000.000
- Then ditolak `DAILY_LIMIT_EXCEEDED`

**AC13: Rekening lain tidak terpengaruh**
- Given rekening A sudah di batas Rp 50.000.000 hari ini
- When rekening B `recordCount` Rp 20.000.000
- Then diterima

**AC14: Respons API dan privasi (D6)**
- Given kondisi AC3 lewat HTTP `POST /deposits/:id/count`
- When request dikirim
- Then respons HTTP 400 dengan body `{ "error": "DAILY_LIMIT_EXCEEDED", "message": "..." }`
- And `message` tidak memuat nomor rekening, baik lengkap maupun terpotong

**AC15: `resolve` tidak terpengaruh batas**
- Given setoran `PENDING` yang sudah terhitung dalam total terpakai
- When `resolve` dengan STAN valid
- Then menjadi `POSTED` tanpa error `DAILY_LIMIT_EXCEEDED`, dan total terpakai tidak berubah

## 5. Risiko dan pertanyaan terbuka

| # | Risiko | Mitigasi |
|---|--------|----------|
| R1 | **Race condition.** `confirm` tidak dalam transaksi, sehingga dua `confirm` bersamaan untuk rekening sama bisa sama-sama lolos cek dan melewati batas. | Bungkus cek, posting, dan update status di `confirm` dalam `inTransaction` (`BEGIN IMMEDIATE`) seperti `resolve`. Jalur idempoten (D7) harus tetap dievaluasi sebelum cek batas. AC9 mengunci perilaku ini. |
| R2 | **Hari berdasarkan `created_at`.** Setoran dimulai 23:59 WIB tetapi di-`confirm` 00:01 WIB dihitung ke hari sebelumnya, bisa berbeda dengan hari posting di ledger. | Diterima untuk versi ini (D8). Bila bisnis ingin hari posting, perlu kolom waktu konfirmasi di `deposits` (perubahan skema, di luar scope). **Perlu konfirmasi bisnis.** |
| R3 | **Konversi zona waktu** dari string UTC rawan salah di batas tengah malam. | Satu fungsi domain murni (mis. `wibDay(iso)`) dengan test di 16:59Z dan 17:00Z (AC11). WIB tidak memakai DST, offset tetap +7. |
| R4 | **Performa.** Query total jalan di tiap `recordCount` dan `confirm`, tanpa indeks pada `deposits(account_no, created_at)`. | Volume dummy kecil. Bila tabel membesar, tambahkan indeks lewat `docs/prosedur-migrasi.md`. Di luar scope. |
| R5 | **Data lama.** Setoran sebelum rilis ikut dihitung pada hari rilis. | Dampak kecil, hanya pada hari rilis. Rilis di luar jam sibuk (`docs/prosedur-release.md`). |
| R6 | **`PENDING` yang berakhir `REVERSED`** menahan kuota nasabah untuk sementara. | Diterima (D2). `reverse` mengembalikan kuota. Prioritaskan penyelesaian `PENDING`. |
| R7 | **Response code host belum dipetakan**, sehingga host/CRM bisa menerima kode yang tidak dikenal. | Di luar scope. Perlu tiket lanjutan sebelum dipakai di mesin nyata. |
| R8 | **Aturan bisnis wajib ber-test** (CLAUDE.md). | Setiap AC dipetakan ke minimal satu test di `test/`. |

## 6. Definisi selesai

- AC1 sampai AC15 punya test yang lulus (`npx vitest run`).
- `npm run typecheck` bersih. Nominal tetap integer rupiah, tanpa `any` baru.
- Tidak ada UPDATE atau DELETE pada `ledger_entries`.
- Review memakai `docs/checklist-review.md`.
