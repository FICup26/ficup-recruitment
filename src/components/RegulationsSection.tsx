import {
  BookOpen,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  MessageSquareText,
  ShieldCheck,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { fetchActivePublicDocument, type DocumentoUfficialeRecord } from '../lib/firestore';
import {
  CHAT_RULES_VERSION,
  maskSensitiveWhatsappLinks,
  OFFICIAL_CHAT_RULES_SECTIONS,
} from '../lib/officialDocuments';
import { downloadOfficialDocumentPdf } from '../lib/pdfGenerator';
import { RegulationContentView } from './RegulationContentView';

interface RegulationsSectionProps {
  season?: string;
  operationalEmail?: string;
}

function buildOfficialChatRulesMarkdown(remoteDoc: DocumentoUfficialeRecord | null): string {
  if (remoteDoc && remoteDoc.contenutoTesto.trim()) {
    return maskSensitiveWhatsappLinks(remoteDoc.contenutoTesto.trim());
  }
  return OFFICIAL_CHAT_RULES_SECTIONS.map(
    (section) => `# ${section.title}\n${section.paragraphs.join('\n\n')}`
  ).join('\n\n');
}

export function RegulationsSection({
  season = '',
  operationalEmail = 'scudetto26@gmail.com',
}: RegulationsSectionProps) {
  const [loading, setLoading] = useState(true);
  const [regolamento, setRegolamento] = useState<DocumentoUfficialeRecord | null>(null);
  const [chatRulesDoc, setChatRulesDoc] = useState<DocumentoUfficialeRecord | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{
    title: string;
    version: string;
    publishedAt?: string;
    content: string;
    fileName: string;
  } | null>(null);
  const [pdfFeedback, setPdfFeedback] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchActivePublicDocument('regolamento_attivo'),
      fetchActivePublicDocument('regole_chat_attive'),
    ])
      .then(([regDoc, chatDoc]) => {
        if (!cancelled) {
          setRegolamento(regDoc);
          setChatRulesDoc(chatDoc);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const chatRulesContent = buildOfficialChatRulesMarkdown(chatRulesDoc);
  const chatRulesTitle = chatRulesDoc?.titolo || 'Regole Ufficiali Chat WhatsApp FICUP';
  const chatRulesVersion = chatRulesDoc?.versione || CHAT_RULES_VERSION;
  const chatRulesFileName = `FICUP-${season.replace('/', '-')}-Regole-Chat-v${chatRulesVersion}.pdf`;

  const regolamentoFileName = `FICUP-${season.replace('/', '-')}-Regolamento-Ufficiale-v${
    regolamento?.versione || 'attivo'
  }.pdf`;

  const handleDownloadPdf = (payload: {
    title: string;
    subtitle: string;
    version: string;
    publishedAt?: string;
    content: string;
    fileName: string;
  }) => {
    setPdfFeedback(null);
    try {
      downloadOfficialDocumentPdf(payload);
      setPdfFeedback(`PDF "${payload.fileName}" generato e scaricato.`);
      window.setTimeout(() => setPdfFeedback(null), 4000);
    } catch (err) {
      setPdfFeedback(err instanceof Error ? err.message : 'Errore durante la generazione del PDF.');
    }
  };

  return (
    <section
      id="regole-lega"
      className="bg-slate-50/75 border-b border-slate-200 py-16 sm:py-24"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-70px' }}
          transition={{ duration: 0.45 }}
          className="flex flex-col lg:flex-row lg:items-end justify-between gap-4"
        >
          <div className="max-w-2xl space-y-2.5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C69214]">
              Trasparenza e regole ufficiali · Stagione {season}
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-black tracking-tight text-[#0B1F4D] text-balance">
              LE REGOLE DELLA NOSTRA LEGA
            </h2>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              Consulta online o scarica in PDF i documenti ufficiali pubblicati dallo staff per vivere la competizione con chiarezza e spirito sportivo.
            </p>
          </div>
          {pdfFeedback && (
            <p className="text-xs sm:text-sm font-semibold text-emerald-700">
              {pdfFeedback}
            </p>
          )}
        </motion.div>

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center space-y-2">
            <Loader2 className="w-6 h-6 animate-spin text-[#0B1F4D] mx-auto" />
            <p className="text-sm text-slate-600">
              Caricamento dei documenti ufficiali da Cloud Firestore...
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            {/* Document 1: Regolamento Ufficiale FICUP */}
            <motion.article
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.45 }}
              className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs flex flex-col justify-between gap-6"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-[#0B1F4D] text-[#D4AF37] flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <span className="font-mono-tabular text-xs font-semibold text-slate-500">
                    {regolamento
                      ? `Versione ${regolamento.versione}${
                          regolamento.dataPubblicazione
                            ? ` · ${regolamento.dataPubblicazione}`
                            : ''
                        }`
                      : 'In attesa di pubblicazione'}
                  </span>
                </div>

                <div className="space-y-2">
                  <h3 className="font-display text-xl sm:text-2xl font-extrabold text-[#0B1F4D]">
                    {regolamento?.titolo || `Regolamento Ufficiale FICUP ${season}`}
                  </h3>
                  {regolamento && regolamento.contenutoTesto.trim() ? (
                    <p className="text-sm text-slate-600 leading-relaxed">
                      Disciplina ufficiale della competizione, formato rosa, aste, gestione della squadra e norme organizzative della stagione {season}.
                    </p>
                  ) : regolamento && regolamento.downloadUrl ? (
                    <p className="text-sm text-slate-600 leading-relaxed">
                      Documento ufficiale pubblicato in formato scaricabile dallo staff FICUP per la stagione {season}.
                    </p>
                  ) : (
                    <p className="text-sm text-slate-600 leading-relaxed">
                      Il regolamento ufficiale della stagione {season} non è ancora stato pubblicato in archivio dallo staff. Per informazioni scrivi a{' '}
                      <span className="font-mono-tabular font-semibold text-[#0B1F4D]">
                        {operationalEmail}
                      </span>
                      .
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex flex-wrap gap-3">
                {regolamento && regolamento.contenutoTesto.trim() ? (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewDoc({
                          title: regolamento.titolo || `Regolamento Ufficiale FICUP ${season}`,
                          version: regolamento.versione || season,
                          publishedAt: regolamento.dataPubblicazione || undefined,
                          content: regolamento.contenutoTesto,
                          fileName: regolamentoFileName,
                        })
                      }
                      className="min-h-[46px] px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-[#0B1F4D] text-xs sm:text-sm font-bold hover:bg-slate-50 transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
                    >
                      <BookOpen className="w-4 h-4 text-[#0284C7]" />
                      <span>Consulta regolamento</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleDownloadPdf({
                          title: regolamento.titolo || `Regolamento Ufficiale FICUP ${season}`,
                          subtitle: 'Regolamento ufficiale della competizione',
                          version: regolamento.versione || season,
                          publishedAt: regolamento.dataPubblicazione || undefined,
                          content: regolamento.contenutoTesto,
                          fileName: regolamentoFileName,
                        })
                      }
                      className="min-h-[46px] px-5 py-2.5 rounded-xl bg-[#0B1F4D] text-white text-xs sm:text-sm font-bold hover:bg-[#153985] transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
                    >
                      <Download className="w-4 h-4 text-[#D4AF37]" />
                      <span>Scarica PDF</span>
                    </button>
                  </>
                ) : regolamento && regolamento.downloadUrl ? (
                  <a
                    href={regolamento.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[46px] px-5 py-2.5 rounded-xl bg-[#0B1F4D] text-white text-xs sm:text-sm font-bold hover:bg-[#153985] transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap"
                  >
                    <Download className="w-4 h-4 text-[#D4AF37]" />
                    <span>Scarica Regolamento</span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                  </a>
                ) : (
                  <div className="inline-flex items-center gap-2 text-xs font-semibold text-amber-800">
                    <ShieldCheck className="w-4 h-4 text-[#C69214] shrink-0" />
                    <span>Pubblicazione a cura dello staff in preparazione</span>
                  </div>
                )}
              </div>
            </motion.article>

            {/* Document 2: Regole Ufficiali Chat WhatsApp */}
            <motion.article
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.45, delay: 0.08 }}
              className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs flex flex-col justify-between gap-6"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-sky-50 border border-sky-200 text-[#0284C7] flex items-center justify-center shrink-0">
                    <MessageSquareText className="w-5 h-5" />
                  </div>
                  <span className="font-mono-tabular text-xs font-semibold text-slate-500">
                    Versione {chatRulesVersion}
                  </span>
                </div>

                <div className="space-y-2">
                  <h3 className="font-display text-xl sm:text-2xl font-extrabold text-[#0B1F4D]">
                    {chatRulesTitle}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Norme di comportamento, rispetto reciproco, fair play su Fantaleghe e riservatezza degli accessi ufficiali nella community FICUP {season}.
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setPreviewDoc({
                      title: chatRulesTitle,
                      version: chatRulesVersion,
                      publishedAt: chatRulesDoc?.dataPubblicazione || undefined,
                      content: chatRulesContent,
                      fileName: chatRulesFileName,
                    })
                  }
                  className="min-h-[46px] px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-[#0B1F4D] text-xs sm:text-sm font-bold hover:bg-slate-50 transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
                >
                  <BookOpen className="w-4 h-4 text-[#0284C7]" />
                  <span>Consulta regole chat</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleDownloadPdf({
                      title: chatRulesTitle,
                      subtitle: 'Codice di comportamento community WhatsApp',
                      version: chatRulesVersion,
                      publishedAt: chatRulesDoc?.dataPubblicazione || undefined,
                      content: chatRulesContent,
                      fileName: chatRulesFileName,
                    })
                  }
                  className="min-h-[46px] px-5 py-2.5 rounded-xl bg-[#0B1F4D] text-white text-xs sm:text-sm font-bold hover:bg-[#153985] transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
                >
                  <Download className="w-4 h-4 text-[#D4AF37]" />
                  <span>Scarica PDF</span>
                </button>
              </div>
            </motion.article>
          </div>
        )}
      </div>

      {/* Document Reader Modal */}
      {previewDoc && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="regulation-reader-title"
        >
          <div className="bg-white w-full sm:max-w-3xl max-h-[90vh] rounded-t-3xl sm:rounded-2xl border border-slate-200 shadow-xl flex flex-col overflow-hidden">
            <div className="px-5 sm:px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-3 bg-white">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#C69214]">
                  FICUP {season} · Versione {previewDoc.version}
                </p>
                <h3
                  id="regulation-reader-title"
                  className="font-display text-lg sm:text-xl font-extrabold text-[#0B1F4D] truncate"
                >
                  {previewDoc.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                aria-label="Chiudi documento"
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 sm:p-6 overflow-y-auto">
              <RegulationContentView content={previewDoc.content} />
            </div>

            <div className="px-5 sm:px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() =>
                  handleDownloadPdf({
                    title: previewDoc.title,
                    subtitle: `Documento ufficiale FICUP ${season}`,
                    version: previewDoc.version,
                    publishedAt: previewDoc.publishedAt,
                    content: previewDoc.content,
                    fileName: previewDoc.fileName,
                  })
                }
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[#0B1F4D] text-white text-xs sm:text-sm font-bold hover:bg-[#153985] inline-flex items-center gap-2 whitespace-nowrap cursor-pointer"
              >
                <Download className="w-4 h-4 text-[#D4AF37]" />
                <span>Scarica PDF</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="min-h-[44px] px-5 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs sm:text-sm font-semibold hover:bg-slate-100 cursor-pointer"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
