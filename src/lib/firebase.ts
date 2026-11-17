import { getApp, getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { getAnalytics, isSupported as isAnalyticsSupported, type Analytics } from 'firebase/analytics';
import { initializeAppCheck, ReCaptchaV3Provider, type AppCheck } from 'firebase/app-check';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore, initializeFirestore, type Firestore } from 'firebase/firestore';

export const EXPECTED_PROJECT_ID = 'candidature-ficup';
export const EXPECTED_PROJECT_NUMBER = '553639435764';
export const DEFAULT_DATABASE_ID = '(default)';

export interface FirebaseConfigCheck {
  configured: boolean;
  missingFields: string[];
  projectId: string;
  databaseId: string;
  hasMeasurementId: boolean;
  hasAppCheckKey: boolean;
}

export interface FirebaseServiceDiagnostic {
  ok: boolean;
  detail: string;
}

export interface FirebaseEnvironmentDiagnostics {
  config: FirebaseConfigCheck;
  appInitialized: FirebaseServiceDiagnostic;
  firestore: FirebaseServiceDiagnostic;
  auth: FirebaseServiceDiagnostic;
  appCheck: FirebaseServiceDiagnostic;
}

function trimEnv(value: string | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

const measurementId = trimEnv(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID);

const rawConfig: FirebaseOptions = {
  apiKey: trimEnv(import.meta.env.VITE_FIREBASE_API_KEY),
  authDomain: trimEnv(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
  projectId: trimEnv(import.meta.env.VITE_FIREBASE_PROJECT_ID),
  storageBucket: trimEnv(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: trimEnv(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
  appId: trimEnv(import.meta.env.VITE_FIREBASE_APP_ID),
  ...(measurementId ? { measurementId } : {}),
};

const rawDatabaseId = trimEnv(import.meta.env.VITE_FIREBASE_DATABASE_ID);
const databaseId =
  rawDatabaseId && !/^G-[A-Z0-9]+$/i.test(rawDatabaseId) && rawDatabaseId !== measurementId
    ? rawDatabaseId
    : DEFAULT_DATABASE_ID;
const appCheckSiteKey = trimEnv(import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY);

const requiredFields: Array<{ key: keyof FirebaseOptions; envName: string }> = [
  { key: 'apiKey', envName: 'VITE_FIREBASE_API_KEY' },
  { key: 'authDomain', envName: 'VITE_FIREBASE_AUTH_DOMAIN' },
  { key: 'projectId', envName: 'VITE_FIREBASE_PROJECT_ID' },
  { key: 'storageBucket', envName: 'VITE_FIREBASE_STORAGE_BUCKET' },
  { key: 'messagingSenderId', envName: 'VITE_FIREBASE_MESSAGING_SENDER_ID' },
  { key: 'appId', envName: 'VITE_FIREBASE_APP_ID' },
];

const missingFields = requiredFields
  .filter(({ key }) => !rawConfig[key])
  .map(({ envName }) => envName);

export const firebaseConfigStatus: FirebaseConfigCheck = {
  configured: missingFields.length === 0,
  missingFields,
  projectId: rawConfig.projectId || '',
  databaseId,
  hasMeasurementId: Boolean(rawConfig.measurementId),
  hasAppCheckKey: Boolean(appCheckSiteKey),
};

export const isFirebaseConfigured = firebaseConfigStatus.configured;

let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;
let appCheckInstance: AppCheck | null = null;
let analyticsPromise: Promise<Analytics | null> | null = null;

if (isFirebaseConfigured) {
  appInstance = getApps().length > 0 ? getApp() : initializeApp(rawConfig);
  authInstance = getAuth(appInstance);

  const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
  if (isBrowser) {
    try {
      dbInstance = initializeFirestore(
        appInstance,
        { experimentalForceLongPolling: true },
        databaseId
      );
    } catch {
      dbInstance = getFirestore(appInstance, databaseId);
    }
  } else {
    dbInstance = getFirestore(appInstance, databaseId);
  }

  // TEST TEMPORANEO — APP CHECK DISABILITATO PER DIAGNOSI
  // if (isBrowser && appCheckSiteKey) {
  //   try {
  //     appCheckInstance = initializeAppCheck(appInstance, {
  //       provider: new ReCaptchaV3Provider(appCheckSiteKey),
  //       isTokenAutoRefreshEnabled: true,
  //     });
  //   } catch (error) {
  //     console.warn('Inizializzazione App Check non completata:', error);
  //   }
  // }
}

export const firebaseApp = appInstance;
export const auth = authInstance;
export const db = dbInstance;
export const appCheck = appCheckInstance;

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

/**
 * Inizializza Firebase Analytics in modo asincrono e opzionale senza mai
 * bloccare il rendering o lanciare eccezioni in WebView / browser con ad-blocker.
 */
export function initOptionalAnalytics(): Promise<Analytics | null> {
  if (!appInstance || !rawConfig.measurementId || typeof window === 'undefined') {
    return Promise.resolve(null);
  }
  if (!analyticsPromise) {
    analyticsPromise = isAnalyticsSupported()
      .then((supported) => (supported && appInstance ? getAnalytics(appInstance) : null))
      .catch(() => null);
  }
  return analyticsPromise;
}

/**
 * Esegue una verifica reale e separata dei servizi Firebase configurati.
 * Non simula connessioni e non dichiara successo se mancano i parametri Web App.
 */
export async function verifyFirebaseServices(): Promise<FirebaseEnvironmentDiagnostics> {
  if (!isFirebaseConfigured || !appInstance || !dbInstance || !authInstance) {
    return {
      config: firebaseConfigStatus,
      appInitialized: {
        ok: false,
        detail: `Configurazione Web App incompleta. Parametri mancanti: ${missingFields.join(', ')}.`,
      },
      firestore: {
        ok: false,
        detail: `Impossibile verificare il database '${databaseId}' senza configurazione Web App valida.`,
      },
      auth: {
        ok: false,
        detail: 'Impossibile verificare Firebase Authentication senza configurazione Web App valida.',
      },
      appCheck: {
        ok: false,
        detail: appCheckSiteKey
          ? 'In attesa di inizializzazione Firebase App.'
          : 'Chiave reCAPTCHA App Check non configurata (VITE_FIREBASE_APPCHECK_SITE_KEY).',
      },
    };
  }

  let firestoreStatus: FirebaseServiceDiagnostic;
  try {
    await getDocFromServer(doc(dbInstance, 'configurazione', 'public'));
    firestoreStatus = {
      ok: true,
      detail: `Connessione al database '${databaseId}' su '${rawConfig.projectId}' verificata.`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    firestoreStatus = {
      ok: false,
      detail: `Errore verifica Firestore ('${databaseId}'): ${message}`,
    };
  }

  let authStatus: FirebaseServiceDiagnostic;
  try {
    await authInstance.authStateReady();
    authStatus = {
      ok: true,
      detail: `Firebase Authentication pronto per authDomain '${rawConfig.authDomain}'.`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    authStatus = {
      ok: false,
      detail: `Errore verifica Authentication: ${message}`,
    };
  }

  return {
    config: firebaseConfigStatus,
    appInitialized: {
      ok: true,
      detail: `Firebase App inizializzata per '${rawConfig.projectId}'.`,
    },
    firestore: firestoreStatus,
    auth: authStatus,
    appCheck: {
      ok: Boolean(appCheckInstance),
      detail: appCheckInstance
        ? 'Firebase App Check attivo con ReCaptchaV3Provider.'
        : 'App Check non attivo: configurare VITE_FIREBASE_APPCHECK_SITE_KEY e abilitare App Check nella Console.',
    },
  };
}
