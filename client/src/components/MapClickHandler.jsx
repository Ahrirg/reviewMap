import { memo, useEffect, useRef } from 'react';
import { useMapEvents } from 'react-leaflet';

/**
 * Window in which a second click still counts as part of a double click.
 * Comfortably above the browser's own threshold, including on trackpads.
 */
export const DBL_WINDOW = 260;

/**
 * Turns raw Leaflet clicks on empty map into a single "create a marker here".
 *
 * Leaflet fires click, click, dblclick for a double click, so a naive handler
 * opens the dialog twice. A pending timer absorbs the second click, and
 * dblclick cancels it outright. Only a timer that expires means the gesture
 * really was a single click.
 *
 * Clicks on a marker never reach this handler: Leaflet resolves the event to
 * the marker's own layer, and markers default to bubblingMouseEvents: false.
 * Popups and Leaflet controls call disableClickPropagation on themselves, and
 * every piece of our own UI lives outside the map container.
 */
export const MapClickHandler = memo(function MapClickHandler({ enabled, onSingleClick }) {
  const timer = useRef(null);
  const callback = useRef(onSingleClick);
  callback.current = onSingleClick;

  const cancel = () => {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  useEffect(() => cancel, []);
  useEffect(() => {
    if (!enabled) cancel();
  }, [enabled]);

  useMapEvents({
    click(event) {
      if (!enabled) return;
      // Second click of a double click: the first one already armed the timer.
      if (timer.current) return;

      const { latlng } = event;
      timer.current = window.setTimeout(() => {
        timer.current = null;
        callback.current?.(latlng);
      }, DBL_WINDOW);
    },
    dblclick: cancel,
    // Leaflet suppresses click after a drag, but a kinetic pan can still land
    // between the two events, so drop anything pending when the map moves.
    movestart: cancel,
    zoomstart: cancel,
  });

  return null;
});
