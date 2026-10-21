# Refleksi (contoh dari trainer)

File ini ditulis oleh manusia, bukan oleh Claude. Peserta menulis refleksi masing-masing.

## Koreksi dan keputusan yang saya ambil

- **PRD:** Claude mengajukan 6 pertanyaan dengan rekomendasi. Saya mengikuti sebagian besar rekomendasi, dan menambah keputusan bahwa setoran yang melewati batas ditolak seluruhnya.
- **Asumsi D8:** Claude menandai bahwa hari setoran dihitung dari `created_at`. Saya menyetujuinya untuk take-home dan mencatatnya sebagai follow-up ke bisnis.
- **Plan:** Plan mode menghasilkan urutan test-first per acceptance criteria. Saya menyetujui plan tanpa perubahan.
- **Implementasi:** skill `deposit-team:add-deposit-rule` dimuat otomatis. Test gagal terlebih dahulu, lalu 188 test lulus.
- **Review:** `review-checklist` menemukan satu kekurangan (CHANGELOG). Saya meminta Claude memperbaikinya.
- **PR:** Claude menulis bahwa output RED di deskripsi PR adalah rekonstruksi. Saya menerimanya dan menuliskannya di bagian review manual.

## Biaya (total_cost_usd per prompt, Claude Code 2.1.306, Sonnet 5.5)

| Fase | Biaya |
|---|---|
| Interview PRD | $0,14 |
| Menulis PRD | $0,38 |
| Plan mode | $0,27 |
| Implementasi test-first | $0,25 |
| Review | $0,10 |
| Perbaikan + deskripsi PR | $0,26 |
| **Total** | **$1,40** |

## Yang akan saya lakukan berbeda

- Menyebut sumber tanggal (start atau confirm) sejak prompt pertama, agar asumsi D8 tidak muncul di akhir.
- Menyimpan output RED dari terminal saat implementasi, agar deskripsi PR memakai log asli.
