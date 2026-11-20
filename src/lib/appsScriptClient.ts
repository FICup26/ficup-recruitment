import type { CandidaturaStato } from './firestore';

const APPS_SCRIPT_URL =
  typeof import.meta.env.VITE_APPS_SCRIPT_WEBAPP_URL === 'string'
    ? import.meta.env.VITE_APPS_SCRIPT_WEBAPP_URL.trim()
    : '';

export const isAppsScriptConfigured = Boolean(
  APPS_SCRIPT_URL && /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec/i.test(APPS_SCRIPT_URL)
);

export interface WaitingRoomPublicHistoryItem {
  statoNuovo: string;
  createdAtIso: string | null;
}

export interface WaitingRoomServerStatus {
  codiceCandidatura: string;
  nome: string;
  nomeCompleto: string;
  nomeSquadra: string;
  stato: CandidaturaStato;
  createdAtIso: string | null;
  updatedAtIso: string | null;
  publicHistory: WaitingRoomPublicHistoryItem[];
  linkWhatsappProvvisorio: string;
  linkWhatsappUfficiale: string | null;
}

interface AppsScriptApiResponse<T> {
  ok: boolean;
  code?: string;
  error?: string;
  data?: T;
  stats?: {
    processed?: number;
    sent?: number;
    skipped?: number;
    failed?: number;
  };
}

const REQUEST_TIMEOUT_MS = 15000;

