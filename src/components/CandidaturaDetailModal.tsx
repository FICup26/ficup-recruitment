import type { User } from 'firebase/auth';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  FileCheck2,
  History,
  Loader2,
  Mail,
  MessageCircle,
  Phone,
  Send,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  isAppsScriptConfigured,
  triggerCandidaturaNotification,
} from '../lib/appsScriptClient';
import {
  fetchAccettazioneByCandidatura,
  fetchEmailLogsByCandidatura,
  fetchStoricoByCandidatura,
  fetchWhatsappAutorizzazioneByCandidatura,
  fetchWhatsappGruppi,
  getAdminConfig,
  resolveSimplifiedCandidaturaStato,
  saveWhatsappAutorizzazioneByAdmin,
  STATI_CANDIDATURA,
  updateCandidaturaByAdmin,
  type AccettazioneDocumentaleRecord,
  type CandidaturaRecord,
  type CandidaturaStato,
  type EmailLogRecord,
  type SimplifiedCandidaturaStato,
  type StoricoOperazioneRecord,
  type WhatsappAutorizzazioneRecord,
  type WhatsappAutorizzazioneStato,
  type WhatsappGruppoRecord,
} from '../lib/firestore';
import {
  buildNotificationDraft,
  FICUP_OPERATIONAL_EMAIL,
  getSuggestedTemplateForState,
  parseFirestoreUiError,
  type NotificationTemplateKey,
} from '../lib/notifications';

interface CandidaturaDetailModalProps {
  candidatura: CandidaturaRecord | null;
  adminUser: User;
  operationalEmail?: string;
  onClose: () => void;
  onWhatsappAuthChanged?: () => void;
}

export function statusBadgeStyle(stato: CandidaturaStato): string {
  switch (stato) {
    case 'NUOVO':
      return 'bg-blue-50 text-[#0B1F4D] border-blue-200';
    case 'DA CONTATTARE':
      return 'bg-amber-50 text-amber-900 border-amber-200';
    case 'APPROVATO':
      return 'bg-indigo-50 text-indigo-900 border-indigo-200';
    case 'INVITO INVIATO':
      return 'bg-sky-50 text-sky-900 border-sky-200';
    case 'DA COMPLETARE':
      return 'bg-orange-50 text-orange-900 border-orange-200';
    case 'COMPLETATO':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    case 'RESPINTO':
      return 'bg-red-50 text-red-800 border-red-200';
  }
}

export function simplifiedStatusBadgeStyle(stato: SimplifiedCandidaturaStato): string {
  switch (stato) {
    case 'COMPLETATO':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    case 'RESPINTO':
      return 'bg-red-50 text-red-800 border-red-200';
    default:
      return 'bg-amber-50 text-amber-900 border-amber-200';
  }
}

