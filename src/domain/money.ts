// Nominal uang kertas yang diterima mesin CRM (ilustrasi).
export const DENOMINATIONS = [100_000, 50_000] as const;
export type Denomination = (typeof DENOMINATIONS)[number];

export const MAX_NOTES_PER_DEPOSIT = 200;

export function isDenomination(value: number): value is Denomination {
  return (DENOMINATIONS as readonly number[]).includes(value);
}

export function formatRupiah(amount: number): string {
  return "Rp " + amount.toLocaleString("id-ID");
}
