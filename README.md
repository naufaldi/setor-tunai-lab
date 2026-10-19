# setor-tunai-lab

API setoran tunai lewat mesin CRM (cash recycling ATM). Repo latihan untuk training Hacktiv8 × Hitachi, "Advanced Claude Code for Agentic Software Engineering", Sesi 4.

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
