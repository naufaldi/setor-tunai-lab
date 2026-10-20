# setor-tunai-lab

API setoran tunai melalui mesin CRM (cash recycling ATM). Repo latihan untuk training Hacktiv8 × Hitachi, "Advanced Claude Code for Agentic Software Engineering", Sesi 4.

> Ilustrasi. Semua data, rekening, dan journal adalah data dummy.

## Mulai

```bash
git clone https://github.com/naufaldi/setor-tunai-lab.git
cd setor-tunai-lab
npm install
npm test          # 167 test hijau di branch main
npm run seed && npm start   # API di http://localhost:8787
```

Butuh Node 22.5 atau lebih baru (memakai `node:sqlite`).

## Alur setoran

1. `POST /deposits` `{ terminalId, accountNo }` membuat sesi setoran (status OPEN).
2. `POST /deposits/:id/count` `{ notes: [{ denom, qty }], rejected }` menyimpan hasil hitung mesin (status COUNTED).
3. `POST /deposits/:id/confirm` `{ requestId, stan }` memposting ke ledger setelah host approve (status POSTED).
4. `POST /deposits/:id/pending` `{ actor, reason }` menandai setoran COUNTED yang respons host-nya belum jelas (status PENDING).
5. `POST /deposits/:id/resolve` `{ actor, reason, stan }` memposting setoran PENDING setelah host terbukti approve (status POSTED).
6. `POST /deposits/:id/reverse` `{ actor, reason }` membalik setoran PENDING melalui entri pembalik jika sudah ada entri ledger (status REVERSED).
7. `GET /accounts/:accountNo/balance` menampilkan saldo dari ledger.

## Mulai dari branch mana?

| Sesi / Lab | Branch atau tag | Isi |
|---|---|---|
| Sesi 4 Part 1, awal | `main` | Kondisi awal: insiden INC-2026-1014-01 belum diperbaiki, CLAUDE.md panjang |
| Sesi 4 Part 1, Lab 1-3 selesai | tag `lab3-selesai` | Perbaikan idempotency + test, CLAUDE.md ramping, subagent log-analyst |
| Sesi 4 Part 1, solusi | `sesi4-part1-solution` | Sama dengan `lab3-selesai` |
| Sesi 4 Part 1, Lab 4 selesai | `sesi4-superpowers-start` (tag `lab4-selesai`) | `lab3-selesai` + workflow CI test |
| Sesi 4 Part 1, Lab 5-8 selesai | `feature/pending-reversal` (tag `lab8-selesai`) | Fitur pending dan reversal, 167 test. Awal Sesi 4 Part 2 |
| Sesi 4 Part 2, Lab 9 selesai | tag `lab9-selesai` | Skill `/prepare-release` + draft release v0.2.0 |
| Sesi 4 Part 2, Lab 10 selesai | tag `lab10-selesai` | Catatan baseline di `docs/skills/` |
| Sesi 4 Part 2, Lab 11 selesai | tag `lab11-selesai` | Skill `add-deposit-rule` |
| Sesi 4 Part 2, Lab 12 selesai | tag `lab12-selesai` | Team plugin `deposit-team` + marketplace `hitachi-deposit` |
| Sesi 4 Part 2, awal Lab 13 | `sesi4-part2` (tag `lab13-mulai`) | Plugin v0.2.0 + skill `review-checklist` (context: fork) |
| Sesi 4 Part 2, Lab 13 selesai | `feature/reject-limit` (tag `lab13-selesai`), PR #3 | Aturan maksimal 20 lembar reject, review, PR, draft release v0.3.0 |

## Panduan Sesi 4 Part 2: Reusable Claude Code Skills

Part 2 membuat team skill dari prosedur yang sudah ada di repo, menguji apakah skill dimuat dan diikuti, membagikannya sebagai plugin, lalu memakainya dalam alur end-to-end (testing, review, approval).

### Persiapan

- Claude desktop, tab **Code**, **local session** yang membuka folder clone repo ini. Menu `/` dan **Add plugins** hanya tersedia di local session.
- Claude Code CLI untuk command `claude plugin ...` (Lab 12).
- Plugin Superpowers sudah terpasang dari Part 1 (Lab 11 memakai skill `superpowers:writing-skills`).
- Node 22.5 atau lebih baru, lalu `npm install`.

