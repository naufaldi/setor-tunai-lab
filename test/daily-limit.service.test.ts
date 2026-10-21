import { describe, expect, it } from "vitest";
import { ACC_A, ACC_B, countedDeposit, postedDeposit, setup } from "./helpers.js";

function thrown(fn: () => unknown): { code?: string; message?: string } | undefined {
  try {
    fn();
  } catch (e) {
    return e as { code?: string; message?: string };
  }
  return undefined;
}

const ledgerCount = (db: ReturnType<typeof setup>["db"]) =>
  Number((db.prepare("SELECT COUNT(*) AS n FROM ledger_entries").get() as { n: number }).n);

function fill(svc: ReturnType<typeof setup>["svc"], total: number, opts: { accountNo?: string; terminalId?: string } = {}) {
  const ids: string[] = [];
  for (let left = total; left > 0; left -= 20_000_000) {
    ids.push(postedDeposit(svc, { amount: Math.min(left, 20_000_000), ...opts }).id);
  }
  return ids;
}

describe("batas setoran harian: service", () => {
  it("AC1 setoran di bawah batas lolos", () => {
    const { svc } = setup();
    expect(postedDeposit(svc, { amount: 20_000_000 }).status).toBe("POSTED");
  });

  it("AC2 total tepat Rp 50.000.000 lolos", () => {
    const { svc } = setup();
    fill(svc, 40_000_000);
    const dep = countedDeposit(svc, 100);
    expect(svc.confirm(dep.id, { requestId: "R-X", stan: "200001" }).status).toBe("POSTED");
  });

  it("AC3 recordCount melewati batas ditolak, setoran tetap OPEN, ledger tidak bertambah", () => {
    const { db, svc } = setup();
    fill(svc, 40_000_000);
    const before = ledgerCount(db);
    const dep = svc.start({ terminalId: "ATM-0412", accountNo: ACC_A });
    const e = thrown(() => svc.recordCount(dep.id, { notes: [{ denom: 100_000, qty: 101 }] }));
    expect(e?.code).toBe("DAILY_LIMIT_EXCEEDED");
    expect(e?.message).toContain("sisa kuota hari ini Rp 10.000.000");
    const after = svc.get(dep.id);
    expect(after.status).toBe("OPEN");
    expect(after.amount).toBe(0);
    expect(ledgerCount(db)).toBe(before);
  });

  it("AC4 setoran 15 jt saat sisa 10 jt ditolak penuh", () => {
    const { svc } = setup();
    fill(svc, 40_000_000);
    const dep = svc.start({ terminalId: "ATM-0412", accountNo: ACC_A });
    const e = thrown(() => svc.recordCount(dep.id, { notes: [{ denom: 100_000, qty: 150 }] }));
    expect(e?.code).toBe("DAILY_LIMIT_EXCEEDED");
    expect(svc.get(dep.id).status).toBe("OPEN");
  });

  it("AC5 kuota habis: pesan sisa Rp 0", () => {
    const { svc } = setup();
    fill(svc, 50_000_000);
    const dep = svc.start({ terminalId: "ATM-0412", accountNo: ACC_A });
    const e = thrown(() => svc.recordCount(dep.id, { notes: [{ denom: 50_000, qty: 1 }] }));
    expect(e?.code).toBe("DAILY_LIMIT_EXCEEDED");
    expect(e?.message).toContain("sisa kuota hari ini Rp 0");
  });

  it("AC6 setoran PENDING ikut dihitung", () => {
    const { svc } = setup();
    fill(svc, 30_000_000);
    const p = countedDeposit(svc, 200);
    svc.markPending(p.id, { actor: "spv.rina", reason: "host timeout, menunggu rekonsiliasi" });
    const dep = svc.start({ terminalId: "ATM-0412", accountNo: ACC_A });
    const e = thrown(() => svc.recordCount(dep.id, { notes: [{ denom: 100_000, qty: 1 }] }));
    expect(e?.code).toBe("DAILY_LIMIT_EXCEEDED");
  });

  it("AC7 REVERSED mengembalikan kuota", () => {
    const { svc } = setup();
    fill(svc, 30_000_000);
    const p = countedDeposit(svc, 200);
    svc.markPending(p.id, { actor: "spv.rina", reason: "host timeout, menunggu rekonsiliasi" });
    svc.reverse(p.id, { actor: "spv.rina", reason: "host gagal, dibalik" });
    expect(countedDeposit(svc, 200).status).toBe("COUNTED");
  });

  it("AC8 CANCELLED dan OPEN/COUNTED tidak dihitung", () => {
    const { svc } = setup();
    const c = countedDeposit(svc, 200);
    svc.cancel(c.id);
    countedDeposit(svc, 200);
    fill(svc, 40_000_000);
    expect(countedDeposit(svc, 100).status).toBe("COUNTED");
  });

  it("AC9 tiga COUNTED 20 jt: confirm ketiga ditolak, tanpa ledger dan tanpa host_requests", () => {
    const { db, svc } = setup();
    const [a, b, c] = [countedDeposit(svc, 200), countedDeposit(svc, 200), countedDeposit(svc, 200)];
    expect(svc.confirm(a.id, { requestId: "R-1", stan: "300001" }).status).toBe("POSTED");
    expect(svc.confirm(b.id, { requestId: "R-2", stan: "300002" }).status).toBe("POSTED");
    const before = ledgerCount(db);
    const e = thrown(() => svc.confirm(c.id, { requestId: "R-3", stan: "300003" }));
    expect(e?.code).toBe("DAILY_LIMIT_EXCEEDED");
    expect(svc.get(c.id).status).toBe("COUNTED");
    expect(ledgerCount(db)).toBe(before);
    expect(db.prepare("SELECT 1 FROM host_requests WHERE request_id = 'R-3'").get()).toBeUndefined();
    // retry requestId sama tetap dievaluasi ulang, bukan dianggap sudah diproses
    expect(thrown(() => svc.confirm(c.id, { requestId: "R-3", stan: "300003" }))?.code).toBe("DAILY_LIMIT_EXCEEDED");
  });

  it("AC10 retry confirm idempoten pada setoran yang sudah POSTED, walau kuota penuh", () => {
    const { db, svc } = setup();
    const [a, b, c] = [countedDeposit(svc, 200), countedDeposit(svc, 200), countedDeposit(svc, 100)];
    svc.confirm(a.id, { requestId: "R-1", stan: "300001" });
    svc.confirm(b.id, { requestId: "R-2", stan: "300002" });
    svc.confirm(c.id, { requestId: "R-3", stan: "300003" });
    const before = ledgerCount(db);
    expect(svc.confirm(c.id, { requestId: "R-3", stan: "300003" }).status).toBe("POSTED");
    expect(svc.confirm(c.id, { requestId: "R-3b", stan: "300003" }).status).toBe("POSTED");
    expect(ledgerCount(db)).toBe(before);
  });

  it("AC11 batas hari WIB: 00:00 WIB mereset kuota, 23:30 WIB masih hari yang sama", () => {
    const { svc, setNow } = setup();
    setNow("2026-10-20T16:30:00.000Z"); // 23:30 WIB 20 Okt
    fill(svc, 50_000_000);
    setNow("2026-10-20T17:00:00.000Z"); // 00:00 WIB 21 Okt
    expect(countedDeposit(svc, 200).status).toBe("COUNTED");
    setNow("2026-10-20T16:45:00.000Z"); // 23:45 WIB 20 Okt, hari yang sama dengan setoran awal
    const dep = svc.start({ terminalId: "ATM-0412", accountNo: ACC_A });
    expect(thrown(() => svc.recordCount(dep.id, { notes: [{ denom: 100_000, qty: 1 }] }))?.code).toBe("DAILY_LIMIT_EXCEEDED");
  });

  it("AC12 dihitung lintas terminal", () => {
    const { svc } = setup();
    fill(svc, 50_000_000, { terminalId: "ATM-0412" });
    const dep = svc.start({ terminalId: "ATM-0999", accountNo: ACC_A });
    expect(thrown(() => svc.recordCount(dep.id, { notes: [{ denom: 100_000, qty: 1 }] }))?.code).toBe("DAILY_LIMIT_EXCEEDED");
  });

  it("AC13 rekening lain tidak terpengaruh", () => {
    const { svc } = setup();
    fill(svc, 50_000_000);
    expect(countedDeposit(svc, 200, "ATM-0412", ACC_B).status).toBe("COUNTED");
  });

  it("AC15 validasi nominal tetap lebih dulu dari batas harian", () => {
    const { svc } = setup();
    fill(svc, 50_000_000);
    const dep = svc.start({ terminalId: "ATM-0412", accountNo: ACC_A });
    const e = thrown(() => svc.recordCount(dep.id, { notes: [{ denom: 20_000, qty: 1 }] }));
    expect(e?.code).not.toBe("DAILY_LIMIT_EXCEEDED");
    expect(e?.code).toBeDefined();
  });
});
