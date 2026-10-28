import { useEffect, useMemo, useRef, useState } from 'react';

import { formatBytes } from '../lib/format.js';

/** Must stay in step with server/src/config.js. The server re-checks everything. */
export const CLIENT_LIMITS = {
  image: { bytes: 10 * 1024 * 1024, max: 5, exts: ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'] },
  video: { bytes: 100 * 1024 * 1024, max: 2, exts: ['.mp4', '.webm', '.ogv', '.ogg', '.m4v'] },
};

const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/avif';
const VIDEO_ACCEPT = 'video/mp4,video/webm,video/ogg';

const extOf = (name) => {
  const index = String(name).lastIndexOf('.');
  return index === -1 ? '' : String(name).slice(index).toLowerCase();
};

/**
 * Validates a picked file list against the same rules the server enforces.
 * These checks only exist to give instant feedback; the server never trusts them.
 */
function validate(kind, incoming, existing) {
  const limit = CLIENT_LIMITS[kind];
  const accepted = [];
  const errors = [];

  for (const file of incoming) {
    if (existing.length + accepted.length >= limit.max) {
      errors.push(
        kind === 'image'
          ? `Daugiausia ${limit.max} nuotraukos viename atsiliepime.`
          : `Daugiausia ${limit.max} vaizdo įrašai viename atsiliepime.`,
      );
      break;
    }
    if (!limit.exts.includes(extOf(file.name))) {
      errors.push(`"${file.name}": netinkamas formatas. Galima: ${limit.exts.join(', ')}`);
      continue;
    }
    if (file.size > limit.bytes) {
      errors.push(
        `"${file.name}" per didelis (${formatBytes(file.size)}). Riba ${formatBytes(limit.bytes)}.`,
      );
      continue;
    }
    accepted.push(file);
  }

  return { accepted, errors };
}

/** Inline SVG rather than an emoji, so it renders without an emoji font. */
function PickerIcon({ kind }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      {kind === 'image' ? (
        <>
          <rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="8.5" cy="10" r="1.6" fill="currentColor" />
          <path d="M4 17l5-5 4 4 3-2.5 4 3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : (
        <>
          <rect x="2.5" y="5" width="13" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M16.5 10.5l5-3v9l-5-3z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}

function FileRow({ file, previewUrl, kind, onRemove, disabled }) {
  return (
    <li className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white p-2">
      {kind === 'image' ? (
        <img src={previewUrl} alt="" className="h-11 w-11 shrink-0 rounded object-cover" />
      ) : (
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded bg-slate-900 text-white">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M6 4.5v11l9-5.5-9-5.5z" />
          </svg>
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="break-anywhere block truncate text-sm text-slate-700">{file.name}</span>
        <span className="block text-xs text-slate-400">{formatBytes(file.size)}</span>
      </span>
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label={`Pašalinti ${file.name}`}
        className="shrink-0 rounded p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-red-600 disabled:opacity-50"
      >
        <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </li>
  );
}

/**
 * Image and video pickers with local previews.
 * Object URLs are revoked when the selection changes or the form unmounts.
 */
export function MediaPicker({ files, onChange, disabled }) {
  const [errors, setErrors] = useState([]);
  const imageInput = useRef(null);
  const videoInput = useRef(null);

  const previews = useMemo(
    () => files.images.map((file) => URL.createObjectURL(file)),
    [files.images],
  );

  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  const pick = (kind) => (event) => {
    const incoming = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (incoming.length === 0) return;

    const key = kind === 'image' ? 'images' : 'videos';
    const { accepted, errors: found } = validate(kind, incoming, files[key]);
    setErrors(found);
    if (accepted.length > 0) onChange({ ...files, [key]: [...files[key], ...accepted] });
  };

  const remove = (key, index) => {
    onChange({ ...files, [key]: files[key].filter((_, i) => i !== index) });
    setErrors([]);
  };

  const total = files.images.length + files.videos.length;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => imageInput.current?.click()}
          disabled={disabled || files.images.length >= CLIENT_LIMITS.image.max}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-55"
        >
          <PickerIcon kind="image" /> Pridėti nuotrauką
        </button>
        <button
          type="button"
          onClick={() => videoInput.current?.click()}
          disabled={disabled || files.videos.length >= CLIENT_LIMITS.video.max}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-55"
        >
          <PickerIcon kind="video" /> Pridėti vaizdo įrašą
        </button>
      </div>

      <input
        ref={imageInput}
        type="file"
        accept={IMAGE_ACCEPT}
        multiple
        onChange={pick('image')}
        className="hidden"
        tabIndex={-1}
      />
      <input
        ref={videoInput}
        type="file"
        accept={VIDEO_ACCEPT}
        multiple
        onChange={pick('video')}
        className="hidden"
        tabIndex={-1}
      />

      <p className="text-xs text-slate-500">
        Nuotraukos iki {formatBytes(CLIENT_LIMITS.image.bytes)}, vaizdo įrašai iki{' '}
        {formatBytes(CLIENT_LIMITS.video.bytes)} (MP4, WebM, Ogg).
      </p>

      {errors.length > 0 && (
        <ul className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {errors.map((message) => (
            <li key={message} className="break-anywhere">
              {message}
            </li>
          ))}
        </ul>
      )}

      {total > 0 && (
        <ul className="space-y-1.5">
          {files.images.map((file, index) => (
            <FileRow
              key={`${file.name}-${file.lastModified}-${index}`}
              file={file}
              previewUrl={previews[index]}
              kind="image"
              disabled={disabled}
              onRemove={() => remove('images', index)}
            />
          ))}
          {files.videos.map((file, index) => (
            <FileRow
              key={`${file.name}-${file.lastModified}-${index}`}
              file={file}
              kind="video"
              disabled={disabled}
              onRemove={() => remove('videos', index)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

export const emptyFiles = () => ({ images: [], videos: [] });
