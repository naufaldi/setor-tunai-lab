import type { JournalLine } from "./parser.js";

export interface TerminalSummary {
  terminalId: string;
  deposits: number;
  amount: number;
  rejectedNotes: number;
  hostTimeouts: number;
}

// Rekap per terminal dari journal: jumlah setoran yang di-approve host,
// total nominal, lembar ditolak, dan jumlah timeout host.
export function summarize(lines: JournalLine[]): TerminalSummary[] {
  const map = new Map<string, TerminalSummary>();
  const row = (t: string) => {
    let r = map.get(t);
    if (!r) {
      r = { terminalId: t, deposits: 0, amount: 0, rejectedNotes: 0, hostTimeouts: 0 };
      map.set(t, r);
    }
    return r;
  };
  for (const l of lines) {
    const r = row(l.terminalId);
    if (l.channel === "CRM" && l.event === "COUNT") r.rejectedNotes += Number(l.fields.reject ?? 0);
    if (l.channel === "HOST" && l.event === "TIMEOUT") r.hostTimeouts += 1;
    if (l.channel === "HOST" && l.event === "RESP" && l.fields.code === "00") {
      r.deposits += 1;
      r.amount += Number(l.fields.amount ?? 0);
    }
  }
  return [...map.values()].sort((a, b) => a.terminalId.localeCompare(b.terminalId));
}
