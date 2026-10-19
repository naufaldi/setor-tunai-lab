# Status PENDING dan Reversal Setoran Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Setoran COUNTED yang host-nya timeout atau uangnya ditolak mesin bisa masuk PENDING, lalu ditutup lewat resolve (POSTED) atau reverse (REVERSED) dengan ledger tetap append-only.

**Architecture:** Tiga aksi baru di `createDepositService` (`markPending`, `resolve`, `reverse`), masing-masing berjalan dalam satu transaksi SQLite dan menulis satu baris ke tabel audit `deposit_events`. Ledger mendapat dua helper insert-only (`hasEntries`, `postReversalEntries`). `server.ts` mendapat tiga route baru dengan pola `parts[2]` yang ada.

**Tech Stack:** TypeScript strict, node:http, node:sqlite (in-memory di test), Vitest.

**Spec:** `docs/superpowers/specs/2026-10-19-pending-reversal-design.md`

## Global Constraints

- TypeScript strict. Jangan pakai `any` kecuali di batas HTTP.
- Nominal uang selalu integer rupiah. Jangan pakai float.
- Ledger tidak boleh di-update atau di-delete. Koreksi hanya lewat entri baru.
- Test lama tidak diubah. Semua test baru ada di file baru: `test/pending.domain.test.ts`, `test/ledger.reversal.test.ts`, `test/deposit.pending.test.ts`, `test/api.pending.test.ts`. `test/helpers.ts` dipakai apa adanya.
- PENDING hanya boleh dari COUNTED. Transisi tidak valid melempar `DepositError("INVALID_STATE", ...)`, yang sudah dipetakan `server.ts` ke HTTP 409.
- Ref reversal = ref asli + `/REV` (contoh `ATM-0412/004417/REV`). Entri pembalik: DR rekening nasabah, CR kas mesin (`KAS-${terminalId}`).
- Validasi input (400) dijalankan sebelum pemeriksaan state (409), seperti `confirm`.
- Pengulangan aksi yang sama mengembalikan 200 tanpa efek samping: pending pada PENDING, resolve pada POSTED dengan STAN sama, reverse pada REVERSED.
- Jangan log nomor rekening lengkap (`****1234`). Fitur ini tidak menambah log.
- Skema ada inline di `openDb` (`src/db.ts`) dengan `CREATE TABLE IF NOT EXISTS`. Repo tidak punya folder `migrations/`, jadi tabel baru mengikuti pola inline itu.
- `confirm`, `recordCount`, `start` tidak diubah. `cancel` hanya mendapat penolakan untuk PENDING dan REVERSED.
- Commit: pesan diakhiri `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Git identity memakai config repo (`git commit` biasa).

## Review Focus

Spec diam soal input berikut. Masing-masing punya test di task pemiliknya.

1. Id setoran yang tidak ada pada ketiga endpoint harus 404, bukan 500 (Task 6).
2. `actor` atau `reason` berisi spasi saja harus 400, sama dengan kosong (Task 1).
3. Body kosong atau field bertipe bukan string (`actor: 7`, `stan: 123456` sebagai number) harus 400, bukan 500 atau tersimpan sebagai number (Task 1, Task 4, Task 6).
4. `reason` lebih dari 200 karakter harus 400 (Task 1).
5. Request yang gagal (validasi, state, atau error di tengah) tidak meninggalkan baris `deposit_events`, entri ledger, atau perubahan status (Task 3, Task 4, Task 5).

## File Structure

| File | Tanggung jawab |
| --- | --- |
| `src/domain/deposit.ts` (ubah) | `DepositStatus` + `PENDING`, `REVERSED`; `REASON_MAX_LENGTH`; `validateActor`, `validateReason` |
| `src/db.ts` (ubah) | tabel `deposit_events` |
| `src/ledger.ts` (ubah) | `hasEntries`, `postReversalEntries` |
| `src/deposit.service.ts` (ubah) | `markPending`, `resolve`, `reverse`, guard `cancel`, helper privat transaksi, STAN dikenal, event |
| `src/server.ts` (ubah) | route `pending`, `resolve`, `reverse` |
| `README.md` (ubah) | daftar endpoint |
| `test/*.pending*.ts`, `test/pending.domain.test.ts`, `test/ledger.reversal.test.ts` (baru) | test fitur |

---

### Task 1: Status, validator, dan tabel audit

**Files:**
- Modify: `src/domain/deposit.ts`, `src/db.ts`
- Test: `test/pending.domain.test.ts` (baru)

**Interfaces:**
- Produces:
  - `DepositStatus = "OPEN" | "COUNTED" | "PENDING" | "POSTED" | "REVERSED" | "CANCELLED"`
  - `export const REASON_MAX_LENGTH = 200`
  - `validateActor(actor: unknown): asserts actor is string` melempar `DepositError("INVALID_ACTOR", ...)`
  - `validateReason(reason: unknown): asserts reason is string` melempar `DepositError("INVALID_REASON", ...)`
  - tabel `deposit_events (id INTEGER PRIMARY KEY AUTOINCREMENT, deposit_id TEXT NOT NULL REFERENCES deposits(id), action TEXT NOT NULL, actor TEXT NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL)`. Nilai `action`: `PENDING`, `RESOLVED`, `REVERSED`.

- [ ] **Step 1: Write the failing tests** in `test/pending.domain.test.ts`:
  - `validateActor("")`, `validateActor("   ")`, `validateActor(7)`, `validateActor(undefined)` melempar error dengan `code === "INVALID_ACTOR"`; `validateActor("operator-01")` tidak melempar.
  - `validateReason` sama untuk `INVALID_REASON`; `"x".repeat(200)` lolos, `"x".repeat(201)` melempar.
  - `openDb(":memory:")` membuat tabel `deposit_events` (cek lewat `sqlite_master`), dan memanggil `openDb` dua kali pada file yang sama tidak error (IF NOT EXISTS).
- [ ] **Step 2: Run** `npx vitest run test/pending.domain.test.ts`. Expected: FAIL (fungsi belum ada).
- [ ] **Step 3: Implement** validator di `src/domain/deposit.ts` (trim sebelum cek kosong), perluasan `DepositStatus`, dan tabel di `openDb`.
- [ ] **Step 4: Run** `npx vitest run test/pending.domain.test.ts && npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(deposit): status PENDING/REVERSED, validator actor dan reason, tabel deposit_events`.

### Task 2: Helper ledger untuk reversal

**Files:**
- Modify: `src/ledger.ts`
- Test: `test/ledger.reversal.test.ts` (baru)

**Interfaces:**
- Produces:
  - `hasEntries(db: Db, ref: string): boolean`
  - `postReversalEntries(db: Db, ref: string, at: string): boolean` membaca entri dengan `ref` itu, menyisipkan kebalikannya (DR jadi CR dan sebaliknya, akun dan nominal sama) dengan ref `${ref}/REV`. Mengembalikan `false` tanpa menulis apa pun jika tidak ada entri asli atau `${ref}/REV` sudah ada. Tidak membuka transaksi.

- [ ] **Step 1: Write the failing tests** (pakai `setup()` dan `postDepositEntries` dengan ref `ATM-0412/004417`, jumlah 2_500_000):
  - `hasEntries` false sebelum posting, true sesudahnya.
  - `postReversalEntries(db, ref, "t")` mengembalikan `true`; `balance(db, ACC_A)` dan `balance(db, CASH_IN_MACHINE("ATM-0412"))` keduanya 0; `entriesFor(db, ACC_A)` berisi 2 entri: CR lalu DR dengan ref `ATM-0412/004417/REV`; jumlah baris `ledger_entries` 4 (entri asli tidak berubah).
  - Pemanggilan kedua mengembalikan `false` dan jumlah baris tetap 4.
  - Ref tanpa entri asli mengembalikan `false` dan tidak menulis.
- [ ] **Step 2: Run** `npx vitest run test/ledger.reversal.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** kedua fungsi di `src/ledger.ts`, insert saja (tanpa UPDATE/DELETE).
- [ ] **Step 4: Run** `npx vitest run test/ledger.reversal.test.ts test/ledger.test.ts && npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(ledger): helper hasEntries dan postReversalEntries`.

### Task 3: markPending dan guard cancel

**Files:**
- Modify: `src/deposit.service.ts`
- Test: `test/deposit.pending.test.ts` (baru)

**Interfaces:**
- Consumes: `validateActor`, `validateReason`, `DepositStatus` (Task 1).
- Produces, di service:
  - `markPending(id: string, input: { actor: string; reason: string }): Deposit`
  - privat `inTransaction<T>(fn: () => T): T` (`BEGIN IMMEDIATE`, `COMMIT`, `ROLLBACK` saat error, lalu lempar ulang) dan privat `recordEvent(depositId: string, action: "PENDING" | "RESOLVED" | "REVERSED", input: { actor: string; reason: string }, at: string): void`. Task 4 dan 5 memakai keduanya.

- [ ] **Step 1: Write the failing tests** (`describe("markPending")`, memakai `setup()` dan `countedDeposit`):
  - COUNTED menjadi PENDING; `deposit_events` berisi satu baris `{ action: "PENDING", actor, reason, created_at }` dengan `created_at` dari clock test; `balance(db, ACC_A)` tetap 0.
  - Dipanggil lagi pada PENDING mengembalikan status PENDING dan baris event tetap 1.
  - OPEN, POSTED (setelah `confirm`), dan CANCELLED melempar `INVALID_STATE`.
  - `actor: ""` pada setoran OPEN melempar `INVALID_ACTOR` (validasi lebih dulu dari state); `reason` kosong melempar `INVALID_REASON`; dalam kedua kasus tidak ada baris event.
  - Id tidak ada melempar `NOT_FOUND`.
  - Pada setoran PENDING: `cancel` melempar `INVALID_STATE`, `confirm` melempar `INVALID_STATE`, `recordCount` melempar `INVALID_STATE`.
- [ ] **Step 2: Run** `npx vitest run test/deposit.pending.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `markPending`, helper privat, dan di `cancel()` penolakan `INVALID_STATE` untuk PENDING dan REVERSED (perilaku OPEN dan COUNTED tidak berubah). Tambahkan ke objek yang dikembalikan `createDepositService`.
- [ ] **Step 4: Run** `npx vitest run && npm run typecheck`. Expected: semua PASS, termasuk test lama.
- [ ] **Step 5: Commit** `feat(deposit): markPending dan guard cancel untuk PENDING`.

### Task 4: resolve

**Files:**
- Modify: `src/deposit.service.ts`
- Test: `test/deposit.pending.test.ts`

**Interfaces:**
- Consumes: `inTransaction`, `recordEvent` (Task 3); `hasEntries`, `postDepositEntries` (Task 2 dan ledger).
- Produces: `resolve(id: string, input: { actor: string; reason: string; stan: string }): Deposit` dan privat `knownStans(depositId: string): string[]` (semua `stan` di `host_requests` untuk deposit itu ditambah `deposits.stan`, tanpa duplikat; Task 5 memakainya).

Aturan (dari spec): validasi `actor`, `reason`, lalu `stan` (harus string dan lolos `validateStan`) sebelum state. Jika POSTED dengan `stan` sama, kembalikan setoran tanpa efek. Selain itu harus PENDING. Jika ada STAN dikenal dan `stan` tidak termasuk di dalamnya, `INVALID_STATE`. Jika ada entri ledger untuk salah satu STAN dikenal, tidak memposting lagi. Selain itu posting ref `${terminalId}/${stan}` dengan `deposits.amount`. Terakhir set `status = 'POSTED'`, `stan`, dan tulis event `RESOLVED`, semuanya dalam satu transaksi.

- [ ] **Step 1: Write the failing tests** (`describe("resolve")`):
  - PENDING tanpa STAN dikenal, `resolve(..., { stan: "004417" })`: status POSTED, `stan` "004417", `balance(db, ACC_A)` 2_500_000, `balance(db, CASH_IN_MACHINE("ATM-0412"))` -2_500_000, satu event `RESOLVED`.
  - Simulasi `confirm` yang mati di tengah: sisipkan baris `host_requests` untuk setoran dengan STAN "004417" dan panggil `postDepositEntries` dengan ref `ATM-0412/004417`, lalu `markPending`, lalu `resolve` dengan STAN yang sama: status POSTED dan saldo tetap 2_500_000 (tidak kredit ganda).
  - STAN dikenal "004417", `resolve` dengan "004418": melempar `INVALID_STATE`, status tetap PENDING, saldo tidak berubah.
  - `resolve` kedua pada POSTED dengan STAN sama mengembalikan POSTED, saldo dan jumlah event tidak berubah; STAN berbeda melempar `INVALID_STATE`.
  - COUNTED, OPEN, dan REVERSED (diset lewat SQL langsung) melempar `INVALID_STATE`.
  - `stan: 123456` (number) dan `stan: "12"` melempar `INVALID_STAN`; tidak ada event.
  - Rollback: pasang `CREATE TRIGGER` yang `RAISE(ABORT, ...)` pada `BEFORE INSERT ON deposit_events`, lalu `resolve` melempar; status tetap PENDING dan `ledger_entries` kosong.
- [ ] **Step 2: Run** `npx vitest run test/deposit.pending.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `resolve` dan `knownStans`; tambahkan `resolve` ke objek service.
- [ ] **Step 4: Run** `npx vitest run && npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(deposit): resolve setoran PENDING menjadi POSTED`.

### Task 5: reverse

**Files:**
- Modify: `src/deposit.service.ts`
- Test: `test/deposit.pending.test.ts`

**Interfaces:**
- Consumes: `inTransaction`, `recordEvent`, `knownStans` (Task 3, 4); `postReversalEntries` (Task 2).
- Produces: `reverse(id: string, input: { actor: string; reason: string }): Deposit`.

Aturan: validasi `actor`, `reason`, lalu state. REVERSED dikembalikan tanpa efek. Selain itu harus PENDING. Untuk setiap STAN dikenal panggil `postReversalEntries(db, `${terminalId}/${stan}`, at)`. Set `status = 'REVERSED'` dan tulis event `REVERSED`, dalam satu transaksi.

- [ ] **Step 1: Write the failing tests** (`describe("reverse")`):
  - PENDING tanpa ledger: status REVERSED, `ledger_entries` kosong, satu event `REVERSED`.
  - Ledger terkredit (simulasi `confirm` mati di tengah seperti Task 4, lalu `markPending`): setelah `reverse`, saldo ACC_A dan kas mesin 0; ada entri ref `ATM-0412/004417/REV` dengan DR pada ACC_A dan CR pada kas; dua entri asli masih ada (4 baris).
  - Dua STAN dikenal dan keduanya terkredit: kedua ref dibalik, saldo 0.
  - Reversal parsial sebelumnya (sudah ada `…/REV` untuk satu ref, status masih PENDING): `reverse` menyelesaikan tanpa membalik dua kali; saldo 0.
  - `reverse` kedua pada REVERSED mengembalikan REVERSED; jumlah baris ledger dan event tidak berubah.
  - COUNTED, OPEN, dan POSTED melempar `INVALID_STATE`; `markPending` dan `resolve` pada REVERSED melempar `INVALID_STATE`.
  - Rollback: trigger `RAISE(ABORT)` pada `deposit_events` membuat `reverse` melempar, status tetap PENDING, dan tidak ada entri `/REV`.
- [ ] **Step 2: Run** `npx vitest run test/deposit.pending.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `reverse`; tambahkan ke objek service.
- [ ] **Step 4: Run** `npx vitest run && npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(deposit): reverse setoran PENDING menjadi REVERSED dengan entri pembalik`.

### Task 6: Route HTTP dan README

**Files:**
- Modify: `src/server.ts`, `README.md` (tambah tiga baris endpoint setelah baris `confirm`, format sama dengan yang ada)
- Test: `test/api.pending.test.ts` (baru; struktur `beforeEach`/`post` meniru `test/api.test.ts`)

**Interfaces:**
- Consumes: `markPending`, `resolve`, `reverse` (Task 3 sampai 5).
- Produces: `POST /deposits/:id/pending` `{ actor, reason }`, `POST /deposits/:id/resolve` `{ actor, reason, stan }`, `POST /deposits/:id/reverse` `{ actor, reason }`. Semuanya 200 dengan body setoran.

- [ ] **Step 1: Write the failing tests** (ACC_A, ATM-0412, 25 lembar 100.000):
  - Alur `count` → `pending` → `resolve` ("004417"): 200 di tiap langkah, status akhir POSTED, `GET /accounts/:acc/balance` 2_500_000.
  - Alur `count` → `pending` → `reverse`: status REVERSED, saldo 0; `reverse` kedua 200.
  - `pending` pada setoran OPEN: 409 dengan `error: "INVALID_STATE"`; `reverse` pada COUNTED: 409; `cancel` pada PENDING: 409.
  - Body `{}` pada `pending`: 400 `INVALID_ACTOR`; `{ actor: "op", reason: "x", stan: 123456 }` pada `resolve`: 400 `INVALID_STAN`.
  - Id `S-xxxx` pada ketiga endpoint: 404.
- [ ] **Step 2: Run** `npx vitest run test/api.pending.test.ts`. Expected: FAIL (404 dari route yang belum ada).
- [ ] **Step 3: Implement** tiga route di blok `parts[0] === "deposits"` mengikuti pola `confirm`, dan perbarui README.
- [ ] **Step 4: Verify** semuanya:
  - `npx vitest run` dan `npm run typecheck`: PASS.
  - `git diff --name-status 0023d27 -- test/`: hanya baris `A`, tidak ada `M` atau `D` (test lama tidak berubah).
  - `git diff 0023d27 -- src/ledger.ts | grep -E '^[-+].*(UPDATE|DELETE)'`: tidak ada keluaran.
- [ ] **Step 5: Commit** `feat(api): endpoint pending, resolve, reverse`.

---

## Self-Review

- **Spec coverage:** status dan transisi (Task 1, 3, 4, 5); resolve idempotent per STAN dan aturan STAN dikenal (Task 4); reverse dengan atau tanpa ledger, `/REV`, banyak ref, reversal parsial (Task 2, 5); `deposit_events` dengan actor, reason, waktu (Task 1, 3, 4, 5); 409 `INVALID_STATE` dan 400 validasi lebih dulu (semua task, Task 6); cancel menolak PENDING dan REVERSED (Task 3); transaksi tanpa `BEGIN` bersarang (helper ledger insert-only, Task 2 dan 3); pengulangan 200 (Task 3, 4, 5); test lama tidak berubah dan kriteria selesai (Task 6, Step 4). Batasan di spec (POSTED tanpa approve host, actor klaim, tanpa list endpoint) sengaja tidak dikerjakan.
- **Konsistensi nama:** `inTransaction`, `recordEvent`, `knownStans`, `hasEntries`, `postReversalEntries`, `REASON_MAX_LENGTH` dipakai sama di semua task.
- **Proporsi:** plan memuat signature, aturan, dan assertion, bukan body fungsi.