function formatDateTime(date: Date | null): string {
  if (!date) {
    return 'In sincronizzazione...';
  }
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function CandidaturaDetailModal({
  candidatura,
  adminUser,
  operationalEmail = FICUP_OPERATIONAL_EMAIL,
  onClose,
  onWhatsappAuthChanged,
}: CandidaturaDetailModalProps) {
  const [statoNuovo, setStatoNuovo] = useState<CandidaturaStato>('NUOVO');
  const [noteInterne, setNoteInterne] = useState('');
  const [notaOperazione, setNotaOperazione] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [storico, setStorico] = useState<StoricoOperazioneRecord[]>([]);
  const [storicoLoading, setStoricoLoading] = useState(false);
  const [storicoError, setStoricoError] = useState<string | null>(null);

  const [emailLogs, setEmailLogs] = useState<EmailLogRecord[]>([]);
  const [emailLogsLoading, setEmailLogsLoading] = useState(false);
  const [emailLogsError, setEmailLogsError] = useState<string | null>(null);
  const [autoTriggerHint, setAutoTriggerHint] = useState<string | null>(null);

  // Document acceptances state
  const [accettazione, setAccettazione] = useState<AccettazioneDocumentaleRecord | null>(null);
  const [accettazioneLoading, setAccettazioneLoading] = useState(false);
  const [accettazioneError, setAccettazioneError] = useState<string | null>(null);

  // WhatsApp & Team reference authorization state
  const [waGruppi, setWaGruppi] = useState<WhatsappGruppoRecord[]>([]);
  const [waAuthRecord, setWaAuthRecord] = useState<WhatsappAutorizzazioneRecord | null>(null);
  const [waStato, setWaStato] = useState<WhatsappAutorizzazioneStato>('NON_AUTORIZZATO');
  const [waGruppoId, setWaGruppoId] = useState('');
  const [waLinkAssegnato, setWaLinkAssegnato] = useState('');
  const [waSquadraRef, setWaSquadraRef] = useState('');
  const [officialConfigWaLink, setOfficialConfigWaLink] = useState('');
  const [waSaving, setWaSaving] = useState(false);
  const [waSaveMsg, setWaSaveMsg] = useState<string | null>(null);
  const [waError, setWaError] = useState<string | null>(null);

  const [templateKey, setTemplateKey] = useState<NotificationTemplateKey>('APPROVAZIONE');
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedHtmlEmail, setCopiedHtmlEmail] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);

  const refreshEmailLogs = async (candidaturaId: string) => {
    setEmailLogsLoading(true);
    setEmailLogsError(null);
    try {
      const logs = await fetchEmailLogsByCandidatura(candidaturaId);
      setEmailLogs(logs);
    } catch (err) {
      setEmailLogsError(parseFirestoreUiError(err));
    } finally {
      setEmailLogsLoading(false);
    }
  };

  useEffect(() => {
    if (!candidatura) {
      return;
    }
    setStatoNuovo(candidatura.stato);
    setNoteInterne(candidatura.noteInterne);
    setNotaOperazione('');
    setSaveError(null);
    setSaveSuccess(false);
    setAutoTriggerHint(null);
    setTemplateKey(getSuggestedTemplateForState(candidatura.stato));
    setWaSaveMsg(null);
    setWaError(null);
    setCopiedPhone(false);
    setCopiedEmail(false);
    setCopiedHtmlEmail(false);

    let cancelled = false;
    setStoricoLoading(true);
    setStoricoError(null);
    setEmailLogsLoading(true);
    setEmailLogsError(null);
    setAccettazioneLoading(true);
    setAccettazioneError(null);

    fetchStoricoByCandidatura(candidatura.id)
      .then((records) => {
        if (!cancelled) {
          setStorico(records);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setStoricoError(parseFirestoreUiError(err));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setStoricoLoading(false);
        }
      });

    fetchEmailLogsByCandidatura(candidatura.id)
      .then((logs) => {
        if (!cancelled) {
          setEmailLogs(logs);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setEmailLogsError(parseFirestoreUiError(err));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setEmailLogsLoading(false);
        }
      });

    fetchAccettazioneByCandidatura(candidatura.id)
      .then((acc) => {
        if (!cancelled) {
          setAccettazione(acc);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setAccettazioneError(parseFirestoreUiError(err));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAccettazioneLoading(false);
        }
      });

    Promise.all([
      fetchWhatsappGruppi({ silentOnPermissionDenied: true }).catch(
        () => [] as WhatsappGruppoRecord[]
      ),
      fetchWhatsappAutorizzazioneByCandidatura(candidatura.id).catch(() => null),
      getAdminConfig().catch(() => null),
    ]).then(([gruppi, authRec, adminCfg]) => {
      if (!cancelled) {
        setWaGruppi(gruppi);
        setOfficialConfigWaLink(adminCfg?.linkWhatsappUfficiale?.trim() ?? '');
        setWaAuthRecord(authRec);
        if (authRec) {
          setWaStato(authRec.statoAutorizzazione);
          setWaGruppoId(authRec.gruppoId);
          setWaLinkAssegnato(authRec.linkAssegnato);
          setWaSquadraRef(authRec.squadraAssegnataZonaVar);
        } else {
          setWaStato('NON_AUTORIZZATO');
          setWaGruppoId('');
          setWaLinkAssegnato('');
          setWaSquadraRef('');
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [candidatura]);

  if (!candidatura) {
    return null;
  }

  const handleSaveWhatsappAuth = async () => {
    setWaSaving(true);
    setWaSaveMsg(null);
    setWaError(null);
    try {
      const selectedGroup = waGruppi.find((g) => g.id === waGruppoId) ?? null;
      await saveWhatsappAutorizzazioneByAdmin({
        candidaturaId: candidatura.id,
        codiceCandidatura: candidatura.codiceCandidatura,
        statoCandidaturaCorrente: candidatura.stato,
        statoAutorizzazione: waStato,
        gruppoId: selectedGroup?.id ?? waGruppoId,
        gruppoNome: selectedGroup?.nome ?? '',
        linkAssegnato: selectedGroup?.linkInvito ?? '',
        squadraAssegnataZonaVar: waSquadraRef,
        adminUser,
      });
      setWaAuthRecord({
        id: candidatura.id,
        candidaturaId: candidatura.id,
        codiceCandidatura: candidatura.codiceCandidatura,
        statoAutorizzazione: waStato,
        gruppoId: selectedGroup?.id ?? waGruppoId,
        gruppoNome: selectedGroup?.nome ?? '',
        linkAssegnato: selectedGroup?.linkInvito ?? '',
        squadraAssegnataZonaVar: waSquadraRef,
        autorizzatoDaEmail: adminUser.email ?? '',
        createdAt: waAuthRecord?.createdAt ?? new Date(),
        updatedAt: new Date(),
      });
      setWaSaveMsg(
        'Autorizzazione WhatsApp salvata su Firestore e registrata nello storico operazioni.'
      );
      onWhatsappAuthChanged?.();
      const refreshed = await fetchStoricoByCandidatura(candidatura.id).catch(() => null);
      if (refreshed) setStorico(refreshed);
    } catch (err) {
      setWaError(parseFirestoreUiError(err));
    } finally {
      setWaSaving(false);
    }
  };

  const handleSave = async (targetState?: CandidaturaStato, autoNote?: string) => {
    const nextState = targetState ?? statoNuovo;
    const operationNote = (autoNote ?? notaOperazione).trim();

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    setAutoTriggerHint(null);

    try {
      await updateCandidaturaByAdmin({
        candidaturaId: candidatura.id,
        codiceCandidatura: candidatura.codiceCandidatura,
        statoPrecedente: candidatura.stato,
        statoNuovo: nextState,
        noteInterne,
        notaOperazione: operationNote,
        adminUser,
      });

      setStatoNuovo(nextState);
      setNotaOperazione('');
      setSaveSuccess(true);
      setTemplateKey(getSuggestedTemplateForState(nextState));

      if (isAppsScriptConfigured) {
        let idToken: string | undefined;
        try {
          idToken = await adminUser.getIdToken();
        } catch {
          idToken = undefined;
        }
        const res = await triggerCandidaturaNotification({
          candidaturaId: candidatura.id,
          idToken,
        });
        if (res.triggered && res.sent > 0) {
          setAutoTriggerHint(`Email automatica elaborata dal backend Apps Script (${res.sent} invio).`);
        } else if (res.triggered) {
          setAutoTriggerHint('Stato verificato dal backend Apps Script (nessun invio duplicato o non richiesto).');
        } else {
          setAutoTriggerHint('Stato salvato: il trigger periodico Apps Script verificherà l’eventuale notifica.');
        }
      }

      try {
        const refreshed = await fetchStoricoByCandidatura(candidatura.id);
        setStorico(refreshed);
      } catch {
        // Non-blocking refresh error
      }

      await refreshEmailLogs(candidatura.id);
    } catch (err) {
      setSaveError(parseFirestoreUiError(err));
    } finally {
      setSaving(false);
    }
  };

  const selectedWaGroupLink =
    waGruppi.find((g) => g.id === waGruppoId)?.linkInvito?.trim() ||
    waLinkAssegnato.trim() ||
    officialConfigWaLink.trim();

  const simplifiedStato = resolveSimplifiedCandidaturaStato(candidatura, waAuthRecord);

  const isCandidateCompleteForApproval = Boolean(
    candidatura.isCompleta ||
      (accettazione?.privacyAccettata &&
        accettazione?.regolamentoAccettato &&
        candidatura.cellulare.trim().length > 0)
  );

  const draft = buildNotificationDraft(templateKey, candidatura, operationalEmail, {
    officialWhatsappLink: selectedWaGroupLink,
    isVerifiedForWhatsappLink: isCandidateCompleteForApproval,
  });

  const handleCopyPhone = async () => {
    if (!candidatura.cellulare || typeof navigator === 'undefined' || !navigator.clipboard) {
      return;
    }
    try {
      await navigator.clipboard.writeText(candidatura.cellulare);
      setCopiedPhone(true);
      window.setTimeout(() => setCopiedPhone(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleCopyDraft = async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      return;
    }
    const text = `Oggetto: ${draft.subject}\nA: ${draft.to}\n\n${draft.body}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedEmail(true);
      window.setTimeout(() => setCopiedEmail(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleCopyHtmlDraft = async () => {
    if (!draft.htmlBody || typeof navigator === 'undefined' || !navigator.clipboard) {
      return;
    }
    try {
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard.write) {
        const htmlBlob = new Blob([draft.htmlBody], { type: 'text/html' });
        const textBlob = new Blob([draft.body], { type: 'text/plain' });
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': htmlBlob,
            'text/plain': textBlob,
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(draft.htmlBody);
      }
      setCopiedHtmlEmail(true);
      window.setTimeout(() => setCopiedHtmlEmail(false), 2200);
    } catch {
      try {
        await navigator.clipboard.writeText(draft.htmlBody);
        setCopiedHtmlEmail(true);
        window.setTimeout(() => setCopiedHtmlEmail(false), 2200);
      } catch {
        // Ignore clipboard failure
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="detail-modal-title"
    >
      <div className="bg-white w-full sm:max-w-3xl max-h-[92vh] rounded-t-3xl sm:rounded-2xl border border-slate-200 shadow-xl flex flex-col overflow-hidden text-slate-900">
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-3 bg-white">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-mono-tabular font-bold text-[#0B1F4D]">
                {candidatura.codiceCandidatura}
              </span>
              <span aria-hidden="true">·</span>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-md border text-[11px] font-bold ${simplifiedStatusBadgeStyle(
                  simplifiedStato
                )}`}
              >
                {simplifiedStato}
              </span>
            </div>
            <h2
              id="detail-modal-title"
              className="mt-1 font-display text-lg sm:text-xl font-extrabold text-[#0B1F4D] truncate"
            >
              {candidatura.nome} {candidatura.cognome}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi dettagli"
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
          {/* Candidate Metadata */}
          <section className="rounded-xl border border-slate-200 bg-slate-50/70 divide-y divide-slate-200 text-sm">
            <div className="p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <span className="text-xs font-medium text-slate-500">Completezza candidatura</span>
              <span
                className={`text-xs font-bold inline-flex items-center gap-1.5 ${
                  isCandidateCompleteForApproval ? 'text-emerald-700' : 'text-amber-800'
                }`}
              >
                {isCandidateCompleteForApproval ? (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Completa (dati, +39 e consensi verificabili)</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Da verificare (dati o cellulare +39 incompleti / pregressi)</span>
                  </>
                )}
              </span>
            </div>
            <div className="p-3.5 flex flex-col sm:flex-row sm:justify-between gap-1">
              <span className="text-xs font-medium text-slate-500">Email Fantaleghe</span>
              <span className="font-semibold text-[#0B1F4D] break-all">
                {candidatura.emailFantaleghe}
              </span>
            </div>
            <div className="p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <span className="text-xs font-medium text-slate-500 inline-flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>Numero di cellulare</span>
              </span>
              {candidatura.cellulare ? (
                <div className="flex items-center gap-2">
                  <span className="font-mono-tabular font-bold text-[#0B1F4D]">
                    {candidatura.cellulare}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyPhone}
                    className="min-h-[32px] px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-[11px] font-semibold text-[#0B1F4D] hover:bg-slate-100 inline-flex items-center gap-1 cursor-pointer"
                  >
                    {copiedPhone ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-700" />
                        <span>Copiato</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copia</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <span className="text-xs font-semibold text-amber-800">
                  Non presente (candidatura precedente o incompleta)
                </span>
              )}
            </div>
            <div className="p-3.5 flex flex-col sm:flex-row sm:justify-between gap-1">
              <span className="text-xs font-medium text-slate-500">Squadra attuale</span>
              <span className="font-semibold text-slate-900">{candidatura.nomeSquadra}</span>
            </div>
            <div className="p-3.5 flex flex-col sm:flex-row sm:justify-between gap-1">
              <span className="text-xs font-medium text-slate-500">Data invio / Ultima modifica</span>
              <span className="font-mono-tabular text-xs text-slate-700">
                {formatDateTime(candidatura.createdAt)} · Agg. {formatDateTime(candidatura.updatedAt)}
              </span>
            </div>
            <div className="p-3.5 flex flex-col sm:flex-row sm:justify-between gap-1">
              <span className="text-xs font-medium text-slate-500">Privacy &amp; Regolamento</span>
              <span className="text-xs font-semibold text-emerald-700">
                Privacy v{candidatura.versioneInformativa}
                {candidatura.regolamentoAccettatoNote
                  ? ` · ${candidatura.regolamentoAccettatoNote}`
                  : ''}
              </span>
            </div>
            {candidatura.note && (
              <div className="p-3.5 space-y-1">
                <span className="block text-xs font-medium text-slate-500">
                  Note del candidato
                </span>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{candidatura.note}</p>
              </div>
            )}
          </section>

          {/* Workflow & Status Update */}
          <section className="space-y-4">
            <h3 className="text-sm font-bold text-[#0B1F4D]">
              Gestione stato e note interne (solo staff)
            </h3>

            {saveError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 flex items-start gap-2 text-xs sm:text-sm text-red-800">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{saveError}</span>
              </div>
            )}

            {saveSuccess && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 flex items-start gap-2 text-xs sm:text-sm text-emerald-800">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p>Stato e note salvati su Firestore e registrati nello storico operazioni.</p>
                  {autoTriggerHint && <p className="text-xs text-emerald-900">{autoTriggerHint}</p>}
                </div>
              </div>
            )}

            {/* Quick Actions — 3 Stati Principali Semplificati */}
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    handleSave('DA CONTATTARE', 'Pratica contrassegnata Da verificare dallo staff')
                  }
                  className={`min-h-[42px] px-4 py-2 rounded-xl border text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 ${
                    simplifiedStato === 'DA VERIFICARE'
                      ? 'bg-amber-700 border-amber-700 text-white'
                      : 'bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100'
                  }`}
                >
                  Da verificare
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSave('COMPLETATO', 'Ingresso completato e verificato')}
                  className={`min-h-[42px] px-4 py-2 rounded-xl border text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 ${
                    simplifiedStato === 'COMPLETATO'
                      ? 'bg-emerald-700 border-emerald-700 text-white'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                  }`}
                >
                  Completato
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSave('RESPINTO', 'Candidatura respinta dallo staff')}
                  className={`min-h-[42px] px-4 py-2 rounded-xl border text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 ${
                    simplifiedStato === 'RESPINTO'
                      ? 'bg-red-700 border-red-700 text-white'
                      : 'bg-red-50 border-red-200 text-red-800 hover:bg-red-100'
                  }`}
                >
                  Respinto
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                Lo stato visibile passa a <strong>COMPLETATO</strong> quando la candidatura è completata con autorizzazione WhatsApp attiva (stato tecnico corrente:{' '}
                <span className="font-mono-tabular font-semibold text-[#0B1F4D]">
                  {candidatura.stato}
                </span>
                ).
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label
                  htmlFor="admin-nota-operazione"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Nota per lo storico (facoltativa)
                </label>
                <input
                  id="admin-nota-operazione"
                  type="text"
                  maxLength={1000}
                  value={notaOperazione}
                  onChange={(e) => setNotaOperazione(e.target.value)}
                  placeholder="Motivo del cambio stato..."
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B1F4D]/20"
                />
              </div>

              <details className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <summary className="cursor-pointer text-xs font-semibold text-slate-600 hover:text-[#0B1F4D]">
                  Stato tecnico avanzato Apps Script (opzionale per invii automatici)
                </summary>
                <div className="mt-3">
                  <label
                    htmlFor="admin-stato-select"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Stato operativo dettagliato
                  </label>
                  <select
                    id="admin-stato-select"
                    value={statoNuovo}
                    onChange={(e) => setStatoNuovo(e.target.value as CandidaturaStato)}
                    className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#0B1F4D]/20"
                  >
                    {STATI_CANDIDATURA.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </details>
            </div>

            <div>
              <label
                htmlFor="admin-note-interne"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Note interne staff (non visibili al candidato)
              </label>
              <textarea
                id="admin-note-interne"
                rows={3}
                maxLength={2000}
                value={noteInterne}
                onChange={(e) => setNoteInterne(e.target.value)}
                placeholder="Appunti interni dello staff..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B1F4D]/20"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSave()}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#0B1F4D] text-white text-sm font-bold hover:bg-[#153985] disabled:opacity-50 transition-colors inline-flex items-center gap-2 cursor-pointer"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Salva stato e note</span>
              </button>
            </div>
          </section>

          {/* Accettazioni Documentali Registrate */}
          <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-[#C69214]" />
              <h3 className="text-sm font-bold text-[#0B1F4D]">
                Accettazioni documenti obbligatori (<span className="font-mono-tabular">accettazioni_documenti</span>)
              </h3>
            </div>

            {accettazioneLoading ? (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Caricamento registro accettazioni...</span>
              </div>
            ) : accettazioneError ? (
              <p className="text-xs text-amber-800">
                Raccolta <span className="font-mono-tabular">accettazioni_documenti</span> non ancora leggibile ({accettazioneError}).
              </p>
            ) : accettazione ? (
              <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200 text-xs">
                <div className="p-3 flex flex-wrap justify-between gap-2">
                  <span className="text-slate-600">Informativa Privacy GDPR</span>
                  <span className="font-mono-tabular font-semibold text-emerald-700">
                    {accettazione.privacyAccettata ? 'Accettata' : 'No'} · v{accettazione.versionePrivacy}
                  </span>
                </div>
                <div className="p-3 flex flex-wrap justify-between gap-2">
                  <span className="text-slate-600">Regolamento ufficiale FICUP</span>
                  <span className="font-mono-tabular font-semibold text-emerald-700">
                    {accettazione.regolamentoAccettato ? 'Accettato' : 'No'} · v{accettazione.versioneRegolamento}
                  </span>
                </div>
                <div className="p-3 flex flex-wrap justify-between gap-2">
                  <span className="text-slate-600">Regole Chat WhatsApp Ufficiale</span>
                  <span className="font-mono-tabular font-semibold text-emerald-700">
                    {accettazione.regoleChatAccettate ? 'Accettate' : 'No'} · v{accettazione.versioneRegoleChat}
                  </span>
                </div>
                <div className="p-3 flex flex-wrap justify-between gap-2 text-slate-500">
                  <span>Timestamp registrazione</span>
                  <span className="font-mono-tabular">{formatDateTime(accettazione.acceptedAt)}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-600">
                Nessun record separato in <span className="font-mono-tabular">accettazioni_documenti</span> (candidatura precedente all&apos;attivazione o in attesa di regole pubblicate). Consenso Privacy base: v{candidatura.versioneInformativa}.
              </p>
            )}
          </section>

          {/* Autorizzazione WhatsApp & Riferimento Squadra */}
          <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-emerald-700" />
              <h3 className="text-sm font-bold text-[#0B1F4D]">
                Autorizzazione WhatsApp &amp; Squadra assegnata
              </h3>
            </div>

            {waError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                {waError}
              </div>
            )}
            {waSaveMsg && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                {waSaveMsg}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Stato autorizzazione WhatsApp
                </label>
                <select
                  value={waStato}
                  onChange={(e) => setWaStato(e.target.value as WhatsappAutorizzazioneStato)}
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm text-slate-900"
                >
                  <option value="NON_AUTORIZZATO">NON_AUTORIZZATO</option>
                  <option value="IN_ATTESA">IN_ATTESA</option>
                  <option value="AUTORIZZATO">AUTORIZZATO</option>
                  <option value="REVOCATO">REVOCATO</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Gruppo WhatsApp associato
                </label>
                <select
                  value={waGruppoId}
                  onChange={(e) => setWaGruppoId(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm text-slate-900"
                >
                  <option value="">Gruppo predefinito (configurazione/private)</option>
                  {waGruppi
                    .filter((g) => g.attivo)
                    .map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.nome} ({g.categoria})
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Riferimento squadra (nota manuale — integrazione live Zona VAR ficup-c9186 non ancora collegata)
              </label>
              <input
                type="text"
                maxLength={120}
                value={waSquadraRef}
                onChange={(e) => setWaSquadraRef(e.target.value)}
                placeholder="Es. Slot squadra assegnato..."
                className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm text-slate-900"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <span className="text-[11px] text-slate-500">
                Nota: lo sblocco pubblico in Area Personale richiede anche stato <strong>COMPLETATO</strong>.
              </span>
              <button
                type="button"
                disabled={waSaving}
                onClick={handleSaveWhatsappAuth}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer"
              >
                {waSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Salva autorizzazione WhatsApp</span>
              </button>
            </div>
          </section>

          {/* Email Automation Status + Manual Fallback Draft */}
          <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#0B1F4D]" />
                <h3 className="text-sm font-bold text-[#0B1F4D]">
                  Registro invii email automatici ({operationalEmail})
                </h3>
              </div>
              <select
                aria-label="Seleziona modello email"
                value={templateKey}
                onChange={(e) => setTemplateKey(e.target.value as NotificationTemplateKey)}
                className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-medium text-slate-800"
              >
                <option value="CONFERMA_RICEZIONE_CANDIDATO">Conferma ricezione candidato</option>
                <option value="APPROVAZIONE">Notifica approvazione</option>
                <option value="INVITO_INVIATO">Comunicazione invito inviato</option>
                <option value="COMPLETAMENTO">Comunicazione completamento</option>
                <option value="NUOVA_CANDIDATURA_STAFF">Notifica nuova candidatura (Staff)</option>
              </select>
            </div>

            {/* Real email_logs from Firestore */}
            {emailLogsLoading ? (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Caricamento registro email_logs...</span>
              </div>
            ) : emailLogsError ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                Registro <span className="font-mono-tabular">email_logs</span> non leggibile dal pannello admin ({emailLogsError}). Verifica che la regola di sola lettura per <span className="font-mono-tabular">email_logs</span> sia pubblicata su Firestore.
              </div>
            ) : emailLogs.length === 0 ? (
              <p className="text-xs text-slate-600">
                Nessun log in <span className="font-mono-tabular">email_logs</span> registrato finora per questa candidatura.
                {!isAppsScriptConfigured &&
                  ' (Collega VITE_APPS_SCRIPT_WEBAPP_URL e attiva il trigger in Apps Script per gli invii automatici.)'}
              </p>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200">
                {emailLogs.map((log) => (
                  <div key={log.id} className="p-3 text-xs space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono-tabular font-bold text-[#0B1F4D]">
                        {log.eventType}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded font-mono-tabular text-[11px] font-bold border ${
                          log.status === 'SENT'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : log.status === 'PROCESSING'
                              ? 'bg-sky-50 text-[#0284C7] border-sky-200'
                              : log.status === 'SKIPPED_QUOTA'
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-red-50 text-red-700 border-red-200'
                        }`}
                      >
                        {log.status} · tentativi {log.attempts}/{log.maxAttempts}
                      </span>
                    </div>
                    <p className="text-slate-600 break-all">
                      A: <strong>{log.recipient}</strong> · {formatDateTime(log.sentAt ?? log.updatedAt)}
                    </p>
                    {log.lastError && (
                      <p className="text-red-700 break-words">Errore: {log.lastError}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <details className="pt-1" open={templateKey === 'APPROVAZIONE'}>
              <summary className="cursor-pointer text-xs font-semibold text-[#0284C7] hover:text-[#0B1F4D]">
                Bozza email manuale e invito WhatsApp ufficiale (copia testo, HTML Gmail o client email)
              </summary>
              <div className="mt-2.5 space-y-3">
                {templateKey === 'APPROVAZIONE' && !isCandidateCompleteForApproval && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                    Candidatura contrassegnata <strong>Da verificare</strong>: il link WhatsApp ufficiale non viene inserito nella bozza finché i dati obbligatori (+39 incluso) non sono verificati.
                  </div>
                )}

                {templateKey === 'APPROVAZIONE' &&
                  isCandidateCompleteForApproval &&
                  !draft.hasOfficialWhatsappLink && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                      Link WhatsApp ufficiale non configurato in{' '}
                      <span className="font-mono-tabular">Configurazione</span> o{' '}
                      <span className="font-mono-tabular">Accessi WhatsApp</span>: verrà mostrato nella bozza appena configurato.
                    </div>
                  )}

                <div className="bg-white border border-slate-200 rounded-xl p-3 text-xs text-slate-700 space-y-1.5">
                  <p>
                    <strong>A:</strong> {draft.to}
                  </p>
                  <p>
                    <strong>Oggetto:</strong> {draft.subject}
                  </p>
                  <pre className="pt-1.5 border-t border-slate-100 whitespace-pre-wrap font-sans text-xs text-slate-600">
                    {draft.body}
                  </pre>

                  {draft.hasOfficialWhatsappLink && selectedWaGroupLink && (
                    <div className="mt-2 pt-3 border-t border-slate-100 flex flex-col items-start gap-2">
                      <span className="text-[11px] font-semibold text-emerald-800">
                        Anteprima pulsante Gmail / mobile incluso nella versione HTML:
                      </span>
                      <a
                        href={selectedWaGroupLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-emerald-700 text-white text-xs font-bold tracking-wide"
                      >
                        ENTRA NEL GRUPPO WHATSAPP UFFICIALE
                      </a>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleCopyDraft}
                    className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-[#0B1F4D] hover:bg-slate-50 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedEmail ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Testo copiato</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copia testo email</span>
                      </>
                    )}
                  </button>

                  {draft.htmlBody && (
                    <button
                      type="button"
                      onClick={handleCopyHtmlDraft}
                      className="min-h-[40px] px-3.5 py-2 rounded-xl border border-emerald-300 bg-emerald-50 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      {copiedHtmlEmail ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-700" />
                          <span>Email HTML copiata (incolla in Gmail)</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copia email HTML (Gmail)</span>
                        </>
                      )}
                    </button>
                  )}

                  <a
                    href={draft.mailtoHref}
                    className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#0B1F4D] text-white text-xs font-semibold hover:bg-[#153985] inline-flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5 text-[#D4AF37]" />
                    <span>Apri nel client email</span>
                  </a>
                </div>
              </div>
            </details>
          </section>

          {/* Audit History Section */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-[#0B1F4D]" />
              <h3 className="text-sm font-bold text-[#0B1F4D]">Storico operazioni (immutabile)</h3>
            </div>

            {storicoLoading ? (
              <div className="py-4 flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Caricamento storico da Firestore...</span>
              </div>
            ) : storicoError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                {storicoError}
              </div>
            ) : storico.length === 0 ? (
              <p className="text-xs text-slate-500 italic">
                Nessuna modifica di stato registrata finora per questa candidatura.
              </p>
            ) : (
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-200">
                {storico.map((entry) => (
                  <div key={entry.id} className="p-3 text-xs space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-[#0B1F4D]">
                        {entry.statoPrecedente} → {entry.statoNuovo}
                      </span>
                      <span className="font-mono-tabular text-slate-500 inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDateTime(entry.createdAt)}
                      </span>
                    </div>
                    <p className="text-slate-600">
                      Operatore: <span className="font-medium">{entry.adminEmail}</span>
                    </p>
                    {entry.notaOperazione && (
                      <p className="text-slate-700">{entry.notaOperazione}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
