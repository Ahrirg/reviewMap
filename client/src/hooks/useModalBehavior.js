import { useEffect, useId, useRef } from 'react';

/**
 * A module-level stack of open modal ids. Only the topmost modal reacts to
 * Escape, so closing a lightbox opened from a drawer does not close both.
 */
const stack = [];

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function focusableWithin(root) {
  if (!root) return [];
  return Array.from(root.querySelectorAll(FOCUSABLE)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  );
}

/**
 * Escape handling, focus trapping, focus restore and body scroll lock.
 *
 * Escape is handled in the capture phase and its propagation stopped, so
 * Leaflet never sees the key and cannot close a popup or cancel a drag
 * underneath the dialog.
 */
export function useModalBehavior({ open, onClose, panelRef, closable = true }) {
  const id = useId();
  const restoreRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // Track the open stack.
  useEffect(() => {
    if (!open) return undefined;
    stack.push(id);
    return () => {
      const index = stack.lastIndexOf(id);
      if (index !== -1) stack.splice(index, 1);
    };
  }, [open, id]);

  // Escape closes the topmost modal only.
  useEffect(() => {
    if (!open || !closable) return undefined;

    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      if (stack[stack.length - 1] !== id) return;
      event.preventDefault();
      event.stopPropagation();
      closeRef.current?.();
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [open, closable, id]);

  // Trap Tab inside the panel.
  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key !== 'Tab') return;
      if (stack[stack.length - 1] !== id) return;

      const items = focusableWithin(panelRef.current);
      if (items.length === 0) {
        event.preventDefault();
        panelRef.current?.focus();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !panelRef.current?.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [open, id, panelRef]);

  // Move focus in on open, restore it on close.
  useEffect(() => {
    if (!open) return undefined;

    restoreRef.current = document.activeElement;
    const panel = panelRef.current;
    const timer = window.setTimeout(() => {
      const target =
        panel?.querySelector('[data-autofocus]') ?? focusableWithin(panel)[0] ?? panel;
      target?.focus?.();
    }, 0);

    return () => {
      window.clearTimeout(timer);
      const previous = restoreRef.current;
      if (previous && typeof previous.focus === 'function' && document.contains(previous)) {
        previous.focus();
      }
    };
  }, [open, panelRef]);

  // Lock body scroll while anything is open.
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      if (stack.length === 0) document.body.style.overflow = previous;
    };
  }, [open]);
}

/**
 * Click-outside that requires both press and release on the backdrop, so text
 * selected inside the panel and released outside does not close the dialog.
 */
export function useBackdropDismiss(onClose, enabled = true) {
  const pressedOnBackdrop = useRef(false);

  return {
    onMouseDown: (event) => {
      pressedOnBackdrop.current = event.target === event.currentTarget;
    },
    onMouseUp: (event) => {
      const shouldClose =
        enabled && pressedOnBackdrop.current && event.target === event.currentTarget;
      pressedOnBackdrop.current = false;
      if (shouldClose) onClose?.();
    },
  };
}
