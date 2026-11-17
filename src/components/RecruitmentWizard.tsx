import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  DoorOpen,
  ExternalLink,
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
import { useState, type FormEvent } from 'react';
import { isFirebaseConfigured } from '../lib/firebase';
import { isAppsScriptConfigured, triggerCandidaturaNotification } from '../lib/appsScriptClient';
import {
  submitCandidatura,
  validateCandidaturaInput,
  type ConfigurazionePublica,
} from '../lib/firestore';
import { parseFirestoreUiError } from '../lib/notifications';
import type { WaitingRoomPass } from '../lib/waitingRoomStorage';
import { FicupLogo } from './FicupLogo';
import { PrivacyModal } from './PrivacyModal';

interface RecruitmentWizardProps {
  config: Omit<ConfigurazionePublica, 'updatedAt' | 'updatedBy'>;
  onExitToHome: () => void;
  onCandidaturaSubmitted?: (pass: WaitingRoomPass) => void;
  onOpenWaitingRoom?: () => void;
}

const STEP_LABELS = [
  'Presentazione',
  'Candidatura',
  'Invio',
  'WhatsApp provvisorio',
  'Attesa invito',
  'Completamento',
  'Community ufficiale',
] as const;

const COMPLETION_TASKS = [
  'Apri il link di invito ricevuto via email da Fantaleghe.',
  'Completa il login o la registrazione su Fantaleghe.',
  'Accedi alla competizione ufficiale FICUP 26/27.',
  'Modifica liberamente tutta la rosa con i 250 crediti in Asta Libera.',
  'Imposta il nuovo nome personalizzato della tua squadra.',
  'Avvisa lo staff sul gruppo WhatsApp provvisorio appena hai terminato.',
];

