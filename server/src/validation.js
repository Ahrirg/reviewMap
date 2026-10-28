import { CATEGORY_IDS, isCategory } from '../../shared/categories.js';
import { LIMITS } from './config.js';
import { badRequest } from './middleware/errors.js';
// Strip C0 control characters and DEL. Tab and newline are kept so multi-line
// review text survives.
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function parseId(raw, what = 'id') {
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) {
    throw badRequest(`Invalid ${what}`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw badRequest(`Invalid ${what}`);
  }
  return value;
}

function parseCoordinate(raw, field, min, max) {
  if (raw === undefined || raw === null || raw === '') {
    throw badRequest(`${field} is required`, { field });
  }
  // multipart/form-data delivers every field as a string.
  const value = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isFinite(value)) {
    throw badRequest(`${field} must be a number`, { field });
  }
  if (value < min || value > max) {
    throw badRequest(`${field} must be between ${min} and ${max}`, { field });
  }
  return value;
}

export const parseLatitude = (raw) => parseCoordinate(raw, 'latitude', -90, 90);
export const parseLongitude = (raw) => parseCoordinate(raw, 'longitude', -180, 180);

export function parseCategory(raw) {
  const value = typeof raw === 'string' ? raw.trim() : raw;
  if (!isCategory(value)) {
    throw badRequest(`Invalid category. Expected one of: ${CATEGORY_IDS.join(', ')}`, {
      field: 'category',
    });
  }
  return value;
}

/** Returns the trimmed review text, or null when nothing usable was sent. */
export function parseReviewText(raw) {
  if (raw === undefined || raw === null) return null;
  const value = String(raw).replace(CONTROL_CHARS, '').trim();
  if (!value) return null;
  if (value.length > LIMITS.textLength) {
    throw badRequest(`Review text must be ${LIMITS.textLength} characters or fewer`, {
      field: 'text',
    });
  }
  return value;
}

/**
 * Normalises multer's req.files into the shape the marker service inserts.
 * The custom storage engine attaches `kind` and `relPath` to each file.
 */
export function collectMedia(req) {
  const groups = req.files ?? {};
  const files = Array.isArray(groups) ? groups : Object.values(groups).flat();
  return files.filter(Boolean).map((f) => ({
    type: f.kind,
    relPath: f.relPath,
    originalName: f.originalname ? String(f.originalname).slice(0, 255) : null,
  }));
}

/** A review needs at least one of: text, an image, a video. */
export function assertReviewHasContent(text, media) {
  if (!text && media.length === 0) {
    throw badRequest('A review needs text, an image or a video');
  }
}

/**
 * Pulls an optional initial review out of a create-marker request body.
 *
 * Text or media is the whole signal now: the author is no longer sent by the
 * client, it is stamped from the session, so there is no such thing as a
 * partial review to reject. The caller adds the author to what comes back.
 */
export function parseOptionalReview(body, media) {
  const text = parseReviewText(body.text);
  if (!text && media.length === 0) return null;
  return { text, media };
}
