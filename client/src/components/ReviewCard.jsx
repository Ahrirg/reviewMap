import { formatAbsolute, formatRelative } from '../lib/format.js';

const initials = (name) =>
  String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase() || '?';

/**
 * One review: who wrote it, when, the text, and its media strip.
 * All user content renders as React children, so it is escaped structurally.
 */
export function ReviewCard({ review, onOpenMedia, onDelete, deleting }) {
  const media = review.media ?? [];

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
      <header className="flex items-start gap-2.5">
        <span
          aria-hidden="true"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-200 text-xs font-bold text-slate-600"
        >
          {initials(review.userName)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="break-anywhere text-sm font-semibold text-slate-900">
            {review.userName}
          </p>
          <time
            dateTime={review.createdAt}
            title={formatAbsolute(review.createdAt)}
            className="text-xs text-slate-400"
          >
            {formatRelative(review.createdAt)}
          </time>
        </div>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            aria-label={`Ištrinti ${review.userName} atsiliepimą`}
            className="shrink-0 rounded p-1.5 text-slate-300 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
          >
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                d="M4 6h12M8 6V4.5h4V6m-6 0v9.5A1.5 1.5 0 0 0 7.5 17h5a1.5 1.5 0 0 0 1.5-1.5V6"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </header>

      {review.text && (
        <p className="break-anywhere mt-2.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
          {review.text}
        </p>
      )}

      {media.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {media.map((item, index) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onOpenMedia(media, index)}
                className="group relative block h-20 w-20 overflow-hidden rounded-lg border border-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
                aria-label={
                  item.type === 'video' ? 'Atidaryti vaizdo įrašą' : 'Atidaryti nuotrauką'
                }
              >
                {item.type === 'video' ? (
                  <>
                    <video
                      src={item.url}
                      preload="metadata"
                      muted
                      playsInline
                      tabIndex={-1}
                      className="h-full w-full bg-slate-900 object-cover"
                    />
                    <span className="pointer-events-none absolute inset-0 grid place-items-center bg-slate-950/35 transition group-hover:bg-slate-950/20">
                      <svg width="22" height="22" viewBox="0 0 20 20" fill="white" aria-hidden="true">
                        <path d="M6 4.5v11l9-5.5-9-5.5z" />
                      </svg>
                    </span>
                  </>
                ) : (
                  <img
                    src={item.url}
                    alt={item.originalName ?? ''}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover transition group-hover:scale-105"
                  />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {!review.text && media.length === 0 && (
        <p className="mt-2 text-sm text-slate-400">Atsiliepimas be turinio.</p>
      )}
    </article>
  );
}
