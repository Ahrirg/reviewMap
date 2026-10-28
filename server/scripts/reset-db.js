#!/usr/bin/env node
/**
 * Delete the SQLite database so the next boot recreates an empty schema.
 *
 *   npm run db:reset              drop the database, keep uploaded files
 *   npm run db:reset -- --uploads drop the database and every uploaded file
 *
 * Stop the server first: an open WAL connection will simply recreate the files.
 */
import fs from 'node:fs';
import path from 'node:path';

import { DB_PATH, UPLOAD_DIRS } from '../src/config.js';

const alsoUploads = process.argv.includes('--uploads');

let removed = 0;
for (const suffix of ['', '-wal', '-shm']) {
  const target = `${DB_PATH}${suffix}`;
  if (fs.existsSync(target)) {
    fs.rmSync(target);
    console.log(`Removed ${target}`);
    removed += 1;
  }
}
if (removed === 0) {
  console.log(`No database found at ${DB_PATH}. Nothing to do.`);
}

if (alsoUploads) {
  let files = 0;
  for (const dir of Object.values(UPLOAD_DIRS)) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (name.startsWith('.')) continue;
      fs.rmSync(path.join(dir, name), { force: true });
      files += 1;
    }
  }
  console.log(`Removed ${files} uploaded file(s).`);
} else {
  console.log('Uploaded files were kept. Re-run with --uploads to delete them too.');
}

console.log('Start the server to recreate an empty database.');
