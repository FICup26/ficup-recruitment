import { MotionConfig } from 'motion/react';
import { useEffect, useState } from 'react';
import { AdminPanel } from './components/AdminPanel';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FicupLogo } from './components/FicupLogo';
import { Header, type AppView } from './components/Header';
import { HomePage } from './components/HomePage';
import { PrivacyModal } from './components/PrivacyModal';
import { RecruitmentWizard } from './components/RecruitmentWizard';
import { WaitingRoom } from './components/WaitingRoom';
import {
  initOptionalAnalytics,
  isFirebaseConfigured,
  verifyFirebaseServices,
  type FirebaseEnvironmentDiagnostics,
} from './lib/firebase';
import {
  DEFAULT_PUBLIC_CONFIG,
  getPublicConfig,
  type ConfigurazionePublica,
} from './lib/firestore';
import {
  clearWaitingRoomPass,
  loadWaitingRoomPass,
  saveWaitingRoomPass,
  type WaitingRoomPass,
} from './lib/waitingRoomStorage';

function resolveInitialView(): AppView {
  if (typeof window === 'undefined') {
    return 'home';
  }
  const hash = window.location.hash.replace(/^#\/?/, '').toLowerCase();
  if (hash === 'admin' || hash === 'staff') {
    return 'admin';
  }
  if (hash === 'candidatura' || hash === 'wizard') {
    return 'wizard';
  }
  if (hash === 'waiting-room' || hash === 'waitingroom') {
    return 'waiting-room';
  }
  return 'home';
}

function FicupPortal() {
  const [activeView, setActiveView] = useState<AppView>(resolveInitialView);
  const [publicConfig, setPublicConfig] =
    useState<Omit<ConfigurazionePublica, 'updatedAt' | 'updatedBy'>>(DEFAULT_PUBLIC_CONFIG);
  const [diagnostics, setDiagnostics] = useState<FirebaseEnvironmentDiagnostics | null>(null);
  const [footerPrivacyOpen, setFooterPrivacyOpen] = useState(false);
  const [waitingPass, setWaitingPass] = useState<WaitingRoomPass | null>(loadWaitingRoomPass);

  useEffect(() => {
    const onHashChange = () => {
      setActiveView(resolveInitialView());
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    initOptionalAnalytics().catch(() => null);

    let cancelled = false;

    async function bootstrap() {
      const diag = await verifyFirebaseServices();
      if (!cancelled) {
        setDiagnostics(diag);
      }

      if (isFirebaseConfigured && diag.firestore.ok) {
        try {
          const remoteConfig = await getPublicConfig();
          if (!cancelled && remoteConfig) {
            setPublicConfig({
              stagione: remoteConfig.stagione,
              iscrizioniAperte: remoteConfig.iscrizioniAperte,
              budgetIniziale: remoteConfig.budgetIniziale,
              modalitaMercato: remoteConfig.modalitaMercato,
              versioneInformativa: remoteConfig.versioneInformativa,
              emailOperativa: remoteConfig.emailOperativa,
              linkWhatsappProvvisorio: remoteConfig.linkWhatsappProvvisorio,
              linkWhatsappUfficiale: remoteConfig.linkWhatsappUfficiale,
            });
          }
        } catch {
          // Keep DEFAULT_PUBLIC_CONFIG for display if configurazione/public does not exist yet
        }
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleNavigate = (view: AppView, sectionId?: string) => {
    setActiveView(view);
    if (typeof window !== 'undefined') {
      if (view === 'admin') {
        window.location.hash = '#/admin';
      } else if (view === 'wizard') {
        window.location.hash = '#/candidatura';
      } else if (view === 'waiting-room') {
        window.location.hash = '#/waiting-room';
      } else {
        window.location.hash = '';
      }

      if (sectionId) {
        window.setTimeout(() => {
          document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
        }, 80);
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  const handleCandidaturaSubmitted = (pass: WaitingRoomPass) => {
    saveWaitingRoomPass(pass);
    setWaitingPass(pass);
  };

  const handleClearWaitingPass = () => {
    clearWaitingRoomPass();
    setWaitingPass(null);
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-[#0B1F4D]">
      <Header
        activeView={activeView}
        hasWaitingPass={waitingPass !== null}
        onNavigate={handleNavigate}
      />

      <main className="flex-1">
        {activeView === 'home' && (
          <HomePage
            config={publicConfig}
            diagnostics={diagnostics}
            hasWaitingPass={waitingPass !== null}
            onStartWizard={() => handleNavigate('wizard')}
            onOpenWaitingRoom={() => handleNavigate('waiting-room')}
            onScrollToStory={() => handleNavigate('home', 'la-nostra-storia')}
          />
        )}

        {activeView === 'wizard' && (
          <RecruitmentWizard
            config={publicConfig}
            onExitToHome={() => handleNavigate('home')}
            onCandidaturaSubmitted={handleCandidaturaSubmitted}
            onOpenWaitingRoom={() => handleNavigate('waiting-room')}
          />
        )}

        {activeView === 'waiting-room' && (
          <WaitingRoom
            config={publicConfig}
            waitingPass={waitingPass}
            onStartWizard={() => handleNavigate('wizard')}
            onClearWaitingPass={handleClearWaitingPass}
            onWaitingPassVerified={handleCandidaturaSubmitted}
          />
        )}

        {activeView === 'admin' && (
          <AdminPanel
            publicConfig={publicConfig}
            onConfigSaved={(nextConfig) => setPublicConfig(nextConfig)}
          />
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
            {/* Brand & Description */}
            <div className="md:col-span-5 space-y-3">
              <div className="flex items-center gap-3">
                <FicupLogo size="sm" className="ring-1 ring-slate-200 p-0.5 bg-white shrink-0" />
                <div>
                  <p className="font-display text-base font-extrabold text-[#0B1F4D]">
                    FANTA ITALIA CUP
                  </p>
                  <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#C69214]">
                    THE FOOTBALL UNIVERSE
                  </p>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-md">
                Lega nazionale gratuita di Fantacalcio su Fantaleghe, nata dalla passione condivisa e cresciuta grazie a una community di appassionati in tutta Italia.
              </p>
            </div>

            {/* Contacts & Social */}
            <div className="md:col-span-4 space-y-2.5 text-xs sm:text-sm text-slate-600">
              <p className="text-xs font-bold uppercase tracking-wider text-[#0B1F4D]">
                Contatti e Community
              </p>
              <p>
                Email operativa:{' '}
                <a
                  href={`mailto:${publicConfig.emailOperativa}`}
                  className="font-mono-tabular font-semibold text-[#0284C7] hover:text-[#0B1F4D] underline underline-offset-2"
                >
                  {publicConfig.emailOperativa}
                </a>
              </p>
              <p>
                TikTok: <span className="font-semibold text-[#0B1F4D]">@fanta.italia.cup</span>
              </p>
            </div>

            {/* Navigation & Legal */}
            <div className="md:col-span-3 space-y-2.5 text-xs sm:text-sm text-slate-600 flex flex-col items-start">
              <p className="text-xs font-bold uppercase tracking-wider text-[#0B1F4D]">
                Portale
              </p>
              <button
                type="button"
                onClick={() => handleNavigate('wizard')}
                className="hover:text-[#0B1F4D] underline underline-offset-2 cursor-pointer"
              >
                Candidatura guidata
              </button>
              <button
                type="button"
                onClick={() => handleNavigate('waiting-room')}
                className="hover:text-[#0B1F4D] underline underline-offset-2 cursor-pointer"
              >
                Area Personale
              </button>
              <button
                type="button"
                onClick={() => setFooterPrivacyOpen(true)}
                className="hover:text-[#0B1F4D] underline underline-offset-2 cursor-pointer"
              >
                Informativa Privacy (v{publicConfig.versioneInformativa})
              </button>
              <button
                type="button"
                onClick={() => handleNavigate('admin')}
                className="hover:text-[#0B1F4D] underline underline-offset-2 cursor-pointer"
              >
                Area Staff
              </button>
            </div>
          </div>
        </div>
      </footer>

      <PrivacyModal
        open={footerPrivacyOpen}
        version={publicConfig.versioneInformativa}
        operationalEmail={publicConfig.emailOperativa}
        onClose={() => setFooterPrivacyOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
        <FicupPortal />
      </MotionConfig>
    </ErrorBoundary>
  );
}
