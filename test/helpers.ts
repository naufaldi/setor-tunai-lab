import { openDb } from "../src/db.js";
import { createDepositService } from "../src/deposit.service.js";

export const ACC_A = "0123457781";
export const ACC_B = "0123450219";

export function setup() {
  const db = openDb(":memory:");
  db.prepare("INSERT INTO accounts (account_no, name) VALUES (?, ?), (?, ?)").run(ACC_A, "Nasabah A", ACC_B, "Nasabah B");
  let tick = 0;
  const clock = () => new Date(Date.UTC(2026, 9, 14, 2, 12, tick++)).toISOString();
  const svc = createDepositService(db, clock);
  return { db, svc };
}

export function countedDeposit(svc: ReturnType<typeof setup>["svc"], qty100 = 25, terminalId = "ATM-0412", accountNo = ACC_A) {
  const dep = svc.start({ terminalId, accountNo });
  return svc.recordCount(dep.id, { notes: [{ denom: 100_000, qty: qty100 }] });
}
