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

const open = async () => (await (await post("/deposits", { terminalId: "ATM-0412", accountNo: ACC_A })).json()).id as string;
const counted = async () => {
  const id = await open();
  await post(`/deposits/${id}/count`, { notes: [{ denom: 100000, qty: 25 }] });
  return id;
};
const balanceOf = async () => (await (await fetch(`${base}/accounts/${ACC_A}/balance`)).json()).balance;

describe("API pending, resolve, reverse", () => {
  it("count, pending, resolve: POSTED dan saldo masuk", async () => {
    const id = await counted();
    const p = await post(`/deposits/${id}/pending`, { actor: "op", reason: "host timeout" });
    expect(p.status).toBe(200);
    expect((await p.json()).status).toBe("PENDING");
    const r = await post(`/deposits/${id}/resolve`, { actor: "op", reason: "host approve", stan: "004417" });
    expect(r.status).toBe(200);
    expect((await r.json()).status).toBe("POSTED");
    expect(await balanceOf()).toBe(2_500_000);
  });
  it("count, pending, reverse: REVERSED, saldo 0, reverse ulang 200", async () => {
    const id = await counted();
    await post(`/deposits/${id}/pending`, { actor: "op", reason: "host timeout" });
    const r = await post(`/deposits/${id}/reverse`, { actor: "op", reason: "host decline" });
    expect(r.status).toBe(200);
    expect((await r.json()).status).toBe("REVERSED");
    expect(await balanceOf()).toBe(0);
    expect((await post(`/deposits/${id}/reverse`, { actor: "op", reason: "host decline" })).status).toBe(200);
  });
  it("409 INVALID_STATE: pending pada OPEN", async () => {
    const id = await open();
    const res = await post(`/deposits/${id}/pending`, { actor: "op", reason: "x" });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("INVALID_STATE");
  });
  it("409: reverse pada COUNTED", async () => {
    const id = await counted();
    expect((await post(`/deposits/${id}/reverse`, { actor: "op", reason: "x" })).status).toBe(409);
  });
  it("409: cancel pada PENDING", async () => {
    const id = await counted();
    await post(`/deposits/${id}/pending`, { actor: "op", reason: "x" });
    expect((await post(`/deposits/${id}/cancel`)).status).toBe(409);
  });
  it("400 INVALID_ACTOR untuk body kosong pada pending", async () => {
    const id = await counted();
    const res = await post(`/deposits/${id}/pending`, {});
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("INVALID_ACTOR");
  });
  it("400 INVALID_STAN untuk stan number pada resolve", async () => {
    const id = await counted();
    await post(`/deposits/${id}/pending`, { actor: "op", reason: "x" });
    const res = await post(`/deposits/${id}/resolve`, { actor: "op", reason: "x", stan: 123456 });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("INVALID_STAN");
  });
  it.each(["pending", "resolve", "reverse"])("404 untuk id tidak ada pada %s", async (action) => {
    const res = await post(`/deposits/S-xxxx/${action}`, { actor: "op", reason: "x", stan: "004417" });
    expect(res.status).toBe(404);
  });
});
