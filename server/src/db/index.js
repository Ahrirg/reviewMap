import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

import { DB_PATH, UPLOAD_DIRS } from '../config.js';
import { CATEGORY_SQL_LIST } from '../../../shared/categories.js';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Create every directory the app writes to, before anything opens a file. */
export function ensureDirectories() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  for (const dir of Object.values(UPLOAD_DIRS)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadSchemaSql() {
  const raw = fs.readFileSync(path.join(here, 'schema.sql'), 'utf8');
  return raw.replaceAll('__CATEGORIES__', CATEGORY_SQL_LIST);
}

/**
 * Verify the persisted CHECK constraint still matches shared/categories.js.
 * CREATE TABLE IF NOT EXISTS silently keeps an old definition, so a category
 * added later would be rejected at INSERT time with a confusing error. Fail
 * loudly at boot instead.
 */
function assertCategoryConstraint(db) {
  const row = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'markers'")
    .get();
  if (!row?.sql) return;
  const stored = row.sql.replace(/\s+/g, '');
  const expected = `category IN (${CATEGORY_SQL_LIST})`.replace(/\s+/g, '');
  if (!stored.includes(expected)) {
    throw new Error(
      'The markers.category CHECK constraint in the database does not match ' +
        'shared/categories.js. The category list changed after the database was ' +
        'created. Run "npm run db:reset" (this deletes existing markers) or ' +
        'migrate the table manually.',
    );
  }
}

/**
 * Add a column that schema.sql declares but an existing database lacks.
 *
 * CREATE TABLE IF NOT EXISTS silently keeps whatever definition is already in
 * the file, so a column added later never reaches a database created before
 * it. ALTER TABLE ADD COLUMN is the one migration SQLite makes cheap, and it
 * is enough as long as the column is nullable with no default.
 */
function ensureColumn(db, table, column, definition) {
  if (db.pragma(`table_info(${table})`).some((c) => c.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

export function openDatabase(dbPath = DB_PATH) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);

  // Order matters: WAL first, then per-connection pragmas. foreign_keys is NOT
  // persisted in the file, so it has to be set on every single connection.
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');
  db.pragma('busy_timeout = 5000');

  db.exec(loadSchemaSql());
  ensureColumn(db, 'reviews', 'author_account', 'TEXT');
  assertCategoryConstraint(db);

  return db;
}

let instance = null;

/** Lazily opened process-wide connection. */
export function getDb() {
  if (!instance) {
    ensureDirectories();
    instance = openDatabase();
  }
  return instance;
}

export function closeDb() {
  if (instance) {
    instance.close();
    instance = null;
  }
}
