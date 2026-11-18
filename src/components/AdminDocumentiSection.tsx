import type { User } from 'firebase/auth';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Save,
} from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  REGOLAMENTO_TESTO_MAX_LENGTH,
  deactivateActiveRegolamentoVersion,
  fetchActivePublicDocument,
  fetchDocumentiUfficialiHistory,
  saveActiveChatRulesDocument,
  saveRegolamentoTextVersion,
  setActiveRegolamentoVersion,
  type DocumentoUfficialeRecord,
} from '../lib/firestore';
import { parseFirestoreUiError } from '../lib/notifications';
import { CHAT_RULES_VERSION, OFFICIAL_CHAT_RULES_SECTIONS } from '../lib/officialDocuments';
import { RegulationContentView } from './RegulationContentView';

interface AdminDocumentiSectionProps {
  adminUser: User;
}

function formatDate(d: Date | null): string {
  if (!d) return '—';
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

function suggestNextVersion(currentVersion: string): string {
  const clean = currentVersion.trim();
  const match = clean.match(/^(.*?)(\d+)$/);
  if (match && match[2]) {
    const nextNum = Number.parseInt(match[2], 10) + 1;
    return `${match[1]}${nextNum}`;
  }
  return clean ? `${clean}.1` : '2026.1';
}

export function AdminDocumentiSection({ adminUser }: AdminDocumentiSectionProps) {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<DocumentoUfficialeRecord[]>([]);
  const [activeReg, setActiveReg] = useState<DocumentoUfficialeRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Textual Regulation Editor State
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [titolo, setTitolo] = useState('Regolamento Ufficiale FICUP 26/27');
  const [versione, setVersione] = useState('2026.1');
  const [dataPubblicazione, setDataPubblicazione] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [regText, setRegText] = useState('');
  const [editorMode, setEditorMode] = useState<'write' | 'preview'>('write');
  const [setAsActive, setSetAsActive] = useState(true);
  const [sourceVersionLabel, setSourceVersionLabel] = useState<string | null>(null);
  const [savingReg, setSavingReg] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // History consulting & status toggling
  const [inspectedHistoryId, setInspectedHistoryId] = useState<string | null>(null);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [pendingActionConfirm, setPendingActionConfirm] = useState<{
    type: 'ACTIVATE' | 'DEACTIVATE';
    record: DocumentoUfficialeRecord;
  } | null>(null);

  // Chat Rules Override Editor
  const [chatRulesTitolo, setChatRulesTitolo] = useState(
    'Regole della Chat WhatsApp Ufficiale FICUP'
  );
  const [chatRulesVersion, setChatRulesVersion] = useState(CHAT_RULES_VERSION);
  const [chatRulesText, setChatRulesText] = useState(() =>
    OFFICIAL_CHAT_RULES_SECTIONS.map(
      (s) => `${s.title}\n${s.paragraphs.join('\n')}`
    ).join('\n\n')
  );
  const [savingChatRules, setSavingChatRules] = useState(false);
  const [chatRulesSuccess, setChatRulesSuccess] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [hist, activePointer, chatPointer] = await Promise.all([
        fetchDocumentiUfficialiHistory(),
        fetchActivePublicDocument('regolamento_attivo'),
        fetchActivePublicDocument('regole_chat_attive'),
      ]);
      setHistory(hist);
      setActiveReg(activePointer);
      if (chatPointer && chatPointer.contenutoTesto.trim()) {
        setChatRulesTitolo(chatPointer.titolo || 'Regole della Chat WhatsApp Ufficiale FICUP');
        setChatRulesVersion(chatPointer.versione || CHAT_RULES_VERSION);
        setChatRulesText(chatPointer.contenutoTesto);
      }
    } catch (err) {
      setError(parseFirestoreUiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const insertFormatLine = (prefix: string, placeholder: string) => {
    const el = textareaRef.current;
    if (!el) {
      const sep = regText && !regText.endsWith('\n') ? '\n' : '';
      setRegText(`${regText}${sep}${prefix}${placeholder}\n`);
      return;
    }

    const start = el.selectionStart ?? regText.length;
    const end = el.selectionEnd ?? regText.length;
    const selected = regText.slice(start, end).trim();
    const needsLeadingNewline = start > 0 && regText[start - 1] !== '\n';
    const insertion = `${needsLeadingNewline ? '\n' : ''}${prefix}${selected || placeholder}\n`;
    const nextValue = `${regText.slice(0, start)}${insertion}${regText.slice(end)}`;
    setRegText(nextValue);

    window.requestAnimationFrame(() => {
      el.focus();
      const cursorPos = start + insertion.length;
      el.setSelectionRange(cursorPos, cursorPos);
    });
  };

  const handleLoadIntoEditor = (record: DocumentoUfficialeRecord) => {
    setTitolo(record.titolo || 'Regolamento Ufficiale FICUP 26/27');
    setVersione(suggestNextVersion(record.versione));
    setDataPubblicazione(new Date().toISOString().slice(0, 10));
    setRegText(record.contenutoTesto || '');
    setSourceVersionLabel(record.versione);
    setEditorMode('write');
    setError(null);
    setSaveSuccess(null);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleResetEditor = () => {
    setTitolo('Regolamento Ufficiale FICUP 26/27');
    setVersione('2026.1');
    setDataPubblicazione(new Date().toISOString().slice(0, 10));
    setRegText('');
    setSourceVersionLabel(null);
    setEditorMode('write');
    setError(null);
  };

  const trimmedLength = regText.trim().length;
  const overLengthLimit = trimmedLength > REGOLAMENTO_TESTO_MAX_LENGTH;

  const handleSaveRegolamento = async (e: FormEvent) => {
    e.preventDefault();
    if (savingReg) return;

    setError(null);
    setSaveSuccess(null);

    if (!titolo.trim()) {
      setError('Inserisci un titolo per il Regolamento ufficiale.');
      return;
    }
    if (!versione.trim()) {
      setError('Inserisci il numero di versione.');
      return;
    }
    if (!trimmedLength) {
      setError('Inserisci il testo del Regolamento prima di salvare.');
      return;
    }
    if (overLengthLimit) {
      setError(
        `Il testo supera il limite massimo consentito dalle regole Firestore (${REGOLAMENTO_TESTO_MAX_LENGTH.toLocaleString('it-IT')} caratteri). Riduci di ${(trimmedLength - REGOLAMENTO_TESTO_MAX_LENGTH).toLocaleString('it-IT')} caratteri.`
      );
      return;
    }

    setSavingReg(true);
    try {
      const created = await saveRegolamentoTextVersion({
        titolo,
        versione,
        dataPubblicazione,
        contenutoTesto: regText,
        setAsActive,
        adminUser,
      });
      setSourceVersionLabel(null);
      setSaveSuccess(
        setAsActive
          ? `Regolamento "${created.titolo}" (v${created.versione}) salvato su Firestore e pubblicato come versione attiva per i candidati.`
          : `Bozza "${created.titolo}" (v${created.versione}) salvata nello storico Firestore senza pubblicazione pubblica.`
      );
      await loadData();
    } catch (err) {
      setError(parseFirestoreUiError(err));
    } finally {
      setSavingReg(false);
    }
  };

  const executeConfirmedAction = async () => {
    if (!pendingActionConfirm) return;
    const { type, record } = pendingActionConfirm;
    setPendingActionConfirm(null);
    setActivatingId(record.id);
    setError(null);
    setSaveSuccess(null);

    try {
      if (type === 'ACTIVATE') {
        await setActiveRegolamentoVersion(record, adminUser);
        setSaveSuccess(
          `Versione v${record.versione} ("${record.titolo}") pubblicata come Regolamento attivo.`
        );
      } else {
        await deactivateActiveRegolamentoVersion(record, adminUser);
        setSaveSuccess(
          `Pubblicazione di v${record.versione} ("${record.titolo}") disattivata: il documento resta nello storico ma non è più pubblico.`
        );
      }
      await loadData();
    } catch (err) {
      setError(parseFirestoreUiError(err));
    } finally {
      setActivatingId(null);
    }
  };

  const handleSaveChatRules = async (e: FormEvent) => {
    e.preventDefault();
    setSavingChatRules(true);
    setError(null);
    setChatRulesSuccess(null);
    try {
      await saveActiveChatRulesDocument({
        titolo: chatRulesTitolo,
        versione: chatRulesVersion,
        contenutoTesto: chatRulesText,
        adminUser,
      });
      setChatRulesSuccess(
        `Regole Chat WhatsApp (v${chatRulesVersion}) aggiornate in documenti_ufficiali/regole_chat_attive.`
      );
      await loadData();
    } catch (err) {
      setError(parseFirestoreUiError(err));
    } finally {
      setSavingChatRules(false);
    }
  };

  const regHistory = history.filter((h) => h.tipo === 'REGOLAMENTO');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#C69214]">
            Gestione documentale · Cloud Firestore
          </p>
          <h2 className="mt-0.5 font-display text-xl font-extrabold text-[#0B1F4D]">
            DOCUMENTI UFFICIALI FICUP
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-600">
            Scrivi, verifica in anteprima e pubblica le versioni testuali del Regolamento ufficiale direttamente su Firestore, e aggiorna le Regole della Chat WhatsApp.
          </p>
        </div>
        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Aggiorna</span>
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 flex items-start gap-2.5 text-xs sm:text-sm text-red-900">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {saveSuccess && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 flex items-start gap-2.5 text-xs sm:text-sm text-emerald-900">
          <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {pendingActionConfirm && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 sm:p-5 space-y-3 text-xs sm:text-sm text-amber-950">
          <p className="font-bold text-[#0B1F4D]">
            {pendingActionConfirm.type === 'DEACTIVATE'
              ? `Confermi la disattivazione del Regolamento v${pendingActionConfirm.record.versione}?`
              : `Confermi la pubblicazione del Regolamento v${pendingActionConfirm.record.versione}?`}
          </p>
          <p>
            {pendingActionConfirm.type === 'DEACTIVATE'
              ? 'La versione resterà conservata nello storico su Cloud Firestore, ma verrà rimossa dalla consultazione pubblica dei candidati.'
              : 'La versione selezionata verrà resa visibile pubblicamente ai candidati nel percorso di candidatura e qualsiasi versione attiva precedente verrà disattivata nello storico.'}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={executeConfirmedAction}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-[#0B1F4D] text-white text-xs font-bold hover:bg-[#153985] cursor-pointer"
            >
              Conferma operazione
            </button>
            <button
              type="button"
              onClick={() => setPendingActionConfirm(null)}
              className="min-h-[40px] px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
            >
              Annulla
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Editor Testuale Regolamento Ufficiale */}
        <form
          onSubmit={handleSaveRegolamento}
          className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-[#C69214]" />
              <h3 className="font-display text-base font-bold text-[#0B1F4D]">
                EDITOR REGOLAMENTO TESTUALE
              </h3>
            </div>
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => setEditorMode('write')}
                className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                  editorMode === 'write'
                    ? 'bg-[#0B1F4D] text-white shadow-xs'
                    : 'text-slate-600 hover:text-[#0B1F4D]'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Scrivi</span>
              </button>
              <button
                type="button"
                onClick={() => setEditorMode('preview')}
                className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                  editorMode === 'preview'
                    ? 'bg-[#0B1F4D] text-white shadow-xs'
                    : 'text-slate-600 hover:text-[#0B1F4D]'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Anteprima</span>
              </button>
            </div>
          </div>

          {sourceVersionLabel && (
            <div className="rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-sky-950">
              <span>
                Bozza caricata da <strong>v{sourceVersionLabel}</strong>: il salvataggio creerà una nuova versione nello storico senza sovrascrivere le precedenti.
              </span>
              <button
                type="button"
                onClick={handleResetEditor}
                className="font-bold underline underline-offset-2 text-[#0B1F4D] cursor-pointer"
              >
                Svuota bozza
              </button>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Titolo documento *
            </label>
            <input
              type="text"
              required
              maxLength={120}
              value={titolo}
              onChange={(e) => setTitolo(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Numero versione *
              </label>
              <input
                type="text"
                required
                maxLength={32}
                value={versione}
                onChange={(e) => setVersione(e.target.value)}
                placeholder="es. 2026.2"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-mono-tabular"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Data pubblicazione *
              </label>
              <input
                type="date"
                required
                value={dataPubblicazione}
                onChange={(e) => setDataPubblicazione(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-mono-tabular"
              />
            </div>
          </div>

          {editorMode === 'write' ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Contenuto integrale del Regolamento *
                </label>
                <span
                  className={`font-mono-tabular text-[11px] font-semibold ${
                    overLengthLimit ? 'text-red-700' : 'text-slate-500'
                  }`}
                >
                  {trimmedLength.toLocaleString('it-IT')} /{' '}
                  {REGOLAMENTO_TESTO_MAX_LENGTH.toLocaleString('it-IT')} caratteri
                </span>
              </div>

              {/* Mobile-friendly touch toolbar for headings and lists */}
              <div className="flex flex-wrap gap-1.5 p-2 rounded-xl border border-slate-200 bg-slate-50">
                <button
                  type="button"
                  onClick={() => insertFormatLine('# ', 'Titolo sezione')}
                  className="min-h-[38px] px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-[#0B1F4D] hover:bg-slate-100 active:scale-[0.98] inline-flex items-center gap-1 cursor-pointer"
                >
                  <Heading1 className="w-3.5 h-3.5 text-[#C69214]" />
                  <span>Titolo</span>
                </button>
                <button
                  type="button"
                  onClick={() => insertFormatLine('## ', 'Sottotitolo')}
                  className="min-h-[38px] px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-[#0B1F4D] hover:bg-slate-100 active:scale-[0.98] inline-flex items-center gap-1 cursor-pointer"
                >
                  <Heading2 className="w-3.5 h-3.5 text-[#0284C7]" />
                  <span>Sottotitolo</span>
                </button>
                <button
                  type="button"
                  onClick={() => insertFormatLine('- ', 'Punto elenco')}
                  className="min-h-[38px] px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-[#0B1F4D] hover:bg-slate-100 active:scale-[0.98] inline-flex items-center gap-1 cursor-pointer"
                >
                  <List className="w-3.5 h-3.5 text-[#C69214]" />
                  <span>Elenco</span>
                </button>
                <button
                  type="button"
                  onClick={() => insertFormatLine('1. ', 'Punto numerato')}
                  className="min-h-[38px] px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-[#0B1F4D] hover:bg-slate-100 active:scale-[0.98] inline-flex items-center gap-1 cursor-pointer"
                >
                  <ListOrdered className="w-3.5 h-3.5 text-[#0284C7]" />
                  <span>Numerato</span>
                </button>
              </div>

              <textarea
                ref={textareaRef}
                rows={12}
                value={regText}
                onChange={(e) => setRegText(e.target.value)}
                placeholder={`# Art. 1 — Principi generali\n## Iscrizione e partecipazione\nScrivi qui i paragrafi del regolamento ufficiale...\n\n- Prima regola\n- Seconda regola\n\n1. Primo passaggio\n2. Secondo passaggio`}
                className={`w-full min-h-[260px] px-3.5 py-3 rounded-xl border text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#0B1F4D]/20 ${
                  overLengthLimit
                    ? 'border-red-400 bg-red-50/40'
                    : 'border-slate-300 bg-white focus:border-[#0B1F4D]'
                }`}
              />

              <p className="text-[11px] text-slate-500 leading-relaxed">
                Suggerimento: usa <span className="font-mono-tabular font-semibold"># </span> per i titoli,{' '}
                <span className="font-mono-tabular font-semibold">## </span> per i sottotitoli,{' '}
                <span className="font-mono-tabular font-semibold">- </span> o{' '}
                <span className="font-mono-tabular font-semibold">1. </span> per gli elenchi. Controlla la scheda <strong>Anteprima</strong> prima di pubblicare.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <div className="border-b border-slate-200 pb-2.5 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#C69214]">
                    Anteprima resa candidato
                  </p>
                  <p className="font-display text-base font-extrabold text-[#0B1F4D]">
                    {titolo || 'Regolamento Ufficiale'}
                  </p>
                </div>
                <span className="font-mono-tabular text-xs font-semibold text-slate-600">
                  v{versione || '—'} · {dataPubblicazione || '—'}
                </span>
              </div>
              <div className="max-h-[340px] overflow-y-auto pr-1">
                <RegulationContentView
                  content={regText}
                  emptyMessage="Scrivi il testo nella scheda 'Scrivi' per visualizzare qui l’anteprima impaginata."
                />
              </div>
            </div>
          )}

          <label className="flex items-start gap-2.5 cursor-pointer text-xs sm:text-sm text-slate-800 pt-1">
            <input
              type="checkbox"
              checked={setAsActive}
              disabled={savingReg}
              onChange={(e) => setSetAsActive(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-slate-300 text-[#0B1F4D] shrink-0"
            />
            <span>Pubblica immediatamente questa versione come attiva per i candidati</span>
          </label>

          <button
            type="submit"
            disabled={savingReg || overLengthLimit}
            className="min-h-[48px] w-full px-5 py-2.5 rounded-xl bg-[#0B1F4D] text-white text-sm font-bold hover:bg-[#153985] disabled:opacity-50 inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            {savingReg ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4 text-[#D4AF37]" />
            )}
            <span>
              {savingReg
                ? 'SALVATAGGIO SU FIRESTORE...'
                : setAsActive
                  ? 'SALVA E PUBBLICA REGOLAMENTO'
                  : 'SALVA BOZZA NELLO STORICO'}
            </span>
          </button>
        </form>

        {/* Versione Attualmente Attiva */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#0284C7]" />
              <h3 className="font-display text-base font-bold text-[#0B1F4D]">
                Versione attualmente attiva
              </h3>
            </div>
            {activeReg && (
              <span className="font-mono-tabular text-xs font-bold text-emerald-700 px-2.5 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200">
                v{activeReg.versione}
              </span>
            )}
          </div>

          {activeReg ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs space-y-1">
                <p className="font-bold text-[#0B1F4D] text-sm">{activeReg.titolo}</p>
                <p className="font-mono-tabular text-slate-600">
                  Versione {activeReg.versione} · Pubb. {activeReg.dataPubblicazione || '—'} ·{' '}
                  {activeReg.contenutoTesto.trim()
                    ? `${activeReg.contenutoTesto.trim().length.toLocaleString('it-IT')} caratteri`
                    : 'Documento storico precedente'}
                </p>
              </div>

              {activeReg.contenutoTesto.trim() ? (
                <div className="rounded-xl border border-slate-200 bg-white p-4 max-h-[380px] overflow-y-auto">
                  <RegulationContentView content={activeReg.contenutoTesto} />
                </div>
              ) : activeReg.downloadUrl ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700 space-y-2">
                  <p>
                    Questa versione attiva appartiene all&apos;archivio precedente su file ({activeReg.fileName || 'allegato'}). Puoi sostituirla in qualsiasi momento salvando una versione testuale dall&apos;editor qui accanto.
                  </p>
                  <a
                    href={activeReg.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[38px] px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white text-[#0B1F4D] font-semibold hover:bg-slate-100 inline-flex items-center gap-1.5"
                  >
                    <span>Apri documento storico</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">
                  Nessun contenuto disponibile per questa versione.
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                {activeReg.contenutoTesto.trim() && (
                  <button
                    type="button"
                    onClick={() => handleLoadIntoEditor(activeReg)}
                    className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-[#0B1F4D] hover:bg-slate-50 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-[#C69214]" />
                    <span>Modifica (nuova versione)</span>
                  </button>
                )}
                <button
                  type="button"
                  disabled={activatingId === activeReg.id}
                  onClick={() =>
                    setPendingActionConfirm({ type: 'DEACTIVATE', record: activeReg })
                  }
                  className="min-h-[42px] px-4 py-2 rounded-xl border border-amber-300 bg-amber-50 text-xs font-semibold text-amber-900 hover:bg-amber-100 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>Disattiva pubblicazione</span>
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Nessun Regolamento risulta attualmente pubblicato su{' '}
              <span className="font-mono-tabular">documenti_ufficiali/regolamento_attivo</span>. Scrivi il testo nel modulo qui accanto o pubblica una versione esistente dallo storico.
            </p>
          )}
        </div>
      </div>

      {/* Storico Versioni Regolamento */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-4">
        <h3 className="font-display text-base font-bold text-[#0B1F4D]">
          Storico versioni Regolamento ({regHistory.length})
        </h3>
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Caricamento storico versioni...</span>
          </div>
        ) : regHistory.length === 0 ? (
          <p className="text-xs sm:text-sm text-slate-500">
            Nessuna versione salvata finora.
          </p>
        ) : (
          <div className="border border-slate-200 rounded-xl divide-y divide-slate-200">
            {regHistory.map((item) => {
              const hasText = Boolean(item.contenutoTesto.trim());
              const isInspected = inspectedHistoryId === item.id;
              return (
                <div key={item.id} className="p-3.5 sm:p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm">
                    <div className="space-y-0.5 min-w-0">
                      <p className="font-bold text-[#0B1F4D]">
                        {item.titolo}{' '}
                        <span className="font-mono-tabular text-[#0284C7]">v{item.versione}</span>
                      </p>
                      <p className="text-xs text-slate-500 font-mono-tabular truncate">
                        {hasText
                          ? `Testo (${item.contenutoTesto.trim().length.toLocaleString('it-IT')} car.)`
                          : item.fileName || 'Allegato storico'}{' '}
                        · Pubb. {item.dataPubblicazione || formatDate(item.createdAt)}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          setInspectedHistoryId(isInspected ? null : item.id)
                        }
                        className="min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-[#0B1F4D] hover:bg-slate-100 inline-flex items-center gap-1 cursor-pointer"
                      >
                        {isInspected ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                        <span>{isInspected ? 'Chiudi testo' : 'Consulta'}</span>
                      </button>

                      {hasText && (
                        <button
                          type="button"
                          onClick={() => handleLoadIntoEditor(item)}
                          className="min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-[#0B1F4D] hover:bg-slate-50 inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-[#C69214]" />
                          <span>Modifica</span>
                        </button>
                      )}

                      {item.attivo ? (
                        <>
                          <span className="font-mono-tabular text-xs font-bold text-emerald-700 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200">
                            ATTIVA
                          </span>
                          <button
                            type="button"
                            disabled={activatingId === item.id}
                            onClick={() =>
                              setPendingActionConfirm({ type: 'DEACTIVATE', record: item })
                            }
                            className="min-h-[38px] px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-xs font-semibold text-amber-900 hover:bg-amber-100 cursor-pointer"
                          >
                            {activatingId === item.id ? 'Aggiornamento...' : 'Disattiva'}
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          disabled={activatingId === item.id}
                          onClick={() =>
                            setPendingActionConfirm({ type: 'ACTIVATE', record: item })
                          }
                          className="min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-[#0B1F4D] hover:bg-slate-50 cursor-pointer"
                        >
                          {activatingId === item.id ? 'Attivazione...' : 'Pubblica'}
                        </button>
                      )}
                    </div>
                  </div>

                  {isInspected && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                      {hasText ? (
                        <div className="max-h-[340px] overflow-y-auto pr-1">
                          <RegulationContentView content={item.contenutoTesto} />
                        </div>
                      ) : item.downloadUrl ? (
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-700">
                          <span>
                            Versione storica archiviata con collegamento esterno ({item.fileName || 'documento'}).
                          </span>
                          <a
                            href={item.downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="min-h-[36px] px-3 py-1.5 rounded-lg bg-white border border-slate-300 font-semibold text-[#0B1F4D] hover:bg-slate-100 inline-flex items-center gap-1.5"
                          >
                            <span>Apri documento</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 italic">
                          Nessun contenuto testuale presente in questa versione storica.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Editor Regole Ufficiali Chat WhatsApp */}
      <form
        onSubmit={handleSaveChatRules}
        className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4"
      >
        <div className="flex items-center gap-2">
          <MessageSquareText className="w-4 h-4 text-[#0284C7]" />
          <h3 className="font-display text-base font-bold text-[#0B1F4D]">
            Testo ufficiale Regole Chat WhatsApp (mostrato nel percorso candidato)
          </h3>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          Puoi aggiornare qui il testo esatto e la versione delle Regole della Chat WhatsApp accettate dai candidati. Eventuali link di invito WhatsApp inclusi nel testo vengono automaticamente mascherati ai candidati prima dell&apos;approvazione finale.
        </p>

        {chatRulesSuccess && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
            {chatRulesSuccess}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Titolo</label>
            <input
              type="text"
              required
              maxLength={120}
              value={chatRulesTitolo}
              onChange={(e) => setChatRulesTitolo(e.target.value)}
              className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Versione</label>
            <input
              type="text"
              required
              maxLength={32}
              value={chatRulesVersion}
              onChange={(e) => setChatRulesVersion(e.target.value)}
              className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono-tabular"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Contenuto integrale delle Regole Chat WhatsApp
          </label>
          <textarea
            rows={7}
            maxLength={15000}
            value={chatRulesText}
            onChange={(e) => setChatRulesText(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-sans"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={savingChatRules}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#0B1F4D] text-white text-xs sm:text-sm font-bold hover:bg-[#153985] disabled:opacity-50 inline-flex items-center gap-2 cursor-pointer"
          >
            {savingChatRules && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>Salva Regole Chat WhatsApp</span>
          </button>
        </div>
      </form>
    </div>
  );
}