```bash
git fetch --all --tags
git checkout lab8-selesai      # titik awal Part 2 (akhir Part 1)
npm install && npm test        # 167 test lulus
```

Peserta yang tertinggal dapat melanjutkan dari tag lab sebelumnya, misalnya `git checkout lab10-selesai` sebelum Lab 11.

### Lab 9: Skill `/prepare-release`

Mulai dari `lab8-selesai`. Buat project skill dari `docs/prosedur-release.md`.

1. Buka session baru, mode **Manual**.
2. Kirim prompt (contoh):
   > Buat project skill baru di `.claude/skills/prepare-release/SKILL.md` berdasarkan `docs/prosedur-release.md`. Hanya dipanggil manual dengan `/prepare-release <versi>` (`disable-model-invocation: true`, `argument-hint`). Ambil daftar commit dengan `` !`command` ``. Tulis `CHANGELOG.md` dan `docs/release/v<versi>.md`. Langkah yang memerlukan manusia dimasukkan ke checklist dan tidak di-run. Jangan push, jangan tag. Validasi dengan `claude plugin validate .claude/skills` dan tunjukkan isi SKILL.md.
3. Klik **Allow** saat Claude menulis ke `.claude/skills` (folder `.claude` selalu meminta izin).
4. Ketik `/prep` dan pastikan skill muncul di menu, lalu jalankan `/prepare-release 0.2.0`.
5. Review draft, lalu commit skill dan draft. Jangan membuat tag.

Selesai jika validasi lolos, `CHANGELOG.md` dan `docs/release/v0.2.0.md` tersedia, dan tidak ada tag atau push. Jika skill batal dengan error dari `` !`command` ``, pindahkan logika shell ke script di folder skill (lihat `scripts/commit-sejak-tag.sh` di tag `lab9-selesai`). Hasil acuan: tag `lab9-selesai`.

### Lab 10: Baseline tanpa skill

Mulai dari `lab9-selesai`. Catat cara kerja Claude tanpa skill sebagai pembanding.

1. Buka session baru, mode **Accept edits**.
2. Kirim prompt yang hanya berisi business rule, tanpa urutan kerja:
   > Tambahkan aturan baru: setoran ditolak jika total nominal lebih dari Rp 15.000.000 per transaksi.
3. Periksa hasilnya dengan checklist berikut: test ditulis sebelum code, test terlihat gagal (RED) sebelum implementasi, ada test di level API, dan laporan akhir memuat bukti test.
4. Simpan catatan di `docs/skills/baseline-add-deposit-rule.md`.
5. Kembalikan code dengan `git checkout -- src test`, lalu commit catatan saja.

Hasil acuan: tag `lab10-selesai`. Pada execution trainer, ketiga run tanpa skill tidak menulis test terlebih dahulu (0/3).

### Lab 11: Skill `add-deposit-rule` dengan writing-skills

Mulai dari `lab10-selesai`. Temuan Lab 10 menjadi bahan prompt.

1. Buka session baru, mode **Manual**.
2. Kirim prompt (contoh):
   > Gunakan skill `superpowers:writing-skills` untuk membuat team skill di `.claude/skills/add-deposit-rule/SKILL.md`. Skill dipakai setiap kali kita menambah atau mengubah business rule setoran. Hasil baseline Lab 10: [daftar pelanggaran dari catatan Lab 10]. Description hanya berisi kondisi trigger, dalam bahasa Inggris, diawali "Use when". Sertakan format laporan akhir. Uji skill dengan subagent memakai skenario baseline, lalu validasi dengan `claude plugin validate .claude/skills`.
3. Klik **Allow** saat Claude menulis ke `.claude/skills`.
4. Uji trigger di session baru:
   - Prompt positif: prompt Lab 10. Transcript harus memuat `Skill add-deposit-rule` tanpa skill disebut di prompt.
   - Prompt negatif: "Jelaskan singkat alur reverse setoran di src/deposit.service.ts. Jangan mengubah file apa pun." Skill tidak boleh dimuat.
