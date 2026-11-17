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
