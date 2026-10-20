import { describe, expect, it } from "vitest";
import { countAmount, validateAccountNo, validateRejected, validateStan, validateTerminalId } from "../src/domain/deposit.js";

describe("validateTerminalId", () => {
  it.each(["ATM-0412", "ATM-0219", "ATM-3350", "ATM-0001"])("valid: %s", (t) => expect(() => validateTerminalId(t)).not.toThrow());
  it.each(["atm-0412", "ATM-412", "ATM-04120", "CRM-0412", "", "ATM 0412"])("tidak valid: '%s'", (t) =>
    expect(() => validateTerminalId(t)).toThrow(/terminal_id/),
  );
});

describe("validateAccountNo", () => {
  it.each(["0123457781", "9999999999"])("valid: %s", (a) => expect(() => validateAccountNo(a)).not.toThrow());
  it.each(["123", "01234577810", "abcdefghij", "", "0123-45778"])("tidak valid: '%s'", (a) =>
    expect(() => validateAccountNo(a)).toThrow(/10 digit/),
  );
});

describe("validateStan", () => {
  it.each(["004417", "000001", "999999"])("valid: %s", (s) => expect(() => validateStan(s)).not.toThrow());
  it.each(["4417", "0044170", "00441a", ""])("tidak valid: '%s'", (s) => expect(() => validateStan(s)).toThrow(/STAN/));
});

describe("validateRejected", () => {
  it.each([0, 1, 19, 20])("valid: %i lembar reject", (r) => expect(() => validateRejected(r)).not.toThrow());
  it.each([21, 22, 100])("menolak %i lembar reject", (r) => expect(() => validateRejected(r)).toThrow(/20 lembar/));
});

describe("countAmount", () => {
  it.each([
    [[{ denom: 100_000, qty: 25 }], 2_500_000],
    [[{ denom: 50_000, qty: 10 }], 500_000],
    [[{ denom: 100_000, qty: 3 }, { denom: 50_000, qty: 3 }], 450_000],
    [[{ denom: 100_000, qty: 200 }], 20_000_000],
    [[{ denom: 50_000, qty: 1 }], 50_000],
    [[{ denom: 100_000, qty: 0 }, { denom: 50_000, qty: 2 }], 100_000],
  ])("menghitung %j = %i", (notes, total) => expect(countAmount(notes)).toBe(total));

  it("menolak nominal Rp 20.000", () => expect(() => countAmount([{ denom: 20_000, qty: 1 }])).toThrow(/nominal/));
  it("menolak lembar negatif", () => expect(() => countAmount([{ denom: 50_000, qty: -1 }])).toThrow(/bilangan bulat/));
  it("menolak lembar pecahan", () => expect(() => countAmount([{ denom: 50_000, qty: 1.5 }])).toThrow(/bilangan bulat/));
  it("menolak setoran kosong", () => expect(() => countAmount([{ denom: 50_000, qty: 0 }])).toThrow(/tidak ada uang/));
  it("menolak lebih dari 200 lembar", () =>
    expect(() => countAmount([{ denom: 100_000, qty: 150 }, { denom: 50_000, qty: 51 }])).toThrow(/200 lembar/),
  );
});