5. Bandingkan checklist dengan hasil Lab 10, lalu commit skill saja. Code rule dari uji trigger tidak di-commit.

Hasil acuan: tag `lab11-selesai`.

### Lab 12: Plugin `deposit-team`

Mulai dari `lab11-selesai`. Pindahkan skill ke plugin agar dapat dipasang di repo lain.

1. Buka session baru, mode **Manual**.
2. Kirim prompt (contoh):
   > Bungkus project skill di `.claude/skills` menjadi team plugin `deposit-team` di `plugins/deposit-team`, dengan plugin.json berisi name, version, dan description. Pindahkan skill dengan `git mv`. Buat marketplace `.claude-plugin/marketplace.json` bernama `hitachi-deposit`. Validasi plugin dan marketplace, uji lokal dengan `claude plugin marketplace add` dan `claude plugin install`, lalu tunjukkan `claude plugin details deposit-team`. Jangan commit.
3. Klik **Allow** untuk command `claude plugin`.
4. Di desktop: tombol `+` di samping prompt box → **Add plugins** → pilih `deposit-team` dan scope.
5. Jalankan ulang prompt Lab 10 di session baru. Skill dimuat dengan nama `deposit-team:add-deposit-rule`.
6. Commit plugin, marketplace, dan README.

Hasil acuan: tag `lab12-selesai`.

### Lab 13: End-to-end dengan team skill

Mulai dari branch `sesi4-part2` (tag `lab13-mulai`), yang sudah berisi skill `review-checklist` dan plugin v0.2.0.

```bash
git checkout -b feature/reject-limit-<nama> lab13-mulai
```

Kirim empat prompt berurutan, mode **Manual**. Setiap tahap diperiksa manusia sebelum lanjut.

| Tahap | Prompt | Yang diperiksa manusia |
|---|---|---|
| Testing | `Tambahkan aturan baru: hasil hitung mesin ditolak jika lembar reject lebih dari 20 dalam satu setoran.` | Skill `add-deposit-rule` dimuat, test gagal (RED) lalu lulus (GREEN) |
| Review | `/deposit-team:review-checklist` | Tabel temuan dari subagent |
| Perbaikan dan PR | `Perbaiki temuan [hasil review], run npx vitest run, commit, lalu tulis deskripsi PR. Jangan push.` | Diff, deskripsi PR, lalu push dan buka PR ke `sesi4-part2` |
| Release | `/deposit-team:prepare-release 0.3.0` | Checklist release yang tidak di-run Claude |

Selesai jika tidak ada temuan berstatus perlu-diperbaiki, PR terbuka, dan `docs/release/v0.3.0.md` tersedia. Jangan merge PR. Hasil acuan: branch `feature/reject-limit` (tag `lab13-selesai`) dan [PR #3](https://github.com/naufaldi/setor-tunai-lab/pull/3).

### Memasang plugin di repo lain

Marketplace hanya ada di branch `sesi4-part2`, sehingga ref `#sesi4-part2` diperlukan.

```bash
# di dalam session Claude Code
/plugin install deposit-team --marketplace naufaldi/setor-tunai-lab#sesi4-part2

# atau dari terminal
claude plugin marketplace add naufaldi/setor-tunai-lab#sesi4-part2
claude plugin install deposit-team@hitachi-deposit --scope project
```

Di Claude desktop (tab Code, local session): `+` → **Add plugins** → `deposit-team`. Skill yang tersedia:

| Skill | Cara dipanggil |
|---|---|
| `deposit-team:add-deposit-rule` | Dimuat otomatis saat menambah atau mengubah business rule setoran |
| `deposit-team:review-checklist` | Manual: `/deposit-team:review-checklist`, berjalan di subagent |
| `deposit-team:prepare-release` | Manual: `/deposit-team:prepare-release <versi>` |

Repo ini sudah mengaktifkan plugin untuk project di `.claude/settings.json`. Setiap anggota tim tetap menjalankan `claude plugin install deposit-team@hitachi-deposit --scope project` satu kali. Auto-update untuk marketplace pihak ketiga nonaktif secara default, jadi update dilakukan dengan `claude plugin update deposit-team@hitachi-deposit`.
