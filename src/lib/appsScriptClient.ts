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
  status?: string;
  error?: string;
  data?: T;
  completed?: boolean;
  historyRecorded?: boolean;
  historyRecovered?: boolean;
  manualCompleted?: boolean;
  emailConfirmed?: boolean;
  stato?: CandidaturaStato;
  linkWhatsappUfficiale?: string | null;
  stats?: {
    processed?: number;
    sent?: number;
    skipped?: number;
    failed?: number;
  };
}

const REQUEST_TIMEOUT_MS = 30000;

function sanitizeHttpsWhatsappUrl(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return /^https:\/\/[^\s]+$/i.test(trimmed) ? trimmed : null;
}

async function postToAppsScript<T>(payload: Record<string, unknown>): Promise<AppsScriptApiResponse<T>> {
  if (!isAppsScriptConfigured) {
    throw new Error(
      'Endpoint Google Apps Script (VITE_APPS_SCRIPT_WEBAPP_URL) non ancora configurato nell’ambiente.'
    );
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let rawText = '';
  let response: Response;

  try {
    response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    rawText = await response.text();
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      const timeoutErr = new Error(
        'Timeout di connessione verso Google Apps Script (30s). La richiesta potrebbe essere stata comunque elaborata dal server.'
      ) as Error & { canRetry?: boolean; isTimeout?: boolean };
      timeoutErr.canRetry = true;
      timeoutErr.isTimeout = true;
      throw timeoutErr;
    }
    const netErr = new Error(
      `Errore di rete o CORS durante la comunicazione con Apps Script: ${err instanceof Error ? err.message : String(err)}`
    ) as Error & { canRetry?: boolean };
    netErr.canRetry = true;
    throw netErr;
  } finally {
    window.clearTimeout(timeoutId);
  }

  const contentType = response.headers.get('content-type') || '';
  const isHtml = rawText.includes('<!DOCTYPE html>') || rawText.includes('<html') || contentType.includes('text/html');

  if (!response.ok || isHtml) {
    const status = response.status;
    let message = `Errore HTTP ${status} dal backend Apps Script.`;
    let canRetry = true;

    if (status === 429) {
      message = 'Servizio temporaneamente sovraccarico (HTTP 429 - troppe richieste). Riprova tra qualche minuto.';
    } else if (status >= 500) {
      message = `Errore temporaneo del server Apps Script (HTTP ${status}). Riprova tra qualche istante.`;
    } else if (isHtml) {
      message = 'La Web App Apps Script ha restituito una pagina HTML temporanea (possibile cold start, redirect o manutenzione di Google). Riprova tra qualche istante.';
    }

    const httpErr = new Error(message) as Error & { canRetry?: boolean; status?: number };
    httpErr.canRetry = canRetry;
    httpErr.status = status;
    throw httpErr;
  }

  let parsed: AppsScriptApiResponse<T>;
  try {
    parsed = JSON.parse(rawText) as AppsScriptApiResponse<T>;
  } catch {
    const parseErr = new Error(
      `Risposta non JSON dal backend Apps Script (HTTP ${response.status}). Verifica che la Web App sia pubblicata con accesso "Chiunque".`
    ) as Error & { canRetry?: boolean };
    parseErr.canRetry = false;
    throw parseErr;
  }

  if (typeof parsed !== 'object' || parsed === null || typeof parsed.ok !== 'boolean') {
    const fmtErr = new Error(
      `Formato risposta non valido dal backend Apps Script (HTTP ${response.status}).`
    ) as Error & { canRetry?: boolean };
    fmtErr.canRetry = true;
    throw fmtErr;
  }

  if (!response.ok && parsed.ok !== false) {
    const err = new Error(parsed.error || `Errore HTTP ${response.status} dal backend Apps Script.`) as Error & { canRetry?: boolean };
    err.canRetry = response.status >= 500 || response.status === 429;
    throw err;
  }

  return parsed;
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

  if (!res.ok || !res.data || typeof res.data !== 'object') {
    throw new Error(res.error || 'Impossibile recuperare lo stato della candidatura.');
  }

  return {
    ...res.data,
    linkWhatsappProvvisorio: sanitizeHttpsWhatsappUrl(res.data.linkWhatsappProvvisorio) ?? '',
    linkWhatsappUfficiale:
      res.data.stato === 'COMPLETATO'
        ? sanitizeHttpsWhatsappUrl(res.data.linkWhatsappUfficiale)
        : null,
  };
}

export type PublicNotificationOutcome =
  | 'emails_confirmed'
  | 'emails_pending'
  | 'notification_error'
  | 'forbidden_state';

