/**
 * FICUP 26/27 - Backend (Google Apps Script)
 * File: Config.gs
 *
 * Configurazioni centralizzate e costanti non segrete.
 * Eventuali chiavi o override (es. PORTAL_BASE_URL, WHATSAPP_OFFICIAL_URL,
 * FIREBASE_SERVICE_ACCOUNT_JSON) vanno salvati SOLO in PropertiesService (ScriptProperties).
 */

var FICUP_CONFIG = {
  PROJECT_ID: 'candidature-ficup',
  DATABASE_ID: '(default)',
  OPERATIONAL_EMAIL: 'scudetto26@gmail.com',
  SENDER_NAME: 'FANTA ITALIA CUP',
  SEASON_DEFAULT: '26/27',
  MAX_EMAIL_RETRIES: 3,
  RETRY_DELAY_MINUTES: 15,
  QUOTA_RETRY_DELAY_MINUTES: 60,
  PROCESSING_LOCK_TIMEOUT_MS: 300000, // 5 minuti
  PUBLIC_NOTIFY_MAX_AGE_MINUTES: 20, // Finestra max dopo createdAt per trigger pubblico Wizard
  PUBLIC_NOTIFY_QUOTA_RESERVE: 10, // Quota Gmail giornaliera riservata alle azioni staff
  PUBLIC_NOTIFY_GLOBAL_MAX_PER_WINDOW: 15, // Max richieste pubbliche notify in 10 min
  PUBLIC_NOTIFY_MAX_PER_EMAIL_PER_HOUR: 3, // Max invii NUOVO per stessa email/ora
  PUBLIC_NOTIFY_MAX_FAILED_PER_CODE: 5, // Max tentativi errati per codice in 10 min
  NOTIFY_WINDOW_SECONDS: 600, // 10 minuti
  MAX_EMAILS_PER_TRIGGER_RUN: 20, // Limite sicurezza per singolo run trigger
  WAITING_ROOM_MAX_FAILED_ATTEMPTS: 8,
  WAITING_ROOM_MAX_FAILED_PER_EMAIL: 10,
  WAITING_ROOM_GLOBAL_MAX_LOOKUPS: 80, // Max lookup Waiting Room ogni 5 minuti
  WAITING_ROOM_GLOBAL_MAX_FAILURES: 30, // Max errori Waiting Room ogni 5 minuti
  WAITING_ROOM_WINDOW_SECONDS: 600, // 10 minuti
  CANDIDATURA_CODE_REGEX: /^FICUP26-[A-Z0-9]{6}$/,
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  DOC_ID_REGEX: /^[a-zA-Z0-9_-]{1,128}$/
};

/**
 * Stati che generano una comunicazione email automatica verso il candidato.
 * Stati intermedi operativi (DA CONTATTARE, DA COMPLETARE) non generano email automatiche
 * per evitare notifiche superflue.
 */
var NOTIFIABLE_STATES = {
  APPROVATO: true,
  'INVITO INVIATO': true,
  COMPLETATO: true,
  RESPINTO: true
};

function getPortalBaseUrl_() {
  var props = PropertiesService.getScriptProperties();
  var configured = props.getProperty('PORTAL_BASE_URL');
  if (configured && configured.trim()) {
    return configured.trim().replace(/\/+$/, '');
  }
  return '';
}

function getOfficialWhatsappFallback_() {
  var props = PropertiesService.getScriptProperties();
  var val = props.getProperty('WHATSAPP_OFFICIAL_URL');
  return val ? val.trim() : '';
}

function getFirestoreBaseUrl_() {
  return (
    'https://firestore.googleapis.com/v1/projects/' +
    encodeURIComponent(FICUP_CONFIG.PROJECT_ID) +
    '/databases/' +
    encodeURIComponent(FICUP_CONFIG.DATABASE_ID) +
    '/documents'
  );
}

function getFirestoreRunQueryUrl_() {
  return getFirestoreBaseUrl_() + ':runQuery';
}
