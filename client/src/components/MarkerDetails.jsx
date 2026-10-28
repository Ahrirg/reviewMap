import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { CATEGORIES, DEFAULT_CATEGORY } from '@shared/categories.js';

import { formatAbsolute, formatCoords, pluralReviews } from '../lib/format.js';
import { Button, ErrorBanner, Spinner } from './Modal.jsx';
import { CategoryGlyph } from './CategoryGlyph.jsx';
import { ReviewCard } from './ReviewCard.jsx';
import { useBackdropDismiss, useModalBehavior } from '../hooks/useModalBehavior.js';
import { useSession } from '../hooks/useSession.jsx';

/**
 * Full marker view: every review with its author, timestamp and media.
 * A right-hand drawer on desktop, a bottom sheet on small screens. Rendered
 * through a portal, so it sits outside the map container entirely.
 */
export function MarkerDetails({
  open,
  marker,
  detail,
  loading,
  error,
  onClose,
  onAddReview,
  onOpenMedia,
  onDeleteMarker,
  onDeleteReview,
}) {
  // Read straight from context rather than through props: this component is
  // portalled, and React context crosses a portal just fine.
  const { canCreate, canDeleteMarker, canDeleteReview } = useSession();
  const panelRef = useRef(null);
  const [confirmingMarker, setConfirmingMarker] = useState(false);
  const [busyReviewId, setBusyReviewId] = useState(null);
  const [actionError, setActionError] = useState(null);

  useModalBehavior({ open, onClose, panelRef });
  const backdropProps = useBackdropDismiss(onClose);

  if (!open || !marker) return null;

  const category = CATEGORIES[marker.category] ?? CATEGORIES[DEFAULT_CATEGORY];
  const reviews = detail?.reviews ?? [];
  const count = detail?.reviewCount ?? marker.reviewCount ?? 0;

  const removeMarker = async () => {
    setActionError(null);
    try {
      await onDeleteMarker(marker.id);
    } catch (err) {
      setConfirmingMarker(false);
      setActionError(err.message || 'Nepavyko ištrinti žymeklio.');
    }
  };

  const removeReview = async (reviewId) => {
    setActionError(null);
    setBusyReviewId(reviewId);
    try {
      await onDeleteReview(marker.id, reviewId);
    } catch (err) {
      setActionError(err.message || 'Nepavyko ištrinti atsiliepimo.');
    } finally {
      setBusyReviewId(null);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[1500] flex justify-end bg-slate-950/40 backdrop-blur-[1px]"
      {...backdropProps}
    >
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${category.label} žymeklio informacija`}
        tabIndex={-1}
        className="flex h-full w-full max-w-md flex-col bg-slate-50 shadow-2xl outline-none"
      >
        <header className="shrink-0 text-white" style={{ background: category.color }}>
          <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <CategoryGlyph category={category.id} size={20} />
                {category.label}
              </h2>
              <p className="mt-1 font-mono text-xs text-white/80">
                {formatCoords(marker.latitude, marker.longitude)}
              </p>
              <p className="text-xs text-white/70">
                Sukurta {formatAbsolute(detail?.createdAt ?? marker.createdAt)}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              data-autofocus
              aria-label="Uždaryti"
              className="-mr-1 shrink-0 rounded-lg p-2 text-white/80 transition hover:bg-white/20 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 bg-black/12 px-5 py-2.5">
            <span className="text-sm font-medium">
              Atsiliepimai · {pluralReviews(count)}
            </span>
            {canCreate && (
              <button
                type="button"
                onClick={() => onAddReview(marker)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/95 px-3 py-1.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <span aria-hidden="true" className="text-base leading-none">+</span>
                Pridėti
              </button>
            )}
          </div>
        </header>

        <div className="rm-scroll min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 py-4">
          <ErrorBanner message={actionError} onDismiss={() => setActionError(null)} />

          {loading && reviews.length === 0 && (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
              <Spinner /> Kraunama…
            </div>
          )}

          {error && !loading && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {!loading && !error && reviews.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center">
              <p className="text-sm text-slate-500">Šis žymeklis dar neturi atsiliepimų.</p>
              {canCreate ? (
                <Button variant="primary" className="mt-3" onClick={() => onAddReview(marker)}>
                  Parašyti pirmą
                </Button>
              ) : (
                <p className="mt-2 text-xs text-slate-400">
                  Prisijunkite, kad galėtumėte pridėti atsiliepimą.
                </p>
              )}
            </div>
          )}

          {reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              deleting={busyReviewId === review.id}
              onOpenMedia={onOpenMedia}
              onDelete={canDeleteReview(review) ? () => removeReview(review.id) : undefined}
            />
          ))}
        </div>

        {canDeleteMarker && (
        <footer className="shrink-0 border-t border-slate-200 bg-white px-4 py-3">
          {confirmingMarker ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-slate-700">
                Ištrinti žymeklį ir visus jo atsiliepimus?
              </span>
              <span className="flex gap-2">
                <Button onClick={() => setConfirmingMarker(false)}>Ne</Button>
                <Button variant="danger" onClick={removeMarker}>
                  Taip, ištrinti
                </Button>
              </span>
            </div>
          ) : (
            <Button variant="danger" onClick={() => setConfirmingMarker(true)}>
              Ištrinti žymeklį
            </Button>
          )}
        </footer>
        )}
      </aside>
    </div>,
    document.body,
  );
}
