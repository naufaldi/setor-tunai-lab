import { openDb } from "../src/db.js";

const db = openDb(process.env.DB_PATH ?? "setor-tunai.db");
const accounts = [
  ["0123457781", "Nasabah A (dummy)"],
  ["0123450219", "Nasabah B (dummy)"],
  ["0123453350", "Nasabah C (dummy)"],
];
for (const [no, name] of accounts) {
  db.prepare("INSERT OR IGNORE INTO accounts (account_no, name) VALUES (?, ?)").run(no, name);
}
console.log(`seed: ${accounts.length} rekening dummy`);
