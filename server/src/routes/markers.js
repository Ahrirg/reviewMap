import express from 'express';

import { requireRole } from '../middleware/session.js';
import { maybeUpload } from '../middleware/upload.js';
import * as service from '../services/markerService.js';
import { safeUnlinkAll } from '../services/fileService.js';
import {
  assertReviewHasContent,
  collectMedia,
  parseCategory,
  parseId,
  parseLatitude,
  parseLongitude,
  parseOptionalReview,
  parseReviewText,
} from '../validation.js';

const router = express.Router();

/** Summaries for the whole map in a single request. */
router.get('/', (req, res) => {
  res.json(service.listMarkers());
});

/** Full detail, loaded only when a marker is opened. */
router.get('/:id', (req, res) => {
  const id = parseId(req.params.id, 'marker id');
  res.json(service.getMarkerDetail(id));
});

/**
 * Create a marker, optionally with its first review and media.
 * Accepts JSON when there are no files, multipart/form-data when there are.
 *
 * The role guard runs before multer on purpose: rejecting afterwards would
 * mean a guest could still make the server write a 100 MB video to disk.
 */
router.post('/', requireRole('reviewer', 'admin'), maybeUpload, (req, res) => {
  const body = req.body ?? {};
  const latitude = parseLatitude(body.latitude);
  const longitude = parseLongitude(body.longitude);
  const category = parseCategory(body.category);

  const media = collectMedia(req);
  const parsed = parseOptionalReview(body, media);
  // The author always comes from the session; a userName in the body is ignored.
  const review = parsed && { ...parsed, author: req.user.name };

  const detail = service.createMarker({ latitude, longitude, category, review });

  // The transaction committed, so the uploaded files are now referenced and
  // must survive. Anything failing before this point gets them cleaned up.
  res.locals.keepUploads = true;
  res.status(201).json(detail);
});

/** Add a review to an existing marker. */
router.post('/:id/reviews', requireRole('reviewer', 'admin'), maybeUpload, (req, res) => {
  const markerId = parseId(req.params.id, 'marker id');
  const body = req.body ?? {};

  const text = parseReviewText(body.text);
  const media = collectMedia(req);
  assertReviewHasContent(text, media);

  const result = service.addReview(markerId, { author: req.user.name, text, media });

  res.locals.keepUploads = true;
  res.status(201).json(result);
});

/** Markers are admin-only deletes: removing one takes everyone's reviews with it. */
router.delete('/:id', requireRole('admin'), async (req, res) => {
  const id = parseId(req.params.id, 'marker id');
  const paths = service.deleteMarker(id);
  await safeUnlinkAll(paths);
  res.status(204).end();
});

export default router;
