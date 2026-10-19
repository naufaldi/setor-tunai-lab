import { randomUUID } from "node:crypto";
import type { Db } from "./db.js";
import {
  canConfirm,
  countAmount,
  DepositError,
  validateAccountNo,
  validateActor,
  validateReason,
  validateStan,
  validateTerminalId,
  type Deposit,
  type NoteCount,
} from "./domain/deposit.js";
import { hasEntries, postDepositEntries, postReversalEntries } from "./ledger.js";

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

  function inTransaction<T>(fn: () => T): T {
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      db.exec("COMMIT");
      return result;
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  }

  function recordEvent(
    depositId: string,
    action: "PENDING" | "RESOLVED" | "REVERSED",
    input: { actor: string; reason: string },
    at: string,
  ): void {
    db.prepare(
      "INSERT INTO deposit_events (deposit_id, action, actor, reason, created_at) VALUES (?, ?, ?, ?, ?)",
    ).run(depositId, action, input.actor, input.reason, at);
  }

  // Setoran COUNTED yang belum jelas hasilnya di host (timeout) ditandai PENDING. Ledger tidak disentuh.
  function markPending(id: string, input: { actor: string; reason: string }): Deposit {
    validateActor(input.actor);
    validateReason(input.reason);
    return inTransaction(() => {
      const dep = get(id);
      if (dep.status === "PENDING") return dep;
      if (dep.status !== "COUNTED") throw new DepositError("INVALID_STATE", `status ${dep.status} tidak bisa ditandai pending`);
      db.prepare("UPDATE deposits SET status = 'PENDING' WHERE id = ? AND status = 'COUNTED'").run(id);
      recordEvent(id, "PENDING", input, now());
      return get(id);
    });
  }

  // Semua STAN yang pernah tercatat untuk setoran ini: dari host_requests dan deposits.stan, tanpa duplikat.
  function knownStans(depositId: string): string[] {
    const rows = db
      .prepare(
        "SELECT stan FROM host_requests WHERE deposit_id = ? UNION SELECT stan FROM deposits WHERE id = ? AND stan IS NOT NULL",
      )
      .all(depositId, depositId) as { stan: string }[];
    return rows.map((r) => r.stan);
  }

  // Hasil akhir di host sudah jelas berhasil: PENDING menjadi POSTED, ledger tidak diposting dua kali.
  function resolve(id: string, input: { actor: string; reason: string; stan: string }): Deposit {
    validateActor(input.actor);
    validateReason(input.reason);
    if (typeof input.stan !== "string") throw new DepositError("INVALID_STAN", "STAN harus string 6 digit");
    validateStan(input.stan);
    return inTransaction(() => {
      const dep = get(id);
      if (dep.status === "POSTED" && dep.stan === input.stan) return dep;
      if (dep.status !== "PENDING") throw new DepositError("INVALID_STATE", `status ${dep.status} tidak bisa di-resolve`);
      const known = knownStans(id);
      if (known.length > 0 && !known.includes(input.stan)) {
        throw new DepositError("INVALID_STATE", "STAN tidak sesuai dengan STAN yang sudah tercatat untuk setoran ini");
      }
      const at = now();
      const alreadyPosted = known.some((s) => hasEntries(db, `${dep.terminalId}/${s}`));
      if (!alreadyPosted) {
        postDepositEntries(db, {
          terminalId: dep.terminalId,
          accountNo: dep.accountNo,
          amount: dep.amount,
          ref: `${dep.terminalId}/${input.stan}`,
          at,
        });
      }
      db.prepare("UPDATE deposits SET status = 'POSTED', stan = ? WHERE id = ? AND status = 'PENDING'").run(input.stan, id);
      recordEvent(id, "RESOLVED", input, at);
      return get(id);
    });
  }

  // Hasil akhir di host gagal: PENDING menjadi REVERSED. Entri ledger asli dibalik lewat entri baru (insert-only).
  function reverse(id: string, input: { actor: string; reason: string }): Deposit {
    validateActor(input.actor);
    validateReason(input.reason);
    return inTransaction(() => {
      const dep = get(id);
      if (dep.status === "REVERSED") return dep;
      if (dep.status !== "PENDING") throw new DepositError("INVALID_STATE", `status ${dep.status} tidak bisa dibalik`);
      const at = now();
      for (const stan of knownStans(id)) {
        postReversalEntries(db, `${dep.terminalId}/${stan}`, at);
      }
      db.prepare("UPDATE deposits SET status = 'REVERSED' WHERE id = ? AND status = 'PENDING'").run(id);
      recordEvent(id, "REVERSED", input, at);
      return get(id);
    });
  }

  function cancel(id: string): Deposit {
    const dep = get(id);
    if (dep.status === "POSTED") throw new DepositError("INVALID_STATE", "setoran yang sudah diposting tidak bisa dibatalkan");
    if (dep.status === "PENDING" || dep.status === "REVERSED") {
      throw new DepositError("INVALID_STATE", `status ${dep.status} tidak bisa dibatalkan`);
    }
    db.prepare("UPDATE deposits SET status = 'CANCELLED' WHERE id = ?").run(id);
    return get(id);
  }

  return { get, start, recordCount, confirm, cancel, markPending, resolve, reverse };
}

export type DepositService = ReturnType<typeof createDepositService>;
