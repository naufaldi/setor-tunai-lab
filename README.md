# setor-tunai-lab

API setoran tunai lewat mesin CRM (cash recycling ATM). Repo latihan untuk training Hacktiv8 × Hitachi, "Advanced Claude Code for Agentic Software Engineering", Sesi 4.

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
6. `POST /deposits/:id/reverse` `{ actor, reason }` membalik setoran PENDING lewat entri pembalik jika sudah ada entri ledger (status REVERSED).
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
| Sesi 4 Part 2, Lab 12 selesai | tag `lab12-selesai` | Plugin tim `deposit-team` + marketplace `hitachi-deposit` |
| Sesi 4 Part 2, awal Lab 13 | `sesi4-part2` (tag `lab13-mulai`) | Plugin v0.2.0 + skill `review-checklist` (context: fork) |
| Sesi 4 Part 2, Lab 13 selesai | `feature/reject-limit` (tag `lab13-selesai`), PR #3 | Aturan maksimal 20 lembar reject, review, PR, draft release v0.3.0 |

## Plugin tim (Sesi 4 Part 2)

Skill tim ada di `plugins/deposit-team/skills/`. Marketplace-nya di `.claude-plugin/marketplace.json` repo ini, dan `.claude/settings.json` sudah mengaktifkannya untuk project.

```bash
/plugin install deposit-team --marketplace naufaldi/setor-tunai-lab#sesi4-part2
# atau dari terminal
claude plugin marketplace add naufaldi/setor-tunai-lab#sesi4-part2
claude plugin install deposit-team@hitachi-deposit --scope project
```

Di Claude desktop (tab Code, local session): `+` → **Add plugins** → `deposit-team`. Skill dipanggil `/deposit-team:prepare-release 0.2.0` dan `/deposit-team:review-checklist`; `deposit-team:add-deposit-rule` terpicu sendiri saat menambah aturan setoran.
