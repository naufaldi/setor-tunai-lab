# setor-tunai-lab

API setoran tunai melalui mesin CRM (cash recycling ATM). Repo latihan untuk training Hacktiv8 × Hitachi, "Advanced Claude Code for Agentic Software Engineering", Sesi 4.

> Ilustrasi. Semua data, rekening, dan journal adalah data dummy.

## Mulai

```bash
git clone https://github.com/naufaldi/setor-tunai-lab.git
cd setor-tunai-lab
npm install
npm test          # 111 test hijau di branch main
npm run seed && npm start   # API di http://localhost:8787
```

Butuh Node 22.5 atau lebih baru (memakai `node:sqlite`).

## Alur setoran

1. `POST /deposits` `{ terminalId, accountNo }` membuat sesi setoran (status OPEN).
2. `POST /deposits/:id/count` `{ notes: [{ denom, qty }], rejected }` menyimpan hasil hitung mesin (status COUNTED).
3. `POST /deposits/:id/confirm` `{ requestId, stan }` memposting ke ledger setelah host approve (status POSTED).
4. `GET /accounts/:accountNo/balance` menampilkan saldo dari ledger.

## Mulai dari branch mana?

| Sesi / Lab | Branch atau tag | Isi |
|---|---|---|
| Sesi 4 Part 1, awal Lab 1 | `main` | Kondisi awal: insiden INC-2026-1014-01 belum diperbaiki, CLAUDE.md panjang |
| Sesi 4 Part 1, Lab 1 selesai | `sesi4-part1-solution` | Perbaikan idempotency + test, lean CLAUDE.md, subagent log-analyst, catatan token |
| Sesi 4 Part 1, awal Lab 2 | `sesi4-superpowers-start` | Hasil Lab 1 + workflow CI test |
| Sesi 4 Part 1, Lab 2 selesai | `feature/pending-reversal`, PR #1 | Design doc, plan, 6 task oleh subagent, perbaikan dari code review, 167 test |
| Sesi 4 Part 2, Lab 9 selesai | tag `lab9-selesai` | Skill `/prepare-release` + draft release v0.2.0 |
| Sesi 4 Part 2, Lab 10 tahap baseline | tag `lab10-baseline` | Catatan baseline di `docs/skills/` |
| Sesi 4 Part 2, Lab 10 selesai | tag `lab10-selesai` | Skill `add-deposit-rule` |
| Sesi 4 Part 2, Lab 11 selesai | tag `lab11-selesai` | Team plugin `deposit-team` + marketplace `hitachi-deposit` |
| Sesi 4 Part 2, awal Lab 12 | `sesi4-part2` (tag `lab12-mulai`) | Plugin v0.2.2 + skill `review-checklist` (context: fork) |
| Sesi 4 Part 2, Lab 12 selesai | `feature/reject-limit` (tag `lab12-selesai`), PR #3 | Aturan maksimal 20 lembar reject, review, PR, draft release v0.3.0 |

Tag `lab1-selesai` sampai `lab8-selesai` memakai penomoran lama Part 1 (8 lab) dan tetap ada karena panduan Part 2 dimulai dari `lab8-selesai` (= `feature/pending-reversal`). Deck Part 1 sekarang memakai 2 lab dengan branch di atas.

