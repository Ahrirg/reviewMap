import { useState } from 'react';

import { CATEGORY_IDS, CATEGORY_LIST } from '@shared/categories.js';

import { CategoryGlyph } from './CategoryGlyph.jsx';

/**
 * Legend and filter in one panel.
 *
 * A plain DOM sibling of the map, not a Leaflet control, so its clicks can
 * never reach the map's click handler and accidentally create a marker.
 */
export function CategoryLegend({ counts, active, onToggle, onShowAll, total, hidden }) {
  const [collapsed, setCollapsed] = useState(false);
  const allOn = active.size === CATEGORY_IDS.length;

  return (
    <section
      aria-label="Kategorijos"
      className="pointer-events-auto w-52 overflow-hidden rounded-xl border border-slate-200 bg-white/95 shadow-lg backdrop-blur"
    >
      <button
        type="button"
        onClick={() => setCollapsed((value) => !value)}
        aria-expanded={!collapsed}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-400"
      >
        <span className="text-sm font-semibold text-slate-800">Kategorijos</span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
          className={`text-slate-400 transition-transform ${collapsed ? '' : 'rotate-180'}`}
        >
          <path d="M5 7.5l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {!collapsed && (
        <>
          <ul className="border-t border-slate-100 px-1.5 py-1.5">
            {CATEGORY_LIST.map((category) => {
              const checked = active.has(category.id);
              return (
                <li key={category.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggle(category.id)}
                      className="h-4 w-4 shrink-0 rounded border-slate-300 accent-slate-900"
                    />
                    <span
                      aria-hidden="true"
                      className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-white ring-1 ring-black/10"
                      style={{ background: category.color }}
                    >
                      <CategoryGlyph category={category.id} size={12} />
                    </span>
                    <span
                      className={`flex-1 truncate text-sm ${checked ? 'text-slate-800' : 'text-slate-400'}`}
                    >
                      {category.label}
                    </span>
                    <span className="shrink-0 text-xs font-medium tabular-nums text-slate-400">
                      {counts[category.id] ?? 0}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>

          <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-3 py-2">
            <span className="text-xs text-slate-500 tabular-nums">
              {hidden > 0 ? `Rodoma ${total - hidden} iš ${total}` : `${total} žymekliai`}
            </span>
            <button
              type="button"
              onClick={onShowAll}
              disabled={allOn}
              className="rounded px-1.5 py-0.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Rodyti visus
            </button>
          </div>
        </>
      )}
    </section>
  );
}
