import type { Db } from "./db.js";

// Rekening kas mesin: setiap setoran = debit kas mesin, kredit rekening nasabah.
export const CASH_IN_MACHINE = (terminalId: string) => `KAS-${terminalId}`;

export function postDepositEntries(
  db: Db,
  p: { terminalId: string; accountNo: string; amount: number; ref: string; at: string },
): void {
  const insert = db.prepare(
    "INSERT INTO ledger_entries (account_no, direction, amount, ref, created_at) VALUES (?, ?, ?, ?, ?)",
  );
  insert.run(CASH_IN_MACHINE(p.terminalId), "DR", p.amount, p.ref, p.at);
  insert.run(p.accountNo, "CR", p.amount, p.ref, p.at);
}

export function balance(db: Db, accountNo: string): number {
  const row = db
    .prepare(
      "SELECT COALESCE(SUM(CASE direction WHEN 'CR' THEN amount ELSE -amount END), 0) AS bal FROM ledger_entries WHERE account_no = ?",
    )
    .get(accountNo) as { bal: number };
  return Number(row.bal);
}

export function entriesFor(db: Db, accountNo: string) {
  return db
    .prepare("SELECT direction, amount, ref, created_at FROM ledger_entries WHERE account_no = ? ORDER BY id")
    .all(accountNo) as { direction: string; amount: number; ref: string; created_at: string }[];
}

export function hasEntries(db: Db, ref: string): boolean {
  return db.prepare("SELECT 1 AS x FROM ledger_entries WHERE ref = ? LIMIT 1").get(ref) !== undefined;
}

// Baca saja, tanpa insert: semua entri dengan ref ini, urut id.
export function entriesByRef(db: Db, ref: string) {
  return db
    .prepare("SELECT account_no, direction, amount FROM ledger_entries WHERE ref = ? ORDER BY id")
    .all(ref) as { account_no: string; direction: string; amount: number }[];
}

// Koreksi lewat entri baru: kebalikan entri asli dengan ref `${ref}/REV`.
// Tidak membuka transaksi; pemanggil yang membungkusnya. Hanya INSERT.
export function postReversalEntries(db: Db, ref: string, at: string): boolean {
  const revRef = `${ref}/REV`;
  if (hasEntries(db, revRef)) return false;
  const originals = entriesByRef(db, ref);
  if (originals.length === 0) return false;
  const insert = db.prepare(
    "INSERT INTO ledger_entries (account_no, direction, amount, ref, created_at) VALUES (?, ?, ?, ?, ?)",
  );
  for (const o of originals) {
    insert.run(o.account_no, o.direction === "DR" ? "CR" : "DR", o.amount, revRef, at);
  }
  return true;
}
