import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';

import { ALLOWED, LIMITS, REJECTED_HINTS, UPLOAD_DIRS, UPLOAD_SUBDIR } from '../config.js';
import { ApiError } from './errors.js';

const mb = (bytes) => Math.round(bytes / (1024 * 1024));

/** Field name decides the media kind, so an image cannot sneak in as a video. */
const kindOf = (fieldname) => (fieldname === 'video' ? 'video' : 'image');

function generateFilename(originalName, kind) {
  const raw = path.extname(String(originalName ?? '')).toLowerCase();
  // Only ever use an extension from the allowlist. The client's filename is
  // never reused, which removes any path traversal or overwrite concern.
  const ext = ALLOWED[kind].exts.includes(raw) ? raw : ALLOWED[kind].exts[0];
  return `${Date.now().toString(36)}-${crypto.randomBytes(8).toString('hex')}${ext}`;
}

/**
 * Custom storage engine.
 *
 * Multer supports a single global fileSize limit, but this app needs 10 MB for
 * images and 100 MB for videos in the same request. Counting bytes as they
 * arrive lets an oversized image be aborted mid-stream rather than written in
 * full and rejected afterwards.
 */
const perTypeStorage = {
  _handleFile(req, file, cb) {
    const kind = kindOf(file.fieldname);
    const dir = UPLOAD_DIRS[kind];
    const filename = generateFilename(file.originalname, kind);
    const fullPath = path.join(dir, filename);
    const max = LIMITS.bytes[kind];

    const out = fs.createWriteStream(fullPath);
    let bytes = 0;
    let settled = false;

    const fail = (err) => {
      if (settled) return;
      settled = true;
      file.stream.unpipe(out);
      file.stream.resume(); // drain, so busboy never stalls
      out.destroy();
      fs.unlink(fullPath, () => cb(err));
    };

    file.stream.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > max) {
        const err = new ApiError(
          413,
          `${kind === 'video' ? 'Video' : 'Image'} is too large. The limit is ${mb(max)} MB.`,
          { field: file.fieldname },
        );
        fail(err);
      }
    });

    file.stream.on('error', fail);
    out.on('error', fail);

    out.on('finish', () => {
      if (settled) return;
      settled = true;
      cb(null, {
        destination: dir,
        filename,
        path: fullPath,
        relPath: `${UPLOAD_SUBDIR[kind]}/${filename}`,
        size: bytes,
        kind,
      });
    });

    file.stream.pipe(out);
  },

  _removeFile(req, file, cb) {
    fs.unlink(file.path, () => cb(null));
  },
};

function fileFilter(req, file, cb) {
  const kind = kindOf(file.fieldname);
  const ext = path.extname(String(file.originalname ?? '')).toLowerCase();
  const mime = String(file.mimetype ?? '').split(';')[0].trim().toLowerCase();

  const hint = REJECTED_HINTS[mime];
  if (hint) {
    return cb(new ApiError(400, hint, { field: file.fieldname }));
  }

  if (!ALLOWED[kind].mimes.includes(mime) || !ALLOWED[kind].exts.includes(ext)) {
    return cb(
      new ApiError(
        400,
        `Unsupported ${kind} type. Allowed: ${ALLOWED[kind].exts.join(', ')}`,
        { field: file.fieldname },
      ),
    );
  }

  cb(null, true);
}

const runUpload = multer({
  storage: perTypeStorage,
  fileFilter,
  limits: {
    // Backstop above the per-type counting done in the storage engine.
    fileSize: Math.max(LIMITS.bytes.image, LIMITS.bytes.video),
    files: LIMITS.maxImages + LIMITS.maxVideos,
    fields: 20,
    fieldSize: 64 * 1024,
    parts: 40,
    headerPairs: 100,
  },
}).fields([
  { name: 'image', maxCount: LIMITS.maxImages },
  { name: 'video', maxCount: LIMITS.maxVideos },
]);

const MULTER_STATUS = {
  LIMIT_FILE_SIZE: 413,
  LIMIT_FILE_COUNT: 400,
  LIMIT_UNEXPECTED_FILE: 400,
  LIMIT_PART_COUNT: 400,
  LIMIT_FIELD_COUNT: 400,
  LIMIT_FIELD_VALUE: 413,
  LIMIT_FIELD_KEY: 400,
};

function friendlyMulterMessage(err) {
  switch (err.code) {
    case 'LIMIT_FILE_SIZE':
      return `That file is too large. Images are limited to ${mb(LIMITS.bytes.image)} MB and videos to ${mb(LIMITS.bytes.video)} MB.`;
    case 'LIMIT_FILE_COUNT':
      return `Too many files. Up to ${LIMITS.maxImages} images and ${LIMITS.maxVideos} videos per review.`;
    case 'LIMIT_UNEXPECTED_FILE':
      return `Unexpected file field "${err.field}". Use "image" or "video".`;
    default:
      return `Upload rejected (${err.code}).`;
  }
}

/**
 * Runs multer only for multipart requests, so a plain JSON body reaches the
 * route untouched, and converts multer's own errors into ApiError.
 */
export function maybeUpload(req, res, next) {
  if (!req.is('multipart/form-data')) return next();

  runUpload(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      const status = MULTER_STATUS[err.code] ?? 400;
      return next(new ApiError(status, friendlyMulterMessage(err), { field: err.field }));
    }
    next(err);
  });
}
