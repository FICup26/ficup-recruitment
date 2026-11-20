import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  writeBatch,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { auth, db } from './firebase';

export const STATI_CANDIDATURA = [
  'NUOVO',
  'DA CONTATTARE',
  'APPROVATO',
  'INVITO INVIATO',
  'DA COMPLETARE',
  'COMPLETATO',
  'RESPINTO',
] as const;

export type CandidaturaStato = (typeof STATI_CANDIDATURA)[number];

export type AdminRuolo = 'SUPER_ADMIN' | 'STAFF';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  code?: string | null;
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export interface CandidaturaInput {
  nome: string;
  cognome: string;
  emailFantaleghe: string;
  cellulare: string;
  nomeSquadra: string;
  note?: string;
  consensoPrivacy: boolean;
  versioneInformativa: string;
  regolamentoAccettato?: boolean;
  regolamentoVersione?: string;
}

export interface CandidaturaRecord {
  id: string;
  codiceCandidatura: string;
  nome: string;
  cognome: string;
  emailFantaleghe: string;
  cellulare: string;
  nomeSquadra: string;
  note: string;
  regolamentoAccettatoNote: string;
  isCompleta: boolean;
  stato: CandidaturaStato;
  noteInterne: string;
  consensoPrivacy: boolean;
  versioneInformativa: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface AmministratoreRecord {
  id: string;
  email: string;
  nome: string;
  ruolo: AdminRuolo;
  attivo: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface ConfigurazionePublica {
  stagione: string;
  iscrizioniAperte: boolean;
  budgetIniziale: number;
  modalitaMercato: string;
  versioneInformativa: string;
  emailOperativa: string;
  linkWhatsappProvvisorio: string;
  linkWhatsappUfficiale: string;
  updatedAt: Date | null;
  updatedBy: string;
}

export interface StoricoOperazioneRecord {
  id: string;
  candidaturaId: string;
  codiceCandidatura: string;
  statoPrecedente: CandidaturaStato;
  statoNuovo: CandidaturaStato;
  notaOperazione: string;
  adminUid: string;
  adminEmail: string;
  createdAt: Date | null;
}

export interface EmailLogRecord {
  id: string;
  candidaturaId: string;
  codiceCandidatura: string;
  eventType: string;
  statoCandidatura: string;
  recipient: string;
  subject: string;
  status: 'PROCESSING' | 'SENT' | 'FAILED' | 'RETRY_EXHAUSTED' | 'SKIPPED_QUOTA' | string;
  attempts: number;
  maxAttempts: number;
  lastError: string;
  createdAt: Date | null;
  updatedAt: Date | null;
  sentAt: Date | null;
}

export const DEFAULT_PUBLIC_CONFIG: Omit<ConfigurazionePublica, 'updatedAt' | 'updatedBy'> = {
  stagione: '26/27',
  iscrizioniAperte: true,
  budgetIniziale: 250,
  modalitaMercato: 'ASTA LIBERA',
  versioneInformativa: '2026.1',
  emailOperativa: 'scudetto26@gmail.com',
  linkWhatsappProvvisorio: 'https://chat.whatsapp.com/CHGf7PH7hsDJhrgWpzsWUU?s=cl&p=a&iam=2',
  linkWhatsappUfficiale: '',
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function requireDb(): Firestore {
  if (!db) {
    throw new Error(
      'Cloud Firestore non inizializzato: verificare i parametri Web App Firebase del progetto candidature-ficup.'
    );
  }
  return db;
}

function toDateOrNull(value: unknown): Date | null {
  if (value instanceof Timestamp) {
    return value.toDate();
  }
  if (value instanceof Date) {
    return value;
  }
  return null;
}

function isPermissionDeniedError(error: unknown): boolean {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = String((error as { code?: unknown }).code).toLowerCase();
    if (code === 'permission-denied' || code === 'firestore/permission-denied') {
      return true;
    }
  }
  const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return msg.includes('missing or insufficient permissions') || msg.includes('permission-denied');
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
  options?: { suppressPermissionDeniedLog?: boolean }
): never {
  const currentUser = auth?.currentUser ?? null;
  const errorCode =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : null;
  const errInfo: FirestoreErrorInfo = {
    code: errorCode,
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: {
      userId: currentUser?.uid ?? null,
      email: currentUser?.email ?? null,
      emailVerified: currentUser?.emailVerified ?? null,
      isAnonymous: currentUser?.isAnonymous ?? null,
      tenantId: currentUser?.tenantId ?? null,
      providerInfo:
        currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) ?? [],
    },
  };
  if (!(options?.suppressPermissionDeniedLog && isPermissionDeniedError(error))) {
    console.error('Firestore Error:', JSON.stringify(errInfo));
  }
  throw new Error(JSON.stringify(errInfo));
}

export function generateCandidaturaCode(): string {
  const bytes = new Uint8Array(6);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let suffix = '';
  for (let i = 0; i < bytes.length; i += 1) {
    suffix += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return `FICUP26-${suffix}`;
}

const ITALIAN_MOBILE_REGEX = /^\+393\d{8,9}$/;
const PHONE_NOTE_TAG_REGEX = /^\[Cellulare:\s*([^\]]+)\]\s*$/i;
const REG_NOTE_TAG_REGEX = /^\[Regolamento FICUP 26\/27:\s*([^\]]+)\]\s*$/i;

export function normalizeAndValidateItalianPhone(raw: string): string {
  const cleaned = raw.trim().replace(/[\s\-().]/g, '');
  if (!cleaned) {
    throw new Error('Inserire un numero di cellulare obbligatorio con prefisso italiano +39.');
  }

  let normalized = cleaned;
  if (normalized.startsWith('0039')) {
    normalized = `+39${normalized.slice(4)}`;
  } else if (/^3\d{8,9}$/.test(normalized)) {
    normalized = `+39${normalized}`;
  } else if (/^393\d{8,9}$/.test(normalized)) {
    normalized = `+${normalized}`;
  }

  if (!ITALIAN_MOBILE_REGEX.test(normalized)) {
    throw new Error(
      'Inserire un numero di cellulare italiano valido con prefisso +39 (es. +39 340 123 4567).'
    );
  }

  const subscriber = normalized.slice(3);
  return `+39 ${subscriber.slice(0, 3)} ${subscriber.slice(3, 6)} ${subscriber.slice(6)}`;
}

