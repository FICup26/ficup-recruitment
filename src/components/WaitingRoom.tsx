import {
  AlertCircle,
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  FileCheck2,
  Info,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trophy,
  XCircle,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useState, type FormEvent } from 'react';
import {
  fetchWaitingRoomStatus,
  isAppsScriptConfigured,
  type WaitingRoomServerStatus,
} from '../lib/appsScriptClient';
import type { CandidaturaStato, ConfigurazionePublica } from '../lib/firestore';
import type { WaitingRoomPass } from '../lib/waitingRoomStorage';
import { FicupLogo } from './FicupLogo';

interface WaitingRoomProps {
  config: Omit<ConfigurazionePublica, 'updatedAt' | 'updatedBy'>;
  waitingPass: WaitingRoomPass | null;
  onStartWizard: () => void;
  onWaitingPassVerified?: (pass: WaitingRoomPass) => void;
}

function formatIsoDate(iso: string | null | undefined): string {
  if (!iso) {
    return '—';
  }
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return '—';
    }
    return new Intl.DateTimeFormat('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return '—';
  }
}

function getReadableStateLabel(stato: CandidaturaStato | null): string {
  switch (stato) {
    case 'COMPLETATO':
      return 'COMPLETATO';
    case 'RESPINTO':
      return 'RESPINTO';
    default:
      return 'DA VERIFICARE';
  }
}

function getStateBadgeClasses(stato: CandidaturaStato | null): string {
  switch (stato) {
    case 'COMPLETATO':
      return 'bg-emerald-50 border-emerald-200 text-emerald-700';
    case 'RESPINTO':
      return 'bg-red-50 border-red-200 text-red-700';
    default:
      return 'bg-amber-50 border-amber-200 text-[#B45309]';
  }
}

type StageUiStatus = 'completed' | 'active' | 'locked' | 'rejected';

