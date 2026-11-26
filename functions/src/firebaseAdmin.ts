import { randomInt } from 'node:crypto';
import { applicationDefault, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import {
  FIRESTORE_READ_TIMEOUT_MS,
  OFFICIAL_DATABASE_ID,
  OFFICIAL_PROJECT_ID,
  PORTAL_DATABASE_ID,
  PORTAL_PROJECT_ID,
} from './config';
import {
  assertAllowedOfficialDocPath,
  buildClubMatchKeys,
  normalizeLookupKey,
  resolveCanonicalLockId,
  TeamConflictError,
  type AllowedSerieKey,
  type OfficialClub,
  type ValidatedCandidaturaSubmission,
} from './whitelist';

const PORTAL_APP_NAME = 'portal-candidature';
const OFFICIAL_READONLY_APP_NAME = 'official-ficup-readonly';

export function getPortalApp(): App {
  const existing = getApps().find((app) => app.name === PORTAL_APP_NAME);
  if (existing) {
    return existing;
  }
  return initializeApp(
    {
      credential: applicationDefault(),
      projectId: PORTAL_PROJECT_ID,
    },
    PORTAL_APP_NAME
  );
}

export function getOfficialReadOnlyApp(): App {
  const existing = getApps().find((app) => app.name === OFFICIAL_READONLY_APP_NAME);
  if (existing) {
    return existing;
  }
  return initializeApp(
    {
      credential: applicationDefault(),
      projectId: OFFICIAL_PROJECT_ID,
    },
    OFFICIAL_READONLY_APP_NAME
  );
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(`Timeout lettura Firestore (${label}) dopo ${timeoutMs}ms.`);
      (err as Error & { statusCode?: number; code?: string }).statusCode = 504;
      (err as Error & { statusCode?: number; code?: string }).code = 'FIRESTORE_TIMEOUT';
      reject(err);
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  });
}

export interface OfficialDocSnapshotResult {
  path: string;
  exists: boolean;
  data: Record<string, unknown> | null;
}

/**
 * Strictly read-only Firestore reader for ficup-c9186.
 * Enforces the explicit collection/document whitelist BEFORE executing .get().
 * Exposes NO write/update/delete/query methods.
 */
export async function readWhitelistedOfficialDoc(
  docPath: string
): Promise<OfficialDocSnapshotResult> {
  const safePath = assertAllowedOfficialDocPath(docPath);
  const officialDb = getFirestore(getOfficialReadOnlyApp(), OFFICIAL_DATABASE_ID);
  const snap = await withTimeout(
    officialDb.doc(safePath).get(),
    FIRESTORE_READ_TIMEOUT_MS,
    safePath
  );

  if (!snap.exists) {
    return { path: safePath, exists: false, data: null };
  }
  return {
    path: safePath,
    exists: true,
    data: (snap.data() as Record<string, unknown>) ?? null,
  };
}

export interface VerifiedPortalAdmin {
  uid: string;
  email: string;
  ruolo: 'SUPER_ADMIN' | 'STAFF';
  nome: string;
}

export class AuthVerificationError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  constructor(message: string, statusCode = 401, code = 'UNAUTHORIZED') {
    super(message);
    this.name = 'AuthVerificationError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Verifies an existing Firebase Auth ID Token from candidature-ficup
 * and validates active staff/super-admin status in candidature-ficup/amministratori.
 */
export async function verifyPortalAdminFromHeader(
  authorizationHeader: string | undefined
): Promise<VerifiedPortalAdmin> {
  if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
    throw new AuthVerificationError(
      'Token di autenticazione Bearer mancante.',
      401,
      'UNAUTHORIZED'
    );
  }

  const idToken = authorizationHeader.slice('Bearer '.length).trim();
  if (!idToken || idToken.length > 8192) {
    throw new AuthVerificationError('Formato token non valido.', 401, 'INVALID_TOKEN');
  }

  const portalApp = getPortalApp();
  let decoded;
  try {
    decoded = await withTimeout(
      getAuth(portalApp).verifyIdToken(idToken),
      FIRESTORE_READ_TIMEOUT_MS,
      'verifyIdToken'
    );
  } catch {
    throw new AuthVerificationError(
      'Token Firebase Authentication non valido o scaduto.',
      401,
      'TOKEN_EXPIRED_OR_INVALID'
    );
  }