export function encodeStructuredCandidaturaNote(params: {
  cellulare: string;
  regolamentoAccettato?: boolean;
  regolamentoVersione?: string;
  userNote?: string;
}): string {
  const headerLines: string[] = [`[Cellulare: ${params.cellulare.trim()}]`];
  if (params.regolamentoAccettato) {
    const nowLabel = new Intl.DateTimeFormat('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date());
    const versionLabel = (params.regolamentoVersione ?? '').trim() || '2026.1';
    headerLines.push(`[Regolamento FICUP 26/27: Accettato il ${nowLabel} (v${versionLabel})]`);
  }

  const headerBlock = headerLines.join('\n');
  const cleanUserNote = (params.userNote ?? '').trim();
  if (!cleanUserNote) {
    return headerBlock.slice(0, 1000);
  }

  const maxUserChars = Math.max(0, 1000 - headerBlock.length - 1);
  return `${headerBlock}\n${cleanUserNote.slice(0, maxUserChars)}`;
}

export function parseStructuredCandidaturaNote(rawNote: string): {
  cellulare: string;
  regolamentoAccettatoNote: string;
  cleanNote: string;
} {
  if (!rawNote) {
    return { cellulare: '', regolamentoAccettatoNote: '', cleanNote: '' };
  }

  const lines = rawNote.split(/\r?\n/);
  let cellulare = '';
  let regolamentoAccettatoNote = '';
  const remainingLines: string[] = [];

  for (const line of lines) {
    const phoneMatch = line.match(PHONE_NOTE_TAG_REGEX);
    if (phoneMatch?.[1] && !cellulare) {
      cellulare = phoneMatch[1].trim();
      continue;
    }
    const regMatch = line.match(REG_NOTE_TAG_REGEX);
    if (regMatch?.[1] && !regolamentoAccettatoNote) {
      regolamentoAccettatoNote = regMatch[1].trim();
      continue;
    }
    remainingLines.push(line);
  }

  return {
    cellulare,
    regolamentoAccettatoNote,
    cleanNote: remainingLines.join('\n').trim(),
  };
}

export function validateCandidaturaInput(input: CandidaturaInput): CandidaturaInput {
  const nome = input.nome.trim().slice(0, 80);
  const cognome = input.cognome.trim().slice(0, 80);
  const emailFantaleghe = input.emailFantaleghe.trim().toLowerCase().slice(0, 160);
  const cellulare = normalizeAndValidateItalianPhone(input.cellulare);
  const nomeSquadra = input.nomeSquadra.trim().slice(0, 80);
  const note = (input.note ?? '').trim().slice(0, 750);
  const versioneInformativa = input.versioneInformativa.trim().slice(0, 32) || '2026.1';

  if (nome.length < 1) {
    throw new Error('Inserire un nome valido.');
  }
  if (cognome.length < 1) {
    throw new Error('Inserire un cognome valido.');
  }
  if (!EMAIL_REGEX.test(emailFantaleghe) || emailFantaleghe.length < 5) {
    throw new Error('Inserire un indirizzo email Fantaleghe valido.');
  }
  if (nomeSquadra.length < 2) {
    throw new Error('Il nome della squadra deve contenere almeno 2 caratteri.');
  }
  if (!input.consensoPrivacy) {
    throw new Error('Il consenso al trattamento dei dati personali è obbligatorio.');
  }

  return {
    nome,
    cognome,
    emailFantaleghe,
    cellulare,
    nomeSquadra,
    note,
    consensoPrivacy: true,
    versioneInformativa,
    regolamentoAccettato: Boolean(input.regolamentoAccettato),
    regolamentoVersione: input.regolamentoVersione,
  };
}

export async function submitCandidatura(
  input: CandidaturaInput
): Promise<{ id: string; codiceCandidatura: string }> {
  const firestore = requireDb();
  const clean = validateCandidaturaInput(input);
  const codiceCandidatura = generateCandidaturaCode();
  const collectionPath = 'candidature';
  const encodedNote = encodeStructuredCandidaturaNote({
    cellulare: clean.cellulare,
    regolamentoAccettato: clean.regolamentoAccettato,
    regolamentoVersione: clean.regolamentoVersione,
    userNote: clean.note,
  });

  try {
    const docRef = await addDoc(collection(firestore, collectionPath), {
      codiceCandidatura,
      nome: clean.nome,
      cognome: clean.cognome,
      emailFantaleghe: clean.emailFantaleghe,
      nomeSquadra: clean.nomeSquadra,
      note: encodedNote,
      stato: 'NUOVO' as CandidaturaStato,
      noteInterne: '',
      consensoPrivacy: true,
      versioneInformativa: clean.versioneInformativa,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { id: docRef.id, codiceCandidatura };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, collectionPath);
  }
}

export async function getPublicConfig(): Promise<ConfigurazionePublica | null> {
  const firestore = requireDb();
  const path = 'configurazione/public';
  try {
    const snap = await getDoc(doc(firestore, 'configurazione', 'public'));
    if (!snap.exists()) {
      return null;
    }
    const data = snap.data();
    return {
      stagione: String(data.stagione ?? DEFAULT_PUBLIC_CONFIG.stagione),
      iscrizioniAperte: Boolean(data.iscrizioniAperte ?? DEFAULT_PUBLIC_CONFIG.iscrizioniAperte),
      budgetIniziale: Number(data.budgetIniziale ?? DEFAULT_PUBLIC_CONFIG.budgetIniziale),
      modalitaMercato: String(data.modalitaMercato ?? DEFAULT_PUBLIC_CONFIG.modalitaMercato),
      versioneInformativa: String(
        data.versioneInformativa ?? DEFAULT_PUBLIC_CONFIG.versioneInformativa
      ),
      emailOperativa: String(data.emailOperativa ?? DEFAULT_PUBLIC_CONFIG.emailOperativa),
      linkWhatsappProvvisorio: String(
        data.linkWhatsappProvvisorio ?? DEFAULT_PUBLIC_CONFIG.linkWhatsappProvvisorio
      ),
      // Il link ufficiale non viene mai esposto tramite configurazione pubblica
      linkWhatsappUfficiale: '',
      updatedAt: toDateOrNull(data.updatedAt),
      updatedBy: String(data.updatedBy ?? ''),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function getAdminConfig(): Promise<ConfigurazionePublica | null> {
  const firestore = requireDb();
  const privatePath = 'configurazione/private';
  try {
    const [privateSnap, publicSnap] = await Promise.all([
      getDoc(doc(firestore, 'configurazione', 'private')),
      getDoc(doc(firestore, 'configurazione', 'public')),
    ]);

    if (!privateSnap.exists() && !publicSnap.exists()) {
      return null;
    }

    const pubData = publicSnap.exists() ? publicSnap.data() : {};
    const privData = privateSnap.exists() ? privateSnap.data() : {};

    return {
      stagione: String(pubData.stagione ?? privData.stagione ?? DEFAULT_PUBLIC_CONFIG.stagione),
      iscrizioniAperte: Boolean(
        pubData.iscrizioniAperte ??
          privData.iscrizioniAperte ??
          DEFAULT_PUBLIC_CONFIG.iscrizioniAperte
      ),
      budgetIniziale: Number(
        pubData.budgetIniziale ?? privData.budgetIniziale ?? DEFAULT_PUBLIC_CONFIG.budgetIniziale
      ),
      modalitaMercato: String(
        pubData.modalitaMercato ??
          privData.modalitaMercato ??
          DEFAULT_PUBLIC_CONFIG.modalitaMercato
      ),
      versioneInformativa: String(
        pubData.versioneInformativa ??
          privData.versioneInformativa ??
          DEFAULT_PUBLIC_CONFIG.versioneInformativa
      ),
      emailOperativa: String(
        pubData.emailOperativa ?? privData.emailOperativa ?? DEFAULT_PUBLIC_CONFIG.emailOperativa
      ),
      linkWhatsappProvvisorio: String(
        pubData.linkWhatsappProvvisorio ??
          privData.linkWhatsappProvvisorio ??
          DEFAULT_PUBLIC_CONFIG.linkWhatsappProvvisorio
      ),
      linkWhatsappUfficiale: String(
        privData.linkWhatsappUfficiale ?? pubData.linkWhatsappUfficiale ?? ''
      ),
      updatedAt: toDateOrNull(privData.updatedAt ?? pubData.updatedAt),
      updatedBy: String(privData.updatedBy ?? pubData.updatedBy ?? ''),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, privatePath);
  }
}

export async function verifyAdminAuthorization(
  user: User
): Promise<AmministratoreRecord | null> {
  const firestore = requireDb();
  if (!user.email) {
    throw new Error('Account Google privo di indirizzo email associato.');
  }
  if (!user.emailVerified) {
    throw new Error(`L'indirizzo email '${user.email}' non risulta verificato su Firebase Authentication.`);
  }

  const candidateIds = Array.from(new Set([user.email, user.uid]));
  const notFoundPaths: string[] = [];
  let fieldValidationError: Error | null = null;
  let firstReadError: { error: unknown; path: string } | null = null;

  for (const candidateId of candidateIds) {
    const path = `amministratori/${candidateId}`;
    try {
      const snap = await getDocFromServer(doc(firestore, 'amministratori', candidateId));
      if (!snap.exists()) {
        notFoundPaths.push(path);
        continue;
      }

      const data = snap.data();
      if (typeof data.attivo !== 'boolean' || data.attivo !== true) {
        fieldValidationError = new Error(
          `Documento '${path}' presente su Firestore, ma il campo 'attivo' non supera la verifica (atteso boolean true, trovato ${typeof data.attivo}: ${JSON.stringify(data.attivo ?? null)}).`
        );
        continue;
      }

      if (data.ruolo !== 'SUPER_ADMIN' && data.ruolo !== 'STAFF') {
        fieldValidationError = new Error(
          `Documento '${path}' presente su Firestore, ma il campo 'ruolo' non supera la verifica (atteso 'SUPER_ADMIN' o 'STAFF', trovato ${typeof data.ruolo}: ${JSON.stringify(data.ruolo ?? null)}).`
        );
        continue;
      }

      return {
        id: snap.id,
        email: String(data.email ?? user.email),
        nome: String(data.nome ?? user.displayName ?? user.email),
        ruolo: data.ruolo,
        attivo: true,
        createdAt: toDateOrNull(data.createdAt),
        updatedAt: toDateOrNull(data.updatedAt),
      };
    } catch (error) {
      if (!firstReadError) {
        firstReadError = { error, path };
      }
    }
  }

  if (fieldValidationError) {
    throw fieldValidationError;
  }

  if (firstReadError) {
    handleFirestoreError(firstReadError.error, OperationType.GET, firstReadError.path);
  }

  throw new Error(
    `Documento amministratore non trovato su Firestore (percorsi verificati dal server: ${notFoundPaths.join(', ')}).`
  );
}

function mapCandidaturaDoc(id: string, data: Record<string, unknown>): CandidaturaRecord {
  const nome = String(data.nome ?? '');
  const cognome = String(data.cognome ?? '');
  const emailFantaleghe = String(data.emailFantaleghe ?? '');
  const nomeSquadra = String(data.nomeSquadra ?? '');
  const consensoPrivacy = Boolean(data.consensoPrivacy);
  const rawNote = String(data.note ?? '');
  const parsed = parseStructuredCandidaturaNote(rawNote);
  const isCompleta = Boolean(
    nome.trim().length >= 1 &&
      cognome.trim().length >= 1 &&
      EMAIL_REGEX.test(emailFantaleghe.trim()) &&
      nomeSquadra.trim().length >= 2 &&
      parsed.cellulare.trim().length > 0 &&
      consensoPrivacy
  );

  return {
    id,
    codiceCandidatura: String(data.codiceCandidatura ?? ''),
    nome,
    cognome,
    emailFantaleghe,
    cellulare: parsed.cellulare,
    nomeSquadra,
    note: parsed.cleanNote,
    regolamentoAccettatoNote: parsed.regolamentoAccettatoNote,
    isCompleta,
    stato: (STATI_CANDIDATURA.includes(data.stato as CandidaturaStato)
      ? data.stato
      : 'NUOVO') as CandidaturaStato,
    noteInterne: String(data.noteInterne ?? ''),
    consensoPrivacy,
    versioneInformativa: String(data.versioneInformativa ?? ''),
    createdAt: toDateOrNull(data.createdAt),
    updatedAt: toDateOrNull(data.updatedAt),
  };
}

export function subscribeCandidature(
  onData: (items: CandidaturaRecord[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const firestore = requireDb();
  const path = 'candidature';
  const q = query(collection(firestore, path), orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => mapCandidaturaDoc(d.id, d.data()));
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function updateCandidaturaByAdmin(params: {
  candidaturaId: string;
  codiceCandidatura: string;
  statoPrecedente: CandidaturaStato;
  statoNuovo: CandidaturaStato;
  noteInterne: string;
  notaOperazione?: string;
  adminUser: User;
}): Promise<void> {
  const firestore = requireDb();
  if (!params.adminUser.email) {
    throw new Error('Account amministratore privo di indirizzo email verificato.');
  }

  const candidaturaRef = doc(firestore, 'candidature', params.candidaturaId);
  const storicoRef = doc(collection(firestore, 'storico_operazioni'));
  const batch = writeBatch(firestore);

  batch.update(candidaturaRef, {
    stato: params.statoNuovo,
    noteInterne: params.noteInterne.trim().slice(0, 2000),
    updatedAt: serverTimestamp(),
  });

  if (params.statoPrecedente !== params.statoNuovo || params.notaOperazione?.trim()) {
    batch.set(storicoRef, {
      candidaturaId: params.candidaturaId,
      codiceCandidatura: params.codiceCandidatura,
      statoPrecedente: params.statoPrecedente,
      statoNuovo: params.statoNuovo,
      notaOperazione: (params.notaOperazione ?? '').trim().slice(0, 1000),
      adminUid: params.adminUser.uid,
      adminEmail: params.adminUser.email,
      createdAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `candidature/${params.candidaturaId}`);
  }
}

export async function fetchStoricoByCandidatura(
  candidaturaId: string
): Promise<StoricoOperazioneRecord[]> {
  const firestore = requireDb();
  const path = 'storico_operazioni';
  try {
    const q = query(
      collection(firestore, path),
      where('candidaturaId', '==', candidaturaId)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          candidaturaId: String(data.candidaturaId ?? ''),
          codiceCandidatura: String(data.codiceCandidatura ?? ''),
          statoPrecedente: data.statoPrecedente as CandidaturaStato,
          statoNuovo: data.statoNuovo as CandidaturaStato,
          notaOperazione: String(data.notaOperazione ?? ''),
          adminUid: String(data.adminUid ?? ''),
          adminEmail: String(data.adminEmail ?? ''),
          createdAt: toDateOrNull(data.createdAt),
        };
      })
      .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fetchAmministratori(): Promise<AmministratoreRecord[]> {
  const firestore = requireDb();
  const path = 'amministratori';
  try {
    const snap = await getDocs(collection(firestore, path));
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        email: String(data.email ?? ''),
        nome: String(data.nome ?? ''),
        ruolo: data.ruolo === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'STAFF',
        attivo: Boolean(data.attivo),
        createdAt: toDateOrNull(data.createdAt),
        updatedAt: toDateOrNull(data.updatedAt),
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function savePublicConfig(
  config: Omit<ConfigurazionePublica, 'updatedAt' | 'updatedBy'>,
  adminEmail: string
): Promise<void> {
  const firestore = requireDb();
  const path = 'configurazione/public';
  try {
    await setDoc(doc(firestore, 'configurazione', 'public'), {
      ...config,
      linkWhatsappUfficiale: '',
      updatedAt: serverTimestamp(),
      updatedBy: adminEmail,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveAdminConfig(
  config: Omit<ConfigurazionePublica, 'updatedAt' | 'updatedBy'>,
  adminEmail: string
): Promise<void> {
  const firestore = requireDb();
  const publicRef = doc(firestore, 'configurazione', 'public');
  const privateRef = doc(firestore, 'configurazione', 'private');
  const batch = writeBatch(firestore);

  batch.set(publicRef, {
    ...config,
    linkWhatsappUfficiale: '',
    updatedAt: serverTimestamp(),
    updatedBy: adminEmail,
  });

  batch.set(privateRef, {
    ...config,
    updatedAt: serverTimestamp(),
    updatedBy: adminEmail,
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'configurazione/private');
  }
}

export async function fetchEmailLogsByCandidatura(
  candidaturaId: string
): Promise<EmailLogRecord[]> {
  const firestore = requireDb();
  const path = 'email_logs';
  try {
    const q = query(
      collection(firestore, path),
      where('candidaturaId', '==', candidaturaId)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          candidaturaId: String(data.candidaturaId ?? ''),
          codiceCandidatura: String(data.codiceCandidatura ?? ''),
          eventType: String(data.eventType ?? ''),
          statoCandidatura: String(data.statoCandidatura ?? ''),
          recipient: String(data.recipient ?? ''),
          subject: String(data.subject ?? ''),
          status: String(data.status ?? ''),
          attempts: Number(data.attempts ?? 0),
          maxAttempts: Number(data.maxAttempts ?? 3),
          lastError: String(data.lastError ?? ''),
          createdAt: toDateOrNull(data.createdAt),
          updatedAt: toDateOrNull(data.updatedAt),
          sentAt: toDateOrNull(data.sentAt),
        };
      })
      .sort((a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path, {
      suppressPermissionDeniedLog: true,
    });
  }
}

// =============================================================================
// 1. ACCETTAZIONE DOCUMENTI CANDIDATO (/accettazioni_documenti/{candidaturaId})
// =============================================================================

export interface AccettazioneDocumentaleInput {
  candidaturaId: string;
  codiceCandidatura: string;
  emailFantaleghe: string;
  privacyAccettata: boolean;
  versionePrivacy: string;
  regolamentoAccettato: boolean;
  versioneRegolamento: string;
  regolamentoDocId: string;
  regoleChatAccettate: boolean;
  versioneRegoleChat: string;
}

export interface AccettazioneDocumentaleRecord extends AccettazioneDocumentaleInput {
  id: string;
  acceptedAt: Date | null;
  createdAt: Date | null;
}

export async function saveAccettazioneDocumentale(
  input: AccettazioneDocumentaleInput
): Promise<boolean> {
  const firestore = requireDb();
  const path = `accettazioni_documenti/${input.candidaturaId}`;
  try {
    await setDoc(doc(firestore, 'accettazioni_documenti', input.candidaturaId), {
      candidaturaId: input.candidaturaId,
      codiceCandidatura: input.codiceCandidatura.trim().toUpperCase(),
      emailFantaleghe: input.emailFantaleghe.trim().toLowerCase(),
      privacyAccettata: Boolean(input.privacyAccettata),
      versionePrivacy: input.versionePrivacy.trim().slice(0, 32) || '2026.1',
      regolamentoAccettato: Boolean(input.regolamentoAccettato),
      versioneRegolamento:
        input.versioneRegolamento.trim().slice(0, 64) || 'in-attesa-pubblicazione',
      regolamentoDocId: input.regolamentoDocId.trim().slice(0, 128) || 'nessuno',
      regoleChatAccettate: Boolean(input.regoleChatAccettate),
      versioneRegoleChat: input.versioneRegoleChat.trim().slice(0, 32) || '2026.1',
      acceptedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    if (isPermissionDeniedError(error)) {
      return false;
    }
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function fetchAccettazioneByCandidatura(
  candidaturaId: string
): Promise<AccettazioneDocumentaleRecord | null> {
  const firestore = requireDb();
  const path = `accettazioni_documenti/${candidaturaId}`;
  try {
    const snap = await getDoc(doc(firestore, 'accettazioni_documenti', candidaturaId));
    if (!snap.exists()) {
      return null;
    }
    const d = snap.data();
    return {
      id: snap.id,
      candidaturaId: String(d.candidaturaId ?? snap.id),
      codiceCandidatura: String(d.codiceCandidatura ?? ''),
      emailFantaleghe: String(d.emailFantaleghe ?? ''),
      privacyAccettata: Boolean(d.privacyAccettata),
      versionePrivacy: String(d.versionePrivacy ?? ''),
      regolamentoAccettato: Boolean(d.regolamentoAccettato),
      versioneRegolamento: String(d.versioneRegolamento ?? ''),
      regolamentoDocId: String(d.regolamentoDocId ?? ''),
      regoleChatAccettate: Boolean(d.regoleChatAccettate),
      versioneRegoleChat: String(d.versioneRegoleChat ?? ''),
      acceptedAt: toDateOrNull(d.acceptedAt),
      createdAt: toDateOrNull(d.createdAt),
    };
  } catch (error) {
    if (isPermissionDeniedError(error)) {
      return null;
    }
    handleFirestoreError(error, OperationType.GET, path);
  }
}

// =============================================================================
// 2. DOCUMENTI UFFICIALI FICUP (/documenti_ufficiali + Firebase Storage)
// =============================================================================

export type DocumentoTipo = 'REGOLAMENTO' | 'REGOLE_CHAT';

export interface DocumentoUfficialeRecord {
  id: string;
  tipo: DocumentoTipo;
  titolo: string;
  versione: string;
  dataPubblicazione: string;
  fileName: string;
  storagePath: string;
  downloadUrl: string;
  fileSizeBytes: number;
  contenutoTesto: string;
  attivo: boolean;
  adminUid: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

function mapDocumentoUfficiale(
  id: string,
  d: Record<string, unknown>
): DocumentoUfficialeRecord {
  return {
    id,
    tipo: d.tipo === 'REGOLE_CHAT' ? 'REGOLE_CHAT' : 'REGOLAMENTO',
    titolo: String(d.titolo ?? ''),
    versione: String(d.versione ?? ''),
    dataPubblicazione: String(d.dataPubblicazione ?? ''),
    fileName: String(d.fileName ?? ''),
    storagePath: String(d.storagePath ?? ''),
    downloadUrl: String(d.downloadUrl ?? ''),
    fileSizeBytes: Number(d.fileSizeBytes ?? 0),
    contenutoTesto: String(d.contenutoTesto ?? ''),
    attivo: Boolean(d.attivo),
    adminUid: String(d.adminUid ?? ''),
    createdAt: toDateOrNull(d.createdAt),
    updatedAt: toDateOrNull(d.updatedAt),
  };
}

export const REGOLAMENTO_TESTO_MAX_LENGTH = 15000;

const FIRESTORE_DOCUMENTO_TIMEOUT_MS = 20000;

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string
): Promise<T> {
  let timerId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timerId = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timerId !== undefined) {
      clearTimeout(timerId);
    }
  }
}

/**
 * Legge in sicurezza il puntatore pubblico del documento ufficiale attivo
 * (`documenti_ufficiali/regolamento_attivo` oppure `regole_chat_attive`).
 * Ritorna null senza lanciare errori se il documento non esiste ancora o se
 * non risulta attualmente pubblicato (`attivo: false`).
 */
export async function fetchActivePublicDocument(
  pointerId: 'regolamento_attivo' | 'regole_chat_attive'
): Promise<DocumentoUfficialeRecord | null> {
  if (!db) {
    return null;
  }
  try {
    const snap = await withTimeout(
      getDoc(doc(db, 'documenti_ufficiali', pointerId)),
      10000,
      'Timeout lettura documento ufficiale pubblico.'
    );
    if (!snap.exists()) {
      return null;
    }
    const mapped = mapDocumentoUfficiale(snap.id, snap.data());
    if (!mapped.attivo) {
      return null;
    }
    return mapped;
  } catch {
    return null;
  }
}

export async function fetchDocumentiUfficialiHistory(): Promise<DocumentoUfficialeRecord[]> {
  const firestore = requireDb();
  const path = 'documenti_ufficiali';
  try {
    const snap = await withTimeout(
      getDocs(collection(firestore, path)),
      FIRESTORE_DOCUMENTO_TIMEOUT_MS,
      'Timeout durante il caricamento dello storico documenti su Cloud Firestore.'
    );
    return snap.docs
      .filter((d) => d.id !== 'regolamento_attivo' && d.id !== 'regole_chat_attive')
      .map((d) => mapDocumentoUfficiale(d.id, d.data()))
      .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path, {
      suppressPermissionDeniedLog: true,
    });
  }
}

export async function saveRegolamentoTextVersion(params: {
  titolo: string;
  versione: string;
  dataPubblicazione: string;
  contenutoTesto: string;
  setAsActive: boolean;
  adminUser: User;
}): Promise<DocumentoUfficialeRecord> {
  const firestore = requireDb();
  if (!params.adminUser?.uid) {
    throw new Error('Sessione staff non valida: effettua nuovamente il login.');
  }

  const cleanTitolo = params.titolo.trim().slice(0, 120);
  const cleanVersione = params.versione.trim().slice(0, 32);
  const cleanData = params.dataPubblicazione.trim().slice(0, 32);
  const cleanText = params.contenutoTesto.trim();

  if (!cleanTitolo) {
    throw new Error('Inserisci un titolo valido per il Regolamento ufficiale.');
  }
  if (!cleanVersione) {
    throw new Error('Inserisci il numero di versione del Regolamento.');
  }
  if (!cleanText) {
    throw new Error('Inserisci il testo del Regolamento ufficiale prima di salvare.');
  }
  if (cleanText.length > REGOLAMENTO_TESTO_MAX_LENGTH) {
    throw new Error(
      `Il testo supera il limite massimo consentito dalle regole Firestore (${REGOLAMENTO_TESTO_MAX_LENGTH} caratteri).`
    );
  }

  const versionRef = doc(collection(firestore, 'documenti_ufficiali'));
  const pointerRef = doc(firestore, 'documenti_ufficiali', 'regolamento_attivo');
  const payload = {
    tipo: 'REGOLAMENTO' as DocumentoTipo,
    titolo: cleanTitolo,
    versione: cleanVersione,
    dataPubblicazione: cleanData,
    fileName: '',
    storagePath: '',
    downloadUrl: '',
    fileSizeBytes: 0,
    contenutoTesto: cleanText,
    attivo: params.setAsActive,
    adminUid: params.adminUser.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    const batch = writeBatch(firestore);

    if (params.setAsActive) {
      const existingSnap = await withTimeout(
        getDocs(
          query(collection(firestore, 'documenti_ufficiali'), where('tipo', '==', 'REGOLAMENTO'))
        ),
        FIRESTORE_DOCUMENTO_TIMEOUT_MS,
        'Timeout durante la lettura delle versioni precedenti su Cloud Firestore.'
      );
      existingSnap.docs.forEach((d) => {
        if (d.id !== 'regolamento_attivo' && d.data().attivo === true) {
          batch.update(d.ref, { attivo: false, updatedAt: serverTimestamp() });
        }
      });
      batch.set(pointerRef, payload);
    }

    batch.set(versionRef, payload);
    await withTimeout(
      batch.commit(),
      FIRESTORE_DOCUMENTO_TIMEOUT_MS,
      'Timeout durante il salvataggio del regolamento su Cloud Firestore.'
    );

    return {
      id: versionRef.id,
      ...payload,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'documenti_ufficiali', {
      suppressPermissionDeniedLog: true,
    });
  }
}

export async function setActiveRegolamentoVersion(
  record: DocumentoUfficialeRecord,
  adminUser: User
): Promise<void> {
  const firestore = requireDb();
  const path = `documenti_ufficiali/${record.id}`;

  try {
    const existingSnap = await withTimeout(
      getDocs(
        query(collection(firestore, 'documenti_ufficiali'), where('tipo', '==', 'REGOLAMENTO'))
      ),
      FIRESTORE_DOCUMENTO_TIMEOUT_MS,
      'Timeout lettura versioni su Cloud Firestore.'
    );
    const batch = writeBatch(firestore);

    existingSnap.docs.forEach((d) => {
      if (d.id === 'regolamento_attivo') {
        return;
      }
      if (d.id === record.id) {
        batch.update(d.ref, {
          attivo: true,
          adminUid: adminUser.uid,
          updatedAt: serverTimestamp(),
        });
      } else if (d.data().attivo === true) {
        batch.update(d.ref, {
          attivo: false,
          adminUid: adminUser.uid,
          updatedAt: serverTimestamp(),
        });
      }
    });

    batch.set(doc(firestore, 'documenti_ufficiali', 'regolamento_attivo'), {
      tipo: 'REGOLAMENTO' as DocumentoTipo,
      titolo: record.titolo,
      versione: record.versione,
      dataPubblicazione: record.dataPubblicazione,
      fileName: record.fileName,
      storagePath: record.storagePath,
      downloadUrl: record.downloadUrl,
      fileSizeBytes: record.fileSizeBytes,
      contenutoTesto: record.contenutoTesto,
      attivo: true,
      adminUid: adminUser.uid,
      createdAt: record.createdAt ? Timestamp.fromDate(record.createdAt) : serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await withTimeout(
      batch.commit(),
      FIRESTORE_DOCUMENTO_TIMEOUT_MS,
      'Timeout aggiornamento versione attiva su Cloud Firestore.'
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path, {
      suppressPermissionDeniedLog: true,
    });
  }
}

export async function deactivateActiveRegolamentoVersion(
  record: DocumentoUfficialeRecord,
  adminUser: User
): Promise<void> {
  const firestore = requireDb();
  const path = `documenti_ufficiali/${record.id}`;

  try {
    const existingSnap = await withTimeout(
      getDocs(
        query(collection(firestore, 'documenti_ufficiali'), where('tipo', '==', 'REGOLAMENTO'))
      ),
      FIRESTORE_DOCUMENTO_TIMEOUT_MS,
      'Timeout lettura versioni su Cloud Firestore.'
    );
    const batch = writeBatch(firestore);

    existingSnap.docs.forEach((d) => {
      if (d.id === 'regolamento_attivo') {
        return;
      }
      if (d.id === record.id || d.data().attivo === true) {
        batch.update(d.ref, {
          attivo: false,
          adminUid: adminUser.uid,
          updatedAt: serverTimestamp(),
        });
      }
    });

    batch.set(doc(firestore, 'documenti_ufficiali', 'regolamento_attivo'), {
      tipo: 'REGOLAMENTO' as DocumentoTipo,
      titolo: record.titolo,
      versione: record.versione,
      dataPubblicazione: record.dataPubblicazione,
      fileName: record.fileName,
      storagePath: record.storagePath,
      downloadUrl: record.downloadUrl,
      fileSizeBytes: record.fileSizeBytes,
      contenutoTesto: record.contenutoTesto,
      attivo: false,
      adminUid: adminUser.uid,
      createdAt: record.createdAt ? Timestamp.fromDate(record.createdAt) : serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await withTimeout(
      batch.commit(),
      FIRESTORE_DOCUMENTO_TIMEOUT_MS,
      'Timeout disattivazione regolamento su Cloud Firestore.'
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path, {
      suppressPermissionDeniedLog: true,
    });
  }
}

export async function saveActiveChatRulesDocument(params: {
  titolo: string;
  versione: string;
  contenutoTesto: string;
  adminUser: User;
}): Promise<void> {
  const firestore = requireDb();
  const path = 'documenti_ufficiali/regole_chat_attive';
  const payload = {
    tipo: 'REGOLE_CHAT' as DocumentoTipo,
    titolo: params.titolo.trim().slice(0, 120) || 'Regole Ufficiali Chat WhatsApp FICUP',
    versione: params.versione.trim().slice(0, 32) || '2026.1',
    dataPubblicazione: new Date().toISOString().slice(0, 10),
    fileName: '',
    storagePath: '',
    downloadUrl: '',
    fileSizeBytes: 0,
    contenutoTesto: params.contenutoTesto.trim().slice(0, 15000),
    attivo: true,
    adminUid: params.adminUser.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    const batch = writeBatch(firestore);
    batch.set(doc(firestore, 'documenti_ufficiali', 'regole_chat_attive'), payload);
    batch.set(doc(collection(firestore, 'documenti_ufficiali')), payload);
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path, {
      suppressPermissionDeniedLog: true,
    });
  }
}

// =============================================================================
// 3. GESTIONE ACCESSI WHATSAPP (/whatsapp_gruppi & /whatsapp_autorizzazioni)
// =============================================================================

export type WhatsappGruppoCategoria = 'UFFICIALE' | 'CATEGORIA' | 'PROVVISORIO' | 'ALTRO';
export type WhatsappAutorizzazioneStato =
  | 'NON_AUTORIZZATO'
  | 'IN_ATTESA'
  | 'AUTORIZZATO'
  | 'REVOCATO';

export interface WhatsappGruppoRecord {
  id: string;
  nome: string;
  categoria: WhatsappGruppoCategoria;
  descrizione: string;
  squadraAssociata: string;
  linkInvito: string;
  attivo: boolean;
  updatedBy: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface WhatsappAutorizzazioneRecord {
  id: string;
  candidaturaId: string;
  codiceCandidatura: string;
  statoAutorizzazione: WhatsappAutorizzazioneStato;
  gruppoId: string;
  gruppoNome: string;
  linkAssegnato: string;
  squadraAssegnataZonaVar: string;
  autorizzatoDaEmail: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export type SimplifiedCandidaturaStato = 'DA VERIFICARE' | 'COMPLETATO' | 'RESPINTO';

export function isEffectiveWaAuthorized(
  c: Pick<CandidaturaRecord, 'stato'>,
  waAuth?: Pick<WhatsappAutorizzazioneRecord, 'statoAutorizzazione'> | null
): boolean {
  if (waAuth?.statoAutorizzazione === 'REVOCATO') {
    return false;
  }
  if (waAuth?.statoAutorizzazione === 'NON_AUTORIZZATO' || waAuth?.statoAutorizzazione === 'IN_ATTESA') {
    return false;
  }
  if (waAuth?.statoAutorizzazione === 'AUTORIZZATO') {
    return true;
  }
  return c.stato === 'COMPLETATO';
}

export function resolveSimplifiedCandidaturaStato(
  c: Pick<CandidaturaRecord, 'stato'>,
  waAuth?: Pick<WhatsappAutorizzazioneRecord, 'statoAutorizzazione'> | null
): SimplifiedCandidaturaStato {
  if (c.stato === 'RESPINTO') {
    return 'RESPINTO';
  }
  if (c.stato === 'COMPLETATO' && isEffectiveWaAuthorized(c, waAuth)) {
    return 'COMPLETATO';
  }
  return 'DA VERIFICARE';
}

export async function fetchWhatsappGruppi(options?: {
  silentOnPermissionDenied?: boolean;
}): Promise<WhatsappGruppoRecord[]> {
  const firestore = requireDb();
  const path = 'whatsapp_gruppi';
  try {
    const snap = await getDocs(collection(firestore, path));
    return snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          nome: String(data.nome ?? ''),
          categoria: (['UFFICIALE', 'CATEGORIA', 'PROVVISORIO', 'ALTRO'].includes(
            String(data.categoria)
          )
            ? data.categoria
            : 'UFFICIALE') as WhatsappGruppoCategoria,
          descrizione: String(data.descrizione ?? ''),
          squadraAssociata: String(data.squadraAssociata ?? ''),
          linkInvito: String(data.linkInvito ?? ''),
          attivo: Boolean(data.attivo),
          updatedBy: String(data.updatedBy ?? ''),
          createdAt: toDateOrNull(data.createdAt),
          updatedAt: toDateOrNull(data.updatedAt),
        };
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
  } catch (error) {
    if (options?.silentOnPermissionDenied && isPermissionDeniedError(error)) {
      return [];
    }
    handleFirestoreError(error, OperationType.LIST, path, {
      suppressPermissionDeniedLog: true,
    });
  }
}

export async function saveWhatsappGruppo(params: {
  id?: string;
  nome: string;
  categoria: WhatsappGruppoCategoria;
  descrizione: string;
  squadraAssociata: string;
  linkInvito: string;
  attivo: boolean;
  adminEmail: string;
}): Promise<string> {
  const firestore = requireDb();
  const targetRef = params.id
    ? doc(firestore, 'whatsapp_gruppi', params.id)
    : doc(collection(firestore, 'whatsapp_gruppi'));
  const path = `whatsapp_gruppi/${targetRef.id}`;

  const cleanUrl = params.linkInvito.trim().slice(0, 300);
  if (!/^https:\/\/chat\.whatsapp\.com\//i.test(cleanUrl)) {
    throw new Error(
      'Inserisci un link WhatsApp valido che inizi con https://chat.whatsapp.com/...'
    );
  }

  try {
    if (params.id) {
      await setDoc(
        targetRef,
        {
          nome: params.nome.trim().slice(0, 100),
          categoria: params.categoria,
          descrizione: params.descrizione.trim().slice(0, 400),
          squadraAssociata: params.squadraAssociata.trim().slice(0, 100),
          linkInvito: cleanUrl,
          attivo: params.attivo,
          updatedBy: params.adminEmail,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } else {
      await setDoc(targetRef, {
        nome: params.nome.trim().slice(0, 100),
        categoria: params.categoria,
        descrizione: params.descrizione.trim().slice(0, 400),
        squadraAssociata: params.squadraAssociata.trim().slice(0, 100),
        linkInvito: cleanUrl,
        attivo: params.attivo,
        updatedBy: params.adminEmail,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    return targetRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path, {
      suppressPermissionDeniedLog: true,
    });
  }
}

export async function deleteWhatsappGruppo(groupId: string): Promise<void> {
  const firestore = requireDb();
  const path = `whatsapp_gruppi/${groupId}`;
  try {
    await deleteDoc(doc(firestore, 'whatsapp_gruppi', groupId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path, {
      suppressPermissionDeniedLog: true,
    });
  }
}

export async function fetchWhatsappAutorizzazioniMap(): Promise<
  Record<string, WhatsappAutorizzazioneRecord>
> {
  const firestore = requireDb();
  const path = 'whatsapp_autorizzazioni';
  try {
    const snap = await getDocs(collection(firestore, path));
    const map: Record<string, WhatsappAutorizzazioneRecord> = {};
    snap.docs.forEach((d) => {
      const data = d.data();
      map[d.id] = {
        id: d.id,
        candidaturaId: String(data.candidaturaId ?? d.id),
        codiceCandidatura: String(data.codiceCandidatura ?? ''),
        statoAutorizzazione: (['NON_AUTORIZZATO', 'IN_ATTESA', 'AUTORIZZATO', 'REVOCATO'].includes(
          String(data.statoAutorizzazione)
        )
          ? data.statoAutorizzazione
          : 'NON_AUTORIZZATO') as WhatsappAutorizzazioneStato,
        gruppoId: String(data.gruppoId ?? ''),
        gruppoNome: String(data.gruppoNome ?? ''),
        linkAssegnato: String(data.linkAssegnato ?? ''),
        squadraAssegnataZonaVar: String(data.squadraAssegnataZonaVar ?? ''),
        autorizzatoDaEmail: String(data.autorizzatoDaEmail ?? ''),
        createdAt: toDateOrNull(data.createdAt),
        updatedAt: toDateOrNull(data.updatedAt),
      };
    });
    return map;
  } catch (error) {
    if (isPermissionDeniedError(error)) {
      return {};
    }
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fetchWhatsappAutorizzazioneByCandidatura(
  candidaturaId: string
): Promise<WhatsappAutorizzazioneRecord | null> {
  const firestore = requireDb();
  const path = `whatsapp_autorizzazioni/${candidaturaId}`;
  try {
    const snap = await getDoc(doc(firestore, 'whatsapp_autorizzazioni', candidaturaId));
    if (!snap.exists()) {
      return null;
    }
    const data = snap.data();
    return {
      id: snap.id,
      candidaturaId: String(data.candidaturaId ?? snap.id),
      codiceCandidatura: String(data.codiceCandidatura ?? ''),
      statoAutorizzazione: (['NON_AUTORIZZATO', 'IN_ATTESA', 'AUTORIZZATO', 'REVOCATO'].includes(
        String(data.statoAutorizzazione)
      )
        ? data.statoAutorizzazione
        : 'NON_AUTORIZZATO') as WhatsappAutorizzazioneStato,
      gruppoId: String(data.gruppoId ?? ''),
      gruppoNome: String(data.gruppoNome ?? ''),
      linkAssegnato: String(data.linkAssegnato ?? ''),
      squadraAssegnataZonaVar: String(data.squadraAssegnataZonaVar ?? ''),
      autorizzatoDaEmail: String(data.autorizzatoDaEmail ?? ''),
      createdAt: toDateOrNull(data.createdAt),
      updatedAt: toDateOrNull(data.updatedAt),
    };
  } catch (error) {
    if (isPermissionDeniedError(error)) {
      return null;
    }
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function saveWhatsappAutorizzazioneByAdmin(params: {
  candidaturaId: string;
  codiceCandidatura: string;
  statoCandidaturaCorrente: CandidaturaStato;
  statoAutorizzazione: WhatsappAutorizzazioneStato;
  gruppoId: string;
  gruppoNome: string;
  linkAssegnato: string;
  squadraAssegnataZonaVar: string;
  adminUser: User;
}): Promise<void> {
  const firestore = requireDb();
  if (!params.adminUser.email) {
    throw new Error('Account amministratore privo di indirizzo email verificato.');
  }
  const authRef = doc(firestore, 'whatsapp_autorizzazioni', params.candidaturaId);
  const storicoRef = doc(collection(firestore, 'storico_operazioni'));
  const path = `whatsapp_autorizzazioni/${params.candidaturaId}`;

  try {
    const existingSnap = await getDoc(authRef);
    const batch = writeBatch(firestore);
    const baseData = {
      candidaturaId: params.candidaturaId,
      codiceCandidatura: params.codiceCandidatura,
      statoAutorizzazione: params.statoAutorizzazione,
      gruppoId: params.gruppoId.trim().slice(0, 128),
      gruppoNome: params.gruppoNome.trim().slice(0, 120),
      linkAssegnato: params.linkAssegnato.trim().slice(0, 300),
      squadraAssegnataZonaVar: params.squadraAssegnataZonaVar.trim().slice(0, 120),
      autorizzatoDaEmail: params.adminUser.email,
      updatedAt: serverTimestamp(),
    };

    if (existingSnap.exists()) {
      batch.set(authRef, baseData, { merge: true });
    } else {
      batch.set(authRef, {
        ...baseData,
        createdAt: serverTimestamp(),
      });
    }

    batch.set(storicoRef, {
      candidaturaId: params.candidaturaId,
      codiceCandidatura: params.codiceCandidatura,
      statoPrecedente: params.statoCandidaturaCorrente,
      statoNuovo: params.statoCandidaturaCorrente,
      notaOperazione: `Accesso WhatsApp aggiornato (${params.statoAutorizzazione}${
        params.gruppoNome ? ` · ${params.gruppoNome}` : ''
      }${
        params.squadraAssegnataZonaVar ? ` · Squadra: ${params.squadraAssegnataZonaVar}` : ''
      })`.slice(0, 1000),
      adminUid: params.adminUser.uid,
      adminEmail: params.adminUser.email,
      createdAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path, {
      suppressPermissionDeniedLog: true,
    });
  }
}
