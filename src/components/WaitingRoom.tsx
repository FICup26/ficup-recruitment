import {
  AlertCircle,
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Info,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  Trash2,
  XCircle,
} from 'lucide-react';
import { motion } from 'motion/react';
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
  onClearWaitingPass: () => void;
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
    case 'NUOVO':
      return 'Candidatura ricevuta';
    case 'DA CONTATTARE':
      return 'In valutazione · Da contattare';
    case 'APPROVATO':
      return 'Approvata · Invito in preparazione';
    case 'INVITO INVIATO':
      return 'Invito inviato';
    case 'DA COMPLETARE':
      return 'Accesso su Fantaleghe in verifica';
    case 'COMPLETATO':
      return 'Accesso completato';
    case 'RESPINTO':
      return 'Non accolta';
    default:
      return 'In attesa di verifica';
  }
}

function getStateBadgeClasses(stato: CandidaturaStato | null): string {
  switch (stato) {
    case 'COMPLETATO':
      return 'bg-emerald-50 border-emerald-200 text-emerald-700';
    case 'RESPINTO':
      return 'bg-red-50 border-red-200 text-red-700';
    case 'APPROVATO':
    case 'INVITO INVIATO':
    case 'DA COMPLETARE':
      return 'bg-amber-50 border-amber-200 text-[#B45309]';
    case 'NUOVO':
    case 'DA CONTATTARE':
      return 'bg-sky-50 border-sky-200 text-[#0284C7]';
    default:
      return 'bg-slate-100 border-slate-200 text-slate-600';
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
        title: 'Candidatura ricevuta',
        description:
          'Compila il modulo in 7 passaggi oppure verifica qui sotto con il tuo codice FICUP26 e l’email Fantaleghe.',
        status: 'locked',
      },
      {
        id: 'review',
        title: 'In valutazione',
        description:
          'Dopo l’invio, la candidatura entra in coda di valutazione presso lo staff FANTA ITALIA CUP.',
        status: 'locked',
      },
      {
        id: 'invite',
        title: 'Invito inviato',
        description:
          'A valutazione completata, lo staff invia l’invito ufficiale Fantaleghe al tuo indirizzo email.',
        status: 'locked',
      },
      {
        id: 'completed',
        title: 'Accesso completato',
        description:
          'Una volta completato l’ingresso su Fantaleghe e verificato dallo staff, si sblocca il gruppo WhatsApp ufficiale.',
        status: 'locked',
      },
    ];
  }

  if (realState === 'RESPINTO') {
    return [
      {
        id: 'received',
        title: 'Candidatura ricevuta',
        description: `Candidatura ${codiceHint} registrata su Cloud Firestore.`,
        status: 'completed',
      },
      {
        id: 'review',
        title: 'Valutazione conclusa',
        description:
          'La richiesta non è stata accolta per la stagione corrente. Per informazioni scrivi a scudetto26@gmail.com.',
        status: 'rejected',
      },
      {
        id: 'invite',
        title: 'Invito inviato',
        description: 'Fase non prevista per candidature non accolte.',
        status: 'locked',
      },
      {
        id: 'completed',
        title: 'Accesso completato',
        description: 'Fase non prevista per candidature non accolte.',
        status: 'locked',
      },
    ];
  }

  const stepRank =
    realState === 'COMPLETATO'
      ? 4
      : realState === 'INVITO INVIATO' || realState === 'DA COMPLETARE'
        ? 3
        : realState === 'APPROVATO' || realState === 'DA CONTATTARE' || realState === 'NUOVO'
          ? 2
          : 1;

  return [
    {
      id: 'received',
      title: 'Candidatura ricevuta',
      description: `Candidatura salvata su Cloud Firestore con codice ${codiceHint}.`,
      status: 'completed',
    },
    {
      id: 'review',
      title: 'In valutazione',
      description:
        realState === 'APPROVATO'
          ? 'La tua candidatura è stata approvata dallo staff! L’invito ufficiale su Fantaleghe è in preparazione.'
          : stepRank > 2
            ? 'Valutazione superata positivamente dallo staff FANTA ITALIA CUP.'
            : 'Lo staff verifica i dati della richiesta e si coordina con te tramite il gruppo WhatsApp provvisorio.',
      status: stepRank > 2 ? 'completed' : 'active',
    },
    {
      id: 'invite',
      title: 'Invito inviato',
      description:
        realState === 'INVITO INVIATO'
          ? 'Invito ufficiale inviato su Fantaleghe! Controlla la tua email (anche Spam/Promozioni), completa la rosa e avvisa lo staff sul gruppo provvisorio.'
          : realState === 'DA COMPLETARE'
            ? 'Invito inviato: completa gli ultimi passaggi su Fantaleghe (rosa e nome squadra) e avvisa lo staff.'
            : stepRank > 3
              ? 'Invito ufficiale accettato e ingresso effettuato su Fantaleghe.'
              : 'A valutazione completata, lo staff invia l’invito ufficiale Fantaleghe al tuo indirizzo email.',
      status: stepRank > 3 ? 'completed' : stepRank === 3 ? 'active' : 'locked',
    },
    {
      id: 'completed',
      title: 'Accesso completato',
      description:
        realState === 'COMPLETATO'
          ? 'Ingresso verificato dallo staff! Il collegamento al Gruppo WhatsApp Ufficiale è ora sbloccato qui a destra.'
          : 'Disponibile esclusivamente dopo verifica finale dello staff (stato COMPLETATO).',
      status: realState === 'COMPLETATO' ? 'completed' : 'locked',
    },
  ];
}

