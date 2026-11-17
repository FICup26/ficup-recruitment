import { ShieldCheck, X } from 'lucide-react';
import { FICUP_OPERATIONAL_EMAIL } from '../lib/notifications';

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
                Informativa Privacy · Versione {version}
              </p>
              <h2 id="privacy-modal-title" className="font-display text-base sm:text-lg font-bold text-[#0B1F4D]">
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
          <section className="space-y-1.5">
            <h3 className="font-semibold text-[#0B1F4D]">1. Titolare e finalità del trattamento</h3>
            <p>
              I dati raccolti tramite il portale <strong>FANTA ITALIA CUP</strong> sono trattati esclusivamente dallo staff organizzativo (contatto operativo:{' '}
              <span className="font-mono-tabular text-[#0B1F4D]">{operationalEmail}</span>) per gestire le candidature dei nuovi fantallenatori subentranti, verificare i requisiti di partecipazione e inviare l&apos;invito alla competizione su Fantaleghe.
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="font-semibold text-[#0B1F4D]">2. Dati raccolti (principio di minimizzazione)</h3>
            <p>
              Vengono richiesti esclusivamente i dati strettamente necessari alla procedura di ingresso: Nome, Cognome, indirizzo email utilizzato su Fantaleghe, nome della squadra attuale ed eventuali note facoltative, oltre al codice candidatura generato e al timestamp di registrazione. Non vengono raccolti dati sensibili, documenti d&apos;identità o informazioni non pertinenti.
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="font-semibold text-[#0B1F4D]">3. Base giuridica, conservazione e sicurezza</h3>
            <p>
              Il trattamento si fonda sul consenso esplicito dell&apos;interessato (art. 6 GDPR). Le candidature sono archiviate su database dedicato Cloud Firestore con regole di sicurezza restrittive:{' '}
              <strong>nessun elenco o dato personale è reso pubblico</strong> e l&apos;accesso in lettura/gestione è riservato esclusivamente agli amministratori autenticati e autorizzati.
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="font-semibold text-[#0B1F4D]">4. Diritti dell&apos;interessato</h3>
            <p>
              In qualsiasi momento puoi richiedere l&apos;accesso, la rettifica o la cancellazione della tua candidatura scrivendo a{' '}
              <a
                href={`mailto:${operationalEmail}?subject=${encodeURIComponent('Richiesta Privacy FANTA ITALIA CUP')}`}
                className="font-semibold text-[#0284C7] underline underline-offset-2 hover:text-[#0B1F4D]"
              >
                {operationalEmail}
              </a>
              .
            </p>
          </section>
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