function buildRealTimelineStages(
  serverStatus: WaitingRoomServerStatus | null,
  hasLocalPass: boolean,
  codiceHint: string
): Array<{ id: string; title: string; description: string; status: StageUiStatus }> {
  const realState = serverStatus?.stato ?? (hasLocalPass ? 'NUOVO' : null);

  if (!realState) {
    return [
      {
        id: 'received',
        title: 'Candidatura inviata',
        description:
          'Completa la procedura guidata oppure inserisci qui sopra il tuo codice FICUP26 e l’email Fantaleghe.',
        status: 'locked',
      },
      {
        id: 'review',
        title: 'In valutazione',
        description:
          'Lo staff verifica i dati della richiesta e la disponibilità della lega.',
        status: 'locked',
      },
      {
        id: 'approved',
        title: 'Approvata',
        description: 'Esito positivo della valutazione dello staff FICUP.',
        status: 'locked',
      },
      {
        id: 'invite',
        title: 'Invito Fantaleghe & squadra',
        description:
          'Invio dell’invito ufficiale Fantaleghe al tuo indirizzo email e completamento rosa.',
        status: 'locked',
      },
      {
        id: 'completed',
        title: 'Accesso community WhatsApp',
        description:
          'Al raggiungimento confermato dello stato COMPLETATO si sblocca il pulsante per entrare nel Gruppo Ufficiale.',
        status: 'locked',
      },
    ];
  }

  if (realState === 'RESPINTO') {
    return [
      {
        id: 'received',
        title: 'Candidatura inviata',
        description: `Candidatura ${codiceHint} registrata su Cloud Firestore.`,
        status: 'completed',
      },
      {
        id: 'review',
        title: 'Valutazione conclusa',
        description:
          'La richiesta non è stata accolta per la stagione corrente. Per chiarimenti scrivi a scudetto26@gmail.com.',
        status: 'rejected',
      },
      {
        id: 'approved',
        title: 'Approvazione',
        description: 'Non applicabile per candidature non accolte.',
        status: 'locked',
      },
      {
        id: 'invite',
        title: 'Invito Fantaleghe & squadra',
        description: 'Non applicabile per candidature non accolte.',
        status: 'locked',
      },
      {
        id: 'completed',
        title: 'Accesso community WhatsApp',
        description: 'Non disponibile.',
        status: 'locked',
      },
    ];
  }

  const stageLevel =
    realState === 'COMPLETATO'
      ? 5
      : realState === 'INVITO INVIATO' || realState === 'DA COMPLETARE'
        ? 4
        : realState === 'APPROVATO'
          ? 3
          : 2; // NUOVO or DA CONTATTARE -> step 2 active

  return [
    {
      id: 'received',
      title: 'Candidatura inviata',
      description: `Candidatura salvata su Cloud Firestore con codice univoco ${codiceHint}.`,
      status: 'completed',
    },
    {
      id: 'review',
      title: 'Verifica dati & email',
      description:
        stageLevel > 2
          ? 'Verifica preliminare dello Staff FICUP completata.'
          : realState === 'DA CONTATTARE'
            ? 'Lo Staff ti contatterà o ti attende sul gruppo WhatsApp provvisorio per completare la verifica.'
            : 'La candidatura è registrata ed è in attesa di verifica manuale da parte dello Staff.',
      status: stageLevel > 2 ? 'completed' : 'active',
    },
    {
      id: 'approved',
      title: 'Conferma idoneità',
      description:
        stageLevel === 3
          ? 'Candidatura approvata dallo Staff! Invito ufficiale in preparazione.'
          : stageLevel > 3
            ? 'Requisiti confermati dallo Staff FICUP.'
            : 'Avanza dopo la verifica manuale della candidatura da parte dello Staff.',
      status: stageLevel > 3 ? 'completed' : stageLevel === 3 ? 'active' : 'locked',
    },
    {
      id: 'invite',
      title: 'Invito Fantaleghe & squadra',
      description:
        realState === 'INVITO INVIATO'
          ? 'Invito ufficiale inviato su Fantaleghe! Controlla la tua casella email (anche Spam/Promozioni), completa la rosa e avvisa lo staff.'
          : realState === 'DA COMPLETARE'
            ? 'Invito inviato: completa gli ultimi passaggi su Fantaleghe (rosa e nome club) e segnala al gruppo provvisorio.'
            : stageLevel > 4
              ? 'Comunicazioni email ufficiali inviate e pratica pronta su Fantaleghe.'
              : 'Disponibile al completamento della verifica.',
      status: stageLevel > 4 ? 'completed' : stageLevel === 4 ? 'active' : 'locked',
    },
    {
      id: 'completed',
      title: 'Accesso community WhatsApp',
      description:
        realState === 'COMPLETATO' && Boolean(serverStatus?.linkWhatsappUfficiale)
          ? 'Stato COMPLETATO raggiunto! Il pulsante per entrare nel Gruppo WhatsApp Ufficiale è sbloccato qui accanto.'
          : realState === 'COMPLETATO'
            ? 'Stato COMPLETATO raggiunto: link WhatsApp ufficiale non ancora configurato o soggetto a verifica dedicata.'
            : 'Si sblocca esclusivamente al raggiungimento confermato dello stato COMPLETATO.',
      status:
        realState === 'COMPLETATO' && Boolean(serverStatus?.linkWhatsappUfficiale)
          ? 'completed'
          : realState === 'COMPLETATO'
            ? 'active'
            : 'locked',
    },
  ];
}

