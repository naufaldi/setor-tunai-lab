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
| Sesi 4 Part 1, awal | `main` | Kondisi awal: insiden INC-2026-1014-01 belum diperbaiki, CLAUDE.md panjang |
| Sesi 4 Part 1, Lab 1-3 selesai | tag `lab3-selesai` | Perbaikan idempotency + test, CLAUDE.md ramping, subagent log-analyst |
| Sesi 4 Part 1, solusi Lab 1-3 | `sesi4-part1-solution` | Sama dengan `lab3-selesai` |
| Sesi 4 Part 1, awal Lab 4 (Superpowers) | `sesi4-superpowers-start` (= tag `lab4-selesai`) | `lab3-selesai` + workflow CI |
| Lab 5 selesai | tag `lab5-selesai` | Design doc `docs/superpowers/specs/` (brainstorming) |
| Lab 6 selesai | tag `lab6-selesai` | Plan `docs/superpowers/plans/` (writing-plans) |
| Lab 7 selesai | tag `lab7-selesai` | 6 task dikerjakan subagent, test hijau |
| Lab 8 selesai | `feature/pending-reversal` (= tag `lab8-selesai`) | Perbaikan dari code review, PR ke `sesi4-superpowers-start` |
| Sesi 4 Part 2, Lab 9 selesai | tag `lab9-selesai` | Skill `/prepare-release` + draft release v0.2.0 |
| Sesi 4 Part 2, Lab 10 tahap baseline | tag `lab10-baseline` | Catatan baseline di `docs/skills/` |
| Sesi 4 Part 2, Lab 10 selesai | tag `lab10-selesai` | Skill `add-deposit-rule` |
| Sesi 4 Part 2, Lab 11 selesai | tag `lab11-selesai` | Team plugin `deposit-team` + marketplace `hitachi-deposit` |
| Sesi 4 Part 2, awal Lab 12 | `sesi4-part2` (tag `lab12-mulai`) | Plugin v0.2.2 + skill `review-checklist` (context: fork) |
| Sesi 4 Part 2, Lab 12 selesai | `feature/reject-limit` (tag `lab12-selesai`), PR #3 | Aturan maksimal 20 lembar reject, review, PR, draft release v0.3.0 |

Panduan langkah Lab 9-12 dan cara memasang plugin `deposit-team` ada di README branch [`sesi4-part2`](https://github.com/naufaldi/setor-tunai-lab/tree/sesi4-part2#panduan-sesi-4-part-2-reusable-claude-code-skills).
