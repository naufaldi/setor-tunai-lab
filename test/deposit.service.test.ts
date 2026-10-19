import { describe, expect, it } from "vitest";
import { balance } from "../src/ledger.js";
import { ACC_A, ACC_B, countedDeposit, setup } from "./helpers.js";

describe("start", () => {
  it("membuat setoran OPEN", () => {
    const { svc } = setup();
    const dep = svc.start({ terminalId: "ATM-0412", accountNo: ACC_A });
    expect(dep.status).toBe("OPEN");
    expect(dep.id).toMatch(/^S-/);
  });
  it("menolak rekening yang tidak terdaftar", () => {
    const { svc } = setup();
    expect(() => svc.start({ terminalId: "ATM-0412", accountNo: "0000000000" })).toThrow(/tidak terdaftar/);
  });
  it("menolak terminal_id tidak valid", () => {
    const { svc } = setup();
    expect(() => svc.start({ terminalId: "ATM-12", accountNo: ACC_A })).toThrow(/terminal_id/);
  });
});

describe("recordCount", () => {
  it("menyimpan jumlah dan status COUNTED", () => {
    const { svc } = setup();
    const dep = countedDeposit(svc, 25);
    expect(dep.status).toBe("COUNTED");
    expect(dep.amount).toBe(2_500_000);
  });
  it("menyimpan jumlah lembar yang ditolak mesin", () => {
    const { svc } = setup();
    const dep = svc.start({ terminalId: "ATM-0412", accountNo: ACC_A });
    const counted = svc.recordCount(dep.id, { notes: [{ denom: 50_000, qty: 4 }], rejected: 2 });
    expect(counted.rejectedNotes).toBe(2);
    expect(counted.amount).toBe(200_000);
  });
  it("tidak bisa menghitung ulang setoran COUNTED", () => {
    const { svc } = setup();
    const dep = countedDeposit(svc);
    expect(() => svc.recordCount(dep.id, { notes: [{ denom: 50_000, qty: 1 }] })).toThrow(/tidak bisa dihitung ulang/);
  });
});

describe("confirm", () => {
  it("memposting setoran ke ledger", () => {
    const { db, svc } = setup();
    const dep = countedDeposit(svc, 25);
    svc.confirm(dep.id, { requestId: "R-9f3a", stan: "004417" });
    expect(balance(db, ACC_A)).toBe(2_500_000);
  });
  it("request yang sama dikirim ulang tidak memposting dua kali", () => {
    const { db, svc } = setup();
    const dep = countedDeposit(svc, 25);
    svc.confirm(dep.id, { requestId: "R-9f3a", stan: "004417" });
    svc.confirm(dep.id, { requestId: "R-9f3a", stan: "004417" });
    expect(balance(db, ACC_A)).toBe(2_500_000);
  });
  // INC-2026-1014-01: timeout 30 detik, CRM retry dengan requestId baru (R-a7b2),
  // STAN sama (004417). Konfirmasi kedua tidak boleh memposting lagi.
  it("retry dengan requestId baru dan STAN sama tidak memposting dua kali", () => {
    const { db, svc } = setup();
    const dep = countedDeposit(svc, 25);
    svc.confirm(dep.id, { requestId: "R-a8f7", stan: "004417" });
    const again = svc.confirm(dep.id, { requestId: "R-a7b2", stan: "004417" });
    expect(again.status).toBe("POSTED");
    expect(balance(db, ACC_A)).toBe(2_500_000);
  });
  it("setoran yang sudah POSTED berstatus POSTED setelah konfirmasi", () => {
    const { svc } = setup();
    const dep = countedDeposit(svc, 25);
    expect(svc.confirm(dep.id, { requestId: "R-a8f7", stan: "004417" }).status).toBe("POSTED");
  });
  it("menolak konfirmasi setoran yang belum dihitung", () => {
    const { svc } = setup();
    const dep = svc.start({ terminalId: "ATM-0412", accountNo: ACC_A });
    expect(() => svc.confirm(dep.id, { requestId: "R-1", stan: "000001" })).toThrow(/tidak bisa dikonfirmasi/);
  });
  it("menolak STAN tidak valid", () => {
    const { svc } = setup();
    const dep = countedDeposit(svc);
    expect(() => svc.confirm(dep.id, { requestId: "R-1", stan: "12" })).toThrow(/STAN/);
  });
  it("dua setoran berbeda masuk ke rekening masing-masing", () => {
    const { db, svc } = setup();
    const a = countedDeposit(svc, 10, "ATM-0412", ACC_A);
    const b = countedDeposit(svc, 5, "ATM-0219", ACC_B);
    svc.confirm(a.id, { requestId: "R-a", stan: "000010" });
    svc.confirm(b.id, { requestId: "R-b", stan: "000011" });
    expect(balance(db, ACC_A)).toBe(1_000_000);
    expect(balance(db, ACC_B)).toBe(500_000);
  });
});

describe("cancel", () => {
  it("membatalkan setoran OPEN", () => {
    const { svc } = setup();
    const dep = svc.start({ terminalId: "ATM-0412", accountNo: ACC_A });
    expect(svc.cancel(dep.id).status).toBe("CANCELLED");
  });
  it("membatalkan setoran COUNTED", () => {
    const { svc } = setup();
    const dep = countedDeposit(svc);
    expect(svc.cancel(dep.id).status).toBe("CANCELLED");
  });
  it("setoran tidak ditemukan", () => {
    const { svc } = setup();
    expect(() => svc.get("S-xxxx")).toThrow(/tidak ditemukan/);
  });
});
