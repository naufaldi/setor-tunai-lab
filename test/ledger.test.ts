import { describe, expect, it } from "vitest";
import { balance, CASH_IN_MACHINE, entriesFor, postDepositEntries } from "../src/ledger.js";
import { ACC_A, setup } from "./helpers.js";

describe("ledger", () => {
  it("saldo awal 0", () => {
    const { db } = setup();
    expect(balance(db, ACC_A)).toBe(0);
  });

  it("satu setoran = satu kredit nasabah dan satu debit kas mesin", () => {
    const { db } = setup();
    postDepositEntries(db, { terminalId: "ATM-0412", accountNo: ACC_A, amount: 2_500_000, ref: "ATM-0412/004417", at: "t" });
    expect(balance(db, ACC_A)).toBe(2_500_000);
    expect(balance(db, CASH_IN_MACHINE("ATM-0412"))).toBe(-2_500_000);
    expect(entriesFor(db, ACC_A)).toHaveLength(1);
  });

  it("debit dan kredit selalu seimbang", () => {
    const { db } = setup();
    for (let i = 1; i <= 5; i++) {
      postDepositEntries(db, { terminalId: "ATM-0219", accountNo: ACC_A, amount: i * 50_000, ref: `r${i}`, at: "t" });
    }
    expect(balance(db, ACC_A) + balance(db, CASH_IN_MACHINE("ATM-0219"))).toBe(0);
  });

  it("menolak nominal 0 di level database", () => {
    const { db } = setup();
    expect(() => postDepositEntries(db, { terminalId: "ATM-0412", accountNo: ACC_A, amount: 0, ref: "x", at: "t" })).toThrow();
  });
});
