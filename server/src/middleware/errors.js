import fs from 'node:fs';

/** An error with an HTTP status that is safe to show to the client. */
export class ApiError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.expose = status < 500;
    Object.assign(this, extra);
  }
}

export const badRequest = (message, extra) => new ApiError(400, message, extra);
export const notFoundError = (message = 'Not found') => new ApiError(404, message);
export const unauthorized = (message = 'Sign in required', extra) => new ApiError(401, message, extra);
export const forbidden = (message = 'Not allowed', extra) => new ApiError(403, message, extra);

/** Every absolute path multer wrote for this request. */
export function collectUploadPaths(req) {
  const groups = req.files ?? {};
  const list = Array.isArray(groups) ? groups : Object.values(groups).flat();
  return list.map((f) => f?.path).filter(Boolean);
}

export function notFound(req, res) {
  res.status(404).json({ error: 'Not found' });
}

/**
 * Central error handler.
 *
 * Multer has to consume the request stream before a route body can read any
 * field, so uploaded files are already on disk by the time validation runs.
 * Every write route sets res.locals.keepUploads = true the moment its database
 * transaction commits; anything that fails before that point gets its files
 * removed here, so a rejected request never leaves an orphan behind.
 */
export function errorHandler(err, req, res, next) {
  if (!res.locals.keepUploads) {
    for (const filePath of collectUploadPaths(req)) {
      fs.unlink(filePath, () => {});
    }
  }

  const status = Number.isInteger(err.status) && err.status >= 400 ? err.status : 500;

  if (status >= 500) {
    console.error('[error]', req.method, req.originalUrl, err);
  }

  if (res.headersSent) {
    return next(err);
  }

  res.status(status).json({
    error: err.expose && err.message ? err.message : 'Internal server error',
    ...(err.field ? { field: err.field } : {}),
  });
}
