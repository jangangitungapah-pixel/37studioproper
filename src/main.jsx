
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import '@fontsource/inter/300.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import './index.css';
import './styles/modules/primitives-override.css';

/* === STALE DEPLOY CHUNK RECOVERY: START === */
const STALE_DEPLOY_RELOAD_KEY = '37studio.stale-deploy-reload.v1';

function getErrorMessage(value) {
  if (!value) return '';

  if (typeof value === 'string') return value;

  return String(
    value.message ||
    value.reason?.message ||
    value.error?.message ||
    value.target?.src ||
    value.target?.href ||
    value
  );
}

function isStaleDeployChunkError(value) {
  const message = getErrorMessage(value);

  return [
    'Failed to fetch dynamically imported module',
    'Importing a module script failed',
    'Expected a JavaScript-or-Wasm module script',
    'error loading dynamically imported module',
    'Failed to load module script',
  ].some((needle) => message.includes(needle));
}

function recoverFromStaleDeployChunk(value) {
  if (typeof window === 'undefined') return;
  if (!isStaleDeployChunkError(value)) return;

  try {
    if (window.sessionStorage.getItem(STALE_DEPLOY_RELOAD_KEY) === '1') {
      console.error('[stale-deploy] Reload sudah pernah dicoba, skip agar tidak loop.', value);
      return;
    }

    window.sessionStorage.setItem(STALE_DEPLOY_RELOAD_KEY, '1');
  } catch {
    // Kalau sessionStorage diblokir, tetap coba reload sekali.
  }

  console.warn('[stale-deploy] Asset lama tidak ditemukan setelah deploy. Reload halaman sekali.');
  window.location.reload();
}

if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    recoverFromStaleDeployChunk(event.error || event.message || event);
  });

  window.addEventListener('unhandledrejection', (event) => {
    recoverFromStaleDeployChunk(event.reason || event);
  });

  window.addEventListener('load', () => {
    window.setTimeout(() => {
      try {
        window.sessionStorage.removeItem(STALE_DEPLOY_RELOAD_KEY);
      } catch {
        // Ignore.
      }
    }, 8000);
  });
}
/* === STALE DEPLOY CHUNK RECOVERY: END === */

/* === SAFE PWA REGISTRATION: START === */
function registerSafePwaServiceWorker() {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;

  const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const isSecure = window.location.protocol === 'https:' || isLocalhost;

  if (!isSecure) return;

  window.addEventListener('load', () => {
    const hadController = Boolean(navigator.serviceWorker.controller);
    let hasReloadedForUpdate = false;

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        registration.update().catch(() => {});

        window.setInterval(() => {
          registration.update().catch(() => {});
        }, 60 * 60 * 1000);

        if (registration.waiting && hadController) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }

        registration.addEventListener('updatefound', () => {
          const nextWorker = registration.installing;

          if (!nextWorker) return;

          nextWorker.addEventListener('statechange', () => {
            if (nextWorker.state === 'installed' && navigator.serviceWorker.controller) {
              registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      })
      .catch((error) => {
        console.warn('[pwa] Service worker registration failed:', error);
      });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || hasReloadedForUpdate) return;

      hasReloadedForUpdate = true;
      window.location.reload();
    });
  });
}

registerSafePwaServiceWorker();
/* === SAFE PWA REGISTRATION: END === */

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

