import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Repository root: server/src -> server -> <root> */
export const ROOT_DIR = path.resolve(here, '..', '..');

export const PORT = Number(process.env.PORT) || 3001;
export const HOST = process.env.HOST || '127.0.0.1';

/**
 * Set to the number of reverse proxies in front of this server. It has to be
 * right for two things to work behind nginx or Caddy: req.ip (the login
 * throttle keys on it) and req.secure (which decides the Secure cookie flag).
 */
export const TRUST_PROXY = process.env.TRUST_PROXY
  ? Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY
  : false;

export const DATA_DIR = path.join(ROOT_DIR, 'data');
export const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(DATA_DIR, 'app.db');

export const UPLOADS_ROOT = path.join(ROOT_DIR, 'uploads');
export const UPLOAD_DIRS = {
  image: path.join(UPLOADS_ROOT, 'images'),
  video: path.join(UPLOADS_ROOT, 'videos'),
};

/** Relative directory name stored in media.file_path, keyed by media type. */
export const UPLOAD_SUBDIR = { image: 'images', video: 'videos' };

const MB = 1024 * 1024;

export const LIMITS = {
  bytes: {
    image: Number(process.env.MAX_IMAGE_BYTES) || 10 * MB,
    video: Number(process.env.MAX_VIDEO_BYTES) || 100 * MB,
  },
  maxImages: 5,
  maxVideos: 2,
  userNameLength: 60,
  textLength: 2000,
};

/**
 * Allowed upload types. Video formats are restricted to what browsers can play
 * natively in a <video> element, so an uploaded file is always viewable.
 */
export const ALLOWED = {
  image: {
    exts: ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'],
    mimes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'],
  },
  video: {
    exts: ['.mp4', '.webm', '.ogv', '.ogg', '.m4v'],
    mimes: ['video/mp4', 'video/webm', 'video/ogg', 'video/x-m4v'],
  },
};

/** Types we explicitly recognise but reject, with a helpful explanation. */
export const REJECTED_HINTS = {
  'video/quicktime': 'QuickTime (.mov) cannot be played by most browsers. Please convert to MP4 or WebM.',
  'video/x-msvideo': 'AVI cannot be played by browsers. Please convert to MP4 or WebM.',
  'image/heic': 'HEIC images are not supported by most browsers. Please convert to JPEG or PNG.',
  'image/heif': 'HEIF images are not supported by most browsers. Please convert to JPEG or PNG.',
};

export const MAP_DEFAULTS = {
  center: { latitude: 54.8985, longitude: 23.9036 },
  zoom: 13,
};

/** Accounts file: one "name: password, role" line per person. */
export const CONFIG_PATH = process.env.CONFIG_PATH
  ? path.resolve(process.env.CONFIG_PATH)
  : path.join(ROOT_DIR, 'config.conf');

/** HMAC key for session cookies, generated on first boot when absent. */
export const SESSION_KEY_PATH = path.join(DATA_DIR, 'session.key');

export const SESSION = {
  cookieName: 'reviewmap_session',
  defaultDays: 30,
  maxDays: 365,
  /** Longest token attachUser will even try to verify. */
  maxCookieBytes: 512,
};

/** Force the Secure cookie flag on. Otherwise it follows req.secure. */
export const COOKIE_SECURE = process.env.COOKIE_SECURE === '1';

/** Failed logins tolerated per address before the endpoint starts refusing. */
export const LOGIN_THROTTLE = { attempts: 10, windowMs: 5 * 60 * 1000 };
