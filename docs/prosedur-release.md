# Prosedur release (hanya saat release)

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
