import { AlertCircle, ShieldCheck, X } from 'lucide-react';
import { FICUP_OPERATIONAL_EMAIL } from '../lib/notifications';
import { GDPR_PRIVACY_SECTIONS } from '../lib/officialDocuments';

interface PrivacyModalProps {
  open: boolean;
  version: string;
  operationalEmail?: string;
  onClose: () => void;
}

export function PrivacyModal({
  open,
  version,
  operationalEmail = FICUP_OPERATIONAL_EMAIL,
  onClose,
}: PrivacyModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="privacy-modal-title"
    >
      <div className="bg-white w-full sm:max-w-2xl max-h-[88vh] rounded-t-3xl sm:rounded-2xl border border-slate-200 shadow-xl flex flex-col overflow-hidden text-slate-800">
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-[#C69214] shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">
                Informativa Privacy GDPR · Versione {version}
              </p>
              <h2
                id="privacy-modal-title"
                className="font-display text-base sm:text-lg font-bold text-[#0B1F4D]"
              >
                Trattamento dei dati personali — FANTA ITALIA CUP
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi informativa"
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-sm text-slate-700 leading-relaxed">
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 flex items-start gap-2.5 text-xs text-amber-950">
            <AlertCircle className="w-4 h-4 text-[#C69214] shrink-0 mt-0.5" />
            <span>
              <strong>Bozza informativa GDPR:</strong> i campi contrassegnati con{' '}
              <span className="font-mono-tabular font-semibold">[DA CONFERMARE]</span> devono
              essere confermati dal Titolare legale prima della pubblicazione legale definitiva.
            </span>
          </div>

          {GDPR_PRIVACY_SECTIONS.map((section) => (
            <section key={section.id} className="space-y-1.5">
              <h3 className="font-semibold text-[#0B1F4D]">{section.title}</h3>
              {section.paragraphs.map((paragraph, idx) => (
                <p key={idx}>
                  {paragraph.includes('scudetto26@gmail.com') &&
                  operationalEmail !== 'scudetto26@gmail.com'
                    ? paragraph.replace(/scudetto26@gmail\.com/g, operationalEmail)
                    : paragraph}
                </p>
              ))}
            </section>
          ))}

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600">
            Contatto per richieste di accesso, rettifica o cancellazione dati:{' '}
            <a
              href={`mailto:${operationalEmail}?subject=${encodeURIComponent(
                'Richiesta Privacy GDPR — FANTA ITALIA CUP'
              )}`}
              className="font-mono-tabular font-semibold text-[#0284C7] underline underline-offset-2 hover:text-[#0B1F4D]"
            >
              {operationalEmail}
            </a>
          </div>
        </div>

        <div className="px-5 sm:px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#0B1F4D] text-white text-sm font-semibold hover:bg-[#153985] transition-colors cursor-pointer"
          >
            Ho capito, chiudi
          </button>
        </div>
      </div>
    </div>
  );
}
