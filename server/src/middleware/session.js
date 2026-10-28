import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { findByName, sessionDays } from '../accounts.js';
import { COOKIE_SECURE, SESSION, SESSION_KEY_PATH } from '../config.js';
import { forbidden, unauthorized } from './errors.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Everyone who has not logged in. Frozen so a route cannot mutate it. */
export const GUEST = Object.freeze({ name: null, role: 'guest' });

/**
 * HMAC key for session cookies.
 *
 * It is written to disk because a key regenerated on every boot would log
 * everyone out on each restart, which is the opposite of remembering a login
 * for a month. SESSION_SECRET overrides it for deployments that keep secrets
 * somewhere other than the data directory.
 *
 * The exclusive-create flag matters: two processes booting at once must not
 * each write a different key, so whoever loses the race re-reads the winner's.
 */
function loadKey() {
  if (process.env.SESSION_SECRET) {
    return crypto.createHash('sha256').update(process.env.SESSION_SECRET, 'utf8').digest();
  }

  const read = () => {
    const stored = fs.readFileSync(SESSION_KEY_PATH);
    if (stored.length < 32) {
      throw new Error(`${SESSION_KEY_PATH} is too short to be a session key. Delete it to regenerate.`);
    }
    return stored;
  };

  try {
    return read();
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }

  fs.mkdirSync(path.dirname(SESSION_KEY_PATH), { recursive: true });
  try {
    const key = crypto.randomBytes(32);
    fs.writeFileSync(SESSION_KEY_PATH, key, { mode: 0o600, flag: 'wx' });
    return key;
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
    return read();
  }
}

let key = null;
const getKey = () => (key ??= loadKey());

/** Called at boot so a permissions problem is a startup failure, not a 500. */
export const initSessions = () => getKey();

const b64 = (value) => Buffer.from(value).toString('base64url');

const mac = (data) => crypto.createHmac('sha256', getKey()).update(data).digest();

/**
 * A stamp of the account's password that is safe to hand to a browser.
 *
 * Keyed with the session secret rather than being a bare hash of the password:
 * a plain sha256 prefix in a cookie would be an offline-crackable copy of the
 * password itself. Embedding it means that changing someone's password in
 * config.conf invalidates the cookie they already hold, with no session store.
 */
const stampOf = (account) =>
  crypto.createHmac('sha256', getKey()).update('pwstamp').update(account.digest).digest('base64url').slice(0, 22);

/** Express 5 can write cookies but never parses the request header. */
export function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    if (name === '' || name in out) continue;
    const raw = part.slice(eq + 1).trim();
    try {
      out[name] = decodeURIComponent(raw);
    } catch {
      out[name] = raw;
    }
  }
  return out;
}

function cookieOptions(req) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: COOKIE_SECURE || req.secure,
  };
}

export function issueSession(req, res, account) {
  const days = sessionDays();
  const expires = Date.now() + days * DAY_MS;
  const payload = b64(JSON.stringify({ n: account.name, e: expires, k: stampOf(account) }));
  const token = `${payload}.${b64(mac(payload))}`;
  // Express takes maxAge in milliseconds and writes both Max-Age and Expires.
  res.cookie(SESSION.cookieName, token, { ...cookieOptions(req), maxAge: days * DAY_MS });
  return expires;
}

export function clearSession(req, res) {
  res.clearCookie(SESSION.cookieName, cookieOptions(req));
}

function verify(token) {
  if (typeof token !== 'string' || token.length > SESSION.maxCookieBytes) return null;

  const dot = token.indexOf('.');
  if (dot < 1) return null;

  const payload = token.slice(0, dot);
  const provided = Buffer.from(token.slice(dot + 1), 'base64url');
  const expected = mac(payload);
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

/**
 * Resolve the session cookie into req.user, which is always set.
 *
 * The account is looked up in config.conf on every request rather than being
 * baked into the cookie, so editing a role there takes effect immediately and
 * deleting a line takes effect immediately too.
 */
export function attachUser(req, res, next) {
  req.user = GUEST;

  const token = parseCookies(req.headers.cookie)[SESSION.cookieName];
  if (!token) return next();

  const claims = verify(token);
  const account = claims && typeof claims.n === 'string' ? findByName(claims.n) : null;

  // A cookie that no longer resolves is cleared rather than left to be
  // re-checked on every request for the rest of the month.
  if (!account || !(claims.e > Date.now()) || claims.k !== stampOf(account)) {
    clearSession(req, res);
    return next();
  }

  req.user = { name: account.name, role: account.role };

  // Slide the expiry past halfway, so someone who keeps using the map is never
  // logged out in the middle of the month they were promised.
  const days = sessionDays();
  if (claims.e - Date.now() < (days * DAY_MS) / 2) issueSession(req, res, account);

  next();
}

/**
 * Guard a write route.
 *
 * 401 and 403 mean different things to the client: 401 is "you are a guest",
 * which sends the browser back to the login screen, while 403 is "your role
 * changed", which only refreshes the header.
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (req.user.name === null) throw unauthorized('Sign in to do that');
    if (!roles.includes(req.user.role)) throw forbidden('Your role does not allow that');
    next();
  };
}
