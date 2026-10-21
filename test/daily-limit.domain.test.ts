import { describe, expect, it } from "vitest";
import { assertWithinDailyLimit, wibDayBounds } from "../src/domain/daily-limit.js";
import { DAILY_DEPOSIT_LIMIT } from "../src/domain/money.js";

function thrown(fn: () => unknown): { code?: string; message?: string } | undefined {
  try {
    fn();
  } catch (e) {
    return e as { code?: string; message?: string };
  }
  return undefined;
}

describe("batas setoran harian: domain", () => {
  it("konstanta Rp 50.000.000 integer", () => {
    expect(DAILY_DEPOSIT_LIMIT).toBe(50_000_000);
    expect(Number.isInteger(DAILY_DEPOSIT_LIMIT)).toBe(true);
  });

  it("wibDayBounds: 16:59:59.999Z masih hari WIB 20 Okt", () => {
    expect(wibDayBounds("2026-10-20T16:59:59.999Z")).toEqual({
      fromUtc: "2026-10-19T17:00:00.000Z",
      toUtc: "2026-10-20T17:00:00.000Z",
    });
  });

  it("wibDayBounds: 17:00:00.000Z sudah hari WIB 21 Okt", () => {
    expect(wibDayBounds("2026-10-20T17:00:00.000Z")).toEqual({
      fromUtc: "2026-10-20T17:00:00.000Z",
      toUtc: "2026-10-21T17:00:00.000Z",
    });
  });

  it("di bawah batas dan tepat di batas lolos", () => {
    expect(() => assertWithinDailyLimit(0, 20_000_000)).not.toThrow();
    expect(() => assertWithinDailyLimit(30_000_000, 20_000_000)).not.toThrow();
  });

  it("di atas batas ditolak dengan kode dan sisa kuota di pesan", () => {
    const e = thrown(() => assertWithinDailyLimit(40_000_000, 10_100_000));
    expect(e?.code).toBe("DAILY_LIMIT_EXCEEDED");
    expect(e?.message).toBe("batas setoran harian terlampaui, sisa kuota hari ini Rp 10.000.000");
  });

  it("sisa kuota minimum Rp 0", () => {
    const e = thrown(() => assertWithinDailyLimit(55_000_000, 100_000));
    expect(e?.message).toContain("sisa kuota hari ini Rp 0");
  });
});
