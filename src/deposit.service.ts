import { randomUUID } from "node:crypto";
import type { Db } from "./db.js";
import {
  canConfirm,
  countAmount,
  DepositError,
  validateAccountNo,
  validateStan,
  validateTerminalId,
  type Deposit,
  type NoteCount,
} from "./domain/deposit.js";
import { postDepositEntries } from "./ledger.js";

type Clock = () => string;
const systemClock: Clock = () => new Date().toISOString();

interface DepositRow {
  id: string;
  terminal_id: string;
  account_no: string;
  status: Deposit["status"];
  notes_json: string;
  rejected_notes: number;
  amount: number;
  stan: string | null;
  created_at: string;
}

function toDeposit(r: DepositRow): Deposit {
  return {
    id: r.id,
    terminalId: r.terminal_id,
    accountNo: r.account_no,
    status: r.status,
    notes: JSON.parse(r.notes_json) as NoteCount[],
    rejectedNotes: r.rejected_notes,
    amount: Number(r.amount),
    stan: r.stan,
    createdAt: r.created_at,
  };
}

export function createDepositService(db: Db, now: Clock = systemClock) {
  function get(id: string): Deposit {
    const row = db.prepare("SELECT * FROM deposits WHERE id = ?").get(id) as DepositRow | undefined;
    if (!row) throw new DepositError("NOT_FOUND", `setoran ${id} tidak ditemukan`);
    return toDeposit(row);
  }

  function start(input: { terminalId: string; accountNo: string }): Deposit {
    validateTerminalId(input.terminalId);
    validateAccountNo(input.accountNo);
    const account = db.prepare("SELECT 1 FROM accounts WHERE account_no = ?").get(input.accountNo);
    if (!account) throw new DepositError("ACCOUNT_NOT_FOUND", "rekening tidak terdaftar");
    const id = "S-" + randomUUID().slice(0, 8);
    db.prepare(
      "INSERT INTO deposits (id, terminal_id, account_no, status, created_at) VALUES (?, ?, ?, 'OPEN', ?)",
    ).run(id, input.terminalId, input.accountNo, now());
    return get(id);
  }

  function recordCount(id: string, input: { notes: { denom: number; qty: number }[]; rejected?: number }): Deposit {
    const dep = get(id);
    if (dep.status !== "OPEN") throw new DepositError("INVALID_STATE", `status ${dep.status} tidak bisa dihitung ulang`);
    const amount = countAmount(input.notes);
    db.prepare(
      "UPDATE deposits SET status = 'COUNTED', notes_json = ?, rejected_notes = ?, amount = ? WHERE id = ?",
    ).run(JSON.stringify(input.notes), input.rejected ?? 0, amount, id);
    return get(id);
  }

  // Dipanggil saat nasabah menekan "Setuju" dan host membalas approve.
  // CRM mengirim ulang (retry) jika host tidak membalas dalam 30 detik.
  function confirm(id: string, input: { requestId: string; stan: string }): Deposit {
    validateStan(input.stan);
    const seen = db.prepare("SELECT deposit_id FROM host_requests WHERE request_id = ?").get(input.requestId) as
      | { deposit_id: string }
      | undefined;
    if (seen) return get(seen.deposit_id);

    const dep = get(id);
    // Retry CRM memakai requestId baru dengan STAN sama: setoran sudah diposting, jangan posting lagi.
    if (dep.status === "POSTED" && dep.stan === input.stan) return dep;
    if (!canConfirm(dep)) throw new DepositError("INVALID_STATE", `status ${dep.status} tidak bisa dikonfirmasi`);

    const at = now();
    db.prepare(
      "INSERT INTO host_requests (request_id, deposit_id, terminal_id, stan, created_at) VALUES (?, ?, ?, ?, ?)",
    ).run(input.requestId, id, dep.terminalId, input.stan, at);
    postDepositEntries(db, {
      terminalId: dep.terminalId,
      accountNo: dep.accountNo,
      amount: dep.amount,
      ref: `${dep.terminalId}/${input.stan}`,
      at,
    });
    db.prepare("UPDATE deposits SET status = 'POSTED', stan = ? WHERE id = ? AND status = 'COUNTED'").run(input.stan, id);
    return get(id);
  }

  function cancel(id: string): Deposit {
    const dep = get(id);
    if (dep.status === "POSTED") throw new DepositError("INVALID_STATE", "setoran yang sudah diposting tidak bisa dibatalkan");
    db.prepare("UPDATE deposits SET status = 'CANCELLED' WHERE id = ?").run(id);
    return get(id);
  }

  return { get, start, recordCount, confirm, cancel };
}

export type DepositService = ReturnType<typeof createDepositService>;
