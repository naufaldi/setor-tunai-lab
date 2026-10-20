---
name: prepare-release
description: Siapkan draft release setor-tunai-api (CHANGELOG, versi package.json, release note) berdasarkan docs/prosedur-release.md
disable-model-invocation: true
argument-hint: <versi, contoh 0.2.0>
allowed-tools: Bash(bash ${CLAUDE_SKILL_DIR}/scripts/commit-sejak-tag.sh) Bash(git log:*) Bash(git describe:*) Bash(git status:*)
---

# Siapkan release v$ARGUMENTS

Sumber prosedur: `docs/prosedur-release.md`. Skill ini hanya menyiapkan draft (langkah 2, 3, 5). Langkah lain tetap dikerjakan orang.

## Commit sejak tag v* terakhir

Jika belum ada tag `v*`, daftar di bawah berisi 15 commit terakhir.

!`bash ${CLAUDE_SKILL_DIR}/scripts/commit-sejak-tag.sh`

## Langkah

1. Validasi `$ARGUMENTS`: harus SemVer `X.Y.Z`. Jika kosong atau tidak valid, berhenti dan minta versi. Jika `docs/release/v$ARGUMENTS.md` sudah ada, tanyakan dulu sebelum menimpa.
2. Kelompokkan commit di atas ke kategori Keep a Changelog: Added (`feat`), Changed, Deprecated, Removed, Fixed (`fix`), Security. Commit murni `docs`/`test`/`chore` boleh diringkas atau dilewati.
3. `CHANGELOG.md`: jika belum ada, buat dengan header Keep a Changelog. Tambahkan entri `## [$ARGUMENTS] - <tanggal hari ini, YYYY-MM-DD>` di bawah `## [Unreleased]`, berisi hasil langkah 2. Ini draft untuk direview orang.
4. `package.json`: ubah field `version` menjadi `$ARGUMENTS`. Jangan ubah field lain.
5. Buat `docs/release/v$ARGUMENTS.md` (buat folder jika perlu) dengan bagian:
   - **Daftar perubahan**: ringkasan dari CHANGELOG.
   - **Risiko**: nilai dari commit yang ada. Perhatikan perubahan di `src/domain/`, `src/ledger.ts`, `src/deposit.service.ts`, migrasi database, dan perubahan format pesan host. Untuk setiap risiko tulis dampak (uang/ledger/rekonsiliasi) dan mitigasinya. Jangan mengarang risiko yang tidak didukung commit.
   - **Langkah rollback**: kembali ke versi sebelumnya (redeploy artefak versi lalu). Ingat ledger tidak boleh di-update atau di-delete, jadi koreksi data selalu lewat entri baru (reverse), bukan hapus. Jika ada migrasi database, rujuk `docs/prosedur-migrasi.md`.
   - **Checklist** (semua belum dicentang, tiap butir butuh bukti di tiket release: screenshot atau link):
     - [ ] Branch `main` hijau di CI (langkah 1)
     - [ ] Review draft CHANGELOG dan versi package.json (langkah 2-3)
     - [ ] Buat tag `v$ARGUMENTS` dan push tag (langkah 4)
     - [ ] Approval Lead Software Application (langkah 6)
     - [ ] Kirim jadwal deploy ke tim Operasional ATM minimal H-2 (langkah 7)
     - [ ] Deploy staging, smoke test setoran Rp 50.000 dan Rp 100.000 (langkah 8)
     - [ ] Cek dashboard error rate 30 menit setelah deploy staging (langkah 9)
     - [ ] Deploy production di jendela 22:00-24:00 WIB (langkah 10)
     - [ ] Pantau journal 5 terminal sampel selama 1 jam (langkah 11)
     - [ ] Tutup tiket release dan arsipkan release note (langkah 12)
6. Jalankan `npm run typecheck` dan `npx vitest run`; catat hasilnya di release note. Jika gagal, laporkan apa adanya.
7. Laporkan ke pengguna file yang dibuat/diubah dan butir checklist yang menunggu orang.

## Larangan

- Jangan `git push` dan jangan membuat tag (`git tag`). Langkah 4 ada di checklist untuk dikerjakan orang.
- Jangan menjalankan atau mengklaim selesai langkah yang butuh orang: approval Lead Software Application, jadwal ke tim Operasional ATM, deploy staging dan production, pemantauan.
- Jangan commit otomatis kecuali diminta.
- Jangan menyalin nomor rekening lengkap ke release note; pakai format `****1234`.
