import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchMarkerDetail } from '../api/markers.js';

/**
 * Loads and caches the full review list for one marker at a time.
 *
 * The cache survives closing and reopening the drawer, so a marker that was
 * already viewed reappears instantly while a background refresh runs.
 */
export function useMarkerDetails(markerId) {
  const cache = useRef(new Map());
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const load = useCallback(async (id, { silent = false } = {}) => {
    if (id == null) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await fetchMarkerDetail(id, { signal: controller.signal });
      cache.current.set(id, data);
      setDetail(data);
    } catch (err) {
      if (err?.name === 'AbortError') return;
      setError(err.message || 'Nepavyko įkelti atsiliepimų.');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (markerId == null) {
      abortRef.current?.abort();
      setDetail(null);
      setError(null);
      setLoading(false);
      return undefined;
    }

    const cached = cache.current.get(markerId);
    if (cached) {
      setDetail(cached);
      setLoading(false);
      load(markerId, { silent: true });
    } else {
      setDetail(null);
      load(markerId);
    }

    return () => abortRef.current?.abort();
  }, [markerId, load]);

  /** Seed the cache from a create response so the drawer opens with no fetch. */
  const prime = useCallback((data) => {
    if (data?.id != null) cache.current.set(data.id, data);
  }, []);

  const applyReview = useCallback((id, review) => {
    const current = cache.current.get(id);
    if (!current) return;
    const next = {
      ...current,
      reviewCount: (current.reviewCount ?? current.reviews.length) + 1,
      reviews: [...current.reviews, review],
    };
    cache.current.set(id, next);
    setDetail((prev) => (prev?.id === id ? next : prev));
  }, []);

  const removeReview = useCallback((id, reviewId) => {
    const current = cache.current.get(id);
    if (!current) return;
    const reviews = current.reviews.filter((r) => r.id !== reviewId);
    const next = { ...current, reviews, reviewCount: reviews.length };
    cache.current.set(id, next);
    setDetail((prev) => (prev?.id === id ? next : prev));
  }, []);

  const forget = useCallback((id) => {
    cache.current.delete(id);
  }, []);

  const refresh = useCallback(() => load(markerId), [load, markerId]);

  return { detail, loading, error, refresh, prime, applyReview, removeReview, forget };
}
