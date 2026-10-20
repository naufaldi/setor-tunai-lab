import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb } from "../src/db.js";
import { createApp } from "../src/server.js";
import { ACC_A } from "./helpers.js";

let server: Server;
let base: string;

beforeEach(async () => {
  const db = openDb(":memory:");
  db.prepare("INSERT INTO accounts (account_no, name) VALUES (?, ?)").run(ACC_A, "Nasabah A");
  server = createServer(createApp(db));
  await new Promise<void>((r) => server.listen(0, r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterEach(() => new Promise<void>((r) => server.close(() => r())));

const post = (path: string, body: unknown = {}) =>
  fetch(base + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("API setoran", () => {
  it("POST /deposits membuat setoran", async () => {
    const res = await post("/deposits", { terminalId: "ATM-0412", accountNo: ACC_A });
    expect(res.status).toBe(201);
  });
  it("alur lengkap: start, count, confirm, saldo", async () => {
    const dep = await (await post("/deposits", { terminalId: "ATM-0412", accountNo: ACC_A })).json();
    await post(`/deposits/${dep.id}/count`, { notes: [{ denom: 100000, qty: 25 }] });
    const res = await post(`/deposits/${dep.id}/confirm`, { requestId: "R-9f3a", stan: "004417" });
    expect(res.status).toBe(200);
    const bal = await (await fetch(`${base}/accounts/${ACC_A}/balance`)).json();
    expect(bal.balance).toBe(2_500_000);
  });
  it("400 untuk nominal tidak diterima", async () => {
    const dep = await (await post("/deposits", { terminalId: "ATM-0412", accountNo: ACC_A })).json();
    const res = await post(`/deposits/${dep.id}/count`, { notes: [{ denom: 20000, qty: 1 }] });
    expect(res.status).toBe(400);
  });
  it("400 TOO_MANY_REJECTS jika reject lebih dari 20", async () => {
    const dep = await (await post("/deposits", { terminalId: "ATM-0412", accountNo: ACC_A })).json();
    const res = await post(`/deposits/${dep.id}/count`, { notes: [{ denom: 100000, qty: 5 }], rejected: 21 });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("TOO_MANY_REJECTS");
  });
  it("200 jika reject tepat 20", async () => {
    const dep = await (await post("/deposits", { terminalId: "ATM-0412", accountNo: ACC_A })).json();
    const res = await post(`/deposits/${dep.id}/count`, { notes: [{ denom: 100000, qty: 5 }], rejected: 20 });
    expect(res.status).toBe(200);
  });
  it("404 untuk rekening tidak terdaftar", async () => {
    const res = await post("/deposits", { terminalId: "ATM-0412", accountNo: "0000000000" });
    expect(res.status).toBe(404);
  });
  it("409 untuk konfirmasi sebelum dihitung", async () => {
    const dep = await (await post("/deposits", { terminalId: "ATM-0412", accountNo: ACC_A })).json();
    const res = await post(`/deposits/${dep.id}/confirm`, { requestId: "R-1", stan: "000001" });
    expect(res.status).toBe(409);
  });
  it("404 untuk path tidak dikenal", async () => {
    expect((await fetch(base + "/halo")).status).toBe(404);
  });
});
