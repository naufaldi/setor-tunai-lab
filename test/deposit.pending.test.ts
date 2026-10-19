import { describe, expect, it } from "vitest";
import { balance, CASH_IN_MACHINE, postDepositEntries, postReversalEntries } from "../src/ledger.js";
import { ACC_A, countedDeposit, setup } from "./helpers.js";

const input = { actor: "spv.rina", reason: "host timeout, menunggu rekonsiliasi" };

function events(db: ReturnType<typeof setup>["db"], id: string) {
  return db.prepare("SELECT action, actor, reason, created_at FROM deposit_events WHERE deposit_id = ?").all(id) as {
    action: string;
    actor: string;
    reason: string;
    created_at: string;
  }[];
}

function code(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (e) {
    return (e as { code?: string }).code;
  }
  return undefined;
}

describe("markPending", () => {
  it("COUNTED menjadi PENDING dan mencatat satu event", () => {
    const { db, svc } = setup();
    const dep = countedDeposit(svc);
    const res = svc.markPending(dep.id, input);
    expect(res.status).toBe("PENDING");
    const ev = events(db, dep.id);
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ action: "PENDING", ...input });
    expect(ev[0].created_at).toMatch(/^2026-10-14T02:12:\d\d\.000Z$/);
    expect(balance(db, ACC_A)).toBe(0);
  });

  it("dipanggil lagi pada PENDING tidak menambah event", () => {
    const { db, svc } = setup();
    const dep = countedDeposit(svc);
    svc.markPending(dep.id, input);
    expect(svc.markPending(dep.id, input).status).toBe("PENDING");
    expect(events(db, dep.id)).toHaveLength(1);
  });

  it("OPEN, POSTED, CANCELLED melempar INVALID_STATE", () => {
    const { svc } = setup();
    const open = svc.start({ terminalId: "ATM-0412", accountNo: ACC_A });
    expect(code(() => svc.markPending(open.id, input))).toBe("INVALID_STATE");
    const posted = countedDeposit(svc);
    svc.confirm(posted.id, { requestId: "r1", stan: "004417" });
    expect(code(() => svc.markPending(posted.id, input))).toBe("INVALID_STATE");
    const cancelled = countedDeposit(svc);
    svc.cancel(cancelled.id);
    expect(code(() => svc.markPending(cancelled.id, input))).toBe("INVALID_STATE");
  });

  it("validasi actor dan reason lebih dulu dari state, tanpa event", () => {
    const { db, svc } = setup();
    const open = svc.start({ terminalId: "ATM-0412", accountNo: ACC_A });
    expect(code(() => svc.markPending(open.id, { actor: "", reason: "x" }))).toBe("INVALID_ACTOR");
    expect(code(() => svc.markPending(open.id, { actor: "a", reason: "" }))).toBe("INVALID_REASON");
    expect(events(db, open.id)).toHaveLength(0);
  });

  it("id tidak ada melempar NOT_FOUND", () => {
    const { svc } = setup();
    expect(code(() => svc.markPending("S-nope", input))).toBe("NOT_FOUND");
  });

  it("PENDING menolak cancel, confirm, dan recordCount", () => {
    const { svc } = setup();
    const dep = countedDeposit(svc);
    svc.markPending(dep.id, input);
    expect(code(() => svc.cancel(dep.id))).toBe("INVALID_STATE");
    expect(code(() => svc.confirm(dep.id, { requestId: "r2", stan: "004417" }))).toBe("INVALID_STATE");
    expect(code(() => svc.recordCount(dep.id, { notes: [{ denom: 50_000, qty: 1 }] }))).toBe("INVALID_STATE");
  });
});

