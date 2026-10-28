#!/usr/bin/env node
/**
 * Report, and optionally delete, uploaded files that no media row references.
 *
 *   npm run uploads:gc            list orphans only
 *   npm run uploads:gc -- --clean delete them
 */
import fs from 'node:fs';

import { getDb, ensureDirectories } from '../src/db/index.js';
import * as q from '../src/db/queries.js';
import { findOrphans, resolveUploadPath } from '../src/services/fileService.js';

const clean = process.argv.includes('--clean');

ensureDirectories();
const db = getDb();

const referenced = q.allMediaPaths();
const orphans = findOrphans(referenced);

console.log(`${referenced.length} file(s) referenced by the database.`);

if (orphans.length === 0) {
  console.log('No orphaned uploads found.');
} else {
  console.log(`${orphans.length} orphaned file(s):`);
  for (const rel of orphans) console.log(`  ${rel}`);
  if (clean) {
    let deleted = 0;
    for (const rel of orphans) {
      try {
        fs.rmSync(resolveUploadPath(rel), { force: true });
        deleted += 1;
      } catch (err) {
        console.error(`  failed to delete ${rel}: ${err.message}`);
      }
    }
    console.log(`Deleted ${deleted} file(s).`);
  } else {
    console.log('Re-run with --clean to delete them.');
  }
}

// Files referenced by a row but missing from disk: a broken thumbnail in the UI.
const missing = referenced.filter((rel) => {
  try {
    return !fs.existsSync(resolveUploadPath(rel));
  } catch {
    return true;
  }
});
if (missing.length > 0) {
  console.log(`Warning: ${missing.length} media row(s) point at a missing file:`);
  for (const rel of missing) console.log(`  ${rel}`);
}

db.close();
