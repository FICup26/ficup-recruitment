import { ArrowRight, Menu, Shield, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { FicupLogo } from './FicupLogo';

export type AppView = 'home' | 'wizard' | 'waiting-room' | 'admin';

interface HeaderProps {
  activeView: AppView;
  hasWaitingPass?: boolean;
  onNavigate: (view: AppView, sectionId?: string) => void;
}

export function Header({ activeView, hasWaitingPass = false, onNavigate }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLink = (view: AppView, sectionId?: string) => {
    setMobileMenuOpen(false);
    onNavigate(view, sectionId);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/90 bg-white/95 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-[72px] flex items-center justify-between gap-3 sm:gap-6">
        {/* Zone 1: Brand Lockup (Official Logo + Full Brand Name + Subtitle) */}
        <button
          type="button"
          onClick={() => handleLink('home')}
          className="inline-flex items-center gap-2.5 sm:gap-3 whitespace-nowrap shrink-0 cursor-pointer min-h-[44px] group focus:outline-none text-left"
        >
          <FicupLogo
            size="sm"
            className="ring-1 ring-slate-200 bg-white p-0.5 transition-transform duration-300 group-hover:scale-[1.03]"
          />
          <span className="flex flex-col leading-none">
            <span className="font-display text-sm sm:text-base font-extrabold tracking-tight text-[#0B1F4D]">
              FANTA ITALIA CUP
            </span>
            <span className="mt-0.5 text-[9px] sm:text-[10px] font-bold tracking-[0.18em] uppercase text-[#C69214]">
              THE FOOTBALL UNIVERSE
            </span>
          </span>
        </button>

        {/* Zone 2: Desktop Center Navigation */}
        <nav
          aria-label="Navigazione principale"
          className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-600"
        >
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
            <span>Area Personale</span>
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

        {/* Zone 3: Primary CTA + Mobile Hamburger */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => handleLink('wizard')}
            className="min-h-[42px] sm:min-h-[44px] px-3.5 sm:px-5 py-2 rounded-xl bg-[#0B1F4D] text-white text-xs sm:text-sm font-bold hover:bg-[#153985] active:scale-[0.98] transition-all whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <span>Candidati ora</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#D4AF37]" />
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? 'Chiudi menu' : 'Apri menu'}
            className="lg:hidden min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-[#0B1F4D] hover:bg-slate-100 transition-colors cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Animated Mobile Navigation Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="lg:hidden overflow-hidden border-t border-slate-200 bg-white"
          >
            <div className="px-4 py-3 space-y-1">
              <button
                type="button"
                onClick={() => handleLink('home')}
                className={`w-full min-h-[46px] text-left px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                  activeView === 'home'
                    ? 'bg-slate-100 text-[#0B1F4D] font-semibold'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                Home — FANTA ITALIA CUP
              </button>
              <button
                type="button"
                onClick={() => handleLink('home', 'la-nostra-storia')}
                className="w-full min-h-[46px] text-left px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                La nostra storia
              </button>
              <button
                type="button"
                onClick={() => handleLink('home', 'app-ufficiale')}
                className="w-full min-h-[46px] text-left px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                L&apos;App Ufficiale FICUP
              </button>
              <button
                type="button"
                onClick={() => handleLink('home', 'il-team')}
                className="w-full min-h-[46px] text-left px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Il Team
              </button>
              <button
                type="button"
                onClick={() => handleLink('wizard')}
                className={`w-full min-h-[46px] text-left px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                  activeView === 'wizard'
                    ? 'bg-amber-50 text-[#0B1F4D] font-semibold border border-[#C69214]/30'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                Candidatura guidata
              </button>
              <button
                type="button"
                onClick={() => handleLink('waiting-room')}
                className={`w-full min-h-[46px] text-left px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer flex items-center justify-between ${
                  activeView === 'waiting-room'
                    ? 'bg-sky-50 text-[#0B1F4D] font-semibold border border-[#0284C7]/30'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>Area Personale</span>
                {hasWaitingPass && (
                  <span className="text-[11px] font-mono-tabular font-semibold text-[#0284C7]">
                    Pass attivo
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => handleLink('admin')}
                className={`w-full min-h-[46px] text-left px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer inline-flex items-center gap-2 ${
                  activeView === 'admin'
                    ? 'bg-slate-100 text-[#0B1F4D] font-semibold'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Shield className="w-4 h-4 text-slate-500" />
                <span>Area Staff (Admin)</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
