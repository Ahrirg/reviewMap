import { getDb } from '../db/index.js';
import * as q from '../db/queries.js';
import { forbidden, notFoundError } from '../middleware/errors.js';

/** Stored relative paths never leave this module; the API only sees URLs. */
const toUrl = (filePath) => (filePath ? `/uploads/${filePath}` : null);

function mapMedia(row) {
  return {
    id: row.id,
    type: row.type,
    url: toUrl(row.filePath),
    originalName: row.originalName,
  };
}

function mapReview(row, media = []) {
  return {
    id: row.id,
    markerId: row.markerId,
    userName: row.userName,
    // Null for reviews written before accounts existed. The client uses it to
    // decide whether to offer its author a delete button.
    author: row.author ?? null,
    text: row.text,
    createdAt: row.createdAt,
    media,
  };
}

function mapSummary(row) {
  return {
    id: row.id,
    latitude: row.latitude,
    longitude: row.longitude,
    category: row.category,
    createdAt: row.createdAt,
    reviewCount: row.reviewCount,
    lastReviewAt: row.lastReviewAt,
    lastReviewer: row.lastReviewer,
    previewText: row.previewText,
    thumbnailUrl: toUrl(row.thumbPath),
  };
}

export function listMarkers() {
  return q.listMarkers().map(mapSummary);
}

export function getMarkerDetail(id) {
  const marker = q.getMarker(id);
  if (!marker) throw notFoundError('Marker not found');

  const reviews = q.getReviewsByMarker(id);
  const mediaRows = q.getMediaForReviews(reviews.map((r) => r.id));

  const byReview = new Map();
  for (const row of mediaRows) {
    const list = byReview.get(row.reviewId);
    if (list) list.push(mapMedia(row));
    else byReview.set(row.reviewId, [mapMedia(row)]);
  }

  return {
    id: marker.id,
    latitude: marker.latitude,
    longitude: marker.longitude,
    category: marker.category,
    createdAt: marker.createdAt,
    reviewCount: reviews.length,
    reviews: reviews.map((r) => mapReview(r, byReview.get(r.id) ?? [])),
  };
}

/**
 * Marker plus optional first review plus its media, in a single transaction.
 * better-sqlite3 transactions are synchronous and roll back on throw, so a
 * marker can never be left behind without the review the caller asked for.
 */
function createMarkerTx({ latitude, longitude, category, review }) {
  const marker = q.insertMarker(latitude, longitude, category);
  if (review) {
    const created = q.insertReview(marker.id, review.author, review.text, review.author);
    for (const item of review.media) {
      q.insertMedia(created.id, item.type, item.relPath, item.originalName);
    }
  }
  return marker.id;
}

export function createMarker(input) {
  const run = getDb().transaction(createMarkerTx);
  const id = run(input);
  return getMarkerDetail(id);
}

function addReviewTx(markerId, { author, text, media }) {
  if (!q.getMarker(markerId)) throw notFoundError('Marker not found');
  const review = q.insertReview(markerId, author, text, author);
  const rows = media.map((item) =>
    q.insertMedia(review.id, item.type, item.relPath, item.originalName),
  );
  return { review, rows };
}

export function addReview(markerId, input) {
  const run = getDb().transaction(addReviewTx);
  const { review, rows } = run(markerId, input);
  return {
    review: mapReview(review, rows.map(mapMedia)),
    reviewCount: q.countReviews(markerId),
  };
}

/**
 * Delete a marker and return the media paths that are now unreferenced.
 * Paths are read before the delete, because the cascade removes the rows.
 * The caller unlinks the files only after the transaction has committed.
 */
export function deleteMarker(id) {
  const run = getDb().transaction((markerId) => {
    const paths = q.mediaPathsByMarker(markerId);
    const info = q.deleteMarker(markerId);
    if (info.changes === 0) throw notFoundError('Marker not found');
    return paths;
  });
  return run(id);
}

/**
 * Delete a review on behalf of `user`.
 *
 * The permission check lives here because the row it depends on is already
 * loaded inside the transaction; throwing rolls it back before anything is
 * written. Ownership is author_account, not user_name: a display name that
 * happens to match an account must not confer the right to delete.
 */
export function deleteReview(id, user) {
  const run = getDb().transaction((reviewId) => {
    const review = q.getReview(reviewId);
    if (!review) throw notFoundError('Review not found');
    if (user.role !== 'admin' && (review.author === null || review.author !== user.name)) {
      throw forbidden('You can only delete your own reviews');
    }
    const paths = q.mediaPathsByReview(reviewId);
    q.deleteReview(reviewId);
    return { paths, markerId: review.markerId };
  });
  return run(id);
}