describe("resolve", () => {
  const rin = { ...input, stan: "004417" };
  type Ctx = ReturnType<typeof setup>;

  function pendingDeposit({ svc }: Ctx) {
    const dep = countedDeposit(svc);
    svc.markPending(dep.id, input);
    return dep;
  }
  function snapshot(db: Ctx["db"], id: string) {
    const status = (db.prepare("SELECT status FROM deposits WHERE id = ?").get(id) as { status: string }).status;
    const ledger = (db.prepare("SELECT COUNT(*) AS n FROM ledger_entries").get() as { n: number }).n;
    const ev = (db.prepare("SELECT COUNT(*) AS n FROM deposit_events").get() as { n: number }).n;
    return { status, ledger, ev, bal: balance(db, ACC_A) };
  }
  function addHostRequest(db: Ctx["db"], id: string, stan: string, requestId = "rq-" + stan) {
    db.prepare(
      "INSERT INTO host_requests (request_id, deposit_id, terminal_id, stan, created_at) VALUES (?, ?, ?, ?, ?)",
    ).run(requestId, id, "ATM-0412", stan, "2026-10-14T02:00:00.000Z");
  }

  it("PENDING tanpa STAN dikenal menjadi POSTED dan memposting ledger", () => {
    const ctx = setup();
    const { db, svc } = ctx;
    const dep = pendingDeposit(ctx);
    const res = svc.resolve(dep.id, rin);
    expect(res.status).toBe("POSTED");
    expect(res.stan).toBe("004417");
    expect(balance(db, ACC_A)).toBe(2_500_000);
    expect(balance(db, CASH_IN_MACHINE("ATM-0412"))).toBe(-2_500_000);
    const resolved = events(db, dep.id).filter((e) => e.action === "RESOLVED");
    expect(resolved).toHaveLength(1);
    expect(resolved[0]).toMatchObject(input);
  });

  it("confirm yang mati di tengah: tidak kredit ganda", () => {
    const ctx = setup();
    const { db, svc } = ctx;
    const dep = countedDeposit(svc);
    addHostRequest(db, dep.id, "004417");
    postDepositEntries(db, {
      terminalId: "ATM-0412",
      accountNo: ACC_A,
      amount: dep.amount,
      ref: "ATM-0412/004417",
      at: "2026-10-14T02:00:00.000Z",
    });
    svc.markPending(dep.id, input);
    const res = svc.resolve(dep.id, rin);
    expect(res.status).toBe("POSTED");
    expect(res.stan).toBe("004417");
    expect(balance(db, ACC_A)).toBe(2_500_000);
    expect(snapshot(db, dep.id).ledger).toBe(2);
  });

  it("STAN dikenal lain melempar INVALID_STATE tanpa efek", () => {
    const ctx = setup();
    const { db, svc } = ctx;
    const dep = pendingDeposit(ctx);
    addHostRequest(db, dep.id, "004417");
    const before = snapshot(db, dep.id);
    expect(code(() => svc.resolve(dep.id, { ...input, stan: "004418" }))).toBe("INVALID_STATE");
    expect(snapshot(db, dep.id)).toEqual(before);
    expect(before.status).toBe("PENDING");
  });

  it("resolve kedua pada POSTED: STAN sama tanpa efek, STAN beda INVALID_STATE", () => {
    const ctx = setup();
    const { db, svc } = ctx;
    const dep = pendingDeposit(ctx);
    svc.resolve(dep.id, rin);
    const before = snapshot(db, dep.id);
    expect(svc.resolve(dep.id, rin).status).toBe("POSTED");
    expect(snapshot(db, dep.id)).toEqual(before);
    expect(code(() => svc.resolve(dep.id, { ...input, stan: "004418" }))).toBe("INVALID_STATE");
    expect(snapshot(db, dep.id)).toEqual(before);
  });

  it("COUNTED, OPEN, REVERSED melempar INVALID_STATE tanpa efek", () => {
    const { db, svc } = setup();
    const open = svc.start({ terminalId: "ATM-0412", accountNo: ACC_A });
    const counted = countedDeposit(svc);
    const reversed = countedDeposit(svc);
    db.prepare("UPDATE deposits SET status = 'REVERSED' WHERE id = ?").run(reversed.id);
    for (const d of [open, counted, reversed]) {
      const before = snapshot(db, d.id);
      expect(code(() => svc.resolve(d.id, rin))).toBe("INVALID_STATE");
      expect(snapshot(db, d.id)).toEqual(before);
    }
  });

  it("stan bukan string 6 digit melempar INVALID_STAN tanpa efek", () => {
    const ctx = setup();
    const { db, svc } = ctx;
    const dep = pendingDeposit(ctx);
    const before = snapshot(db, dep.id);
    expect(code(() => svc.resolve(dep.id, { ...input, stan: 123456 as unknown as string }))).toBe("INVALID_STAN");
    expect(code(() => svc.resolve(dep.id, { ...input, stan: "12" }))).toBe("INVALID_STAN");
    expect(snapshot(db, dep.id)).toEqual(before);
    expect(db.prepare("SELECT stan FROM deposits WHERE id = ?").get(dep.id)).toEqual({ stan: null });
  });

  it("validasi actor dan reason lebih dulu dari stan dan state, tanpa efek", () => {
    const { db, svc } = setup();
    const open = svc.start({ terminalId: "ATM-0412", accountNo: ACC_A });
    const before = snapshot(db, open.id);
    expect(code(() => svc.resolve(open.id, { actor: "", reason: "x", stan: "bad" }))).toBe("INVALID_ACTOR");
    expect(code(() => svc.resolve(open.id, { actor: "a", reason: "", stan: "bad" }))).toBe("INVALID_REASON");
    expect(code(() => svc.resolve(open.id, { actor: "a", reason: "x", stan: "bad" }))).toBe("INVALID_STAN");
    expect(snapshot(db, open.id)).toEqual(before);
  });

  it("id tidak ada melempar NOT_FOUND", () => {
    const { svc } = setup();
    expect(code(() => svc.resolve("S-nope", rin))).toBe("NOT_FOUND");
  });

  it("rollback jika insert event gagal", () => {
    const ctx = setup();
    const { db, svc } = ctx;
    const dep = pendingDeposit(ctx);
    db.exec(
      "CREATE TRIGGER boom BEFORE INSERT ON deposit_events WHEN NEW.action = 'RESOLVED' BEGIN SELECT RAISE(ABORT, 'boom'); END",
    );
    expect(() => svc.resolve(dep.id, rin)).toThrow();
    const row = db.prepare("SELECT status, stan FROM deposits WHERE id = ?").get(dep.id);
    expect(row).toEqual({ status: "PENDING", stan: null });
    expect((db.prepare("SELECT COUNT(*) AS n FROM ledger_entries").get() as { n: number }).n).toBe(0);
  });
});

