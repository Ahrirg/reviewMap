import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useBackdropDismiss, useModalBehavior } from '../hooks/useModalBehavior.js';

/**
 * Full-screen lightbox for one review's media.
 * Images fit the viewport; videos get native controls, and because the server
 * serves uploads with Accept-Ranges the player can seek.
 */
export function MediaViewer({ items, index, onClose, onIndexChange }) {
  const panelRef = useRef(null);
  const open = Array.isArray(items) && items.length > 0 && index != null;

  useModalBehavior({ open, onClose, panelRef });
  const backdropProps = useBackdropDismiss(onClose);

  const step = useCallback(
    (delta) => {
      if (!open) return;
      const next = (index + delta + items.length) % items.length;
      onIndexChange(next);
    },
    [open, index, items, onIndexChange],
  );

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        step(1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        step(-1);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, step]);

  if (!open) return null;

  const item = items[index];
  const multiple = items.length > 1;

  return createPortal(
    <div
      className="fixed inset-0 z-[2500] flex flex-col bg-slate-950/92 p-3 sm:p-6"
      {...backdropProps}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 text-white">
        <p className="break-anywhere min-w-0 truncate text-sm text-white/70">
          {item.originalName ?? (item.type === 'video' ? 'Vaizdo įrašas' : 'Nuotrauka')}
          {multiple && <span className="ml-2 text-white/50">{index + 1} / {items.length}</span>}
        </p>
        <button
          type="button"
          onClick={onClose}
          data-autofocus
          aria-label="Uždaryti"
          className="rounded-lg p-2 text-white/80 transition hover:bg-white/15 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div
        ref={panelRef}
        tabIndex={-1}
        className="flex min-h-0 flex-1 items-center justify-center gap-2 outline-none"
        onMouseDown={(event) => event.stopPropagation()}
        onMouseUp={(event) => event.stopPropagation()}
      >
        {multiple && (
          <NavButton direction="prev" onClick={() => step(-1)} />
        )}

        {item.type === 'video' ? (
          <video
            key={item.url}
            src={item.url}
            controls
            autoPlay
            playsInline
            preload="metadata"
            className="max-h-full max-w-full rounded-lg bg-black"
          />
        ) : (
          <img
            key={item.url}
            src={item.url}
            alt={item.originalName ?? ''}
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        )}

        {multiple && <NavButton direction="next" onClick={() => step(1)} />}
      </div>
    </div>,
    document.body,
  );
}

function NavButton({ direction, onClick }) {
  const isPrev = direction === 'prev';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isPrev ? 'Ankstesnis' : 'Kitas'}
      className="shrink-0 rounded-full bg-white/10 p-2.5 text-white transition hover:bg-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path
          d={isPrev ? 'M12.5 4L6.5 10l6 6' : 'M7.5 4l6 6-6 6'}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
