import express from 'express';

import { findByPassword, sessionDays } from '../accounts.js';
import { LOGIN_THROTTLE } from '../config.js';
import { ApiError, badRequest, unauthorized } from '../middleware/errors.js';
import { clearSession, issueSession } from '../middleware/session.js';

const router = express.Router();

/**
 * Failed logins per address.
 *
 * The password is the whole credential here, so an unthrottled endpoint is a
 * real brute-force target. A Map swept on write is enough for a community map;
 * it keys on req.ip, which only means anything when TRUST_PROXY matches the
 * deployment. Behind a misconfigured proxy this degrades to one global counter
 * rather than to no limit at all.
 */
const failures = new Map();

function sweep(now) {
  for (const [ip, entry] of failures) {
    if (entry.until <= now) failures.delete(ip);
  }
}

function isBlocked(ip, now) {
  const entry = failures.get(ip);
  return Boolean(entry && entry.count >= LOGIN_THROTTLE.attempts && entry.until > now);
}

function recordFailure(ip, now) {
  const entry = failures.get(ip);
  if (!entry || entry.until <= now) {
    failures.set(ip, { count: 1, until: now + LOGIN_THROTTLE.windowMs });
  } else {
    entry.count += 1;
    entry.until = now + LOGIN_THROTTLE.windowMs;
  }
}

/** Who the caller is. Never 401s: a guest is an answer, not an error. */
router.get('/', (req, res) => {
  res.json({ name: req.user.name, role: req.user.role, sessionDays: sessionDays() });
});

router.post('/', (req, res) => {
  const now = Date.now();
  const ip = req.ip ?? 'unknown';
  sweep(now);

  if (isBlocked(ip, now)) {
    throw new ApiError(429, 'Too many attempts. Try again in a few minutes.');
  }

  const password = req.body?.password;
  if (typeof password !== 'string' || password === '') {
    throw badRequest('A password is required', { field: 'password' });
  }

  const account = findByPassword(password);
  if (!account) {
    recordFailure(ip, now);
    throw unauthorized('Wrong password', { field: 'password' });
  }

  failures.delete(ip);
  issueSession(req, res, account);
  res.json({ name: account.name, role: account.role, sessionDays: sessionDays() });
});

router.delete('/', (req, res) => {
  clearSession(req, res);
  res.status(204).end();
});

export default router;
