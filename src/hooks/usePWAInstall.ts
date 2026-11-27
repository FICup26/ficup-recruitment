import { useCallback, useEffect, useState } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

declare global {
  interface Window {
    __ficupDeferredInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

function checkIsStandalone(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const mediaStandalone = window.matchMedia?.('(display-mode: standalone)').matches ?? false;
  const iosStandalone =
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return mediaStandalone || iosStandalone;
}

function checkIsIOS(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const ua = window.navigator.userAgent.toLowerCase();
  const isClassicIOS = /iphone|ipad|ipod/.test(ua);
  const isIPadOS =
    window.navigator.platform === 'MacIntel' && (window.navigator.maxTouchPoints ?? 0) > 1;
  return isClassicIOS || isIPadOS;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() =>
    typeof window !== 'undefined' ? window.__ficupDeferredInstallPrompt ?? null : null
  );
  const [isInstalled, setIsInstalled] = useState<boolean>(checkIsStandalone);
  const [isIOS] = useState<boolean>(checkIsIOS);

  useEffect(() => {
    const mediaQuery = window.matchMedia?.('(display-mode: standalone)');

    const syncStandalone = () => {
      setIsInstalled(checkIsStandalone());
    };

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      const promptEvent = event as BeforeInstallPromptEvent;
      window.__ficupDeferredInstallPrompt = promptEvent;
      setDeferredPrompt(promptEvent);
    };

    const handleAppInstalled = () => {
      window.__ficupDeferredInstallPrompt = null;
      setDeferredPrompt(null);
      setIsInstalled(true);
    };

    syncStandalone();
    mediaQuery?.addEventListener?.('change', syncStandalone);
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      mediaQuery?.removeEventListener?.('change', syncStandalone);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    const promptEvent = deferredPrompt ?? window.__ficupDeferredInstallPrompt ?? null;
    if (!promptEvent) {
      return false;
    }

    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    window.__ficupDeferredInstallPrompt = null;
    setDeferredPrompt(null);

    if (outcome === 'accepted') {
      setIsInstalled(true);
      return true;
    }
    return false;
  }, [deferredPrompt]);

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    install,
  };
}
