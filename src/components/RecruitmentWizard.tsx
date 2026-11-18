import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  DoorOpen,
  ExternalLink,
  FileText,
  Gavel,
  Loader2,
  Lock,
  Mail,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Trophy,
  Wallet,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState, type FormEvent } from 'react';
import { isAppsScriptConfigured, triggerCandidaturaNotification } from '../lib/appsScriptClient';
import { isFirebaseConfigured } from '../lib/firebase';
import {
  fetchActivePublicDocument,
  saveAccettazioneDocumentale,
  submitCandidatura,
  validateCandidaturaInput,
  type ConfigurazionePublica,
  type DocumentoUfficialeRecord,
} from '../lib/firestore';
import { parseFirestoreUiError } from '../lib/notifications';
import {
  CHAT_RULES_VERSION,
  GDPR_PRIVACY_SECTIONS,
  maskSensitiveWhatsappLinks,
  OFFICIAL_CHAT_RULES_SECTIONS,
  REGOLAMENTO_FALLBACK_VERSION,
} from '../lib/officialDocuments';
import { loadWaitingRoomPass, type WaitingRoomPass } from '../lib/waitingRoomStorage';
import { FicupLogo } from './FicupLogo';
import { PrivacyModal } from './PrivacyModal';
import { RegulationContentView } from './RegulationContentView';

interface RecruitmentWizardProps {
  config: Omit<ConfigurazionePublica, 'updatedAt' | 'updatedBy'>;
  onExitToHome: () => void;
  onCandidaturaSubmitted?: (pass: WaitingRoomPass) => void;
  onOpenWaitingRoom?: () => void;
}

const STEP_LABELS = [
  'Dati',
  'Privacy GDPR',
  'Regolamento',
  'Regole Chat',
  'Riepilogo e Invio',
  'Prossimi Passaggi',
] as const;

const COMPLETION_TASKS = [
  'Attendi la conferma di approvazione nella tua Area Personale.',
  'Apri il link di invito ufficiale ricevuto via email da Fantaleghe (controlla anche Spam).',
  'Completa il login o la registrazione su Fantaleghe e accedi a FICUP 26/27.',
  'Personalizza la rosa con il budget iniziale e imposta il nome del tuo club.',
  'Avvisa lo staff sul gruppo WhatsApp provvisorio indicando il tuo codice FICUP26.',
  'Una volta verificato dallo staff, entra nel Gruppo WhatsApp Ufficiale dalla tua Area Personale.',
];