  if (!decoded.email_verified || !decoded.email) {
    throw new AuthVerificationError(
      'Indirizzo email amministratore non verificato.',
      403,
      'EMAIL_NOT_VERIFIED'
    );
  }

  const portalDb = getFirestore(portalApp, PORTAL_DATABASE_ID);
  const candidates = Array.from(new Set([decoded.uid, decoded.email]));

  for (const candidateId of candidates) {
    const snap = await withTimeout(
      portalDb.doc(`amministratori/${candidateId}`).get(),
      FIRESTORE_READ_TIMEOUT_MS,
      `amministratori/${candidateId}`
    );
    if (!snap.exists) {
      continue;
    }
    const data = snap.data() as Record<string, unknown> | undefined;
    if (
      data &&
      data.attivo === true &&
      (data.ruolo === 'SUPER_ADMIN' || data.ruolo === 'STAFF')
    ) {
      return {
        uid: decoded.uid,
        email: decoded.email,
        ruolo: data.ruolo,
        nome: typeof data.nome === 'string' && data.nome.trim() ? data.nome.trim() : decoded.email,
      };
    }
  }

  throw new AuthVerificationError(
    'Account autenticato ma privo di abilitazione attiva nella raccolta amministratori.',
    403,
    'FORBIDDEN_ADMIN'
  );
}

// =============================================================================
// Portal DB (candidature-ficup) Reservation State & Atomic Transaction Commit
// ZERO writes on ficup-c9186.
// =============================================================================

export interface CommitPortalCandidaturaResult {
  id: string;
  codiceCandidatura: string;
  accettazioneSyncedOnFirestore: boolean;
}

export interface PortalStateAdapter {
  readPortalReservationKeys: () => Promise<Set<string>>;
  isPortalRegistrationOpen: () => Promise<boolean>;
  commitCandidaturaWithTeamReservation: (params: {
    submission: ValidatedCandidaturaSubmission;
    verifiedClub: OfficialClub & { serieKey: AllowedSerieKey };
  }) => Promise<CommitPortalCandidaturaResult>;
  commitPortalFreeCandidatura: (params: {
    submission: ValidatedCandidaturaSubmission;
  }) => Promise<CommitPortalCandidaturaResult>;
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateServerCandidaturaCode(): string {
  let suffix = '';
  for (let i = 0; i < 6; i += 1) {
    suffix += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
  }
  return `FICUP26-${suffix}`;
}

function formatServerStructuredNote(
  submission: ValidatedCandidaturaSubmission,
  club?: OfficialClub | null
): string {
  const nowLabel = new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Rome',
  }).format(new Date());

  const headerLines = [
    `[Cellulare: ${submission.cellulare.trim()}]`,
    `[Regolamento FICUP 26/27: Accettato il ${nowLabel} (v${submission.regolamentoVersione})]`,
    `[Tipo Candidatura: ${submission.tipoCandidatura}]`,
  ];
  if (club && submission.tipoCandidatura !== 'LIBERA') {
    headerLines.push(
      `[Squadra Zona VAR: ${club.nome} | ID: ${club.clubId || club.id} | Serie: ${club.serie || club.serieKey}]`
    );
  }

  const headerBlock = headerLines.join('\n');
  const cleanUserNote = submission.note.trim();
  if (!cleanUserNote) {
    return headerBlock.slice(0, 1000);
  }
  const maxUserChars = Math.max(0, 1000 - headerBlock.length - 1);
  return `${headerBlock}\n${cleanUserNote.slice(0, maxUserChars)}`;
}

