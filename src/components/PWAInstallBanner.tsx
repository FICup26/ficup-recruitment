import { Download, X } from 'lucide-react';
import { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { FicupLogo } from './FicupLogo';

const BANNER_DISMISSED_KEY = 'ficup_pwa_banner_dismissed';

export function PWAInstallBanner() {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return typeof window !== 'undefined' && window.sessionStorage.getItem(BANNER_DISMISSED_KEY) === '1';
    } catch {
      return false;
    }
  });

  if (isInstalled || !isInstallable || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    try {
      window.sessionStorage.setItem(BANNER_DISMISSED_KEY, '1');
    } catch {
      // Ignore storage errors
    }
  };

  return (
    <div
      role="region"
      aria-label="Installa applicazione FICUP"
      className="fixed bottom-4 inset-x-3 sm:left-auto sm:right-6 sm:w-[360px] z-40 rounded-2xl bg-[#0B1F4D] text-white border border-[#D4AF37]/45 shadow-2xl p-3.5 flex items-center gap-3"
    >
      <FicupLogo size="sm" className="bg-white p-0.5 ring-1 ring-[#D4AF37]/50 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-display text-xs sm:text-sm font-extrabold text-white truncate">
          Installa App FICUP
        </p>
        <p className="text-[11px] text-slate-200 leading-snug">
          Aggiungi FICUP alla schermata Home, gratis e senza store.
        </p>
      </div>
      <button
        type="button"
        onClick={() => {
          install().catch(() => undefined);
        }}
        className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#D4AF37] text-[#071436] text-xs font-extrabold hover:brightness-105 active:scale-[0.98] transition-all inline-flex items-center gap-1 shrink-0 cursor-pointer"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Installa</span>
      </button>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Chiudi avviso installazione"
        className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-xl text-slate-300 hover:bg-white/10 hover:text-white transition-colors shrink-0 cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
