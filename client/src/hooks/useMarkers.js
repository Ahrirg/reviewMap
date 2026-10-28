import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchMarkers } from '../api/markers.js';

/** Collapse a freshly created detail response into the map's summary shape. */
function toSummary(detail) {
  const reviews = detail.reviews ?? [];
  const last = reviews[reviews.length - 1];
  const firstImage = reviews.flatMap((r) => r.media ?? []).find((m) => m.type === 'image');

  return {
    id: detail.id,
    latitude: detail.latitude,
    longitude: detail.longitude,
    category: detail.category,
    createdAt: detail.createdAt,
    reviewCount: reviews.length,
    lastReviewAt: last?.createdAt ?? null,
    lastReviewer: last?.userName ?? null,
    previewText: last?.text ? last.text.slice(0, 120) : null,
    thumbnailUrl: firstImage?.url ?? null,
  };
}

/**
 * The marker list for the map.
 *
 * Every mutation updates local state directly rather than refetching, so the
 * map never flickers and never loses its centre or zoom.
 */
export function useMarkers() {
  const [markers, setMarkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const data = await fetchMarkers({ signal: controller.signal });
      setMarkers(data);
      setError(null);
    } catch (err) {
      if (err?.name === 'AbortError') return;
      setError(err.message || 'Nepavyko įkelti žymeklių.');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    return () => abortRef.current?.abort();
  }, [load]);

  const addMarker = useCallback((detail) => {
    const summary = toSummary(detail);
    setMarkers((prev) => [...prev, summary]);
    return summary;
  }, []);

  /** Fold a newly added review into the summary row for its marker. */
  const applyReview = useCallback((markerId, review) => {
    setMarkers((prev) =>
      prev.map((m) => {
        if (m.id !== markerId) return m;
        const image = (review.media ?? []).find((item) => item.type === 'image');
        return {
          ...m,
          reviewCount: m.reviewCount + 1,
          lastReviewAt: review.createdAt,
          lastReviewer: review.userName,
          previewText: review.text ? review.text.slice(0, 120) : m.previewText,
          thumbnailUrl: m.thumbnailUrl ?? image?.url ?? null,
        };
      }),
    );
  }, []);

  const decrementReviewCount = useCallback((markerId) => {
    setMarkers((prev) =>
      prev.map((m) =>
        m.id === markerId ? { ...m, reviewCount: Math.max(0, m.reviewCount - 1) } : m,
      ),
    );
  }, []);

  const removeMarker = useCallback((id) => {
    setMarkers((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const restoreMarker = useCallback((summary) => {
    setMarkers((prev) =>
      prev.some((m) => m.id === summary.id)
        ? prev
        : [...prev, summary].sort((a, b) => a.id - b.id),
    );
  }, []);

  return {
    markers,
    loading,
    error,
    reload: load,
    addMarker,
    applyReview,
    decrementReviewCount,
    removeMarker,
    restoreMarker,
  };
}
