/**
 * Leaflet builds its default marker image URLs from the CSS path, which does
 * not survive Vite's bundling and produces 404s. Every marker in this app uses
 * a divIcon, but patching the default once means an accidental plain marker
 * still renders instead of showing a broken image.
 *
 * Imported for its side effect from main.jsx, before the app mounts.
 */
import L from 'leaflet';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });
