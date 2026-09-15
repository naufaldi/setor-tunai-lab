// Parser log journal CRM (format ilustrasi):
// 2026-10-14 09:12:03.114 ATM-0412 [HOST] REQ stan=004417 req=R-9f3a amount=2500000
export interface JournalLine {
  ts: string;
  terminalId: string;
  channel: string;
  event: string;
  fields: Record<string, string>;
}

const LINE = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}) (ATM-\d{4}) \[([A-Z]+)\] ([A-Z_]+)(.*)$/;

export function parseLine(line: string): JournalLine | null {
  const m = LINE.exec(line.trim());
  if (!m) return null;
  const fields: Record<string, string> = {};
  for (const part of m[5].trim().split(/\s+/)) {
    const eq = part.indexOf("=");
    if (eq > 0) fields[part.slice(0, eq)] = part.slice(eq + 1);
  }
  return { ts: m[1], terminalId: m[2], channel: m[3], event: m[4], fields };
}

export function parseJournal(text: string): JournalLine[] {
  return text
    .split("\n")
    .map(parseLine)
    .filter((l): l is JournalLine => l !== null);
}

export function hostRequestsByStan(lines: JournalLine[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const l of lines) {
    if (l.channel === "HOST" && l.event === "REQ" && l.fields.stan) {
      const list = out.get(l.fields.stan) ?? [];
      list.push(l.fields.req);
      out.set(l.fields.stan, list);
    }
  }
  return out;
}
