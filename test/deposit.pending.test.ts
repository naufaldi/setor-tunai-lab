import { describe, expect, it } from "vitest";
import { balance } from "../src/ledger.js";
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
