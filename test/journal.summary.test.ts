import { describe, expect, it } from "vitest";
import { parseJournal } from "../src/journal/parser.js";
import { summarize } from "../src/journal/summary.js";

function journalFor(terminal: string, n: number, amount: number, reject: number) {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const stan = String(100 + i).padStart(6, "0");
    out.push(`2026-10-14 08:00:00.000 ${terminal} [CRM] COUNT denom=100000 qty=${amount / 100000} reject=${reject}`);
    out.push(`2026-10-14 08:00:01.000 ${terminal} [HOST] REQ stan=${stan} req=R-${i} amount=${amount}`);
    out.push(`2026-10-14 08:00:02.000 ${terminal} [HOST] RESP stan=${stan} req=R-${i} code=00 amount=${amount}`);
  }
  return out.join("\n");
}

const TERMINALS = Array.from({ length: 24 }, (_, i) => [`ATM-${String(201 + i * 7).padStart(4, "0")}`, (i % 5) + 1, ((i % 4) + 1) * 500_000, i % 3] as const);

describe("summarize per terminal", () => {
  it.each(TERMINALS)("%s: %i setoran @ %i, reject %i", (terminal, n, amount, reject) => {
    const [row] = summarize(parseJournal(journalFor(terminal, n, amount, reject)));
    expect(row).toEqual({ terminalId: terminal, deposits: n, amount: n * amount, rejectedNotes: n * reject, hostTimeouts: 0 });
  });

  it("menghitung timeout host", () => {
    const text = journalFor("ATM-0412", 1, 500_000, 0) + "\n2026-10-14 08:01:00.000 ATM-0412 [HOST] TIMEOUT stan=000100 req=R-0 after=30000ms";
    expect(summarize(parseJournal(text))[0].hostTimeouts).toBe(1);
  });
  it("respons selain 00 tidak dihitung sebagai setoran", () => {
    const text = "2026-10-14 08:00:02.000 ATM-0412 [HOST] RESP stan=000100 req=R-0 code=51 amount=500000";
    expect(summarize(parseJournal(text))[0].deposits).toBe(0);
  });
  it("urut berdasarkan terminal", () => {
    const text = journalFor("ATM-0900", 1, 500_000, 0) + "\n" + journalFor("ATM-0100", 1, 500_000, 0);
    expect(summarize(parseJournal(text)).map((r) => r.terminalId)).toEqual(["ATM-0100", "ATM-0900"]);
  });
});
