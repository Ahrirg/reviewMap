import fs from 'node:fs';
import path from 'node:path';

import express from 'express';

import { CLIENT_DIST, MAP_DEFAULTS, TRUST_PROXY, UPLOADS_ROOT } from './config.js';
import { errorHandler, notFound } from './middleware/errors.js';
import { attachUser } from './middleware/session.js';
import markersRouter from './routes/markers.js';
import reviewsRouter from './routes/reviews.js';
import sessionRouter from './routes/session.js';
import { CATEGORY_LIST } from '../../shared/categories.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', TRUST_PROXY);

  // Small bodies only: every large payload arrives as multipart and is handled
  // by multer, never buffered into memory here.
  app.use(express.json({ limit: '64kb' }));
  app.use(express.urlencoded({ extended: false, limit: '64kb' }));

  /**
   * Uploaded media. acceptRanges lets the browser seek inside a video.
   * Filenames are unique and never rewritten, so the cache can be immutable.
   * The CSP and nosniff headers stop a stored file from being interpreted as
   * an active document if one ever slipped past the upload filter.
   */
  app.use(
    '/uploads',
    express.static(UPLOADS_ROOT, {
      index: false,
      redirect: false,
      dotfiles: 'deny',
      etag: true,
      lastModified: true,
      acceptRanges: true,
      maxAge: '30d',
      immutable: true,
      setHeaders(res) {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader(
          'Content-Security-Policy',
          "default-src 'none'; img-src 'self'; media-src 'self'; sandbox",
        );
      },
    }),
  );

  app.get('/api/health', (req, res) => {
    res.json({ ok: true, uptime: process.uptime() });
  });

  /** Lets the client render the legend without duplicating the category list. */
  app.get('/api/config', (req, res) => {
    res.json({ categories: CATEGORY_LIST, map: MAP_DEFAULTS });
  });

  // Mounted on /api rather than globally: verifying a cookie for every image
  // and video request under /uploads would be pure overhead, and that mount is
  // deliberately public anyway.
  app.use('/api', attachUser);

  app.use('/api/session', sessionRouter);
  app.use('/api/markers', markersRouter);
  app.use('/api/reviews', reviewsRouter);

  // Unknown /api paths stay JSON 404s instead of falling through to the SPA.
  app.use('/api', notFound);

  // The built client, when present. Without it only the API is served (dev
  // mode, where Vite serves the frontend).
  if (fs.existsSync(path.join(CLIENT_DIST, 'index.html'))) {
    app.use(express.static(CLIENT_DIST, { index: 'index.html' }));
    // Express 5 rejects a bare '*' path (path-to-regexp v8).
    app.get('/{*splat}', (req, res) => {
      res.sendFile(path.join(CLIENT_DIST, 'index.html'));
    });
  }

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