export async function readPortalReservationKeysFromFirestore(): Promise<Set<string>> {
  const portalDb = getFirestore(getPortalApp(), PORTAL_DATABASE_ID);
  const [locksSnap, waAuthSnap, candSnap] = await withTimeout(
    Promise.all([
      portalDb.collection('squadre_assegnate').get(),
      portalDb.collection('whatsapp_autorizzazioni').get(),
      portalDb.collection('candidature').get(),
    ]),
    FIRESTORE_READ_TIMEOUT_MS,
    'portal_reservation_keys'
  );

  const rejectedOrArchivedIds = new Set<string>();
  candSnap.docs.forEach((d) => {
    const data = d.data();
    if (data.stato === 'RESPINTO' || data.archiviata === true) {
      rejectedOrArchivedIds.add(d.id);
    }
  });

  const reservedKeys = new Set<string>();

  locksSnap.docs.forEach((d) => {
    const data = d.data();
    const statoAssegnazione =
      typeof data.statoAssegnazione === 'string' ? data.statoAssegnazione.toUpperCase() : 'RISERVATA';
    if (statoAssegnazione === 'RILASCIATA') {
      return;
    }
    const candId = typeof data.candidaturaId === 'string' ? data.candidaturaId : '';
    if (candId && rejectedOrArchivedIds.has(candId)) {
      return;
    }
    const fields = [data.lockId, data.clubId, data.id, data.normalizedKey, data.nomeSquadra];
    fields.forEach((val) => {
      if (typeof val === 'string' && val.trim()) {
        reservedKeys.add(normalizeLookupKey(val));
      }
    });
  });

  waAuthSnap.docs.forEach((d) => {
    const data = d.data();
    const candId = typeof data.candidaturaId === 'string' ? data.candidaturaId : d.id;
    if (candId && rejectedOrArchivedIds.has(candId)) {
      return;
    }
    const statoWa =
      typeof data.statoAutorizzazione === 'string' ? data.statoAutorizzazione.toUpperCase() : '';
    if (statoWa === 'REVOCATO') {
      return;
    }
    const squadra =
      typeof data.squadraAssegnataZonaVar === 'string' ? data.squadraAssegnataZonaVar.trim() : '';
    if (squadra) {
      reservedKeys.add(normalizeLookupKey(squadra));
    }
  });

  return reservedKeys;
}

export async function isPortalRegistrationOpenInFirestore(): Promise<boolean> {
  const portalDb = getFirestore(getPortalApp(), PORTAL_DATABASE_ID);
  const snap = await withTimeout(
    portalDb.doc('configurazione/public').get(),
    FIRESTORE_READ_TIMEOUT_MS,
    'configurazione/public'
  );
  if (!snap.exists) {
    return true;
  }
  const data = snap.data();
  return data?.iscrizioniAperte !== false;
}

export async function commitPortalCandidaturaTransactionInFirestore(params: {
  submission: ValidatedCandidaturaSubmission;
  verifiedClub: OfficialClub & { serieKey: AllowedSerieKey };
}): Promise<CommitPortalCandidaturaResult> {
  const portalDb = getFirestore(getPortalApp(), PORTAL_DATABASE_ID);
  const lockId = resolveCanonicalLockId(params.verifiedClub);
  const lockRef = portalDb.collection('squadre_assegnate').doc(lockId);
  const candidatureRef = portalDb.collection('candidature').doc();
  const accettazioneRef = portalDb.collection('accettazioni_documenti').doc(candidatureRef.id);
  const codiceCandidatura = generateServerCandidaturaCode();
  const clubMatchKeys = buildClubMatchKeys(params.verifiedClub);

  await withTimeout(
    portalDb.runTransaction(async (tx) => {
      const lockSnap = await tx.get(lockRef);
      if (lockSnap.exists) {
        const lockData = lockSnap.data() ?? {};
        const statoAssegnazione =
          typeof lockData.statoAssegnazione === 'string'
            ? lockData.statoAssegnazione.toUpperCase()
            : 'RISERVATA';

        if (statoAssegnazione !== 'RILASCIATA') {
          const existingCandId =
            typeof lockData.candidaturaId === 'string' ? lockData.candidaturaId : '';
          let existingLockReleased = false;
          if (existingCandId) {
            const linkedCandSnap = await tx.get(
              portalDb.collection('candidature').doc(existingCandId)
            );
            if (linkedCandSnap.exists) {
              const linkedData = linkedCandSnap.data() ?? {};
              if (linkedData.stato === 'RESPINTO' || linkedData.archiviata === true) {
                existingLockReleased = true;
              }
            }
          }
          if (!existingLockReleased) {
            throw new TeamConflictError(
              'Questa squadra è stata appena prenotata da un altro candidato. Seleziona una squadra diversa dalla lista aggiornata.',
              'TEAM_ALREADY_ASSIGNED'
            );
          }
        }
      }

      const now = FieldValue.serverTimestamp();
      const nomeSquadra = params.verifiedClub.nome || params.verifiedClub.nomeClub;
      const encodedNote = formatServerStructuredNote(params.submission, params.verifiedClub);

      // Exact schema matching firestore.rules isValidCandidaturaCreate & isValidCandidaturaUpdate
      tx.set(candidatureRef, {
        codiceCandidatura,
        nome: params.submission.nome,
        cognome: params.submission.cognome,
        emailFantaleghe: params.submission.emailFantaleghe,
        nomeSquadra: nomeSquadra.slice(0, 80),
        note: encodedNote,
        stato: 'NUOVO',
        noteInterne: '',
        consensoPrivacy: true,
        versioneInformativa: params.submission.versioneInformativa,
        createdAt: now,
        updatedAt: now,
      });

      tx.set(accettazioneRef, {
        candidaturaId: candidatureRef.id,
        codiceCandidatura,
        emailFantaleghe: params.submission.emailFantaleghe,
        privacyAccettata: true,
        versionePrivacy: params.submission.versioneInformativa,
        regolamentoAccettato: true,
        versioneRegolamento: params.submission.regolamentoVersione,
        regolamentoDocId: params.submission.regolamentoDocId,
        regoleChatAccettate: true,
        versioneRegoleChat: params.submission.versioneRegoleChat,
        acceptedAt: now,
        createdAt: now,
      });

      tx.set(lockRef, {
        lockId,
        id: params.verifiedClub.id,
        clubId: params.verifiedClub.clubId,
        normalizedKey: clubMatchKeys[0] || normalizeLookupKey(nomeSquadra),
        matchKeys: clubMatchKeys,
        nomeSquadra: nomeSquadra.slice(0, 80),
        serie: params.verifiedClub.serie,
        serieKey: params.verifiedClub.serieKey,
        candidaturaId: candidatureRef.id,
        codiceCandidatura,
        statoAssegnazione: 'RISERVATA',
        createdAt: now,
        updatedAt: now,
      });
    }),
    FIRESTORE_READ_TIMEOUT_MS,
    `transaction:${lockId}`
  );

  return {
    id: candidatureRef.id,
    codiceCandidatura,
    accettazioneSyncedOnFirestore: true,
  };
}

