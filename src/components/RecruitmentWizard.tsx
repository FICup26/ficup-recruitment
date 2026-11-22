import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  DoorOpen,
  Download,
  ExternalLink,
  FileText,
  Gavel,
  Hourglass,
  Loader2,
  Lock,
  Mail,
  MessageCircle,
  Phone,
  Play,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserCheck,
  Wallet,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  isAppsScriptConfigured,
  triggerCandidaturaNotification,
  type TriggerCandidaturaNotificationResult,
} from '../lib/appsScriptClient';
import { isFirebaseConfigured } from '../lib/firebase';
import {
  fetchActivePublicDocument,
  normalizeAndValidateItalianPhone,
  saveAccettazioneDocumentale,
  submitCandidatura,
  validateCandidaturaInput,
  type CandidaturaStato,
  type ConfigurazionePublica,
  type DocumentoUfficialeRecord,
} from '../lib/firestore';
import {
  buildProvisionalWhatsappUrl,
  isProvisionalWhatsappUnlockedByVideo,
  loadIntroVideoCompletion,
} from '../lib/introVideoStorage';
import { parseFirestoreUiError } from '../lib/notifications';
import {
  CHAT_RULES_VERSION,
  GDPR_PRIVACY_SECTIONS,
  maskSensitiveWhatsappLinks,
  OFFICIAL_CHAT_RULES_SECTIONS,
  REGOLAMENTO_FALLBACK_VERSION,
} from '../lib/officialDocuments';
import { downloadOfficialDocumentPdf } from '../lib/pdfGenerator';
import { loadWaitingRoomPass, type WaitingRoomPass } from '../lib/waitingRoomStorage';
import { FicupIntroVideo } from './FicupIntroVideo';
import { FicupLogo } from './FicupLogo';
import { PrivacyModal } from './PrivacyModal';
import { RegulationContentView } from './RegulationContentView';

interface RecruitmentWizardProps {
  config: Omit<ConfigurazionePublica, 'updatedAt' | 'updatedBy'>;
  onExitToHome: () => void;
  onCandidaturaSubmitted?: (pass: WaitingRoomPass) => void;
  onOpenWaitingRoom?: () => void;
}

const STEP_META = [
  { num: 1, short: '01', label: 'Dati', Icon: UserCheck },
  { num: 2, short: '02', label: 'Privacy', Icon: ShieldCheck },
  { num: 3, short: '03', label: 'Regolamento PDF', Icon: FileText },
  { num: 4, short: '04', label: 'Regole Chat', Icon: MessageCircle },
  { num: 5, short: '05', label: 'Invio', Icon: Send },
  { num: 6, short: '06', label: 'Prossimi Passi', Icon: Sparkles },
] as const;

export type WizardEmailDispatchState =
  | 'idle'
  | 'sending'
  | 'emails_confirmed'
  | 'emails_pending'
  | 'notification_error'
  | 'forbidden_state'
  | 'unconfigured';

export interface SubmittedWizardRecord {
  id: string;
  codiceCandidatura: string;
  emailFantaleghe: string;
  cellulare: string;
  nomeSquadra: string;
  nomeCompleto: string;
  note?: string;
  submittedAtIso: string;
  stato: CandidaturaStato;
}

export interface RecruitmentStep6Props {
  config: Pick<
    Omit<ConfigurazionePublica, 'updatedAt' | 'updatedBy'>,
    'linkWhatsappProvvisorio' | 'emailOperativa'
  >;
  submittedRecord: SubmittedWizardRecord | null;
  emailDispatchState: WizardEmailDispatchState;
  isAppsScriptReady: boolean;
  canRetryEmail?: boolean;
  onRetryEmailNotification: () => void;
  onExitToHome: () => void;
  onOpenWaitingRoom?: () => void;
}

