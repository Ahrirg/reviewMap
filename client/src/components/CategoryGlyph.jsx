import { CATEGORIES, DEFAULT_CATEGORY } from '@shared/categories.js';

/**
 * A category's vector glyph. Drawn as inline SVG rather than an emoji so it
 * renders identically on machines without a colour-emoji font installed.
 */
export function CategoryGlyph({ category, size = 16, className = '' }) {
  const item = CATEGORIES[category] ?? CATEGORIES[DEFAULT_CATEGORY];
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={`shrink-0 ${className}`}
      dangerouslySetInnerHTML={{ __html: item.glyph }}
    />
  );
}
