import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import type {BeforeInstallPromptEvent} from './hooks/usePWAInstall';
import './index.css';

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    window.__ficupDeferredInstallPrompt = event as BeforeInstallPromptEvent;
  });

  if ('serviceWorker' in navigator && window.isSecureContext) {
    const swUrl = `${import.meta.env.BASE_URL}sw.js`;
    window.addEventListener('load', () => {
      const hadController = Boolean(navigator.serviceWorker.controller);
      let reloadingForUpdate = false;

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadController || reloadingForUpdate) {
          return;
        }
        reloadingForUpdate = true;
        window.location.reload();
      });

      navigator.serviceWorker
        .register(swUrl, {
          scope: import.meta.env.BASE_URL,
          updateViaCache: 'none',
        })
        .then((registration) => {
          registration.update().catch(() => undefined);
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
              registration.update().catch(() => undefined);
            }
          });
        })
        .catch(() => undefined);
    });
  }
}

createRoot(document.getElementById('root')!).render(<App />);

