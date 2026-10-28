/**
 * Single source of truth for marker categories.
 *
 * Imported by the server (validation + database CHECK constraint) and by the
 * client (icons, legend, filters), so the two can never drift apart.
 *
 * `id` is the value stored in the database and sent over the API. It is the
 * exact Lithuanian label required by the product spec.
 *
 * `glyph` is inline SVG markup drawn on a 24x24 viewBox in white. Emoji were
 * the obvious choice here, but a machine without a colour-emoji font renders
 * them as empty boxes, so every category ships a vector glyph that depends on
 * nothing but the browser. `emoji` is kept for plain-text contexts.
 */

const stroke = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

export const CATEGORY_LIST = Object.freeze([
  Object.freeze({
    id: 'Toletai',
    label: 'Toletai',
    emoji: '\u{1F6BB}',
    color: '#2563eb',
    colorName: 'blue',
    // Restroom sign: a figure and a dress-shaped figure side by side.
    glyph:
      '<circle cx="7.5" cy="4.5" r="2.2" fill="currentColor"/>' +
      '<path d="M7.5 8.2c-1.8 0-2.9 1-2.9 2.6V15h1.4v6h3v-6h1.4v-4.2c0-1.6-1.1-2.6-2.9-2.6z" fill="currentColor"/>' +
      '<circle cx="16.5" cy="4.5" r="2.2" fill="currentColor"/>' +
      '<path d="M16.5 8.2c-1.9 0-3 1.1-3.4 2.8L12.3 15h2.2v6h4v-6h2.2l-.8-4c-.4-1.7-1.5-2.8-3.4-2.8z" fill="currentColor"/>',
  }),
  Object.freeze({
    id: 'Kedes',
    label: 'Kedes',
    emoji: '\u{1FA91}',
    color: '#7c3aed',
    colorName: 'purple',
    // Chair seen from the front: backrest, seat, legs.
    glyph: `<path d="M7 3v10M17 3v10M5.5 13h13M8.5 13v8M15.5 13v8M7 8h10" ${stroke}/>`,
  }),
  Object.freeze({
    id: 'Maistas',
    label: 'Maistas',
    emoji: '\u{1F354}',
    color: '#ea580c',
    colorName: 'orange',
    // Fork and knife.
    glyph:
      `<path d="M6 3v5.5a2.5 2.5 0 0 0 5 0V3M8.5 9v12" ${stroke}/>` +
      `<path d="M17.5 3c1.8 1.8 1.8 6.2 0 8v10" ${stroke}/>`,
  }),
  Object.freeze({
    id: 'Vaizdas',
    label: 'Vaizdas',
    emoji: '\u{1F304}',
    color: '#16a34a',
    colorName: 'green',
    // Sun over mountains.
    glyph:
      '<circle cx="17" cy="6.5" r="2.6" fill="currentColor"/>' +
      '<path d="M2.5 20l6.2-8.6 3.9 5.2 2.6-3.3 6.3 6.7z" fill="currentColor"/>',
  }),
  Object.freeze({
    id: 'Random',
    label: 'Random',
    emoji: '\u{1F4CD}',
    color: '#6b7280',
    colorName: 'gray',
    // Asterisk: the catch-all category.
    glyph: `<path d="M12 3.5v17M4.6 7.75l14.8 8.5M19.4 7.75l-14.8 8.5" ${stroke}/>`,
  }),
]);

export const CATEGORIES = Object.freeze(
  Object.fromEntries(CATEGORY_LIST.map((c) => [c.id, c])),
);

export const CATEGORY_IDS = Object.freeze(CATEGORY_LIST.map((c) => c.id));

export const DEFAULT_CATEGORY = 'Random';

export function isCategory(value) {
  return typeof value === 'string' && Object.hasOwn(CATEGORIES, value);
}

export function getCategory(value) {
  return CATEGORIES[value] ?? CATEGORIES[DEFAULT_CATEGORY];
}

/** SQL fragment for the CHECK constraint, kept in sync with the list above. */
export const CATEGORY_SQL_LIST = CATEGORY_IDS.map((id) => `'${id}'`).join(',');
