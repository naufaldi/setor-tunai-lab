import { DepositError } from "./deposit.js";
import { DAILY_DEPOSIT_LIMIT, formatRupiah } from "./money.js";

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000; // WIB tetap UTC+7, tanpa DST
const DAY_MS = 24 * 60 * 60 * 1000;

// Batas hari WIB yang memuat waktu `iso`, dalam ISO UTC: [fromUtc, toUtc).
export function wibDayBounds(iso: string): { fromUtc: string; toUtc: string } {
  const wibMs = new Date(iso).getTime() + WIB_OFFSET_MS;
  const fromMs = Math.floor(wibMs / DAY_MS) * DAY_MS - WIB_OFFSET_MS;
  return { fromUtc: new Date(fromMs).toISOString(), toUtc: new Date(fromMs + DAY_MS).toISOString() };
}

export function assertWithinDailyLimit(used: number, amount: number): void {
  if (used + amount > DAILY_DEPOSIT_LIMIT) {
    const sisa = Math.max(0, DAILY_DEPOSIT_LIMIT - used);
    throw new DepositError(
      "DAILY_LIMIT_EXCEEDED",
      `batas setoran harian terlampaui, sisa kuota hari ini ${formatRupiah(sisa)}`,
    );
  }
}
