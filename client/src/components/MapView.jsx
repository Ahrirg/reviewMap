import { useMemo } from 'react';
import { MapContainer, Marker, Popup, TileLayer, ZoomControl } from 'react-leaflet';
import L from 'leaflet';

import { ClusterLayer } from './ClusterLayer.jsx';
import { MapClickHandler } from './MapClickHandler.jsx';
import { MarkerPopup } from './MarkerPopup.jsx';

/** Kaunas, Lithuania. Constants, never state: the map must not remount. */
export const KAUNAS_CENTER = [54.8985, 23.9036];
export const INITIAL_ZOOM = 13;

const ghostIcon = L.divIcon({
  className: 'rm-pin',
  html:
    '<span class="rm-pin__body" style="--pin:#0f172a;opacity:.6">' +
    '<svg class="rm-pin__glyph" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">' +
    '<path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>' +
    '</svg></span>',
  iconSize: [30, 30],
  iconAnchor: [15, 28],
});

/**
 * The map. Mounted exactly once for the life of the app: center and zoom are
 * module constants and nothing keys or conditionally wraps the container, which
 * is what keeps the view steady when a dialog opens or a marker is added.
 */
export function MapView({
  markers,
  preview,
  pendingLatLng,
  interactive,
  onMapClick,
  onPreview,
  onDetails,
  onClosePreview,
  onAddReview,
}) {
  const previewPosition = useMemo(
    () => (preview ? [preview.latitude, preview.longitude] : null),
    [preview],
  );

  return (
    <MapContainer
      center={KAUNAS_CENTER}
      zoom={INITIAL_ZOOM}
      minZoom={3}
      maxZoom={19}
      zoomControl={false}
      // Double click is a semantic gesture here (open marker details), so the
      // default zoom-on-double-click would fire on a near miss.
      doubleClickZoom={false}
      scrollWheelZoom
      className="h-full w-full"
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        maxZoom={19}
        detectRetina
      />

      <ZoomControl position="bottomright" />

      <MapClickHandler enabled={interactive} onSingleClick={onMapClick} />

      <ClusterLayer
        markers={markers}
        activeId={preview?.id ?? null}
        onPreview={onPreview}
        onDetails={onDetails}
      />

      {/* Where the new marker will land, shown while the create dialog is open. */}
      {pendingLatLng && (
        <Marker
          position={[pendingLatLng.lat, pendingLatLng.lng]}
          icon={ghostIcon}
          interactive={false}
          keyboard={false}
        />
      )}

      {/*
        One controlled popup, not a child of Marker. Binding a popup to a marker
        makes Leaflet open it on the first click and autoPan the map, which
        slides the marker away before the second click can land and swallows the
        double click entirely. autoClose and closeOnClick are off so React owns
        the lifecycle and no popupclose race can fight the state.
      */}
      {preview && previewPosition && (
        <Popup
          position={previewPosition}
          autoPan={false}
          closeButton={false}
          closeOnClick={false}
          autoClose={false}
          keepInView={false}
          className="rm-popup"
        >
          <MarkerPopup
            marker={preview}
            onOpenDetails={() => onDetails(preview)}
            onAddReview={() => onAddReview(preview)}
            onClose={onClosePreview}
          />
        </Popup>
      )}
    </MapContainer>
  );
}
