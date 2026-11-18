import { AlertCircle, CheckCircle2, Database, Lock, Server, ShieldAlert } from 'lucide-react';
import { firebaseConfigStatus } from '../lib/firebase';

export function AdminZonaVarSection() {
  const isSameProject = firebaseConfigStatus.projectId === 'ficup-c9186';

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-widest text-[#C69214]">
              Ecosistema FICUP · Integrazione cross-progetto
            </p>
            <h2 className="font-display text-xl font-extrabold text-[#0B1F4D]">
              GESTIONE SQUADRE — ZONA VAR
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Collegamento reale al database principale FICUP per leggere squadre libere e registrare l&apos;assegnazione della squadra al candidato approvato.
            </p>
          </div>
          <span
            className={`px-3 py-1.5 rounded-lg border text-xs font-mono-tabular font-bold shrink-0 ${
              isSameProject
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            {isSameProject ? 'COLLEGATO' : 'NON COLLEGATO (DIAGNOSI)'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-1">
            <div className="flex items-center gap-2 font-bold text-[#0B1F4D]">
              <Database className="w-4 h-4 text-[#0284C7]" />
              <span>Progetto Portale Candidature (attivo)</span>
            </div>
            <p className="font-mono-tabular text-slate-700">
              Project ID: {firebaseConfigStatus.projectId || 'non configurato'}
            </p>
            <p className="font-mono-tabular text-slate-500">
              Database: {firebaseConfigStatus.databaseId}
            </p>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-1">
            <div className="flex items-center gap-2 font-bold text-[#0B1F4D]">
              <Server className="w-4 h-4 text-[#C69214]" />
              <span>Progetto Destinazione Zona VAR</span>
            </div>
            <p className="font-mono-tabular text-slate-800 font-semibold">
              Project ID atteso: ficup-c9186
            </p>
            <p className="font-mono-tabular text-slate-600">Database: (default)</p>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 sm:p-5 flex items-start gap-3 text-xs sm:text-sm text-amber-950 leading-relaxed">
          <ShieldAlert className="w-5 h-5 text-[#C69214] shrink-0 mt-0.5" />
          <div className="space-y-1.5">
            <p className="font-bold text-[#0B1F4D]">
              Nessuna squadra simulata o inventata
            </p>
            <p>
              In questo workspace è presente esclusivamente il codice del portale candidature (<span className="font-mono-tabular">candidature-ficup</span>). Il codice sorgente della Zona VAR (<span className="font-mono-tabular">ficup-c9186</span>), i nomi reali delle raccolte/campi delle squadre e le credenziali autorizzate non sono presenti nell&apos;ambiente corrente.
            </p>
            <p>
              Per evitare dati fittizi o scritture incompatibili sulla produzione, e nel rispetto del divieto di creare automaticamente un secondo backend Admin SDK non autorizzato, l&apos;elenco squadre Zona VAR non viene simulato.
            </p>
          </div>
        </div>
      </div>

      {/* Checklist requisiti per completare l'integrazione reale */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
        <h3 className="font-display text-base font-bold text-[#0B1F4D]">
          Elementi necessari per attivare il collegamento live con Zona VAR (ficup-c9186)
        </h3>

        <div className="space-y-3 text-xs sm:text-sm text-slate-700">
          <div className="rounded-xl border border-slate-200 p-4 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-[#C69214] shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-[#0B1F4D]">
                1. Schema reale delle collezioni e dei campi su ficup-c9186
              </p>
              <p className="mt-0.5 text-slate-600">
                Fornire il codice della Zona VAR (o l&apos;export esatto della struttura Firestore) con il nome della raccolta squadre, il campo che indica disponibilità/occupazione, categoria/girone, mister associato ed eventuali documenti collegati da aggiornare all&apos;assegnazione.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4 flex items-start gap-3">
            <Lock className="w-4 h-4 text-[#0284C7] shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-[#0B1F4D]">
                2. Strategia di autorizzazione cross-project sicura
              </p>
              <p className="mt-0.5 text-slate-600">
                Poiché il browser dell&apos;amministratore è autenticato su <span className="font-mono-tabular">candidature-ficup</span>, l&apos;accesso in lettura/scrittura verso <span className="font-mono-tabular">ficup-c9186</span> richiede un ponte server-side autorizzato (es. Apps Script OAuth o endpoint backend dedicato protetto con verifica ID Token admin) oppure regole Firebase dedicate su <span className="font-mono-tabular">ficup-c9186</span>.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4 flex items-start gap-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-[#0B1F4D]">
                3. Predisposizione già pronta nel portale candidature
              </p>
              <p className="mt-0.5 text-slate-600">
                Nel dettaglio candidatura (<span className="font-mono-tabular">whatsapp_autorizzazioni</span>) è già disponibile il campo di riferimento squadra registrato nello storico audit (<span className="font-mono-tabular">storico_operazioni</span>), pronto per essere collegato all&apos;ID squadra reale di <span className="font-mono-tabular">ficup-c9186</span> appena autorizzato.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
