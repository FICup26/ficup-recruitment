export interface IntroVideoCompletionRecord {
  candidateKey: string;
  codiceCandidatura: string;
  emailFantaleghe: string;
  videoOpened: boolean;
  videoCompleted: boolean;
  userConfirmed: boolean;
  openedAtIso: string | null;
  completedAtIso: string | null;
  confirmedAtIso: string | null;
}

const STORAGE_KEY = 'ficup_intro_video_completion_v1';
const MAX_STORED_CANDIDATES = 25;

export function buildCandidateVideoKey(
  codiceCandidatura: string,
  emailFantaleghe?: string
): string {
  const cleanCode = codiceCandidatura.trim().toUpperCase();
  const cleanEmail = (emailFantaleghe ?? '').trim().toLowerCase();
  return cleanEmail ? `${cleanCode}::${cleanEmail}` : cleanCode;
}

/**
 * Costruisce il link al Gruppo WhatsApp Provvisorio con messaggio precompilato
 * contenente il codice personale della candidatura, preservando eventuali parametri
 * già presenti nell'URL di invito.
 */
export function buildProvisionalWhatsappUrl(
  baseUrl: string,
  codiceCandidatura: string
): string {
  const trimmedBase = baseUrl.trim();
  if (!trimmedBase) {
    return '';
  }
  const cleanCode = codiceCandidatura.trim().toUpperCase() || 'FICUP26';
  const prefilledText = `Ciao a tutti! Ho appena inviato la richiesta per entrare in FICUP. Il mio codice candidatura è: ${cleanCode}.`;

  try {
    const parsed = new URL(trimmedBase);
    parsed.searchParams.set('text', prefilledText);
    return parsed.toString();
  } catch {
    const separator = trimmedBase.includes('?') ? '&' : '?';
    return `${trimmedBase}${separator}text=${encodeURIComponent(prefilledText)}`;
  }
}

export function isProvisionalWhatsappUnlockedByVideo(
  record: IntroVideoCompletionRecord | null | undefined
): boolean {
  if (!record) {
    return false;
  }
  return Boolean(record.videoOpened || record.videoCompleted);
}

function readAllRecords(): Record<string, IntroVideoCompletionRecord> {
  if (typeof window === 'undefined') {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    return parsed as Record<string, IntroVideoCompletionRecord>;
  } catch {
    return {};
  }
}

function writeAllRecords(records: Record<string, IntroVideoCompletionRecord>): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    const entries = Object.entries(records);
    const trimmed =
      entries.length > MAX_STORED_CANDIDATES
        ? Object.fromEntries(entries.slice(entries.length - MAX_STORED_CANDIDATES))
        : records;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage unavailable or quota exceeded
  }
}

export function loadIntroVideoCompletion(
  codiceCandidatura: string,
  emailFantaleghe?: string
): IntroVideoCompletionRecord | null {
  const cleanCode = codiceCandidatura.trim().toUpperCase();
  if (!cleanCode) {
    return null;
  }
  const records = readAllRecords();
  const fullKey = buildCandidateVideoKey(cleanCode, emailFantaleghe);
  const directMatch = records[fullKey] ?? records[cleanCode];
  if (
    directMatch &&
    (typeof directMatch.videoCompleted === 'boolean' ||
      typeof directMatch.videoOpened === 'boolean')
  ) {
    return {
      ...directMatch,
      videoOpened: Boolean(directMatch.videoOpened || directMatch.videoCompleted),
      videoCompleted: Boolean(directMatch.videoCompleted),
      userConfirmed: Boolean(
        directMatch.userConfirmed || directMatch.videoOpened || directMatch.videoCompleted
      ),
      openedAtIso: directMatch.openedAtIso ?? directMatch.completedAtIso ?? null,
    };
  }
  return null;
}

export function saveIntroVideoCompletion(params: {
  codiceCandidatura: string;
  emailFantaleghe?: string;
  videoOpened?: boolean;
  videoCompleted: boolean;
  userConfirmed: boolean;
}): IntroVideoCompletionRecord {
  const cleanCode = params.codiceCandidatura.trim().toUpperCase();
  const cleanEmail = (params.emailFantaleghe ?? '').trim().toLowerCase();
  const key = buildCandidateVideoKey(cleanCode, cleanEmail);
  const records = readAllRecords();
  const prev = records[key];
  const nowIso = new Date().toISOString();

  const opened = Boolean(params.videoOpened || params.videoCompleted || prev?.videoOpened);
  const completed = Boolean(params.videoCompleted || prev?.videoCompleted);
  const confirmed = Boolean(params.userConfirmed || opened || prev?.userConfirmed);

  const next: IntroVideoCompletionRecord = {
    candidateKey: key,
    codiceCandidatura: cleanCode,
    emailFantaleghe: cleanEmail,
    videoOpened: opened,
    videoCompleted: completed,
    userConfirmed: confirmed,
    openedAtIso: opened ? prev?.openedAtIso ?? nowIso : null,
    completedAtIso: completed ? prev?.completedAtIso ?? nowIso : null,
    confirmedAtIso: confirmed ? prev?.confirmedAtIso ?? nowIso : null,
  };

  records[key] = next;
  writeAllRecords(records);
  return next;
}