export async function commitPortalFreeCandidaturaInFirestore(params: {
  submission: ValidatedCandidaturaSubmission;
}): Promise<CommitPortalCandidaturaResult> {
  const portalDb = getFirestore(getPortalApp(), PORTAL_DATABASE_ID);
  const candidatureRef = portalDb.collection('candidature').doc();
  const accettazioneRef = portalDb.collection('accettazioni_documenti').doc(candidatureRef.id);
  const codiceCandidatura = generateServerCandidaturaCode();
  const batch = portalDb.batch();
  const now = FieldValue.serverTimestamp();
  const encodedNote = formatServerStructuredNote(params.submission, null);

  batch.set(candidatureRef, {
    codiceCandidatura,
    nome: params.submission.nome,
    cognome: params.submission.cognome,
    emailFantaleghe: params.submission.emailFantaleghe,
    nomeSquadra: 'CANDIDATURA LIBERA',
    note: encodedNote,
    stato: 'NUOVO',
    noteInterne: '',
    consensoPrivacy: true,
    versioneInformativa: params.submission.versioneInformativa,
    createdAt: now,
    updatedAt: now,
  });

  batch.set(accettazioneRef, {
    candidaturaId: candidatureRef.id,
    codiceCandidatura,
    emailFantaleghe: params.submission.emailFantaleghe,
    privacyAccettata: true,
    versionePrivacy: params.submission.versioneInformativa,
    regolamentoAccettato: true,
    versioneRegolamento: params.submission.regolamentoVersione,
    regolamentoDocId: params.submission.regolamentoDocId,
    regoleChatAccettate: true,
    versioneRegoleChat: params.submission.versioneRegoleChat,
    acceptedAt: now,
    createdAt: now,
  });

  await withTimeout(batch.commit(), FIRESTORE_READ_TIMEOUT_MS, 'commit_free_candidatura');

  return {
    id: candidatureRef.id,
    codiceCandidatura,
    accettazioneSyncedOnFirestore: true,
  };
}

export const defaultPortalStateAdapter: PortalStateAdapter = {
  readPortalReservationKeys: readPortalReservationKeysFromFirestore,
  isPortalRegistrationOpen: isPortalRegistrationOpenInFirestore,
  commitCandidaturaWithTeamReservation: commitPortalCandidaturaTransactionInFirestore,
  commitPortalFreeCandidatura: commitPortalFreeCandidaturaInFirestore,
};

