import { isDenomination, MAX_NOTES_PER_DEPOSIT, type Denomination } from "./money.js";

export type DepositStatus = "OPEN" | "COUNTED" | "PENDING" | "POSTED" | "REVERSED" | "CANCELLED";

export interface NoteCount {
  denom: Denomination;
  qty: number;
}

export interface Deposit {
  id: string;
  terminalId: string;
  accountNo: string;
  status: DepositStatus;
  notes: NoteCount[];
  rejectedNotes: number;
  amount: number;
  stan: string | null;
  createdAt: string;
}

export class DepositError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

export function validateTerminalId(terminalId: string): void {
  if (!/^ATM-\d{4}$/.test(terminalId)) {
    throw new DepositError("INVALID_TERMINAL", `terminal_id tidak valid: ${terminalId}`);
  }
}

export function validateAccountNo(accountNo: string): void {
  if (!/^\d{10}$/.test(accountNo)) {
    throw new DepositError("INVALID_ACCOUNT", "nomor rekening harus 10 digit");
  }
}

export function validateStan(stan: string): void {
  if (!/^\d{6}$/.test(stan)) {
    throw new DepositError("INVALID_STAN", "STAN harus 6 digit");
  }
}

export const REASON_MAX_LENGTH = 200;

export function validateActor(actor: unknown): asserts actor is string {
  if (typeof actor !== "string" || actor.trim() === "") {
    throw new DepositError("INVALID_ACTOR", "actor wajib diisi");
  }
}

export function validateReason(reason: unknown): asserts reason is string {
  if (typeof reason !== "string" || reason.trim() === "") {
    throw new DepositError("INVALID_REASON", "reason wajib diisi");
  }
  if (reason.length > REASON_MAX_LENGTH) {
    throw new DepositError("INVALID_REASON", `reason maksimal ${REASON_MAX_LENGTH} karakter`);
  }
}

export function countAmount(notes: { denom: number; qty: number }[]): number {
  let total = 0;
  let sheets = 0;
  for (const n of notes) {
    if (!isDenomination(n.denom)) {
      throw new DepositError("INVALID_DENOM", `nominal tidak diterima: ${n.denom}`);
    }
    if (!Number.isInteger(n.qty) || n.qty < 0) {
      throw new DepositError("INVALID_QTY", "jumlah lembar harus bilangan bulat >= 0");
    }
    sheets += n.qty;
    total += n.denom * n.qty;
  }
  if (sheets === 0) {
    throw new DepositError("EMPTY", "tidak ada uang yang terhitung");
  }
  if (sheets > MAX_NOTES_PER_DEPOSIT) {
    throw new DepositError("TOO_MANY_NOTES", `maksimal ${MAX_NOTES_PER_DEPOSIT} lembar per setoran`);
  }
  return total;
}

export function canConfirm(deposit: Deposit): boolean {
  return deposit.status === "COUNTED" && deposit.amount > 0;
}