Panduan langkah Lab 9-12 dan cara memasang plugin `deposit-team` ada di README branch [`sesi4-part2`](https://github.com/naufaldi/setor-tunai-lab/tree/sesi4-part2#panduan-sesi-4-part-2-reusable-claude-code-skills).

## Panduan Sesi 4 Part 1

Langkah dan prompt di bawah sama dengan deck dan sudah diuji ulang dari awal pada 21 Okt 2026 (Claude Code, Sonnet 5.5, rtk 1.0.1, superpowers 7.0.0). Angka token dan jumlah test di laptop kita bisa berbeda.

### Lab 1: Menyelesaikan insiden secara efisien

Mulai dari `main`. Bandingkan hasil dengan baris Baseline di `docs/catatan-token.md`.

1. Install RTK, lalu pasang hook global. `--auto-patch` wajib jika `rtk init` dijalankan oleh Claude, karena tanpa itu hook tidak ditulis.
   ```bash
   rtk init -g --auto-patch
   rtk gain --reset --yes
   ```
2. Lean CLAUDE.md dan subagent. Boleh dikerjakan Claude di session terpisah:
   ```text
   Buat CLAUDE.md di repo ini lebih ringkas, maksimal 60 baris. Pertahankan hanya yang berlaku di setiap task: command test dan typecheck, struktur folder, dan aturan ledger. Pindahkan prosedur release, prosedur migrasi, format pesan host, checklist review PR, onboarding, dan glosarium ke file terpisah di docs/, lalu tulis satu baris rujukan untuk masing-masing di CLAUDE.md.
   Setelah itu buat subagent .claude/agents/log-analyst.md dengan model haiku dan tools Read, Grep, Bash. Tugasnya mencari event di journal mesin CRM (logs/) dan baris ledger export (data/) dengan grep, tidak membaca file utuh, lalu mengembalikan summary singkat berisi urutan event dan baris yang relevan.
   Jangan ubah src/ dan test/. Jalankan npx vitest run sebagai bukti, lalu commit dengan pesan "chore: lean CLAUDE.md dan subagent log-analyst".
   ```
3. Mulai session baru (`/clear`), catat context awal di panel Context, lalu kirim:
   ```text
   Kerjakan insiden @docs/insiden/INC-2026-1014-01.md.
   1. Pakai subagent log-analyst untuk mencari urutan event STAN 004417 di logs/journal-ATM-0412-20261014.log dan baris ledger dengan ref ATM-0412/004417 di data/ledger-export-20261014.csv. Minta summary saja.
   2. Alur konfirmasi ada di src/deposit.service.ts. Tulis dulu test yang gagal di test/deposit.service.test.ts untuk kasus dari journal, lalu perbaiki code.
   3. Jalankan npx vitest run dan tunjukkan summary hasilnya sebagai bukti.
   Batasan: jangan membaca file log utuh, jangan mengubah ledger.ts.
   ```
4. Isi baris Lab 1 di `docs/catatan-token.md` (context akhir, memory files, `rtk gain`), lalu commit.

Selesai jika test baru gagal sebelum fix lalu semua test pass. Contoh hasil: branch `sesi4-part1-solution`.

### Lab 2: Fitur pending dan reversal dengan Superpowers

Mulai dari `sesi4-superpowers-start`. Pastikan `git config user.name` dan `user.email` sudah diisi di repo sebelum Claude membuat commit.

1. Install Superpowers (mode Manual, baca setiap command sebelum Allow):
   ```text
   Install plugin Superpowers (https://github.com/obra/superpowers) untuk Claude Code di scope user. Pakai CLI claude plugin: tambahkan marketplace obra/superpowers-marketplace, lalu install superpowers dari marketplace itu. Setelah itu tunjukkan hasil claude plugin details superpowers@superpowers-marketplace sebagai bukti: versi, jumlah skill, dan token always-on. Jangan ubah file di repo.
   ```
2. Mulai session baru, pindah ke mode Accept edits, lalu kirim:
   ```text
   Kita mau menambah fitur di setor-tunai-lab: setoran yang host-nya timeout atau uangnya ditolak mesin harus masuk status PENDING, lalu bisa dibatalkan lewat reversal supaya ledger tetap benar. Brainstorming dulu sebelum menulis code.
   ```
   Jawab pertanyaan Claude satu per satu, lalu baca design doc di `docs/superpowers/specs/`, terutama bagian keputusan yang dibuat Claude.
3. Approve design, lalu baca plan:
   ```text
   Design doc sudah saya baca dan sesuai. Commit doc-nya, lalu susun plan.
   ```
4. Approve plan, lalu execution dengan subagent (sekitar 10-15 menit):
   ```text
   Plan sudah saya baca dan setuju. Commit plan-nya, lalu execution dengan subagent-driven di branch feature/pending-reversal, tanpa worktree. Berhenti setelah semua task selesai, jangan merge.
   ```
5. Verify, review, dan finishing:
   ```text
   Verifikasi dengan npm run typecheck dan npx vitest run, tunjukkan ringkasan output-nya, dan cek test lama tidak berubah (git diff sesi4-superpowers-start -- test). Minta code review untuk feature/pending-reversal terhadap sesi4-superpowers-start, tindak lanjuti temuan penting. Finishing: pilih push dan buat Pull Request. Jangan merge.
   ```

Selesai jika setiap task punya commit sendiri, test lama tidak berubah, semua test pass, dan PR dengan CI pass belum di-merge. Contoh hasil: branch `feature/pending-reversal` dan PR #1.
