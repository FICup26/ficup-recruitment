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
              <motion.nav
                aria-label="Menu principale di navigazione"
                initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
                transition={{
                  duration: prefersReducedMotion ? 0.05 : 0.2,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="absolute right-0 top-[calc(100%+8px)] z-50 origin-top-right w-[calc(100vw-1.75rem)] max-w-[320px] sm:w-[340px] sm:max-w-[340px] max-h-[calc(100vh-5.5rem)] overflow-y-auto rounded-2xl bg-[#071436]/98 backdrop-blur-md text-white border border-[#D4AF37]/35 shadow-[0_20px_50px_-12px_rgba(4,11,28,0.65)] p-3"
              >
                <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2 px-1">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#FDE68A]">
                    Navigazione FICUP
                  </span>
                  <button
                    type="button"
                    onClick={() => handleLink('home', undefined, 'home')}
                    className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-300 hover:text-[#FDE68A] transition-colors cursor-pointer"
                  >
                    <Home className="w-3 h-3 text-[#D4AF37]" />
                    <span>Home</span>
                  </button>
                </div>

                {/* Compact Section Links */}
                <div className="space-y-0.5">
                  {WEB_NAV_ITEMS.map((item) => {
                    const isSelected =
                      selectedNavId === item.id && (item.id !== 'home' || activeView === 'home');
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleLink(item.view, item.sectionId, item.id)}
                        className={`group w-full text-left px-2.5 py-1.5 rounded-lg transition-all flex items-center justify-between gap-2 cursor-pointer ${
                          isSelected
                            ? 'bg-white/12 text-[#FDE68A] border border-[#D4AF37]/45'
                            : 'border border-transparent text-slate-200 hover:bg-white/[0.07] hover:text-white'
                        }`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span
                            className={`font-mono-tabular text-[10px] font-bold shrink-0 ${
                              isSelected ? 'text-[#FDE68A]' : 'text-[#D4AF37]/80'
                            }`}
                          >
                            {item.num}
                          </span>
                          <span className="font-display text-xs font-bold tracking-wide truncate">
                            {item.label}
                          </span>
                        </span>
                        <ArrowRight
                          className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 ${
                            isSelected ? 'text-[#FDE68A]' : 'text-slate-400'
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>

                {/* Compact Portal Access Shortcuts */}
                <div className="mt-2.5 pt-2.5 border-t border-white/10 grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleLink('waiting-room', undefined, 'waiting-room')}
                    className={`px-2.5 py-2 rounded-lg border text-left transition-all flex items-center gap-1.5 cursor-pointer ${
                      activeView === 'waiting-room'
                        ? 'bg-sky-500/20 border-sky-400/50 text-white'
                        : 'bg-white/[0.04] border-white/10 text-slate-200 hover:bg-white/[0.09]'
                    }`}
                  >
                    <UserCheck className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                    <span className="text-[11px] font-bold truncate">
                      {hasWaitingPass ? 'Area · Pass' : 'Area Personale'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleLink('admin', undefined, 'admin')}
                    className={`px-2.5 py-2 rounded-lg border text-left transition-all flex items-center gap-1.5 cursor-pointer ${
                      activeView === 'admin'
                        ? 'bg-[#D4AF37]/20 border-[#D4AF37]/50 text-white'
                        : 'bg-white/[0.04] border-white/10 text-slate-200 hover:bg-white/[0.09]'
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
                    <span className="text-[11px] font-bold truncate">Area Staff</span>
                  </button>
                </div>

                {/* Compact Primary CTA */}
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => handleLink('wizard', undefined, 'wizard')}
                    className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-[#D4AF37] via-[#E7C860] to-[#C69214] text-[#071436] text-xs font-black tracking-wide hover:brightness-105 active:scale-[0.98] transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>ENTRA IN CAMPO ORA</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.nav>
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
