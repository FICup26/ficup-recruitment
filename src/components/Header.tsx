import { ArrowRight, Home, Shield, UserCheck, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { FicupLogo } from './FicupLogo';

export type AppView = 'home' | 'wizard' | 'waiting-room' | 'admin';

interface HeaderProps {
  activeView: AppView;
  hasWaitingPass?: boolean;
  onNavigate: (view: AppView, sectionId?: string) => void;
}

interface WebNavItem {
  id: string;
  num: string;
  label: string;
  view: AppView;
  sectionId?: string;
}

const WEB_NAV_ITEMS: readonly WebNavItem[] = [
  {
    id: 'home',
    num: '01',
    label: 'HOME',
    view: 'home',
  },
  {
    id: 'chi-siamo',
    num: '02',
    label: 'CHI SIAMO',
    view: 'home',
    sectionId: 'la-nostra-storia',
  },
  {
    id: 'super-admin',
    num: '03',
    label: 'SUPER ADMIN',
    view: 'home',
    sectionId: 'super-admin',
  },
  {
    id: 'team-admin',
    num: '04',
    label: 'TEAM ADMIN',
    view: 'home',
    sectionId: 'team-admin',
  },
  {
    id: 'il-fischietto',
    num: '05',
    label: 'IL FISCHIETTO',
    view: 'home',
    sectionId: 'il-fischietto',
  },
  {
    id: 'competizioni',
    num: '06',
    label: 'COMPETIZIONI',
    view: 'home',
    sectionId: 'competizioni-esclusive',
  },
  {
    id: 'apri-app',
    num: '07',
    label: 'APRI APP',
    view: 'home',
    sectionId: 'app-ufficiale',
  },
  {
    id: 'candidature',
    num: '08',
    label: 'CANDIDATURE / ENTRA IN CAMPO',
    view: 'home',
    sectionId: 'candidatura',
  },
] as const;

export function Header({ activeView, hasWaitingPass = false, onNavigate }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedNavId, setSelectedNavId] = useState<string>('home');
  const menuContainerRef = useRef<HTMLDivElement | null>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (activeView === 'waiting-room') {
      setSelectedNavId('waiting-room');
    } else if (activeView === 'admin') {
      setSelectedNavId('admin');
    } else if (activeView === 'wizard') {
      setSelectedNavId('wizard');
    } else if (
      selectedNavId === 'waiting-room' ||
      selectedNavId === 'admin' ||
      selectedNavId === 'wizard'
    ) {
      setSelectedNavId('home');
    }
  }, [activeView, selectedNavId]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      if (menuContainerRef.current && !menuContainerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [menuOpen]);

  const handleLink = (view: AppView, sectionId?: string, navId?: string) => {
    setMenuOpen(false);
    if (navId) {
      setSelectedNavId(navId);
    } else if (view === 'home' && !sectionId) {
      setSelectedNavId('home');
    }
    onNavigate(view, sectionId);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/90 bg-white/95 backdrop-blur-md">
      <div className="relative max-w-7xl mx-auto px-3.5 sm:px-6 h-16 sm:h-[74px] flex items-center justify-between gap-2 sm:gap-5">
        {/* Left: Always-Clickable FICUP Home Logo */}
        <button
          type="button"
          onClick={() => handleLink('home', undefined, 'home')}
          aria-label="Torna alla Homepage FANTA ITALIA CUP"
          className="inline-flex items-center gap-2 sm:gap-3 whitespace-nowrap shrink-0 cursor-pointer min-h-[44px] group focus:outline-none text-left"
        >
          <FicupLogo
            size="sm"
            className="ring-1 ring-slate-200 bg-white p-0.5 transition-transform duration-300 group-hover:scale-[1.04]"
          />
          <span className="flex flex-col leading-none">
            <span className="font-display text-sm sm:text-base font-extrabold tracking-tight text-[#0B1F4D] group-hover:text-[#153985] transition-colors">
              FANTA ITALIA CUP
            </span>
            <span className="mt-0.5 text-[9px] sm:text-[10px] font-bold tracking-[0.16em] uppercase text-[#C69214]">
              L&apos;universo del Fantacalcio
            </span>
          </span>
        </button>

        {/* Right: Uniform Primary CTA & Compact Anchored Burger Menu (zero layout shift across views) */}
        <div ref={menuContainerRef} className="relative flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={() => handleLink('wizard', undefined, 'wizard')}
            className="hidden sm:inline-flex min-h-[42px] sm:min-h-[44px] px-4 sm:px-5 py-2 rounded-xl bg-[#0B1F4D] text-white text-xs sm:text-sm font-bold hover:bg-[#153985] active:scale-[0.98] transition-all whitespace-nowrap shrink-0 items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <span>ENTRA IN CAMPO ORA</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#D4AF37]" />
          </button>

          {/* Compact Website Burger Trigger */}
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? 'Chiudi menu di navigazione' : 'Apri menu di navigazione'}
            className={`min-h-[40px] sm:min-h-[42px] px-2.5 sm:px-3 inline-flex items-center justify-center gap-1.5 rounded-xl border transition-all cursor-pointer shrink-0 ${
              menuOpen
                ? 'bg-[#071436] border-[#071436] text-white shadow-sm'
                : 'bg-slate-50 border-slate-200 text-[#0B1F4D] hover:bg-slate-100 hover:border-slate-300'
            }`}
          >
            <span className="hidden md:inline text-[11px] font-bold uppercase tracking-wider">
              {menuOpen ? 'Chiudi' : 'Menu'}
            </span>
            {menuOpen ? (
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            ) : (
              <span aria-hidden="true" className="w-4.5 sm:w-5 flex flex-col gap-[4px]">
                <span className="block h-[2px] w-full bg-current rounded-xs" />
                <span className="block h-[2px] w-full bg-current rounded-xs" />
                <span className="block h-[2px] w-3.5 ml-auto bg-[#C69214] rounded-xs" />
              </span>
            )}
          </button>

          {/* Compact Animated Floating Navigation Panel Anchored Near Burger Icon */}
          <AnimatePresence>
            {menuOpen && (
              <>
                {/* Backdrop Overlay */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40"
                  onClick={() => setMenuOpen(false)}
                />

                {/* Side Drawer Panel (50% width on desktop / full height) */}
                <motion.nav
                  aria-label="Menu principale di navigazione"
                  initial={prefersReducedMotion ? { opacity: 0 } : { x: '100%' }}
                  animate={{ x: 0 }}
                  exit={prefersReducedMotion ? { opacity: 0 } : { x: '100%' }}
                  transition={{
                    duration: prefersReducedMotion ? 0.05 : 0.35,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="fixed top-0 right-0 bottom-0 z-50 w-full sm:w-[50vw] max-w-[560px] h-full bg-[#071436] text-white border-l border-[#D4AF37]/35 shadow-2xl flex flex-col overflow-y-auto p-6 sm:p-8"
                >
                  <div className="flex items-center justify-between border-b border-white/15 pb-4 mb-6">
                    <div className="flex items-center gap-3">
                      <FicupLogo size="sm" className="bg-white p-1 rounded-xl" />
                      <span className="font-display text-base sm:text-lg font-black tracking-tight text-white">
                        FANTA ITALIA CUP
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMenuOpen(false)}
                      aria-label="Chiudi menu"
                      className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <X className="w-5 h-5 text-[#D4AF37]" />
                    </button>
                  </div>

                  <div className="space-y-1.5 flex-1">
                    {WEB_NAV_ITEMS.map((item) => {
                      const isSelected =
                        selectedNavId === item.id && (item.id !== 'home' || activeView === 'home');
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleLink(item.view, item.sectionId, item.id)}
                          className={`group w-full text-left px-4 py-3 rounded-xl transition-all flex items-center justify-between gap-3 cursor-pointer ${
                            isSelected
                              ? 'bg-white/15 text-[#FDE68A] border border-[#D4AF37]/50 shadow-sm'
                              : 'border border-transparent text-slate-200 hover:bg-white/[0.08] hover:text-white'
                          }`}
                        >
                          <span className="flex items-center gap-3.5 min-w-0">
                            <span
                              className={`font-mono-tabular text-xs font-bold shrink-0 ${
                                isSelected ? 'text-[#FDE68A]' : 'text-[#D4AF37]'
                              }`}
                            >
                              {item.num}
                            </span>
                            <span className="font-display text-sm sm:text-base font-bold tracking-wide truncate">
                              {item.label}
                            </span>
                          </span>
                          <ArrowRight
                            className={`w-4 h-4 shrink-0 transition-transform duration-200 group-hover:translate-x-1 ${
                              isSelected ? 'text-[#FDE68A]' : 'text-slate-400'
                            }`}
                          />
                        </button>
                      );
                    })}
                  </div>

                  {/* Portal Access Shortcuts & CTA at bottom */}
                  <div className="mt-6 pt-6 border-t border-white/15 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => handleLink('waiting-room', undefined, 'waiting-room')}
                        className={`px-4 py-3 rounded-xl border text-left transition-all flex items-center gap-2 cursor-pointer ${
                          activeView === 'waiting-room'
                            ? 'bg-sky-500/25 border-sky-400/60 text-white'
                            : 'bg-white/[0.05] border-white/10 text-slate-200 hover:bg-white/[0.1]'
                        }`}
                      >
                        <UserCheck className="w-4 h-4 text-sky-300 shrink-0" />
                        <span className="text-xs sm:text-sm font-bold truncate">
                          {hasWaitingPass ? 'Area Personale · Pass' : 'Area Personale'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleLink('admin', undefined, 'admin')}
                        className={`px-4 py-3 rounded-xl border text-left transition-all flex items-center gap-2 cursor-pointer ${
                          activeView === 'admin'
                            ? 'bg-[#D4AF37]/25 border-[#D4AF37]/60 text-white'
                            : 'bg-white/[0.05] border-white/10 text-slate-200 hover:bg-white/[0.1]'
                        }`}
                      >
                        <Shield className="w-4 h-4 text-[#D4AF37] shrink-0" />
                        <span className="text-xs sm:text-sm font-bold truncate">Area Staff</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleLink('wizard', undefined, 'wizard')}
                      className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#E7C860] to-[#C69214] text-[#071436] text-sm font-black tracking-wide hover:brightness-105 active:scale-[0.98] transition-all inline-flex items-center justify-center gap-2 shadow-md cursor-pointer"
                    >
                      <span>ENTRA IN CAMPO ORA</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </motion.nav>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Independent Sub-Bar for Home Return — zero horizontal shift on logo, CTA, or burger icon */}
      {activeView !== 'home' && (
        <div className="border-t border-slate-200/80 bg-slate-50/95">
          <div className="max-w-7xl mx-auto px-3.5 sm:px-6 py-1.5 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => handleLink('home', undefined, 'home')}
              aria-label="Torna alla Homepage FANTA ITALIA CUP"
              className="group inline-flex items-center gap-1.5 min-h-[34px] px-3 py-1 rounded-lg bg-white border border-slate-200/90 text-[#0B1F4D] hover:bg-[#0B1F4D] hover:text-white hover:border-[#0B1F4D] text-[11px] font-bold tracking-wider uppercase transition-colors shadow-2xs cursor-pointer"
            >
              <Home className="w-3.5 h-3.5 text-[#C69214] group-hover:text-[#FDE68A] transition-colors shrink-0" />
              <span>HOME</span>
            </button>

            <span className="text-[11px] font-semibold text-slate-500 truncate">
              {activeView === 'wizard'
                ? 'Candidatura guidata'
                : activeView === 'waiting-room'
                ? 'Area Personale'
                : 'Area Staff'}
            </span>
          </div>
        </div>
      )}
    </header>
  );
}
