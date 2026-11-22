import {
  ArrowRight,
  Bot,
  CalendarDays,
  ChevronDown,
  DoorOpen,
  ExternalLink,
  Eye,
  Flame,
  Gavel,
  Globe2,
  LineChart,
  Radio,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { useRef, useState } from 'react';
import editorialStadiumImg from '../assets/images/ficup_editorial_stadium_1794899930151.jpg';
import stadiumHeroImg from '../assets/images/ficup_stadium_hero_1794862341799.jpg';
import tacticalArenaImg from '../assets/images/ficup_tactical_arena_1794895608683.jpg';
import virtualUniverseImg from '../assets/images/ficup_virtual_universe_1795121886770.jpg';
import type { FirebaseEnvironmentDiagnostics } from '../lib/firebase';
import type { ConfigurazionePublica } from '../lib/firestore';
import { FicupLogo } from './FicupLogo';
import { RegulationsSection } from './RegulationsSection';

interface HomePageProps {
  config: Omit<ConfigurazionePublica, 'updatedAt' | 'updatedBy'>;
  diagnostics: FirebaseEnvironmentDiagnostics | null;
  hasWaitingPass?: boolean;
  onStartWizard: () => void;
  onOpenWaitingRoom: () => void;
  onScrollToStory: () => void;
}

const STORY_CHAPTERS = [
  {
    era: 'Circa 32 anni fa',
    title: 'Dove tutto è cominciato',
    text: 'Da circa 32 anni il Fantacalcio accompagna la vita del suo fondatore, Fabrizio Amoroso. All’inizio era semplicemente un modo per stare insieme agli amici e ai parenti, condividere le domeniche calcistiche, discutere di formazioni, aspettare un gol e vivere quelle emozioni che soltanto chi ama questo gioco può comprendere.',
  },
  {
    era: '2013',
    title: 'La nascita di FantaItalia',
    text: 'Nel 2013 nasce FantaItalia. Un progetto costruito intorno a un gruppo di amici e parenti, con un gruppo WhatsApp, una pagina Facebook, tante risate, discussioni, competizione e momenti da ricordare. Era un’esperienza a pagamento, ma soprattutto era un modo per condividere una passione.',
  },
  {
    era: 'Il cambiamento',
    title: 'Quando un capitolo sembra chiudersi',
    text: 'Poi, con il passare degli anni, qualcosa cambia. Il gruppo si scioglie definitivamente. Quello che sembrava un capitolo destinato a continuare si interrompe. Le abitudini cambiano, le persone prendono strade diverse e un pezzo di quella storia sembra arrivato al capolinea.',
  },
  {
    era: 'La ripartenza',
    title: 'Dalle ceneri nasce FANTA ITALIA CUP',
    text: 'Ma certe passioni non si spengono così facilmente. Fabrizio avrebbe potuto considerare tutto finito. Invece decide di ripartire. Dalle ceneri di FantaItalia nasce una nuova idea: FANTA ITALIA CUP. Un progetto diverso, più ambizioso e aperto a tutti. Una lega nazionale completamente gratuita, capace di accogliere appassionati provenienti da ogni parte d’Italia.',
  },
  {
    era: 'Oggi',
    title: 'Una community che continua a evolversi',
    text: 'Fabrizio mette a disposizione il proprio tempo, la propria passione e le proprie energie. Nascono nuove competizioni, nuove iniziative, un’applicazione ufficiale e strumenti pensati per rendere ogni giornata più coinvolgente. Accanto al fondatore collaborano persone che condividono la stessa passione e lo stesso spirito: Michele, Daniele, Dennis, Alessandro e Giuseppe. Non sono soltanto nomi da inserire in una pagina: sono persone che contribuiscono a portare avanti un progetto comune.',
  },
] as const;

const PHILOSOPHY_POINTS = [
  {
    num: '01',
    title: 'Lega nazionale gratuita',
    detail:
      'La partecipazione alla lega è completamente gratuita: nessuna quota d’ingresso, conta soltanto la voglia di mettersi in gioco.',
  },
  {
    num: '02',
    title: 'Partecipanti provenienti da tutta Italia',
    detail:
      'Un punto d’incontro per fantallenatori di ogni regione uniti dalla stessa passione per la Serie A e per la competizione.',
  },
  {
    num: '03',
    title: 'Competizioni e iniziative',
    detail:
      'Non soltanto una classifica da controllare la domenica: sfide parallele, appuntamenti fissi e momenti condivisi per tutta la stagione.',
  },
  {
    num: '04',
    title: 'Community e spirito di squadra',
    detail:
      'Un ambiente organizzato, rispettoso e vivo dove il confronto quotidiano in chat rende ogni giornata più intensa.',
  },
  {
    num: '05',
    title: 'Innovazione e sviluppo continuo',
    detail:
      'Un progetto costruito nel tempo con dedizione, strumenti digitali dedicati e uno sguardo sempre rivolto al passo successivo.',
  },
] as const;

const APP_FEATURES = [
  {
    title: 'Statistiche e classifiche della lega',
    subtitle: 'Andamento aggiornato del campionato',
    icon: LineChart,
  },
  {
    title: 'Probabili formazioni',
    subtitle: 'Supporto rapido prima di schierare l’undici',
    icon: Users,
  },
  {
    title: 'Risultati LIVE',
    subtitle: 'Segui ogni giornata in tempo reale',
    icon: Radio,
  },
  {
    title: 'Calendario delle partite',
    subtitle: 'Turni, incroci e appuntamenti della stagione',
    icon: CalendarDays,
  },
] as const;

const OFFICIAL_APP_LOGO_URL = 'https://i.ibb.co/DHbqcjPH/image-de89ce2f.jpg';
const APP_SCREENSHOT_URL =
  'https://i.ibb.co/9k0styGq/Screenshot-20261120-074935-com-android-chrome-Custom-Tab-Activity.jpg';
const HERO_FISCHIETTO_URL = 'https://i.ibb.co/YFdp0Kxf/grok-1795165148484.png';
const FISCHIETTO_IMAGE_URL = 'https://i.ibb.co/G3ng4nBt/grok-1795123703047.png';

const COMPETITIONS_LIST = [
  {
    name: 'FANTASCHEDINA SERIE A',
    logoUrl: 'https://i.ibb.co/KprBFnk3/Serie-A-Enilive-25-26-svg.png',
    accentGlow: 'from-sky-500/20 via-blue-600/10 to-transparent',
    accentBar: 'from-sky-500 to-blue-700',
  },
  {
    name: 'FANTASCHEDINA SERIE B',
    logoUrl: 'https://i.ibb.co/VkTJn48/Serie-BKT-svg.png',
    accentGlow: 'from-emerald-500/20 via-teal-600/10 to-transparent',
    accentBar: 'from-emerald-500 to-teal-700',
  },
  {
    name: 'FANTA CHAMPIONS',
    logoUrl: 'https://i.ibb.co/Jjbkbz3F/UEFA-Champions-League-logo.png',
    accentGlow: 'from-indigo-500/20 via-blue-900/10 to-transparent',
    accentBar: 'from-indigo-600 to-[#0B1F4D]',
  },
  {
    name: 'FANTA FUTSAL',
    logoUrl: 'https://i.ibb.co/SXmGB4fX/IMG-c2c5f20d-cf9f-41c3-9eba-35deb0800596.png',
    accentGlow: 'from-amber-500/25 via-[#C69214]/12 to-transparent',
    accentBar: 'from-[#D4AF37] to-[#C69214]',
  },
] as const;

const SUPER_ADMIN_PILLARS = [
  'Coordinamento generale',
  'Visione e sviluppo',
  'Organizzazione',
  'Responsabilità e supervisione',
] as const;

const TEAM_ADMIN_PROFILES = [
  {
    num: '01',
    name: 'MICHELE CONTARINO',
    subtitle: 'Il cuore pulsante della FICUP',
    paragraphs: [
      'Da tre anni è una presenza fondamentale nella famiglia FICUP. Porta con sé ben 22 anni di esperienza nel Fantacalcio, una conoscenza maturata nel tempo e soprattutto una passione autentica.',
      'È uno di quelli che vive il Fantacalcio con la giusta cazzimma: competenza, grinta, entusiasmo e amore per la lega.',
      'Non è soltanto un amministratore, ma una delle anime che contribuiscono a tenere viva FICUP.',
    ],
    signature: 'La sua firma: esperienza, cuore e cazzimma fantacalcistica.',
  },
  {
    num: '02',
    name: 'DANIELE AZZENI',
    subtitle: 'Serietà, esperienza e passione',
    paragraphs: [
      "Da circa tre anni in FICUP, porta con sé un'esperienza decennale nel Fantacalcio.",
      'Non è un semplice admin: è una presenza che contribuisce con serietà, attenzione e spirito di gruppo alla gestione della comunità.',
      'La passione per il gioco e il senso di responsabilità lo contraddistinguono.',
    ],
    signature: 'La sua firma: affidabilità, equilibrio e dedizione.',
  },
  {
    num: '03',
    name: 'ALESSANDRO STAVOLO',
    subtitle: 'Lo spirito di gruppo prima di tutto',
    paragraphs: [
      'Da circa tre anni in FICUP, con quattro anni di esperienza nel Fantacalcio, si è distinto fin da subito per il suo modo di vivere la lega.',
      'Passione, serietà e spirito di gruppo sono le caratteristiche che lo contraddistinguono.',
      'Una presenza che dimostra come in FICUP contino non soltanto le competenze, ma anche il modo di stare insieme e contribuire al progetto.',
    ],
    signature: 'La sua firma: entusiasmo, correttezza e spirito di squadra.',
  },
  {
    num: '04',
    name: 'DENNIS AMOROSO',
    subtitle: 'La spinta giusta quando serve',
    paragraphs: [
      'Da circa quattro anni in FICUP, è una presenza preziosa che spesso lavora dietro le quinte.',
      "Non sempre serve stare al centro della scena: a volte è proprio chi lavora in silenzio a dare quella spinta in più quando ce n'è bisogno.",
      'Conosce la realtà FICUP e sa quando intervenire per dare il proprio contributo.',
    ],
    signature: 'La sua firma: presenza, concretezza e supporto silenzioso.',
  },
  {
    num: '05',
    name: 'GIUSEPPE MAIORANA',
    subtitle: 'Il nostro magnate russo',
    paragraphs: [
      "Da circa tre anni in FICUP, porta con sé un'esperienza ventennale nel Fantacalcio.",
      "Opera dall'estero, è uno di poche parole, ma non fatevi ingannare dal silenzio: quando arriva un suo suggerimento, spesso è una vera bomba.",
      'Ha un modo tutto suo di osservare le situazioni e proporre idee che possono fare la differenza.',
      'Il nostro magnate russo: poche parole, idee pesanti e una visione che arriva anche da lontano.',
    ],
    signature: 'La sua firma: esperienza, intuito e suggerimenti esplosivi.',
  },
] as const;

const ZONA_VAR_POINTS = [
  'Attenzione ai dettagli.',
  'Controllo delle informazioni.',
  'Verifica delle comunicazioni e delle disposizioni.',
  'Supporto alle attività della lega.',
  'Ricerca di eventuali anomalie, quando sono disponibili gli strumenti e i dati necessari.',
  'Trasparenza e chiarezza per i partecipanti.',
] as const;

export function HomePage({
  config,
  diagnostics,
  hasWaitingPass = false,
  onStartWizard,
  onOpenWaitingRoom,
  onScrollToStory,
}: HomePageProps) {
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [storyImgFailed, setStoryImgFailed] = useState(false);
  const [virtualImgFailed, setVirtualImgFailed] = useState(false);
  const [universeImgFailed, setUniverseImgFailed] = useState(false);
  const [officialAppLogoFailed, setOfficialAppLogoFailed] = useState(false);
  const [appScreenshotFailed, setAppScreenshotFailed] = useState(false);
  const [heroFischiettoFailed, setHeroFischiettoFailed] = useState(false);
  const [heroVideoFailed, setHeroVideoFailed] = useState(false);
  const [fischiettoImgFailed, setFischiettoImgFailed] = useState(false);
  const [failedCompetitionLogos, setFailedCompetitionLogos] = useState<Record<string, boolean>>({});
  const prefersReducedMotion = useReducedMotion();

  const heroContainerRef = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: heroContainerRef,
    offset: ['start start', 'end start'],
  });
  const photoY = useTransform(scrollYProgress, [0, 1], ['0%', '10%']);

  const isClosed = !config.iscrizioniAperte;
  const hasBackendWarning =
    diagnostics !== null && (!diagnostics.config.configured || !diagnostics.firestore.ok);

  return (
    <div className="bg-white text-[#0B1F4D]">
      {/* Eventuale avviso iscrizioni chiuse o backend */}
      {(isClosed || hasBackendWarning) && (
        <div className="border-b border-amber-200 bg-amber-50/90">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-start gap-3 text-xs sm:text-sm text-amber-950">
            <ShieldCheck className="w-4 h-4 text-[#C69214] shrink-0 mt-0.5" />
            <div>
              {isClosed ? (
                <p>
                  <strong>Iscrizioni momentaneamente chiuse:</strong> lo staff ha sospeso la ricezione di nuove candidature per la stagione {config.stagione}.
                </p>
              ) : (
                <p>
                  <strong>Avviso tecnico Firebase:</strong>{' '}
                  {diagnostics?.config.configured === false
                    ? 'Configurazione Web App incompleta nell’ambiente.'
                    : diagnostics?.firestore.detail}{' '}
                  L&apos;invio effettivo della candidatura al database richiede che Cloud Firestore e le regole di sicurezza siano attivi su <span className="font-mono-tabular">candidature-ficup</span>.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          3. HERO SECTION — BIANCO EDITORIALE, BLU NOTTE & ORO
         ===================================================================== */}
      <section
        ref={heroContainerRef}
        className="relative bg-white border-b border-slate-200/80 overflow-hidden"
      >
        <div
          aria-hidden="true"
          className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-slate-50/90 to-transparent pointer-events-none"
        />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 lg:py-16">
          <div className="grid grid-cols-12 gap-x-3 gap-y-5 sm:gap-x-6 md:gap-x-10 lg:gap-x-12 items-center">
            {/* Institutional Lockup */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
              className="col-span-12 md:col-span-7 md:col-start-1 md:row-start-1 flex items-center gap-3.5 sm:gap-4 min-w-0"
            >
              <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-xs shrink-0">
                <FicupLogo size="md" />
              </div>
              <div className="min-w-0">
                <p className="font-display text-lg sm:text-xl font-extrabold tracking-tight text-[#0B1F4D]">
                  FANTA ITALIA CUP
                </p>
                <p className="text-xs font-bold tracking-[0.2em] uppercase text-[#C69214]">
                  L&apos;universo del Fantacalcio
                </p>
              </div>
            </motion.div>

            {/* Title — ALWAYS LEFT beside Image 1 on Mobile and Desktop */}
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.08, ease: 'easeOut' }}
              className="col-span-7 md:col-span-7 md:col-start-1 md:row-start-2 min-w-0 font-display text-[1.6rem] sm:text-[2.2rem] md:text-5xl lg:text-[3.7rem] font-black tracking-tight text-[#0B1F4D] leading-[1.06] text-balance"
            >
              NON È SOLTANTO FANTACALCIO. È UNA PASSIONE CHE UNISCE L&apos;ITALIA.
            </motion.h1>

            {/* Right: Attached Animated Video asset strictly to the RIGHT of the Hero Title on Mobile and Desktop */}
            <motion.div
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 6 }}
              animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              transition={
                prefersReducedMotion
                  ? { duration: 0.3 }
                  : { duration: 1.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }
              }
              className="col-span-5 md:col-span-5 md:col-start-8 md:row-start-1 md:row-span-3 min-w-0 flex items-center justify-end self-center"
            >
              {!heroVideoFailed ? (
                <video
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="auto"
                  poster={HERO_FISCHIETTO_URL}
                  onError={() => setHeroVideoFailed(true)}
                  className="w-full max-w-[175px] sm:max-w-[270px] md:max-w-[350px] lg:max-w-[420px] xl:max-w-[450px] h-auto object-contain rounded-2xl shadow-[0_20px_50px_rgba(11,31,77,0.18)] select-none bg-transparent"
                >
                  <source
                    src={`${import.meta.env.BASE_URL}assets/aistudio/Arbitro_muove_gli_occhi_e_a429b652_438cfe9e.mp4`}
                    type="video/mp4"
                  />
                  Il tuo browser non supporta il tag video.
                </video>
              ) : (
                <img
                  src={HERO_FISCHIETTO_URL}
                  alt="Il Fischietto FICUP"
                  loading="eager"
                  referrerPolicy="no-referrer"
                  className="w-full max-w-[175px] sm:max-w-[270px] md:max-w-[350px] lg:max-w-[420px] xl:max-w-[450px] h-auto object-contain rounded-2xl shadow-[0_20px_50px_rgba(11,31,77,0.18)] select-none"
                />
              )}
            </motion.div>

            {/* Description + CTAs (Full width on mobile below Title+Image row; Left column on desktop) */}
            <div className="col-span-12 md:col-span-7 md:col-start-1 md:row-start-3 min-w-0 space-y-5 sm:space-y-6">
              <motion.p
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.16, ease: 'easeOut' }}
                className="text-base sm:text-base md:text-lg text-slate-600 leading-relaxed max-w-2xl"
              >
                Una lega nazionale gratuita, una community di appassionati, competizioni, tecnologia e nuove sfide. Fanta Italia Cup nasce dalla passione per il calcio e cresce grazie alle persone che ogni stagione scelgono di farne parte.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.22, ease: 'easeOut' }}
                className="pt-1 sm:pt-2 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3"
              >
                <button
                  type="button"
                  onClick={onStartWizard}
                  disabled={isClosed}
                  className="min-h-[50px] px-6 py-3.5 rounded-xl bg-[#0B1F4D] text-white text-sm font-bold hover:bg-[#153985] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all inline-flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                >
                  <span>{isClosed ? 'Candidature chiuse' : 'ENTRA IN CAMPO ORA'}</span>
                  <ArrowRight className="w-4 h-4 text-[#D4AF37]" />
                </button>

                <button
                  type="button"
                  onClick={onOpenWaitingRoom}
                  className="min-h-[50px] px-5 py-3.5 rounded-xl border border-slate-300 bg-white text-[#0B1F4D] text-sm font-bold hover:bg-slate-50 hover:border-[#0B1F4D]/40 active:scale-[0.98] transition-all inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <DoorOpen className="w-4 h-4 text-[#0284C7]" />
                  <span>Area Personale</span>
                </button>

                <button
                  type="button"
                  onClick={onScrollToStory}
                  className="min-h-[46px] px-3 py-2 text-[#0B1F4D] text-xs sm:text-sm font-semibold hover:text-[#153985] transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Scopri la nostra storia</span>
                  <ChevronDown className="w-4 h-4 text-[#C69214]" />
                </button>
              </motion.div>

              {hasWaitingPass && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={onOpenWaitingRoom}
                    className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#0284C7] hover:text-[#0B1F4D] underline underline-offset-4 cursor-pointer"
                  >
                    <DoorOpen className="w-4 h-4" />
                    <span>Hai una candidatura salvata: monitora lo stato nell&apos;Area Personale</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Bright Architectural Stadium Composition preserved below Hero lockup */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.65, delay: 0.18, ease: 'easeOut' }}
            className="mt-8 sm:mt-10 lg:mt-12"
          >
            <div className="relative rounded-3xl overflow-hidden border border-slate-200 bg-slate-100 shadow-lg aspect-[16/10] sm:aspect-[21/9] lg:aspect-[24/8]">
              <motion.div style={{ y: photoY }} className="w-full h-[112%] -mt-[4%]">
                {!heroImgFailed ? (
                  <img
                    src={editorialStadiumImg}
                    alt="Stadio illuminato dal sole per FANTA ITALIA CUP"
                    onError={() => setHeroImgFailed(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[#0B1F4D] to-[#153985]" />
                )}
              </motion.div>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0B1F4D]/90 via-[#0B1F4D]/45 to-transparent p-5 sm:p-6">
                <p className="text-[11px] font-bold uppercase tracking-widest text-[#FDE68A]">
                  Lega Nazionale Gratuita · Fantaleghe
                </p>
                <p className="mt-1 font-display text-base sm:text-lg font-bold text-white">
                  Stagione {config.stagione} · Una community costruita sulla passione autentica
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* =====================================================================
          3B. PERCORSO DI INGRESSO IN 3 PASSAGGI CHIARI
         ===================================================================== */}
      <section className="bg-slate-50/60 border-b border-slate-200 py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-2 max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C69214]">
                Percorso ufficiale FICUP {config.stagione}
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-black tracking-tight text-[#0B1F4D]">
                COME FUNZIONA L&apos;INGRESSO NELLA LEGA
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-600">
              Stagione {config.stagione} · {config.modalitaMercato} · {config.budgetIniziale} crediti · Quota 0 €
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            <motion.div
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.45, delay: 0 }}
              className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-2.5 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
            >
              <p className="font-mono-tabular text-xs font-bold text-[#C69214]">01 · CANDIDATURA</p>
              <h3 className="font-display text-lg font-extrabold text-[#0B1F4D]">
                1. Presenta la candidatura
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Inserisci i tuoi dati Fantaleghe, prendi visione di Privacy, Regolamento PDF e Regole ufficiali della chat WhatsApp e ottieni subito il codice <span className="font-mono-tabular font-semibold text-[#0B1F4D]">FICUP26</span>.
              </p>
            </motion.div>

            <motion.div
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.45, delay: 0.08 }}
              className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-2.5 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
            >
              <p className="font-mono-tabular text-xs font-bold text-[#0284C7]">02 · VALUTAZIONE</p>
              <h3 className="font-display text-lg font-extrabold text-[#0B1F4D]">
                2. Attendi la valutazione dello staff
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Segui ogni aggiornamento in tempo reale nella tua Area Personale e coordinati sul gruppo provvisorio con il tuo codice identificativo.
              </p>
            </motion.div>

            <motion.div
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.45, delay: 0.16 }}
              className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-2.5 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
            >
              <p className="font-mono-tabular text-xs font-bold text-emerald-700">03 · COMMUNITY</p>
              <h3 className="font-display text-lg font-extrabold text-[#0B1F4D]">
                3. Ottieni squadra e gruppo ufficiale
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Ricevi l&apos;invito ufficiale su Fantaleghe, completa la tua squadra e sblocca il collegamento al Gruppo WhatsApp Ufficiale autorizzato dallo staff.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          4. LA NOSTRA STORIA — IL CUORE DEL PROGETTO
         ===================================================================== */}
      <section
        id="la-nostra-storia"
        className="scroll-mt-20 bg-slate-50/70 border-b border-slate-200 py-16 sm:py-24"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-16">
          {/* Editorial Intro Header */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.5 }}
            className="max-w-3xl space-y-4"
          >
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C69214]">
              La nostra storia · Il cuore del progetto
            </p>
            <h2 className="font-display text-3xl sm:text-4xl lg:text-[2.6rem] font-black tracking-tight text-[#0B1F4D] text-balance leading-[1.12]">
              Tutto comincia molto prima che esistesse FANTA ITALIA CUP.
            </h2>
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
              Questa non è nata come un&apos;iniziativa commerciale. È la storia di una passione durata decenni, di un gruppo che sembrava finito e della scelta di ricominciare per dare vita a qualcosa di aperto a tutta l&apos;Italia.
            </p>
          </motion.div>

          {/* Animated Vertical Timeline */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
            <div className="lg:col-span-7 relative pl-6 sm:pl-8 border-l-2 border-[#C69214]/35 space-y-10">
              {STORY_CHAPTERS.map((chapter, idx) => (
                <motion.article
                  key={chapter.title}
                  initial={{ opacity: 0, x: -12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ duration: 0.45, delay: idx * 0.05 }}
                  className="relative"
                >
                  <span
                    aria-hidden="true"
                    className="absolute -left-[31px] sm:-left-[39px] top-1.5 w-3.5 h-3.5 rounded-full bg-white border-[3px] border-[#C69214]"
                  />
                  <p className="font-mono-tabular text-xs font-bold uppercase tracking-wider text-[#C69214]">
                    {chapter.era}
                  </p>
                  <h3 className="mt-1 font-display text-xl sm:text-2xl font-bold text-[#0B1F4D]">
                    {chapter.title}
                  </h3>
                  <p className="mt-2.5 text-sm sm:text-base text-slate-700 leading-relaxed">
                    {chapter.text}
                  </p>
                </motion.article>
              ))}
            </div>

            {/* Side Narrative Visual + Bridge Paragraph */}
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5 }}
              className="lg:col-span-5 lg:sticky lg:top-24 space-y-6"
            >
              <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm aspect-[16/10]">
                {!storyImgFailed ? (
                  <img
                    src={stadiumHeroImg}
                    alt="Atmosfera serale dello stadio"
                    loading="lazy"
                    onError={() => setStoryImgFailed(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-[#0B1F4D]" />
                )}
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3 shadow-xs">
                <p className="text-xs font-bold uppercase tracking-widest text-[#0284C7]">
                  Una nuova idea di community
                </p>
                <p className="text-sm sm:text-base text-slate-700 leading-relaxed">
                  Questa volta non si tratta soltanto di organizzare un Fantacalcio. Si tratta di costruire qualcosa che possa durare, crescere e coinvolgere persone che magari non si sono mai incontrate, ma che condividono lo stesso entusiasmo.
                </p>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Piano piano, quella che era nata come una passione personale diventa una community. E un progetto che continua a evolversi, risultato di tentativi, sacrifici, entusiasmo, idee e persone che hanno scelto di esserci.
                </p>
              </div>
            </motion.div>
          </div>

          {/* =================================================================
              LA FRASE CENTRALE — DA RIPORTARE ESATTAMENTE
             ================================================================= */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.65, ease: 'easeOut' }}
            className="relative rounded-3xl bg-white border border-[#C69214]/35 px-6 py-10 sm:px-12 sm:py-14 text-center shadow-sm overflow-hidden"
          >
            <div
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-[#C69214] to-transparent"
            />
            <div className="max-w-4xl mx-auto space-y-5">
              <div className="flex items-center justify-center gap-3 text-xs font-bold uppercase tracking-[0.22em] text-[#C69214]">
                <span className="h-px w-8 bg-[#C69214]/50" />
                <span>Il senso di FANTA ITALIA CUP</span>
                <span className="h-px w-8 bg-[#C69214]/50" />
              </div>

              <blockquote className="font-editorial italic font-semibold text-2xl sm:text-3xl lg:text-[2.45rem] text-[#0B1F4D] leading-[1.32] text-balance">
                &ldquo;Le leghe possono finire, i gruppi possono sciogliersi, ma una vera passione trova sempre un modo per ricominciare. E a volte, proprio quando sembra tutto finito, inizia la storia più bella.&rdquo;
              </blockquote>
            </div>
          </motion.div>

          {/* Chiusura del racconto */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5 }}
            className="max-w-3xl mx-auto text-center space-y-4"
          >
            <p className="text-base sm:text-lg text-slate-700 leading-relaxed">
              Un giorno, forse, qualcuno si ricorderà di una formazione schierata all&apos;ultimo secondo, di una vittoria festeggiata in chat, di un gol aspettato per novanta minuti o di una domenica passata a controllare i risultati.
            </p>
            <p className="font-display text-lg sm:text-xl font-bold text-[#0B1F4D]">
              E capirà che non stava semplicemente giocando a Fantacalcio.
            </p>
            <p className="font-display text-xl sm:text-2xl font-black text-[#C69214]">
              Stava facendo parte di qualcosa.
            </p>
          </motion.div>
        </div>
      </section>

      {/* =====================================================================
          5. UNA LEGA NAZIONALE, COMPLETAMENTE GRATUITA
         ===================================================================== */}
      <section className="bg-white border-b border-slate-200 py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5 }}
              className="lg:col-span-5 lg:sticky lg:top-24 space-y-5"
            >
              <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#0284C7]">
                <Globe2 className="w-4 h-4" />
                <span>Filosofia della lega</span>
              </div>
              <h2 className="font-display text-3xl sm:text-4xl font-black tracking-tight text-[#0B1F4D] text-balance leading-[1.12]">
                UNA PASSIONE SENZA CONFINI. UNA COMMUNITY DA TUTTA ITALIA.
              </h2>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                FANTA ITALIA CUP è una lega nazionale gratuita, nata per permettere agli appassionati di vivere il Fantacalcio in un ambiente organizzato, coinvolgente e ricco di iniziative.
              </p>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                Non vogliamo che il Fantacalcio sia soltanto una classifica da controllare. Vogliamo creare occasioni per divertirsi, confrontarsi, competere e sentirsi parte di una community.
              </p>
              <p className="text-sm sm:text-base font-semibold text-[#0B1F4D] leading-relaxed">
                La partecipazione alla lega è gratuita. Il valore del progetto è rappresentato dalle persone, dalla passione e dal tempo dedicato a costruire qualcosa insieme.
              </p>
            </motion.div>

            {/* Clean Numbered Editorial List (NO card cloning) */}
            <div className="lg:col-span-7 divide-y divide-slate-200 border-y border-slate-200">
              {PHILOSOPHY_POINTS.map((point, idx) => (
                <motion.div
                  key={point.num}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.4, delay: idx * 0.05 }}
                  className="py-6 flex items-start gap-4 sm:gap-6"
                >
                  <span className="font-mono-tabular text-sm sm:text-base font-bold text-[#C69214] pt-0.5 shrink-0">
                    {point.num}
                  </span>
                  <div className="space-y-1">
                    <h3 className="font-display text-lg sm:text-xl font-bold text-[#0B1F4D]">
                      {point.title}
                    </h3>
                    <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                      {point.detail}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          6. APRI L'APP FICUP — SMARTPHONE 3D PROTAGONISTA CON SCREENSHOT UFFICIALE
         ===================================================================== */}
      <section
        id="app-ufficiale"
        className="scroll-mt-20 relative w-full bg-[#071436] text-white overflow-hidden py-18 sm:py-26"
      >
        {/* Subtle full-width golden horizon hairlines & atmospheric spotlight */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#D4AF37]/70 to-transparent"
        />
        <div
          aria-hidden="true"
          className="absolute -left-24 top-1/2 -translate-y-1/2 w-[540px] h-[540px] rounded-full bg-[radial-gradient(circle,rgba(212,175,55,0.18)_0%,rgba(2,132,199,0.14)_42%,transparent_72%)] pointer-events-none"
        />
        <div
          aria-hidden="true"
          className="absolute right-0 bottom-0 w-[440px] h-[440px] bg-[radial-gradient(circle_at_bottom_right,rgba(2,132,199,0.12)_0%,transparent_70%)] pointer-events-none"
        />

        <div className="relative z-10 w-full px-5 sm:px-10 lg:px-16 xl:px-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            {/* Protagonist: Vertical Tilted 3D Suspended Smartphone displaying the Exact App Screenshot */}
            <motion.div
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 28, scale: 0.95 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, margin: '-70px' }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
              className="lg:col-span-6 flex flex-col items-center justify-center relative py-4"
            >
              {/* Warm golden & sky volumetric aura behind suspended phone */}
              <div
                aria-hidden="true"
                className="absolute inset-4 bg-[radial-gradient(ellipse_at_center,rgba(212,175,55,0.24)_0%,rgba(2,132,199,0.18)_48%,transparent_74%)] pointer-events-none blur-2xl"
              />

              <motion.div
                animate={prefersReducedMotion ? undefined : { y: [-7, 7, -7] }}
                transition={
                  prefersReducedMotion
                    ? undefined
                    : { duration: 6.5, repeat: Infinity, ease: 'easeInOut' }
                }
                className="relative w-full max-w-[270px] sm:max-w-[300px] lg:max-w-[320px] z-10"
              >
                {/* Realistic Tilted 3D Perspective Flagship Titanium Chassis */}
                <div className="relative group [transform:perspective(1050px)_rotateY(-10deg)_rotateX(4deg)_rotateZ(1deg)] lg:[transform:perspective(1250px)_rotateY(-18deg)_rotateX(7deg)_rotateZ(2deg)] lg:hover:[transform:perspective(1250px)_rotateY(-4deg)_rotateX(2deg)_rotateZ(0deg)] transition-transform duration-700 ease-out">
                  {/* 3D Side Metallic Edge Rim for Realistic Volumetric Depth */}
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-3 -right-2.5 w-6 rounded-r-[2.6rem] bg-gradient-to-b from-slate-400 via-slate-600 to-slate-900 border-r border-white/25 -z-10"
                  />
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-4 -bottom-2 h-5 rounded-b-[2.6rem] bg-gradient-to-r from-slate-800 via-slate-600 to-slate-900 -z-10"
                  />

                  {/* Outer Metallic Bezel & Deep 3D Shadow */}
                  <div className="relative rounded-[2.6rem] bg-gradient-to-br from-slate-300 via-slate-600 to-slate-900 p-[3px] shadow-[24px_38px_72px_-18px_rgba(0,0,0,0.92),0_0_46px_-14px_rgba(212,175,55,0.34)]">
                    {/* Hardware Side Buttons */}
                    <span
                      aria-hidden="true"
                      className="hidden sm:block absolute -left-[4px] top-24 h-9 w-[3px] bg-slate-400 rounded-l-xs"
                    />
                    <span
                      aria-hidden="true"
                      className="hidden sm:block absolute -left-[4px] top-36 h-12 w-[3px] bg-slate-400 rounded-l-xs"
                    />
                    <span
                      aria-hidden="true"
                      className="hidden sm:block absolute -right-[5px] top-28 h-14 w-[3px] bg-slate-300 rounded-r-xs"
                    />

                    {/* Inner Dark Bezel */}
                    <div className="relative rounded-[2.45rem] bg-[#040B1C] p-2">
                      {/* Glass OLED Screen Viewport showing the Exact Official Screenshot Uncropped */}
                      <div className="relative rounded-[2rem] bg-[#050E26] overflow-hidden border border-white/15">
                        {/* Specular Diagonal Glass Reflection */}
                        <div
                          aria-hidden="true"
                          className="pointer-events-none absolute -top-24 -left-12 w-56 h-[130%] -rotate-12 bg-gradient-to-r from-white/12 via-white/[0.03] to-transparent z-10"
                        />

                        {!appScreenshotFailed ? (
                          <img
                            src={APP_SCREENSHOT_URL}
                            alt="Schermata reale dell'App Ufficiale FANTA ITALIA CUP su smartphone"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            onError={() => setAppScreenshotFailed(true)}
                            className="w-full h-auto object-contain block select-none"
                          />
                        ) : (
                          <div className="py-20 px-6 flex flex-col items-center justify-center gap-4 text-center">
                            <FicupLogo size="lg" />
                            <p className="font-display text-sm font-black tracking-wide text-white">
                              FANTA ITALIA CUP · APP UFFICIALE
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Soft Ground Reflection Shadow under Floating 3D Phone */}
              <div
                aria-hidden="true"
                className="mt-6 w-56 sm:w-64 h-6 rounded-full bg-black/65 blur-xl pointer-events-none"
              />
            </motion.div>

            {/* Right: Preserved Official Logo Lockup + Editorial Copy + Unboxed Capabilities + Exact Existing CTA */}
            <div className="lg:col-span-6 space-y-7">
              <motion.div
                initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-70px' }}
                transition={{ duration: 0.55, delay: 0.08 }}
                className="space-y-4"
              >
                <div className="inline-flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.22em] text-[#FDE68A]">
                  <Smartphone className="w-4 h-4 text-[#D4AF37]" />
                  <span>Il cuore digitale della community</span>
                </div>

                <div className="flex items-center gap-4 sm:gap-5">
                  {!officialAppLogoFailed ? (
                    <img
                      src={OFFICIAL_APP_LOGO_URL}
                      alt="Logo ufficiale App FANTA ITALIA CUP"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={() => setOfficialAppLogoFailed(true)}
                      className="w-16 h-16 sm:w-20 sm:h-20 object-contain rounded-xl ring-1 ring-[#D4AF37]/40 bg-[#040B1C] p-1 shadow-[0_10px_28px_-8px_rgba(212,175,55,0.45)] shrink-0"
                    />
                  ) : (
                    <div className="shrink-0">
                      <FicupLogo size="md" />
                    </div>
                  )}
                  <h2 className="font-display text-3xl sm:text-5xl lg:text-[3.35rem] font-black tracking-tight text-white leading-[1.04] text-balance">
                    APRI L&apos;APP FICUP
                  </h2>
                </div>

                <p className="text-base sm:text-lg text-slate-200 leading-relaxed max-w-2xl">
                  Non è una semplice App, ma il cuore della nostra community! Abbiamo realizzato uno spazio tutto nostro, pensato per offrirti un&apos;esperienza completa e permetterti di vivere la FICUP in ogni momento della stagione.
                </p>
              </motion.div>

              {/* Open Unboxed Hairline Capabilities Matrix */}
              <motion.div
                initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.55, delay: 0.14 }}
                className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5 border-y border-white/15 py-6"
              >
                {APP_FEATURES.map((feat) => {
                  const Icon = feat.icon;
                  return (
                    <div key={feat.title} className="flex items-start gap-3.5">
                      <Icon className="w-5 h-5 text-[#D4AF37] shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <h3 className="font-display text-sm sm:text-base font-bold text-white">
                          {feat.title}
                        </h3>
                        <p className="text-xs text-slate-300 leading-relaxed">{feat.subtitle}</p>
                      </div>
                    </div>
                  );
                })}
              </motion.div>

              {/* Preserved Official Access Button & Exact URL */}
              <motion.div
                initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.55, delay: 0.2 }}
                className="flex flex-col sm:flex-row sm:items-center gap-4 pt-1"
              >
                <a
                  href="https://ficup-26-27.ai.studio/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group min-h-[58px] px-8 py-4 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#E7C860] to-[#C69214] text-[#071436] text-sm sm:text-base font-black tracking-wide hover:brightness-105 hover:-translate-y-0.5 active:scale-[0.98] transition-all inline-flex items-center justify-center gap-3 shadow-[0_14px_34px_-10px_rgba(212,175,55,0.55)] whitespace-nowrap shrink-0"
                >
                  <span>APRI L&apos;APP FICUP</span>
                  <ExternalLink className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </a>

                <p className="text-xs text-slate-300 leading-relaxed">
                  Accesso immediato iPhone / Web App su{' '}
                  <span className="font-mono-tabular text-[#FDE68A]">ficup-26-27.ai.studio</span>
                  <br />
                  <span className="text-slate-400">
                    Android: link download diretto non ancora configurato
                  </span>
                </p>
              </motion.div>
            </div>
          </div>
        </div>

        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#D4AF37]/60 to-transparent"
        />
      </section>

      {/* =====================================================================
          6A. LE NOSTRE COMPETIZIONI ESCLUSIVE — LOGHI UFFICIALI FULL-WIDTH
         ===================================================================== */}
      <section
        id="competizioni-esclusive"
        className="scroll-mt-20 relative w-full bg-white text-[#0B1F4D] border-b border-slate-200 overflow-hidden py-18 sm:py-24"
      >
        <div className="w-full px-5 sm:px-10 lg:px-16 xl:px-24 space-y-14">
          <motion.div
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-70px' }}
            transition={{ duration: 0.5 }}
            className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-slate-200 pb-8"
          >
            <div className="space-y-3 max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#C69214]">
                Identità esclusiva della lega
              </p>
              <h2 className="font-display text-3xl sm:text-4xl lg:text-[2.85rem] font-black tracking-tight text-[#0B1F4D] leading-[1.08] text-balance">
                LE NOSTRE COMPETIZIONI ESCLUSIVE
              </h2>
            </div>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-md">
              Oltre al campionato principale, l&apos;universo FICUP ospita competizioni parallele ufficiali riconosciute in tutta la community.
            </p>
          </motion.div>

          {/* Full-Width Unboxed 4-Column Showcase (Stacked vertically on mobile, wide 4-up on desktop) */}
          <div className="grid grid-cols-1 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 border-b border-slate-200">
            {COMPETITIONS_LIST.map((comp, idx) => {
              const logoFailed = Boolean(failedCompetitionLogos[comp.name]);
              return (
                <motion.article
                  key={comp.name}
                  initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-50px' }}
                  transition={{ duration: 0.5, delay: idx * 0.08 }}
                  className="group relative py-12 lg:py-10 lg:px-8 first:lg:pl-0 last:lg:pr-0 flex flex-col items-center text-center justify-between gap-7"
                >
                  <div
                    aria-hidden="true"
                    className={`pointer-events-none absolute inset-x-4 top-6 h-40 bg-gradient-to-b ${comp.accentGlow} opacity-60 group-hover:opacity-100 transition-opacity duration-500 blur-2xl`}
                  />

                  <div className="relative flex flex-col items-center gap-2">
                    <span className="font-mono-tabular text-xs font-bold tracking-[0.24em] text-[#C69214]">
                      0{idx + 1}
                    </span>
                    <span
                      aria-hidden="true"
                      className={`h-0.5 w-10 bg-gradient-to-r ${comp.accentBar} transition-all duration-300 group-hover:w-16`}
                    />
                  </div>

                  {/* Official Logo Stage — Undistorted, uncropped, crisp proportions */}
                  <div className="relative w-full min-h-[140px] sm:min-h-[160px] flex items-center justify-center px-4">
                    {!logoFailed ? (
                      <img
                        src={comp.logoUrl}
                        alt={`Logo ufficiale ${comp.name}`}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setFailedCompetitionLogos((prev) => ({ ...prev, [comp.name]: true }))
                        }
                        className="max-h-32 sm:max-h-36 w-auto max-w-[230px] object-contain transition-transform duration-500 ease-out group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-2 text-[#0B1F4D]">
                        <Trophy className="w-10 h-10 text-[#C69214]" />
                        <span className="font-display text-sm font-black uppercase tracking-wide">
                          {comp.name}
                        </span>
                      </div>
                    )}
                  </div>

                  <h3 className="relative font-display text-lg sm:text-xl font-black tracking-tight text-[#0B1F4D] transition-colors duration-300 group-hover:text-[#153985]">
                    {comp.name}
                  </h3>
                </motion.article>
              );
            })}
          </div>
        </div>
      </section>

      {/* =====================================================================
          6B. LE REGOLE DELLA NOSTRA LEGA — CONSULTAZIONE & DOWNLOAD PDF
         ===================================================================== */}
      <RegulationsSection
        season={config.stagione}
        operationalEmail={config.emailOperativa}
      />

      {/* =====================================================================
          7. IL TEAM DIRIGENZIALE FICUP — PRESENTAZIONE FULL-WIDTH SENZA RIQUADRI
         ===================================================================== */}
      <section id="il-team" className="scroll-mt-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-16 space-y-16">
          {/* Editorial Section Title */}
          <motion.div
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-70px' }}
            transition={{ duration: 0.45 }}
            className="max-w-3xl space-y-3"
          >
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C69214]">
              Il team dirigenziale FICUP
            </p>
            <h2 className="font-display text-3xl sm:text-4xl lg:text-[2.6rem] font-black tracking-tight text-[#0B1F4D] text-balance leading-[1.1]">
              LE PERSONE CHE DANNO VITA ALLA COMMUNITY FICUP.
            </h2>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              Non siamo soltanto amministratori di una lega: siamo un gruppo costruito negli anni con esperienza, passione, serietà e spirito di appartenenza.
            </p>
          </motion.div>

          {/* Visual Showcase: Il Mondo Parallelo Virtuale FICUP */}
          <motion.div
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
            className="relative rounded-3xl overflow-hidden border border-slate-200 bg-[#0B1F4D] shadow-lg aspect-[16/10] sm:aspect-[16/8] lg:aspect-[16/7]"
          >
            {!virtualImgFailed ? (
              <img
                src={virtualUniverseImg}
                alt="Mondo parallelo virtuale connesso FANTA ITALIA CUP"
                loading="lazy"
                onError={() => setVirtualImgFailed(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[#0B1F4D] via-[#153985] to-[#0284C7]" />
            )}
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-[#0B1F4D]/95 via-[#0B1F4D]/55 to-[#0B1F4D]/15"
            />
            <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8 lg:p-10 max-w-3xl space-y-2">
              <p className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.2em] text-[#FDE68A]">
                L&apos;esperienza digitale condivisa · FICUP {config.stagione}
              </p>
              <h3 className="font-display text-xl sm:text-3xl lg:text-[2.1rem] font-black text-white leading-[1.12] text-balance">
                NON È SOLO FANTACALCIO. È UN ALTRO UNIVERSO.
              </h3>
              <p className="text-xs sm:text-base text-slate-200 leading-relaxed max-w-2xl">
                Un mondo parallelo fatto di passione, competizione, amicizia e connessioni. Benvenuto nell&apos;universo FICUP.
              </p>
            </div>
          </motion.div>
        </div>

        {/* -------------------------------------------------------------------
            PART 1: SUPER ADMIN — PRESENTAZIONE FULL-WIDTH SENZA RIQUADRI
           ------------------------------------------------------------------- */}
        <div
          id="super-admin"
          className="scroll-mt-20 relative w-full bg-[#071436] text-white overflow-hidden py-18 sm:py-24"
        >
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent"
          />
          <div
            aria-hidden="true"
            className="absolute -top-24 left-1/4 w-[620px] h-[420px] bg-[radial-gradient(ellipse_at_center,rgba(212,175,55,0.16)_0%,transparent_70%)] pointer-events-none"
          />

          <div className="relative z-10 w-full px-5 sm:px-10 lg:px-16 xl:px-24">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-start">
              {/* Left Dominant Identity */}
              <motion.div
                initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 22 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-70px' }}
                transition={{ duration: 0.55 }}
                className="lg:col-span-7 space-y-6"
              >
                <div className="flex items-center gap-4">
                  <span className="font-mono-tabular text-xs font-bold tracking-[0.26em] text-[#D4AF37]">
                    00
                  </span>
                  <span className="h-px w-12 bg-[#D4AF37]/70" />
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#FDE68A]">
                    SUPER ADMIN · FONDATORE FICUP
                  </p>
                </div>

                <h3 className="font-display text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[0.98]">
                  FABRIZIO AMOROSO
                </h3>

                <p className="text-base sm:text-lg text-slate-200 leading-relaxed max-w-2xl">
                  Da oltre trent&apos;anni vive il Fantacalcio come una passione da condividere. Ha trasformato un&apos;esperienza nata tra amici e parenti in un progetto nazionale gratuito, mettendo a disposizione tempo, idee e impegno per far crescere FANTA ITALIA CUP.
                </p>
              </motion.div>

              {/* Right Unboxed Golden Hairline Supervision Index */}
              <motion.div
                initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 22 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-70px' }}
                transition={{ duration: 0.55, delay: 0.1 }}
                className="lg:col-span-5 lg:border-l lg:border-[#D4AF37]/25 lg:pl-12 space-y-5"
              >
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#FDE68A]">
                  Ambiti di guida e supervisione
                </p>
                <div className="divide-y divide-white/15 border-y border-white/15">
                  {SUPER_ADMIN_PILLARS.map((pillar, idx) => (
                    <div
                      key={pillar}
                      className="py-4 flex items-center justify-between gap-4 text-sm sm:text-base text-white"
                    >
                      <span className="font-semibold tracking-tight">{pillar}</span>
                      <span className="font-mono-tabular text-xs font-bold text-[#D4AF37] shrink-0">
                        0{idx + 1}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>

          <div
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#D4AF37]/70 to-transparent"
          />
        </div>

        {/* -------------------------------------------------------------------
            PART 2: IL TEAM ADMIN – LE PERSONE DIETRO FICUP (TESTI BLINDATI)
           ------------------------------------------------------------------- */}
        <div
          id="team-admin"
          className="scroll-mt-20 w-full bg-white text-[#0B1F4D] border-b border-slate-200 py-18 sm:py-24 px-5 sm:px-10 lg:px-16 xl:px-24"
        >
          <div className="space-y-14">
            <motion.div
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-70px' }}
              transition={{ duration: 0.45 }}
              className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-slate-200 pb-8"
            >
              <div className="space-y-2.5">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#0284C7]">
                  IL TEAM ADMIN
                </p>
                <h3 className="font-display text-3xl sm:text-4xl lg:text-[2.65rem] font-black tracking-tight text-[#0B1F4D] leading-[1.08]">
                  IL TEAM ADMIN – LE PERSONE DIETRO FICUP
                </h3>
              </div>
              <p className="text-sm sm:text-base text-slate-600 max-w-lg leading-relaxed">
                Non siamo semplicemente amministratori di una lega: siamo un gruppo che negli anni ha costruito una comunità fatta di esperienza, passione, serietà e spirito di appartenenza.
              </p>
            </motion.div>

            {/* Open Full-Width Rhythmic Editorial Sequence (Exact Verbatim Locked Bios) */}
            <div className="divide-y divide-slate-200 border-b border-slate-200">
              {TEAM_ADMIN_PROFILES.map((member, idx) => {
                const isMirroredDesktop = idx % 2 === 1;
                return (
                  <motion.article
                    key={member.name}
                    initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-55px' }}
                    transition={{ duration: 0.5, delay: 0.04 }}
                    className="py-12 sm:py-16 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-start"
                  >
                    {/* Identity Column */}
                    <div
                      className={`lg:col-span-5 space-y-4 ${
                        isMirroredDesktop ? 'lg:order-2' : 'lg:order-1'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono-tabular text-sm font-bold text-[#C69214]">
                          {member.num}
                        </span>
                        <span className="h-px w-10 bg-[#C69214]/60" />
                        <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#0284C7]">
                          Team Admin
                        </span>
                      </div>

                      <div>
                        <h4 className="font-display text-2xl sm:text-3xl lg:text-[2.1rem] font-black tracking-tight text-[#0B1F4D] leading-[1.08]">
                          {member.name}
                        </h4>
                        <p className="mt-1.5 font-display text-base sm:text-lg font-bold text-[#C69214]">
                          {member.subtitle}
                        </p>
                      </div>
                    </div>

                    {/* Exact Verbatim Narrative Paragraphs & Highlighted Signature */}
                    <div
                      className={`lg:col-span-7 space-y-4 ${
                        isMirroredDesktop ? 'lg:order-1' : 'lg:order-2'
                      }`}
                    >
                      <div className="space-y-3 text-base sm:text-[1.05rem] text-slate-700 leading-[1.72]">
                        {member.paragraphs.map((paragraph) => (
                          <p key={paragraph}>{paragraph}</p>
                        ))}
                      </div>

                      <div className="pt-3 flex items-start gap-3">
                        <span
                          aria-hidden="true"
                          className="mt-3 h-px w-6 bg-[#C69214] shrink-0"
                        />
                        <p className="font-editorial italic text-xl sm:text-2xl font-semibold text-[#153985] leading-snug">
                          {member.signature}
                        </p>
                      </div>
                    </div>
                  </motion.article>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          7B. IL NOSTRO IMMANCABILE FISCHIETTO – IL GUARDIANO DIGITALE DELLA FICUP
         ===================================================================== */}
      <section
        id="il-fischietto"
        className="scroll-mt-20 relative w-full bg-slate-50/90 text-[#0B1F4D] border-b border-slate-200 overflow-hidden py-16 sm:py-20"
      >
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#0284C7]/40 to-transparent"
        />

        <div className="relative z-10 w-full px-5 sm:px-10 lg:px-16 xl:px-24 space-y-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
            {/* Official Mascot Image Stage — Uncropped, Undistorted, Coherent Glow */}
            <motion.div
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 22, scale: 0.97 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.55, ease: 'easeOut' }}
              className="lg:col-span-5 flex items-center justify-center relative"
            >
              <div
                aria-hidden="true"
                className="absolute inset-4 bg-[radial-gradient(circle,rgba(212,175,55,0.22)_0%,rgba(2,132,199,0.14)_48%,transparent_72%)] pointer-events-none blur-xl"
              />

              <motion.div
                animate={prefersReducedMotion ? undefined : { y: [-4, 4, -4] }}
                transition={
                  prefersReducedMotion
                    ? undefined
                    : { duration: 5.5, repeat: Infinity, ease: 'easeInOut' }
                }
                className="relative flex items-center justify-center"
              >
                {!fischiettoImgFailed ? (
                  <img
                    src={FISCHIETTO_IMAGE_URL}
                    alt="Il Fischietto, il guardiano digitale della FANTA ITALIA CUP"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onError={() => setFischiettoImgFailed(true)}
                    className="w-full max-w-[290px] sm:max-w-[340px] h-auto object-contain drop-shadow-[0_18px_36px_rgba(11,31,77,0.18)] select-none"
                  />
                ) : (
                  <div className="py-12 px-8 flex flex-col items-center gap-3 text-center">
                    <Bot className="w-16 h-16 text-[#0284C7]" />
                    <p className="font-display text-lg font-black text-[#0B1F4D]">IL FISCHIETTO</p>
                  </div>
                )}
              </motion.div>
            </motion.div>

            {/* Right Story Column */}
            <motion.div
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.55, delay: 0.08 }}
              className="lg:col-span-7 space-y-5"
            >
              <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.22em] text-[#0284C7]">
                <Eye className="w-4 h-4 text-[#C69214]" />
                <span>Il nostro immancabile Fischietto · Il guardiano digitale della FICUP</span>
              </div>

              <h2 className="font-display text-3xl sm:text-4xl font-black tracking-tight text-[#0B1F4D] leading-[1.08] text-balance">
                IL FISCHIETTO – NON GLI SFUGGE NIENTE!
              </h2>

              <div className="space-y-3 text-sm sm:text-base text-slate-700 leading-relaxed">
                <p>
                  In FICUP non ci sono soltanto squadre, classifiche e competizioni. C&apos;è anche qualcuno che tiene gli occhi aperti su tutto quello che succede.
                </p>
                <p>
                  Lui è il Fischietto, il nostro immancabile compagno di viaggio! Non è un semplice assistente AI: è il guardiano digitale dell&apos;universo FICUP, sempre pronto a dare una mano ai partecipanti e a tenere sotto controllo le informazioni e le attività della lega.
                </p>
                <p>
                  Con la sua inseparabile <strong className="text-[#0B1F4D]">ZONA VAR</strong>, osserva, controlla e aiuta a verificare ciò che accade dietro le quinte. È il punto di riferimento per regolamenti, comunicati ufficiali, scadenze, competizioni, classifiche e informazioni operative.
                </p>
                <p>
                  Quando qualcuno ha un dubbio, lui è pronto a rispondere. Quando bisogna ritrovare una regola, un&apos;informazione o una comunicazione, il Fischietto è lì. E quando qualcosa merita un controllo più approfondito, si entra nella sua ZONA VAR!
                </p>
                <p>
                  Non prende il posto degli amministratori e non si inventa decisioni: aiuta a mantenere tutto più chiaro, ordinato e sotto osservazione, lasciando allo staff le decisioni ufficiali. La sua filosofia è semplice: in FICUP si gioca, si compete e ci si diverte… ma nessun dettaglio deve passare inosservato!
                </p>
              </div>
            </motion.div>
          </div>

          {/* Highlighted ZONA VAR Band — Open Unboxed Editorial Grid */}
          <motion.div
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.5 }}
            className="border-t border-slate-200 pt-10 space-y-8"
          >
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-2.5 text-xs font-mono-tabular font-bold uppercase tracking-[0.24em] text-[#0284C7]">
                  <span
                    aria-hidden="true"
                    className={`w-2 h-2 rotate-45 bg-[#C69214] ${
                      prefersReducedMotion ? '' : 'animate-pulse'
                    }`}
                  />
                  <span>ZONA VAR · Verifica e osservazione</span>
                </div>
                <h3 className="font-display text-2xl sm:text-3xl font-black text-[#0B1F4D]">
                  LA ZONA VAR DEL FISCHIETTO
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 max-w-xl leading-relaxed">
                Lo spazio dedicato ai controlli, alle verifiche e all&apos;analisi delle informazioni disponibili nell&apos;universo FICUP.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-5 border-y border-slate-200 py-7">
              {ZONA_VAR_POINTS.map((point, idx) => (
                <div key={point} className="flex items-start gap-3">
                  <span className="font-mono-tabular text-xs font-bold text-[#C69214] pt-1 shrink-0">
                    0{idx + 1}
                  </span>
                  <p className="text-sm font-medium text-[#0B1F4D] leading-relaxed">{point}</p>
                </div>
              ))}
            </div>

            {/* Distinctive Catchphrase */}
            <div className="flex items-center justify-center text-center pt-1">
              <p className="font-display text-base sm:text-xl font-black tracking-wide text-[#0B1F4D]">
                IL FISCHIETTO: SEMPRE IN CAMPO,{' '}
                <span className="text-[#C69214]">OCCHI APERTI</span> E{' '}
                <span className="text-[#0284C7]">ZONA VAR ATTIVA!</span>
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* =====================================================================
          8. L'UNIVERSO DEL FANTACALCIO — LA VISIONE FUTURA (ROADMAP / VISION)
         ===================================================================== */}
      <section className="relative bg-[#0B1F4D] text-white overflow-hidden py-16 sm:py-24">
        <div className="absolute inset-0 pointer-events-none opacity-20">
          {!universeImgFailed && (
            <img
              src={tacticalArenaImg}
              alt=""
              aria-hidden="true"
              loading="lazy"
              onError={() => setUniverseImgFailed(true)}
              className="w-full h-full object-cover"
            />
          )}
        </div>
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-[#0B1F4D] via-[#0B1F4D]/92 to-[#0B1F4D]/80"
        />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.55 }}
            className="max-w-3xl space-y-6"
          >
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#FDE68A]">
              <Sparkles className="w-4 h-4" />
              <span>Visione futura · Roadmap del progetto</span>
            </div>

            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white text-balance leading-[1.08]">
              NON È PIÙ SOLTANTO FANTACALCIO. STA NASCENDO UN UNIVERSO.
            </h2>

            <p className="font-display text-base sm:text-lg font-bold tracking-wide text-sky-300">
              TUTTO CIÒ CHE OGGI È FICUP È SOLTANTO L&apos;INIZIO.
            </p>

            <div className="space-y-4 text-sm sm:text-base text-slate-200 leading-relaxed">
              <p>
                Presto Fanta Italia Cup evolverà in un vero universo del Fantacalcio: un mondo di competizioni, esperienze, tecnologia e passione, progettato per diventare una parte irrinunciabile della tua stagione calcistica.
              </p>
              <p>
                Non vogliamo essere soltanto il posto dove schieri una formazione. Vogliamo diventare il posto in cui torni per vivere un&apos;emozione, scoprire una nuova sfida, incontrare una community e trovare ogni volta un motivo per giocare ancora.
              </p>
              <p>
                Immagina un universo in cui ogni giornata possa offrirti una nuova esperienza, ogni competizione una nuova sfida e ogni partecipante un motivo in più per sentirsi parte di qualcosa.
              </p>
              <p className="font-semibold text-white">
                FANTA ITALIA CUP vuole crescere, sperimentare, innovare e sorprendere. Il futuro non è ancora tutto scritto. E vogliamo costruirlo insieme.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* =====================================================================
          9. AREA CANDIDATURA — IL PERCORSO PER ENTRARE IN FICUP
         ===================================================================== */}
      <section id="candidatura" className="scroll-mt-20 bg-white py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <motion.div
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-70px' }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
            className="rounded-3xl border border-slate-200 bg-slate-50/80 p-6 sm:p-10 lg:p-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center shadow-xs"
          >
            <div className="lg:col-span-7 space-y-4">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C69214]">
                Reclutamento subentranti · Procedura guidata ufficiale
              </p>
              <h2 className="font-display text-3xl sm:text-4xl font-black tracking-tight text-[#0B1F4D] text-balance">
                LA PROSSIMA STAGIONE POTREBBE INIZIARE DA QUI.
              </h2>
              <p className="text-sm sm:text-base text-slate-700 leading-relaxed">
                Vuoi entrare a far parte di FANTA ITALIA CUP? Se condividi la nostra passione e vuoi vivere una stagione di Fantacalcio insieme a una community nazionale, puoi presentare la tua candidatura per entrare nella lega come subentrante.
              </p>

              {/* Real Config Details */}
              <div className="pt-2 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs sm:text-sm text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-[#C69214]" />
                  <span>Stagione {config.stagione}</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Gavel className="w-4 h-4 text-[#0284C7]" />
                  <span>{config.modalitaMercato}</span>
                </span>
                <span className="font-mono-tabular font-semibold text-[#0B1F4D]">
                  Budget iniziale: {config.budgetIniziale} crediti
                </span>
                <span>Quota: 0 €</span>
              </div>
            </div>

            <div className="lg:col-span-5 flex flex-col gap-3">
              <button
                type="button"
                onClick={onStartWizard}
                disabled={isClosed}
                className="min-h-[54px] w-full px-6 py-4 rounded-xl bg-[#0B1F4D] text-white text-sm sm:text-base font-bold hover:bg-[#153985] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all inline-flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                <span>
                  {isClosed ? 'Candidature chiuse' : 'ENTRA IN CAMPO ORA'}
                </span>
                <ArrowRight className="w-4 h-4 text-[#D4AF37]" />
              </button>

              <button
                type="button"
                onClick={onOpenWaitingRoom}
                className="min-h-[48px] w-full px-5 py-3 rounded-xl border border-slate-300 bg-white text-[#0B1F4D] text-sm font-semibold hover:bg-slate-100 active:scale-[0.98] transition-all inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <DoorOpen className="w-4 h-4 text-[#0284C7]" />
                <span>Accedi all&apos;Area Personale</span>
              </button>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
