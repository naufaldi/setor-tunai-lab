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
