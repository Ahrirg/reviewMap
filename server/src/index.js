import { accountCount, loadAccounts } from './accounts.js';
import { createApp } from './app.js';
import { CONFIG_PATH, HOST, PORT, DB_PATH, UPLOADS_ROOT } from './config.js';
import { ensureDirectories, getDb } from './db/index.js';
import { initSessions } from './middleware/session.js';
import * as q from './db/queries.js';
import { findOrphans } from './services/fileService.js';

ensureDirectories();

// Opening eagerly means a schema problem is a startup failure, not a 500 on
// the first request. The same reasoning applies to the accounts file and the
// session key: a typo in config.conf should stop the boot, not surface later
// as a mysterious inability to log in.
getDb();
loadAccounts();
initSessions();

const app = createApp();

const server = app.listen(PORT, HOST, () => {
  const { markers, reviews, media } = q.counts();
  const orphans = findOrphans(q.allMediaPaths()).length;

  console.log(`ReviewMap API listening on http://${HOST}:${PORT}`);
  console.log(`  database : ${DB_PATH}`);
  console.log(`  uploads  : ${UPLOADS_ROOT}`);
  console.log(`  accounts : ${accountCount()} from ${CONFIG_PATH}`);
  console.log(`  contents : ${markers} markers, ${reviews} reviews, ${media} media files`);
  if (orphans > 0) {
    console.log(`  note     : ${orphans} unreferenced upload(s); run "npm run uploads:gc" to remove`);
  }
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
