import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openDb } from "../src/db.js";
import { createApp } from "../src/server.js";
import { ACC_A } from "./helpers.js";

let server: Server;
let base: string;

beforeEach(async () => {
  // Hindari flake tengah malam WIB; hanya Date yang dipalsukan agar fetch tidak menggantung.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-21T05:00:00.000Z")); // 12:00 WIB
  const db = openDb(":memory:");
  db.prepare("INSERT INTO accounts (account_no, name) VALUES (?, ?)").run(ACC_A, "Nasabah A");
  server = createServer(createApp(db));
  await new Promise<void>((r) => server.listen(0, r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterEach(async () => {
  vi.useRealTimers();
  await new Promise<void>((r) => server.close(() => r()));
});

const post = (path: string, body: unknown = {}) =>
  fetch(base + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

async function posted(qty: number, n: number) {
  const dep = await (await post("/deposits", { terminalId: "ATM-0412", accountNo: ACC_A })).json();
  await post(`/deposits/${dep.id}/count`, { notes: [{ denom: 100000, qty }] });
  await post(`/deposits/${dep.id}/confirm`, { requestId: `API-${n}`, stan: String(400000 + n) });
}

describe("API batas setoran harian", () => {
  it("AC14 count yang melewati batas: 400, body {error, message}, tanpa nomor rekening", async () => {
    await posted(200, 1);
    await posted(200, 2);
    const dep = await (await post("/deposits", { terminalId: "ATM-0412", accountNo: ACC_A })).json();
    const res = await post(`/deposits/${dep.id}/count`, { notes: [{ denom: 100000, qty: 101 }] });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("DAILY_LIMIT_EXCEEDED");
    expect(body.message).toContain("sisa kuota hari ini Rp 10.000.000");
    const text = JSON.stringify(body);
    expect(text).not.toContain(ACC_A.slice(-4));
    expect(text).not.toContain(ACC_A);
  });
});
