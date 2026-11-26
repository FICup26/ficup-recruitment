import { ArrowRight, Menu, Shield, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { FicupLogo } from './FicupLogo';
import { setPendingOfficialTab } from './OfficialLeagueSection';

export type AppView = 'home' | 'wizard' | 'waiting-room' | 'admin';

interface HeaderProps {
  activeView: AppView;
  hasWaitingPass?: boolean;
  onNavigate: (view: AppView, sectionId?: string) => void;
}

export function Header({ activeView, hasWaitingPass = false, onNavigate }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (headerRef.current && !headerRef.current.contains(target)) {
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [mobileMenuOpen]);

  const handleLink = (view: AppView, sectionId?: string, officialTab?: 'classifiche' | 'zonavar') => {
    setMobileMenuOpen(false);
    if (officialTab) {
      setPendingOfficialTab(officialTab);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('ficup:select-official-tab', { detail: officialTab })
        );
      }
    }
    onNavigate(view, sectionId);
  };

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-40 border-b border-slate-200/90 bg-white/95 backdrop-blur-md"
    >
      <div className="max-w-7xl mx-auto px-2.5 sm:px-6 h-16 sm:h-[72px] flex items-center justify-between gap-1.5 sm:gap-4 min-w-0">
        {/* Zone 1: Brand Lockup (Official Logo + Full Brand Name + Subtitle) */}
        <button
          type="button"
          onClick={() => handleLink('home')}
          className="inline-flex items-center gap-1.5 sm:gap-3 shrink min-w-0 cursor-pointer min-h-[44px] group focus:outline-none text-left"
        >
          <FicupLogo
            size="sm"
            className="ring-1 ring-slate-200 bg-white p-0.5 transition-transform duration-300 group-hover:scale-[1.03] shrink-0"
          />
          <span className="flex flex-col leading-none min-w-0">
            <span className="font-display text-xs sm:text-base font-extrabold tracking-tight text-[#0B1F4D] truncate">
              FANTA ITALIA CUP
            </span>
            <span className="mt-0.5 text-[8px] sm:text-[10px] font-bold tracking-[0.12em] sm:tracking-[0.18em] uppercase text-[#C69214] truncate">
              THE FOOTBALL UNIVERSE
            </span>
          </span>
        </button>

        {/* Zone 2: Desktop Center Navigation */}
        <nav
          aria-label="Navigazione principale"
          className="hidden lg:flex items-center justify-center gap-2 xl:gap-5 text-xs xl:text-sm font-medium text-slate-600 min-w-0 shrink"
        >
          <button
            type="button"
            onClick={() => handleLink('home', 'classifiche', 'classifiche')}
            className="whitespace-nowrap shrink-0 py-1.5 border-b-2 border-transparent hover:text-[#0B1F4D] hover:border-[#C69214]/50 transition-colors cursor-pointer"
          >
            Classifiche
          </button>
          <button
            type="button"
            onClick={() => handleLink('home', 'classifiche', 'zonavar')}
            className="whitespace-nowrap shrink-0 py-1.5 border-b-2 border-transparent hover:text-[#0B1F4D] hover:border-[#0284C7]/50 transition-colors cursor-pointer"
          >
            Zona VAR
          </button>
          <button
            type="button"
            onClick={() => handleLink('home', 'la-nostra-storia')}
            className="whitespace-nowrap shrink-0 py-1.5 border-b-2 border-transparent hover:text-[#0B1F4D] hover:border-[#C69214]/50 transition-colors cursor-pointer"
          >
            La Storia
          </button>
          <button
            type="button"
            onClick={() => handleLink('home', 'app-ufficiale')}
            className="whitespace-nowrap shrink-0 py-1.5 border-b-2 border-transparent hover:text-[#0B1F4D] hover:border-[#0284C7]/50 transition-colors cursor-pointer"
          >
            L&apos;App
          </button>
          <button
            type="button"
            onClick={() => handleLink('home', 'il-team')}
            className="whitespace-nowrap shrink-0 py-1.5 border-b-2 border-transparent hover:text-[#0B1F4D] hover:border-[#C69214]/50 transition-colors cursor-pointer"
          >
            Il Team
          </button>
          <button
            type="button"
            onClick={() => handleLink('waiting-room')}
            className={`whitespace-nowrap shrink-0 py-1.5 border-b-2 transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
              activeView === 'waiting-room'
                ? 'border-[#0284C7] text-[#0B1F4D] font-semibold'
                : 'border-transparent hover:text-[#0B1F4D]'
            }`}
          >
            <span>Waiting Room</span>
            {hasWaitingPass && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#0284C7]" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            onClick={() => handleLink('admin')}
            className={`whitespace-nowrap shrink-0 py-1.5 border-b-2 transition-colors cursor-pointer ${
              activeView === 'admin'
                ? 'border-[#C69214] text-[#0B1F4D] font-semibold'
                : 'border-transparent hover:text-[#0B1F4D]'
            }`}
          >
            Area Staff
          </button>
        </nav>

        {/* Zone 3: Primary CTA + Original FICUP Burger Menu (Mobile & Desktop) */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={() => handleLink('wizard')}
            className="min-h-[40px] sm:min-h-[44px] px-2 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-[#0B1F4D] text-white text-[11px] sm:text-xs font-bold hover:bg-[#153985] active:scale-[0.98] transition-all whitespace-nowrap shrink-0 inline-flex items-center gap-1 sm:gap-1.5 shadow-sm cursor-pointer"
          >
            <span>Entra in campo ora</span>
            <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#D4AF37]" />
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? 'Chiudi menu' : 'Apri menu'}
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-[#0B1F4D] hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Right-Side Lateral Drawer (50% width, full height 100vh/100dvh) */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            {/* Backdrop Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50"
              aria-hidden="true"
            />
            {/* Drawer Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.24, ease: 'easeOut' }}
              className="fixed top-0 right-0 z-50 h-[100dvh] h-[100vh] w-1/2 min-w-[180px] bg-white shadow-2xl flex flex-col border-l border-slate-200"
            >
              <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
                <span className="font-display text-xs sm:text-sm font-extrabold text-[#0B1F4D] truncate">
                  MENU FICUP
                </span>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Chiudi menu"
                  className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5">
                <button
                  type="button"
                  onClick={() => handleLink('home')}
                  className={`w-full min-h-[46px] text-left px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
                    activeView === 'home'
                      ? 'bg-slate-100 text-[#0B1F4D] font-semibold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Home — FANTA ITALIA CUP
                </button>
                <button
                  type="button"
                  onClick={() => handleLink('home', 'classifiche', 'classifiche')}
                  className="w-full min-h-[46px] text-left px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  CLASSIFICHE UFFICIALI
                </button>
                <button
                  type="button"
                  onClick={() => handleLink('home', 'classifiche', 'zonavar')}
                  className="w-full min-h-[46px] text-left px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  ZONA VAR
                </button>
                <button
                  type="button"
                  onClick={() => handleLink('home', 'la-nostra-storia')}
                  className="w-full min-h-[46px] text-left px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  La nostra storia
                </button>
                <button
                  type="button"
                  onClick={() => handleLink('home', 'app-ufficiale')}
                  className="w-full min-h-[46px] text-left px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  L&apos;App Ufficiale FICUP
                </button>
                <button
                  type="button"
                  onClick={() => handleLink('home', 'il-team')}
                  className="w-full min-h-[46px] text-left px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Il Team
                </button>
                <button
                  type="button"
                  onClick={() => handleLink('wizard')}
                  className={`w-full min-h-[46px] text-left px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
                    activeView === 'wizard'
                      ? 'bg-amber-50 text-[#0B1F4D] font-semibold border border-[#C69214]/30'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Candidatura (7 passaggi)
                </button>
                <button
                  type="button"
                  onClick={() => handleLink('waiting-room')}
                  className={`w-full min-h-[46px] text-left px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-colors cursor-pointer flex items-center justify-between ${
                    activeView === 'waiting-room'
                      ? 'bg-sky-50 text-[#0B1F4D] font-semibold border border-[#0284C7]/30'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>Waiting Room</span>
                  {hasWaitingPass && (
                    <span className="text-[10px] font-mono-tabular font-semibold text-[#0284C7]">
                      Pass attivo
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleLink('admin')}
                  className={`w-full min-h-[46px] text-left px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-colors cursor-pointer inline-flex items-center gap-2 ${
                    activeView === 'admin'
                      ? 'bg-slate-100 text-[#0B1F4D] font-semibold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Shield className="w-4 h-4 text-slate-500 shrink-0" />
                  <span className="truncate">Area Staff (Admin)</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}
