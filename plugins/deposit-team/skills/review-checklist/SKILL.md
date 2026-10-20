---
name: review-checklist
description: Review perubahan branch setor-tunai-api terhadap docs/checklist-review.md (read-only, hanya manual)
disable-model-invocation: true
context: fork
agent: Explore
---

# Review perubahan setor-tunai-api

Sumber checklist: `docs/checklist-review.md`. Baca file itu dulu, lalu cek setiap butirnya terhadap perubahan di bawah. Jangan mengubah file apa pun.

## Perubahan (branch ini terhadap sesi4-part2)

!`git diff sesi4-part2...HEAD`

## Langkah

1. Baca `docs/checklist-review.md`.
2. Untuk setiap butir, periksa diff di atas. Jika perlu konteks, baca file terkait dengan Read atau `grep` yang spesifik (jangan baca `logs/` utuh).
3. Butir yang bergantung pada PR (deskripsi PR, screenshot atau output test) tidak bisa dilihat dari diff: beri status `tidak relevan` dan tulis bahwa itu perlu dicek manual di PR.

## Output

Satu tabel, satu baris per butir checklist (semua butir, urut seperti di dokumen):

| Butir | Status | Bukti (file:baris) | Alasan |
|---|---|---|---|

- Status hanya salah satu: `ok`, `perlu-diperbaiki`, `tidak relevan`.
- Bukti berupa `file:baris` dari kode yang diperiksa. Isi `-` jika tidak ada.
- Alasan singkat, satu kalimat.

Setelah tabel, tulis ringkasan satu kalimat: jumlah butir per status. Jangan menambah temuan di luar checklist.
