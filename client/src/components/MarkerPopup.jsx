import { CATEGORIES, DEFAULT_CATEGORY } from '@shared/categories.js';

import { formatCoords, formatRelative, pluralReviews } from '../lib/format.js';
import { CategoryGlyph } from './CategoryGlyph.jsx';
import { useSession } from '../hooks/useSession.jsx';

/**
 * Compact preview shown after a single click on a marker.
 * Rendered into the Leaflet popup's content node through a React portal, so
 * these are ordinary React handlers. Leaflet already stops clicks inside a
 * popup from reaching the map.
 */
export function MarkerPopup({ marker, onOpenDetails, onAddReview, onClose }) {
  // react-leaflet's Popup is a portal too, so context reaches this component.
  const { canCreate } = useSession();
  const category = CATEGORIES[marker.category] ?? CATEGORIES[DEFAULT_CATEGORY];

  return (
    <div className="w-full">
      <div
        className="flex items-center justify-between gap-2 rounded-t-xl px-3 py-2 text-white"
        style={{ background: category.color }}
      >
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          <CategoryGlyph category={category.id} size={15} />
          {category.label}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Uždaryti"
          className="rounded p-0.5 text-white/80 transition hover:bg-white/20 hover:text-white"
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="px-3 py-2.5">
        <p className="text-xs font-medium text-slate-500">
          {pluralReviews(marker.reviewCount)}
          {marker.lastReviewAt && <> · {formatRelative(marker.lastReviewAt)}</>}
        </p>

        {marker.thumbnailUrl && (
          <img
            src={marker.thumbnailUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="mt-2 h-24 w-full rounded-lg object-cover"
          />
        )}

        {marker.previewText ? (
          <p className="break-anywhere mt-2 line-clamp-3 text-sm text-slate-700">
            {marker.lastReviewer && (
              <span className="font-semibold text-slate-900">{marker.lastReviewer}: </span>
            )}
            {marker.previewText}
          </p>
        ) : (
          <p className="mt-2 text-sm text-slate-400">
            {marker.reviewCount > 0 ? 'Atsiliepimas be teksto.' : 'Dar nėra atsiliepimų.'}
          </p>
        )}

        <p className="mt-2 font-mono text-[11px] text-slate-400">
          {formatCoords(marker.latitude, marker.longitude)}
        </p>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onOpenDetails}
            className="flex-1 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
          >
            Peržiūrėti
          </button>
          {canCreate && (
            <button
              type="button"
              onClick={onAddReview}
              title="Pridėti atsiliepimą"
              aria-label="Pridėti atsiliepimą"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              +
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
