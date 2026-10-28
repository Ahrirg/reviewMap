import { useEffect, useRef, useState } from 'react';

import { CATEGORY_LIST, DEFAULT_CATEGORY } from '@shared/categories.js';

import { createMarker } from '../api/markers.js';
import { formatCoords } from '../lib/format.js';
import { CategoryGlyph } from './CategoryGlyph.jsx';
import { Button, ErrorBanner, Modal, ProgressBar, Spinner } from './Modal.jsx';
import { MediaPicker, emptyFiles } from './MediaPicker.jsx';

/**
 * Create a marker at the clicked coordinates, optionally with a first review.
 * Coordinates come from the map click and are shown read-only: the user never
 * types a latitude or longitude.
 */
export function AddMarkerModal({ latlng, open, onClose, onCreated }) {
  const [category, setCategory] = useState(DEFAULT_CATEGORY);
  const [text, setText] = useState('');
  const [files, setFiles] = useState(emptyFiles);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const [fieldError, setFieldError] = useState(null);
  const abortRef = useRef(null);

  // Reset for each new click position.
  useEffect(() => {
    if (!open) return;
    setCategory(DEFAULT_CATEGORY);
    setText('');
    setFiles(emptyFiles());
    setSaving(false);
    setProgress(null);
    setError(null);
    setFieldError(null);
  }, [open, latlng]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const hasFiles = files.images.length > 0 || files.videos.length > 0;

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    setError(null);
    setFieldError(null);
    if (hasFiles) setProgress(0);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const detail = await createMarker(
        {
          latitude: latlng.lat,
          longitude: latlng.lng,
          category,
          text: text.trim(),
          files,
        },
        { signal: controller.signal, onProgress: setProgress },
      );

      onCreated(detail);
    } catch (err) {
      if (err?.name === 'AbortError') {
        setError('Įkėlimas atšauktas.');
      } else {
        setError(err.message || 'Nepavyko sukurti žymeklio.');
        setFieldError(err.field ?? null);
      }
      setSaving(false);
      setProgress(null);
    }
  };

  const cancel = () => {
    if (saving) {
      abortRef.current?.abort();
      return;
    }
    onClose();
  };

  if (!open || !latlng) return null;

  return (
    <Modal
      open={open}
      onClose={cancel}
      closable={!saving}
      title="Naujas žymeklis"
      subtitle={`Vieta: ${formatCoords(latlng.lat, latlng.lng)}`}
      footer={
        <>
          <Button onClick={cancel}>{saving ? 'Atšaukti įkėlimą' : 'Atšaukti'}</Button>
          <Button variant="primary" type="submit" form="add-marker-form" disabled={saving}>
            {saving && <Spinner />}
            {saving ? 'Saugoma…' : 'Sukurti žymeklį'}
          </Button>
        </>
      }
    >
      <form id="add-marker-form" onSubmit={submit} noValidate>
        <ErrorBanner message={error} onDismiss={() => setError(null)} />

        <fieldset disabled={saving} className="space-y-4">
          <div>
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Kategorija</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {CATEGORY_LIST.map((item) => {
                const selected = item.id === category;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setCategory(item.id)}
                    aria-pressed={selected}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                      selected
                        ? 'border-transparent text-white shadow-sm'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                    style={selected ? { background: item.color } : undefined}
                  >
                    <CategoryGlyph
                      category={item.id}
                      size={16}
                      className={selected ? 'text-white' : 'text-slate-500'}
                    />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
            <p className="mb-3 text-sm font-medium text-slate-700">
              Pirmas atsiliepimas{' '}
              <span className="font-normal text-slate-400">(nebūtina)</span>
            </p>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Atsiliepimas</span>
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="Ką čia radote?"
                className={`w-full resize-y rounded-lg border bg-white px-3 py-2 text-sm outline-none transition focus:ring-2 ${
                  fieldError === 'text'
                    ? 'border-red-400 focus:ring-red-300'
                    : 'border-slate-300 focus:border-slate-400 focus:ring-slate-200'
                }`}
              />
              <span className="mt-1 block text-right text-xs text-slate-400">
                {text.length} / 2000
              </span>
            </label>

            <div className="mt-2">
              <MediaPicker files={files} onChange={setFiles} disabled={saving} />
            </div>
          </div>
        </fieldset>

        {progress !== null && <ProgressBar value={progress} />}
      </form>
    </Modal>
  );
}