export function RecruitmentWizard({
  config,
  onExitToHome,
  onCandidaturaSubmitted,
  onOpenWaitingRoom,
}: RecruitmentWizardProps) {
  const [step, setStep] = useState<number>(1);
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);

  // Step 2 Form State
  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [emailFantaleghe, setEmailFantaleghe] = useState('');
  const [nomeSquadra, setNomeSquadra] = useState('');
  const [note, setNote] = useState('');
  const [consensoPrivacy, setConsensoPrivacy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [reviewMode, setReviewMode] = useState(false);

  // Step 3 Submission State
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedRecord, setSubmittedRecord] = useState<{
    id: string;
    codiceCandidatura: string;
    emailFantaleghe: string;
    nomeSquadra: string;
    nomeCompleto: string;
  } | null>(null);
  const [emailDispatchState, setEmailDispatchState] = useState<
    'idle' | 'sending' | 'triggered' | 'scheduled_only' | 'unconfigured'
  >('idle');
  const [copiedCode, setCopiedCode] = useState(false);

  // Step 6 local checklist state
  const [checkedTasks, setCheckedTasks] = useState<boolean[]>(() =>
    COMPLETION_TASKS.map(() => false)
  );

  const progressPercent = Math.round((step / STEP_LABELS.length) * 100);
  const isSubmitted = submittedRecord !== null;
  const emailValidHint =
    emailFantaleghe.trim().length > 0 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailFantaleghe.trim());
  const squadValidHint = nomeSquadra.trim().length >= 2;

  const handleValidateAndPreview = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      validateCandidaturaInput({
        nome,
        cognome,
        emailFantaleghe,
        nomeSquadra,
        note,
        consensoPrivacy,
        versioneInformativa: config.versioneInformativa,
      });
      setReviewMode(true);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Controlla i campi inseriti.');
    }
  };

  const handleRealSubmit = async () => {
    setSubmitError(null);
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

    setStep(3);
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
      const nomeCompleto = `${clean.nome} ${clean.cognome}`;
      setSubmittedRecord({
        id: result.id,
        codiceCandidatura: result.codiceCandidatura,
        emailFantaleghe: clean.emailFantaleghe,
        nomeSquadra: clean.nomeSquadra,
        nomeCompleto,
      });
      onCandidaturaSubmitted?.({
        id: result.id,
        codiceCandidatura: result.codiceCandidatura,
        emailFantaleghe: clean.emailFantaleghe,
        nomeSquadra: clean.nomeSquadra,
        nomeCompleto,
        submittedAtIso: new Date().toISOString(),
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
      // Clipboard blocked in restricted context: ignore gracefully
    }
  };

  const toggleChecklist = (index: number) => {
    setCheckedTasks((prev) => prev.map((v, i) => (i === index ? !v : v)));
  };

  const canVisitStep = (targetStep: number): boolean => {
    if (targetStep <= 2) {
      return true;
    }
    if (targetStep === 3) {
      return isSubmitted || submitting || submitError !== null;
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

          <div className="mt-4 grid grid-cols-7 gap-1 sm:gap-2">
            {STEP_LABELS.map((label, idx) => {
              const stepNum = idx + 1;
              const active = step === stepNum;
              const completed = step > stepNum || (stepNum === 3 && isSubmitted);
              const unlocked = canVisitStep(stepNum);
              return (
                <button
                  key={label}
                  type="button"
                  disabled={!unlocked}
                  onClick={() => unlocked && setStep(stepNum)}
                  title={`Step ${stepNum}: ${label}`}
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
            {/* STEP 1 — PRESENTAZIONE */}
            {step === 1 && (
              <motion.div
                key="step-1"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.22 }}
                className="space-y-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-[#C69214]">
                      Step 1 · Presentazione competizione
                    </p>
                    <h1 className="mt-1 font-display text-2xl sm:text-3xl font-extrabold text-[#0B1F4D] tracking-tight">
                      Benvenuto in FANTA ITALIA CUP ({config.stagione})
                    </h1>
                    <p className="mt-2 text-sm sm:text-base text-slate-600 leading-relaxed">
                      Prima di inviare la tua candidatura, verifica le caratteristiche principali della lega nazionale su Fantaleghe e le modalità di subentro.
                    </p>
                  </div>
                  <FicupLogo size="md" className="hidden sm:block shrink-0 ring-1 ring-slate-200 p-1" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-1.5">
                    <div className="flex items-center gap-2 text-[#C69214]">
                      <Trophy className="w-4 h-4" />
                      <span className="text-xs font-semibold text-slate-500">Partecipazione</span>
                    </div>
                    <p className="font-display font-bold text-[#0B1F4D]">Lega 100% gratuita</p>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Nessuna quota d&apos;ingresso. Community nazionale gestita da staff dedicato.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-1.5">
                    <div className="flex items-center gap-2 text-[#0284C7]">
                      <Wallet className="w-4 h-4" />
                      <span className="text-xs font-semibold text-slate-500">Formula di mercato</span>
                    </div>
                    <p className="font-display font-bold text-[#0B1F4D]">
                      {config.modalitaMercato} · {config.budgetIniziale} crediti
                    </p>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Subentri con budget pieno da {config.budgetIniziale} crediti per rifondare la tua squadra.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-1.5">
                    <div className="flex items-center gap-2 text-[#0B1F4D]">
                      <Gavel className="w-4 h-4" />
                      <span className="text-xs font-semibold text-slate-500">Gestione rosa</span>
                    </div>
                    <p className="font-display font-bold text-[#0B1F4D]">Personalizzazione totale</p>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Sostituisci liberamente i giocatori della rosa iniziale secondo la tua strategia.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-1.5">
                    <div className="flex items-center gap-2 text-[#C69214]">
                      <Sparkles className="w-4 h-4" />
                      <span className="text-xs font-semibold text-slate-500">Identità squadra</span>
                    </div>
                    <p className="font-display font-bold text-[#0B1F4D]">Cambio nome libero</p>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Puoi rinominare il club subito dopo aver accettato l&apos;invito su Fantaleghe.
                    </p>
                  </div>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    disabled={!config.iscrizioniAperte}
                    className="min-h-[48px] px-6 py-3 rounded-xl bg-[#0B1F4D] text-white text-sm font-bold hover:bg-[#153985] disabled:opacity-50 disabled:cursor-not-allowed transition-all inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>
                      {config.iscrizioniAperte ? 'Compila la candidatura' : 'Iscrizioni chiuse'}
                    </span>
                    <ArrowRight className="w-4 h-4 text-[#D4AF37]" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 2 — MODULO CANDIDATURA + RIEPILOGO */}
            {step === 2 && (
              <motion.div
                key="step-2"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.22 }}
                className="space-y-6"
              >
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[#C69214]">
                    Step 2 · Dati del fantallenatore
                  </p>
                  <h1 className="mt-1 font-display text-2xl font-extrabold text-[#0B1F4D]">
                    {reviewMode ? 'Riepilogo prima dell’invio' : 'Modulo di candidatura'}
                  </h1>
                  <p className="mt-1.5 text-sm text-slate-600">
                    {reviewMode
                      ? 'Controlla che l’indirizzo email di Fantaleghe e i dati della squadra siano esatti.'
                      : 'Raccogliamo solo i dati indispensabili per verificare la richiesta e inviarti l’invito su Fantaleghe.'}
                  </p>
                </div>

                {formError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 flex items-start gap-2.5 text-sm text-red-800">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{formError}</span>
                  </div>
                )}

                {!reviewMode ? (
                  <form onSubmit={handleValidateAndPreview} className="space-y-4" noValidate>
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
                        L&apos;invito ufficiale di accesso alla lega verrà inviato a questo indirizzo.
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label
                          htmlFor="ficup-squadra"
                          className="block text-xs font-semibold text-slate-700"
                        >
                          Nome della squadra attuale *
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
                        Note facoltative
                      </label>
                      <textarea
                        id="ficup-note"
                        rows={3}
                        maxLength={1000}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Eventuali informazioni utili per lo staff (massimo 1000 caratteri)"
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-[#0B1F4D] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B1F4D]/20 focus:border-[#0B1F4D] transition-all"
                      />
                    </div>

                    {/* Privacy Consent */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2.5">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={consensoPrivacy}
                          onChange={(e) => setConsensoPrivacy(e.target.checked)}
                          className="mt-0.5 w-5 h-5 rounded border-slate-300 text-[#0B1F4D] focus:ring-[#0B1F4D] shrink-0"
                        />
                        <span className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                          Dichiaro di aver letto e accettato l&apos;informativa sul trattamento dei dati personali (versione{' '}
                          <span className="font-mono-tabular font-semibold">
                            {config.versioneInformativa}
                          </span>
                          ) esclusivamente per la gestione della candidatura FANTA ITALIA CUP. *
                        </span>
                      </label>
                      <div className="pl-8">
                        <button
                          type="button"
                          onClick={() => setPrivacyModalOpen(true)}
                          className="text-xs font-semibold text-[#0284C7] underline underline-offset-2 hover:text-[#0B1F4D] cursor-pointer"
                        >
                          Leggi l&apos;informativa privacy completa
                        </button>
                      </div>
                    </div>

                    <div className="pt-2 flex flex-col-reverse sm:flex-row justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="min-h-[48px] px-5 py-3 rounded-xl border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        Indietro
                      </button>
                      <button
                        type="submit"
                        className="min-h-[48px] px-6 py-3 rounded-xl bg-[#0B1F4D] text-white text-sm font-bold hover:bg-[#153985] transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <span>Verifica riepilogo</span>
                        <ArrowRight className="w-4 h-4 text-[#D4AF37]" />
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-5">
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
                        <span className="text-xs font-medium text-slate-500">Squadra attuale</span>
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
                      <div className="p-3.5 sm:px-4 flex flex-col sm:flex-row sm:justify-between gap-1">
                        <span className="text-xs font-medium text-slate-500">Consenso privacy</span>
                        <span className="text-xs font-semibold text-emerald-700">
                          Accettato · Informativa v{config.versioneInformativa}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 flex flex-col-reverse sm:flex-row justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => setReviewMode(false)}
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

            {/* STEP 3 — INVIO SU FIRESTORE & CODICE UNIVOCO */}
            {step === 3 && (
              <motion.div
                key="step-3"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.22 }}
                className="space-y-6"
              >
                {submitting ? (
                  <div className="py-10 text-center space-y-3">
                    <Loader2 className="w-8 h-8 text-[#0B1F4D] animate-spin mx-auto" />
                    <h1 className="font-display text-xl font-bold text-[#0B1F4D]">
                      Registrazione candidatura in corso...
                    </h1>
                    <p className="text-sm text-slate-600">
                      Salvataggio sicuro su Cloud Firestore e generazione del tuo codice univoco FICUP26.
                    </p>
                  </div>
                ) : submitError ? (
                  <div className="space-y-5">
                    <div className="flex items-start gap-3 text-red-800">
                      <AlertCircle className="w-6 h-6 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-red-700">
                          Step 3 · Invio non completato
                        </p>
                        <h1 className="mt-1 font-display text-xl sm:text-2xl font-bold text-[#0B1F4D]">
                          Impossibile registrare la candidatura su Firestore
                        </h1>
                      </div>
                    </div>

                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 leading-relaxed">
                      {submitError}
                    </div>

                    <p className="text-xs sm:text-sm text-slate-600">
                      Nessuna candidatura fittizia è stata creata. Puoi verificare i dati o riprovare l&apos;invio reale verso{' '}
                      <span className="font-mono-tabular">candidature-ficup</span>.
                    </p>

                    <div className="flex flex-col-reverse sm:flex-row justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setSubmitError(null);
                          setStep(2);
                        }}
                        className="min-h-[48px] px-5 py-3 rounded-xl border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        Torna ai dati
                      </button>
                      <button
                        type="button"
                        onClick={handleRealSubmit}
                        className="min-h-[48px] px-6 py-3 rounded-xl bg-[#0B1F4D] text-white text-sm font-bold hover:bg-[#153985] transition-colors cursor-pointer"
                      >
                        Riprova invio reale
                      </button>
                    </div>
                  </div>
                ) : submittedRecord ? (
                  <div className="space-y-6">
                    <div className="flex items-start gap-3">
                      <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-emerald-700">
                          Step 3 · Candidatura registrata su Firestore
                        </p>
                        <h1 className="mt-1 font-display text-2xl font-extrabold text-[#0B1F4D]">
                          Candidatura inviata con successo!
                        </h1>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 text-center space-y-2.5">
                      <p className="text-xs font-semibold text-slate-600">
                        Il tuo codice identificativo univoco
                      </p>
                      <p className="font-mono-tabular text-2xl sm:text-3xl font-bold tracking-wider text-[#0B1F4D]">
                        {submittedRecord.codiceCandidatura}
                      </p>
                      <div className="pt-1 flex flex-wrap items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={handleCopyCode}
                          className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white border border-amber-300 text-xs font-semibold text-[#0B1F4D] hover:bg-amber-100/50 transition-colors cursor-pointer"
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
                            className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white border border-sky-300 text-xs font-semibold text-[#0284C7] hover:bg-sky-50 transition-colors cursor-pointer"
                          >
                            <DoorOpen className="w-3.5 h-3.5" />
                            <span>Apri Waiting Room</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 space-y-1">
                      <p>
                        <strong>Candidato:</strong> {submittedRecord.nomeCompleto}
                      </p>
                      <p className="break-all">
                        <strong>Email Fantaleghe:</strong> {submittedRecord.emailFantaleghe}
                      </p>
                      <p>
                        <strong>Squadra:</strong> {submittedRecord.nomeSquadra}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-3.5 text-xs text-slate-600 leading-relaxed">
                      <strong>Comunicazioni email:</strong>{' '}
                      {emailDispatchState === 'unconfigured' ? (
                        <>
                          l&apos;endpoint automatico Google Apps Script non è ancora collegato in questo ambiente (<span className="font-mono-tabular">VITE_APPS_SCRIPT_WEBAPP_URL</span>). Prosegui nel gruppo WhatsApp provvisorio allo Step 4 o scrivi a{' '}
                          <span className="font-mono-tabular text-[#0B1F4D]">{config.emailOperativa}</span>.
                        </>
                      ) : emailDispatchState === 'sending' ? (
                        <>
                          invio notifica automatica al backend <span className="font-mono-tabular">FICUP 26/27</span> in corso verso{' '}
                          <span className="font-mono-tabular text-[#0B1F4D]">{submittedRecord.emailFantaleghe}</span> e lo staff (<span className="font-mono-tabular">{config.emailOperativa}</span>)...
                        </>
                      ) : emailDispatchState === 'triggered' ? (
                        <>
                          richiesta email automatica presa in carico dal backend <span className="font-mono-tabular">FICUP 26/27</span> verso{' '}
                          <span className="font-mono-tabular text-[#0B1F4D]">{submittedRecord.emailFantaleghe}</span> e notifica staff (<span className="font-mono-tabular">{config.emailOperativa}</span>). Controlla anche Spam o Promozioni.
                        </>
                      ) : (
                        <>
                          candidatura salvata su Firestore; il controllo periodico automatico del backend elaborerà la conferma email verso{' '}
                          <span className="font-mono-tabular text-[#0B1F4D]">{submittedRecord.emailFantaleghe}</span> e <span className="font-mono-tabular">{config.emailOperativa}</span>.
                        </>
                      )}
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setStep(4)}
                        className="min-h-[48px] w-full sm:w-auto px-6 py-3 rounded-xl bg-[#0B1F4D] text-white text-sm font-bold hover:bg-[#153985] transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <span>Prosegui al gruppo WhatsApp provvisorio</span>
                        <ArrowRight className="w-4 h-4 text-[#D4AF37]" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center space-y-4">
                    <Lock className="w-8 h-8 text-slate-400 mx-auto" />
                    <p className="text-sm text-slate-600">
                      Completa prima i dati del modulo allo Step 2 per inviare la candidatura.
                    </p>
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#0B1F4D] text-white text-sm font-semibold cursor-pointer"
                    >
                      Vai allo Step 2
                    </button>
                  </div>
                )}
              </motion.div>
            )}

            {/* STEP 4 — GRUPPO WHATSAPP PROVVISORIO */}
            {step === 4 && (
              <motion.div
                key="step-4"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.22 }}
                className="space-y-6"
              >
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[#C69214]">
                    Step 4 · Coordinamento con lo staff
                  </p>
                  <h1 className="mt-1 font-display text-2xl font-extrabold text-[#0B1F4D]">
                    Entra nel gruppo WhatsApp provvisorio
                  </h1>
                  <p className="mt-2 text-sm sm:text-base text-slate-600 leading-relaxed">
                    Questo gruppo provvisorio serve esclusivamente per comunicare con lo staff FANTA ITALIA CUP, segnalare eventuali richieste e completare rapidamente la procedura di ingresso nella lega.
                  </p>
                </div>

                {submittedRecord && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    Quando scrivi sul gruppo indica il tuo codice candidatura:{' '}
                    <strong className="font-mono-tabular text-[#0B1F4D]">
                      {submittedRecord.codiceCandidatura}
                    </strong>
                  </div>
                )}

                <a
                  href={config.linkWhatsappProvvisorio}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[52px] w-full px-6 py-3.5 rounded-xl bg-emerald-700 text-white text-sm sm:text-base font-bold hover:bg-emerald-800 transition-colors inline-flex items-center justify-center gap-2.5 shadow-sm"
                >
                  <MessageCircle className="w-5 h-5" />
                  <span>ENTRA NEL GRUPPO WHATSAPP PROVVISORIO</span>
                  <ExternalLink className="w-4 h-4 opacity-80" />
                </a>

                <div className="pt-2 flex flex-col-reverse sm:flex-row justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="min-h-[44px] px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Rivedi codice candidatura
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(5)}
                    className="min-h-[48px] px-6 py-3 rounded-xl bg-[#0B1F4D] text-white text-sm font-bold hover:bg-[#153985] transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Passaggio successivo: Attesa invito</span>
                    <ArrowRight className="w-4 h-4 text-[#D4AF37]" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 5 — ATTESA INVITO */}
            {step === 5 && (
              <motion.div
                key="step-5"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.22 }}
                className="space-y-6"
              >
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[#C69214]">
                    Step 5 · Verifica e invio invito Fantaleghe
                  </p>
                  <h1 className="mt-1 font-display text-2xl font-extrabold text-[#0B1F4D]">
                    Attendi l&apos;invito ufficiale via email
                  </h1>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-3">
                  <div className="flex items-start gap-3">
                    <Mail className="w-5 h-5 text-[#0B1F4D] shrink-0 mt-0.5" />
                    <p className="text-sm sm:text-base text-slate-700 leading-relaxed">
                      Lo staff verificherà la tua candidatura e invierà l&apos;invito ufficiale Fantaleghe all&apos;indirizzo email indicato:{' '}
                      <strong className="text-[#0B1F4D] break-all">
                        {submittedRecord?.emailFantaleghe ?? emailFantaleghe}
                      </strong>
                      .
                    </p>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 pl-8">
                    Controlla anche la cartella Spam o Promozioni della tua casella di posta. Per qualsiasi dubbio scrivi sul gruppo WhatsApp provvisorio oppure a{' '}
                    <span className="font-mono-tabular">{config.emailOperativa}</span>.
                  </p>
                </div>

                <div className="pt-2 flex flex-col-reverse sm:flex-row justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(4)}
                    className="min-h-[44px] px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Indietro
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(6)}
                    className="min-h-[48px] px-6 py-3 rounded-xl bg-[#0B1F4D] text-white text-sm font-bold hover:bg-[#153985] transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Cosa fare dopo l&apos;invito</span>
                    <ArrowRight className="w-4 h-4 text-[#D4AF37]" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 6 — COMPLETAMENTO */}
            {step === 6 && (
              <motion.div
                key="step-6"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.22 }}
                className="space-y-6"
              >
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[#C69214]">
                    Step 6 · Azioni su Fantaleghe
                  </p>
                  <h1 className="mt-1 font-display text-2xl font-extrabold text-[#0B1F4D]">
                    Completa il tuo ingresso nella competizione
                  </h1>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                    Dopo aver ricevuto l&apos;invito Fantaleghe via email, segui questi 6 passaggi in ordine (puoi spuntarli man mano come promemoria):
                  </p>
                </div>

                <div className="space-y-2.5">
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
                        <span className="text-sm leading-snug">
                          <strong className="font-mono-tabular text-[#0B1F4D] mr-1.5">
                            {idx + 1}.
                          </strong>
                          {task}
                        </span>
                      </label>
                    );
                  })}
                </div>

                <div className="pt-2 flex flex-col-reverse sm:flex-row justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(5)}
                    className="min-h-[44px] px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Indietro
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(7)}
                    className="min-h-[48px] px-6 py-3 rounded-xl bg-[#0B1F4D] text-white text-sm font-bold hover:bg-[#153985] transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Vai al gruppo ufficiale</span>
                    <ArrowRight className="w-4 h-4 text-[#D4AF37]" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 7 — COMMUNITY UFFICIALE (ACCESSO PROTETTO VIA WAITING ROOM) */}
            {step === 7 && (
              <motion.div
                key="step-7"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.22 }}
                className="space-y-6"
              >
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 text-[#C69214] flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-[#C69214]">
                      Step 7 · Accesso alla community ufficiale
                    </p>
                    <h1 className="mt-1 font-display text-2xl font-extrabold text-[#0B1F4D]">
                      Sblocco protetto nella Waiting Room
                    </h1>
                  </div>
                </div>

                <p className="text-sm sm:text-base text-slate-700 leading-relaxed">
                  Per sicurezza, il collegamento diretto al gruppo WhatsApp ufficiale della lega ({config.stagione}) non viene mostrato prima della verifica effettiva dello staff.
                </p>

                <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-xs sm:text-sm text-amber-950 space-y-2">
                  <p>
                    <strong>Come si sblocca il gruppo ufficiale:</strong>
                  </p>
                  <p>
                    Quando lo staff imposterà la tua candidatura su <span className="font-mono-tabular font-bold">COMPLETATO</span> su Firestore, accedendo alla tua <strong>Waiting Room</strong> con codice <span className="font-mono-tabular font-bold">{submittedRecord?.codiceCandidatura ?? 'FICUP26'}</span> ed email Fantaleghe, il pulsante ufficiale si attiverà automaticamente.
                  </p>
                </div>

                {onOpenWaitingRoom ? (
                  <button
                    type="button"
                    onClick={onOpenWaitingRoom}
                    className="min-h-[52px] w-full px-6 py-3.5 rounded-xl bg-[#0B1F4D] text-white text-sm sm:text-base font-bold hover:bg-[#153985] transition-colors inline-flex items-center justify-center gap-2.5 shadow-sm cursor-pointer"
                  >
                    <DoorOpen className="w-5 h-5 text-[#D4AF37]" />
                    <span>APRI LA TUA WAITING ROOM</span>
                    <ArrowRight className="w-4 h-4 text-[#D4AF37]" />
                  </button>
                ) : null}

                <div className="pt-2 flex flex-col-reverse sm:flex-row justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(6)}
                    className="min-h-[44px] px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Rivedi checklist completamento
                  </button>
                  <button
                    type="button"
                    onClick={onExitToHome}
                    className="min-h-[44px] px-5 py-2.5 rounded-xl border border-slate-300 text-[#0B1F4D] text-sm font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Torna alla homepage
                  </button>
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
