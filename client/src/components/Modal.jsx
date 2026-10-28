import { useId, useRef } from 'react';
import { createPortal } from 'react-dom';

import { useBackdropDismiss, useModalBehavior } from '../hooks/useModalBehavior.js';

/**
 * The single dialog primitive.
 *
 * Rendered through a portal to document.body, so it sits entirely outside
 * .leaflet-container and its clicks can never reach the map's click handler.
 */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
  closable = true,
  labelledBy,
}) {
  const panelRef = useRef(null);
  const generatedId = useId();
  const titleId = labelledBy ?? `${generatedId}-title`;

  useModalBehavior({ open, onClose, panelRef, closable });
  const backdropProps = useBackdropDismiss(onClose, closable);

  if (!open) return null;

  const widths = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-5xl',
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[2000] flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      {...backdropProps}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={`flex max-h-[92vh] w-full ${widths[size]} flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl outline-none sm:rounded-2xl`}
      >
        {title && (
          <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div className="min-w-0">
              <h2 id={titleId} className="text-base font-semibold text-slate-900">
                {title}
              </h2>
              {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
            </div>
            {closable && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Uždaryti"
                className="-mr-1 -mt-1 shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path
                    d="M5 5l10 10M15 5L5 15"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            )}
          </header>
        )}

        <div className="rm-scroll min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer && (
          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}

export function Button({
  variant = 'secondary',
  className = '',
  type = 'button',
  children,
  ...rest
}) {
  const base =
    'inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-55';
  const variants = {
    primary:
      'bg-slate-900 text-white hover:bg-slate-800 focus-visible:ring-slate-500',
    secondary:
      'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus-visible:ring-slate-400',
    danger:
      'border border-red-200 bg-white text-red-600 hover:bg-red-50 focus-visible:ring-red-400',
    ghost: 'text-slate-600 hover:bg-slate-100 focus-visible:ring-slate-400',
  };
  return (
    <button type={type} className={`${base} ${variants[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function Spinner({ className = 'h-4 w-4' }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ErrorBanner({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="mb-3 flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
    >
      <span className="break-anywhere">{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Slėpti klaidą"
          className="shrink-0 rounded p-0.5 text-red-400 hover:text-red-700"
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
}

export function ProgressBar({ value }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div className="mt-3">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-slate-900 transition-[width] duration-150"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-slate-500" aria-live="polite">
        {pct < 100 ? `Įkeliama… ${pct}%` : 'Apdorojama…'}
      </p>
    </div>
  );
}
