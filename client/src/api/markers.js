import { del, getJson, sendJson, uploadWithProgress } from './client.js';

/** Summaries for the whole map: one request, no per-marker fetching. */
export const fetchMarkers = (options) => getJson('/api/markers', options);

/** Full detail, loaded only when a marker is opened. */
export const fetchMarkerDetail = (id, options) => getJson(`/api/markers/${id}`, options);

export const fetchConfig = (options) => getJson('/api/config', options);

function buildFormData(fields, files) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null && value !== '') {
      form.append(key, value);
    }
  }
  for (const file of files.images) form.append('image', file, file.name);
  for (const file of files.videos) form.append('video', file, file.name);
  return form;
}

const hasFiles = (files) => files.images.length > 0 || files.videos.length > 0;

/**
 * Create a marker, optionally with its first review.
 * Sends JSON when nothing is attached and multipart when files are present, so
 * a text-only marker never pays for a multipart round trip or a progress bar.
 */
export function createMarker({ latitude, longitude, category, text, files }, options = {}) {
  const media = files ?? { images: [], videos: [] };

  if (!hasFiles(media)) {
    return sendJson(
      '/api/markers',
      { latitude, longitude, category, text: text || undefined },
      { signal: options.signal },
    );
  }

  const form = buildFormData({ latitude, longitude, category, text }, media);
  return uploadWithProgress('/api/markers', form, options);
}

/**
 * Add a review to an existing marker. Returns { review, reviewCount }.
 * The author is stamped from the session cookie, never sent from here.
 */
export function createReview(markerId, { text, files }, options = {}) {
  const media = files ?? { images: [], videos: [] };
  const url = `/api/markers/${markerId}/reviews`;

  if (!hasFiles(media)) {
    return sendJson(url, { text: text || undefined }, { signal: options.signal });
  }

  const form = buildFormData({ text }, media);
  return uploadWithProgress(url, form, options);
}

export const deleteMarker = (id) => del(`/api/markers/${id}`);
export const deleteReview = (id) => del(`/api/reviews/${id}`);
