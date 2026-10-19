import { DatabaseSync } from "node:sqlite";

export type Db = DatabaseSync;

export function openDb(path = ":memory:"): Db {
  const db = new DatabaseSync(path);
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      account_no TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS deposits (
      id TEXT PRIMARY KEY,
      terminal_id TEXT NOT NULL,
      account_no TEXT NOT NULL REFERENCES accounts(account_no),
      status TEXT NOT NULL,
      notes_json TEXT NOT NULL DEFAULT '[]',
      rejected_notes INTEGER NOT NULL DEFAULT 0,
      amount INTEGER NOT NULL DEFAULT 0,
      stan TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS host_requests (
      request_id TEXT PRIMARY KEY,
      deposit_id TEXT NOT NULL REFERENCES deposits(id),
      terminal_id TEXT NOT NULL,
      stan TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ledger_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_no TEXT NOT NULL,
      direction TEXT NOT NULL CHECK (direction IN ('CR','DR')),
      amount INTEGER NOT NULL CHECK (amount > 0),
      ref TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS deposit_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deposit_id TEXT NOT NULL REFERENCES deposits(id),
      action TEXT NOT NULL,
      actor TEXT NOT NULL,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  return db;
}
