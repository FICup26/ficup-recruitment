import {
  AlertCircle,
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  fetchWaitingRoomStatus,
  isAppsScriptConfigured,
  type WaitingRoomServerStatus,
} from '../lib/appsScriptClient';
import type { CandidaturaStato, ConfigurazionePublica } from '../lib/firestore';
import {
  buildProvisionalWhatsappUrl,
  isProvisionalWhatsappUnlockedByVideo,
  loadIntroVideoCompletion,
} from '../lib/introVideoStorage';
import type { WaitingRoomPass } from '../lib/waitingRoomStorage';
import { FicupIntroVideo } from './FicupIntroVideo';
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
      return 'NON ACCOLTA';
    case 'APPROVATO':
    case 'INVITO INVIATO':
    case 'DA COMPLETARE':
      return stato;
    default:
      return 'IN ATTESA DI VERIFICA STAFF';
  }
}

function getStateBadgeClasses(stato: CandidaturaStato | null): string {
  switch (stato) {
    case 'COMPLETATO':
      return 'bg-emerald-50 border-emerald-300 text-emerald-800';
    case 'RESPINTO':
      return 'bg-red-50 border-red-200 text-red-700';
    default:
      return 'bg-amber-50 border-amber-200 text-[#B45309]';
  }
}

const CELEBRATION_CONFETTI = [
  { id: 1, left: '8%', color: '#D4AF37', delay: 0.0 },
  { id: 2, left: '19%', color: '#10B981', delay: 0.2 },
  { id: 3, left: '31%', color: '#38BDF8', delay: 0.1 },
  { id: 4, left: '44%', color: '#FDE68A', delay: 0.35 },
  { id: 5, left: '57%', color: '#FFFFFF', delay: 0.15 },
  { id: 6, left: '69%', color: '#D4AF37', delay: 0.28 },
  { id: 7, left: '81%', color: '#10B981', delay: 0.05 },
  { id: 8, left: '92%', color: '#38BDF8', delay: 0.22 },
];

type JourneyPhaseStatus = 'COMPLETATO' | 'IN CORSO' | 'IN ATTESA' | 'NON ACCOLTA';

interface JourneyPhase {
  number: string;
  title: string;
  description: string;
  status: JourneyPhaseStatus;
}

function buildCandidateJourneyPhases(params: {
  serverStatus: WaitingRoomServerStatus | null;
  hasLocalPass: boolean;
  codiceHint: string;
  provisionalUnlocked: boolean;
}): JourneyPhase[] {
  const { serverStatus, hasLocalPass, codiceHint, provisionalUnlocked } = params;
  const hasCandidate = Boolean(serverStatus || hasLocalPass);
  const realState: CandidaturaStato | null =
    serverStatus?.stato ?? (hasLocalPass ? 'NUOVO' : null);
  const isRejected = realState === 'RESPINTO';
  const isCompleted = realState === 'COMPLETATO';
  const isInviteSentOrBeyond =
    realState === 'INVITO INVIATO' ||
    realState === 'DA COMPLETARE' ||
    realState === 'COMPLETATO';
  const codeDisplay = codiceHint || 'FICUP26';

  return [
    {
      number: '01',
      title: 'CANDIDATURA INVIATA',
      description: hasCandidate
        ? `Richiesta registrata correttamente con codice personale ${codeDisplay}.`
        : 'Compila i tuoi dati e invia la candidatura per ricevere il codice personale.',
      status: hasCandidate ? 'COMPLETATO' : 'IN CORSO',
    },
    {
      number: '02',
      title: 'VIDEOCLIP & GRUPPO PROVVISORIO',
      description:
        'Guarda il videoclip FICUP ed entra nel Gruppo WhatsApp Provvisorio presentando il tuo codice.',
      status: !hasCandidate
        ? 'IN ATTESA'
        : provisionalUnlocked
          ? 'COMPLETATO'
          : 'IN CORSO',
    },
    {
      number: '03',
      title: 'VALUTAZIONE STAFF',
      description: isRejected
        ? 'La richiesta non è stata accolta per questa stagione.'
        : isCompleted || isInviteSentOrBeyond
          ? 'Candidatura valutata positivamente dallo staff!'
          : 'Lo staff sta valutando la tua richiesta. Non devi fare nulla: controlla anche Spam e Promozioni.',
      status: !hasCandidate
        ? 'IN ATTESA'
        : isRejected
          ? 'NON ACCOLTA'
          : isCompleted || isInviteSentOrBeyond
            ? 'COMPLETATO'
            : 'IN CORSO',
    },
    {
      number: '04',
      title: 'INVITO FANTALEGHE & GRUPPO UFFICIALE',
      description: isCompleted
        ? 'Accesso completo sbloccato! Controlla la tua email per l’invito Fantaleghe ed entra nel Gruppo WhatsApp Ufficiale.'
        : 'Quando lo staff completerà la pratica riceverai l’invito ufficiale via email e si sbloccherà il Gruppo WhatsApp Ufficiale.',
      status: isCompleted ? 'COMPLETATO' : isInviteSentOrBeyond ? 'IN CORSO' : 'IN ATTESA',
    },
  ];
}

