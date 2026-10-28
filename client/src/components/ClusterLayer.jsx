import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';

import { categoryIcon, clusterIcon, markerLabel } from '../lib/icons.js';
import { DBL_WINDOW } from './MapClickHandler.jsx';

/**
 * Renders every marker into a leaflet.markercluster group.
 *
 * markercluster is a plain Leaflet plugin, so it is driven imperatively
 * through useMap rather than through a React wrapper package whose
 * react-leaflet 5 support is uncertain. This composes cleanly because the
 * preview popup is owned by React state, so the layer only ever needs plain
 * L.marker instances.
 */
export function ClusterLayer({ markers, activeId, onPreview, onDetails }) {
  const map = useMap();
  const groupRef = useRef(null);
  const timersRef = useRef(new Map());

  // Keep the newest callbacks without tearing the layer down on every render.
  const handlers = useRef({ onPreview, onDetails });
  handlers.current = { onPreview, onDetails };

  useEffect(() => {
    const group = L.markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 60,
      disableClusteringAtZoom: 17,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      removeOutsideVisibleBounds: true,
      iconCreateFunction: clusterIcon,
    });

    groupRef.current = group;
    map.addLayer(group);

    const timers = timersRef.current;
    return () => {
      for (const id of timers.keys()) window.clearTimeout(timers.get(id));
      timers.clear();
      map.removeLayer(group);
      groupRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return undefined;

    const timers = timersRef.current;

    const layers = markers.map((marker) => {
      const layer = L.marker([marker.latitude, marker.longitude], {
        icon: categoryIcon(marker.category, {
          count: marker.reviewCount,
          active: marker.id === activeId,
        }),
        title: markerLabel(marker),
        alt: markerLabel(marker),
        keyboard: true,
        riseOnHover: true,
      });

      // Same guard as the map: a double click must not also fire the preview.
      layer.on('click', () => {
        if (timers.has(marker.id)) return;
        const handle = window.setTimeout(() => {
          timers.delete(marker.id);
          handlers.current.onPreview?.(marker);
        }, DBL_WINDOW);
        timers.set(marker.id, handle);
      });

      layer.on('dblclick', (event) => {
        const handle = timers.get(marker.id);
        if (handle) {
          window.clearTimeout(handle);
          timers.delete(marker.id);
        }
        L.DomEvent.stop(event);
        handlers.current.onDetails?.(marker);
      });

      return layer;
    });

    group.clearLayers();
    group.addLayers(layers);

    return () => {
      for (const handle of timers.values()) window.clearTimeout(handle);
      timers.clear();
    };
  }, [markers, activeId]);

  return null;
}