export function RecruitmentWizard({
  config,
  onExitToHome,
  onCandidaturaSubmitted,
  onOpenWaitingRoom,
}: RecruitmentWizardProps) {
  const [step, setStep] = useState<number>(1);
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);

  // Remote official documents (Regolamento testuale & optional Chat Rules text override)
  const [docsLoading, setDocsLoading] = useState(true);
  const [activeRegolamento, setActiveRegolamento] = useState<DocumentoUfficialeRecord | null>(null);
  const [activeChatRulesDoc, setActiveChatRulesDoc] = useState<DocumentoUfficialeRecord | null>(null);

  // Step 1 Form State
  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [emailFantaleghe, setEmailFantaleghe] = useState('');
  const [nomeSquadra, setNomeSquadra] = useState('');
  const [note, setNote] = useState('');
  const [step1Error, setStep1Error] = useState<string | null>(null);
  const [duplicateLocalWarning, setDuplicateLocalWarning] = useState<string | null>(null);

  // Mandatory Document Consents (Steps 2, 3, 4)
  const [consensoPrivacy, setConsensoPrivacy] = useState(false);
  const [step2Error, setStep2Error] = useState<string | null>(null);

  const [consensoRegolamento, setConsensoRegolamento] = useState(false);
  const [step3Error, setStep3Error] = useState<string | null>(null);

  const [consensoRegoleChat, setConsensoRegoleChat] = useState(false);
  const [step4Error, setStep4Error] = useState<string | null>(null);

  // Step 5 Submission State
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [acceptSyncWarning, setAcceptSyncWarning] = useState<string | null>(null);
  const [submittedRecord, setSubmittedRecord] = useState<{
    id: string;
    codiceCandidatura: string;
    emailFantaleghe: string;
    nomeSquadra: string;
    nomeCompleto: string;
    submittedAtIso: string;
  } | null>(null);
  const [emailDispatchState, setEmailDispatchState] = useState<
    'idle' | 'sending' | 'triggered' | 'scheduled_only' | 'unconfigured'
  >('idle');
  const [copiedCode, setCopiedCode] = useState(false);

  // Step 6 local checklist state
  const [checkedTasks, setCheckedTasks] = useState<boolean[]>(() =>
    COMPLETION_TASKS.map(() => false)
  );

  useEffect(() => {
    let cancelled = false;
    setDocsLoading(true);
    Promise.all([
      fetchActivePublicDocument('regolamento_attivo'),
      fetchActivePublicDocument('regole_chat_attive'),
    ])
      .then(([regDoc, chatDoc]) => {
        if (!cancelled) {
          setActiveRegolamento(regDoc);
          setActiveChatRulesDoc(chatDoc);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setDocsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Local device duplicate-email check (never reads public candidature collection)
  useEffect(() => {
    const cleanEmail = emailFantaleghe.trim().toLowerCase();
    if (!cleanEmail) {
      setDuplicateLocalWarning(null);
      return;
    }
    const existingPass = loadWaitingRoomPass();
    if (existingPass && existingPass.emailFantaleghe.trim().toLowerCase() === cleanEmail) {
      setDuplicateLocalWarning(
        `Su questo dispositivo risulta già registrata una candidatura con questa email (${existingPass.codiceCandidatura}). Se vuoi controllare lo stato invece di inviarne una nuova, accedi all'Area Personale.`
      );
    } else {
      setDuplicateLocalWarning(null);
    }
  }, [emailFantaleghe]);

  const progressPercent = Math.round((step / STEP_LABELS.length) * 100);
  const isSubmitted = submittedRecord !== null;
  const emailValidHint =
    emailFantaleghe.trim().length > 0 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailFantaleghe.trim());
  const squadValidHint = nomeSquadra.trim().length >= 2;

  const regolamentoVersionLabel = activeRegolamento?.versione || REGOLAMENTO_FALLBACK_VERSION;
  const regolamentoDocIdLabel = activeRegolamento?.id || 'in_attesa_pubblicazione';
  const chatRulesVersionLabel = activeChatRulesDoc?.versione || CHAT_RULES_VERSION;

  const handleStep1Next = (e: FormEvent) => {
    e.preventDefault();
    setStep1Error(null);
    try {
      validateCandidaturaInput({
        nome,
        cognome,
        emailFantaleghe,
        nomeSquadra,
        note,
        consensoPrivacy: true, // checked explicitly at Step 2
        versioneInformativa: config.versioneInformativa,
      });
      setStep(2);
    } catch (err) {
      setStep1Error(err instanceof Error ? err.message : 'Controlla i campi inseriti.');
    }
  };

  const handleStep2Next = () => {
    setStep2Error(null);
    if (!consensoPrivacy) {
      setStep2Error(
        'Per proseguire devi leggere e accettare l’Informativa Privacy GDPR FICUP.'
      );
      return;
    }
    setStep(3);
  };

  const handleStep3Next = () => {
    setStep3Error(null);
    if (!consensoRegolamento) {
      setStep3Error(
        'Per proseguire devi confermare di aver preso visione del Regolamento ufficiale FICUP 26/27.'
      );
      return;
    }
    setStep(4);
  };

  const handleStep4Next = () => {
    setStep4Error(null);
    if (!consensoRegoleChat) {
      setStep4Error(
        'Per proseguire devi accettare le Regole della Chat WhatsApp Ufficiale FICUP.'
      );
      return;
    }
    setStep(5);
  };

  const handleRealSubmit = async () => {
    setSubmitError(null);
    setAcceptSyncWarning(null);

    if (!config.iscrizioniAperte) {
      setSubmitError('Le candidature risultano momentaneamente chiuse dallo staff.');
      return;
    }
    if (!isFirebaseConfigured) {
      setSubmitError(
        'Configurazione Firebase mancante nell’ambiente: impossibile inviare la candidatura al database.'
      );
      return;
    }
    if (!consensoPrivacy || !consensoRegolamento || !consensoRegoleChat) {
      setSubmitError(
        'Tutte le accettazioni documentali (Privacy GDPR, Regolamento ufficiale e Regole Chat WhatsApp) sono obbligatorie prima dell’invio.'
      );
      return;
    }

    setSubmitting(true);
    try {
      const clean = validateCandidaturaInput({
        nome,
        cognome,
        emailFantaleghe,
        nomeSquadra,
        note,
        consensoPrivacy,
        versioneInformativa: config.versioneInformativa,
      });

      const result = await submitCandidatura(clean);
      const submittedAtIso = new Date().toISOString();

      let accettazioneSyncedOnFirestore = false;
      try {
        accettazioneSyncedOnFirestore = await saveAccettazioneDocumentale({
          candidaturaId: result.id,
          codiceCandidatura: result.codiceCandidatura,
          emailFantaleghe: clean.emailFantaleghe,
          privacyAccettata: true,
          versionePrivacy: config.versioneInformativa,
          regolamentoAccettato: true,
          versioneRegolamento: regolamentoVersionLabel,
          regolamentoDocId: regolamentoDocIdLabel,
          regoleChatAccettate: true,
          versioneRegoleChat: chatRulesVersionLabel,
        });
      } catch (accErr) {
        const msg = parseFirestoreUiError(accErr);
        setAcceptSyncWarning(
          `Nota tecnica: candidatura salvata con successo, ma il registro separato "accettazioni_documenti" non è stato sincronizzato (${msg}).`
        );
      }

      const nomeCompleto = `${clean.nome} ${clean.cognome}`;
      setSubmittedRecord({
        id: result.id,
        codiceCandidatura: result.codiceCandidatura,
        emailFantaleghe: clean.emailFantaleghe,
        nomeSquadra: clean.nomeSquadra,
        nomeCompleto,
        submittedAtIso,
      });

      onCandidaturaSubmitted?.({
        id: result.id,
        codiceCandidatura: result.codiceCandidatura,
        emailFantaleghe: clean.emailFantaleghe,
        nomeSquadra: clean.nomeSquadra,
        nomeCompleto,
        submittedAtIso,
        acceptedDocs: {
          versionePrivacy: config.versioneInformativa,
          versioneRegolamento: regolamentoVersionLabel,
          versioneRegoleChat: chatRulesVersionLabel,
          acceptedAtIso: submittedAtIso,
          accettazioneSyncedOnFirestore,
        },
      });

      if (!isAppsScriptConfigured) {
        setEmailDispatchState('unconfigured');
      } else {
        setEmailDispatchState('sending');
        triggerCandidaturaNotification({
          candidaturaId: result.id,
          codiceCandidatura: result.codiceCandidatura,
          emailFantaleghe: clean.emailFantaleghe,
        }).then((res) => {
          setEmailDispatchState(res.triggered ? 'triggered' : 'scheduled_only');
        });
      }
    } catch (err) {
      setSubmitError(parseFirestoreUiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyCode = async () => {
    if (!submittedRecord || typeof navigator === 'undefined' || !navigator.clipboard) {
      return;
    }
    try {
      await navigator.clipboard.writeText(submittedRecord.codiceCandidatura);
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // Ignore clipboard error
    }
  };

  const toggleChecklist = (index: number) => {
    setCheckedTasks((prev) => prev.map((v, i) => (i === index ? !v : v)));
  };

  const canVisitStep = (targetStep: number): boolean => {
    if (targetStep === 1) {
      return !isSubmitted;
    }
    if (targetStep === 2) {
      return (
        !isSubmitted &&
        nome.trim().length >= 1 &&
        cognome.trim().length >= 1 &&
        emailValidHint &&
        squadValidHint
      );
    }
    if (targetStep === 3) {
      return !isSubmitted && consensoPrivacy;
    }
    if (targetStep === 4) {
      return !isSubmitted && consensoPrivacy && consensoRegolamento;
    }
    if (targetStep === 5) {
      return isSubmitted || (consensoPrivacy && consensoRegolamento && consensoRegoleChat);
    }
    return isSubmitted;
  };

  const inputClass =
    'w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-[#0B1F4D] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B1F4D]/20 focus:border-[#0B1F4D] transition-all';

  return (
    <div className="bg-slate-50/70 min-h-[calc(100vh-4.5rem)] py-6 sm:py-10">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        {/* Top Back + Progress Counter */}
        <div className="mb-5 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onExitToHome}
            className="min-h-[44px] inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-[#0B1F4D] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-[#C69214]" />
            <span>Torna alla home</span>
          </button>
          <div className="flex items-center gap-2.5">
            <span className="font-mono-tabular text-xs font-bold text-[#0B1F4D]">
              Passaggio {step} di {STEP_LABELS.length} · {progressPercent}%
            </span>
            <FicupLogo size="xs" className="hidden sm:block ring-1 ring-slate-200 p-0.5 bg-white" />
          </div>
        </div>

        {/* Progress Bar & Stepper */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs mb-6">
          <div
            className="w-full h-2 bg-slate-100 rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <motion.div
              className="h-full bg-gradient-to-r from-[#0B1F4D] via-[#153985] to-[#C69214] rounded-full"
              initial={false}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            />
          </div>

          <div className="mt-4 grid grid-cols-6 gap-1 sm:gap-2">
            {STEP_LABELS.map((label, idx) => {
              const stepNum = idx + 1;
              const active = step === stepNum;
              const completed = step > stepNum || (stepNum === 5 && isSubmitted);
              const unlocked = canVisitStep(stepNum);
              return (
                <button
                  key={label}
                  type="button"
                  disabled={!unlocked}
                  onClick={() => unlocked && setStep(stepNum)}
                  title={`Passaggio ${stepNum}: ${label}`}
                  className={`min-h-[46px] flex flex-col items-center justify-center rounded-xl px-1 py-1.5 text-center transition-all ${
                    active
                      ? 'bg-[#0B1F4D] text-white shadow-xs'
                      : completed
                        ? 'bg-amber-50 text-[#0B1F4D] border border-amber-200'
                        : unlocked
                          ? 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/80'
                          : 'bg-slate-50 text-slate-400 border border-slate-100 opacity-60 cursor-not-allowed'
                  } ${unlocked ? 'cursor-pointer' : ''}`}
                >
                  <span className="font-mono-tabular text-xs font-bold">{stepNum}</span>
                  <span className="hidden sm:block text-[10px] leading-tight mt-0.5 truncate max-w-full">
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Step Card */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-8 shadow-sm">
          <AnimatePresence mode="wait">
            {/* STEP 1 — PRESENTAZIONE & DATI CANDIDATO */}
            {step === 1 && (
              <motion.div
                key="step-1"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-[#C69214]">
                      Passaggio 1 · Presentazione e dati personali
                    </p>
                    <h1 className="mt-1 font-display text-2xl sm:text-3xl font-extrabold text-[#0B1F4D] tracking-tight">
                      Candidatura FANTA ITALIA CUP ({config.stagione})
                    </h1>
                    <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                      Lega nazionale gratuita su Fantaleghe. Inserisci i tuoi dati reali: nei passaggi successivi prenderai visione di Informativa Privacy, Regolamento PDF e Regole Chat WhatsApp prima dell&apos;invio.
                    </p>
                  </div>
                  <FicupLogo size="md" className="hidden sm:block shrink-0 ring-1 ring-slate-200 p-1" />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 space-y-1">
                    <Trophy className="w-4 h-4 text-[#C69214]" />
                    <p className="font-bold text-[#0B1F4D]">Quota 0 €</p>
                    <p className="text-slate-600">Lega 100% gratuita</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 space-y-1">
                    <Wallet className="w-4 h-4 text-[#0284C7]" />
                    <p className="font-bold text-[#0B1F4D] font-mono-tabular">
                      {config.budgetIniziale} crediti
                    </p>
                    <p className="text-slate-600">{config.modalitaMercato}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 space-y-1">
                    <Gavel className="w-4 h-4 text-[#0B1F4D]" />
                    <p className="font-bold text-[#0B1F4D]">Rosa libera</p>
                    <p className="text-slate-600">Personalizzabile</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 space-y-1">
                    <Sparkles className="w-4 h-4 text-[#C69214]" />
                    <p className="font-bold text-[#0B1F4D]">Cambio nome</p>
                    <p className="text-slate-600">Club personalizzato</p>
                  </div>
                </div>

                {step1Error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 flex items-start gap-2.5 text-sm text-red-800">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{step1Error}</span>
                  </div>
                )}

                {duplicateLocalWarning && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 flex items-start gap-2.5 text-xs sm:text-sm text-amber-950 leading-relaxed">
                    <AlertCircle className="w-4 h-4 text-[#C69214] shrink-0 mt-0.5" />
                    <div className="space-y-2">
                      <p>{duplicateLocalWarning}</p>
                      {onOpenWaitingRoom && (
                        <button
                          type="button"
                          onClick={onOpenWaitingRoom}
                          className="text-xs font-bold text-[#0284C7] underline underline-offset-2 hover:text-[#0B1F4D] cursor-pointer"
                        >
                          Apri subito Area Personale
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <form onSubmit={handleStep1Next} className="space-y-4" noValidate>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="ficup-nome"
                        className="block text-xs font-semibold text-slate-700 mb-1.5"
                      >
                        Nome *
                      </label>
                      <input
                        id="ficup-nome"
                        type="text"
                        required
                        maxLength={80}
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        placeholder="Es. Marco"
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="ficup-cognome"
                        className="block text-xs font-semibold text-slate-700 mb-1.5"
                      >
                        Cognome *
                      </label>
                      <input
                        id="ficup-cognome"
                        type="text"
                        required
                        maxLength={80}
                        value={cognome}
                        onChange={(e) => setCognome(e.target.value)}
                        placeholder="Es. Rossi"
                        className={inputClass}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label
                        htmlFor="ficup-email"
                        className="block text-xs font-semibold text-slate-700"
                      >
                        Email utilizzata su Fantaleghe *
                      </label>
                      {emailValidHint && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                          <Check className="w-3 h-3" /> Formato valido
                        </span>
                      )}
                    </div>
                    <input
                      id="ficup-email"
                      type="email"
                      required
                      maxLength={160}
                      value={emailFantaleghe}
                      onChange={(e) => setEmailFantaleghe(e.target.value)}
                      placeholder="nome.cognome@esempio.it"
                      className={inputClass}
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      L&apos;invito ufficiale su Fantaleghe e le notifiche automatiche verranno inviati a questo indirizzo.
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label
                        htmlFor="ficup-squadra"
                        className="block text-xs font-semibold text-slate-700"
                      >
                        Nome della squadra proposta *
                      </label>
                      {squadValidHint && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                          <Check className="w-3 h-3" /> OK
                        </span>
                      )}
                    </div>
                    <input
                      id="ficup-squadra"
                      type="text"
                      required
                      maxLength={80}
                      value={nomeSquadra}
                      onChange={(e) => setNomeSquadra(e.target.value)}
                      placeholder="Es. Atletico Fantacalcio"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="ficup-note"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      Note facoltative per lo staff
                    </label>
                    <textarea
                      id="ficup-note"
                      rows={3}
                      maxLength={1000}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Esperienza su Fantaleghe, disponibilità o eventuali richieste (max 1000 caratteri)"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-[#0B1F4D] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B1F4D]/20 focus:border-[#0B1F4D] transition-all"
                    />
                  </div>

                  <div className="pt-2 flex flex-col sm:flex-row justify-end gap-3">
                    <button
                      type="submit"
                      disabled={!config.iscrizioniAperte}
                      className="min-h-[48px] px-6 py-3 rounded-xl bg-[#0B1F4D] text-white text-sm font-bold hover:bg-[#153985] disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>
                        {config.iscrizioniAperte
                          ? 'Prosegui: Informativa Privacy'
                          : 'Iscrizioni chiuse'}
                      </span>
                      <ArrowRight className="w-4 h-4 text-[#D4AF37]" />
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

            {/* STEP 2 — INFORMATIVA PRIVACY GDPR */}
            {step === 2 && (
              <motion.div
                key="step-2"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-[#C69214]">
                      Passaggio 2 · Tutela dei dati personali (GDPR)
                    </p>
                    <h1 className="mt-1 font-display text-2xl font-extrabold text-[#0B1F4D]">
                      Informativa Privacy (v{config.versioneInformativa})
                    </h1>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPrivacyModalOpen(true)}
                    className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-[#0284C7] hover:bg-slate-50 cursor-pointer"
                  >
                    Apri a schermo intero
                  </button>
                </div>

                <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-950 leading-relaxed">
                  <strong>Bozza informativa GDPR:</strong> i campi indicati come{' '}
                  <span className="font-mono-tabular font-semibold">[DA CONFERMARE]</span> sono
                  evidenziati in attesa della validazione legale definitiva da parte del Titolare del trattamento.
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5 max-h-72 overflow-y-auto space-y-4 text-xs sm:text-sm text-slate-700 leading-relaxed">
                  {GDPR_PRIVACY_SECTIONS.map((section) => (
                    <section key={section.id} className="space-y-1">
                      <h2 className="font-bold text-[#0B1F4D]">{section.title}</h2>
                      {section.paragraphs.map((p, i) => (
                        <p key={i}>
                          {p.includes('scudetto26@gmail.com') &&
                          config.emailOperativa !== 'scudetto26@gmail.com'
                            ? p.replace(/scudetto26@gmail\.com/g, config.emailOperativa)
                            : p}
                        </p>
                      ))}
                    </section>
                  ))}
                </div>

                {step2Error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 flex items-start gap-2.5 text-sm text-red-800">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{step2Error}</span>
                  </div>
                )}

                <label className="rounded-xl border border-slate-200 bg-white p-4 flex items-start gap-3 cursor-pointer hover:border-[#0B1F4D]/40 transition-colors">
                  <input
                    type="checkbox"
                    checked={consensoPrivacy}
                    onChange={(e) => {
                      setConsensoPrivacy(e.target.checked);
                      if (e.target.checked) setStep2Error(null);
                    }}
                    className="mt-0.5 w-5 h-5 rounded border-slate-300 text-[#0B1F4D] shrink-0"
                  />
                  <span className="text-xs sm:text-sm text-slate-800 leading-relaxed">
                    Ho letto e accetto l&apos;Informativa sul trattamento dei dati personali (versione{' '}
                    <strong className="font-mono-tabular">{config.versioneInformativa}</strong>)
                    per la gestione della candidatura FANTA ITALIA CUP. *
                  </span>
                </label>

                <div className="pt-2 flex flex-col-reverse sm:flex-row justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="min-h-[48px] px-5 py-3 rounded-xl border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Indietro
                  </button>
                  <button
                    type="button"
                    onClick={handleStep2Next}
                    className="min-h-[48px] px-6 py-3 rounded-xl bg-[#0B1F4D] text-white text-sm font-bold hover:bg-[#153985] transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Prosegui: Regolamento ufficiale</span>
                    <ArrowRight className="w-4 h-4 text-[#D4AF37]" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 3 — REGOLAMENTO UFFICIALE */}
            {step === 3 && (
              <motion.div
                key="step-3"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[#C69214]">
                    Passaggio 3 · Regolamento ufficiale della competizione
                  </p>
                  <h1 className="mt-1 font-display text-2xl font-extrabold text-[#0B1F4D]">
                    Regolamento ufficiale FICUP {config.stagione}
                  </h1>
                </div>

                {docsLoading ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center space-y-2">
                    <Loader2 className="w-6 h-6 animate-spin text-[#0B1F4D] mx-auto" />
                    <p className="text-sm text-slate-600">
                      Caricamento del Regolamento ufficiale in corso...
                    </p>
                  </div>
                ) : activeRegolamento && activeRegolamento.contenutoTesto.trim() ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-[#0B1F4D] flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-[#C69214]" />
                      </div>
                      <div className="text-xs sm:text-sm space-y-0.5 min-w-0">
                        <p className="font-bold text-[#0B1F4D]">{activeRegolamento.titolo}</p>
                        <p className="text-slate-600 font-mono-tabular text-xs">
                          Versione {activeRegolamento.versione} · Pubblicato:{' '}
                          {activeRegolamento.dataPubblicazione || '—'}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 max-h-[26rem] overflow-y-auto shadow-xs">
                      <RegulationContentView content={activeRegolamento.contenutoTesto} />
                    </div>
                  </div>
                ) : activeRegolamento && activeRegolamento.downloadUrl ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-[#0B1F4D] flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-[#C69214]" />
                      </div>
                      <div className="text-xs sm:text-sm space-y-0.5">
                        <p className="font-bold text-[#0B1F4D]">{activeRegolamento.titolo}</p>
                        <p className="text-slate-600 font-mono-tabular text-xs">
                          Versione {activeRegolamento.versione} · Pubblicato:{' '}
                          {activeRegolamento.dataPubblicazione || '—'}
                        </p>
                      </div>
                    </div>
                    <a
                      href={activeRegolamento.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[44px] px-4 py-2 rounded-xl bg-[#0B1F4D] text-white text-xs font-bold hover:bg-[#153985] inline-flex items-center justify-center gap-2 shrink-0"
                    >
                      <span>Apri Regolamento</span>
                      <ExternalLink className="w-4 h-4 text-[#D4AF37]" />
                    </a>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 sm:p-5 flex items-start gap-3 text-xs sm:text-sm text-amber-950 leading-relaxed">
                    <FileText className="w-5 h-5 text-[#C69214] shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-bold text-[#0B1F4D]">
                        Regolamento ufficiale non ancora pubblicato dallo staff
                      </p>
                      <p>
                        Nessuna versione del Regolamento risulta attualmente attiva in{' '}
                        <span className="font-mono-tabular">documenti_ufficiali</span>. Per trasparenza
                        non viene generato alcun testo regolamentare automatico: puoi comunque
                        completare la candidatura e consultare il regolamento appena verrà pubblicato
                        dall&apos;Area Staff o richiesto a{' '}
                        <span className="font-mono-tabular">{config.emailOperativa}</span>.
                      </p>
                    </div>
                  </div>
                )}

                {step3Error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 flex items-start gap-2.5 text-sm text-red-800">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{step3Error}</span>
                  </div>
                )}

                <label className="rounded-xl border border-slate-200 bg-white p-4 flex items-start gap-3 cursor-pointer hover:border-[#0B1F4D]/40 transition-colors">
                  <input
                    type="checkbox"
                    checked={consensoRegolamento}
                    onChange={(e) => {
                      setConsensoRegolamento(e.target.checked);
                      if (e.target.checked) setStep3Error(null);
                    }}
                    className="mt-0.5 w-5 h-5 rounded border-slate-300 text-[#0B1F4D] shrink-0"
                  />
                  <span className="text-xs sm:text-sm text-slate-800 leading-relaxed">
                    Confermo di aver letto e preso visione del Regolamento ufficiale FICUP {config.stagione} (versione{' '}
                    <strong className="font-mono-tabular">{regolamentoVersionLabel}</strong>). *
                  </span>
                </label>

                <div className="pt-2 flex flex-col-reverse sm:flex-row justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="min-h-[48px] px-5 py-3 rounded-xl border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Indietro
                  </button>
                  <button
                    type="button"
                    onClick={handleStep3Next}
                    className="min-h-[48px] px-6 py-3 rounded-xl bg-[#0B1F4D] text-white text-sm font-bold hover:bg-[#153985] transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Prosegui: Regole Chat WhatsApp</span>
                    <ArrowRight className="w-4 h-4 text-[#D4AF37]" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 4 — REGOLE UFFICIALI CHAT WHATSAPP */}
            {step === 4 && (
              <motion.div
                key="step-4"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[#C69214]">
                    Passaggio 4 · Codice di comportamento della community
                  </p>
                  <h1 className="mt-1 font-display text-2xl font-extrabold text-[#0B1F4D]">
                    Regole Ufficiali Chat WhatsApp FICUP (v{chatRulesVersionLabel})
                  </h1>
                  <p className="mt-1.5 text-sm text-slate-600">
                    Leggi attentamente le regole di comportamento del Gruppo WhatsApp Ufficiale. Il collegamento di ingresso al gruppo resta riservato e si sbloccherà esclusivamente dopo l&apos;approvazione e l&apos;autorizzazione dello staff.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5 max-h-80 overflow-y-auto space-y-4 text-xs sm:text-sm text-slate-700 leading-relaxed">
                  {activeChatRulesDoc && activeChatRulesDoc.contenutoTesto.trim() ? (
                    <div className="whitespace-pre-wrap">
                      {maskSensitiveWhatsappLinks(activeChatRulesDoc.contenutoTesto)}
                    </div>
                  ) : (
                    OFFICIAL_CHAT_RULES_SECTIONS.map((sec) => (
                      <section key={sec.id} className="space-y-1">
                        <h2 className="font-bold text-[#0B1F4D]">{sec.title}</h2>
                        {sec.paragraphs.map((p, idx) => (
                          <p key={idx}>{p}</p>
                        ))}
                      </section>
                    ))
                  )}

                  <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-[#C69214] shrink-0" />
                    <span>
                      Link gruppo WhatsApp ufficiale: riservato ai candidati approvati e sbloccato nella tua Area Personale dopo la verifica finale dello staff.
                    </span>
                  </div>
                </div>

                {step4Error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 flex items-start gap-2.5 text-sm text-red-800">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{step4Error}</span>
                  </div>
                )}

                <label className="rounded-xl border border-slate-200 bg-white p-4 flex items-start gap-3 cursor-pointer hover:border-[#0B1F4D]/40 transition-colors">
                  <input
                    type="checkbox"
                    checked={consensoRegoleChat}
                    onChange={(e) => {
                      setConsensoRegoleChat(e.target.checked);
                      if (e.target.checked) setStep4Error(null);
                    }}
                    className="mt-0.5 w-5 h-5 rounded border-slate-300 text-[#0B1F4D] shrink-0"
                  />
                  <span className="text-xs sm:text-sm text-slate-800 leading-relaxed">
                    Accetto integralmente le Regole della Chat WhatsApp Ufficiale FICUP (versione{' '}
                    <strong className="font-mono-tabular">{chatRulesVersionLabel}</strong>) e mi impegno a rispettarle. *
                  </span>
                </label>

                <div className="pt-2 flex flex-col-reverse sm:flex-row justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="min-h-[48px] px-5 py-3 rounded-xl border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Indietro
                  </button>
                  <button
                    type="button"
                    onClick={handleStep4Next}
                    className="min-h-[48px] px-6 py-3 rounded-xl bg-[#0B1F4D] text-white text-sm font-bold hover:bg-[#153985] transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Prosegui: Riepilogo e Invio</span>
                    <ArrowRight className="w-4 h-4 text-[#D4AF37]" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 5 — RIEPILOGO, INVIO & CONFERMA PRESA IN CARICO */}
            {step === 5 && (
              <motion.div
                key="step-5"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {submitting ? (
                  <div className="py-10 text-center space-y-3">
                    <Loader2 className="w-8 h-8 text-[#0B1F4D] animate-spin mx-auto" />
                    <h1 className="font-display text-xl font-bold text-[#0B1F4D]">
                      Registrazione candidatura in corso...
                    </h1>
                    <p className="text-sm text-slate-600">
                      Salvataggio sicuro su Cloud Firestore e generazione del codice univoco FICUP26.
                    </p>
                  </div>
                ) : submittedRecord ? (
                  <div className="space-y-6">
                    <div className="flex items-start gap-3">
                      <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-emerald-700">
                          Candidatura registrata su Cloud Firestore · Stato: NUOVO
                        </p>
                        <h1 className="mt-1 font-display text-2xl font-extrabold text-[#0B1F4D]">
                          LA TUA CANDIDATURA È STATA RICEVUTA!
                        </h1>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 text-center space-y-2.5">
                      <p className="text-xs font-semibold text-slate-600">
                        Il tuo codice identificativo univoco (conservalo per l&apos;Area Personale)
                      </p>
                      <p className="font-mono-tabular text-2xl sm:text-3xl font-bold tracking-wider text-[#0B1F4D]">
                        {submittedRecord.codiceCandidatura}
                      </p>
                      <div className="pt-1 flex flex-wrap items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={handleCopyCode}
                          className="min-h-[42px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white border border-amber-300 text-xs font-semibold text-[#0B1F4D] hover:bg-amber-100/50 transition-colors cursor-pointer"
                        >
                          {copiedCode ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-700" />
                              <span>Codice copiato</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copia codice</span>
                            </>
                          )}
                        </button>

                        {onOpenWaitingRoom && (
                          <button
                            type="button"
                            onClick={onOpenWaitingRoom}
                            className="min-h-[42px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white border border-sky-300 text-xs font-semibold text-[#0284C7] hover:bg-sky-50 transition-colors cursor-pointer"
                          >
                            <DoorOpen className="w-3.5 h-3.5" />
                            <span>Apri Area Personale</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 space-y-1.5">
                      <p>
                        <strong>Fantallenatore:</strong> {submittedRecord.nomeCompleto}
                      </p>
                      <p className="break-all">
                        <strong>Email Fantaleghe:</strong> {submittedRecord.emailFantaleghe}
                      </p>
                      <p>
                        <strong>Squadra proposta:</strong> {submittedRecord.nomeSquadra}
                      </p>
                      <p className="text-xs font-mono-tabular text-slate-500 pt-1">
                        Documenti accettati: Privacy v{config.versioneInformativa} · Regolamento v
                        {regolamentoVersionLabel} · Regole Chat v{chatRulesVersionLabel}
                      </p>
                    </div>

                    {acceptSyncWarning && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-950">
                        {acceptSyncWarning}
                      </div>
                    )}

                    <div className="rounded-xl border border-slate-200 bg-white p-3.5 text-xs text-slate-600 leading-relaxed">
                      <strong>Comunicazioni email:</strong>{' '}
                      {emailDispatchState === 'unconfigured' ? (
                        <>
                          l&apos;endpoint Google Apps Script non è ancora collegato in questo ambiente (<span className="font-mono-tabular">VITE_APPS_SCRIPT_WEBAPP_URL</span>). Prosegui nel passaggio successivo o scrivi a{' '}
                          <span className="font-mono-tabular text-[#0B1F4D]">
                            {config.emailOperativa}
                          </span>
                          .
                        </>
                      ) : emailDispatchState === 'sending' ? (
                        <>
                          invio notifica automatica al backend <span className="font-mono-tabular">FICUP 26/27</span> in corso verso{' '}
                          <span className="font-mono-tabular text-[#0B1F4D]">
                            {submittedRecord.emailFantaleghe}
                          </span>{' '}
                          e lo staff (<span className="font-mono-tabular">{config.emailOperativa}</span>)...
                        </>
                      ) : emailDispatchState === 'triggered' ? (
                        <>
                          notifica email presa in carico dal backend <span className="font-mono-tabular">FICUP 26/27</span> verso{' '}
                          <span className="font-mono-tabular text-[#0B1F4D]">
                            {submittedRecord.emailFantaleghe}
                          </span>{' '}
                          e lo staff (<span className="font-mono-tabular">{config.emailOperativa}</span>). Controlla anche Spam o Promozioni.
                        </>
                      ) : (
                        <>
                          candidatura salvata su Firestore; il controllo periodico automatico elaborerà la conferma email verso{' '}
                          <span className="font-mono-tabular text-[#0B1F4D]">
                            {submittedRecord.emailFantaleghe}
                          </span>{' '}
                          e <span className="font-mono-tabular">{config.emailOperativa}</span>.
                        </>
                      )}
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setStep(6)}
                        className="min-h-[48px] w-full sm:w-auto px-6 py-3 rounded-xl bg-[#0B1F4D] text-white text-sm font-bold hover:bg-[#153985] transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <span>Prosegui: Prossimi passaggi</span>
                        <ArrowRight className="w-4 h-4 text-[#D4AF37]" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-[#C69214]">
                        Passaggio 5 · Verifica finale prima dell&apos;invio
                      </p>
                      <h1 className="mt-1 font-display text-2xl font-extrabold text-[#0B1F4D]">
                        Riepilogo candidatura e accettazioni
                      </h1>
                      <p className="mt-1.5 text-sm text-slate-600">
                        Controlla i tuoi dati Fantaleghe e le dichiarazioni accettate prima di confermare l&apos;invio definitivo.
                      </p>
                    </div>

                    {submitError && (
                      <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-2.5 text-sm text-red-900">
                        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                        <span>{submitError}</span>
                      </div>
                    )}

                    <div className="rounded-xl border border-slate-200 divide-y divide-slate-200 bg-slate-50/70">
                      <div className="p-3.5 sm:px-4 flex flex-col sm:flex-row sm:justify-between gap-1">
                        <span className="text-xs font-medium text-slate-500">Fantallenatore</span>
                        <span className="text-sm font-semibold text-[#0B1F4D]">
                          {nome.trim()} {cognome.trim()}
                        </span>
                      </div>
                      <div className="p-3.5 sm:px-4 flex flex-col sm:flex-row sm:justify-between gap-1">
                        <span className="text-xs font-medium text-slate-500">Email Fantaleghe</span>
                        <span className="text-sm font-semibold text-[#0284C7] break-all">
                          {emailFantaleghe.trim().toLowerCase()}
                        </span>
                      </div>
                      <div className="p-3.5 sm:px-4 flex flex-col sm:flex-row sm:justify-between gap-1">
                        <span className="text-xs font-medium text-slate-500">Squadra proposta</span>
                        <span className="text-sm font-semibold text-[#0B1F4D]">
                          {nomeSquadra.trim()}
                        </span>
                      </div>
                      {note.trim() && (
                        <div className="p-3.5 sm:px-4 flex flex-col gap-1">
                          <span className="text-xs font-medium text-slate-500">Note facoltative</span>
                          <span className="text-sm text-slate-700 whitespace-pre-wrap">
                            {note.trim()}
                          </span>
                        </div>
                      )}
                      <div className="p-3.5 sm:px-4 space-y-1 text-xs">
                        <p className="font-medium text-slate-500">Documenti obbligatori accettati</p>
                        <p className="font-semibold text-emerald-700">
                          ✓ Informativa Privacy GDPR (v{config.versioneInformativa})
                        </p>
                        <p className="font-semibold text-emerald-700">
                          ✓ Regolamento Ufficiale FICUP (v{regolamentoVersionLabel})
                        </p>
                        <p className="font-semibold text-emerald-700">
                          ✓ Regole Chat WhatsApp Ufficiale (v{chatRulesVersionLabel})
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 flex flex-col-reverse sm:flex-row justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="min-h-[48px] px-5 py-3 rounded-xl border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        Modifica dati
                      </button>
                      <button
                        type="button"
                        onClick={handleRealSubmit}
                        className="min-h-[48px] px-6 py-3 rounded-xl bg-[#0B1F4D] text-white text-sm font-bold hover:bg-[#153985] transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <span>Invia candidatura ufficiale</span>
                        <ArrowRight className="w-4 h-4 text-[#D4AF37]" />
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* STEP 6 — PROSSIMI PASSAGGI & ACCESSO AREA PERSONALE */}
            {step === 6 && (
              <motion.div
                key="step-6"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[#C69214]">
                    Passaggio 6 · Coordinamento e Area Personale
                  </p>
                  <h1 className="mt-1 font-display text-2xl font-extrabold text-[#0B1F4D]">
                    Prossimi passaggi verso la lega
                  </h1>
                  <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
                    Mentre lo staff valuta la tua candidatura ({submittedRecord?.codiceCandidatura ?? 'FICUP26'}), puoi coordinarti nel gruppo WhatsApp provvisorio e monitorare lo stato in tempo reale nella tua Area Personale.
                  </p>
                </div>

                {/* Provisional WhatsApp Group */}
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 sm:p-5 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-900">
                    <MessageCircle className="w-5 h-5 text-emerald-700" />
                    <h2 className="font-display text-base font-bold">
                      Gruppo WhatsApp Provvisorio (Accoglienza)
                    </h2>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                    Serve per coordinarti con lo staff durante la verifica. Indica il tuo codice{' '}
                    <strong className="font-mono-tabular text-[#0B1F4D]">
                      {submittedRecord?.codiceCandidatura}
                    </strong>{' '}
                    quando scrivi in chat.
                  </p>
                  <a
                    href={config.linkWhatsappProvvisorio}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[48px] w-full px-5 py-3 rounded-xl bg-emerald-700 text-white text-sm font-bold hover:bg-emerald-800 transition-colors inline-flex items-center justify-center gap-2"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>ENTRA NEL GRUPPO WHATSAPP PROVVISORIO</span>
                    <ExternalLink className="w-4 h-4 opacity-80" />
                  </a>
                </div>

                {/* Protected Official WhatsApp Notice */}
                <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 flex items-start gap-3 text-xs sm:text-sm text-amber-950">
                  <ShieldCheck className="w-5 h-5 text-[#C69214] shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    <strong>Gruppo WhatsApp Ufficiale:</strong> per sicurezza il collegamento ufficiale resta protetto e si sblocca nell&apos;<strong>Area Personale</strong> esclusivamente dopo l&apos;approvazione e la verifica finale dello staff (stato <span className="font-mono-tabular font-bold">COMPLETATO</span>).
                  </p>
                </div>

                {/* Completion Checklist */}
                <div className="space-y-2.5">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Promemoria percorso di ingresso
                  </p>
                  {COMPLETION_TASKS.map((task, idx) => {
                    const checked = checkedTasks[idx];
                    return (
                      <label
                        key={task}
                        className={`flex items-start gap-3 p-3.5 rounded-xl border transition-colors cursor-pointer ${
                          checked
                            ? 'bg-emerald-50/70 border-emerald-200 text-slate-900'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100/70'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleChecklist(idx)}
                          className="mt-0.5 w-5 h-5 rounded border-slate-300 text-[#0B1F4D] shrink-0"
                        />
                        <span className="text-xs sm:text-sm leading-snug">
                          <strong className="font-mono-tabular text-[#0B1F4D] mr-1.5">
                            {idx + 1}.
                          </strong>
                          {task}
                        </span>
                      </label>
                    );
                  })}
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 flex items-start gap-2.5 text-xs text-slate-600">
                  <Mail className="w-4 h-4 text-[#0284C7] shrink-0 mt-0.5" />
                  <span>
                    Assistenza operativa:{' '}
                    <span className="font-mono-tabular font-semibold text-[#0B1F4D]">
                      {config.emailOperativa}
                    </span>
                  </span>
                </div>

                <div className="pt-2 flex flex-col-reverse sm:flex-row justify-between gap-3">
                  <button
                    type="button"
                    onClick={onExitToHome}
                    className="min-h-[48px] px-5 py-3 rounded-xl border border-slate-300 text-[#0B1F4D] text-sm font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Torna alla homepage
                  </button>
                  {onOpenWaitingRoom && (
                    <button
                      type="button"
                      onClick={onOpenWaitingRoom}
                      className="min-h-[48px] px-6 py-3 rounded-xl bg-[#0B1F4D] text-white text-sm font-bold hover:bg-[#153985] transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <DoorOpen className="w-4 h-4 text-[#D4AF37]" />
                      <span>APRI AREA PERSONALE</span>
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <PrivacyModal
        open={privacyModalOpen}
        version={config.versioneInformativa}
        operationalEmail={config.emailOperativa}
        onClose={() => setPrivacyModalOpen(false)}
      />
    </div>
  );
}