export function WaitingRoom({
  config,
  waitingPass,
  onStartWizard,
  onWaitingPassVerified,
}: WaitingRoomProps) {
  const prefersReducedMotion = Boolean(useReducedMotion());
  const [copiedCode, setCopiedCode] = useState(false);

  const [lookupCode, setLookupCode] = useState(waitingPass?.codiceCandidatura ?? '');
  const [lookupEmail, setLookupEmail] = useState(waitingPass?.emailFantaleghe ?? '');
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [serverStatus, setServerStatus] = useState<WaitingRoomServerStatus | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [introVideoUnlocked, setIntroVideoUnlocked] = useState<boolean>(() => {
    if (!waitingPass?.codiceCandidatura) return false;
    return isProvisionalWhatsappUnlockedByVideo(
      loadIntroVideoCompletion(waitingPass.codiceCandidatura, waitingPass.emailFantaleghe)
    );
  });
  const [provisionalJustUnlocked, setProvisionalJustUnlocked] = useState(false);

  const handleVideoUnlockChange = useCallback(
    (unlocked: boolean, justTriggered?: boolean) => {
      setIntroVideoUnlocked(unlocked);
      if (unlocked && justTriggered) {
        setProvisionalJustUnlocked(true);
      }
    },
    []
  );

  const runLookup = useCallback(
    async (code: string, email: string, persistLocal: boolean, silent = false) => {
      if (!isAppsScriptConfigured || !code.trim() || !email.trim()) {
        return;
      }
      if (!silent) {
        setLoadingStatus(true);
        setLookupError(null);
      }
      try {
        const data = await fetchWaitingRoomStatus({
          codiceCandidatura: code,
          emailFantaleghe: email,
        });
        setServerStatus(data);
        setLastCheckedAt(new Date().toISOString());

        if (persistLocal && onWaitingPassVerified) {
          const isLiberaTeam =
            data.nomeSquadra?.trim().toUpperCase() === 'CANDIDATURA LIBERA';
          onWaitingPassVerified({
            id: data.codiceCandidatura,
            codiceCandidatura: data.codiceCandidatura,
            tipoCandidatura: isLiberaTeam ? 'LIBERA' : waitingPass?.tipoCandidatura,
            nomeCompleto: data.nomeCompleto || data.nome,
            emailFantaleghe: email.trim().toLowerCase(),
            nomeSquadra: data.nomeSquadra,
            serieSquadra: isLiberaTeam ? undefined : waitingPass?.serieSquadra,
            submittedAtIso: data.createdAtIso || new Date().toISOString(),
            acceptedDocs: waitingPass?.acceptedDocs,
          });
        }
      } catch (err) {
        if (!silent) {
          setLookupError(
            err instanceof Error
              ? err.message
              : 'Impossibile aggiornare lo stato in questo momento. Riprova tra poco.'
          );
        }
      } finally {
        if (!silent) {
          setLoadingStatus(false);
        }
      }
    },
    [onWaitingPassVerified, waitingPass?.acceptedDocs]
  );

  // Sync iniziale al cambio di waitingPass
  useEffect(() => {
    if (waitingPass) {
      setLookupCode(waitingPass.codiceCandidatura);
      setLookupEmail(waitingPass.emailFantaleghe);
      setIntroVideoUnlocked(
        isProvisionalWhatsappUnlockedByVideo(
          loadIntroVideoCompletion(waitingPass.codiceCandidatura, waitingPass.emailFantaleghe)
        )
      );
      if (isAppsScriptConfigured) {
        runLookup(waitingPass.codiceCandidatura, waitingPass.emailFantaleghe, false);
      }
    } else {
      setServerStatus(null);
    }
  }, [waitingPass?.codiceCandidatura, waitingPass?.emailFantaleghe, waitingPass, runLookup]);

  const activeCode = serverStatus?.codiceCandidatura ?? waitingPass?.codiceCandidatura ?? '';
  const activeEmail = waitingPass?.emailFantaleghe ?? lookupEmail.trim().toLowerCase();
  const activeTeam = serverStatus?.nomeSquadra ?? waitingPass?.nomeSquadra ?? '';
  const activeTipoCandidatura: 'LIBERA' | 'SUBENTRO' | undefined =
    waitingPass?.tipoCandidatura ??
    (activeTeam.trim().toUpperCase() === 'CANDIDATURA LIBERA' ? 'LIBERA' : undefined);
  const activeSerie =
    activeTipoCandidatura === 'LIBERA' ? '' : (waitingPass?.serieSquadra ?? '');
  const displayTeamTitle =
    activeTipoCandidatura === 'LIBERA' ||
    activeTeam.trim().toUpperCase() === 'CANDIDATURA LIBERA'
      ? 'Candidatura libera — nessuna squadra selezionata'
      : activeSerie
        ? `${activeTeam} · ${activeSerie}`
        : activeTeam;
  const activeName = serverStatus?.nomeCompleto ?? waitingPass?.nomeCompleto ?? '';
  const firstName = activeName.trim().split(/\s+/)[0] || '';
  const activeCreatedIso = serverStatus?.createdAtIso ?? waitingPass?.submittedAtIso ?? null;
  const hasVerifiedOrLocal = Boolean(serverStatus || waitingPass);

  const realState: CandidaturaStato | null =
    serverStatus?.stato ?? (waitingPass ? 'NUOVO' : null);

  // Aggiornamento automatico discreto ogni 25 secondi finché non è COMPLETATO o RESPINTO
  useEffect(() => {
    if (
      !isAppsScriptConfigured ||
      !activeCode ||
      !activeEmail ||
      realState === 'COMPLETATO' ||
      realState === 'RESPINTO'
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        runLookup(activeCode, activeEmail, false, true);
      }
    }, 25000);

    return () => window.clearInterval(timer);
  }, [activeCode, activeEmail, realState, runLookup]);

  const handleLookupSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const cleanCode = lookupCode.trim().toUpperCase();
    const cleanEmail = lookupEmail.trim().toLowerCase();
    if (!cleanCode || !cleanEmail) {
      setLookupError('Inserisci sia il codice personale sia l’email utilizzata su Fantaleghe.');
      return;
    }
    await runLookup(cleanCode, cleanEmail, true);
  };

  const canAccessProvisionalWa = Boolean(hasVerifiedOrLocal) && realState !== 'RESPINTO';
  const canAccessOfficialWa =
    serverStatus !== null &&
    serverStatus.stato === 'COMPLETATO' &&
    Boolean(serverStatus.linkWhatsappUfficiale);

  const provisionalBaseUrl =
    serverStatus?.linkWhatsappProvvisorio || config.linkWhatsappProvvisorio;
  const prefilledProvisionalWaUrl = buildProvisionalWhatsappUrl(provisionalBaseUrl, {
    codiceCandidatura: activeCode,
    nomeCandidato: activeName,
    nomeSquadra: activeTipoCandidatura === 'LIBERA' ? '' : activeTeam,
    serieSquadra: activeSerie,
    tipoCandidatura: activeTipoCandidatura,
  });

  const journeyPhases = buildCandidateJourneyPhases({
    serverStatus,
    hasLocalPass: Boolean(waitingPass),
    codiceHint: activeCode,
    provisionalUnlocked: introVideoUnlocked,
  });

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

  const acceptedHeadline = firstName
    ? `${firstName.toUpperCase()}, SEI STATO ACCETTATO!`
    : 'SEI STATO ACCETTATO!';

  return (
    <div className="bg-white text-[#0B1F4D] min-h-[calc(100vh-4.5rem)]">
      {/* FASCIA HERO A TUTTA LARGHEZZA: STATO CANDIDATURA */}
      {canAccessOfficialWa && serverStatus?.linkWhatsappUfficiale ? (
        <motion.section
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="relative overflow-hidden bg-gradient-to-br from-[#071436] via-[#0B1F4D] to-[#0D3847] text-white px-4 sm:px-8 py-10 sm:py-14 border-b-4 border-[#D4AF37]"
        >
          <div
            aria-hidden="true"
            className="absolute -top-20 left-[12%] w-48 h-64 bg-gradient-to-b from-[#FDE68A]/20 to-transparent -rotate-12 pointer-events-none"
          />
          <div
            aria-hidden="true"
            className="absolute -top-20 right-[12%] w-48 h-64 bg-gradient-to-b from-[#FDE68A]/20 to-transparent rotate-12 pointer-events-none"
          />
          {!prefersReducedMotion && (
            <div aria-hidden="true" className="pointer-events-none">
              {CELEBRATION_CONFETTI.map((item) => (
                <motion.span
                  key={item.id}
                  animate={{ y: [-6, 14, -6], opacity: [0.45, 0.95, 0.45] }}
                  transition={{
                    duration: 3.2 + (item.id % 3) * 0.4,
                    delay: item.delay,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                  style={{ left: item.left, backgroundColor: item.color }}
                  className="absolute top-4 w-2 h-3 rotate-12 rounded-xs"
                />
              ))}
            </div>
          )}

          <div className="relative z-10 max-w-6xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-7">
            <div className="space-y-3 max-w-2xl">
              <div className="flex items-center gap-3">
                <FicupLogo size="sm" className="bg-white p-0.5 shrink-0" />
                <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.2em] text-[#FDE68A]">
                  <Sparkles className="w-4 h-4 text-[#D4AF37]" />
                  <span>CANDIDATURA COMPLETATA</span>
                </span>
              </div>

              <h1 className="font-display text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
                {acceptedHeadline}
              </h1>

              <p className="text-base sm:text-lg text-slate-100 leading-relaxed">
                La tua candidatura è stata completata. Controlla la tua email per l&apos;invito Fantaleghe e segui le istruzioni ricevute.
              </p>
            </div>

            <motion.a
              href={serverStatus.linkWhatsappUfficiale}
              target="_blank"
              rel="noopener noreferrer"
              animate={
                prefersReducedMotion
                  ? undefined
                  : {
                      boxShadow: [
                        '0 12px 30px -8px rgba(212,175,55,0.45)',
                        '0 0 38px 6px rgba(253,230,138,0.65)',
                        '0 12px 30px -8px rgba(212,175,55,0.45)',
                      ],
                    }
              }
              transition={{ duration: 2.2, repeat: Infinity }}
              className="min-h-[58px] px-7 py-4 rounded-2xl bg-gradient-to-r from-[#D4AF37] via-[#E7C860] to-[#C69214] text-[#071436] text-sm sm:text-base font-black tracking-wide hover:brightness-105 active:scale-[0.98] transition-all inline-flex items-center justify-center gap-2.5 shrink-0"
            >
              <MessageCircle className="w-5 h-5" />
              <span>ENTRA NEL GRUPPO WHATSAPP UFFICIALE</span>
              <ExternalLink className="w-4 h-4" />
            </motion.a>
          </div>
        </motion.section>
      ) : hasVerifiedOrLocal && realState === 'RESPINTO' ? (
        <section className="bg-gradient-to-r from-red-950 via-[#2B0E16] to-[#071436] text-white px-4 sm:px-8 py-9 border-b border-red-900">
          <div className="max-w-6xl mx-auto space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-red-200">
              <XCircle className="w-4 h-4" />
              <span>Esito candidatura · {activeCode}</span>
            </div>
            <h1 className="font-display text-2xl sm:text-4xl font-black text-white">
              CANDIDATURA NON ACCOLTA
            </h1>
            <p className="text-sm sm:text-base text-slate-200 max-w-2xl leading-relaxed">
              Per maggiori informazioni puoi contattare lo staff all&apos;indirizzo{' '}
              <strong className="font-mono-tabular text-white">{config.emailOperativa}</strong>.
            </p>
          </div>
        </section>
      ) : hasVerifiedOrLocal ? (
        <section className="bg-gradient-to-br from-[#071436] via-[#0B1F4D] to-[#153985] text-white px-4 sm:px-8 py-9 sm:py-11">
          <div className="max-w-6xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="flex items-center gap-2.5 text-xs font-black uppercase tracking-[0.2em] text-[#FDE68A]">
                <Clock className="w-4 h-4" />
                <span>AREA PERSONALE FICUP · {config.stagione}</span>
              </div>

              <h1 className="font-display text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white">
                IN ATTESA DI VERIFICA STAFF
              </h1>

              <p className="text-sm sm:text-base text-slate-200 leading-relaxed">
                La tua candidatura è stata ricevuta. Lo staff sta valutando la tua richiesta.{' '}
                <strong>Riceverai una comunicazione quando ci saranno aggiornamenti.</strong>
              </p>
            </div>

            {/* Codice personale + aggiornamento stato */}
            <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end gap-3 shrink-0">
              <div className="flex items-center gap-3 bg-white/10 border border-white/20 rounded-2xl px-4 py-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#FDE68A]">
                    Codice personale
                  </p>
                  <p className="font-mono-tabular text-xl sm:text-2xl font-black text-white tracking-wider">
                    {activeCode}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="min-h-[40px] px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-bold text-white inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  {copiedCode ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-300" />
                      <span>Copiato</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-[#FDE68A]" />
                      <span>Copia</span>
                    </>
                  )}
                </button>
              </div>

              {isAppsScriptConfigured && activeCode && activeEmail && (
                <button
                  type="button"
                  onClick={() => runLookup(activeCode, activeEmail, false)}
                  disabled={loadingStatus}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-white text-[#071436] hover:bg-[#FDE68A] text-xs font-extrabold inline-flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-60"
                >
                  {loadingStatus ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  <span>Aggiorna stato</span>
                </button>
              )}
            </div>
          </div>
        </section>
      ) : (
        <section className="bg-gradient-to-br from-[#071436] via-[#0B1F4D] to-[#153985] text-white px-4 sm:px-8 py-10">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2.5 max-w-2xl">
              <div className="flex items-center gap-3">
                <FicupLogo size="sm" className="bg-white p-0.5" />
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#FDE68A]">
                  FANTA ITALIA CUP · Area Personale
                </p>
              </div>
              <h1 className="font-display text-3xl sm:text-4xl font-black tracking-tight text-white">
                CONTROLLA LA TUA CANDIDATURA
              </h1>
              <p className="text-sm sm:text-base text-slate-200 leading-relaxed">
                Inserisci il tuo codice personale <strong>FICUP26</strong> e l&apos;email usata su Fantaleghe per seguire lo stato aggiornato della richiesta.
              </p>
            </div>

            <button
              type="button"
              onClick={onStartWizard}
              disabled={!config.iscrizioniAperte}
              className="min-h-[52px] px-7 py-3.5 rounded-2xl bg-gradient-to-r from-[#D4AF37] via-[#E7C860] to-[#C69214] text-[#071436] text-sm font-black hover:brightness-105 disabled:opacity-50 transition-all inline-flex items-center justify-center gap-2 shrink-0 cursor-pointer"
            >
              <span>Invia la tua candidatura</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>
      )}

      {/* CORPO PRINCIPALE A FASCE PULITE */}
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 sm:py-10 space-y-10">
        {/* VIDEOCLIP + SBLOCCO GRUPPO WHATSAPP PROVVISORIO */}
        {hasVerifiedOrLocal && canAccessProvisionalWa && (
          <FicupIntroVideo
            variant="card"
            codiceCandidatura={activeCode}
            emailFantaleghe={activeEmail}
            nomeCandidato={activeName}
            nomeSquadra={activeTipoCandidatura === 'LIBERA' ? '' : activeTeam}
            serieSquadra={activeSerie}
            tipoCandidatura={activeTipoCandidatura}
            provisionalWhatsappUrl={provisionalBaseUrl}
            canAccessProvisionalWa={canAccessProvisionalWa}
            realState={realState}
            onUnlockStateChange={handleVideoUnlockChange}
          />
        )}

        {/* ACCESSO / VERIFICA CODICE CANDIDATURA (SEZIONE SNELLEZZA MASSIMA) */}
        <section className="border-b border-slate-200 pb-8 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <KeyRound className="w-5 h-5 text-[#C69214]" />
              <h2 className="font-display text-lg sm:text-xl font-black text-[#0B1F4D]">
                Recupera o aggiorna la tua candidatura
              </h2>
            </div>

            {serverStatus && lastCheckedAt && (
              <span className="text-xs font-semibold text-emerald-700 inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>Aggiornato alle {formatIsoDate(lastCheckedAt)}</span>
              </span>
            )}
          </div>

          <form onSubmit={handleLookupSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div className="sm:col-span-5">
              <label htmlFor="wr-code" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Codice personale
              </label>
              <input
                id="wr-code"
                type="text"
                value={lookupCode}
                onChange={(e) => setLookupCode(e.target.value.toUpperCase())}
                placeholder="FICUP26-XXXXXX"
                maxLength={14}
                className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-300 bg-white font-mono-tabular text-sm text-[#0B1F4D] uppercase placeholder:normal-case placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B1F4D]/25"
              />
            </div>

            <div className="sm:col-span-5">
              <label htmlFor="wr-email" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Email Fantaleghe
              </label>
              <input
                id="wr-email"
                type="email"
                value={lookupEmail}
                onChange={(e) => setLookupEmail(e.target.value)}
                placeholder="nome@esempio.it"
                maxLength={160}
                className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-[#0B1F4D] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B1F4D]/25"
              />
            </div>

            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={loadingStatus || !isAppsScriptConfigured}
                className="min-h-[48px] w-full px-4 py-2.5 rounded-xl bg-[#0B1F4D] text-white text-xs sm:text-sm font-bold hover:bg-[#153985] disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {loadingStatus ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 text-[#FDE68A]" />
                )}
                <span>Controlla</span>
              </button>
            </div>
          </form>

          {lookupError && (
            <div className="rounded-xl bg-red-50 border-l-4 border-red-600 p-3.5 flex items-start gap-2.5 text-xs sm:text-sm text-red-900">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{lookupError}</span>
            </div>
          )}
        </section>

        {/* DUE COLONNE PULITE SENZA BOX PESANTI */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
          {/* COLONNA SINISTRA: RIEPILOGO CANDIDATO + STATO AVANZAMENTO */}
          <div className="lg:col-span-7 space-y-8">
            {hasVerifiedOrLocal && (
              <section className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-wider text-[#C69214]">
                      Riepilogo candidatura · {config.stagione}
                    </p>
                    <h2 className="font-display text-2xl font-black text-[#0B1F4D]">
                      {displayTeamTitle}
                    </h2>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-xs font-extrabold ${getStateBadgeClasses(
                      realState
                    )}`}
                  >
                    {realState === 'COMPLETATO' ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : realState === 'RESPINTO' ? (
                      <XCircle className="w-3.5 h-3.5" />
                    ) : (
                      <Clock className="w-3.5 h-3.5" />
                    )}
                    <span>{getReadableStateLabel(realState)}</span>
                  </span>
                </div>

                <div className="divide-y divide-slate-200 border-y border-slate-200 text-sm">
                  <div className="py-3 flex items-center justify-between gap-4">
                    <span className="text-slate-500 font-medium">Fantallenatore</span>
                    <span className="font-bold text-[#0B1F4D] text-right">{activeName}</span>
                  </div>
                  <div className="py-3 flex items-center justify-between gap-4">
                    <span className="text-slate-500 font-medium">Email Fantaleghe</span>
                    <span className="font-semibold text-[#0284C7] break-all text-right">
                      {activeEmail}
                    </span>
                  </div>
                  <div className="py-3 flex items-center justify-between gap-4">
                    <span className="text-slate-500 font-medium">Data invio</span>
                    <span className="font-mono-tabular text-xs font-bold text-slate-700">
                      {formatIsoDate(activeCreatedIso)}
                    </span>
                  </div>
                </div>

                {serverStatus && serverStatus.publicHistory.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <p className="text-xs font-extrabold uppercase tracking-wider text-[#0B1F4D]">
                      Aggiornamenti dello staff
                    </p>
                    <div className="divide-y divide-slate-200 border-l-4 border-[#0284C7] pl-4">
                      {serverStatus.publicHistory.map((item, idx) => (
                        <div
                          key={`${item.statoNuovo}-${idx}`}
                          className="py-2 flex items-center justify-between gap-2 text-xs"
                        >
                          <span className="font-bold text-[#0B1F4D]">{item.statoNuovo}</span>
                          <span className="font-mono-tabular text-slate-500">
                            {formatIsoDate(item.createdAtIso)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* STATO AVANZAMENTO CHIARO CON NUMERI PROGRESSIVI GRANDI */}
            <section className="space-y-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wider text-[#0284C7]">
                  Stato del percorso
                </p>
                <h2 className="font-display text-xl sm:text-2xl font-black text-[#0B1F4D]">
                  Le 4 tappe verso il campo
                </h2>
              </div>

              <div className="divide-y divide-slate-200 border-y border-slate-200">
                {journeyPhases.map((item) => {
                  const isDone = item.status === 'COMPLETATO';
                  const isActive = item.status === 'IN CORSO';
                  const isRejected = item.status === 'NON ACCOLTA';

                  return (
                    <div
                      key={item.number}
                      className={`py-4 px-3 sm:px-4 flex items-start gap-4 transition-colors ${
                        isActive
                          ? 'bg-sky-50/60'
                          : isDone
                            ? 'bg-emerald-50/40'
                            : isRejected
                              ? 'bg-red-50/50'
                              : ''
                      }`}
                    >
                      <span
                        className={`font-mono-tabular text-2xl sm:text-3xl font-black leading-none shrink-0 ${
                          isDone
                            ? 'text-emerald-700'
                            : isActive
                              ? 'text-[#0284C7]'
                              : isRejected
                                ? 'text-red-700'
                                : 'text-slate-300'
                        }`}
                      >
                        {item.number}
                      </span>

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="font-display text-sm sm:text-base font-extrabold text-[#0B1F4D]">
                            {item.title}
                          </h3>
                          <span
                            className={`text-[11px] font-mono-tabular font-extrabold ${
                              isDone
                                ? 'text-emerald-700'
                                : isActive
                                  ? 'text-[#0284C7]'
                                  : isRejected
                                    ? 'text-red-700'
                                    : 'text-slate-400'
                            }`}
                          >
                            {item.status}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          {/* COLONNA DESTRA: GRUPPI WHATSAPP & COMUNICAZIONI */}
          <div className="lg:col-span-5 space-y-8">
            <section className="space-y-5">
              <div className="flex items-center gap-2.5">
                <MessageCircle className="w-5 h-5 text-emerald-700" />
                <h2 className="font-display text-xl font-black text-[#0B1F4D]">
                  Gruppi WhatsApp
                </h2>
              </div>

              {/* GRUPPO UFFICIALE — Visibile/sbloccato esclusivamente se COMPLETATO */}
              <div
                className={`border-l-4 pl-4 py-1 space-y-3 ${
                  canAccessOfficialWa ? 'border-emerald-600' : 'border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-black text-[#0B1F4D]">Gruppo WhatsApp Ufficiale</p>
                  <span
                    className={`text-[11px] font-mono-tabular font-bold ${
                      canAccessOfficialWa ? 'text-emerald-700' : 'text-slate-500'
                    }`}
                  >
                    {canAccessOfficialWa ? 'SBLOCCATO' : 'BLOCCATO'}
                  </span>
                </div>

                {canAccessOfficialWa && serverStatus?.linkWhatsappUfficiale ? (
                  <>
                    <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                      <strong>Sei stato accettato!</strong> Ora puoi entrare direttamente nel Gruppo WhatsApp Ufficiale di FICUP.
                    </p>
                    <a
                      href={serverStatus.linkWhatsappUfficiale}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[50px] w-full px-5 py-3 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-black inline-flex items-center justify-center gap-2 shadow-md transition-colors"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>ENTRA NEL GRUPPO WHATSAPP UFFICIALE</span>
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </>
                ) : (
                  <p className="text-xs text-slate-600 leading-relaxed flex items-start gap-2">
                    <Lock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <span>
                      Il gruppo ufficiale si attiva automaticamente solo quando la tua candidatura sarà completata dallo staff.
                    </span>
                  </p>
                )}
              </div>

              {/* GRUPPO PROVVISORIO */}
              <div
                className={`border-l-4 pl-4 py-1 space-y-3 ${
                  canAccessProvisionalWa && introVideoUnlocked
                    ? 'border-emerald-600'
                    : 'border-[#C69214]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-black text-[#0B1F4D]">Gruppo WhatsApp Provvisorio</p>
                  <span
                    className={`text-[11px] font-mono-tabular font-bold ${
                      canAccessProvisionalWa && introVideoUnlocked
                        ? 'text-emerald-700'
                        : 'text-[#B45309]'
                    }`}
                  >
                    {canAccessProvisionalWa && introVideoUnlocked ? 'DISPONIBILE' : 'VIDEOCLIP'}
                  </span>
                </div>

                {canAccessProvisionalWa && introVideoUnlocked && prefilledProvisionalWaUrl ? (
                  <motion.a
                    href={prefilledProvisionalWaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    animate={
                      provisionalJustUnlocked && !prefersReducedMotion
                        ? {
                            scale: [1, 1.025, 1],
                            boxShadow: [
                              '0 0 0 rgba(16,185,129,0)',
                              '0 0 24px 4px rgba(16,185,129,0.45)',
                              '0 0 0 rgba(16,185,129,0)',
                            ],
                          }
                        : undefined
                    }
                    transition={{ duration: 1.5, repeat: provisionalJustUnlocked ? 3 : 0 }}
                    className="min-h-[48px] w-full px-5 py-3 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-black inline-flex items-center justify-center gap-2 shadow-sm transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>ENTRA NEL GRUPPO WHATSAPP PROVVISORIO</span>
                    <ExternalLink className="w-4 h-4" />
                  </motion.a>
                ) : (
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {canAccessProvisionalWa
                      ? 'Apri il videoclip FICUP qui sopra per sbloccare il collegamento diretto al gruppo provvisorio.'
                      : 'Disponibile dopo l’invio della candidatura.'}
                  </p>
                )}
              </div>
            </section>

            {/* RIEPILOGO LEGA E CONTATTI */}
            <section className="space-y-4 pt-2 border-t border-slate-200">
              <div className="flex items-center gap-2.5">
                <Bell className="w-5 h-5 text-[#C69214]" />
                <h2 className="font-display text-lg font-black text-[#0B1F4D]">
                  Dettagli della lega
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

              <div className="space-y-2.5 pt-2 text-xs text-slate-600 leading-relaxed">
                <p className="flex items-start gap-2">
                  <Mail className="w-4 h-4 text-[#0284C7] shrink-0 mt-0.5" />
                  <span>
                    Controlla sempre anche <strong>Spam</strong> e <strong>Promozioni</strong> per le email di invito a Fantaleghe.
                  </span>
                </p>
                <p className="flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#C69214] shrink-0 mt-0.5" />
                  <span>
                    Assistenza:{' '}
                    <a
                      href={`mailto:${config.emailOperativa}`}
                      className="font-mono-tabular font-bold text-[#0284C7] underline underline-offset-2"
                    >
                      {config.emailOperativa}
                    </a>
                  </span>
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
