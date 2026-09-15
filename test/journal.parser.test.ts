import { describe, expect, it } from "vitest";
import { hostRequestsByStan, parseJournal, parseLine } from "../src/journal/parser.js";

const SAMPLE = `2026-10-14 09:12:03.114 ATM-0412 [CRM] CASH_IN_START sess=S-1a2b acct=****7781
2026-10-14 09:12:21.502 ATM-0412 [CRM] COUNT denom=100000 qty=25 reject=1
2026-10-14 09:12:30.010 ATM-0412 [HOST] REQ stan=004417 req=R-9f3a amount=2500000
2026-10-14 09:12:31.000 ATM-0412 [DEV] HEARTBEAT temp=41C
baris rusak tanpa format`;

describe("parseLine", () => {
  it("membaca timestamp, terminal, channel, event", () => {
    const l = parseLine("2026-10-14 09:12:03.114 ATM-0412 [CRM] CASH_IN_START sess=S-1a2b acct=****7781");
    expect(l).toMatchObject({ ts: "2026-10-14 09:12:03.114", terminalId: "ATM-0412", channel: "CRM", event: "CASH_IN_START" });
  });
  it.each([
    ["sess", "S-1a2b"],
    ["acct", "****7781"],
  ])("membaca field %s", (k, v) => {
    const l = parseLine("2026-10-14 09:12:03.114 ATM-0412 [CRM] CASH_IN_START sess=S-1a2b acct=****7781");
    expect(l?.fields[k]).toBe(v);
  });
  it.each(["", "halo", "2026-10-14 ATM-0412 [CRM] X", "2026-10-14 09:12:03.114 ATM-12 [CRM] X"])(
    "mengembalikan null untuk '%s'",
    (s) => expect(parseLine(s)).toBeNull(),
  );
  it("event tanpa field", () => {
    expect(parseLine("2026-10-14 09:00:00.000 ATM-0412 [DEV] DOOR_CLOSED")?.fields).toEqual({});
  });
});

describe("parseJournal", () => {
  it("melewati baris rusak", () => expect(parseJournal(SAMPLE)).toHaveLength(4));
  it("mengelompokkan request host per STAN", () => {
    const m = hostRequestsByStan(parseJournal(SAMPLE));
    expect(m.get("004417")).toEqual(["R-9f3a"]);
  });
  it("satu STAN bisa punya lebih dari satu request", () => {
    const text = SAMPLE + "\n2026-10-14 09:13:00.010 ATM-0412 [HOST] REQ stan=004417 req=R-a771 amount=2500000";
    expect(hostRequestsByStan(parseJournal(text)).get("004417")).toEqual(["R-9f3a", "R-a771"]);
  });
});
