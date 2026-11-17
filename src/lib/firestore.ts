import {
  addDoc,
  collection,
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
  nomeSquadra: string;
  note?: string;
  consensoPrivacy: boolean;
  versioneInformativa: string;
}

export interface CandidaturaRecord {
  id: string;
  codiceCandidatura: string;
  nome: string;
  cognome: string;
  emailFantaleghe: string;
  nomeSquadra: string;
  note: string;
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

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
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
  console.error('Firestore Error:', JSON.stringify(errInfo));
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

export function validateCandidaturaInput(input: CandidaturaInput): CandidaturaInput {
  const nome = input.nome.trim().slice(0, 80);
  const cognome = input.cognome.trim().slice(0, 80);
  const emailFantaleghe = input.emailFantaleghe.trim().toLowerCase().slice(0, 160);
  const nomeSquadra = input.nomeSquadra.trim().slice(0, 80);
  const note = (input.note ?? '').trim().slice(0, 1000);
  const versioneInformativa = input.versioneInformativa.trim().slice(0, 32) || '2026.1';

  if (nome.length < 1) {
    throw new Error('Inserire un nome valido.');
  }
  if (cognome.length < 1) {
    throw new Error('Inserire un cognome valido.');
  }
  if (!EMAIL_REGEX.test(emailFantaleghe) || emailFantaleghe.length < 5) {
    throw new Error("Inserire un indirizzo email Fantaleghe valido.");
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
    nomeSquadra,
    note,
    consensoPrivacy: true,
    versioneInformativa,
  };
}

export async function submitCandidatura(
  input: CandidaturaInput
): Promise<{ id: string; codiceCandidatura: string }> {
  const firestore = requireDb();
  const clean = validateCandidaturaInput(input);
  const codiceCandidatura = generateCandidaturaCode();
  const collectionPath = 'candidature';

  try {
    const docRef = await addDoc(collection(firestore, collectionPath), {
      codiceCandidatura,
      nome: clean.nome,
      cognome: clean.cognome,
      emailFantaleghe: clean.emailFantaleghe,
      nomeSquadra: clean.nomeSquadra,
      note: clean.note ?? '',
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
  return {
    id,
    codiceCandidatura: String(data.codiceCandidatura ?? ''),
    nome: String(data.nome ?? ''),
    cognome: String(data.cognome ?? ''),
    emailFantaleghe: String(data.emailFantaleghe ?? ''),
    nomeSquadra: String(data.nomeSquadra ?? ''),
    note: String(data.note ?? ''),
    stato: (STATI_CANDIDATURA.includes(data.stato as CandidaturaStato)
      ? data.stato
      : 'NUOVO') as CandidaturaStato,
    noteInterne: String(data.noteInterne ?? ''),
    consensoPrivacy: Boolean(data.consensoPrivacy),
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
    handleFirestoreError(error, OperationType.LIST, path);
  }
}
