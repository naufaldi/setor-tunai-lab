import { openDb } from "../src/db.js";
import { createDepositService } from "../src/deposit.service.js";

export const ACC_A = "0123457781";
export const ACC_B = "0123450219";

export function setup() {
  const db = openDb(":memory:");
  db.prepare("INSERT INTO accounts (account_no, name) VALUES (?, ?), (?, ?)").run(ACC_A, "Nasabah A", ACC_B, "Nasabah B");
  let tick = 0;
  let fixed: string | null = null;
  const clock = () => fixed ?? new Date(Date.UTC(2026, 9, 14, 2, 12, tick++)).toISOString();
  const svc = createDepositService(db, clock);
  // Bekukan clock di waktu tertentu (ISO UTC); null mengembalikan auto-tick.
  const setNow = (iso: string | null) => {
    fixed = iso;
  };
  return { db, svc, setNow };
}

let seq = 0;

// Setoran sampai POSTED lewat alur biasa, dengan STAN dan requestId unik. amount kelipatan 100.000.
export function postedDeposit(
  svc: ReturnType<typeof setup>["svc"],
  opts: { amount: number; accountNo?: string; terminalId?: string },
) {
  seq++;
  const dep = svc.start({ terminalId: opts.terminalId ?? "ATM-0412", accountNo: opts.accountNo ?? ACC_A });
  svc.recordCount(dep.id, { notes: [{ denom: 100_000, qty: opts.amount / 100_000 }] });
  return svc.confirm(dep.id, { requestId: `REQ-H-${seq}`, stan: String(100000 + seq) });
}

export function countedDeposit(svc: ReturnType<typeof setup>["svc"], qty100 = 25, terminalId = "ATM-0412", accountNo = ACC_A) {
  const dep = svc.start({ terminalId, accountNo });
  return svc.recordCount(dep.id, { notes: [{ denom: 100_000, qty: qty100 }] });
}