export interface TriggerCandidaturaNotificationParams {
  candidaturaId: string;
  idToken?: string;
  codiceCandidatura?: string;
  emailFantaleghe?: string;
}

export interface TriggerCandidaturaNotificationResult {
  triggered: boolean;
  sent: number;
  outcome: PublicNotificationOutcome;
  code?: string;
  status?: string;
  emailConfirmed: boolean;
  pending: boolean;
  completed: false;
  stato?: CandidaturaStato;
  linkWhatsappUfficiale: null;
  detail?: string;
  canRetry: boolean;
}

const NON_RETRYABLE_CODES = new Set([
  'FORBIDDEN_STATE',
  'ARCHIVED',
  'NOT_FOUND',
  'UNAUTHORIZED',
  'INVALID_INPUT',
]);

/**
 * Invia una segnalazione protetta ad Apps Script per elaborare le email idempotenti
 * di ricezione (percorso pubblico) o di cambio stato (percorso Admin autenticato).
 * Sul percorso pubblico non completa mai la candidatura e non restituisce mai
 * il link WhatsApp ufficiale: il passaggio a COMPLETATO resta esclusivamente manuale (Staff).
 */
export async function triggerCandidaturaNotification(
  params: TriggerCandidaturaNotificationParams
): Promise<TriggerCandidaturaNotificationResult> {
  if (!isAppsScriptConfigured || !params.candidaturaId) {
    return {
      triggered: false,
      sent: 0,
      outcome: 'notification_error',
      emailConfirmed: false,
      pending: false,
      completed: false,
      linkWhatsappUfficiale: null,
      canRetry: false,
    };
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
    return {
      triggered: false,
      sent: 0,
      outcome: 'notification_error',
      emailConfirmed: false,
      pending: false,
      completed: false,
      linkWhatsappUfficiale: null,
      canRetry: false,
    };
  }

  try {
    const res = await postToAppsScript<never>(payload);
    const code = typeof res.code === 'string' ? res.code : undefined;
    const status = typeof res.status === 'string' ? res.status : undefined;
    const emailConfirmed = res.emailConfirmed === true;
    const detail = typeof res.error === 'string' ? res.error : undefined;

    const isForbidden =
      (code && NON_RETRYABLE_CODES.has(code)) ||
      (status && NON_RETRYABLE_CODES.has(status));

    if (isForbidden) {
      return {
        triggered: Boolean(res.ok),
        sent: Number(res.stats?.sent ?? 0),
        outcome: 'forbidden_state',
        code,
        status,
        emailConfirmed,
        pending: false,
        completed: false,
        stato: res.stato,
        linkWhatsappUfficiale: null,
        detail,
        canRetry: false,
      };
    }

    const isPending =
      code === 'DEFERRED_TO_TRIGGER' ||
      code === 'RATE_LIMITED' ||
      status === 'EMAIL_NOT_CONFIRMED' ||
      (res.ok === true && !params.idToken && !emailConfirmed);

    if (isPending) {
      return {
        triggered: Boolean(res.ok),
        sent: Number(res.stats?.sent ?? 0),
        outcome: 'emails_pending',
        code,
        status,
        emailConfirmed: false,
        pending: true,
        completed: false,
        stato: res.stato ?? 'NUOVO',
        linkWhatsappUfficiale: null,
        detail,
        canRetry: code !== 'DEFERRED_TO_TRIGGER' && code !== 'RATE_LIMITED',
      };
    }

    if (res.ok === true && (emailConfirmed || Boolean(params.idToken))) {
      return {
        triggered: true,
        sent: Number(res.stats?.sent ?? 0),
        outcome: 'emails_confirmed',
        code,
        status,
        emailConfirmed: true,
        pending: false,
        completed: false,
        stato: res.stato ?? 'NUOVO',
        linkWhatsappUfficiale: null,
        detail,
        canRetry: false,
      };
    }

    return {
      triggered: false,
      sent: Number(res.stats?.sent ?? 0),
      outcome: 'notification_error',
      code,
      status,
      emailConfirmed: false,
      pending: false,
      completed: false,
      stato: res.stato,
      linkWhatsappUfficiale: null,
      detail: detail ?? 'Errore nella segnalazione email al backend.',
      canRetry: true,
    };
  } catch (err) {
    return {
      triggered: false,
      sent: 0,
      outcome: 'notification_error',
      emailConfirmed: false,
      pending: false,
      completed: false,
      linkWhatsappUfficiale: null,
      canRetry: true,
      detail:
        err instanceof Error
          ? err.message
          : 'Errore temporaneo nella comunicazione con il backend.',
    };
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
