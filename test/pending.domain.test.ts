import { describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "../src/db.js";
import { REASON_MAX_LENGTH, validateActor, validateReason } from "../src/domain/deposit.js";

function codeOf(fn: () => void): string | undefined {
  try {
    fn();
  } catch (e) {
    return (e as { code?: string }).code;
  }
  return undefined;
}

describe("validateActor", () => {
  it.each([[""], ["   "], [7], [undefined]])("menolak %j", (v) => {
    expect(codeOf(() => validateActor(v))).toBe("INVALID_ACTOR");
  });
  it("menerima actor valid", () => {
    expect(() => validateActor("operator-01")).not.toThrow();
  });
});

describe("validateReason", () => {
  it.each([[""], ["   "], [7], [undefined]])("menolak %j", (v) => {
    expect(codeOf(() => validateReason(v))).toBe("INVALID_REASON");
  });
  it("batas panjang", () => {
    expect(REASON_MAX_LENGTH).toBe(200);
    expect(() => validateReason("x".repeat(200))).not.toThrow();
    expect(codeOf(() => validateReason("x".repeat(201)))).toBe("INVALID_REASON");
  });
});

describe("tabel deposit_events", () => {
  it("dibuat oleh openDb", () => {
    const db = openDb(":memory:");
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='deposit_events'").get();
    expect(row).toBeDefined();
  });
  it("openDb dua kali pada file yang sama tidak error", () => {
    const file = join(mkdtempSync(join(tmpdir(), "dep-")), "t.db");
    openDb(file).close();
    expect(() => openDb(file).close()).not.toThrow();
  });
});
