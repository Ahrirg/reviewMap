import crypto from 'node:crypto';
import fs from 'node:fs';

import { CONFIG_PATH, LIMITS, SESSION } from './config.js';

/** Roles a config.conf line may name. Everyone else is a read-only guest. */
export const ROLES = ['admin', 'reviewer'];

/** How long a parsed file is trusted before the mtime is checked again. */
const RECHECK_MS = 1000;

/** Account names end up in reviews.user_name, which is single-line text. */
function hasControlChar(value) {
  for (const ch of value) {
    const code = ch.codePointAt(0);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

const sha256 = (value) => crypto.createHash('sha256').update(String(value), 'utf8').digest();

function emptyConfig() {
  return { accounts: [], byName: new Map(), sessionDays: SESSION.defaultDays };
}

function fail(lineNo, message) {
  throw new Error(`${CONFIG_PATH}:${lineNo}: ${message}`);
}

function readOption(config, key, value, lineNo) {
  if (key !== 'session_days') {
    fail(lineNo, `unknown option "${key}". The only option is session_days.`);
  }
  const days = Number(value);
  if (!Number.isFinite(days) || days < 1 || days > SESSION.maxDays) {
    fail(lineNo, `session_days must be a whole number between 1 and ${SESSION.maxDays}.`);
  }
  config.sessionDays = Math.floor(days);
}

function readAccount(config, seenPasswords, name, value, lineNo) {
  if (name === '') fail(lineNo, 'the account name is empty.');
  if (hasControlChar(name)) fail(lineNo, `"${name}" contains a control character.`);
  if (name.length > LIMITS.userNameLength) {
    fail(lineNo, `"${name}" is longer than ${LIMITS.userNameLength} characters.`);
  }

  // Split at the LAST comma so a password may contain commas of its own.
  const comma = value.lastIndexOf(',');
  if (comma === -1) fail(lineNo, `"${name}" has no role. Expected "name: password, role".`);

  const password = value.slice(0, comma).trim();
  const role = value.slice(comma + 1).trim().toLowerCase();

  if (password === '') fail(lineNo, `"${name}" has an empty password.`);
  if (!ROLES.includes(role)) {
    fail(lineNo, `"${name}" has role "${role}". Expected one of: ${ROLES.join(', ')}.`);
  }
  if (config.byName.has(name)) fail(lineNo, `"${name}" is defined twice.`);

  const twin = seenPasswords.get(password);
  if (twin) {
    fail(
      lineNo,
      `"${name}" and "${twin}" share a password. The password alone identifies a ` +
        'person here, so it has to be unique.',
    );
  }

  // Only the digest is kept. middleware/session.js derives the cookie's
  // password stamp from it, keyed with the session secret, so nothing derived
  // from the plaintext password is ever handed to a browser.
  const account = { name, role, digest: sha256(password) };
  config.accounts.push(account);
  config.byName.set(name, account);
  seenPasswords.set(password, name);
}

/**
 * Parse the contents of config.conf.
 *
 * Only whole-line comments are recognised, so a password is free to contain #
 * or ; without being silently truncated. [accounts] is the implicit section,
 * which makes a bare list of "name: password, role" lines a valid file.
 */
export function parseConfig(text) {
  const config = emptyConfig();
  const seenPasswords = new Map();
  let section = 'accounts';

  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const lineNo = i + 1;
    const line = lines[i].trim();

    if (line === '' || line.startsWith('#') || line.startsWith(';')) continue;

    if (line.startsWith('[') && line.endsWith(']')) {
      section = line.slice(1, -1).trim().toLowerCase();
      if (section !== 'accounts' && section !== 'options') {
        fail(lineNo, `unknown section [${section}]. Expected [accounts] or [options].`);
      }
      continue;
    }

    const colon = line.indexOf(':');
    if (colon === -1) fail(lineNo, 'expected "name: password, role".');

    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();

    if (section === 'options') readOption(config, key, value, lineNo);
    else readAccount(config, seenPasswords, key, value, lineNo);
  }

  return config;
}

let cached = null;
let stamp = '';
let checkedAt = 0;
let warnedMissing = false;

function stampOf() {
  try {
    const info = fs.statSync(CONFIG_PATH);
    return `${info.mtimeMs}:${info.size}`;
  } catch (err) {
    if (err.code === 'ENOENT') return '';
    throw err;
  }
}

function read(current) {
  if (current === '') {
    if (!warnedMissing) {
      console.warn(
        `[accounts] ${CONFIG_PATH} does not exist, so everyone is a read-only ` +
          'guest. Copy config.example.conf to config.conf to add people.',
      );
      warnedMissing = true;
    }
    return emptyConfig();
  }
  warnedMissing = false;
  return parseConfig(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

/**
 * The current accounts, re-read whenever config.conf changes on disk.
 *
 * A reload that fails to parse keeps the accounts already in memory and logs
 * the problem: a typo saved into the file must never lock everyone out of a
 * running server. The boot-time load is stricter, see loadAccounts.
 */
export function getConfig() {
  const now = Date.now();
  if (cached && now - checkedAt < RECHECK_MS) return cached;
  checkedAt = now;

  const current = stampOf();
  if (cached && current === stamp) return cached;

  try {
    cached = read(current);
  } catch (err) {
    if (!cached) throw err;
    console.error(`[accounts] keeping the previous accounts: ${err.message}`);
  }
  // Recorded either way, so a broken file is not re-read every second.
  stamp = current;
  return cached;
}

/** Boot-time load. Unlike a reload, a parse error here is meant to be fatal. */
export function loadAccounts() {
  cached = null;
  stamp = stampOf();
  cached = read(stamp);
  checkedAt = Date.now();
  return cached;
}

/**
 * Resolve a password to its account, or null.
 *
 * Every account is compared and there is no early return, so how long this
 * takes does not depend on which account matched or where in the file it sits.
 * timingSafeEqual needs equal lengths, which SHA-256 digests always have.
 */
export function findByPassword(password) {
  const candidate = sha256(password ?? '');
  let match = null;
  for (const account of getConfig().accounts) {
    if (crypto.timingSafeEqual(candidate, account.digest)) match = account;
  }
  return match;
}

export const findByName = (name) => getConfig().byName.get(name) ?? null;

export const sessionDays = () => getConfig().sessionDays;

export const accountCount = () => getConfig().accounts.length;
