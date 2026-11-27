import { Download, PlusSquare, Share, Smartphone, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { FicupLogo } from './FicupLogo';

interface PWAInstallButtonProps {
  variant?: 'header' | 'drawer';
  onAfterTrigger?: () => void;
}

export function PWAInstallButton({ variant = 'header', onAfterTrigger }: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    if (!guideOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setGuideOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [guideOpen]);

  // Never show install controls when already running in installed standalone mode
  if (isInstalled) {
    return null;
  }

  // In the compact top header bar, display only when native install prompt is ready or on iOS
  if (variant === 'header' && !isInstallable && !isIOS) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
      onAfterTrigger?.();
      return;
    }
    setGuideOpen(true);
  };

  const buttonLabel = isInstallable
    ? variant === 'drawer'
      ? 'Installa App FICUP'
      : 'Installa App'
    : isIOS
      ? variant === 'drawer'
        ? 'Installa App su iPhone'
        : 'Installa App'
      : 'Installa App FICUP';

  const modal =
    guideOpen && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pwa-install-guide-title"
            onClick={() => setGuideOpen(false)}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden text-[#0B1F4D]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-[#0B1F4D] px-5 py-4 flex items-center justify-between gap-3 border-b border-[#D4AF37]/40">
                <div className="flex items-center gap-3 min-w-0">
                  <FicupLogo size="sm" className="bg-white p-0.5 ring-1 ring-[#D4AF37]/50 shrink-0" />
                  <div className="min-w-0">
                    <h3
                      id="pwa-install-guide-title"
                      className="font-display text-sm sm:text-base font-extrabold text-white truncate"
                    >
                      Installa FICUP sul dispositivo
                    </h3>
                    <p className="text-[11px] font-semibold text-[#FDE68A] truncate">
                      {isIOS ? 'Guida rapida per iPhone / iPad (Safari)' : 'Accesso rapido dalla schermata Home'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setGuideOpen(false)}
                  aria-label="Chiudi finestra installazione"
                  className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs sm:text-sm text-slate-700 leading-relaxed">
                {isIOS ? (
                  <ol className="space-y-3">
                    <li className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-lg bg-[#0B1F4D] text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                        1
                      </span>
                      <span>
                        Apri il portale con <strong>Safari</strong> su iPhone o iPad e tocca l&apos;icona{' '}
                        <span className="inline-flex items-center gap-1 font-semibold text-[#0B1F4D]">
                          Condividi <Share className="w-3.5 h-3.5 text-[#0284C7]" />
                        </span>{' '}
                        nella barra in basso (o in alto su iPad).
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-lg bg-[#0B1F4D] text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                        2
                      </span>
                      <span>
                        Scorri il menu e seleziona{' '}
                        <span className="inline-flex items-center gap-1 font-semibold text-[#0B1F4D]">
                          Aggiungi alla schermata Home <PlusSquare className="w-3.5 h-3.5 text-[#C69214]" />
                        </span>
                        .
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-lg bg-[#0B1F4D] text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                        3
                      </span>
                      <span>
                        Conferma toccando <strong>Aggiungi</strong> in alto a destra: l&apos;icona ufficiale{' '}
                        <strong>FICUP</strong> apparirà sulla Home e si aprirà a schermo intero.
                      </span>
                    </li>
                  </ol>
                ) : (
                  <div className="space-y-3">
                    <p className="text-slate-600">
                      Puoi installare <strong>FICUP</strong> gratuitamente come app dedicata dal menu del browser:
                    </p>
                    <ul className="space-y-2.5 text-slate-700">
                      <li className="flex items-start gap-2.5">
                        <Smartphone className="w-4 h-4 text-[#0284C7] shrink-0 mt-0.5" />
                        <span>
                          <strong>Android (Chrome):</strong> tocca il menu <strong>⋮</strong> in alto a destra e scegli{' '}
                          <strong>Installa app</strong> oppure <strong>Aggiungi a schermata Home</strong>.
                        </span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <Share className="w-4 h-4 text-[#C69214] shrink-0 mt-0.5" />
                        <span>
                          <strong>iPhone / iPad (Safari):</strong> tocca <strong>Condividi</strong> e poi{' '}
                          <strong>Aggiungi alla schermata Home</strong>.
                        </span>
                      </li>
                    </ul>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setGuideOpen(false);
                    onAfterTrigger?.();
                  }}
                  className="w-full min-h-[44px] rounded-xl bg-[#0B1F4D] text-white font-bold text-xs sm:text-sm hover:bg-[#153985] transition-colors cursor-pointer"
                >
                  Ho capito
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  if (variant === 'drawer') {
    return (
      <>
        <button
          type="button"
          onClick={handleClick}
          className="w-full min-h-[46px] text-left px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-[#0B1F4D] text-white hover:bg-[#153985] transition-colors cursor-pointer flex items-center justify-between gap-2 shadow-sm"
        >
          <span className="inline-flex items-center gap-2 min-w-0">
            <Download className="w-4 h-4 text-[#D4AF37] shrink-0" />
            <span className="truncate">{buttonLabel}</span>
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#FDE68A] shrink-0">
            Gratis
          </span>
        </button>
        {modal}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="hidden md:inline-flex min-h-[40px] sm:min-h-[44px] px-3 py-1.5 rounded-xl border border-[#C69214]/50 bg-amber-50/70 text-[#0B1F4D] text-xs font-bold hover:bg-amber-100/80 active:scale-[0.98] transition-all whitespace-nowrap shrink-0 items-center gap-1.5 cursor-pointer"
      >
        <Download className="w-3.5 h-3.5 text-[#C69214]" />
        <span>{buttonLabel}</span>
      </button>
      {modal}
    </>
  );
}
