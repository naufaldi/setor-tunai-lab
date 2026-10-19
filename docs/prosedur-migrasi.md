# Prosedur migrasi database (hanya saat ubah skema)

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
