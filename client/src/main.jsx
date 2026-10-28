import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Side effect only: repairs Leaflet's default icon URLs under Vite bundling.
import './lib/leafletSetup.js';
import './index.css';
import App from './App.jsx';
import { SessionProvider } from './hooks/useSession.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SessionProvider>
      <App />
    </SessionProvider>
  </StrictMode>,
);
