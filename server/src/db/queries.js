import { getDb } from './index.js';

/**
 * Statements are prepared on first use and cached for the life of the process.
 * Preparing lazily keeps module import free of side effects, which matters
 * because the scripts in server/scripts import parts of this tree directly.
 */
const cache = new Map();

function prep(sql) {
  let statement = cache.get(sql);
  if (!statement) {
    statement = getDb().prepare(sql);
    cache.set(sql, statement);
  }
  return statement;
}

/**
 * One statement for the whole map. Correlated subqueries add just enough
 * context for a marker popup (latest reviewer, a text snippet, a thumbnail)
 * without ever loading full reviews or media lists.
 */
const LIST_MARKERS = `
  SELECT
    m.id,
    m.latitude,
    m.longitude,
    m.category,
    m.created_at AS createdAt,
    COUNT(r.id)  AS reviewCount,
    MAX(r.created_at) AS lastReviewAt,
    (SELECT r2.user_name FROM reviews r2
       WHERE r2.marker_id = m.id
       ORDER BY r2.created_at DESC, r2.id DESC LIMIT 1) AS lastReviewer,
    (SELECT substr(r3.text, 1, 120) FROM reviews r3
       WHERE r3.marker_id = m.id AND r3.text IS NOT NULL
       ORDER BY r3.created_at DESC, r3.id DESC LIMIT 1) AS previewText,
    (SELECT md.file_path FROM media md
       JOIN reviews r4 ON r4.id = md.review_id
       WHERE r4.marker_id = m.id AND md.type = 'image'
       ORDER BY md.id LIMIT 1) AS thumbPath
  FROM markers m
  LEFT JOIN reviews r ON r.marker_id = m.id
  GROUP BY m.id
  ORDER BY m.id
`;

export const listMarkers = () => prep(LIST_MARKERS).all();

export const getMarker = (id) =>
  prep('SELECT id, latitude, longitude, category, created_at AS createdAt FROM markers WHERE id = ?').get(id);

export const getReviewsByMarker = (markerId) =>
  prep(`
    SELECT id, marker_id AS markerId, user_name AS userName, text,
           created_at AS createdAt, author_account AS author
    FROM reviews WHERE marker_id = ?
    ORDER BY created_at ASC, id ASC
  `).all(markerId);

export const getReview = (id) =>
  prep(`
    SELECT id, marker_id AS markerId, user_name AS userName, text,
           created_at AS createdAt, author_account AS author
    FROM reviews WHERE id = ?
  `).get(id);

export const countReviews = (markerId) =>
  prep('SELECT COUNT(*) AS n FROM reviews WHERE marker_id = ?').get(markerId).n;

/** Media for a set of review ids, in one statement with generated placeholders. */
export function getMediaForReviews(reviewIds) {
  if (reviewIds.length === 0) return [];
  const placeholders = reviewIds.map(() => '?').join(',');
  return prep(`
    SELECT id, review_id AS reviewId, type, file_path AS filePath, original_name AS originalName
    FROM media WHERE review_id IN (${placeholders})
    ORDER BY id
  `).all(...reviewIds);
}

export const insertMarker = (latitude, longitude, category) =>
  prep(`
    INSERT INTO markers (latitude, longitude, category) VALUES (?, ?, ?)
    RETURNING id, latitude, longitude, category, created_at AS createdAt
  `).get(latitude, longitude, category);

/** author defaults to null so the seed script can keep calling this with three. */
export const insertReview = (markerId, userName, text, author = null) =>
  prep(`
    INSERT INTO reviews (marker_id, user_name, text, author_account) VALUES (?, ?, ?, ?)
    RETURNING id, marker_id AS markerId, user_name AS userName, text,
              created_at AS createdAt, author_account AS author
  `).get(markerId, userName, text, author);

export const insertMedia = (reviewId, type, filePath, originalName) =>
  prep(`
    INSERT INTO media (review_id, type, file_path, original_name) VALUES (?, ?, ?, ?)
    RETURNING id, review_id AS reviewId, type, file_path AS filePath, original_name AS originalName
  `).get(reviewId, type, filePath, originalName);

export const mediaPathsByMarker = (markerId) =>
  prep(`
    SELECT md.file_path AS filePath FROM media md
    JOIN reviews r ON r.id = md.review_id
    WHERE r.marker_id = ?
  `).all(markerId).map((row) => row.filePath);

export const mediaPathsByReview = (reviewId) =>
  prep('SELECT file_path AS filePath FROM media WHERE review_id = ?')
    .all(reviewId)
    .map((row) => row.filePath);

export const allMediaPaths = () =>
  prep('SELECT file_path AS filePath FROM media').all().map((row) => row.filePath);

export const deleteMarker = (id) => prep('DELETE FROM markers WHERE id = ?').run(id);
export const deleteReview = (id) => prep('DELETE FROM reviews WHERE id = ?').run(id);

export const counts = () =>
  prep(`
    SELECT
      (SELECT COUNT(*) FROM markers) AS markers,
      (SELECT COUNT(*) FROM reviews) AS reviews,
      (SELECT COUNT(*) FROM media)   AS media
  `).get();