export function WaitingRoom({
  config,
  waitingPass,
  onStartWizard,
  onClearWaitingPass,
  onWaitingPassVerified,
}: WaitingRoomProps) {
  const [copiedCode, setCopiedCode] = useState(false);

  // Lookup form state (permette accesso/recupero da qualsiasi dispositivo)
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

  // Sincronizzazione automatica all'apertura se esiste un pass locale e l'endpoint è configurato
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

  const handleResetPass = () => {
    setServerStatus(null);
    setLookupError(null);
    setLookupCode('');
    setLookupEmail('');
    onClearWaitingPass();
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

  const canAccessProvisionalWa =
    Boolean(hasVerifiedOrLocal) && realState !== 'RESPINTO';
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="flex items-center gap-3">
                <FicupLogo size="sm" className="ring-1 ring-slate-200 p-0.5 bg-white" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C69214]">
                    FANTA ITALIA CUP · Waiting Room
                  </p>
                  <p className="text-xs text-slate-500">Area personale del candidato</p>
                </div>
              </div>
              <h1 className="font-display text-2xl sm:text-4xl font-black tracking-tight text-[#0B1F4D]">
                IL TUO PERCORSO VERSO FICUP È INIZIATO.
              </h1>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                Verifica lo stato reale della tua candidatura su Firestore con il codice <span className="font-mono-tabular font-semibold">FICUP26</span> e la tua email Fantaleghe, consulta gli avanzamenti e sblocca i gruppi WhatsApp quando autorizzati dallo staff.
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
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Verifica + Tessera Digitale + Cronologia reale */}
          <div className="lg:col-span-7 space-y-6">
            {/* Accesso / Recupero candidatura reale (Codice + Email) */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 shadow-xs space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[#0284C7]">
                    Verifica stato su Firestore
                  </p>
                  <h2 className="font-display text-lg sm:text-xl font-bold text-[#0B1F4D] mt-0.5">
                    Accedi o aggiorna la tua candidatura
                  </h2>
                </div>
                <KeyRound className="w-5 h-5 text-[#C69214] shrink-0 mt-1" />
              </div>

              {!isAppsScriptConfigured && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 flex items-start gap-2.5 text-xs text-amber-950 leading-relaxed">
                  <AlertCircle className="w-4 h-4 text-[#C69214] shrink-0 mt-0.5" />
                  <span>
                    <strong>Endpoint backend non ancora collegato:</strong> per leggere in tempo reale da Firestore gli avanzamenti impostati dallo staff, configura la variabile <span className="font-mono-tabular">VITE_APPS_SCRIPT_WEBAPP_URL</span> con l&apos;URL pubblicato del progetto Google Apps Script <span className="font-mono-tabular">FICUP 26/27 - Backend</span>.
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
              transition={{ duration: 0.35 }}
              className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 shadow-xs space-y-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[#C69214]">
                    Tessera digitale · Profilo candidato
                  </p>
                  <h2 className="font-display text-xl sm:text-2xl font-extrabold text-[#0B1F4D] mt-0.5">
                    {hasVerifiedOrLocal
                      ? activeTeam
                      : 'Nessuna candidatura verificata'}
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
                    <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3.5 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs text-slate-500">Stato Firestore</p>
                        <p className="font-mono-tabular text-xs font-bold text-[#0B1F4D] mt-0.5">
                          {serverStatus
                            ? serverStatus.stato
                            : isAppsScriptConfigured
                              ? 'In sincronizzazione...'
                              : 'Pass locale (non sincronizzato)'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleResetPass}
                        title="Rimuovi tessera da questo dispositivo"
                        className="min-h-[36px] px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-600 hover:text-[#0B1F4D] hover:bg-slate-50 inline-flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Esci</span>
                      </button>
                    </div>
                  </div>

                  {/* Aggiornamenti pubblici di stato */}
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
                        La raccolta <span className="font-mono-tabular">candidature</span> resta protetta da lettura pubblica. Premi <strong>Verifica</strong> qui sopra quando il backend Apps Script è collegato per leggere lo stato aggiornato da Firestore in totale sicurezza.
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Inserisci qui sopra il tuo codice <span className="font-mono-tabular font-semibold text-[#0B1F4D]">FICUP26</span> e la tua email Fantaleghe per controllare lo stato reale della tua candidatura, oppure avvia una nuova richiesta.
                  </p>
                  <button
                    type="button"
                    onClick={onStartWizard}
                    disabled={!config.iscrizioniAperte}
                    className="min-h-[48px] px-6 py-3 rounded-xl bg-[#0B1F4D] text-white text-sm font-bold hover:bg-[#153985] disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Avvia procedura candidatura (7 passaggi)</span>
                    <ArrowRight className="w-4 h-4 text-[#D4AF37]" />
                  </button>
                </div>
              )}
            </motion.div>

            {/* Cronologia delle fasi */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 shadow-xs space-y-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#0284C7]">
                  Stato della candidatura
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

          {/* Right Column: WhatsApp Access & League Info */}
          <div className="lg:col-span-5 space-y-6">
            {/* Accesso WhatsApp */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5">
                <MessageCircle className="w-5 h-5 text-emerald-700" />
                <h2 className="font-display text-lg font-bold text-[#0B1F4D]">
                  Accesso gruppi WhatsApp
                </h2>
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
                    ? `Canale per coordinarti con lo staff. Indica il tuo codice ${activeCode} in chat.`
                    : realState === 'RESPINTO'
                      ? 'Non disponibile per candidature non accolte.'
                      : 'Il collegamento si sblocca dopo l’invio o la verifica della tua candidatura.'}
                </p>
                {canAccessProvisionalWa ? (
                  <a
                    href={serverStatus?.linkWhatsappProvvisorio || config.linkWhatsappProvvisorio}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[46px] w-full px-4 py-2.5 rounded-xl bg-emerald-700 text-white text-xs sm:text-sm font-bold hover:bg-emerald-800 transition-colors inline-flex items-center justify-center gap-2"
                  >
                    <span>Apri gruppo provvisorio</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                ) : (
                  <div className="min-h-[44px] px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-500 inline-flex items-center justify-center gap-2 w-full">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Verifica candidatura per accedere</span>
                  </div>
                )}
              </div>

              {/* Gruppo Ufficiale (strictly locked unless Firestore verified COMPLETATO via Apps Script) */}
              <div
                className={`rounded-2xl border p-4 space-y-2.5 ${
                  canAccessOfficialWa
                    ? 'border-emerald-300 bg-emerald-50/70'
                    : 'border-amber-200 bg-amber-50/50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-[#0B1F4D]">Gruppo WhatsApp Ufficiale</p>
                  <span
                    className={`text-[11px] font-mono-tabular font-bold ${
                      canAccessOfficialWa ? 'text-emerald-700' : 'text-[#C69214]'
                    }`}
                  >
                    {canAccessOfficialWa ? 'SBLOCCATO' : 'SOLO COMPLETATO'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {canAccessOfficialWa
                    ? 'Ingresso verificato dallo staff! Ora puoi accedere al gruppo WhatsApp ufficiale della community FANTA ITALIA CUP.'
                    : 'Il collegamento è restituito dal server esclusivamente quando la candidatura raggiunge lo stato COMPLETATO su Firestore.'}
                </p>
                {canAccessOfficialWa && serverStatus?.linkWhatsappUfficiale ? (
                  <a
                    href={serverStatus.linkWhatsappUfficiale}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[48px] w-full px-4 py-2.5 rounded-xl bg-[#0B1F4D] text-white text-xs sm:text-sm font-bold hover:bg-[#153985] transition-colors inline-flex items-center justify-center gap-2 shadow-xs"
                  >
                    <MessageCircle className="w-4 h-4 text-[#D4AF37]" />
                    <span>ENTRA NEL GRUPPO WHATSAPP UFFICIALE</span>
                    <ExternalLink className="w-4 h-4 opacity-80" />
                  </a>
                ) : (
                  <div className="min-h-[44px] px-4 py-2.5 rounded-xl bg-white border border-amber-200 text-xs text-slate-600 inline-flex items-center justify-center gap-2 w-full">
                    <Lock className="w-3.5 h-3.5 text-[#C69214]" />
                    <span>In attesa di verifica COMPLETATO</span>
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
                    Controlla anche la cartella <strong>Spam</strong> o <strong>Promozioni</strong> per le comunicazioni email da{' '}
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
