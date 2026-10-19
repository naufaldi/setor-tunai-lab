import { describe, expect, it } from "vitest";
import { balance, CASH_IN_MACHINE, entriesFor, hasEntries, postDepositEntries, postReversalEntries } from "../src/ledger.js";
import { ACC_A, setup } from "./helpers.js";

const REF = "ATM-0412/004417";
const post = (db: ReturnType<typeof setup>["db"]) =>
  postDepositEntries(db, { terminalId: "ATM-0412", accountNo: ACC_A, amount: 2_500_000, ref: REF, at: "t" });
const rowCount = (db: ReturnType<typeof setup>["db"]) =>
  Number((db.prepare("SELECT COUNT(*) AS n FROM ledger_entries").get() as { n: number }).n);

describe("ledger reversal", () => {
  it("hasEntries false sebelum posting, true sesudahnya", () => {
    const { db } = setup();
    expect(hasEntries(db, REF)).toBe(false);
    post(db);
    expect(hasEntries(db, REF)).toBe(true);
  });

  it("postReversalEntries membalik entri asli dengan ref /REV", () => {
    const { db } = setup();
    post(db);
    expect(postReversalEntries(db, REF, "t")).toBe(true);
    expect(balance(db, ACC_A)).toBe(0);
    expect(balance(db, CASH_IN_MACHINE("ATM-0412"))).toBe(0);
    const entries = entriesFor(db, ACC_A);
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.direction)).toEqual(["CR", "DR"]);
    expect(entries[1].ref).toBe("ATM-0412/004417/REV");
    expect(rowCount(db)).toBe(4);
  });

  it("pemanggilan kedua mengembalikan false tanpa menulis", () => {
    const { db } = setup();
    post(db);
    postReversalEntries(db, REF, "t");
    expect(postReversalEntries(db, REF, "t")).toBe(false);
    expect(rowCount(db)).toBe(4);
  });

  it("ref tanpa entri asli mengembalikan false tanpa menulis", () => {
    const { db } = setup();
    expect(postReversalEntries(db, "tidak-ada", "t")).toBe(false);
    expect(rowCount(db)).toBe(0);
  });
});
