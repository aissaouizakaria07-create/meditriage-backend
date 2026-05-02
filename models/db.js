const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, '..', 'meditriage.db');
const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Create tables ─────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name        TEXT NOT NULL,
    email       TEXT NOT NULL UNIQUE,
    password    TEXT NOT NULL,
    is_guest    INTEGER DEFAULT 0,
    is_google   INTEGER DEFAULT 0,
    age         TEXT DEFAULT '',
    sex         TEXT DEFAULT '',
    blood_type  TEXT DEFAULT '',
    allergies   TEXT DEFAULT '',
    conditions  TEXT DEFAULT '',
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id       TEXT NOT NULL,
    chat_id       TEXT NOT NULL,
    share_id      TEXT NOT NULL UNIQUE,
    share_enabled INTEGER DEFAULT 0,
    lang          TEXT DEFAULT 'fr',
    symptoms      TEXT DEFAULT '',
    conditions    TEXT DEFAULT '[]',
    messages      TEXT DEFAULT '[]',
    created_at    TEXT DEFAULT (datetime('now')),
    updated_at    TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS reminders (
    id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id     TEXT NOT NULL,
    med_name    TEXT NOT NULL,
    dosage      TEXT DEFAULT '',
    time        TEXT NOT NULL,
    frequency   TEXT DEFAULT 'daily',
    active      INTEGER DEFAULT 1,
    created_at  TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS moods (
    id      TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    emoji   TEXT NOT NULL,
    label   TEXT NOT NULL,
    score   INTEGER NOT NULL,
    note    TEXT DEFAULT '',
    date    TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// ── Helper to generate IDs ────────────────────────────────────────────────────
function newId() {
  return uuidv4().replace(/-/g, '');
}

module.exports = { db, newId };
