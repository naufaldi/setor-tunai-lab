# CLAUDE.md: setor-tunai-api

API setoran tunai lewat mesin CRM (cash recycling). Ilustrasi untuk training Hacktiv8. Semua data dummy.

## Perintah

- Install: `npm install`
- Test: `npx vitest run` (sama dengan `npm test`; bentuk ini diringkas oleh hook RTK)
- Type check: `npm run typecheck`
- Jalankan lokal: `npm run seed && npm start` (port 8787)

## Struktur

- `src/domain/`: aturan bisnis (nominal, validasi, hitung jumlah)
- `src/deposit.service.ts`: alur setoran (start, count, confirm, cancel)
- `src/ledger.ts`: entri ledger (debit kas mesin, kredit rekening)
- `src/journal/`: parser dan rekap journal mesin CRM
- `src/server.ts`: HTTP API (node:http)
- `test/`: Vitest, database node:sqlite in-memory

## Aturan code

- TypeScript strict. Jangan pakai `any` kecuali di batas HTTP.
- Nominal uang selalu integer rupiah. Jangan pakai float.
- Ledger tidak boleh di-update atau di-delete. Koreksi selalu lewat entri baru.
- Setiap perubahan aturan bisnis wajib ada test di `test/`.
- Jangan log nomor rekening lengkap. Pakai format `****1234`.

## Dokumen lain (baca hanya jika tugasnya terkait)

- Release: `docs/prosedur-release.md`
- Migrasi database: `docs/prosedur-migrasi.md`
- Format pesan host dan response code: `docs/format-pesan-host.md`
- Checklist review PR: `docs/checklist-review.md`
- Onboarding dan glosarium: `docs/onboarding.md`, `docs/glosarium.md`

## Log dan data besar

- Journal mesin di `logs/` berukuran ratusan KB. Jangan dibaca utuh.
- Untuk analisis journal, pakai subagent `log-analyst` atau `grep` dengan pola yang spesifik (STAN, req, terminal).
