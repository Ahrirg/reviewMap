import { useEffect, useRef, useState } from 'react';

import { CATEGORIES, DEFAULT_CATEGORY } from '@shared/categories.js';

import { createReview } from '../api/markers.js';
import { Button, ErrorBanner, Modal, ProgressBar, Spinner } from './Modal.jsx';
import { MediaPicker, emptyFiles } from './MediaPicker.jsx';

/**
 * Add a review to an existing marker.
 * Text, image and video are each optional, but at least one of the three must
 * be present; the server re-checks that. The author is not asked for -- it is
 * stamped from the session.
 */
export function AddReviewModal({ marker, open, onClose, onCreated }) {
  const [text, setText] = useState('');
  const [files, setFiles] = useState(emptyFiles);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const [fieldError, setFieldError] = useState(null);
  const abortRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setText('');
    setFiles(emptyFiles());
    setSaving(false);
    setProgress(null);
    setError(null);
    setFieldError(null);
  }, [open, marker?.id]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const hasFiles = files.images.length > 0 || files.videos.length > 0;

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;

    if (text.trim() === '' && !hasFiles) {
      setError('Atsiliepimui reikia teksto, nuotraukos arba vaizdo įrašo.');
      return;
    }

    setSaving(true);
    setError(null);
    setFieldError(null);
    if (hasFiles) setProgress(0);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const result = await createReview(
        marker.id,
        { text: text.trim(), files },
        { signal: controller.signal, onProgress: setProgress },
      );

      onCreated(marker.id, result.review, result.reviewCount);
    } catch (err) {
      if (err?.name === 'AbortError') {
        setError('Įkėlimas atšauktas.');
      } else {
        setError(err.message || 'Nepavyko išsaugoti atsiliepimo.');
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

  if (!open || !marker) return null;

  const category = CATEGORIES[marker.category] ?? CATEGORIES[DEFAULT_CATEGORY];

  return (
    <Modal
      open={open}
      onClose={cancel}
      closable={!saving}
      title="Naujas atsiliepimas"
      subtitle={category.label}
      footer={
        <>
          <Button onClick={cancel}>{saving ? 'Atšaukti įkėlimą' : 'Atšaukti'}</Button>
          <Button variant="primary" type="submit" form="add-review-form" disabled={saving}>
            {saving && <Spinner />}
            {saving ? 'Saugoma…' : 'Pridėti atsiliepimą'}
          </Button>
        </>
      }
    >
      <form id="add-review-form" onSubmit={submit} noValidate>
        <ErrorBanner message={error} onDismiss={() => setError(null)} />

        <fieldset disabled={saving} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Atsiliepimas</span>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={4}
              maxLength={2000}
              data-autofocus
              placeholder="Pasidalinkite savo patirtimi…"
              className={`w-full resize-y rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2 ${
                fieldError === 'text'
                  ? 'border-red-400 focus:ring-red-300'
                  : 'border-slate-300 focus:border-slate-400 focus:ring-slate-200'
              }`}
            />
            <span className="mt-1 block text-right text-xs text-slate-400">
              {text.length} / 2000
            </span>
          </label>

          <MediaPicker files={files} onChange={setFiles} disabled={saving} />
        </fieldset>

        {progress !== null && <ProgressBar value={progress} />}
      </form>
    </Modal>
  );
}