export function WaitingRoom({
  config,
  waitingPass,
  onStartWizard,
  onWaitingPassVerified,
}: WaitingRoomProps) {
  const [copiedCode, setCopiedCode] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  const [lookupCode, setLookupCode] = useState(waitingPass?.codiceCandidatura ?? '');
  const [lookupEmail, setLookupEmail] = useState(waitingPass?.emailFantaleghe ?? '');
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [serverStatus, setServerStatus] = useState<WaitingRoomServerStatus | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);

  const runLookup = async (code: string, email: string, persistLocal: boolean) => {
    if (!isAppsScriptConfigured) {
      return;
    }
    setLoadingStatus(true);
    setLookupError(null);
    try {
      const data = await fetchWaitingRoomStatus({
        codiceCandidatura: code,
        emailFantaleghe: email,
      });
      setServerStatus(data);
      setLastCheckedAt(new Date().toISOString());

      if (persistLocal && onWaitingPassVerified) {
        onWaitingPassVerified({
          id: data.codiceCandidatura,
          codiceCandidatura: data.codiceCandidatura,
          nomeCompleto: data.nomeCompleto || data.nome,
          emailFantaleghe: email.trim().toLowerCase(),
          nomeSquadra: data.nomeSquadra,
          submittedAtIso: data.createdAtIso || new Date().toISOString(),
          acceptedDocs: waitingPass?.acceptedDocs,
        });
      }
    } catch (err) {
      setLookupError(
        err instanceof Error ? err.message : 'Impossibile verificare lo stato su Firestore.'
      );
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    if (waitingPass) {
      setLookupCode(waitingPass.codiceCandidatura);
      setLookupEmail(waitingPass.emailFantaleghe);
      if (isAppsScriptConfigured) {
        runLookup(waitingPass.codiceCandidatura, waitingPass.emailFantaleghe, false);
      }
    } else {
      setServerStatus(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waitingPass?.codiceCandidatura, waitingPass?.emailFantaleghe]);

  const handleLookupSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const cleanCode = lookupCode.trim().toUpperCase();
    const cleanEmail = lookupEmail.trim().toLowerCase();
    if (!cleanCode || !cleanEmail) {
      setLookupError('Inserisci sia il codice candidatura sia l’email utilizzata su Fantaleghe.');
      return;
    }
    await runLookup(cleanCode, cleanEmail, true);
  };

  const activeCode = serverStatus?.codiceCandidatura ?? waitingPass?.codiceCandidatura ?? '';
  const activeEmail = waitingPass?.emailFantaleghe ?? lookupEmail.trim().toLowerCase();
  const activeTeam = serverStatus?.nomeSquadra ?? waitingPass?.nomeSquadra ?? '';
  const activeName = serverStatus?.nomeCompleto ?? waitingPass?.nomeCompleto ?? '';
  const activeCreatedIso = serverStatus?.createdAtIso ?? waitingPass?.submittedAtIso ?? null;
  const hasVerifiedOrLocal = Boolean(serverStatus || waitingPass);

  const realState: CandidaturaStato | null =
    serverStatus?.stato ?? (waitingPass ? 'NUOVO' : null);
  const timelineStages = buildRealTimelineStages(serverStatus, Boolean(waitingPass), activeCode);

  const canAccessProvisionalWa = Boolean(hasVerifiedOrLocal) && realState !== 'RESPINTO';
  const canAccessOfficialWa =
    serverStatus !== null &&
    serverStatus.stato === 'COMPLETATO' &&
    Boolean(serverStatus.linkWhatsappUfficiale);

  const handleCopyCode = async () => {
    if (!activeCode || typeof navigator === 'undefined' || !navigator.clipboard) {
      return;
    }
    try {
      await navigator.clipboard.writeText(activeCode);
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <div className="bg-slate-50/70 text-[#0B1F4D] min-h-[calc(100vh-4.5rem)]">
      {/* Header Banner */}
      <section className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2.5 max-w-2xl">
              <div className="flex items-center gap-3">
                <FicupLogo size="sm" className="ring-1 ring-slate-200 p-0.5 bg-white" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C69214]">
                    FANTA ITALIA CUP · Area Personale
                  </p>
                  <p className="text-xs text-slate-500">
                    Waiting Room e monitoraggio candidatura
                  </p>
                </div>
              </div>
              <h1 className="font-display text-2xl sm:text-4xl font-black tracking-tight text-[#0B1F4D]">
                LA TUA AREA CANDIDATO FICUP.
              </h1>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                Accedi con il tuo codice <span className="font-mono-tabular font-semibold">FICUP26</span> e la tua email Fantaleghe per verificare lo stato reale della candidatura, la squadra e lo sblocco del Gruppo WhatsApp Ufficiale.
              </p>
            </div>

            {!hasVerifiedOrLocal && (
              <button
                type="button"
                onClick={onStartWizard}
                disabled={!config.iscrizioniAperte}
                className="min-h-[48px] px-6 py-3 rounded-xl bg-[#0B1F4D] text-white text-sm font-bold hover:bg-[#153985] active:scale-[0.98] disabled:opacity-50 transition-all inline-flex items-center justify-center gap-2 shrink-0 cursor-pointer"
              >
                <span>Invia la tua candidatura</span>
                <ArrowRight className="w-4 h-4 text-[#D4AF37]" />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">
        {/* Celebratory Completion Hero — Shown ONLY when adhesion is genuinely COMPLETATO & Official WhatsApp is unlocked */}
        {canAccessOfficialWa && serverStatus?.linkWhatsappUfficiale && (
          <motion.div
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
            className="relative overflow-hidden rounded-3xl bg-[#071436] text-white border border-[#D4AF37]/50 p-6 sm:p-10 shadow-[0_24px_60px_-16px_rgba(7,20,54,0.45)]"
          >
            <div
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent"
            />
            <div
              aria-hidden="true"
              className="absolute -right-12 -top-12 w-72 h-72 rounded-full bg-[radial-gradient(circle,rgba(212,175,55,0.22)_0%,transparent_70%)] pointer-events-none"
            />
            <div
              aria-hidden="true"
              className="absolute -left-12 -bottom-16 w-72 h-72 rounded-full bg-[radial-gradient(circle,rgba(16,185,129,0.2)_0%,transparent_70%)] pointer-events-none"
            />

            {/* Subtle GPU sparkle dots */}
            {!prefersReducedMotion && (
              <div aria-hidden="true" className="pointer-events-none">
                <motion.span
                  animate={{ y: [-4, 4, -4], opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute top-6 right-12 w-2.5 h-2.5 rotate-45 bg-[#D4AF37]"
                />
                <motion.span
                  animate={{ y: [4, -4, 4], opacity: [0.4, 0.9, 0.4] }}
                  transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute bottom-8 right-28 w-2 h-2 rotate-45 bg-emerald-400"
                />
                <motion.span
                  animate={{ y: [-3, 5, -3], opacity: [0.4, 0.95, 0.4] }}
                  transition={{ duration: 4.1, repeat: Infinity, ease: 'easeInOut' }}
                  className="hidden sm:block absolute top-14 right-40 w-2 h-2 rotate-45 bg-sky-400"
                />
              </div>
            )}

            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-3 max-w-2xl">
                <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-[#FDE68A]">
                  <Sparkles className="w-4 h-4 text-[#D4AF37]" />
                  <span>Traguardo raggiunto · Stato COMPLETATO</span>
                </div>

                <h2 className="font-display text-3xl sm:text-5xl font-black tracking-tight text-white leading-none">
                  COMPLIMENTI 👏
                </h2>

                <p className="text-base sm:text-lg text-slate-200 leading-relaxed">
                  Sei entrato ufficialmente a far parte del mondo <strong className="text-[#FDE68A]">FANTA ITALIA CUP {config.stagione}</strong> con la tua squadra <strong className="text-white">{activeTeam}</strong>. Invito verificato e accesso al Gruppo WhatsApp Ufficiale sbloccato!
                </p>
              </div>

              <a
                href={serverStatus.linkWhatsappUfficiale}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[54px] px-6 py-3.5 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#E7C860] to-[#C69214] text-[#071436] text-xs sm:text-sm font-black tracking-wide hover:brightness-105 active:scale-[0.98] transition-all inline-flex items-center justify-center gap-2.5 shadow-[0_14px_30px_-10px_rgba(212,175,55,0.5)] whitespace-nowrap shrink-0"
              >
                <MessageCircle className="w-4 h-4" />
                <span>ENTRA NEL GRUPPO UFFICIALE</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Accesso + Tessera Digitale + Documenti + Timeline */}
          <div className="lg:col-span-7 space-y-6">
            {/* Accesso con Codice + Email */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 shadow-xs space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[#0284C7]">
                    Accesso sicuro tramite codice candidatura
                  </p>
                  <h2 className="font-display text-lg sm:text-xl font-bold text-[#0B1F4D] mt-0.5">
                    Verifica o recupera la tua candidatura
                  </h2>
                </div>
                <KeyRound className="w-5 h-5 text-[#C69214] shrink-0 mt-1" />
              </div>

              {!isAppsScriptConfigured && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 flex items-start gap-2.5 text-xs text-amber-950 leading-relaxed">
                  <AlertCircle className="w-4 h-4 text-[#C69214] shrink-0 mt-0.5" />
                  <span>
                    <strong>Endpoint backend non ancora collegato:</strong> configura{' '}
                    <span className="font-mono-tabular">VITE_APPS_SCRIPT_WEBAPP_URL</span> per sincronizzare in tempo reale gli stati aggiornati dallo staff su Firestore.
                  </span>
                </div>
              )}

              <form onSubmit={handleLookupSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div className="sm:col-span-5">
                  <label
                    htmlFor="wr-code"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Codice candidatura
                  </label>
                  <input
                    id="wr-code"
                    type="text"
                    value={lookupCode}
                    onChange={(e) => setLookupCode(e.target.value.toUpperCase())}
                    placeholder="FICUP26-XXXXXX"
                    maxLength={14}
                    className="w-full min-h-[46px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white font-mono-tabular text-sm text-[#0B1F4D] uppercase placeholder:normal-case placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B1F4D]/20"
                  />
                </div>
                <div className="sm:col-span-5">
                  <label
                    htmlFor="wr-email"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Email Fantaleghe
                  </label>
                  <input
                    id="wr-email"
                    type="email"
                    value={lookupEmail}
                    onChange={(e) => setLookupEmail(e.target.value)}
                    placeholder="nome@esempio.it"
                    maxLength={160}
                    className="w-full min-h-[46px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-sm text-[#0B1F4D] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B1F4D]/20"
                  />
                </div>
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    disabled={loadingStatus || !isAppsScriptConfigured}
                    className="min-h-[46px] w-full px-4 py-2 rounded-xl bg-[#0B1F4D] text-white text-xs sm:text-sm font-bold hover:bg-[#153985] disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {loadingStatus ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 text-[#D4AF37]" />
                    )}
                    <span>Verifica</span>
                  </button>
                </div>
              </form>

              {lookupError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 flex items-start gap-2.5 text-xs sm:text-sm text-red-800">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{lookupError}</span>
                </div>
              )}

              {serverStatus && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-900">
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                    <span>Sincronizzato con i dati reali di Firestore</span>
                  </span>
                  {lastCheckedAt && (
                    <span className="font-mono-tabular text-[11px] text-emerald-800">
                      Aggiornato: {formatIsoDate(lastCheckedAt)}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Digital Candidate Pass */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 shadow-xs space-y-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[#C69214]">
                    Scheda candidato · {config.stagione}
                  </p>
                  <h2 className="font-display text-xl sm:text-2xl font-extrabold text-[#0B1F4D] mt-0.5">
                    {hasVerifiedOrLocal ? activeTeam : 'Nessuna candidatura selezionata'}
                  </h2>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-bold ${getStateBadgeClasses(
                    realState
                  )}`}
                >
                  {realState === 'COMPLETATO' ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : realState === 'RESPINTO' ? (
                    <XCircle className="w-3.5 h-3.5" />
                  ) : realState ? (
                    <Clock className="w-3.5 h-3.5" />
                  ) : (
                    <Lock className="w-3.5 h-3.5" />
                  )}
                  <span>{getReadableStateLabel(realState)}</span>
                </span>
              </div>

              {hasVerifiedOrLocal ? (
                <>
                  {/* Dark Navy Accent Pass Card */}
                  <div className="rounded-2xl bg-[#0B1F4D] text-white p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <FicupLogo size="sm" className="bg-white p-0.5 shrink-0" />
                      <div>
                        <p className="text-[11px] uppercase tracking-widest text-[#FDE68A] font-semibold">
                          Codice candidatura univoco
                        </p>
                        <p className="font-mono-tabular text-2xl sm:text-3xl font-extrabold text-white tracking-wider mt-0.5">
                          {activeCode}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="min-h-[42px] px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-xs font-bold text-white hover:bg-white/20 transition-colors inline-flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      {copiedCode ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-300" />
                          <span>Copiato</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 text-[#D4AF37]" />
                          <span>Copia codice</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Real Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3.5">
                      <p className="text-xs text-slate-500">Fantallenatore</p>
                      <p className="font-semibold text-[#0B1F4D] mt-0.5">{activeName}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3.5">
                      <p className="text-xs text-slate-500">Email Fantaleghe</p>
                      <p className="font-semibold text-[#0284C7] break-all mt-0.5">
                        {activeEmail}
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3.5">
                      <p className="text-xs text-slate-500">Data candidatura</p>
                      <p className="font-mono-tabular text-xs font-semibold text-slate-700 mt-0.5">
                        {formatIsoDate(activeCreatedIso)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3.5">
                      <p className="text-xs text-slate-500">Stato Firestore</p>
                      <p className="font-mono-tabular text-xs font-bold text-[#0B1F4D] mt-0.5">
                        {serverStatus
                          ? serverStatus.stato
                          : isAppsScriptConfigured
                            ? 'In sincronizzazione...'
                            : 'Pass locale'}
                      </p>
                    </div>
                  </div>

                  {/* Documenti accettati & Squadra Zona VAR */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-1.5 text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-[#0B1F4D]">
                        <FileCheck2 className="w-4 h-4 text-[#C69214]" />
                        <span>Documenti accettati</span>
                      </div>
                      {waitingPass?.acceptedDocs ? (
                        <div className="space-y-0.5 text-slate-600 font-mono-tabular text-[11px]">
                          <p>✓ Privacy GDPR v{waitingPass.acceptedDocs.versionePrivacy}</p>
                          <p>✓ Regolamento v{waitingPass.acceptedDocs.versioneRegolamento}</p>
                          <p>✓ Regole Chat v{waitingPass.acceptedDocs.versioneRegoleChat}</p>
                        </div>
                      ) : (
                        <p className="text-slate-600 leading-relaxed">
                          Consenso Privacy v{config.versioneInformativa} registrato su Firestore con la candidatura.
                        </p>
                      )}
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-1.5 text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-[#0B1F4D]">
                        <Trophy className="w-4 h-4 text-[#0284C7]" />
                        <span>Squadra assegnata (Zona VAR)</span>
                      </div>
                      <p className="text-slate-600 leading-relaxed">
                        In attesa di assegnazione dallo staff. Il collegamento automatico al database squadre Zona VAR (<span className="font-mono-tabular">ficup-c9186</span>) è in fase di configurazione tecnica.
                      </p>
                    </div>
                  </div>

                  {serverStatus && serverStatus.publicHistory.length > 0 && (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-2.5">
                      <p className="text-xs font-bold uppercase tracking-wider text-[#0B1F4D]">
                        Aggiornamenti pubblici registrati
                      </p>
                      <div className="space-y-1.5">
                        {serverStatus.publicHistory.map((item, idx) => (
                          <div
                            key={`${item.statoNuovo}-${idx}`}
                            className="flex items-center justify-between gap-2 text-xs text-slate-700 bg-white border border-slate-200/80 rounded-lg px-3 py-2"
                          >
                            <span className="font-mono-tabular font-semibold text-[#0B1F4D]">
                              {item.statoNuovo}
                            </span>
                            <span className="font-mono-tabular text-slate-500">
                              {formatIsoDate(item.createdAtIso)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!serverStatus && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 flex items-start gap-2.5 text-xs text-slate-600 leading-relaxed">
                      <Info className="w-4 h-4 text-[#0284C7] shrink-0 mt-0.5" />
                      <span>
                        La raccolta <span className="font-mono-tabular">candidature</span> resta protetta da lettura pubblica. Premi <strong>Verifica</strong> qui sopra quando il backend Apps Script è collegato per aggiornare lo stato in tempo reale.
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Inserisci qui sopra il tuo codice <span className="font-mono-tabular font-semibold text-[#0B1F4D]">FICUP26</span> e la tua email Fantaleghe per controllare lo stato reale della tua candidatura, oppure avvia la procedura guidata.
                  </p>
                  <button
                    type="button"
                    onClick={onStartWizard}
                    disabled={!config.iscrizioniAperte}
                    className="min-h-[48px] px-6 py-3 rounded-xl bg-[#0B1F4D] text-white text-sm font-bold hover:bg-[#153985] disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Entra in campo ora</span>
                    <ArrowRight className="w-4 h-4 text-[#D4AF37]" />
                  </button>
                </div>
              )}
            </motion.div>

            {/* Cronologia delle 5 fasi */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 shadow-xs space-y-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#0284C7]">
                  Avanzamento candidatura
                </p>
                <h2 className="font-display text-xl font-bold text-[#0B1F4D] mt-0.5">
                  Cronologia delle fasi
                </h2>
              </div>

              <div className="space-y-3.5">
                {timelineStages.map((stage, index) => {
                  const isDone = stage.status === 'completed';
                  const isActive = stage.status === 'active';
                  const isRejected = stage.status === 'rejected';
                  return (
                    <div
                      key={stage.id}
                      className={`rounded-2xl border p-4 flex items-start gap-3.5 ${
                        isDone
                          ? 'border-emerald-200 bg-emerald-50/70'
                          : isActive
                            ? 'border-sky-200 bg-sky-50/70'
                            : isRejected
                              ? 'border-red-200 bg-red-50/70'
                              : 'border-slate-200 bg-slate-50/70 opacity-85'
                      }`}
                    >
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isDone
                            ? 'bg-emerald-100 text-emerald-700'
                            : isActive
                              ? 'bg-sky-100 text-[#0284C7]'
                              : isRejected
                                ? 'bg-red-100 text-red-700'
                                : 'bg-white border border-slate-200 text-slate-400'
                        }`}
                      >
                        {isDone ? (
                          <CheckCircle2 className="w-5 h-5" />
                        ) : isActive ? (
                          <Clock className="w-5 h-5" />
                        ) : isRejected ? (
                          <XCircle className="w-5 h-5" />
                        ) : (
                          <Lock className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="font-display text-base font-bold text-[#0B1F4D]">
                            {index + 1}. {stage.title}
                          </h3>
                          <span
                            className={`text-[11px] font-mono-tabular font-bold ${
                              isDone
                                ? 'text-emerald-700'
                                : isActive
                                  ? 'text-[#0284C7]'
                                  : isRejected
                                    ? 'text-red-700'
                                    : 'text-slate-500'
                            }`}
                          >
                            {isDone
                              ? 'COMPLETATA'
                              : isActive
                                ? 'IN CORSO'
                                : isRejected
                                  ? 'NON ACCOLTA'
                                  : 'BLOCCATA'}
                          </span>
                        </div>
                        <p className="mt-1 text-xs sm:text-sm text-slate-600 leading-relaxed">
                          {stage.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Gated WhatsApp Access & League Info */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5">
                <MessageCircle className="w-5 h-5 text-emerald-700" />
                <h2 className="font-display text-lg font-bold text-[#0B1F4D]">
                  Accesso gruppi WhatsApp
                </h2>
              </div>

              {/* Gruppo Ufficiale — strictly gated */}
              <div
                className={`rounded-2xl border p-4 space-y-3 ${
                  canAccessOfficialWa
                    ? 'border-emerald-300 bg-emerald-50/70'
                    : 'border-slate-200 bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-[#0B1F4D]">Gruppo WhatsApp Ufficiale</p>
                  <span
                    className={`text-[11px] font-mono-tabular font-bold ${
                      canAccessOfficialWa ? 'text-emerald-700' : 'text-slate-500'
                    }`}
                  >
                    {canAccessOfficialWa ? 'SBLOCCATO' : 'BLOCCATO'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {canAccessOfficialWa
                    ? 'Candidatura in stato COMPLETATO! Ora puoi accedere direttamente al Gruppo WhatsApp Ufficiale della community FICUP.'
                    : 'Il pulsante ufficiale si sblocca esclusivamente quando la candidatura risulta in stato COMPLETATO con accesso ufficiale abilitato dal backend.'}
                </p>

                {canAccessOfficialWa && serverStatus?.linkWhatsappUfficiale ? (
                  <a
                    href={serverStatus.linkWhatsappUfficiale}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[48px] w-full px-4 py-2.5 rounded-xl bg-emerald-700 text-white text-xs sm:text-sm font-bold hover:bg-emerald-800 transition-colors inline-flex items-center justify-center gap-2 shadow-xs"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>ENTRA NEL GRUPPO UFFICIALE</span>
                    <ExternalLink className="w-4 h-4 opacity-80" />
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="min-h-[48px] px-4 py-2.5 rounded-xl bg-slate-200/80 border border-slate-300 text-xs sm:text-sm font-semibold text-slate-500 inline-flex items-center justify-center gap-2 w-full cursor-not-allowed"
                  >
                    <Lock className="w-4 h-4 text-slate-500" />
                    <span>Accesso WhatsApp non ancora disponibile</span>
                  </button>
                )}
              </div>

              {/* Gruppo Provvisorio */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-[#0B1F4D]">Gruppo WhatsApp Provvisorio</p>
                  <span
                    className={`text-[11px] font-mono-tabular font-bold ${
                      canAccessProvisionalWa ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {canAccessProvisionalWa ? 'ATTIVO' : 'BLOCCATO'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {canAccessProvisionalWa
                    ? `Canale facoltativo di supporto community. Indica il tuo codice ${activeCode} se scrivi in chat.`
                    : realState === 'RESPINTO'
                      ? 'Non disponibile per candidature non accolte.'
                      : 'Si sblocca dopo l’invio della tua candidatura.'}
                </p>
                {canAccessProvisionalWa ? (
                  <a
                    href={serverStatus?.linkWhatsappProvvisorio || config.linkWhatsappProvvisorio}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[46px] w-full px-4 py-2.5 rounded-xl bg-[#0B1F4D] text-white text-xs sm:text-sm font-bold hover:bg-[#153985] transition-colors inline-flex items-center justify-center gap-2"
                  >
                    <span>Apri gruppo provvisorio</span>
                    <ExternalLink className="w-4 h-4 text-[#D4AF37]" />
                  </a>
                ) : (
                  <div className="min-h-[44px] px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-500 inline-flex items-center justify-center gap-2 w-full">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Verifica candidatura per accedere</span>
                  </div>
                )}
              </div>
            </div>

            {/* Comunicazioni e Informazioni Lega */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5">
                <Bell className="w-5 h-5 text-[#C69214]" />
                <h2 className="font-display text-lg font-bold text-[#0B1F4D]">
                  Informazioni sulla lega
                </h2>
              </div>

              <div className="divide-y divide-slate-200 text-xs sm:text-sm">
                <div className="py-2.5 flex items-center justify-between gap-2">
                  <span className="text-slate-500">Stagione</span>
                  <span className="font-mono-tabular font-bold text-[#0B1F4D]">
                    {config.stagione}
                  </span>
                </div>
                <div className="py-2.5 flex items-center justify-between gap-2">
                  <span className="text-slate-500">Stato iscrizioni</span>
                  <span
                    className={`font-semibold ${
                      config.iscrizioniAperte ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {config.iscrizioniAperte ? 'Candidature aperte' : 'Chiuse'}
                  </span>
                </div>
                <div className="py-2.5 flex items-center justify-between gap-2">
                  <span className="text-slate-500">Budget iniziale</span>
                  <span className="font-mono-tabular font-bold text-[#0B1F4D]">
                    {config.budgetIniziale} crediti
                  </span>
                </div>
                <div className="py-2.5 flex items-center justify-between gap-2">
                  <span className="text-slate-500">Modalità mercato</span>
                  <span className="font-semibold text-[#0B1F4D]">{config.modalitaMercato}</span>
                </div>
              </div>

              <div className="space-y-2.5 pt-2">
                <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3.5 flex items-start gap-2.5 text-xs text-slate-600 leading-relaxed">
                  <Mail className="w-4 h-4 text-[#0284C7] shrink-0 mt-0.5" />
                  <span>
                    Controlla anche la cartella <strong>Spam</strong> o <strong>Promozioni</strong> per le email da{' '}
                    <span className="font-mono-tabular">{config.emailOperativa}</span> e l&apos;invito ufficiale di Fantaleghe.
                  </span>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3.5 flex items-start gap-2.5 text-xs text-slate-600 leading-relaxed">
                  <ShieldCheck className="w-4 h-4 text-[#C69214] shrink-0 mt-0.5" />
                  <span>
                    Contatto operativo:{' '}
                    <a
                      href={`mailto:${config.emailOperativa}`}
                      className="font-mono-tabular font-semibold text-[#0284C7] underline underline-offset-2"
                    >
                      {config.emailOperativa}
                    </a>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
