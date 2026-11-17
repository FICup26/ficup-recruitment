import { doc, getDocFromServer } from 'firebase/firestore';
import { auth, db, DEFAULT_DATABASE_ID, EXPECTED_PROJECT_ID } from './firebase';

export interface DiagnosticFieldSnapshot {
  present: boolean;
  value: string | boolean | null;
  valueType: string;
}

export interface DiagnosticFieldsSummary {
  email: DiagnosticFieldSnapshot;
  nome: DiagnosticFieldSnapshot;
  ruolo: DiagnosticFieldSnapshot;
  attivo: DiagnosticFieldSnapshot;
  rawKeys: string[];
}

export interface SdkDiagnosticResult {
  completed: boolean;
  timedOut: boolean;
  durationMs: number;
  projectId: string;
  databaseId: string;
  path: string;
  exists: boolean | null;
  errorCode: string | null;
  errorMessage: string | null;
  fields: DiagnosticFieldsSummary | null;
}

export interface RestDiagnosticResult {
  completed: boolean;
  timedOut: boolean;
  durationMs: number;
  endpointPath: string;
  httpStatus: number | null;
  httpStatusText: string | null;
  exists: boolean | null;
  errorStatus: string | null;
  errorMessage: string | null;
  documentName: string | null;
  fields: DiagnosticFieldsSummary | null;
  sanitizedJson: string | null;
}

export interface FirestoreComparisonDiagnosticReport {
  executedAtIso: string;
  authState: {
    hasCurrentUser: boolean;
    uid: string | null;
    email: string | null;
    emailVerified: boolean;
    authStateReadySupported: boolean;
    tokenAcquired: boolean;
    tokenError: string | null;
  };
  sdk: SdkDiagnosticResult;
  rest: RestDiagnosticResult;
  differences: string[];
  conclusion: string;
}

const REQUEST_TIMEOUT_MS = 12000;

function extractSdkField(data: Record<string, unknown>, key: string): DiagnosticFieldSnapshot {
  if (!(key in data)) {
    return { present: false, value: null, valueType: 'missing' };
  }
  const raw = data[key];
  if (typeof raw === 'string' || typeof raw === 'boolean') {
    return { present: true, value: raw, valueType: typeof raw };
  }
  if (raw === null) {
    return { present: true, value: null, valueType: 'null' };
  }
  return { present: true, value: String(raw), valueType: typeof raw };
}

function summarizeSdkFields(data: Record<string, unknown>): DiagnosticFieldsSummary {
  return {
    email: extractSdkField(data, 'email'),
    nome: extractSdkField(data, 'nome'),
    ruolo: extractSdkField(data, 'ruolo'),
    attivo: extractSdkField(data, 'attivo'),
    rawKeys: Object.keys(data),
  };
}

type FirestoreRestTypedValue = {
  stringValue?: string;
  booleanValue?: boolean;
  integerValue?: string;
  doubleValue?: number;
  timestampValue?: string;
  nullValue?: unknown;
  [key: string]: unknown;
};

function extractRestField(
  fields: Record<string, FirestoreRestTypedValue>,
  key: string
): DiagnosticFieldSnapshot {
  if (!(key in fields)) {
    return { present: false, value: null, valueType: 'missing' };
  }
  const typed = fields[key] ?? {};
  const types = Object.keys(typed);
  const valueType = types[0] ?? 'unknown';
  if ('stringValue' in typed && typeof typed.stringValue === 'string') {
    return { present: true, value: typed.stringValue, valueType };
  }
  if ('booleanValue' in typed && typeof typed.booleanValue === 'boolean') {
    return { present: true, value: typed.booleanValue, valueType };
  }
  if ('nullValue' in typed) {
    return { present: true, value: null, valueType };
  }
  return { present: true, value: JSON.stringify(typed[valueType] ?? null), valueType };
}

function summarizeRestFields(
  fields: Record<string, FirestoreRestTypedValue>
): DiagnosticFieldsSummary {
  return {
    email: extractRestField(fields, 'email'),
    nome: extractRestField(fields, 'nome'),
    ruolo: extractRestField(fields, 'ruolo'),
    attivo: extractRestField(fields, 'attivo'),
    rawKeys: Object.keys(fields),
  };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`Timeout dopo ${timeoutMs} ms durante ${label}.`));
    }, timeoutMs);
    promise
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        window.clearTimeout(timer);
        reject(err);
      });
  });
}

