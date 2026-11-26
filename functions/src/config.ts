export const PORTAL_PROJECT_ID = 'candidature-ficup';
export const PORTAL_DATABASE_ID = '(default)';

export const OFFICIAL_PROJECT_ID = 'ficup-c9186';
export const OFFICIAL_DATABASE_ID = '(default)';

export const FUNCTION_REGION = 'europe-west1';
export const DEFAULT_BRIDGE_SERVICE_ACCOUNT =
  process.env.OFFICIAL_BRIDGE_SERVICE_ACCOUNT?.trim() ||
  'ficup-readonly-bridge@candidature-ficup.iam.gserviceaccount.com';

export const FIRESTORE_READ_TIMEOUT_MS = 8000;

export const CACHE_TTL_MS = {
  clubDirectory: 5 * 60 * 1000, // 5 minuti
  standings: 3 * 60 * 1000, // 3 minuti
  superlega: 3 * 60 * 1000, // 3 minuti
  zonaVarPublic: 2 * 60 * 1000, // 2 minuti
  comunicati: 5 * 60 * 1000, // 5 minuti
} as const;

export const STATIC_ALLOWED_ORIGINS = new Set<string>([
  'https://ficup.web.app',
  'https://ficup.firebaseapp.com',
  'https://candidature-ficup.web.app',
  'https://candidature-ficup.firebaseapp.com',
  'https://ficup26.github.io',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

export const AI_STUDIO_PREVIEW_ORIGIN_REGEX =
  /^https:\/\/ais-(dev|pre)-[a-z0-9-]+\.[a-z0-9-]+\.run\.app$/i;

export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) {
    return false;
  }
  const normalized = origin.trim().replace(/\/+$/, '');
  if (STATIC_ALLOWED_ORIGINS.has(normalized)) {
    return true;
  }
  if (AI_STUDIO_PREVIEW_ORIGIN_REGEX.test(normalized)) {
    return true;
  }
  const extraRaw = process.env.ALLOWED_ORIGINS || '';
  if (extraRaw) {
    const extras = extraRaw
      .split(',')
      .map((item) => item.trim().replace(/\/+$/, ''))
      .filter(Boolean);
    if (extras.includes(normalized)) {
      return true;
    }
  }
  return false;
}
