---
name: add-deposit-rule
description: Use when adding or changing a deposit business rule in setor-tunai-api, such as nominal limits, denominations, account validation, or deposit status transitions.
---

# Tambah atau Ubah Aturan Setoran

Aturan di `CLAUDE.md` tetap berlaku (integer rupiah, ledger append-only, test wajib, masking rekening). Skill ini mengatur urutan kerjanya.

## Urutan kerja (wajib berurutan)

1. **Cari test lama yang bertentangan** sebelum menulis apa pun. Jalankan `npx vitest run`, lalu `grep` di `test/` untuk nominal, konstanta, dan kode error yang terkait. Catat daftarnya (file, nama test, nilai lama).
2. **Tulis test baru dulu, di dua level:**
   - Domain (`test/money.test.ts`, `test/deposit.test.ts`, atau `test/pending.domain.test.ts`): kasus di bawah batas, tepat di batas, di atas batas.
   - API (`test/api.test.ts` atau `test/api.pending.test.ts`): status HTTP dan `error` code untuk kasus baru.
3. **RED:** jalankan `npx vitest run`. Test baru harus gagal karena alasan yang benar (aturan belum ada), bukan karena typo atau import. Simpan outputnya. Test lulus saat pertama dijalankan berarti test-nya salah, perbaiki dulu.
4. **Implementasi minimal** di `src/domain/`. Konstanta di `money.ts`. Jangan sentuh `src/ledger.ts`.
5. **GREEN:** jalankan `npx vitest run` dan `npm run typecheck`. Simpan outputnya.
6. **Ubah test lama yang bertentangan** hanya setelah step 5 menunjukkan test itu gagal akibat aturan baru. Ubah seperlunya dan tulis alasannya.

Menulis kode `src/` sebelum step 3 selesai: hapus perubahannya, ulangi dari step 2.

## Pemetaan HTTP status

Server memetakan `e.code` di `src/server.ts`:

| Jenis error | Status |
|---|---|
| Validasi input atau nominal (aturan baru biasanya ini) | 400 |
| Status setoran tidak mengizinkan operasi (`INVALID_STATE`) | 409 |
| Setoran atau rekening tidak ada | 404 |

Kode error baru wajib masuk pemetaan itu. Buktikan statusnya lewat test API, bukan asumsi dari domain.

## Test lama yang bertentangan

Jangan ubah diam-diam dan jangan menunggu laporan akhir untuk menyebutnya. Contoh: test 200 lembar x Rp 100.000 = Rp 20.000.000 bertentangan dengan batas Rp 15.000.000. Ubah nilainya (bukan hapus test-nya) agar tetap menguji perilaku aslinya, misalnya jumlah lembar yang tepat di batas.

Jika sebuah aturan lama tampak salah dan bukan hanya bertentangan, tanyakan ke user sebelum mengubah.

## Format laporan akhir (urutan tetap)

1. **Test lama yang diubah:** daftar `file > nama test`, nilai lama menjadi nilai baru, alasan. Tulis "tidak ada" jika kosong. Bagian ini paling atas.
2. **RED:** output `npx vitest run` yang menunjukkan test baru gagal (ringkas ke baris gagal dan jumlahnya).
3. **GREEN:** output `npx vitest run` yang lulus semua.
4. **Typecheck:** output `npm run typecheck`.
5. **File yang diubah:** satu baris per file.

Laporan tanpa output RED asli dianggap belum selesai.

## Kesalahan umum

| Alasan yang muncul | Kenyataan |
|---|---|
| "Aturannya sederhana, kodenya dulu" | Tanpa RED, tidak terbukti test-nya bisa gagal. |
| "Test domain sudah cukup" | Status HTTP hanya terbukti lewat test API. |
| "Test lama ini jelas usang, saya perbaiki saja" | Catat di bagian atas laporan, dengan alasan. |
