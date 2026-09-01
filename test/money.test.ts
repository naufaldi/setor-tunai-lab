import { describe, expect, it } from "vitest";
import { formatRupiah, isDenomination } from "../src/domain/money.js";

describe("isDenomination", () => {
  it.each([100_000, 50_000])("menerima Rp %i", (v) => expect(isDenomination(v)).toBe(true));
  it.each([20_000, 10_000, 5_000, 2_000, 1_000, 75_000, 0, -50_000])("menolak %i", (v) =>
    expect(isDenomination(v)).toBe(false),
  );
});

describe("formatRupiah", () => {
  it.each([
    [2_500_000, "Rp 2.500.000"],
    [50_000, "Rp 50.000"],
    [0, "Rp 0"],
    [20_000_000, "Rp 20.000.000"],
  ])("format %i", (v, s) => expect(formatRupiah(v)).toBe(s));
});
