import {
  ArrowRight,
  Bot,
  CalendarDays,
  ChevronDown,
  DoorOpen,
  ExternalLink,
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
import { motion, useScroll, useTransform } from 'motion/react';
import { useRef, useState } from 'react';
import type { FirebaseEnvironmentDiagnostics } from '../lib/firebase';
import type { ConfigurazionePublica } from '../lib/firestore';
import { FicupLogo } from './FicupLogo';

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

const COMPETITIONS_LIST = [
  {
    name: 'Fantaschedina Serie A',
    tag: 'Campionato',
  },
  {
    name: 'Fantaschedina Serie B',
    tag: 'Cadetteria',
  },
  {
    name: 'Fanta Champions',
    tag: 'Notti europee',
  },
  {
    name: 'Fanta Futsal',
    tag: 'Sfida dedicata',
  },
  {
    name: 'Fischietto, l’assistente ufficiale della community',
    tag: 'Assistente community',
    isAssistant: true,
  },
] as const;

const COLLABORATORS = [
  { initial: 'M', name: 'Michele' },
  { initial: 'D', name: 'Daniele' },
  { initial: 'D', name: 'Dennis' },
  { initial: 'A', name: 'Alessandro' },
  { initial: 'G', name: 'Giuseppe' },
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
  const [universeImgFailed, setUniverseImgFailed] = useState(false);

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

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-16 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            {/* Left: Institutional Lockup + Copy + Dual CTAs */}
            <div className="lg:col-span-6 space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: 'easeOut' }}
                className="flex items-center gap-4"
              >
                <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-xs shrink-0">
                  <FicupLogo size="md" />
                </div>
                <div>
                  <p className="font-display text-lg sm:text-xl font-extrabold tracking-tight text-[#0B1F4D]">
                    FANTA ITALIA CUP
                  </p>
                  <p className="text-xs font-bold tracking-[0.2em] uppercase text-[#C69214]">
                    THE FOOTBALL UNIVERSE
                  </p>
                </div>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.08, ease: 'easeOut' }}
                className="font-display text-3xl sm:text-4xl lg:text-[3.1rem] font-black tracking-tight text-[#0B1F4D] leading-[1.08] text-balance"
              >
                NON È SOLTANTO FANTACALCIO. È UNA PASSIONE CHE UNISCE L&apos;ITALIA.
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.16, ease: 'easeOut' }}
                className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl"
              >
                Una lega nazionale gratuita, una community di appassionati, competizioni, tecnologia e nuove sfide. Fanta Italia Cup nasce dalla passione per il calcio e cresce grazie alle persone che ogni stagione scelgono di farne parte.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.22, ease: 'easeOut' }}
                className="pt-2 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3"
              >
                <button
                  type="button"
                  onClick={onStartWizard}
                  disabled={isClosed}
                  className="min-h-[50px] px-6 py-3.5 rounded-xl bg-[#0B1F4D] text-white text-sm font-bold hover:bg-[#153985] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all inline-flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                >
                  <span>{isClosed ? 'Candidature chiuse' : 'CANDIDATI ORA'}</span>
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

            {/* Right: Bright Architectural Stadium Composition */}
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.65, delay: 0.14, ease: 'easeOut' }}
              className="lg:col-span-6"
            >
              <div className="relative rounded-3xl overflow-hidden border border-slate-200 bg-slate-100 shadow-lg aspect-[16/11] sm:aspect-[16/10]">
                <motion.div style={{ y: photoY }} className="w-full h-[112%] -mt-[4%]">
                  {!heroImgFailed ? (
                    <img
                      src="/src/assets/images/ficup_editorial_stadium_1794899930151.jpg"
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
            <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-2.5 shadow-2xs">
              <p className="font-mono-tabular text-xs font-bold text-[#C69214]">01 · CANDIDATURA</p>
              <h3 className="font-display text-lg font-extrabold text-[#0B1F4D]">
                1. Presenta la candidatura
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Inserisci i tuoi dati Fantaleghe, prendi visione di Privacy, Regolamento PDF e Regole ufficiali della chat WhatsApp e ottieni subito il codice <span className="font-mono-tabular font-semibold text-[#0B1F4D]">FICUP26</span>.
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-2.5 shadow-2xs">
              <p className="font-mono-tabular text-xs font-bold text-[#0284C7]">02 · VALUTAZIONE</p>
              <h3 className="font-display text-lg font-extrabold text-[#0B1F4D]">
                2. Attendi la valutazione dello staff
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Segui ogni aggiornamento in tempo reale nella tua Area Personale e coordinati sul gruppo provvisorio con il tuo codice identificativo.
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-2.5 shadow-2xs">
              <p className="font-mono-tabular text-xs font-bold text-emerald-700">03 · COMMUNITY</p>
              <h3 className="font-display text-lg font-extrabold text-[#0B1F4D]">
                3. Ottieni squadra e gruppo ufficiale
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Ricevi l&apos;invito ufficiale su Fantaleghe, completa la tua squadra e sblocca il collegamento al Gruppo WhatsApp Ufficiale autorizzato dallo staff.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          4. LA NOSTRA STORIA — IL CUORE DEL PROGETTO
         ===================================================================== */}
      <section
        id="la-nostra-storia"
        className="bg-slate-50/70 border-b border-slate-200 py-16 sm:py-24"
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
                    src="/src/assets/images/ficup_stadium_hero_1794862341799.jpg"
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
          6. L'APP UFFICIALE FICUP — IL CUORE DIGITALE DELLA COMMUNITY
         ===================================================================== */}
      <section
        id="app-ufficiale"
        className="bg-slate-50/80 border-b border-slate-200 py-16 sm:py-24"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-12">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#0284C7]">
              <Smartphone className="w-4 h-4" />
              <span>Il cuore digitale della community</span>
            </div>
            <h2 className="font-display text-3xl sm:text-4xl font-black tracking-tight text-[#0B1F4D] text-balance">
              LA FICUP È SEMPRE CON TE.
            </h2>
            <div className="space-y-2 text-sm sm:text-base text-slate-700 leading-relaxed">
              <p className="font-bold text-[#0B1F4D]">
                🚀 TI PRESENTIAMO LA NOSTRA CREAZIONE: L&apos;APP UFFICIALE FICUP! 🔥⚽
              </p>
              <p>Non è una semplice App, ma il cuore della nostra community! ❤️</p>
              <p>
                Abbiamo realizzato uno spazio tutto nostro, pensato per offrirti un&apos;esperienza completa e permetterti di vivere la FICUP in ogni momento della stagione!
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
            {/* Left: Graphic Presentation of App Capabilities (No fake screenshots) */}
            <div className="lg:col-span-6 bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs flex flex-col justify-between space-y-6">
              <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div className="flex items-center gap-3">
                  <FicupLogo size="sm" className="ring-1 ring-slate-200 p-0.5" />
                  <div>
                    <p className="font-display text-base font-extrabold text-[#0B1F4D]">
                      App Ufficiale FANTA ITALIA CUP
                    </p>
                    <p className="text-xs text-[#0284C7] font-semibold">
                      Funzionalità integrate per la stagione
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {APP_FEATURES.map((feat) => {
                  const Icon = feat.icon;
                  return (
                    <div
                      key={feat.title}
                      className="rounded-2xl bg-slate-50 border border-slate-200/80 p-4 space-y-2"
                    >
                      <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-200 text-[#0284C7] flex items-center justify-center">
                        <Icon className="w-4 h-4" />
                      </div>
                      <h3 className="font-display text-sm sm:text-base font-bold text-[#0B1F4D]">
                        {feat.title}
                      </h3>
                      <p className="text-xs text-slate-600 leading-relaxed">{feat.subtitle}</p>
                    </div>
                  );
                })}
              </div>

              {/* Download & Access Links */}
              <div className="pt-2 border-t border-slate-100 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Download e accesso all&apos;app
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex flex-col justify-between gap-1.5">
                    <span className="text-xs font-bold text-slate-700">Android</span>
                    <span className="text-[11px] text-slate-500">
                      Link download Android non ancora configurato
                    </span>
                  </div>

                  <a
                    href="https://ficup-26-27.ai.studio/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[54px] px-4 py-3 rounded-xl bg-[#0B1F4D] text-white text-xs sm:text-sm font-bold hover:bg-[#153985] active:scale-[0.98] transition-all inline-flex items-center justify-center gap-2 shadow-xs"
                  >
                    <span>Apri su iPhone / Web App</span>
                    <ExternalLink className="w-4 h-4 text-[#D4AF37]" />
                  </a>
                </div>
              </div>
            </div>

            {/* Right: Exclusive Competitions Composition */}
            <div className="lg:col-span-6 bg-[#0B1F4D] text-white rounded-3xl p-6 sm:p-8 flex flex-col justify-between space-y-6 shadow-md">
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-widest text-[#D4AF37]">
                  Iniziative della community
                </p>
                <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
                  Le competizioni esclusive
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Oltre al campionato principale, l&apos;ecosistema digitale riunisce sfide parallele e strumenti dedicati alla community.
                </p>
              </div>

              <div className="divide-y divide-white/10 border-y border-white/10">
                {COMPETITIONS_LIST.map((comp) => (
                  <div
                    key={comp.name}
                    className="py-4 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          'isAssistant' in comp && comp.isAssistant
                            ? 'bg-sky-400/20 text-sky-300 border border-sky-400/30'
                            : 'bg-[#D4AF37]/20 text-[#FDE68A] border border-[#D4AF37]/30'
                        }`}
                      >
                        {'isAssistant' in comp && comp.isAssistant ? (
                          <Bot className="w-4 h-4" />
                        ) : (
                          <Trophy className="w-4 h-4" />
                        )}
                      </div>
                      <span className="font-display text-sm sm:text-base font-bold text-white">
                        {comp.name}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono-tabular font-semibold text-slate-300 shrink-0">
                      {comp.tag}
                    </span>
                  </div>
                ))}
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Accesso diretto tramite l&apos;app ufficiale{' '}
                <a
                  href="https://ficup-26-27.ai.studio/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#FDE68A] underline underline-offset-2 font-semibold"
                >
                  ficup-26-27.ai.studio
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          7. IL TEAM — PERSONE UNITE DALLA STESSA PASSIONE
         ===================================================================== */}
      <section id="il-team" className="bg-white border-b border-slate-200 py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-12">
          <div className="max-w-2xl space-y-3">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C69214]">
              Le persone
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-black tracking-tight text-[#0B1F4D] text-balance">
              DIETRO FICUP CI SONO PERSONE. NON SOLTANTO UN PROGETTO.
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            {/* Founder Spotlight */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.45 }}
              className="lg:col-span-6 rounded-3xl border border-slate-200 bg-slate-50/70 p-6 sm:p-8 flex flex-col justify-between space-y-5"
            >
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-[#0B1F4D] text-[#D4AF37] font-display text-2xl font-black flex items-center justify-center shrink-0 shadow-xs">
                  FA
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[#C69214]">
                    Fondatore e SUPER ADMIN
                  </p>
                  <h3 className="font-display text-2xl font-extrabold text-[#0B1F4D]">
                    FABRIZIO AMOROSO
                  </h3>
                </div>
              </div>

              <p className="text-sm sm:text-base text-slate-700 leading-relaxed">
                Da oltre trent&apos;anni vive il Fantacalcio come una passione da condividere. Ha trasformato un&apos;esperienza nata tra amici e parenti in un progetto nazionale gratuito, mettendo a disposizione tempo, idee e impegno per far crescere FANTA ITALIA CUP.
              </p>
            </motion.div>

            {/* Collaborators Monogram Grid (No invented surnames, roles, or faces) */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.45, delay: 0.08 }}
              className="lg:col-span-6 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 flex flex-col justify-between space-y-6"
            >
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-widest text-[#0284C7]">
                  Collaboratori
                </p>
                <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                  Persone diverse, unite dalla stessa passione e dalla volontà di contribuire alla crescita di una community.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {COLLABORATORS.map((person) => (
                  <div
                    key={person.name}
                    className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 flex items-center gap-3"
                  >
                    <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-[#0B1F4D] font-display font-extrabold text-sm flex items-center justify-center shrink-0">
                      {person.initial}
                    </div>
                    <span className="font-display font-bold text-sm sm:text-base text-[#0B1F4D]">
                      {person.name}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          8. THE FOOTBALL UNIVERSE — LA VISIONE FUTURA (ROADMAP / VISION)
         ===================================================================== */}
      <section className="relative bg-[#0B1F4D] text-white overflow-hidden py-16 sm:py-24">
        <div className="absolute inset-0 pointer-events-none opacity-20">
          {!universeImgFailed && (
            <img
              src="/src/assets/images/ficup_tactical_arena_1794895608683.jpg"
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
      <section id="candidatura" className="bg-white py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-6 sm:p-10 lg:p-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
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
                  {isClosed ? 'Candidature chiuse' : 'CANDIDATI ORA'}
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
          </div>
        </div>
      </section>
    </div>
  );
}