export function RecruitmentStep6({
  config,
  submittedRecord,
  emailDispatchState,
  isAppsScriptReady,
  canRetryEmail = false,
  onRetryEmailNotification,
  onExitToHome,
  onOpenWaitingRoom,
}: RecruitmentStep6Props) {
  const prefersReducedMotion = Boolean(useReducedMotion());
  const codiceCandidatura = submittedRecord?.codiceCandidatura ?? 'FICUP26';
  const emailFantaleghe = submittedRecord?.emailFantaleghe ?? '';
  const rawFirstName = (submittedRecord?.nomeCompleto || '').trim().split(/\s+/)[0] || '';
  const heroHeadline = rawFirstName
    ? `${rawFirstName.toUpperCase()}! LA TUA CANDIDATURA È STATA INVIATA!`
    : 'LA TUA CANDIDATURA È STATA INVIATA!';

  const [copiedCode, setCopiedCode] = useState(false);
  const [whatsappUnlocked, setWhatsappUnlocked] = useState<boolean>(() => {
    if (!submittedRecord?.codiceCandidatura) return false;
    return isProvisionalWhatsappUnlockedByVideo(
      loadIntroVideoCompletion(submittedRecord.codiceCandidatura, submittedRecord.emailFantaleghe)
    );
  });
  const [justUnlockedGlow, setJustUnlockedGlow] = useState(false);

  const handleVideoUnlockChange = useCallback((unlocked: boolean, justTriggered?: boolean) => {
    setWhatsappUnlocked(unlocked);
    if (unlocked && justTriggered) {
      setJustUnlockedGlow(true);
    }
  }, []);

  const handleCopyCode = async () => {
    if (!codiceCandidatura || typeof navigator === 'undefined' || !navigator.clipboard) {
      return;
    }
    try {
      await navigator.clipboard.writeText(codiceCandidatura);
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  const prefilledWhatsappLink = buildProvisionalWhatsappUrl(
    config.linkWhatsappProvvisorio,
    codiceCandidatura
  );

  return (
    <motion.div
      key="step-6"
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="divide-y divide-slate-200"
    >
      {/* FASCIA CONFERMA IMMEDIATA (ZERO MESSAGGI TECNICI) */}
      <section className="bg-gradient-to-br from-[#071436] via-[#0B1F4D] to-[#13327A] text-white px-4 sm:px-8 py-8 sm:py-11">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <p className="text-xs sm:text-sm font-bold uppercase tracking-[0.2em] text-[#FDE68A]">
              Candidatura completata
            </p>
          </div>

          <div className="space-y-2.5">
            <h1 className="font-display text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight">
              {heroHeadline}
            </h1>
            <p className="text-base sm:text-lg text-slate-200 font-medium">
              La tua richiesta è stata registrata correttamente.
            </p>
          </div>

          {/* Codice personale in evidenza */}
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-white/15">
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-widest text-[#FDE68A]">
                Codice personale
              </p>
              <p className="font-mono-tabular text-3xl sm:text-4xl font-black tracking-wider text-white">
                {codiceCandidatura}
              </p>
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed pt-1">
                <strong>Conserva questo codice:</strong> ti servirà per comunicare con lo staff.{' '}
                Ora puoi proseguire con i prossimi passaggi.
              </p>
            </div>

            <button
              type="button"
              onClick={handleCopyCode}
              className="min-h-[46px] px-5 py-2.5 rounded-xl bg-white/12 hover:bg-white/20 border border-white/25 text-xs sm:text-sm font-bold text-white inline-flex items-center justify-center gap-2 shrink-0 cursor-pointer transition-colors"
            >
              {copiedCode ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  <span>Codice copiato</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-[#FDE68A]" />
                  <span>Copia codice</span>
                </>
              )}
            </button>
          </div>

          {/* Stato email pulito e mai ingannevole */}
          {emailDispatchState === 'emails_confirmed' && (
            <div className="pt-3 border-t border-white/15 flex items-center gap-2.5 text-xs sm:text-sm text-emerald-200">
              <Mail className="w-4 h-4 shrink-0" />
              <span>
                Ti abbiamo inviato un&apos;email di riepilogo (controlla anche <strong>Spam</strong> o <strong>Promozioni</strong>).
              </span>
            </div>
          )}

          {emailDispatchState === 'sending' && (
            <div className="pt-3 border-t border-white/15 flex items-center gap-2.5 text-xs sm:text-sm text-sky-200">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              <span>Invio del riepilogo alla tua email in corso...</span>
            </div>
          )}

          {(emailDispatchState === 'notification_error' || emailDispatchState === 'emails_pending') &&
            canRetryEmail &&
            isAppsScriptReady && (
              <div className="pt-3 border-t border-white/15 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm text-amber-200">
                <span>Non hai ancora ricevuto il riepilogo via email?</span>
                <button
                  type="button"
                  onClick={onRetryEmailNotification}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-white text-[#071436] text-xs font-extrabold hover:bg-[#FDE68A] transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Invia di nuovo il riepilogo</span>
                </button>
              </div>
            )}
        </div>
      </section>

      {/* FASE 1 — GUARDA IL VIDEO FICUP */}
      <section className="bg-gradient-to-r from-[#0E2661] via-[#13337D] to-[#0B1F4D] text-white px-4 sm:px-8 py-8 sm:py-10">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start gap-5 sm:gap-7">
          <div className="flex items-center gap-3 shrink-0">
            <span className="font-mono-tabular text-4xl sm:text-5xl font-black text-[#FDE68A]/90 leading-none">
              01
            </span>
            <div className="w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center text-[#FDE68A]">
              <Play className="w-5 h-5 fill-current" />
            </div>
          </div>

          <div className="flex-1 space-y-4">
            <div className="space-y-1.5">
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#FDE68A]">
                FASE 1 · GUARDA IL VIDEO FICUP
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-black text-white leading-tight">
                SCOPRI COSA TI ASPETTA IN FICUP
              </h2>
              <p className="text-sm sm:text-base text-slate-200 leading-relaxed max-w-2xl">
                Guarda il nostro breve videoclip: ti spiegheremo come entrare nella community, attendere l&apos;accettazione della candidatura e completare l&apos;accesso a Fantaleghe.
              </p>
            </div>

            <FicupIntroVideo
              variant="phase1"
              codiceCandidatura={codiceCandidatura}
              emailFantaleghe={emailFantaleghe}
              provisionalWhatsappUrl={config.linkWhatsappProvvisorio}
              canAccessProvisionalWa={true}
              realState={submittedRecord?.stato ?? 'NUOVO'}
              onUnlockStateChange={handleVideoUnlockChange}
            />
          </div>
        </div>
      </section>

      {/* FASE 2 — ENTRA NEL GRUPPO WHATSAPP PROVVISORIO */}
      <section
        className={`px-4 sm:px-8 py-8 sm:py-10 transition-colors duration-300 ${
          whatsappUnlocked
            ? 'bg-gradient-to-r from-emerald-50 via-teal-50/70 to-emerald-50 text-[#0B1F4D]'
            : 'bg-slate-100/90 text-[#0B1F4D]'
        }`}
      >
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start gap-5 sm:gap-7">
          <div className="flex items-center gap-3 shrink-0">
            <span
              className={`font-mono-tabular text-4xl sm:text-5xl font-black leading-none ${
                whatsappUnlocked ? 'text-emerald-700' : 'text-slate-400'
              }`}
            >
              02
            </span>
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center ${
                whatsappUnlocked
                  ? 'bg-emerald-700 text-white shadow-md'
                  : 'bg-white text-slate-400 border border-slate-200'
              }`}
            >
              {whatsappUnlocked ? (
                <MessageCircle className="w-5 h-5" />
              ) : (
                <Lock className="w-5 h-5" />
              )}
            </div>
          </div>

          <div className="flex-1 space-y-4">
            <div className="space-y-1.5">
              <p
                className={`text-xs font-extrabold uppercase tracking-[0.2em] ${
                  whatsappUnlocked ? 'text-emerald-700' : 'text-slate-500'
                }`}
              >
                FASE 2 · GRUPPO PROVVISORIO
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-black text-[#0B1F4D] leading-tight">
                ENTRA NEL GRUPPO PROVVISORIO
              </h2>
              <p className="text-sm sm:text-base text-slate-700 leading-relaxed max-w-2xl">
                Entra nel gruppo WhatsApp dedicato ai nuovi candidati. Una volta entrato,{' '}
                <strong>presenta brevemente la tua richiesta utilizzando il codice personale</strong>{' '}
                <strong className="font-mono-tabular text-[#0B1F4D]">{codiceCandidatura}</strong>.
              </p>
            </div>

            {whatsappUnlocked && prefilledWhatsappLink ? (
              <motion.div
                initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-2.5"
              >
                <motion.a
                  href={prefilledWhatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  animate={
                    justUnlockedGlow && !prefersReducedMotion
                      ? {
                          scale: [1, 1.025, 1],
                          boxShadow: [
                            '0 10px 25px -8px rgba(4,120,87,0.35)',
                            '0 0 32px 6px rgba(16,185,129,0.55)',
                            '0 10px 25px -8px rgba(4,120,87,0.35)',
                          ],
                        }
                      : undefined
                  }
                  transition={{ duration: 1.5, repeat: justUnlockedGlow ? 3 : 0 }}
                  className="min-h-[56px] w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm sm:text-base font-black tracking-wide transition-colors inline-flex items-center justify-center gap-2.5 shadow-lg"
                >
                  <MessageCircle className="w-5 h-5" />
                  <span>ENTRA NEL GRUPPO WHATSAPP PROVVISORIO</span>
                  <ExternalLink className="w-4 h-4 opacity-90" />
                </motion.a>
                <p className="text-xs text-emerald-900 font-medium">
                  Il messaggio di presentazione con il tuo codice verrà precompilato automaticamente su WhatsApp.
                </p>
              </motion.div>
            ) : (
              <div className="flex items-center gap-2.5 text-xs sm:text-sm font-semibold text-slate-600 pt-1">
                <Lock className="w-4 h-4 text-[#C69214] shrink-0" />
                <span>
                  Apri il videoclip nella <strong>Fase 1</strong> qui sopra per attivare questo pulsante.
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* FASE 3 — VAI ALL'AREA PERSONALE */}
      <section className="bg-gradient-to-r from-amber-50/80 via-white to-slate-50 px-4 sm:px-8 py-8 sm:py-10 text-[#0B1F4D]">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start gap-5 sm:gap-7">
          <div className="flex items-center gap-3 shrink-0">
            <span className="font-mono-tabular text-4xl sm:text-5xl font-black text-[#C69214] leading-none">
              03
            </span>
            <div className="w-11 h-11 rounded-2xl bg-[#0B1F4D] text-[#FDE68A] flex items-center justify-center">
              <DoorOpen className="w-5 h-5" />
            </div>
          </div>

          <div className="flex-1 space-y-5">
            <div className="space-y-1.5">
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#C69214]">
                FASE 3 · AREA PERSONALE E ATTESA
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-black text-[#0B1F4D] leading-tight">
                CONTROLLA LO STATO DELLA TUA CANDIDATURA
              </h2>
              <p className="text-sm sm:text-base text-slate-700 leading-relaxed max-w-2xl">
                Da qui potrai controllare in qualsiasi momento lo stato della tua candidatura e seguire gli aggiornamenti dello staff.
              </p>
            </div>

            {onOpenWaitingRoom && (
              <button
                type="button"
                onClick={onOpenWaitingRoom}
                className="min-h-[56px] w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-[#0B1F4D] hover:bg-[#153985] text-white text-sm sm:text-base font-black tracking-wide transition-colors inline-flex items-center justify-center gap-2.5 shadow-lg cursor-pointer"
              >
                <DoorOpen className="w-5 h-5 text-[#FDE68A]" />
                <span>VAI ALL&apos;AREA PERSONALE</span>
                <ArrowRight className="w-4 h-4 text-[#FDE68A]" />
              </button>
            )}

            <div className="pt-3 border-t border-slate-200 space-y-1.5 text-sm text-slate-700 leading-relaxed max-w-2xl">
              <p className="font-black text-[#0B1F4D] uppercase tracking-wide text-xs sm:text-sm">
                ORA DEVI SOLO ATTENDERE LA VALUTAZIONE DELLO STAFF.
              </p>
              <p>
                Quando la candidatura verrà accettata, riceverai l&apos;invito ufficiale via email.{' '}
                <strong>Controlla anche Spam e Promozioni.</strong>
              </p>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
              <span>
                Per assistenza:{' '}
                <strong className="font-mono-tabular text-[#0B1F4D]">
                  {config.emailOperativa}
                </strong>
              </span>
              <button
                type="button"
                onClick={onExitToHome}
                className="min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold text-[#0B1F4D] hover:bg-slate-200/70 transition-colors cursor-pointer"
              >
                Torna alla home
              </button>
            </div>
          </div>
        </div>
      </section>
    </motion.div>
  );
}

export function RecruitmentWizard({
  config,
  onExitToHome,
  onCandidaturaSubmitted,
  onOpenWaitingRoom,
}: RecruitmentWizardProps) {
  const prefersReducedMotion = Boolean(useReducedMotion());
  const [step, setStep] = useState<number>(1);
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);

  // Documenti ufficiali
  const [docsLoading, setDocsLoading] = useState(true);
  const [activeRegolamento, setActiveRegolamento] = useState<DocumentoUfficialeRecord | null>(null);
  const [activeChatRulesDoc, setActiveChatRulesDoc] = useState<DocumentoUfficialeRecord | null>(null);

  // Step 1 Form
  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [emailFantaleghe, setEmailFantaleghe] = useState('');
  const [cellulare, setCellulare] = useState('');
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [nomeSquadra, setNomeSquadra] = useState('');
  const [note, setNote] = useState('');
  const [step1Error, setStep1Error] = useState<string | null>(null);
  const [duplicateLocalWarning, setDuplicateLocalWarning] = useState<string | null>(null);

  // Consensi
  const [consensoPrivacy, setConsensoPrivacy] = useState(false);
  const [step2Error, setStep2Error] = useState<string | null>(null);

  const [consensoRegolamento, setConsensoRegolamento] = useState(false);
  const [step3Error, setStep3Error] = useState<string | null>(null);
  const [pdfFeedback, setPdfFeedback] = useState<string | null>(null);

  const [consensoRegoleChat, setConsensoRegoleChat] = useState(false);
  const [step4Error, setStep4Error] = useState<string | null>(null);

  // Invio
  const [submitting, setSubmitting] = useState(false);
  const [submitStage, setSubmitStage] = useState<'verifying' | 'saving'>('verifying');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedRecord, setSubmittedRecord] = useState<SubmittedWizardRecord | null>(null);
  const [emailDispatchState, setEmailDispatchState] = useState<WizardEmailDispatchState>('idle');
  const [canRetryEmail, setCanRetryEmail] = useState(false);

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

  useEffect(() => {
    const cleanEmail = emailFantaleghe.trim().toLowerCase();
    if (!cleanEmail) {
      setDuplicateLocalWarning(null);
      return;
    }
    const existingPass = loadWaitingRoomPass();
    if (existingPass && existingPass.emailFantaleghe.trim().toLowerCase() === cleanEmail) {
      setDuplicateLocalWarning(
        `Su questo dispositivo hai già una candidatura collegata a questa email (${existingPass.codiceCandidatura}). Puoi controllare lo stato direttamente dalla tua Area Personale.`
      );
    } else {
      setDuplicateLocalWarning(null);
    }
  }, [emailFantaleghe]);

  const progressPercent = Math.round((step / STEP_META.length) * 100);
  const isSubmitted = submittedRecord !== null;
  const emailValidHint =
    emailFantaleghe.trim().length > 0 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailFantaleghe.trim());
  const phoneValidation = (() => {
    const trimmed = cellulare.trim();
    if (!trimmed) {
      return { valid: false as const, error: null as string | null };
    }
    try {
      normalizeAndValidateItalianPhone(trimmed);
      return { valid: true as const, error: null as string | null };
    } catch (err) {
      return {
        valid: false as const,
        error: err instanceof Error ? err.message : 'Inserire un numero di cellulare italiano valido.',
      };
    }
  })();
  const phoneValidHint = phoneValidation.valid;
  const showInlinePhoneError =
    Boolean(phoneValidation.error) &&
    (phoneTouched || Boolean(step1Error) || cellulare.replace(/\D/g, '').length >= 9);
  const squadValidHint = nomeSquadra.trim().length >= 2;

  const regolamentoVersionLabel = activeRegolamento?.versione || REGOLAMENTO_FALLBACK_VERSION;
  const regolamentoDocIdLabel = activeRegolamento?.id || 'in_attesa_pubblicazione';
  const chatRulesVersionLabel = activeChatRulesDoc?.versione || CHAT_RULES_VERSION;

  const handleStep1Next = (e: FormEvent) => {
    e.preventDefault();
    setStep1Error(null);
    setPhoneTouched(true);
    try {
      const validated = validateCandidaturaInput({
        nome,
        cognome,
        emailFantaleghe,
        cellulare,
        nomeSquadra,
        note,
        consensoPrivacy: true,
        versioneInformativa: config.versioneInformativa,
      });
      setCellulare(validated.cellulare);
      setStep(2);
    } catch (err) {
      setStep1Error(err instanceof Error ? err.message : 'Controlla i campi inseriti.');
    }
  };

  const handleStep2Next = () => {
    setStep2Error(null);
    if (!consensoPrivacy) {
      setStep2Error("Per proseguire accetta l'Informativa Privacy.");
      return;
    }
    setStep(3);
  };

  const handleStep3Next = () => {
    setStep3Error(null);
    if (!consensoRegolamento) {
      setStep3Error('Per proseguire conferma la lettura del Regolamento PDF.');
      return;
    }
    setStep(4);
  };

  const handleStep4Next = () => {
    setStep4Error(null);
    if (!consensoRegoleChat) {
      setStep4Error('Per proseguire accetta le Regole Chat.');
      return;
    }
    setStep(5);
  };

  const handleRealSubmit = async () => {
    setSubmitError(null);

    if (!config.iscrizioniAperte) {
      setSubmitError('Le iscrizioni risultano momentaneamente chiuse.');
      return;
    }
    if (!isFirebaseConfigured) {
      setSubmitError('Servizio momentaneamente non disponibile.');
      return;
    }
    if (!consensoPrivacy || !consensoRegolamento || !consensoRegoleChat) {
      setSubmitError('Completa tutte le accettazioni obbligatorie prima di inviare.');
      return;
    }

    setSubmitting(true);
    setSubmitStage('verifying');
    try {
      const clean = validateCandidaturaInput({
        nome,
        cognome,
        emailFantaleghe,
        cellulare,
        nomeSquadra,
        note,
        consensoPrivacy,
        versioneInformativa: config.versioneInformativa,
        regolamentoAccettato: consensoRegolamento,
        regolamentoVersione: regolamentoVersionLabel,
      });

      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 1400);
      });

      setSubmitStage('saving');
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
      } catch {
        // Non blocca il completamento lato candidato
      }

      const nomeCompleto = `${clean.nome} ${clean.cognome}`;
      const baseRecord: SubmittedWizardRecord = {
        id: result.id,
        codiceCandidatura: result.codiceCandidatura,
        emailFantaleghe: clean.emailFantaleghe,
        cellulare: clean.cellulare,
        nomeSquadra: clean.nomeSquadra,
        nomeCompleto,
        note: clean.note || undefined,
        submittedAtIso,
        stato: 'NUOVO',
      };
      setSubmittedRecord(baseRecord);

      onCandidaturaSubmitted?.({
        id: result.id,
        codiceCandidatura: result.codiceCandidatura,
        emailFantaleghe: clean.emailFantaleghe,
        cellulare: clean.cellulare,
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

      const applyNotificationOutcome = (
        candidaturaId: string,
        res: TriggerCandidaturaNotificationResult
      ) => {
        if (res.stato) {
          setSubmittedRecord((prev) =>
            prev && prev.id === candidaturaId ? { ...prev, stato: res.stato! } : prev
          );
        }
        setEmailDispatchState(res.outcome);
        setCanRetryEmail(res.canRetry);
      };

      if (!isAppsScriptConfigured) {
        setEmailDispatchState('unconfigured');
        setCanRetryEmail(false);
      } else {
        setEmailDispatchState('sending');
        setCanRetryEmail(false);
        triggerCandidaturaNotification({
          candidaturaId: result.id,
          codiceCandidatura: result.codiceCandidatura,
          emailFantaleghe: clean.emailFantaleghe,
        }).then((res) => applyNotificationOutcome(result.id, res));
      }

      // Passa subito alla schermata guidata a 3 fasi dopo l'invio
      setStep(6);
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err) {
      setSubmitError(parseFirestoreUiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetryEmailNotification = async () => {
    if (!submittedRecord || !isAppsScriptConfigured || emailDispatchState === 'sending') {
      return;
    }
    if (emailDispatchState === 'emails_confirmed' || emailDispatchState === 'forbidden_state') {
      return;
    }
    setEmailDispatchState('sending');
    setCanRetryEmail(false);
    const res = await triggerCandidaturaNotification({
      candidaturaId: submittedRecord.id,
      codiceCandidatura: submittedRecord.codiceCandidatura,
      emailFantaleghe: submittedRecord.emailFantaleghe,
    });
    if (res.stato) {
      setSubmittedRecord((prev) =>
        prev && prev.id === submittedRecord.id ? { ...prev, stato: res.stato! } : prev
      );
    }
    setEmailDispatchState(res.outcome);
    setCanRetryEmail(res.canRetry);
  };

  const handleDownloadRegolamentoPdf = () => {
    if (!activeRegolamento?.contenutoTesto?.trim()) {
      return;
    }
    setPdfFeedback(null);
    try {
      const fileName = `FICUP-${config.stagione.replace('/', '-')}-Regolamento-Ufficiale-v${
        activeRegolamento.versione || 'attivo'
      }.pdf`;
      downloadOfficialDocumentPdf({
        title: activeRegolamento.titolo || `Regolamento Ufficiale FICUP ${config.stagione}`,
        subtitle: 'Regolamento ufficiale della competizione',
        version: activeRegolamento.versione || config.stagione,
        publishedAt: activeRegolamento.dataPubblicazione || undefined,
        content: activeRegolamento.contenutoTesto,
        fileName,
      });
      setPdfFeedback(`PDF "${fileName}" scaricato.`);
    } catch (err) {
      setPdfFeedback(err instanceof Error ? err.message : 'Errore generazione PDF.');
    }
  };

  const handleDownloadChatRulesPdf = () => {
    setPdfFeedback(null);
    try {
      const content =
        activeChatRulesDoc && activeChatRulesDoc.contenutoTesto.trim()
          ? maskSensitiveWhatsappLinks(activeChatRulesDoc.contenutoTesto.trim())
          : OFFICIAL_CHAT_RULES_SECTIONS.map(
              (sec) => `# ${sec.title}\n${sec.paragraphs.join('\n\n')}`
            ).join('\n\n');
      const fileName = `FICUP-${config.stagione.replace('/', '-')}-Regole-Chat-v${chatRulesVersionLabel}.pdf`;
      downloadOfficialDocumentPdf({
        title: activeChatRulesDoc?.titolo || 'Regole Ufficiali Chat WhatsApp FICUP',
        subtitle: 'Codice di comportamento community WhatsApp',
        version: chatRulesVersionLabel,
        publishedAt: activeChatRulesDoc?.dataPubblicazione || undefined,
        content,
        fileName,
      });
      setPdfFeedback(`PDF "${fileName}" scaricato.`);
    } catch (err) {
      setPdfFeedback(err instanceof Error ? err.message : 'Errore generazione PDF.');
    }
  };

  const canVisitStep = (targetStep: number): boolean => {
    if (isSubmitted) {
      return targetStep === 6;
    }
    if (targetStep === 1) return true;
    if (targetStep === 2) {
      return (
        nome.trim().length >= 1 &&
        cognome.trim().length >= 1 &&
        emailValidHint &&
        phoneValidHint &&
        squadValidHint
      );
    }
    if (targetStep === 3) return consensoPrivacy;
    if (targetStep === 4) return consensoPrivacy && consensoRegolamento;
    if (targetStep === 5) return consensoPrivacy && consensoRegolamento && consensoRegoleChat;
    return false;
  };

  const inputClass =
    'w-full min-h-[50px] px-4 py-3 rounded-xl border border-slate-300 bg-white text-sm sm:text-base text-[#0B1F4D] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B1F4D]/25 focus:border-[#0B1F4D] transition-all';

  return (
    <div className="bg-white min-h-[calc(100vh-4.5rem)] text-[#0B1F4D]">
      {/* Barra superiore full-width snella con indicatore progressivo */}
      <div className="bg-slate-50 border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-8 py-4 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={onExitToHome}
              className="min-h-[42px] inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-[#0B1F4D] hover:text-[#153985] transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-[#C69214]" />
              <span>Torna alla home</span>
            </button>

            <div className="flex items-center gap-2.5">
              <span className="font-mono-tabular text-xs font-bold text-[#0B1F4D]">
                Passaggio {step} / {STEP_META.length}
              </span>
              <FicupLogo size="xs" className="hidden sm:block" />
            </div>
          </div>

          {/* Linea di avanzamento fluida */}
          <div
            className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <motion.div
              className="h-full bg-gradient-to-r from-[#0B1F4D] via-[#0284C7] to-[#D4AF37]"
              initial={false}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            />
          </div>

          {/* Indicatori numerici progressivi e riconoscibili */}
          <div className="grid grid-cols-6 gap-1 sm:gap-2">
            {STEP_META.map(({ num, short, label, Icon }) => {
              const active = step === num;
              const completed = step > num;
              const unlocked = canVisitStep(num);
              return (
                <button
                  key={label}
                  type="button"
                  disabled={!unlocked}
                  onClick={() => unlocked && setStep(num)}
                  title={`Passaggio ${num}: ${label}`}
                  className={`py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-0.5 text-center transition-all ${
                    active
                      ? 'bg-[#0B1F4D] text-white shadow-xs'
                      : completed
                        ? 'bg-emerald-50 text-emerald-800'
                        : unlocked
                          ? 'text-slate-600 hover:bg-slate-200/70'
                          : 'text-slate-400 opacity-55 cursor-not-allowed'
                  } ${unlocked ? 'cursor-pointer' : ''}`}
                >
                  <div className="flex items-center gap-1">
                    {completed ? (
                      <Check className="w-3.5 h-3.5 text-emerald-700" />
                    ) : (
                      <Icon className={`w-3.5 h-3.5 ${active ? 'text-[#FDE68A]' : ''}`} />
                    )}
                    <span className="font-mono-tabular text-xs font-extrabold">{short}</span>
                  </div>
                  <span className="hidden md:block text-[10px] font-semibold truncate max-w-full">
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Contenuto a tutta larghezza senza box ripetitivi */}
      <AnimatePresence mode="wait">
        {/* STEP 1 — PRESENTAZIONE & DATI */}
        {step === 1 && (
          <motion.div
            key="step-1"
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Banda intestazione colorata */}
            <section className="bg-gradient-to-br from-[#071436] via-[#0B1F4D] to-[#153985] text-white px-4 sm:px-8 py-7 sm:py-9">
              <div className="max-w-4xl mx-auto space-y-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2.5 text-xs font-black uppercase tracking-[0.2em] text-[#FDE68A]">
                      <span className="font-mono-tabular text-2xl sm:text-3xl leading-none">01</span>
                      <span>Candidatura FANTA ITALIA CUP · {config.stagione}</span>
                    </div>
                    <h1 className="font-display text-2xl sm:text-4xl font-black tracking-tight text-white">
                      Inserisci i tuoi dati per scendere in campo
                    </h1>
                    <p className="text-sm sm:text-base text-slate-200 max-w-2xl leading-relaxed">
                      <strong>Lega nazionale 100% gratuita su Fantaleghe.</strong> Compila i tuoi dati e poi consulta Privacy, Regolamento PDF e Regole Chat.
                    </p>
                  </div>
                  <FicupLogo size="md" className="hidden sm:block bg-white p-1 shrink-0" />
                </div>

                {/* Strip orizzontale pulita senza box pesanti */}
                <div className="pt-4 border-t border-white/15 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs sm:text-sm">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-[#FDE68A] shrink-0" />
                    <span><strong>Quota 0 €</strong> gratuita</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-[#38BDF8] shrink-0" />
                    <span className="font-mono-tabular"><strong>{config.budgetIniziale}</strong> crediti</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Gavel className="w-4 h-4 text-emerald-300 shrink-0" />
                    <span><strong>{config.modalitaMercato}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#FDE68A] shrink-0" />
                    <span><strong>Club</strong> personalizzato</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Form a tutta larghezza su sfondo pulito */}
            <section className="px-4 sm:px-8 py-7 sm:py-10">
              <div className="max-w-4xl mx-auto space-y-5">
                {step1Error && (
                  <div className="rounded-xl bg-red-50 border-l-4 border-red-600 p-4 flex items-start gap-2.5 text-sm text-red-900">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{step1Error}</span>
                  </div>
                )}

                {duplicateLocalWarning && (
                  <div className="rounded-xl bg-amber-50 border-l-4 border-[#C69214] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm text-amber-950">
                    <span>{duplicateLocalWarning}</span>
                    {onOpenWaitingRoom && (
                      <button
                        type="button"
                        onClick={onOpenWaitingRoom}
                        className="text-xs font-extrabold text-[#0B1F4D] underline underline-offset-2 shrink-0 cursor-pointer"
                      >
                        Apri Area Personale
                      </button>
                    )}
                  </div>
                )}

                <form onSubmit={handleStep1Next} className="space-y-5" noValidate>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="ficup-nome" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
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
                      <label htmlFor="ficup-cognome" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
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
                      <label htmlFor="ficup-email" className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                        Email utilizzata su Fantaleghe *
                      </label>
                      {emailValidHint && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                          <Check className="w-3.5 h-3.5" /> Valida
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
                    <p className="mt-1.5 text-xs text-slate-500">
                      <strong>Importante:</strong> su questa email riceverai l&apos;invito ufficiale a Fantaleghe dopo l&apos;accettazione.
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="ficup-cellulare" className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                        Numero di cellulare (+39) *
                      </label>
                      {phoneValidHint && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                          <Check className="w-3.5 h-3.5" /> +39 valido
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="ficup-cellulare"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        required
                        maxLength={24}
                        value={cellulare}
                        onChange={(e) => {
                          setCellulare(e.target.value);
                          if (step1Error) setStep1Error(null);
                        }}
                        onBlur={() => setPhoneTouched(true)}
                        placeholder="+39 347 892 4156"
                        aria-invalid={showInlinePhoneError}
                        className={`${inputClass} pl-10 font-mono-tabular ${
                          showInlinePhoneError
                            ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
                            : ''
                        }`}
                      />
                    </div>
                    {showInlinePhoneError && phoneValidation.error && (
                      <p className="mt-1.5 text-xs font-semibold text-red-700 flex items-start gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>{phoneValidation.error}</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="ficup-squadra" className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                        Nome della squadra proposta *
                      </label>
                      {squadValidHint && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                          <Check className="w-3.5 h-3.5" /> OK
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
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="ficup-note" className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                        Note facoltative per lo staff
                      </label>
                      <span className="font-mono-tabular text-xs text-slate-400">
                        {note.length}/700
                      </span>
                    </div>
                    <textarea
                      id="ficup-note"
                      rows={3}
                      maxLength={700}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Esperienza su Fantaleghe o eventuali richieste (facoltativo)"
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-sm text-[#0B1F4D] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B1F4D]/25 focus:border-[#0B1F4D] transition-all"
                    />
                  </div>

                  <div className="pt-3 flex justify-end">
                    <button
                      type="submit"
                      disabled={!config.iscrizioniAperte}
                      className="min-h-[54px] w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-[#0B1F4D] hover:bg-[#153985] text-white text-sm sm:text-base font-black tracking-wide disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-2.5 cursor-pointer shadow-md"
                    >
                      <span>
                        {config.iscrizioniAperte
                          ? 'PROSEGUI: PRIVACY'
                          : 'Iscrizioni chiuse'}
                      </span>
                      <ArrowRight className="w-5 h-5 text-[#FDE68A]" />
                    </button>
                  </div>
                </form>
              </div>
            </section>
          </motion.div>
        )}

        {/* STEP 2 — PRIVACY */}
        {step === 2 && (
          <motion.div
            key="step-2"
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <section className="bg-gradient-to-r from-sky-50 via-slate-50 to-white border-b border-slate-200 px-4 sm:px-8 py-7">
              <div className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5 text-xs font-black uppercase tracking-[0.2em] text-[#0284C7]">
                    <span className="font-mono-tabular text-2xl sm:text-3xl leading-none">02</span>
                    <span>TUTELA DATI PERSONALI</span>
                  </div>
                  <h1 className="font-display text-2xl sm:text-3xl font-black text-[#0B1F4D]">
                    INFORMATIVA PRIVACY (v{config.versioneInformativa})
                  </h1>
                </div>

                <button
                  type="button"
                  onClick={() => setPrivacyModalOpen(true)}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-[#0284C7] text-xs font-extrabold text-[#0284C7] hover:bg-sky-100/50 transition-colors cursor-pointer shrink-0"
                >
                  Leggi a schermo intero
                </button>
              </div>
            </section>

            <section className="px-4 sm:px-8 py-7">
              <div className="max-w-4xl mx-auto space-y-5">
                <div className="border-l-4 border-[#0284C7] pl-4 sm:pl-6 max-h-80 overflow-y-auto space-y-4 text-xs sm:text-sm text-slate-700 leading-relaxed">
                  {GDPR_PRIVACY_SECTIONS.map((section) => (
                    <div key={section.id} className="space-y-1">
                      <h2 className="font-bold text-[#0B1F4D]">{section.title}</h2>
                      {section.paragraphs.map((p, i) => (
                        <p key={i}>
                          {p.includes('scudetto26@gmail.com') &&
                          config.emailOperativa !== 'scudetto26@gmail.com'
                            ? p.replace(/scudetto26@gmail\.com/g, config.emailOperativa)
                            : p}
                        </p>
                      ))}
                    </div>
                  ))}
                </div>

                {step2Error && (
                  <div className="rounded-xl bg-red-50 border-l-4 border-red-600 p-4 flex items-start gap-2.5 text-sm text-red-900">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{step2Error}</span>
                  </div>
                )}

                <label className="rounded-2xl bg-slate-50 border-2 border-slate-200 p-4 sm:p-5 flex items-start gap-3.5 cursor-pointer hover:border-[#0B1F4D] transition-colors">
                  <input
                    type="checkbox"
                    checked={consensoPrivacy}
                    onChange={(e) => {
                      setConsensoPrivacy(e.target.checked);
                      if (e.target.checked) setStep2Error(null);
                    }}
                    className="mt-0.5 w-5 h-5 rounded border-slate-300 text-[#0B1F4D] shrink-0"
                  />
                  <span className="text-sm font-semibold text-[#0B1F4D] leading-relaxed">
                    Ho letto e accetto l&apos;<strong>Informativa Privacy</strong> (v{config.versioneInformativa}) per la mia candidatura. *
                  </span>
                </label>

                <div className="pt-2 flex flex-col-reverse sm:flex-row justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="min-h-[50px] px-6 py-3 rounded-xl border border-slate-300 text-slate-700 text-sm font-bold hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Indietro
                  </button>
                  <button
                    type="button"
                    onClick={handleStep2Next}
                    className="min-h-[52px] px-8 py-3 rounded-2xl bg-[#0B1F4D] text-white text-sm font-black hover:bg-[#153985] transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>PROSEGUI: REGOLAMENTO PDF</span>
                    <ArrowRight className="w-4 h-4 text-[#FDE68A]" />
                  </button>
                </div>
              </div>
            </section>
          </motion.div>
        )}

        {/* STEP 3 — REGOLAMENTO PDF */}
        {step === 3 && (
          <motion.div
            key="step-3"
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <section className="bg-gradient-to-r from-amber-50 via-white to-amber-50/40 border-b border-slate-200 px-4 sm:px-8 py-7">
              <div className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5 text-xs font-black uppercase tracking-[0.2em] text-[#C69214]">
                    <span className="font-mono-tabular text-2xl sm:text-3xl leading-none">03</span>
                    <span>REGOLAMENTO UFFICIALE</span>
                  </div>
                  <h1 className="font-display text-2xl sm:text-3xl font-black text-[#0B1F4D]">
                    REGOLAMENTO PDF · {config.stagione}
                  </h1>
                </div>

                {activeRegolamento?.contenutoTesto?.trim() ? (
                  <button
                    type="button"
                    onClick={handleDownloadRegolamentoPdf}
                    className="min-h-[48px] px-5 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#E7C860] text-[#071436] text-xs sm:text-sm font-black inline-flex items-center justify-center gap-2 shadow-sm cursor-pointer shrink-0"
                  >
                    <Download className="w-4 h-4" />
                    <span>SCARICA REGOLAMENTO PDF</span>
                  </button>
                ) : activeRegolamento?.downloadUrl ? (
                  <a
                    href={activeRegolamento.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[48px] px-5 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#E7C860] text-[#071436] text-xs sm:text-sm font-black inline-flex items-center justify-center gap-2 shadow-sm shrink-0"
                  >
                    <Download className="w-4 h-4" />
                    <span>APRI REGOLAMENTO PDF</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                ) : null}
              </div>
            </section>

            <section className="px-4 sm:px-8 py-7">
              <div className="max-w-4xl mx-auto space-y-5">
                {pdfFeedback && (
                  <p className="text-xs sm:text-sm font-bold text-emerald-700">{pdfFeedback}</p>
                )}

                {docsLoading ? (
                  <div className="py-10 text-center space-y-2">
                    <Loader2 className="w-6 h-6 animate-spin text-[#0B1F4D] mx-auto" />
                    <p className="text-sm text-slate-600">Caricamento del Regolamento ufficiale...</p>
                  </div>
                ) : activeRegolamento && activeRegolamento.contenutoTesto.trim() ? (
                  <div className="border-l-4 border-[#D4AF37] pl-4 sm:pl-6 max-h-[26rem] overflow-y-auto">
                    <RegulationContentView content={activeRegolamento.contenutoTesto} />
                  </div>
                ) : (
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Consulta e scarica il regolamento ufficiale tramite il link disponibile o contatta lo staff all&apos;indirizzo{' '}
                    <strong className="font-mono-tabular text-[#0B1F4D]">{config.emailOperativa}</strong>.
                  </p>
                )}

                {step3Error && (
                  <div className="rounded-xl bg-red-50 border-l-4 border-red-600 p-4 flex items-start gap-2.5 text-sm text-red-900">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{step3Error}</span>
                  </div>
                )}

                <label className="rounded-2xl bg-slate-50 border-2 border-slate-200 p-4 sm:p-5 flex items-start gap-3.5 cursor-pointer hover:border-[#0B1F4D] transition-colors">
                  <input
                    type="checkbox"
                    checked={consensoRegolamento}
                    onChange={(e) => {
                      setConsensoRegolamento(e.target.checked);
                      if (e.target.checked) setStep3Error(null);
                    }}
                    className="mt-0.5 w-5 h-5 rounded border-slate-300 text-[#0B1F4D] shrink-0"
                  />
                  <span className="text-sm font-semibold text-[#0B1F4D] leading-relaxed">
                    Ho letto e accetto il <strong>Regolamento ufficiale FICUP {config.stagione}</strong> (v{regolamentoVersionLabel}). *
                  </span>
                </label>

                <div className="pt-2 flex flex-col-reverse sm:flex-row justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="min-h-[50px] px-6 py-3 rounded-xl border border-slate-300 text-slate-700 text-sm font-bold hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Indietro
                  </button>
                  <button
                    type="button"
                    onClick={handleStep3Next}
                    className="min-h-[52px] px-8 py-3 rounded-2xl bg-[#0B1F4D] text-white text-sm font-black hover:bg-[#153985] transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>PROSEGUI: REGOLE CHAT</span>
                    <ArrowRight className="w-4 h-4 text-[#FDE68A]" />
                  </button>
                </div>
              </div>
            </section>
          </motion.div>
        )}

        {/* STEP 4 — REGOLE CHAT */}
        {step === 4 && (
          <motion.div
            key="step-4"
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <section className="bg-gradient-to-r from-emerald-50 via-white to-emerald-50/40 border-b border-slate-200 px-4 sm:px-8 py-7">
              <div className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5 text-xs font-black uppercase tracking-[0.2em] text-emerald-700">
                    <span className="font-mono-tabular text-2xl sm:text-3xl leading-none">04</span>
                    <span>COMMUNITY WHATSAPP</span>
                  </div>
                  <h1 className="font-display text-2xl sm:text-3xl font-black text-[#0B1F4D]">
                    REGOLE CHAT WHATSAPP (v{chatRulesVersionLabel})
                  </h1>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadChatRulesPdf}
                  className="min-h-[46px] px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-black inline-flex items-center justify-center gap-2 shadow-sm cursor-pointer shrink-0"
                >
                  <Download className="w-4 h-4" />
                  <span>SCARICA REGOLE CHAT PDF</span>
                </button>
              </div>
            </section>

            <section className="px-4 sm:px-8 py-7">
              <div className="max-w-4xl mx-auto space-y-5">
                <div className="border-l-4 border-emerald-600 pl-4 sm:pl-6 max-h-80 overflow-y-auto space-y-4 text-xs sm:text-sm text-slate-700 leading-relaxed">
                  {activeChatRulesDoc && activeChatRulesDoc.contenutoTesto.trim() ? (
                    <div className="whitespace-pre-wrap">
                      {maskSensitiveWhatsappLinks(activeChatRulesDoc.contenutoTesto)}
                    </div>
                  ) : (
                    OFFICIAL_CHAT_RULES_SECTIONS.map((sec) => (
                      <div key={sec.id} className="space-y-1">
                        <h2 className="font-bold text-[#0B1F4D]">{sec.title}</h2>
                        {sec.paragraphs.map((p, idx) => (
                          <p key={idx}>{p}</p>
                        ))}
                      </div>
                    ))
                  )}
                </div>

                {step4Error && (
                  <div className="rounded-xl bg-red-50 border-l-4 border-red-600 p-4 flex items-start gap-2.5 text-sm text-red-900">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{step4Error}</span>
                  </div>
                )}

                <label className="rounded-2xl bg-slate-50 border-2 border-slate-200 p-4 sm:p-5 flex items-start gap-3.5 cursor-pointer hover:border-[#0B1F4D] transition-colors">
                  <input
                    type="checkbox"
                    checked={consensoRegoleChat}
                    onChange={(e) => {
                      setConsensoRegoleChat(e.target.checked);
                      if (e.target.checked) setStep4Error(null);
                    }}
                    className="mt-0.5 w-5 h-5 rounded border-slate-300 text-[#0B1F4D] shrink-0"
                  />
                  <span className="text-sm font-semibold text-[#0B1F4D] leading-relaxed">
                    Accetto le <strong>Regole della Chat WhatsApp FICUP</strong> (v{chatRulesVersionLabel}) e mi impegno a rispettarle. *
                  </span>
                </label>

                <div className="pt-2 flex flex-col-reverse sm:flex-row justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="min-h-[50px] px-6 py-3 rounded-xl border border-slate-300 text-slate-700 text-sm font-bold hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Indietro
                  </button>
                  <button
                    type="button"
                    onClick={handleStep4Next}
                    className="min-h-[52px] px-8 py-3 rounded-2xl bg-[#0B1F4D] text-white text-sm font-black hover:bg-[#153985] transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>PROSEGUI: RIEPILOGO</span>
                    <ArrowRight className="w-4 h-4 text-[#FDE68A]" />
                  </button>
                </div>
              </div>
            </section>
          </motion.div>
        )}

        {/* STEP 5 — RIEPILOGO E INVIO (nessun gergo tecnico) */}
        {step === 5 && (
          <motion.div
            key="step-5"
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {submitting ? (
              <section className="py-16 px-4 text-center space-y-5">
                <motion.div
                  animate={{ rotate: [0, 180, 180, 360] }}
                  transition={{ duration: 2.0, repeat: Infinity, ease: 'easeInOut' }}
                  className="w-16 h-16 rounded-2xl bg-[#0B1F4D] text-[#FDE68A] flex items-center justify-center mx-auto shadow-lg"
                >
                  <Hourglass className="w-8 h-8" />
                </motion.div>
                <div className="space-y-2 max-w-md mx-auto">
                  <h1 className="font-display text-2xl sm:text-3xl font-black text-[#0B1F4D]">
                    {submitStage === 'verifying'
                      ? 'Controllo dei dati...'
                      : 'Invio della candidatura in corso...'}
                  </h1>
                  <p className="text-sm text-slate-600">
                    Stiamo preparando il tuo codice personale FICUP26.
                  </p>
                </div>
              </section>
            ) : (
              <>
                <section className="bg-gradient-to-r from-[#071436] to-[#153985] text-white px-4 sm:px-8 py-7">
                  <div className="max-w-4xl mx-auto space-y-1">
                    <div className="flex items-center gap-2.5 text-xs font-black uppercase tracking-[0.2em] text-[#FDE68A]">
                      <span className="font-mono-tabular text-2xl sm:text-3xl leading-none">05</span>
                      <span>ULTIMO PASSAGGIO PRIMA DELL&apos;INVIO</span>
                    </div>
                    <h1 className="font-display text-2xl sm:text-3xl font-black text-white">
                      Controlla i tuoi dati e invia la candidatura
                    </h1>
                  </div>
                </section>

                <section className="px-4 sm:px-8 py-7">
                  <div className="max-w-4xl mx-auto space-y-6">
                    {submitError && (
                      <div className="rounded-xl bg-red-50 border-l-4 border-red-600 p-4 flex items-start gap-2.5 text-sm text-red-900">
                        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                        <span>{submitError}</span>
                      </div>
                    )}

                    <div className="divide-y divide-slate-200 border-y border-slate-200">
                      <div className="py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          Nome e cognome
                        </span>
                        <span className="text-base font-bold text-[#0B1F4D]">
                          {nome.trim()} {cognome.trim()}
                        </span>
                      </div>
                      <div className="py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          Email Fantaleghe
                        </span>
                        <span className="text-base font-semibold text-[#0284C7] break-all">
                          {emailFantaleghe.trim().toLowerCase()}
                        </span>
                      </div>
                      <div className="py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          Cellulare
                        </span>
                        <span className="text-base font-semibold font-mono-tabular text-[#0B1F4D]">
                          {cellulare.trim()}
                        </span>
                      </div>
                      <div className="py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          Squadra proposta
                        </span>
                        <span className="text-base font-bold text-[#0B1F4D]">
                          {nomeSquadra.trim()}
                        </span>
                      </div>
                      {note.trim() && (
                        <div className="py-3.5 flex flex-col gap-1">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            Note per lo staff
                          </span>
                          <span className="text-sm text-slate-700 whitespace-pre-wrap">
                            {note.trim()}
                          </span>
                        </div>
                      )}
                      <div className="py-3.5 flex flex-wrap gap-x-5 gap-y-1.5 text-xs font-bold text-emerald-700">
                        <span>✓ Privacy accettata</span>
                        <span>✓ Regolamento PDF accettato</span>
                        <span>✓ Regole Chat accettate</span>
                      </div>
                    </div>

                    <div className="pt-2 flex flex-col-reverse sm:flex-row justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="min-h-[50px] px-6 py-3 rounded-xl border border-slate-300 text-slate-700 text-sm font-bold hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        Modifica dati
                      </button>
                      <button
                        type="button"
                        onClick={handleRealSubmit}
                        className="min-h-[54px] px-8 py-3.5 rounded-2xl bg-gradient-to-r from-[#D4AF37] via-[#E7C860] to-[#C69214] text-[#071436] text-sm sm:text-base font-black tracking-wide hover:brightness-105 transition-all inline-flex items-center justify-center gap-2.5 cursor-pointer shadow-lg"
                      >
                        <span>INVIA CANDIDATURA</span>
                        <ArrowRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </section>
              </>
            )}
          </motion.div>
        )}

        {/* STEP 6 — POST-INVIO CHIARO A 3 FASI */}
        {step === 6 && (
          <RecruitmentStep6
            config={config}
            submittedRecord={submittedRecord}
            emailDispatchState={emailDispatchState}
            isAppsScriptReady={isAppsScriptConfigured}
            canRetryEmail={canRetryEmail}
            onRetryEmailNotification={handleRetryEmailNotification}
            onExitToHome={onExitToHome}
            onOpenWaitingRoom={onOpenWaitingRoom}
          />
        )}
      </AnimatePresence>

      <PrivacyModal
        open={privacyModalOpen}
        version={config.versioneInformativa}
        operationalEmail={config.emailOperativa}
        onClose={() => setPrivacyModalOpen(false)}
      />
    </div>
  );
}