describe("reverse", () => {
  type Ctx = ReturnType<typeof setup>;
  const KAS = CASH_IN_MACHINE("ATM-0412");

  function snapshot(db: Ctx["db"], id: string) {
    const status = (db.prepare("SELECT status FROM deposits WHERE id = ?").get(id) as { status: string }).status;
    const ledger = (db.prepare("SELECT COUNT(*) AS n FROM ledger_entries").get() as { n: number }).n;
    const ev = (db.prepare("SELECT COUNT(*) AS n FROM deposit_events").get() as { n: number }).n;
    return { status, ledger, ev, bal: balance(db, ACC_A), kas: balance(db, KAS) };
  }
  function credited(db: Ctx["db"], id: string, amount: number, stan: string, requestId = "rq-" + stan) {
    db.prepare(
      "INSERT INTO host_requests (request_id, deposit_id, terminal_id, stan, created_at) VALUES (?, ?, ?, ?, ?)",
    ).run(requestId, id, "ATM-0412", stan, "2026-10-14T02:00:00.000Z");
    postDepositEntries(db, {
      terminalId: "ATM-0412",
      accountNo: ACC_A,
      amount,
      ref: `ATM-0412/${stan}`,
      at: "2026-10-14T02:00:00.000Z",
    });
  }
  function pending(svc: Ctx["svc"]) {
    const dep = countedDeposit(svc);
    return dep;
  }
  const count = (db: Ctx["db"], ref: string) =>
    (db.prepare("SELECT COUNT(*) AS n FROM ledger_entries WHERE ref = ?").get(ref) as { n: number }).n;

  it("PENDING tanpa ledger menjadi REVERSED dengan satu event", () => {
    const { db, svc } = setup();
    const dep = pending(svc);
    svc.markPending(dep.id, input);
    const res = svc.reverse(dep.id, input);
    expect(res.status).toBe("REVERSED");
    expect((db.prepare("SELECT COUNT(*) AS n FROM ledger_entries").get() as { n: number }).n).toBe(0);
    const rev = events(db, dep.id).filter((e) => e.action === "REVERSED");
    expect(rev).toHaveLength(1);
    expect(rev[0]).toMatchObject(input);
  });

  it("ledger terkredit dibalik dengan entri baru", () => {
    const { db, svc } = setup();
    const dep = pending(svc);
    credited(db, dep.id, dep.amount, "004417");
    svc.markPending(dep.id, input);
    const res = svc.reverse(dep.id, input);
    expect(res.status).toBe("REVERSED");
    expect(balance(db, ACC_A)).toBe(0);
    expect(balance(db, KAS)).toBe(0);
    const rev = db
      .prepare("SELECT account_no, direction, amount FROM ledger_entries WHERE ref = ? ORDER BY id")
      .all("ATM-0412/004417/REV");
    expect(rev).toEqual(
      expect.arrayContaining([
        { account_no: ACC_A, direction: "DR", amount: dep.amount },
        { account_no: KAS, direction: "CR", amount: dep.amount },
      ]),
    );
    expect(rev).toHaveLength(2);
    expect(count(db, "ATM-0412/004417")).toBe(2);
    expect((db.prepare("SELECT COUNT(*) AS n FROM ledger_entries").get() as { n: number }).n).toBe(4);
  });

  it("dua STAN dikenal dan keduanya terkredit: keduanya dibalik", () => {
    const { db, svc } = setup();
    const dep = pending(svc);
    credited(db, dep.id, dep.amount, "004417");
    credited(db, dep.id, dep.amount, "004418");
    svc.markPending(dep.id, input);
    svc.reverse(dep.id, input);
    expect(balance(db, ACC_A)).toBe(0);
    expect(balance(db, KAS)).toBe(0);
    expect(count(db, "ATM-0412/004417/REV")).toBe(2);
    expect(count(db, "ATM-0412/004418/REV")).toBe(2);
  });

  it("reversal parsial sebelumnya diselesaikan tanpa membalik dua kali", () => {
    const { db, svc } = setup();
    const dep = pending(svc);
    credited(db, dep.id, dep.amount, "004417");
    credited(db, dep.id, dep.amount, "004418");
    svc.markPending(dep.id, input);
    expect(postReversalEntries(db, "ATM-0412/004417", "2026-10-14T02:05:00.000Z")).toBe(true);
    expect(snapshot(db, dep.id).status).toBe("PENDING");
    svc.reverse(dep.id, input);
    expect(balance(db, ACC_A)).toBe(0);
    expect(balance(db, KAS)).toBe(0);
    expect(count(db, "ATM-0412/004417/REV")).toBe(2);
    expect(count(db, "ATM-0412/004418/REV")).toBe(2);
  });

  it("reverse kedua pada REVERSED tanpa efek", () => {
    const { db, svc } = setup();
    const dep = pending(svc);
    credited(db, dep.id, dep.amount, "004417");
    svc.markPending(dep.id, input);
    svc.reverse(dep.id, input);
    const before = snapshot(db, dep.id);
    expect(svc.reverse(dep.id, input).status).toBe("REVERSED");
    expect(snapshot(db, dep.id)).toEqual(before);
  });

  it("COUNTED, OPEN, POSTED melempar INVALID_STATE tanpa efek", () => {
    const { db, svc } = setup();
    const open = svc.start({ terminalId: "ATM-0412", accountNo: ACC_A });
    const counted = countedDeposit(svc);
    const posted = countedDeposit(svc);
    svc.confirm(posted.id, { requestId: "r1", stan: "004417" });
    for (const d of [open, counted, posted]) {
      const before = snapshot(db, d.id);
      expect(code(() => svc.reverse(d.id, input))).toBe("INVALID_STATE");
      expect(snapshot(db, d.id)).toEqual(before);
    }
  });

  it("markPending dan resolve pada REVERSED melempar INVALID_STATE tanpa efek", () => {
    const { db, svc } = setup();
    const dep = pending(svc);
    svc.markPending(dep.id, input);
    svc.reverse(dep.id, input);
    const before = snapshot(db, dep.id);
    expect(code(() => svc.markPending(dep.id, input))).toBe("INVALID_STATE");
    expect(code(() => svc.resolve(dep.id, { ...input, stan: "004417" }))).toBe("INVALID_STATE");
    expect(snapshot(db, dep.id)).toEqual(before);
  });

  it("validasi actor dan reason lebih dulu dari state, tanpa efek", () => {
    const { db, svc } = setup();
    const open = svc.start({ terminalId: "ATM-0412", accountNo: ACC_A });
    const before = snapshot(db, open.id);
    expect(code(() => svc.reverse(open.id, { actor: "", reason: "x" }))).toBe("INVALID_ACTOR");
    expect(code(() => svc.reverse(open.id, { actor: "a", reason: "" }))).toBe("INVALID_REASON");
    expect(snapshot(db, open.id)).toEqual(before);
  });

  it("id tidak ada melempar NOT_FOUND", () => {
    const { svc } = setup();
    expect(code(() => svc.reverse("S-nope", input))).toBe("NOT_FOUND");
  });

  it("rollback jika insert event REVERSED gagal", () => {
    const { db, svc } = setup();
    const dep = pending(svc);
    credited(db, dep.id, dep.amount, "004417");
    svc.markPending(dep.id, input);
    db.exec(
      "CREATE TRIGGER boom BEFORE INSERT ON deposit_events WHEN NEW.action = 'REVERSED' BEGIN SELECT RAISE(ABORT, 'boom'); END",
    );
    const before = snapshot(db, dep.id);
    expect(() => svc.reverse(dep.id, input)).toThrow();
    expect(snapshot(db, dep.id)).toEqual(before);
    expect(before.status).toBe("PENDING");
    expect((db.prepare("SELECT COUNT(*) AS n FROM ledger_entries WHERE ref LIKE '%/REV'").get() as { n: number }).n).toBe(0);
  });
});
