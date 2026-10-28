import L from 'leaflet';

import { CATEGORIES, DEFAULT_CATEGORY } from '@shared/categories.js';

/**
 * One DivIcon instance per category, created once and shared by every marker.
 * Leaflet's createIcon() builds a fresh DOM node per marker, so sharing the
 * instance is safe and avoids allocating an icon on every render.
 */
const iconCache = new Map();

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[ch]);

function pinHtml(category, { count = 0 } = {}) {
  const badge =
    count > 1 ? `<span class="rm-pin__count">${count > 99 ? '99+' : count}</span>` : '';
  // Inline SVG, not an emoji: a machine with no colour-emoji font would
  // otherwise draw an empty box in every pin.
  const glyph =
    `<svg class="rm-pin__glyph" viewBox="0 0 24 24" width="15" height="15" ` +
    `aria-hidden="true" focusable="false">${category.glyph}</svg>`;
  return `<span class="rm-pin__body" style="--pin:${category.color}">${glyph}</span>${badge}`;
}

/**
 * A marker icon for a category. Icons that need a review-count badge or the
 * selected outline are built per marker, so they are cached by a composite key.
 */
export function categoryIcon(categoryId, { count = 0, active = false } = {}) {
  const category = CATEGORIES[categoryId] ?? CATEGORIES[DEFAULT_CATEGORY];
  const badge = count > 1 ? Math.min(count, 100) : 0;
  const key = `${category.id}|${badge}|${active ? 1 : 0}`;

  let icon = iconCache.get(key);
  if (!icon) {
    icon = L.divIcon({
      // Our own className replaces Leaflet's `leaflet-div-icon` white box.
      className: `rm-pin${active ? ' rm-pin--active' : ''}`,
      html: pinHtml(category, { count }),
      iconSize: [30, 30],
      iconAnchor: [15, 28],
      popupAnchor: [0, -26],
      tooltipAnchor: [16, -16],
    });
    iconCache.set(key, icon);
  }
  return icon;
}

/** Accessible label for a marker, used as the title and aria-label. */
export function markerLabel(marker) {
  const category = CATEGORIES[marker.category] ?? CATEGORIES[DEFAULT_CATEGORY];
  const count = marker.reviewCount ?? 0;
  const reviews = count === 1 ? '1 atsiliepimas' : `${count} atsiliepimai`;
  return `${category.label}, ${reviews}`;
}

/** Cluster bubble: size and font scale with the number of markers inside. */
export function clusterIcon(cluster) {
  const count = cluster.getChildCount();
  const size = count < 10 ? 36 : count < 100 ? 44 : 52;
  const step = count < 10 ? 'sm' : count < 100 ? 'md' : 'lg';
  return L.divIcon({
    className: `rm-cluster rm-cluster--${step}`,
    html: `<span class="rm-cluster__body">${escapeHtml(count)}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}
