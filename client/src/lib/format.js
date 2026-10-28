const dateTimeFormat = new Intl.DateTimeFormat('lt-LT', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const relativeFormat = new Intl.RelativeTimeFormat('lt', { numeric: 'auto' });

const UNITS = [
  ['year', 365 * 24 * 60 * 60 * 1000],
  ['month', 30 * 24 * 60 * 60 * 1000],
  ['day', 24 * 60 * 60 * 1000],
  ['hour', 60 * 60 * 1000],
  ['minute', 60 * 1000],
];

/** "prieš 3 valandas" style label, falling back to an absolute date. */
export function formatRelative(iso) {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const diff = then - Date.now();
  const abs = Math.abs(diff);

  if (abs < 60 * 1000) return 'ką tik';
  for (const [unit, ms] of UNITS) {
    if (abs >= ms) return relativeFormat.format(Math.round(diff / ms), unit);
  }
  return relativeFormat.format(Math.round(diff / 60000), 'minute');
}

export function formatAbsolute(iso) {
  const value = Date.parse(iso);
  return Number.isNaN(value) ? '' : dateTimeFormat.format(new Date(value));
}

export function formatCoords(latitude, longitude) {
  return `${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)}`;
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function pluralReviews(count) {
  if (count === 0) return 'nėra atsiliepimų';
  if (count === 1) return '1 atsiliepimas';
  const mod100 = count % 100;
  const mod10 = count % 10;
  if (mod100 >= 11 && mod100 <= 19) return `${count} atsiliepimų`;
  if (mod10 === 0) return `${count} atsiliepimų`;
  return `${count} atsiliepimai`;
}
