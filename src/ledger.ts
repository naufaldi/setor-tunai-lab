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
