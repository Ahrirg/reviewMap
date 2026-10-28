import { useCallback, useMemo, useState } from 'react';

import { CATEGORY_IDS } from '@shared/categories.js';

import * as api from './api/markers.js';
import { AddMarkerModal } from './components/AddMarkerModal.jsx';
import { AddReviewModal } from './components/AddReviewModal.jsx';
import { CategoryLegend } from './components/CategoryLegend.jsx';
import { LoginScreen } from './components/LoginScreen.jsx';
import { MapView } from './components/MapView.jsx';
import { MarkerDetails } from './components/MarkerDetails.jsx';
import { MediaViewer } from './components/MediaViewer.jsx';
import { Spinner } from './components/Modal.jsx';
import { useMarkerDetails } from './hooks/useMarkerDetails.js';
import { useMarkers } from './hooks/useMarkers.js';
import { useSession } from './hooks/useSession.jsx';

const ROLE_LABELS = { admin: 'Administratorius', reviewer: 'Narys', guest: 'Svečias' };

/** Name and role, with the way out: log out, or log in if only looking. */
function AccountBadge() {
  const { signedIn, user, logout, showLogin } = useSession();

  return (
    <span className="flex items-center gap-2">
      <span className="hidden items-baseline gap-1.5 sm:flex">
        {signedIn && <span className="font-medium text-slate-800">{user.name}</span>}
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
          {ROLE_LABELS[user.role]}
        </span>
      </span>
      <button
        type="button"
        onClick={signedIn ? logout : showLogin}
        className="rounded-lg px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
      >
        {signedIn ? 'Atsijungti' : 'Prisijungti'}
      </button>
    </span>
  );
}