async function postToAppsScript<T>(payload: Record<string, unknown>): Promise<AppsScriptApiResponse<T>> {
  if (!isAppsScriptConfigured) {
    throw new Error(
      'Endpoint Google Apps Script (VITE_APPS_SCRIPT_WEBAPP_URL) non ancora configurato nell’ambiente.'
    );
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    // Content-Type text/plain evita il preflight OPTIONS non supportato da Google Apps Script Web App
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const rawText = await response.text();
    let parsed: AppsScriptApiResponse<T>;
    try {
      parsed = JSON.parse(rawText) as AppsScriptApiResponse<T>;
    } catch {
      throw new Error(
        `Risposta non valida dal backend Apps Script (HTTP ${response.status}). Verifica che la Web App sia pubblicata con accesso "Chiunque".`
      );
    }

    if (!response.ok && parsed.ok !== false) {
      throw new Error(`Errore HTTP ${response.status} dal backend Apps Script.`);
    }

    return parsed;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Timeout di connessione verso Google Apps Script. Riprova tra qualche secondo.');
    }
    throw err;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function fetchWaitingRoomStatus(params: {
  codiceCandidatura: string;
  emailFantaleghe: string;
}): Promise<WaitingRoomServerStatus> {
  const code = params.codiceCandidatura.trim().toUpperCase();
  const email = params.emailFantaleghe.trim().toLowerCase();

  const res = await postToAppsScript<WaitingRoomServerStatus>({
    action: 'getWaitingRoomStatus',
    codiceCandidatura: code,
    emailFantaleghe: email,
  });

  if (!res.ok || !res.data) {
    throw new Error(res.error || 'Impossibile recuperare lo stato della candidatura.');
  }

  return res.data;
}

export interface TriggerCandidaturaNotificationParams {
  candidaturaId: string;
  idToken?: string;
  codiceCandidatura?: string;
  emailFantaleghe?: string;
}

/**
 * Invia una segnalazione best-effort e protetta ad Apps Script affinché elabori subito
 * l'invio email idempotente senza attendere il trigger periodico.
 * - Admin: invia il Firebase Auth ID Token verificato lato server su Firestore
 * - Wizard candidato: invia prova di possesso (id + codiceCandidatura + emailFantaleghe)
 * Non lancia mai eccezioni bloccanti verso la UI: il trigger incrementale
 * di sicurezza garantisce comunque l'elaborazione asincrona.
 */
export async function triggerCandidaturaNotification(
  params: TriggerCandidaturaNotificationParams
): Promise<{
  triggered: boolean;
  sent: number;
  detail?: string;
}> {
  if (!isAppsScriptConfigured || !params.candidaturaId) {
    return { triggered: false, sent: 0 };
  }

  const payload: Record<string, unknown> = {
    action: 'notifyCandidaturaEvent',
    candidaturaId: params.candidaturaId,
  };

  if (params.idToken) {
    payload.idToken = params.idToken;
  } else if (params.codiceCandidatura && params.emailFantaleghe) {
    payload.codiceCandidatura = params.codiceCandidatura.trim().toUpperCase();
    payload.emailFantaleghe = params.emailFantaleghe.trim().toLowerCase();
  } else {
    return { triggered: false, sent: 0 };
  }

  try {
    const res = await postToAppsScript<never>(payload);
    return {
      triggered: Boolean(res.ok),
      sent: Number(res.stats?.sent ?? 0),
      detail: res.error,
    };
  } catch {
    return { triggered: false, sent: 0 };
  }
}

export interface AppsScriptConnectionDiagnostic {
  configured: boolean;
  urlValidFormat: boolean;
  webAppReachable: boolean;
  firestoreReadProbeOk: boolean | null;
  endpointSecurityActive: boolean | null;
  serviceName: string | null;
  operationalEmail: string | null;
  detail: string;
  checkedAtIso: string;
}

/**
 * Verifica in sola lettura il collegamento tra frontend e Web App Apps Script:
 * 1) Presenza e formato di VITE_APPS_SCRIPT_WEBAPP_URL
 * 2) Risposta GET (doGet) della Web App pubblicata
 * 3) Con includeFirestoreReadProbe=true:
 *    - Probe di sola lettura Firestore (:runQuery su codice inesistente, 0 scritture, 0 email)
 *    - Verifica che notifyCandidaturaEvent senza credenziali risponda UNAUTHORIZED
 */
export async function verifyAppsScriptBackend(options?: {
  includeFirestoreReadProbe?: boolean;
}): Promise<AppsScriptConnectionDiagnostic> {
  const checkedAtIso = new Date().toISOString();

  if (!APPS_SCRIPT_URL) {
    return {
      configured: false,
      urlValidFormat: false,
      webAppReachable: false,
      firestoreReadProbeOk: null,
      endpointSecurityActive: null,
      serviceName: null,
      operationalEmail: null,
      detail:
        'Variabile VITE_APPS_SCRIPT_WEBAPP_URL non configurata nell’ambiente. Impostarla con l’URL /exec della Web App FICUP - Backend e ricompilare il frontend.',
      checkedAtIso,
    };
  }

  if (!isAppsScriptConfigured) {
    return {
      configured: true,
      urlValidFormat: false,
      webAppReachable: false,
      firestoreReadProbeOk: null,
      endpointSecurityActive: null,
      serviceName: null,
      operationalEmail: null,
      detail:
        'Formato di VITE_APPS_SCRIPT_WEBAPP_URL non valido: atteso un URL https://script.google.com/macros/s/.../exec.',
      checkedAtIso,
    };
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let serviceName: string | null = null;
  let operationalEmail: string | null = null;

  try {
    const resp = await fetch(APPS_SCRIPT_URL, {
      method: 'GET',
      signal: controller.signal,
    });
    const raw = await resp.text();
    const parsed = JSON.parse(raw) as {
      ok?: boolean;
      service?: string;
      operationalEmail?: string;
    };

    if (!resp.ok || !parsed?.ok) {
      return {
        configured: true,
        urlValidFormat: true,
        webAppReachable: false,
        firestoreReadProbeOk: null,
        endpointSecurityActive: null,
        serviceName: parsed?.service ?? null,
        operationalEmail: parsed?.operationalEmail ?? null,
        detail: `La Web App Apps Script ha risposto con stato anomalo (HTTP ${resp.status}).`,
        checkedAtIso,
      };
    }

    serviceName = parsed.service ?? null;
    operationalEmail = parsed.operationalEmail ?? null;
  } catch (err) {
    const msg =
      err instanceof Error && err.name === 'AbortError'
        ? 'Timeout durante il contatto GET verso la Web App Apps Script.'
        : err instanceof Error
          ? err.message
          : String(err);
    return {
      configured: true,
      urlValidFormat: true,
      webAppReachable: false,
      firestoreReadProbeOk: null,
      endpointSecurityActive: null,
      serviceName: null,
      operationalEmail: null,
      detail: `Impossibile raggiungere la Web App Apps Script (${msg}). Verifica che la distribuzione sia pubblicata con accesso "Chiunque".`,
      checkedAtIso,
    };
  } finally {
    window.clearTimeout(timeoutId);
  }

  if (!options?.includeFirestoreReadProbe) {
    return {
      configured: true,
      urlValidFormat: true,
      webAppReachable: true,
      firestoreReadProbeOk: null,
      endpointSecurityActive: null,
      serviceName,
      operationalEmail,
      detail: `Web App Apps Script raggiungibile (${serviceName ?? 'servizio attivo'}). Avvia il probe completo per testare la lettura Firestore e la sicurezza degli endpoint.`,
      checkedAtIso,
    };
  }

  let firestoreReadProbeOk = false;
  let endpointSecurityActive = false;
  const notes: string[] = [];

  try {
    const wrProbe = await postToAppsScript<never>({
      action: 'getWaitingRoomStatus',
      codiceCandidatura: 'FICUP26-000000',
      emailFantaleghe: 'readonly-probe@example.com',
    });
    if (wrProbe.ok === false && wrProbe.code === 'NOT_FOUND') {
      firestoreReadProbeOk = true;
      notes.push('Lettura Firestore via Apps Script OAuth verificata (HTTP 200 / query valida).');
    } else if (wrProbe.code === 'RATE_LIMITED') {
      firestoreReadProbeOk = true;
      notes.push('Endpoint Waiting Room attivo (rate-limit protettivo attivo).');
    } else {
      notes.push(
        `Probe lettura Firestore non confermato (${wrProbe.code ?? 'UNKNOWN'}: ${wrProbe.error ?? 'nessun dettaglio'}).`
      );
    }
  } catch (err) {
    notes.push(
      `Errore probe lettura Firestore via Apps Script: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  try {
    const secProbe = await postToAppsScript<never>({
      action: 'notifyCandidaturaEvent',
      candidaturaId: 'readonly-auth-probe',
    });
    if (secProbe.ok === false && secProbe.code === 'UNAUTHORIZED') {
      endpointSecurityActive = true;
      notes.push('Protezione UNAUTHORIZED su notifyCandidaturaEvent confermata.');
    } else {
      notes.push(
        `Attenzione: notifyCandidaturaEvent ha risposto ${secProbe.code ?? (secProbe.ok ? 'OK' : 'ERRORE')} invece di UNAUTHORIZED (verifica di aver aggiornato e ridistribuito la Web App).`
      );
    }
  } catch (err) {
    notes.push(
      `Errore verifica protezione notifyCandidaturaEvent: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  return {
    configured: true,
    urlValidFormat: true,
    webAppReachable: true,
    firestoreReadProbeOk,
    endpointSecurityActive,
    serviceName,
    operationalEmail,
    detail: notes.join(' '),
    checkedAtIso,
  };
}
