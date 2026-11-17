import { Activity, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useState } from 'react';
import {
  runSuperAdminFirestoreDiagnostic,
  type DiagnosticFieldsSummary,
  type FirestoreComparisonDiagnosticReport,
} from '../lib/firestoreDiagnostic';

function FieldsSummaryGrid({ fields }: { fields: DiagnosticFieldsSummary }) {
  const rows = [
    { label: 'email', data: fields.email },
    { label: 'nome', data: fields.nome },
    { label: 'ruolo', data: fields.ruolo },
    { label: 'attivo', data: fields.attivo },
  ];

  return (
    <div className="mt-2 rounded-lg border border-slate-200 bg-white p-2.5 space-y-1 text-xs">
      <p className="font-semibold text-slate-700">
        Campi rilevati ({fields.rawKeys.length > 0 ? fields.rawKeys.join(', ') : 'nessuno'}):
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 font-mono-tabular">
        {rows.map(({ label, data }) => (
          <div key={label} className="text-slate-700 break-all">
            <span className="font-semibold text-[#0B1F4D]">{label}:</span>{' '}
            {data.present ? `${String(data.value)} (${data.valueType})` : 'assente'}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SuperAdminDiagnosticPanel() {
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<FirestoreComparisonDiagnosticReport | null>(null);
  const [unexpectedError, setUnexpectedError] = useState<string | null>(null);

  const handleRun = async () => {
    setRunning(true);
    setUnexpectedError(null);
    try {
      const res = await runSuperAdminFirestoreDiagnostic();
      setReport(res);
    } catch (err) {
      setUnexpectedError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-300 bg-slate-50/90 p-4 sm:p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-[#C69214]">
            Diagnostica temporanea · Sola lettura · Area SUPER_ADMIN
          </p>
          <h3 className="mt-0.5 text-sm sm:text-base font-bold text-[#0B1F4D]">
            Confronto lettura Firestore SDK vs REST autenticata
          </h3>
          <p className="mt-0.5 text-xs text-slate-600">
            Verifica la sessione corrente e confronta{' '}
            <span className="font-mono-tabular">getDocFromServer()</span> con{' '}
            <span className="font-mono-tabular">fetch()</span> autenticato su{' '}
            <span className="font-mono-tabular">candidature-ficup / (default)</span> senza esporre alcun token.
          </p>
        </div>

        <button
          type="button"
          disabled={running}
          onClick={handleRun}
          className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#0B1F4D] text-white text-xs sm:text-sm font-bold hover:bg-[#153985] disabled:opacity-50 inline-flex items-center justify-center gap-2 cursor-pointer shrink-0"
        >
          {running ? (
            <Loader2 className="w-4 h-4 animate-spin text-[#D4AF37]" />
          ) : (
            <Activity className="w-4 h-4 text-[#D4AF37]" />
          )}
          <span>ESEGUI DIAGNOSTICA FIRESTORE</span>
        </button>
      </div>

      {unexpectedError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 break-words">
          Errore imprevisto diagnostica: {unexpectedError}
        </div>
      )}

      {report && (
        <div className="space-y-3 text-xs sm:text-sm">
          {/* Conclusione comparativa */}
          <div className="rounded-xl border border-[#0B1F4D]/25 bg-white p-3.5 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-[#0B1F4D]">
              {report.sdk.exists === true && report.rest.exists === true ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
              )}
              <span>Conclusione comparativa</span>
            </div>
            <p className="text-xs text-slate-800 leading-relaxed">{report.conclusion}</p>
            {report.differences.length > 0 && (
              <ul className="list-disc pl-5 text-xs text-red-800 space-y-0.5">
                {report.differences.map((diff) => (
                  <li key={diff}>{diff}</li>
                ))}
              </ul>
            )}
            <p className="text-[11px] font-mono-tabular text-slate-500">
              Eseguito: {report.executedAtIso}
            </p>
          </div>

          {/* 1. Stato autenticazione */}
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-1 text-xs">
            <p className="font-bold text-[#0B1F4D]">1. Stato autenticazione</p>
            <p className="font-mono-tabular text-slate-700 break-all">
              auth.currentUser: {report.authState.hasCurrentUser ? 'presente' : 'assente'} · UID:{' '}
              {report.authState.uid ?? 'N/D'}
            </p>
            <p className="font-mono-tabular text-slate-700 break-all">
              email: {report.authState.email ?? 'N/D'} · emailVerified:{' '}
              {String(report.authState.emailVerified)}
            </p>
            <p className="text-slate-700">
              authStateReady():{' '}
              {report.authState.authStateReadySupported ? 'supportato' : 'non disponibile'} · Token ID
              per Bearer REST:{' '}
              {report.authState.tokenAcquired
                ? 'acquisito in memoria (non mostrato)'
                : `errore (${report.authState.tokenError ?? 'N/D'})`}
            </p>
          </div>

          {/* 2 & 3. Confronto SDK vs REST */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-1.5">
              <p className="font-bold text-[#0B1F4D]">
                2. Lettura SDK (getDocFromServer) · {report.sdk.durationMs} ms
              </p>
              <p className="font-mono-tabular text-slate-700 break-all">
                Progetto / DB: {report.sdk.projectId} / {report.sdk.databaseId}
              </p>
              <p className="font-mono-tabular text-slate-700 break-all">
                Percorso: {report.sdk.path}
              </p>
              <p className="font-mono-tabular text-slate-900">
                <strong>Esistenza documento (snap.exists()):</strong>{' '}
                {report.sdk.exists === null ? 'N/D (errore)' : String(report.sdk.exists)}
              </p>
              {(report.sdk.errorCode || report.sdk.errorMessage) && (
                <p className="text-red-800 break-words">
                  <strong>Errore SDK:</strong> {report.sdk.errorCode ?? 'nessun codice'} —{' '}
                  {report.sdk.errorMessage ?? ''}
                </p>
              )}
              {report.sdk.fields && <FieldsSummaryGrid fields={report.sdk.fields} />}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-1.5">
              <p className="font-bold text-[#0B1F4D]">
                3. Lettura REST autenticata (fetch) · {report.rest.durationMs} ms
              </p>
              <p className="font-mono-tabular text-slate-700 break-all">
                Endpoint: {report.rest.endpointPath}
              </p>
              <p className="font-mono-tabular text-slate-900">
                <strong>HTTP Status:</strong>{' '}
                {report.rest.httpStatus !== null
                  ? `${report.rest.httpStatus} ${report.rest.httpStatusText ?? ''}`.trim()
                  : 'N/D'}
              </p>
              <p className="font-mono-tabular text-slate-900">
                <strong>Esistenza documento:</strong>{' '}
                {report.rest.exists === null ? 'N/D (errore)' : String(report.rest.exists)}
              </p>
              {report.rest.documentName && (
                <p className="font-mono-tabular text-slate-700 break-all">
                  Document Name: {report.rest.documentName}
                </p>
              )}
              {(report.rest.errorStatus || report.rest.errorMessage) && (
                <p className="text-red-800 break-words">
                  <strong>Errore REST:</strong> {report.rest.errorStatus ?? 'nessun codice'} —{' '}
                  {report.rest.errorMessage ?? ''}
                </p>
              )}
              {report.rest.fields && <FieldsSummaryGrid fields={report.rest.fields} />}
              {report.rest.sanitizedJson && (
                <details className="mt-2">
                  <summary className="cursor-pointer font-semibold text-[#153985]">
                    Mostra risposta JSON REST (senza token)
                  </summary>
                  <pre className="mt-1.5 max-h-48 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-2 text-[11px] font-mono-tabular text-slate-800 whitespace-pre-wrap break-all">
                    {report.rest.sanitizedJson}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