export default function App() {
  const session = useSession();
  const {
    markers,
    loading,
    error,
    reload,
    addMarker,
    applyReview,
    decrementReviewCount,
    removeMarker,
    restoreMarker,
  } = useMarkers();

  const [filters, setFilters] = useState(() => new Set(CATEGORY_IDS));
  const [pendingLatLng, setPendingLatLng] = useState(null);
  const [previewId, setPreviewId] = useState(null);
  const [detailsId, setDetailsId] = useState(null);
  const [reviewTargetId, setReviewTargetId] = useState(null);
  const [viewer, setViewer] = useState(null);

  const details = useMarkerDetails(detailsId);

  const byId = useMemo(() => new Map(markers.map((m) => [m.id, m])), [markers]);
  const preview = previewId == null ? null : byId.get(previewId) ?? null;
  const detailsMarker = detailsId == null ? null : byId.get(detailsId) ?? null;
  const reviewTarget = reviewTargetId == null ? null : byId.get(reviewTargetId) ?? null;

  const visibleMarkers = useMemo(
    () => markers.filter((m) => filters.has(m.category)),
    [markers, filters],
  );

  const counts = useMemo(() => {
    const result = Object.fromEntries(CATEGORY_IDS.map((id) => [id, 0]));
    for (const marker of markers) {
      result[marker.category] = (result[marker.category] ?? 0) + 1;
    }
    return result;
  }, [markers]);

  // Any open dialog disables map click, so nothing can be created behind it.
  const anyDialogOpen =
    pendingLatLng !== null || detailsId !== null || reviewTargetId !== null || viewer !== null;

  const handleMapClick = useCallback((latlng) => {
    setPreviewId(null);
    setPendingLatLng(latlng);
  }, []);

  const handlePreview = useCallback((marker) => setPreviewId(marker.id), []);

  const handleDetails = useCallback((marker) => {
    setPreviewId(null);
    setDetailsId(marker.id);
  }, []);

  const handleAddReview = useCallback((marker) => {
    setPreviewId(null);
    setReviewTargetId(marker.id);
  }, []);

  const handleOpenMedia = useCallback((items, index) => setViewer({ items, index }), []);

  const toggleFilter = useCallback((id) => {
    setFilters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const showAllFilters = useCallback(() => setFilters(new Set(CATEGORY_IDS)), []);

  /** New marker: append locally and open its drawer. The map never reloads. */
  const handleMarkerCreated = useCallback(
    (detail) => {
      addMarker(detail);
      details.prime(detail);
      setPendingLatLng(null);
      setDetailsId(detail.id);
    },
    [addMarker, details],
  );

  const handleReviewCreated = useCallback(
    (markerId, review) => {
      applyReview(markerId, review);
      details.applyReview(markerId, review);
      setReviewTargetId(null);
      if (detailsId == null) setDetailsId(markerId);
    },
    [applyReview, details, detailsId],
  );

  /** Optimistic delete with rollback, so a failure never loses the marker. */
  const handleDeleteMarker = useCallback(
    async (id) => {
      const snapshot = byId.get(id);
      removeMarker(id);
      setDetailsId(null);
      setPreviewId(null);
      try {
        await api.deleteMarker(id);
        details.forget(id);
      } catch (err) {
        if (snapshot) restoreMarker(snapshot);
        throw err;
      }
    },
    [byId, removeMarker, restoreMarker, details],
  );

  const handleDeleteReview = useCallback(
    async (markerId, reviewId) => {
      await api.deleteReview(reviewId);
      details.removeReview(markerId, reviewId);
      decrementReviewCount(markerId);
    },
    [details, decrementReviewCount],
  );

  // The session decides between three screens, and it has to resolve before
  // any of them renders: showing the login screen first and correcting it a
  // moment later would flash it at everyone who is already logged in.
  if (session.status === 'loading') {
    return (
      <div className="flex h-full items-center justify-center bg-slate-100 text-sm text-slate-500">
        <Spinner className="mr-2 h-4 w-4" /> Kraunama…
      </div>
    );
  }

  if (session.needsLogin) return <LoginScreen />;

  return (
    <div className="flex h-full flex-col">
      <header className="z-[1200] flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2.5 shadow-sm sm:px-5">
        <div className="flex items-baseline gap-2.5">
          <h1 className="text-base font-semibold text-slate-900 sm:text-lg">
            Kauno bendruomenės žemėlapis
          </h1>
          <span className="hidden text-xs text-slate-400 sm:inline">
            {session.canCreate
              ? 'Spustelėkite žemėlapį, kad pridėtumėte žymeklį'
              : 'Tik skaitymo režimas'}
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {loading && (
            <span className="flex items-center gap-1.5 text-slate-500">
              <Spinner className="h-3.5 w-3.5" /> Kraunama
            </span>
          )}
          <AccountBadge />
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium tabular-nums text-slate-600">
            {markers.length} žymekliai
          </span>
        </div>
      </header>

      <main className="relative min-h-0 flex-1">
        <MapView
          markers={visibleMarkers}
          preview={preview}
          pendingLatLng={pendingLatLng}
          interactive={!anyDialogOpen && session.canCreate}
          onMapClick={handleMapClick}
          onPreview={handlePreview}
          onDetails={handleDetails}
          onClosePreview={() => setPreviewId(null)}
          onAddReview={handleAddReview}
        />

        {/* Overlays are DOM siblings of the map, never Leaflet controls. */}
        <div className="pointer-events-none absolute left-3 top-3 z-[1000] flex flex-col gap-2">
          <CategoryLegend
            counts={counts}
            active={filters}
            total={markers.length}
            hidden={markers.length - visibleMarkers.length}
            onToggle={toggleFilter}
            onShowAll={showAllFilters}
          />
        </div>

        {error && (
          <div className="pointer-events-auto absolute left-1/2 top-3 z-[1000] flex -translate-x-1/2 items-center gap-3 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm text-red-700 shadow-lg">
            <span>{error}</span>
            <button
              type="button"
              onClick={reload}
              className="rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-700 transition hover:bg-red-50"
            >
              Bandyti dar kartą
            </button>
          </div>
        )}

        {!loading && !error && markers.length === 0 && (
          <div className="pointer-events-none absolute bottom-6 left-1/2 z-[1000] -translate-x-1/2 rounded-lg bg-slate-900/85 px-4 py-2.5 text-sm text-white shadow-lg">
            {session.canCreate
              ? 'Žemėlapis tuščias. Spustelėkite bet kurią vietą, kad pridėtumėte pirmą žymeklį.'
              : 'Žemėlapis kol kas tuščias.'}
          </div>
        )}
      </main>

      <AddMarkerModal
        open={pendingLatLng !== null}
        latlng={pendingLatLng}
        onClose={() => setPendingLatLng(null)}
        onCreated={handleMarkerCreated}
      />

      <MarkerDetails
        open={detailsId !== null}
        marker={detailsMarker}
        detail={details.detail}
        loading={details.loading}
        error={details.error}
        onClose={() => setDetailsId(null)}
        onAddReview={handleAddReview}
        onOpenMedia={handleOpenMedia}
        onDeleteMarker={handleDeleteMarker}
        onDeleteReview={handleDeleteReview}
      />

      <AddReviewModal
        open={reviewTargetId !== null}
        marker={reviewTarget}
        onClose={() => setReviewTargetId(null)}
        onCreated={handleReviewCreated}
      />

      <MediaViewer
        items={viewer?.items ?? null}
        index={viewer?.index ?? null}
        onClose={() => setViewer(null)}
        onIndexChange={(index) => setViewer((prev) => (prev ? { ...prev, index } : prev))}
      />
    </div>
  );
}
