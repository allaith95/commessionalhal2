import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register Service Worker for PWA installation & offline functionality with auto update
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('Service Worker registered successfully with scope:', reg.scope);
        // Force update to clear any stale cache
        reg.update();
      })
      .catch((err) => {
        console.warn('Service Worker registration failed:', err);
      });
  });

  // Reload page when new service worker takes control
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
}

// Disable native browser context menu globally across all elements
if (typeof window !== 'undefined') {
  const disableMenu = (e: MouseEvent) => {
    e.preventDefault();
  };
  window.addEventListener('contextmenu', disableMenu, { capture: true });
  document.addEventListener('contextmenu', disableMenu, { capture: true });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