/**
 * Diagnostica temporanea di sola lettura per confrontare nello stesso browser
 * autenticato la lettura SDK getDocFromServer() e la lettura REST autenticata.
 * Non stampa, salva o espone mai alcun token o credenziale.
 */
export async function runSuperAdminFirestoreDiagnostic(): Promise<FirestoreComparisonDiagnosticReport> {
  const executedAtIso = new Date().toISOString();

  if (!auth || !db) {
    return {
      executedAtIso,
      authState: {
        hasCurrentUser: false,
        uid: null,
        email: null,
        emailVerified: false,
        authStateReadySupported: false,
        tokenAcquired: false,
        tokenError: 'Servizi auth o db non inizializzati.',
      },
      sdk: {
        completed: false,
        timedOut: false,
        durationMs: 0,
        projectId: EXPECTED_PROJECT_ID,
        databaseId: DEFAULT_DATABASE_ID,
        path: 'amministratori/fabry.amoroso@gmail.com',
        exists: null,
        errorCode: 'unavailable',
        errorMessage: 'Istanza Firestore non disponibile.',
        fields: null,
      },
      rest: {
        completed: false,
        timedOut: false,
        durationMs: 0,
        endpointPath: `projects/${EXPECTED_PROJECT_ID}/databases/${DEFAULT_DATABASE_ID}/documents/amministratori/fabry.amoroso@gmail.com`,
        httpStatus: null,
        httpStatusText: null,
        exists: null,
        errorStatus: 'UNAVAILABLE',
        errorMessage: 'Istanza Auth non disponibile.',
        documentName: null,
        fields: null,
        sanitizedJson: null,
      },
      differences: ['Impossibile eseguire la diagnostica: auth o db non inizializzati.'],
      conclusion: 'Diagnostica non eseguita per mancata inizializzazione di Auth/Firestore.',
    };
  }

  const authStateReadySupported = typeof auth.authStateReady === 'function';
  if (authStateReadySupported) {
    try {
      await withTimeout(auth.authStateReady(), REQUEST_TIMEOUT_MS, 'auth.authStateReady()');
    } catch {
      // Prosegui controllando comunque auth.currentUser
    }
  }

  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.email) {
    return {
      executedAtIso,
      authState: {
        hasCurrentUser: Boolean(currentUser),
        uid: currentUser?.uid ?? null,
        email: currentUser?.email ?? null,
        emailVerified: Boolean(currentUser?.emailVerified),
        authStateReadySupported,
        tokenAcquired: false,
        tokenError: currentUser
          ? 'Utente autenticato privo di indirizzo email.'
          : 'Nessun utente autenticato in auth.currentUser.',
      },
      sdk: {
        completed: false,
        timedOut: false,
        durationMs: 0,
        projectId: EXPECTED_PROJECT_ID,
        databaseId: DEFAULT_DATABASE_ID,
        path: 'amministratori/fabry.amoroso@gmail.com',
        exists: null,
        errorCode: null,
        errorMessage: 'Lettura SDK non eseguita senza utente autenticato.',
        fields: null,
      },
      rest: {
        completed: false,
        timedOut: false,
        durationMs: 0,
        endpointPath: `projects/${EXPECTED_PROJECT_ID}/databases/${DEFAULT_DATABASE_ID}/documents/amministratori/fabry.amoroso@gmail.com`,
        httpStatus: null,
        httpStatusText: null,
        exists: null,
        errorStatus: null,
        errorMessage: 'Lettura REST non eseguita senza utente autenticato.',
        documentName: null,
        fields: null,
        sanitizedJson: null,
      },
      differences: ['Utente non autenticato o privo di email in auth.currentUser.'],
      conclusion: 'Effettua prima il login Google verificato per eseguire la diagnostica.',
    };
  }

  const targetDocId = currentUser.email;
  const docPath = `amministratori/${targetDocId}`;
  const dbInternal = db as unknown as { _databaseId?: { projectId?: string; database?: string } };
  const effectiveProjectId = dbInternal._databaseId?.projectId ?? db.app.options.projectId ?? EXPECTED_PROJECT_ID;
  const effectiveDatabaseId = dbInternal._databaseId?.database ?? DEFAULT_DATABASE_ID;

  // Token recuperato in memoria locale solo per l'header Bearer della richiesta REST, mai salvato né loggato
  let idToken: string | null = null;
  let tokenError: string | null = null;
  try {
    idToken = await withTimeout(currentUser.getIdToken(), REQUEST_TIMEOUT_MS, 'user.getIdToken()');
  } catch (err) {
    tokenError = err instanceof Error ? err.message : String(err);
  }

  // 1) Lettura diretta tramite Firebase Firestore SDK getDocFromServer()
  const sdkStart = performance.now();
  let sdkResult: SdkDiagnosticResult;
  try {
    const docRef = doc(db, 'amministratori', targetDocId);
    const snap = await withTimeout(
      getDocFromServer(docRef),
      REQUEST_TIMEOUT_MS,
      'getDocFromServer()'
    );
    const durationMs = Math.round(performance.now() - sdkStart);
    const exists = snap.exists();
    const rawData = exists ? (snap.data() as Record<string, unknown>) : null;
    sdkResult = {
      completed: true,
      timedOut: false,
      durationMs,
      projectId: effectiveProjectId,
      databaseId: effectiveDatabaseId,
      path: docRef.path,
      exists,
      errorCode: null,
      errorMessage: null,
      fields: rawData ? summarizeSdkFields(rawData) : null,
    };
  } catch (err) {
    const durationMs = Math.round(performance.now() - sdkStart);
    const message = err instanceof Error ? err.message : String(err);
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code?: unknown }).code)
        : null;
    sdkResult = {
      completed: false,
      timedOut: message.toLowerCase().includes('timeout'),
      durationMs,
      projectId: effectiveProjectId,
      databaseId: effectiveDatabaseId,
      path: docPath,
      exists: null,
      errorCode: code,
      errorMessage: message,
      fields: null,
    };
  }

  // 2) Lettura diretta tramite REST Firestore autenticata (fetch)
  const restEndpointPath = `projects/${EXPECTED_PROJECT_ID}/databases/${DEFAULT_DATABASE_ID}/documents/amministratori/${encodeURIComponent(
    targetDocId
  )}`;
  const restUrl = `https://firestore.googleapis.com/v1/${restEndpointPath}`;
  const restStart = performance.now();
  let restResult: RestDiagnosticResult;

  if (!idToken) {
    restResult = {
      completed: false,
      timedOut: false,
      durationMs: 0,
      endpointPath: `projects/${EXPECTED_PROJECT_ID}/databases/${DEFAULT_DATABASE_ID}/documents/${docPath}`,
      httpStatus: null,
      httpStatusText: null,
      exists: null,
      errorStatus: 'NO_TOKEN',
      errorMessage: tokenError ?? 'Token ID non disponibile.',
      documentName: null,
      fields: null,
      sanitizedJson: null,
    };
  } else {
    const controller = new AbortController();
    const abortTimer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(restUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
        signal: controller.signal,
      });
      window.clearTimeout(abortTimer);
      const durationMs = Math.round(performance.now() - restStart);
      const rawText = await response.text();
      let parsed: {
        name?: string;
        fields?: Record<string, FirestoreRestTypedValue>;
        createTime?: string;
        updateTime?: string;
        error?: { code?: number; message?: string; status?: string };
      } | null = null;
      try {
        parsed = JSON.parse(rawText);
      } catch {
        parsed = null;
      }

      if (response.ok && parsed) {
        const fieldsSummary = parsed.fields ? summarizeRestFields(parsed.fields) : null;
        restResult = {
          completed: true,
          timedOut: false,
          durationMs,
          endpointPath: `projects/${EXPECTED_PROJECT_ID}/databases/${DEFAULT_DATABASE_ID}/documents/${docPath}`,
          httpStatus: response.status,
          httpStatusText: response.statusText || 'OK',
          exists: Boolean(parsed.name || parsed.fields),
          errorStatus: null,
          errorMessage: null,
          documentName: parsed.name ?? null,
          fields: fieldsSummary,
          sanitizedJson: JSON.stringify(
            {
              name: parsed.name ?? null,
              createTime: parsed.createTime ?? null,
              updateTime: parsed.updateTime ?? null,
              fieldKeys: parsed.fields ? Object.keys(parsed.fields) : [],
              fields: parsed.fields ?? null,
            },
            null,
            2
          ),
        };
      } else {
        const errStatus = parsed?.error?.status ?? null;
        const errMsg = parsed?.error?.message ?? (rawText || response.statusText);
        restResult = {
          completed: true,
          timedOut: false,
          durationMs,
          endpointPath: `projects/${EXPECTED_PROJECT_ID}/databases/${DEFAULT_DATABASE_ID}/documents/${docPath}`,
          httpStatus: response.status,
          httpStatusText: response.statusText,
          exists: response.status === 404 ? false : null,
          errorStatus: errStatus,
          errorMessage: errMsg,
          documentName: null,
          fields: null,
          sanitizedJson: parsed ? JSON.stringify(parsed, null, 2) : rawText.slice(0, 1000),
        };
      }
    } catch (err) {
      window.clearTimeout(abortTimer);
      const durationMs = Math.round(performance.now() - restStart);
      const isAbort = err instanceof Error && err.name === 'AbortError';
      restResult = {
        completed: false,
        timedOut: isAbort,
        durationMs,
        endpointPath: `projects/${EXPECTED_PROJECT_ID}/databases/${DEFAULT_DATABASE_ID}/documents/${docPath}`,
        httpStatus: null,
        httpStatusText: null,
        exists: null,
        errorStatus: isAbort ? 'TIMEOUT' : 'NETWORK_ERROR',
        errorMessage: isAbort
          ? `Timeout richiesta REST dopo ${REQUEST_TIMEOUT_MS} ms.`
          : err instanceof Error
          ? err.message
          : String(err),
        documentName: null,
        fields: null,
        sanitizedJson: null,
      };
    } finally {
      idToken = null;
    }
  }

  // Confronto analitico tra SDK e REST
  const differences: string[] = [];
  if (sdkResult.exists !== restResult.exists) {
    differences.push(
      `Disallineamento esistenza documento: SDK exists=${String(sdkResult.exists)} mentre REST exists=${String(restResult.exists)} (HTTP ${String(restResult.httpStatus)}).`
    );
  }
  if (Boolean(sdkResult.errorCode) !== Boolean(restResult.errorStatus)) {
    differences.push(
      `Disallineamento errori: SDK error=${sdkResult.errorCode ?? 'nessuno'} vs REST status=${restResult.errorStatus ?? 'nessuno'} (HTTP ${String(restResult.httpStatus)}).`
    );
  }
  if (sdkResult.fields && restResult.fields) {
    for (const fieldName of ['email', 'nome', 'ruolo', 'attivo'] as const) {
      const sVal = sdkResult.fields[fieldName];
      const rVal = restResult.fields[fieldName];
      if (sVal.value !== rVal.value || sVal.present !== rVal.present) {
        differences.push(
          `Campo '${fieldName}' differente tra SDK (${String(sVal.value)} [${sVal.valueType}]) e REST (${String(rVal.value)} [${rVal.valueType}]).`
        );
      }
    }
  }

  let conclusion: string;
  if (sdkResult.exists === false && restResult.httpStatus === 200 && restResult.exists === true) {
    conclusion =
      'DISCREPANZA CONFERMATA: il server restituisce il documento via REST autenticata (HTTP 200), mentre il client SDK getDocFromServer() riceve exists=false.';
  } else if (sdkResult.exists === false && restResult.httpStatus === 404) {
    conclusion =
      `DOCUMENTO ASSENTE SUL SERVER: sia SDK getDocFromServer() sia REST autenticata (HTTP 404) confermano che '${docPath}' non esiste su '${effectiveProjectId}' / '${effectiveDatabaseId}'.`;
  } else if (sdkResult.exists === true && restResult.httpStatus === 200 && restResult.exists === true) {
    conclusion =
      'LETTURA COERENTE: sia SDK getDocFromServer() sia REST autenticata (HTTP 200) trovano il documento sul server.';
  } else if (restResult.httpStatus === 403 || sdkResult.errorCode === 'permission-denied') {
    conclusion =
      `BLOCCO PERMESSI/REGOLE: HTTP ${String(restResult.httpStatus)} / SDK '${sdkResult.errorCode ?? 'nessuno'}'. Verifica le Firestore Rules pubblicate.`;
  } else {
    conclusion =
      'Esito misto o errore di rete/autenticazione: verifica i dettagli separati di SDK e REST qui sopra.';
  }

  return {
    executedAtIso,
    authState: {
      hasCurrentUser: true,
      uid: currentUser.uid,
      email: currentUser.email,
      emailVerified: currentUser.emailVerified,
      authStateReadySupported,
      tokenAcquired: tokenError === null,
      tokenError,
    },
    sdk: sdkResult,
    rest: restResult,
    differences,
    conclusion,
  };
}
