import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { openDb, type Db } from "./db.js";
import { createDepositService } from "./deposit.service.js";
import { DepositError } from "./domain/deposit.js";
import { balance } from "./ledger.js";

async function readJson(req: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

export function createApp(db: Db) {
  const svc = createDepositService(db);
  return async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? "/", "http://local");
    const parts = url.pathname.split("/").filter(Boolean);
    try {
      if (req.method === "POST" && url.pathname === "/deposits") {
        return send(res, 201, svc.start(await readJson(req)));
      }
      if (parts[0] === "deposits" && parts[1]) {
        if (req.method === "GET" && parts.length === 2) return send(res, 200, svc.get(parts[1]));
        if (req.method === "POST" && parts[2] === "count") return send(res, 200, svc.recordCount(parts[1], await readJson(req)));
        if (req.method === "POST" && parts[2] === "confirm") return send(res, 200, svc.confirm(parts[1], await readJson(req)));
        if (req.method === "POST" && parts[2] === "pending") return send(res, 200, svc.markPending(parts[1], await readJson(req)));
        if (req.method === "POST" && parts[2] === "resolve") return send(res, 200, svc.resolve(parts[1], await readJson(req)));
        if (req.method === "POST" && parts[2] === "reverse") return send(res, 200, svc.reverse(parts[1], await readJson(req)));
        if (req.method === "POST" && parts[2] === "cancel") return send(res, 200, svc.cancel(parts[1]));
      }
      if (req.method === "GET" && parts[0] === "accounts" && parts[2] === "balance") {
        return send(res, 200, { accountNo: parts[1], balance: balance(db, parts[1]) });
      }
      return send(res, 404, { error: "NOT_FOUND" });
    } catch (e) {
      if (e instanceof DepositError) {
        const status = e.code === "NOT_FOUND" || e.code === "ACCOUNT_NOT_FOUND" ? 404 : e.code === "INVALID_STATE" ? 409 : 400;
        return send(res, status, { error: e.code, message: e.message });
      }
      return send(res, 500, { error: "INTERNAL" });
    }
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const db = openDb(process.env.DB_PATH ?? "setor-tunai.db");
  const port = Number(process.env.PORT ?? 8787);
  createServer(createApp(db)).listen(port, () => console.log(`setor-tunai-api di http://localhost:${port}`));
}
