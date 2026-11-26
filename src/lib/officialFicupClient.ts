import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { doc, getDoc, getFirestore, type Firestore } from 'firebase/firestore';
import {
  fetchSquadreAssegnateMap,
  fetchSquadreBloccatePortaleMap,
  saveAccettazioneDocumentale,
  submitCandidatura,
  type SquadraBloccataPortaleRecord,
} from './firestore';

export const ALLOWED_SERIE_KEYS = [
  'serie_a',
  'serie_b',
  'lega_pro_a',
  'lega_pro_b',
  'lega_pro_c',
] as const;

export type AllowedSerieKey = (typeof ALLOWED_SERIE_KEYS)[number];

export const SERIE_LABELS: Record<AllowedSerieKey, string> = {
  serie_a: 'Serie A',
  serie_b: 'Serie B',
  lega_pro_a: 'Lega Pro A',
  lega_pro_b: 'Lega Pro B',
  lega_pro_c: 'Lega Pro C',
};

function createEmptyFreeBySerie(): FreeBySerieCounts {
  return {
    serie_a: 0,
    serie_b: 0,
    lega_pro_a: 0,
    lega_pro_b: 0,
    lega_pro_c: 0,
  };
}

function isAllowedSerieKeyValue(val: string): val is AllowedSerieKey {
  return (ALLOWED_SERIE_KEYS as readonly string[]).includes(val);
}

export interface OfficialBridgeMeta {
  sourceProjectId: string;
  sourceDatabaseId: string;
  portalProjectId: string;
  readOnly: true;
  cacheHit: boolean;
  fetchedAtIso: string;
  sourceMode?: 'cloud_functions' | 'firestore_public_readonly';
}

export interface OfficialClub {
  id: string;
  clubId: string;
  numeroProgressivo: number | null;
  nome: string;
  nomeClub: string;
  serie: string;
  serieKey: string;
  linkedClassificaKey: string;
  isLegaTeam: boolean;
  isSubentrato: boolean;
  source: string;
}

export interface ClubDirectoryResponse {
  ok: true;
  meta: OfficialBridgeMeta;
  exists: boolean;
  updatedAt: string | null;
  totalClubs: number;
  clubs: OfficialClub[];
}

export interface OfficialStandingRow {
  pos: number;
  posDisplay: string;
  squadra: string;
  squadraNorm: string;
  g: number;
  v: number;
  n: number;
  p: number;
  gf: number;
  gs: number;
  dr: number;
  pt: number;
  ptTotali: number;
  serieKey: string;
  serie: string;
}

export interface SerieStandingData {
  serieKey: AllowedSerieKey;
  serie: string;
  exists: boolean;
  updatedAt: string | null;
  totalRows: number;
  rows: OfficialStandingRow[];
}

export interface AllStandingsResponse {
  ok: true;
  meta: OfficialBridgeMeta;
  series: Record<AllowedSerieKey, SerieStandingData>;
  availableSeriesCount: number;
}

export interface SingleStandingResponse {
  ok: true;
  meta: OfficialBridgeMeta;
  standing: SerieStandingData;
}

export interface SuperlegaAllResultItem {
  fantasquadra: string;
  punteggio: number;
  gol: number;
  serie: string;
}

export interface SuperlegaMatchdaySummary {
  giornata: number;
  top10: Array<Record<string, unknown>>;
  allResults: SuperlegaAllResultItem[];
  matches: Array<Record<string, unknown>>;
  totalResultsImported: number | null;
  updatedAt: string | null;
}

export interface SuperlegaCumulativeRow {
  pos: number;
  fantasquadra: string;
  serie: string;
  punteggioTotale: number;
  golTotali: number;
  giornateGiocate: number;
  mediaPunteggio: number;
  migliorPunteggio: number;
  presenzeTop10: number;
}

export interface SuperlegaSanitizedDocument {
  docId: string;
  exists: boolean;
  giornata: number | null;
  top10: Array<Record<string, unknown>>;
  allResults: SuperlegaAllResultItem[];
  matches: Array<Record<string, unknown>>;
  giornate: SuperlegaMatchdaySummary[];
  availableGiornate: number[];
  cumulativeTop10: SuperlegaCumulativeRow[];
  totalResultsImported: number | null;
  updatedAt: string | null;
}

export interface MatchdayResultsResponse {
  ok: true;
  meta: OfficialBridgeMeta;
  giornata: number;
  document: SuperlegaSanitizedDocument;
}

export interface SuperlegaAggregateResponse {
  ok: true;
  meta: OfficialBridgeMeta;
  mainData: SuperlegaSanitizedDocument;
}

export type AvailabilityStatus =
  | 'LIBERA'
  | 'BLOCCATA'
  | 'NASCOSTA'
  | 'ASSEGNATA'
  | 'DA_VERIFICARE';

export type ZonaVarSportCategory =
  | 'ALLARME_ROSSO'
  | 'ATTENZIONE'
  | 'SOTTO_OSSERVAZIONE'
  | 'REGOLARE';

export type FreeBySerieCounts = Record<AllowedSerieKey, number>;

export interface ZonaVarPublicState {
  exists: boolean;
  hiddenClubs: string[];
  blockedKeys: string[];
  assignedKeys?: string[];
  updatedAt: string | null;
}

export interface ZonaVarAnnotatedClub extends OfficialClub {
  normalizedKey?: string;
  lockId?: string;
  isHiddenInZonaVar: boolean;
  isBlockedInZonaVar: boolean;
  isBlockedByPortalStaff?: boolean;
  isReservedInPortal?: boolean;
  availabilityStatus: AvailabilityStatus;
  isSelectable: boolean;
  exclusionReason: string | null;
  standingPos: number | null;
  standingPt: number | null;
  standingPtTotali: number | null;
  sportCategory?: ZonaVarSportCategory;
  zeroMatchdaysCount?: number;
  consecutiveZerosLast3?: number;
}

export interface ZonaVarIntegratedResponse {
  ok: true;
  meta: OfficialBridgeMeta;
  zonaVarState: ZonaVarPublicState;
  clubsSummary: {
    totalClubs: number;
    visibleClubs: number;
    hiddenClubsCount: number;
    blockedClubsCount: number;
    freeClubsCount: number;
    assignedClubsCount: number;
    unverifiedClubsCount: number;
    freeBySerie: FreeBySerieCounts;
  };
  clubs: ZonaVarAnnotatedClub[];
  standingsBySerie: Record<AllowedSerieKey, SerieStandingData>;
  superlegaMain: SuperlegaSanitizedDocument;
}

export interface AvailableTeamDto {
  id: string;
  clubId: string;
  normalizedKey: string;
  nome: string;
  nomeClub: string;
  serie: string;
  serieKey: AllowedSerieKey;
  availabilityStatus: 'LIBERA';
  standingPos: number | null;
  standingPt: number | null;
  standingPtTotali: number | null;
  sportCategory?: ZonaVarSportCategory;
  zeroMatchdaysCount?: number;
  consecutiveZerosLast3?: number;
}

export interface AvailableTeamsResponse {
  ok: true;
  meta: OfficialBridgeMeta;
  updatedAt: string | null;
  totalFreeTeams: number;
  bySerie: FreeBySerieCounts;
  teams: AvailableTeamDto[];
}

export interface SubmitCandidaturaTeamPayload {
  nome: string;
  cognome: string;
  emailFantaleghe: string;
  cellulare: string;
  note?: string;
  tipoCandidatura: 'LIBERA' | 'SUBENTRO';
  consensoPrivacy: true;
  versioneInformativa: string;
  regolamentoAccettato: true;
  regolamentoVersione: string;
  regolamentoDocId: string;
  regoleChatAccettate: true;
  versioneRegoleChat: string;
  selectedTeam?: {
    id: string;
    clubId: string;
    normalizedKey: string;
    serieKey: AllowedSerieKey;
    nome: string;
  } | null;
}

export interface SubmitCandidaturaTeamResponse {
  ok: true;
  id: string;
  codiceCandidatura: string;
  accettazioneSyncedOnFirestore: boolean;
  selectedTeam?: {
    id: string;
    clubId: string;
    normalizedKey: string;
    nome: string;
    serie: string;
    serieKey: AllowedSerieKey;
  } | null;
}

export interface StaffZonaVarResponse extends ZonaVarIntegratedResponse {
  authorizedAdmin: {
    ruolo: 'SUPER_ADMIN' | 'STAFF';
    nome: string;
  };
}

export interface ComunicatiResponse {
  ok: true;
  meta: OfficialBridgeMeta;
  archiveNumber: number | null;
  document: {
    docId: string;
    exists: boolean;
    data: Record<string, unknown> | null;
    updatedAt: string | null;
  };
}

export class OfficialBridgeError extends Error {
  public readonly code: string;
  public readonly status?: number;
  constructor(message: string, code: string, status?: number) {
    super(message);
    this.name = 'OfficialBridgeError';
    this.code = code;
    this.status = status;
  }
}

export const OFFICIAL_FIREBASE_APP_NAME = 'ficup-official-read';

export const OFFICIAL_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAWMmt7lrRF1V6AIpQWh2CwXZE88_w_8E0',
  projectId: 'ficup-c9186',
  authDomain: 'ficup-c9186.firebaseapp.com',
  storageBucket: 'ficup-c9186.firebasestorage.app',
  messagingSenderId: '825031993621',
  appId: '1:825031993621:web:f9b49d210864a8c26f611c',
};

let officialAppInstance: FirebaseApp | null = null;
let officialDbInstance: Firestore | null = null;

export function getOfficialFirestoreDb(): Firestore {
  if (!officialDbInstance) {
    const existing = getApps().find((a) => a.name === OFFICIAL_FIREBASE_APP_NAME);
    officialAppInstance =
      existing ?? initializeApp(OFFICIAL_FIREBASE_CONFIG, OFFICIAL_FIREBASE_APP_NAME);
    officialDbInstance = getFirestore(officialAppInstance);
  }
  return officialDbInstance;
}

const FIREBASE_HOSTING_HOSTNAMES = new Set([
  'ficup.web.app',
  'ficup.firebaseapp.com',
  'candidature-ficup.web.app',
  'candidature-ficup.firebaseapp.com',
]);

export function resolveOfficialBridgeBaseUrl(): string | null {
  if (typeof window !== 'undefined' && FIREBASE_HOSTING_HOSTNAMES.has(window.location.hostname)) {
    return '/api/official';
  }

  return null;
}

export function isOfficialBridgeConfigured(): boolean {
  return resolveOfficialBridgeBaseUrl() !== null;
}

const REQUEST_TIMEOUT_MS = 12_000;
const MAX_CONCURRENT_PUBLIC_READS = 3;
const MAX_HTTP_429_RETRIES = 2;
const BASE_RETRY_DELAY_MS = 500;
const MAX_RETRY_AFTER_MS = 5_000;
const RATE_LIMIT_COOLDOWN_MS = 8_000;

const RESOURCE_CACHE_TTL_MS = {
  clubDirectory: 3 * 60_000,
  standings: 3 * 60_000,
  superlega: 3 * 60_000,
  comunicati: 5 * 60_000,
  zonaVarState: 45_000,
  default: 60_000,
} as const;

const PUBLIC_DOC_PERSISTENT_CACHE_TTL_MS = 15 * 60_000;
const PUBLIC_DOC_STORAGE_PREFIX = 'ficup_pub_doc_cache_v2:';

interface ClientCacheItem {
  value: unknown;
  expiresAt: number;
  updatedAtMs: number;
}

interface OfficialDocFetchOptions {
  bypassCache?: boolean;
  allowStaleFallback?: boolean;
  skipCooldown?: boolean;
}

export interface OfficialDocSnapshot {
  exists: boolean;
  data: Record<string, unknown> | null;
}

interface OfficialFetchTestingHooks {
  docReaderImpl?: (docPath: string) => Promise<OfficialDocSnapshot>;
  fetchImpl?: typeof fetch;
  sleepImpl?: (ms: number) => Promise<void>;
  disablePersistentCache?: boolean;
}

const clientMemoryCache = new Map<string, ClientCacheItem>();
const inFlightRequests = new Map<string, Promise<unknown>>();
const docRateLimitCooldownUntil = new Map<string, number>();
let rateLimitCooldownUntilMs = 0;

const testingHooks: OfficialFetchTestingHooks = {};

export function __configureOfficialClientForTest(hooks: OfficialFetchTestingHooks | null): void {
  testingHooks.docReaderImpl = hooks?.docReaderImpl;
  testingHooks.fetchImpl = hooks?.fetchImpl;
  testingHooks.sleepImpl = hooks?.sleepImpl;
  testingHooks.disablePersistentCache = hooks?.disablePersistentCache;
  if (!hooks) {
    docRateLimitCooldownUntil.clear();
    rateLimitCooldownUntilMs = 0;
  }
}

function getMemoryTtlForDocPath(docPath: string): number {
  if (docPath.startsWith('club_directory/')) return RESOURCE_CACHE_TTL_MS.clubDirectory;
  if (docPath.startsWith('classifiche_serie/')) return RESOURCE_CACHE_TTL_MS.standings;
  if (docPath.startsWith('superlega_top10/')) return RESOURCE_CACHE_TTL_MS.superlega;
  if (docPath.startsWith('comunicati_db/')) return RESOURCE_CACHE_TTL_MS.comunicati;
  if (docPath.startsWith('zonavar_public_state/')) return RESOURCE_CACHE_TTL_MS.zonaVarState;
  return RESOURCE_CACHE_TTL_MS.default;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getSleepFn(): (ms: number) => Promise<void> {
  return testingHooks.sleepImpl ?? defaultSleep;
}

function getFetchFn(): typeof fetch {
  return testingHooks.fetchImpl ?? fetch;
}

// Lightweight semaphore to prevent parallel REST bursts (max 3 concurrent reads)
let activePublicReads = 0;
const publicReadWaitQueue: Array<() => void> = [];

async function withPublicReadSlot<T>(task: () => Promise<T>): Promise<T> {
  if (activePublicReads >= MAX_CONCURRENT_PUBLIC_READS) {
    await new Promise<void>((resolve) => {
      publicReadWaitQueue.push(resolve);
    });
  }
  activePublicReads += 1;
  try {
    return await task();
  } finally {
    activePublicReads = Math.max(0, activePublicReads - 1);
    const next = publicReadWaitQueue.shift();
    if (next) {
      next();
    }
  }
}

function parseRetryAfterMs(headerVal: string | null): number | null {
  if (!headerVal) return null;
  const trimmed = headerVal.trim();
  if (!trimmed) return null;
  const asSeconds = Number(trimmed);
  if (Number.isFinite(asSeconds) && asSeconds >= 0) {
    return Math.min(Math.max(250, Math.round(asSeconds * 1000)), MAX_RETRY_AFTER_MS);
  }
  const parsedDate = Date.parse(trimmed);
  if (!Number.isNaN(parsedDate)) {
    const diff = parsedDate - Date.now();
    if (diff > 0) {
      return Math.min(Math.max(250, diff), MAX_RETRY_AFTER_MS);
    }
  }
  return null;
}

function computeRetryDelayMs(attempt: number, retryAfterHeader: string | null): number {
  const fromHeader = parseRetryAfterMs(retryAfterHeader);
  if (fromHeader !== null) {
    return fromHeader;
  }
  const exponential = BASE_RETRY_DELAY_MS * 2 ** attempt;
  const jitter = Math.floor(Math.random() * 160);
  return Math.min(exponential + jitter, MAX_RETRY_AFTER_MS);
}

export function clearOfficialClientCache(): void {
  clientMemoryCache.clear();
  inFlightRequests.clear();
  docRateLimitCooldownUntil.clear();
  rateLimitCooldownUntilMs = 0;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i += 1) {
        const key = window.localStorage.key(i);
        if (
          key &&
          (key.startsWith(PUBLIC_DOC_STORAGE_PREFIX) ||
            key.startsWith('ficup_pub_doc_cache_v1:'))
        ) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => window.localStorage.removeItem(k));
    } catch {
      // Ignore storage errors in restricted iframes
    }
  }
}

function isBridgeUnavailableError(err: unknown): boolean {
  return (
    err instanceof OfficialBridgeError &&
    (err.code === 'FUNCTIONS_URL_NOT_CONFIGURED' || err.code === 'NOT_DEPLOYED_OR_UNREACHABLE')
  );
}

// =============================================================================
// Read-Only Public Firestore REST Fallback (ONLY classifiche, superlega, comunicati on ficup-c9186)
// Never used for Zona VAR availability, atomic locks, or staff operations.
// =============================================================================

const BANNED_PII_KEYS = new Set<string>([
  'presidente',
  'president',
  'email',
  'emailfantaleghe',
  'mail',
  'telefono',
  'cellulare',
  'phone',
  'mobile',
  'whatsapp',
  'uid',
  'userid',
  'owneruid',
  'adminuid',
  'adminemail',
  'createdby',
  'updatedby',
  'authoruid',
  'authoremail',
  'codicefiscale',
  'cf',
  'indirizzo',
  'address',
  'noteinterne',
  'password',
  'token',
  'secret',
]);

type FirestoreRestValue = {
  nullValue?: null;
  booleanValue?: boolean;
  integerValue?: string;
  doubleValue?: number;
  timestampValue?: string;
  stringValue?: string;
  arrayValue?: { values?: FirestoreRestValue[] };
  mapValue?: { fields?: Record<string, FirestoreRestValue> };
};

function decodeFirestoreRestValue(val: FirestoreRestValue | undefined, depth = 0): unknown {
  if (!val || depth > 10 || 'nullValue' in val) {
    return null;
  }
  if (typeof val.stringValue === 'string') return val.stringValue;
  if (typeof val.booleanValue === 'boolean') return val.booleanValue;
  if (typeof val.integerValue === 'string') {
    const num = Number(val.integerValue);
    return Number.isFinite(num) ? num : val.integerValue;
  }
  if (typeof val.doubleValue === 'number') return val.doubleValue;
  if (typeof val.timestampValue === 'string') return val.timestampValue;
  if (val.arrayValue) {
    const items = Array.isArray(val.arrayValue.values) ? val.arrayValue.values : [];
    return items.map((item) => decodeFirestoreRestValue(item, depth + 1));
  }
  if (val.mapValue) {
    const fields = val.mapValue.fields ?? {};
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fields)) {
      if (BANNED_PII_KEYS.has(k.trim().toLowerCase())) {
        continue;
      }
      out[k] = decodeFirestoreRestValue(v, depth + 1);
    }
    return out;
  }
  return null;
}

function stripPiiDeep(value: unknown, depth = 0): unknown {
  if (depth > 8 || value === null || value === undefined) {
    return value ?? null;
  }
  if (Array.isArray(value)) {
    return value.map((item) => stripPiiDeep(item, depth + 1));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (BANNED_PII_KEYS.has(k.trim().toLowerCase())) {
        continue;
      }
      out[k] = stripPiiDeep(v, depth + 1);
    }
    return out;
  }
  return value;
}

function asStr(val: unknown, fallback = ''): string {
  return typeof val === 'string' ? val : val === null || val === undefined ? fallback : String(val);
}

function asNum(val: unknown, fallback = 0): number {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string' && val.trim() !== '') {
    const parsed = Number(val.replace(',', '.'));
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function asOptNum(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string' && val.trim() !== '') {
    const parsed = Number(val.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeTextKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function normalizeClubKey(value: string): string {
  const raw = asStr(value);
  const withoutSeriePrefix = raw.includes('::') ? raw.split('::').slice(1).join('::') : raw;
  return normalizeTextKey(withoutSeriePrefix).replace(/[^a-z0-9]/g, '');
}

export function cleanSuperlegaTeamName(value: string): string {
  return asStr(value).trim().replace(/\s+/g, ' ');
}

export function getNormalizedSuperlegaTeamKey(value: string): string {
  return normalizeClubKey(cleanSuperlegaTeamName(value));
}

export function normalizeSerieKey(value: string): string {
  const clean = asStr(value).trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (clean.includes('serie_a') || clean === 'a') return 'serie_a';
  if (clean.includes('serie_b') || clean === 'b') return 'serie_b';
  if (clean.includes('lega_pro_a') || clean === 'legapro_a' || clean === 'pro_a') return 'lega_pro_a';
  if (clean.includes('lega_pro_b') || clean === 'legapro_b' || clean === 'pro_b') return 'lega_pro_b';
  if (clean.includes('lega_pro_c') || clean === 'legapro_c' || clean === 'pro_c') return 'lega_pro_c';
  return clean;
}

export function resolveClubStandingsLink(
  club: Pick<OfficialClub, 'linkedClassificaKey' | 'nome' | 'nomeClub'>
): string {
  return (club.linkedClassificaKey || club.nome || club.nomeClub || '').trim();
}

export function getUnavailableZonaVarClubKeys(
  state: Pick<ZonaVarPublicState, 'hiddenClubs' | 'blockedKeys' | 'assignedKeys'>
): {
  hiddenSet: Set<string>;
  blockedSet: Set<string>;
  assignedSet: Set<string>;
} {
  const addVariants = (set: Set<string>, items: string[] | undefined) => {
    for (const raw of items ?? []) {
      const clean = asStr(raw).trim();
      if (!clean) continue;
      set.add(normalizeTextKey(clean));
      const compact = normalizeClubKey(clean);
      if (compact) set.add(compact);
    }
  };
  const hiddenSet = new Set<string>();
  const blockedSet = new Set<string>();
  const assignedSet = new Set<string>();
  addVariants(hiddenSet, state.hiddenClubs);
  addVariants(blockedSet, state.blockedKeys);
  addVariants(assignedSet, state.assignedKeys);
  return { hiddenSet, blockedSet, assignedSet };
}

function extractMatchdayScores(
  md: Pick<SuperlegaMatchdaySummary, 'giornata' | 'top10' | 'allResults'>
): SuperlegaAllResultItem[] {
  if (Array.isArray(md.allResults) && md.allResults.length > 0) {
    return md.allResults;
  }
  const top = Array.isArray(md.top10) ? md.top10 : [];
  return top
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const e = entry as Record<string, unknown>;
      const fantasquadra = cleanSuperlegaTeamName(asStr(e.fantasquadra ?? e.squadra));
      if (!fantasquadra) return null;
      return {
        fantasquadra,
        punteggio: asNum(e.punteggio ?? e.pt),
        gol: asNum(e.gol),
        serie: asStr(e.serie),
      };
    })
    .filter((item): item is SuperlegaAllResultItem => item !== null);
}

export function getClubsWithZeroInLast3ImportedMatches(
  matchdays: Array<Pick<SuperlegaMatchdaySummary, 'giornata' | 'top10' | 'allResults'>>
): Map<string, number> {
  const zeroCounts = new Map<string, number>();
  const sorted = [...matchdays].sort((a, b) => a.giornata - b.giornata);
  const lastThree = sorted.slice(-3);

  for (const md of lastThree) {
    const results = extractMatchdayScores(md);
    for (const res of results) {
      if (res.fantasquadra && res.punteggio === 0) {
        const key = getNormalizedSuperlegaTeamKey(res.fantasquadra);
        if (key) {
          zeroCounts.set(key, (zeroCounts.get(key) ?? 0) + 1);
        }
      }
    }
  }
  return zeroCounts;
}

export interface ClubCategoryDetails {
  category: ZonaVarSportCategory;
  zeroMatchdaysCount: number;
  consecutiveZerosLast3: number;
}

export function computeZonaVarClubCategories(
  clubs: Array<Pick<OfficialClub, 'id' | 'clubId' | 'nome' | 'nomeClub' | 'linkedClassificaKey'>>,
  matchdays: Array<Pick<SuperlegaMatchdaySummary, 'giornata' | 'top10' | 'allResults'>>
): Map<string, ClubCategoryDetails> {
  const sorted = [...matchdays]
    .filter((md) => Number.isInteger(md.giornata) && md.giornata >= 1)
    .sort((a, b) => a.giornata - b.giornata);

  const totalZerosByKey = new Map<string, number>();
  const scoreHistoryByKey = new Map<string, number[]>();

  for (const md of sorted) {
    const results = extractMatchdayScores(md);
    const seenInMd = new Set<string>();
    for (const res of results) {
      const compactKey = getNormalizedSuperlegaTeamKey(res.fantasquadra);
      if (!compactKey || seenInMd.has(compactKey)) continue;
      seenInMd.add(compactKey);

      const list = scoreHistoryByKey.get(compactKey) ?? [];
      list.push(res.punteggio);
      scoreHistoryByKey.set(compactKey, list);

      if (res.punteggio === 0) {
        totalZerosByKey.set(compactKey, (totalZerosByKey.get(compactKey) ?? 0) + 1);
      }
    }
  }

  const last3Mds = sorted.slice(-3);
  const categories = new Map<string, ClubCategoryDetails>();

  for (const club of clubs) {
    const clubKeys = Array.from(
      new Set(
        [club.nome, club.nomeClub, resolveClubStandingsLink(club), club.clubId, club.id]
          .filter(Boolean)
          .map((v) => normalizeClubKey(v))
          .filter(Boolean)
      )
    );

    let matchedKey = '';
    for (const ck of clubKeys) {
      if (scoreHistoryByKey.has(ck) || totalZerosByKey.has(ck)) {
        matchedKey = ck;
        break;
      }
    }

    const totalZeros = matchedKey ? (totalZerosByKey.get(matchedKey) ?? 0) : 0;

    // Count consecutive zero matchdays at the tail of imported matchdays (last 2 or 3)
    let tailZeros = 0;
    if (matchedKey && last3Mds.length > 0) {
      for (let i = last3Mds.length - 1; i >= 0; i -= 1) {
        const mdResults = extractMatchdayScores(last3Mds[i]);
        const hit = mdResults.find(
          (r) => getNormalizedSuperlegaTeamKey(r.fantasquadra) === matchedKey
        );
        if (hit && hit.punteggio === 0) {
          tailZeros += 1;
        } else {
          break;
        }
      }
    }

    let category: ZonaVarSportCategory = 'REGOLARE';
    if (tailZeros >= 3) {
      category = 'ALLARME_ROSSO';
    } else if (tailZeros >= 2) {
      category = 'ATTENZIONE';
    } else if (totalZeros > 5) {
      category = 'SOTTO_OSSERVAZIONE';
    }

    const canonicalClubKey = normalizeClubKey(club.id || club.clubId || club.nome || club.nomeClub);
    const details: ClubCategoryDetails = {
      category,
      zeroMatchdaysCount: totalZeros,
      consecutiveZerosLast3: tailZeros,
    };
    if (canonicalClubKey) {
      categories.set(canonicalClubKey, details);
    }
    for (const ck of clubKeys) {
      if (!categories.has(ck)) {
        categories.set(ck, details);
      }
    }
  }

  return categories;
}

function buildPublicFallbackMeta(cacheHit = false): OfficialBridgeMeta {
  return {
    sourceProjectId: 'ficup-c9186',
    sourceDatabaseId: '(default)',
    portalProjectId: 'candidature-ficup',
    readOnly: true,
    cacheHit,
    fetchedAtIso: new Date().toISOString(),
    sourceMode: 'firestore_public_readonly',
  };
}

function readPersistentPublicDocCache(
  docPath: string,
  allowStale = false
): { exists: boolean; data: Record<string, unknown> | null } | null {
  if (testingHooks.disablePersistentCache) {
    return null;
  }
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(`${PUBLIC_DOC_STORAGE_PREFIX}${docPath}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      expiresAt?: number;
      value?: { exists: boolean; data: Record<string, unknown> | null };
    };
    if (!parsed || !parsed.value) return null;
    if (!allowStale && typeof parsed.expiresAt === 'number' && Date.now() >= parsed.expiresAt) {
      return null;
    }
    return parsed.value;
  } catch {
    return null;
  }
}

function writePersistentPublicDocCache(
  docPath: string,
  value: { exists: boolean; data: Record<string, unknown> | null }
): void {
  if (testingHooks.disablePersistentCache) {
    return;
  }
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.setItem(
      `${PUBLIC_DOC_STORAGE_PREFIX}${docPath}`,
      JSON.stringify({
        expiresAt: Date.now() + PUBLIC_DOC_PERSISTENT_CACHE_TTL_MS,
        value,
      })
    );
  } catch {
    // Ignore quota exceeded / private mode errors
  }
}

async function fetchPublicOfficialFirestoreDoc(
  docPath: string,
  bypassCacheOrOpts: boolean | OfficialDocFetchOptions = false
): Promise<{ exists: boolean; data: Record<string, unknown> | null }> {
  const opts: OfficialDocFetchOptions =
    typeof bypassCacheOrOpts === 'boolean'
      ? { bypassCache: bypassCacheOrOpts }
      : bypassCacheOrOpts;
  const bypassCache = Boolean(opts.bypassCache);
  // Fail-closed by default on Zona VAR state unless caller explicitly allows stale fallback
  const isZonaVarDoc = docPath.startsWith('zonavar_public_state/');
  const allowStaleFallback = opts.allowStaleFallback ?? !isZonaVarDoc;
  const skipCooldown = Boolean(opts.skipCooldown) || bypassCache;

  const allowedPattern =
    /^(classifiche_serie\/(serie_a|serie_b|lega_pro_a|lega_pro_b|lega_pro_c)|superlega_top10\/(main_data|giornata_([1-9]|[12][0-9]|3[0-8]))|comunicati_db\/(main_data|archive_([1-9]\d{0,2}))|club_directory\/public_list|zonavar_public_state\/current)$/;
  if (!allowedPattern.test(docPath)) {
    throw new OfficialBridgeError(
      `Documento pubblico '${docPath}' non consentito.`,
      'WHITELIST_VIOLATION',
      403
    );
  }

  const memTtlMs = getMemoryTtlForDocPath(docPath);
  const cacheKey = `firestore_pub:${docPath}`;

  if (!bypassCache) {
    const cached = clientMemoryCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.value as { exists: boolean; data: Record<string, unknown> | null };
    }
    if (!isZonaVarDoc) {
      const persistentHit = readPersistentPublicDocCache(docPath, false);
      if (persistentHit) {
        clientMemoryCache.set(cacheKey, {
          value: persistentHit,
          expiresAt: Date.now() + memTtlMs,
          updatedAtMs: Date.now(),
        });
        return persistentHit;
      }
    }
  }

  // True in-flight deduplication across ALL callers (including parallel bypassCache calls)
  const inFlightKey = bypassCache ? `${cacheKey}:refresh` : cacheKey;
  const existingInFlight = inFlightRequests.get(inFlightKey) ?? inFlightRequests.get(cacheKey);
  if (existingInFlight) {
    return existingInFlight as Promise<{ exists: boolean; data: Record<string, unknown> | null }>;
  }

  const docCooldownUntil = docRateLimitCooldownUntil.get(docPath) ?? 0;
  if (!skipCooldown && Date.now() < Math.max(docCooldownUntil, rateLimitCooldownUntilMs)) {
    if (allowStaleFallback) {
      const stale = readPersistentPublicDocCache(docPath, true);
      if (stale) {
        return stale;
      }
    }
    throw new OfficialBridgeError(
      'Errore lettura pubblica ufficiale (quota Firebase temporaneamente esaurita).',
      'RESOURCE_EXHAUSTED',
      429
    );
  }

  const exec = async (): Promise<{ exists: boolean; data: Record<string, unknown> | null }> => {
    const sleepFn = getSleepFn();

    return withPublicReadSlot(async () => {
      let lastError: OfficialBridgeError | null = null;

      for (let attempt = 0; attempt <= MAX_HTTP_429_RETRIES; attempt += 1) {
        try {
          let rawData: Record<string, unknown> | null = null;
          let exists = false;

          if (testingHooks.docReaderImpl) {
            const testRes = await testingHooks.docReaderImpl(docPath);
            exists = testRes.exists;
            rawData = testRes.data;
          } else {
            const db = getOfficialFirestoreDb();
            const docRef = doc(db, docPath);
            const snap = await getDoc(docRef);
            exists = snap.exists();
            rawData = exists ? (snap.data() as Record<string, unknown>) : null;
          }

          if (!exists || !rawData) {
            const empty = { exists: false, data: null };
            docRateLimitCooldownUntil.delete(docPath);
            if (bypassCache) {
              rateLimitCooldownUntilMs = 0;
            }
            clientMemoryCache.set(cacheKey, {
              value: empty,
              expiresAt: Date.now() + memTtlMs,
              updatedAtMs: Date.now(),
            });
            writePersistentPublicDocCache(docPath, empty);
            return empty;
          }

          const decoded = (stripPiiDeep(rawData) ?? {}) as Record<string, unknown>;
          const result = { exists: true, data: decoded };
          docRateLimitCooldownUntil.delete(docPath);
          if (bypassCache) {
            rateLimitCooldownUntilMs = 0;
          }
          clientMemoryCache.set(cacheKey, {
            value: result,
            expiresAt: Date.now() + memTtlMs,
            updatedAtMs: Date.now(),
          });
          writePersistentPublicDocCache(docPath, result);
          return result;
        } catch (err) {
          if (err instanceof OfficialBridgeError) {
            lastError = err;
            throw err;
          }
          const anyErr = err as { code?: unknown; message?: string };
          const errCode = String(anyErr?.code ?? '');
          const isQuota =
            errCode === 'resource-exhausted' ||
            errCode === 'RESOURCE_EXHAUSTED' ||
            /quota/i.test(String(anyErr?.message));
          const isUnavailable =
            errCode === 'unavailable' ||
            errCode === 'deadline-exceeded' ||
            errCode === 'failed-precondition';

          const mappedErr = isQuota
            ? new OfficialBridgeError(
                'Errore lettura pubblica ufficiale (quota Firebase esaurita).',
                'RESOURCE_EXHAUSTED',
                429
              )
            : isUnavailable
              ? new OfficialBridgeError(
                  'Servizio dati ufficiali momentaneamente non raggiungibile.',
                  'UPSTREAM_UNAVAILABLE',
                  503
                )
              : new OfficialBridgeError(
                  `Errore lettura pubblica ufficiale: ${anyErr?.message || 'sconosciuto'}.`,
                  'UPSTREAM_ERROR',
                  500
                );

          lastError = mappedErr;

          if (attempt < MAX_HTTP_429_RETRIES && (isQuota || isUnavailable)) {
            await sleepFn(computeRetryDelayMs(attempt, null));
            continue;
          }

          if (isQuota) {
            const until = Date.now() + RATE_LIMIT_COOLDOWN_MS;
            docRateLimitCooldownUntil.set(docPath, until);
            rateLimitCooldownUntilMs = until;
          }

          if (allowStaleFallback) {
            const stale = readPersistentPublicDocCache(docPath, true);
            if (stale) {
              clientMemoryCache.set(cacheKey, {
                value: stale,
                expiresAt: Date.now() + 20_000,
                updatedAtMs: Date.now(),
              });
              return stale;
            }
          }
          throw mappedErr;
        }
      }

      throw (
        lastError ??
        new OfficialBridgeError(
          'Impossibile leggere i dati pubblici ufficiali in questo momento.',
          'UPSTREAM_UNAVAILABLE'
        )
      );
    });
  };

  const promise = exec().finally(() => {
    inFlightRequests.delete(inFlightKey);
  });
  inFlightRequests.set(inFlightKey, promise);
  return promise;
}

function sanitizeStandingDocClient(
  serieKey: AllowedSerieKey,
  doc: { exists: boolean; data: Record<string, unknown> | null }
): SerieStandingData {
  if (!doc.exists || !doc.data) {
    return {
      serieKey,
      serie: SERIE_LABELS[serieKey],
      exists: false,
      updatedAt: null,
      totalRows: 0,
      rows: [],
    };
  }

  const rawRows = Array.isArray(doc.data.rows) ? doc.data.rows : [];
  const rows: OfficialStandingRow[] = rawRows
    .map((item): OfficialStandingRow | null => {
      if (!item || typeof item !== 'object') return null;
      const d = item as Record<string, unknown>;
      const squadra = asStr(d.squadra).trim();
      if (!squadra) return null;
      const pos = asNum(d.pos);
      return {
        pos,
        posDisplay: asStr(d.posDisplay, String(pos)).trim() || String(pos),
        squadra,
        squadraNorm: asStr(d.squadraNorm).trim(),
        g: asNum(d.g),
        v: asNum(d.v),
        n: asNum(d.n),
        p: asNum(d.p),
        gf: asNum(d.gf),
        gs: asNum(d.gs),
        dr: asNum(d.dr),
        pt: asNum(d.pt),
        ptTotali: asNum(d.ptTotali),
        serieKey: asStr(d.serieKey, serieKey).trim().toLowerCase(),
        serie: asStr(d.serie).trim() || SERIE_LABELS[serieKey],
      };
    })
    .filter((row): row is OfficialStandingRow => row !== null)
    .sort((a, b) => a.pos - b.pos);

  return {
    serieKey,
    serie: asStr(doc.data.serie, SERIE_LABELS[serieKey]) || SERIE_LABELS[serieKey],
    exists: true,
    updatedAt: asStr(doc.data.updatedAt) || null,
    totalRows: rows.length,
    rows,
  };
}

function sanitizeAllResultClient(raw: unknown): SuperlegaAllResultItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Record<string, unknown>;
  const fantasquadra = asStr(d.fantasquadra).trim();
  if (!fantasquadra) return null;
  return {
    fantasquadra,
    punteggio: asNum(d.punteggio),
    gol: asNum(d.gol),
    serie: asStr(d.serie),
  };
}

function computeCumulativeTop10Client(
  giornate: SuperlegaMatchdaySummary[]
): SuperlegaCumulativeRow[] {
  const byTeam = new Map<
    string,
    {
      fantasquadra: string;
      serie: string;
      punteggioTotale: number;
      golTotali: number;
      giornateGiocate: number;
      migliorPunteggio: number;
      presenzeTop10: number;
    }
  >();

  for (const md of giornate) {
    const top10Names = new Set<string>();
    for (const rawEntry of md.top10) {
      const name = asStr(rawEntry.fantasquadra ?? rawEntry.squadra).trim();
      if (name) {
        top10Names.add(normalizeTextKey(name));
      }
    }

    const sourceList: SuperlegaAllResultItem[] =
      md.allResults.length > 0
        ? md.allResults
        : md.top10
            .map((entry) => {
              const fantasquadra = asStr(entry.fantasquadra ?? entry.squadra).trim();
              if (!fantasquadra) return null;
              return {
                fantasquadra,
                punteggio: asNum(entry.punteggio ?? entry.pt),
                gol: asNum(entry.gol),
                serie: asStr(entry.serie),
              };
            })
            .filter((item): item is SuperlegaAllResultItem => item !== null);

    for (const item of sourceList) {
      const key = `${normalizeTextKey(item.fantasquadra)}::${normalizeTextKey(item.serie)}`;
      const existing = byTeam.get(key) ?? {
        fantasquadra: item.fantasquadra,
        serie: item.serie,
        punteggioTotale: 0,
        golTotali: 0,
        giornateGiocate: 0,
        migliorPunteggio: 0,
        presenzeTop10: 0,
      };
      existing.punteggioTotale = Math.round((existing.punteggioTotale + item.punteggio) * 100) / 100;
      existing.golTotali += item.gol;
      existing.giornateGiocate += 1;
      if (item.punteggio > existing.migliorPunteggio) {
        existing.migliorPunteggio = item.punteggio;
      }
      if (top10Names.has(normalizeTextKey(item.fantasquadra))) {
        existing.presenzeTop10 += 1;
      }
      if (!existing.serie && item.serie) {
        existing.serie = item.serie;
      }
      byTeam.set(key, existing);
    }
  }

  return Array.from(byTeam.values())
    .sort((a, b) => {
      if (b.punteggioTotale !== a.punteggioTotale) return b.punteggioTotale - a.punteggioTotale;
      if (b.golTotali !== a.golTotali) return b.golTotali - a.golTotali;
      return a.fantasquadra.localeCompare(b.fantasquadra, 'it');
    })
    .slice(0, 10)
    .map((entry, idx) => ({
      pos: idx + 1,
      fantasquadra: entry.fantasquadra,
      serie: entry.serie,
      punteggioTotale: entry.punteggioTotale,
      golTotali: entry.golTotali,
      giornateGiocate: entry.giornateGiocate,
      mediaPunteggio:
        entry.giornateGiocate > 0
          ? Math.round((entry.punteggioTotale / entry.giornateGiocate) * 100) / 100
          : 0,
      migliorPunteggio: entry.migliorPunteggio,
      presenzeTop10: entry.presenzeTop10,
    }));
}

function sanitizeSuperlegaDocClient(
  docId: string,
  doc: { exists: boolean; data: Record<string, unknown> | null }
): SuperlegaSanitizedDocument {
  if (!doc.exists || !doc.data) {
    return {
      docId,
      exists: false,
      giornata: null,
      top10: [],
      allResults: [],
      matches: [],
      giornate: [],
      availableGiornate: [],
      cumulativeTop10: [],
      totalResultsImported: null,
      updatedAt: null,
    };
  }

  const raw = doc.data;
  const rawTop10 = Array.isArray(raw.top10) ? raw.top10 : [];
  const rawAllResults = Array.isArray(raw.allResults) ? raw.allResults : [];
  const rawMatches = Array.isArray(raw.matches) ? raw.matches : [];
  const rawNestedData = Array.isArray(raw.data) ? raw.data : [];

  const giornate: SuperlegaMatchdaySummary[] = rawNestedData
    .map((entry): SuperlegaMatchdaySummary | null => {
      if (!entry || typeof entry !== 'object') return null;
      const d = entry as Record<string, unknown>;
      const g = asOptNum(d.giornata);
      if (g === null || !Number.isInteger(g) || g < 1 || g > 38) return null;
      const mdTop10 = Array.isArray(d.top10) ? d.top10 : [];
      const mdAll = Array.isArray(d.allResults) ? d.allResults : [];
      const mdMatches = Array.isArray(d.matches) ? d.matches : [];
      return {
        giornata: g,
        top10: mdTop10
          .map((item) => stripPiiDeep(item))
          .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object')),
        allResults: mdAll
          .map(sanitizeAllResultClient)
          .filter((item): item is SuperlegaAllResultItem => item !== null),
        matches: mdMatches
          .map((item) => stripPiiDeep(item))
          .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object')),
        totalResultsImported: asOptNum(d.totalResultsImported),
        updatedAt: asStr(d.updatedAt) || null,
      };
    })
    .filter((item): item is SuperlegaMatchdaySummary => item !== null)
    .sort((a, b) => a.giornata - b.giornata);

  const sanitizedTop10 = rawTop10
    .map((entry) => stripPiiDeep(entry))
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'));
  const sanitizedAllResults = rawAllResults
    .map(sanitizeAllResultClient)
    .filter((item): item is SuperlegaAllResultItem => item !== null);
  const sanitizedMatches = rawMatches
    .map((entry) => stripPiiDeep(entry))
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'));

  const latest = giornate.length > 0 ? giornate[giornate.length - 1] : null;
  const effectiveTop10 = sanitizedTop10.length > 0 ? sanitizedTop10 : (latest?.top10 ?? []);

  return {
    docId,
    exists: true,
    giornata: asOptNum(raw.giornata),
    top10: effectiveTop10,
    allResults: sanitizedAllResults,
    matches: sanitizedMatches,
    giornate,
    availableGiornate: giornate.map((md) => md.giornata),
    cumulativeTop10: giornate.length > 0 ? computeCumulativeTop10Client(giornate) : [],
    totalResultsImported: asOptNum(raw.totalResultsImported) ?? latest?.totalResultsImported ?? null,
    updatedAt: asStr(raw.updatedAt) || latest?.updatedAt || null,
  };
}

// =============================================================================
// Primary Cloud Functions Bridge Client
// =============================================================================

async function fetchOfficialJson<T>(
  path: string,
  options?: { idToken?: string; bypassCache?: boolean }
): Promise<T> {
  const baseUrl = resolveOfficialBridgeBaseUrl();
  if (!baseUrl) {
    throw new OfficialBridgeError(
      'Endpoint Cloud Functions /api/official disponibile solo su Firebase Hosting.',
      'FUNCTIONS_URL_NOT_CONFIGURED'
    );
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${baseUrl}${normalizedPath}`;
  const cacheKey = `${options?.idToken ? 'staff:' : 'pub:'}${url}`;

  if (!options?.bypassCache && !options?.idToken) {
    const cached = clientMemoryCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.value as T;
    }
    const pending = inFlightRequests.get(cacheKey);
    if (pending) {
      return pending as Promise<T>;
    }
  }

  const execFetch = async (): Promise<T> => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    let rawText = '';

    try {
      const headers: Record<string, string> = {
        Accept: 'application/json',
      };
      if (options?.idToken) {
        headers.Authorization = `Bearer ${options.idToken}`;
      }

      response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
      rawText = await response.text();
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new OfficialBridgeError(
          'Timeout connessione verso le Cloud Functions ufficiali.',
          'UPSTREAM_TIMEOUT',
          504
        );
      }
      throw new OfficialBridgeError(
        'Bridge Cloud Functions non ancora raggiungibile o non ancora distribuito.',
        'NOT_DEPLOYED_OR_UNREACHABLE'
      );
    } finally {
      window.clearTimeout(timer);
    }

    let parsed: { ok?: boolean; code?: string; error?: string } | null = null;
    try {
      parsed = rawText ? (JSON.parse(rawText) as { ok?: boolean; code?: string; error?: string }) : null;
    } catch {
      parsed = null;
    }

    if (!response.ok || !parsed || parsed.ok !== true) {
      const code =
        parsed?.code ||
        (response.status === 404 ? 'NOT_DEPLOYED_OR_UNREACHABLE' : `HTTP_${response.status}`);
      const message =
        parsed?.error ||
        (response.status === 404
          ? 'Endpoint Cloud Functions /api/official non ancora distribuito su candidature-ficup.'
          : `Errore HTTP ${response.status} dal backend ufficiale.`);
      throw new OfficialBridgeError(message, code, response.status);
    }

  if (!options?.idToken) {
    clientMemoryCache.set(cacheKey, {
      value: parsed,
      expiresAt: Date.now() + RESOURCE_CACHE_TTL_MS.default,
      updatedAtMs: Date.now(),
    });
  }

  return parsed as unknown as T;
  };

  if (options?.idToken) {
    return execFetch();
  }

  const inFlightKey = options?.bypassCache ? `${cacheKey}:refresh` : cacheKey;
  const active = inFlightRequests.get(inFlightKey);
  if (active) {
    return active as Promise<T>;
  }

  const promise = execFetch().finally(() => {
    inFlightRequests.delete(inFlightKey);
  });
  inFlightRequests.set(inFlightKey, promise);
  return promise;
}

export async function fetchOfficialClubs(bypassCache = false): Promise<ClubDirectoryResponse> {
  try {
    return await fetchOfficialJson<ClubDirectoryResponse>('/clubs', { bypassCache });
  } catch (err) {
    if (!isBridgeUnavailableError(err)) {
      throw err;
    }
    const clubDirDoc = await fetchPublicOfficialFirestoreDoc('club_directory/public_list', {
      bypassCache,
    });
    const rawClubs =
      clubDirDoc.data && Array.isArray(clubDirDoc.data.clubs) ? clubDirDoc.data.clubs : [];
    const clubs: OfficialClub[] = rawClubs
      .map((raw): OfficialClub | null => {
        if (!raw || typeof raw !== 'object') return null;
        const d = raw as Record<string, unknown>;
        const id = asStr(d.id ?? d.clubId).trim();
        const nome = asStr(d.nome ?? d.nomeClub).trim();
        if (!id && !nome) return null;
        const normalizedSerie = normalizeSerieKey(asStr(d.serieKey || d.serie));
        return {
          id: id || `dir_${normalizeClubKey(nome)}`,
          clubId: asStr(d.clubId ?? id).trim() || id || `dir_${normalizeClubKey(nome)}`,
          numeroProgressivo: asOptNum(d.numeroProgressivo),
          nome,
          nomeClub: asStr(d.nomeClub ?? nome).trim() || nome,
          serie:
            asStr(d.serie).trim() ||
            (isAllowedSerieKeyValue(normalizedSerie) ? SERIE_LABELS[normalizedSerie] : ''),
          serieKey: normalizedSerie,
          linkedClassificaKey: asStr(d.linkedClassificaKey).trim(),
          isLegaTeam: Boolean(d.isLegaTeam),
          isSubentrato: Boolean(d.isSubentrato),
          source: asStr(d.source),
        };
      })
      .filter((c): c is OfficialClub => c !== null);

    return {
      ok: true,
      meta: buildPublicFallbackMeta(false),
      exists: clubDirDoc.exists,
      updatedAt: asStr(clubDirDoc.data?.updatedAt) || null,
      totalClubs: clubs.length,
      clubs,
    };
  }
}

export async function fetchOfficialStandings(bypassCache = false): Promise<AllStandingsResponse> {
  const compositeKey = `composite:standings:${bypassCache ? 'refresh' : 'cached'}`;
  if (!bypassCache) {
    const cached = clientMemoryCache.get('composite:standings:value');
    if (cached && Date.now() < cached.expiresAt) {
      return cached.value as AllStandingsResponse;
    }
  }
  const active = inFlightRequests.get(compositeKey);
  if (active) {
    return active as Promise<AllStandingsResponse>;
  }

  const run = (async (): Promise<AllStandingsResponse> => {
    try {
      const res = await fetchOfficialJson<AllStandingsResponse>('/standings', { bypassCache });
      const out: AllStandingsResponse = {
        ...res,
        meta: { ...res.meta, sourceMode: 'cloud_functions' },
      };
      clientMemoryCache.set('composite:standings:value', {
        value: out,
        expiresAt: Date.now() + RESOURCE_CACHE_TTL_MS.standings,
        updatedAtMs: Date.now(),
      });
      return out;
    } catch (err) {
      if (!isBridgeUnavailableError(err)) {
        throw err;
      }
      const entries = await Promise.all(
        ALLOWED_SERIE_KEYS.map(async (serieKey) => {
          const doc = await fetchPublicOfficialFirestoreDoc(`classifiche_serie/${serieKey}`, {
            bypassCache,
            allowStaleFallback: true,
          });
          return [serieKey, sanitizeStandingDocClient(serieKey, doc)] as const;
        })
      );
      const series = Object.fromEntries(entries) as Record<AllowedSerieKey, SerieStandingData>;
      const availableSeriesCount = entries.filter(([, item]) => item.exists).length;
      const out: AllStandingsResponse = {
        ok: true,
        meta: buildPublicFallbackMeta(false),
        series,
        availableSeriesCount,
      };
      clientMemoryCache.set('composite:standings:value', {
        value: out,
        expiresAt: Date.now() + RESOURCE_CACHE_TTL_MS.standings,
        updatedAtMs: Date.now(),
      });
      return out;
    }
  })().finally(() => {
    inFlightRequests.delete(compositeKey);
  });

  inFlightRequests.set(compositeKey, run);
  return run;
}

export async function fetchOfficialSerieStanding(
  serieKey: AllowedSerieKey,
  bypassCache = false
): Promise<SingleStandingResponse> {
  try {
    const res = await fetchOfficialJson<SingleStandingResponse>(
      `/standings/${encodeURIComponent(serieKey)}`,
      { bypassCache }
    );
    return {
      ...res,
      meta: { ...res.meta, sourceMode: 'cloud_functions' },
    };
  } catch (err) {
    if (!isBridgeUnavailableError(err)) {
      throw err;
    }
    const doc = await fetchPublicOfficialFirestoreDoc(`classifiche_serie/${serieKey}`, {
      bypassCache,
      allowStaleFallback: true,
    });
    return {
      ok: true,
      meta: buildPublicFallbackMeta(false),
      standing: sanitizeStandingDocClient(serieKey, doc),
    };
  }
}

export async function fetchOfficialMatchday(
  giornata: number,
  bypassCache = false
): Promise<MatchdayResultsResponse> {
  const compositeKey = `composite:matchday:${giornata}:${bypassCache ? 'refresh' : 'cached'}`;
  const active = inFlightRequests.get(compositeKey);
  if (active) {
    return active as Promise<MatchdayResultsResponse>;
  }

  const run = (async (): Promise<MatchdayResultsResponse> => {
    try {
      const res = await fetchOfficialJson<MatchdayResultsResponse>(`/matchdays/${giornata}`, {
        bypassCache,
      });
      return {
        ...res,
        meta: { ...res.meta, sourceMode: 'cloud_functions' },
      };
    } catch (err) {
      if (!isBridgeUnavailableError(err)) {
        throw err;
      }
      const docId = `giornata_${giornata}`;
      const doc = await fetchPublicOfficialFirestoreDoc(`superlega_top10/${docId}`, {
        bypassCache,
        allowStaleFallback: true,
      });
      const sanitized = sanitizeSuperlegaDocClient(docId, doc);
      if (sanitized.exists) {
        return {
          ok: true,
          meta: buildPublicFallbackMeta(false),
          giornata,
          document: sanitized,
        };
      }

      // Fallback secondario: controlla se la giornata è dentro superlega_top10/main_data.data[]
      const mainDoc = await fetchPublicOfficialFirestoreDoc('superlega_top10/main_data', {
        bypassCache,
        allowStaleFallback: true,
      });
      const mainSanitized = sanitizeSuperlegaDocClient('main_data', mainDoc);
      const nestedMd = mainSanitized.giornate.find((item) => item.giornata === giornata);
      if (nestedMd) {
        return {
          ok: true,
          meta: buildPublicFallbackMeta(false),
          giornata,
          document: {
            docId,
            exists: true,
            giornata,
            top10: nestedMd.top10,
            allResults: nestedMd.allResults,
            matches: nestedMd.matches,
            giornate: [],
            availableGiornate: [],
            cumulativeTop10: [],
            totalResultsImported: nestedMd.totalResultsImported,
            updatedAt: nestedMd.updatedAt,
          },
        };
      }

      return {
        ok: true,
        meta: buildPublicFallbackMeta(false),
        giornata,
        document: sanitized,
      };
    }
  })().finally(() => {
    inFlightRequests.delete(compositeKey);
  });

  inFlightRequests.set(compositeKey, run);
  return run;
}

async function probeSuperlegaGiornateFallback(
  bypassCache: boolean
): Promise<SuperlegaMatchdaySummary[]> {
  const collected: SuperlegaMatchdaySummary[] = [];
  // Keep probe batches tiny (2) so we do not trigger burst 429s, and abort cleanly if rate-limited.
  const batchSize = 2;

  for (let start = 1; start <= 38; start += batchSize) {
    const batchNums: number[] = [];
    for (let g = start; g < start + batchSize && g <= 38; g += 1) {
      batchNums.push(g);
    }
    const docs = await Promise.all(
      batchNums.map(async (g) => {
        const snap = await fetchPublicOfficialFirestoreDoc(
          `superlega_top10/giornata_${g}`,
          {
            bypassCache,
            allowStaleFallback: true,
          }
        );
        if (!snap.exists || !snap.data) return null;
        const sanitized = sanitizeSuperlegaDocClient(`giornata_${g}`, snap);
        if (!sanitized.exists) return null;
        const summary: SuperlegaMatchdaySummary = {
          giornata: sanitized.giornata ?? g,
          top10: sanitized.top10,
          allResults: sanitized.allResults,
          matches: sanitized.matches,
          totalResultsImported: sanitized.totalResultsImported,
          updatedAt: sanitized.updatedAt,
        };
        return summary;
      })
    );
    let anyFoundInBatch = false;
    for (const item of docs) {
      if (item) {
        collected.push(item);
        anyFoundInBatch = true;
      }
    }
    if (!anyFoundInBatch) {
      break;
    }
  }

  return collected.sort((a, b) => a.giornata - b.giornata);
}

export async function fetchOfficialSuperlega(
  bypassCache = false
): Promise<SuperlegaAggregateResponse> {
  const compositeKey = `composite:superlega:${bypassCache ? 'refresh' : 'cached'}`;
  if (!bypassCache) {
    const cached = clientMemoryCache.get('composite:superlega:value');
    if (cached && Date.now() < cached.expiresAt) {
      return cached.value as SuperlegaAggregateResponse;
    }
  }
  const active = inFlightRequests.get(compositeKey);
  if (active) {
    return active as Promise<SuperlegaAggregateResponse>;
  }

  const run = (async (): Promise<SuperlegaAggregateResponse> => {
    try {
      const res = await fetchOfficialJson<SuperlegaAggregateResponse>('/superlega', { bypassCache });
      const out: SuperlegaAggregateResponse = {
        ...res,
        meta: { ...res.meta, sourceMode: 'cloud_functions' },
      };
      clientMemoryCache.set('composite:superlega:value', {
        value: out,
        expiresAt: Date.now() + RESOURCE_CACHE_TTL_MS.superlega,
        updatedAtMs: Date.now(),
      });
      return out;
    } catch (err) {
      if (!isBridgeUnavailableError(err)) {
        throw err;
      }
      const doc = await fetchPublicOfficialFirestoreDoc('superlega_top10/main_data', {
        bypassCache,
        allowStaleFallback: true,
      });
      const mainData = sanitizeSuperlegaDocClient('main_data', doc);

      if (mainData.giornate.length === 0) {
        const probed = await probeSuperlegaGiornateFallback(bypassCache);
        if (probed.length > 0) {
          const latest = probed[probed.length - 1];
          mainData.exists = true;
          mainData.giornate = probed;
          mainData.availableGiornate = probed.map((md) => md.giornata);
          mainData.cumulativeTop10 = computeCumulativeTop10Client(probed);
          if (mainData.top10.length === 0) {
            mainData.top10 = latest.top10;
          }
          if (mainData.giornata === null) {
            mainData.giornata = latest.giornata;
          }
          if (!mainData.updatedAt) {
            mainData.updatedAt = latest.updatedAt;
          }
          if (mainData.totalResultsImported === null) {
            mainData.totalResultsImported = latest.totalResultsImported;
          }
        }
      }

      const out: SuperlegaAggregateResponse = {
        ok: true,
        meta: buildPublicFallbackMeta(false),
        mainData,
      };
      clientMemoryCache.set('composite:superlega:value', {
        value: out,
        expiresAt: Date.now() + RESOURCE_CACHE_TTL_MS.superlega,
        updatedAtMs: Date.now(),
      });
      return out;
    }
  })().finally(() => {
    inFlightRequests.delete(compositeKey);
  });

  inFlightRequests.set(compositeKey, run);
  return run;
}

export async function fetchOfficialZonaVarPublic(
  bypassCache = false,
  externalPortalReservedKeys?: Set<string>,
  options?: { includeSuperlegaCategories?: boolean }
): Promise<ZonaVarIntegratedResponse> {
  const includeSuperlegaCategories = options?.includeSuperlegaCategories ?? true;
  const canUseCompositeCache = !bypassCache && !externalPortalReservedKeys && includeSuperlegaCategories;
  const compositeKey = `composite:zonavar:${bypassCache ? 'refresh' : 'cached'}:${includeSuperlegaCategories ? 'full' : 'lite'}`;

  if (canUseCompositeCache) {
    const cached = clientMemoryCache.get('composite:zonavar:value');
    if (cached && Date.now() < cached.expiresAt) {
      return cached.value as ZonaVarIntegratedResponse;
    }
  }
  if (!externalPortalReservedKeys) {
    const active = inFlightRequests.get(compositeKey);
    if (active) {
      return active as Promise<ZonaVarIntegratedResponse>;
    }
  }

  const run = (async (): Promise<ZonaVarIntegratedResponse> => {
    try {
      const res = await fetchOfficialJson<ZonaVarIntegratedResponse>('/zonavar', { bypassCache });
      const out: ZonaVarIntegratedResponse = {
        ...res,
        meta: { ...res.meta, sourceMode: 'cloud_functions' },
      };
      if (!externalPortalReservedKeys) {
        clientMemoryCache.set('composite:zonavar:value', {
          value: out,
          expiresAt: Date.now() + RESOURCE_CACHE_TTL_MS.zonaVarState,
          updatedAtMs: Date.now(),
        });
      }
      return out;
    } catch (err) {
      if (!isBridgeUnavailableError(err)) {
        throw err;
      }
      // Always fetch directory + authoritative Zona VAR state + portal locks cleanly;
      // Superlega health badges remain non-blocking so a rate-limit on matchday history
      // never blocks checking whether a club is LIBERA.
      const superlegaPromise: Promise<SuperlegaAggregateResponse> = includeSuperlegaCategories
        ? fetchOfficialSuperlega(false).catch(() => ({
            ok: true,
            meta: buildPublicFallbackMeta(true),
            mainData: sanitizeSuperlegaDocClient('main_data', { exists: false, data: null }),
          }))
        : Promise.resolve({
            ok: true,
            meta: buildPublicFallbackMeta(true),
            mainData: sanitizeSuperlegaDocClient('main_data', { exists: false, data: null }),
          });

      const locksPromise = Promise.race([
        fetchSquadreAssegnateMap().catch(() => ({})),
        new Promise<Record<string, never>>((resolve) => {
          setTimeout(() => resolve({}), 6_000);
        }),
      ]);

      const portalBlocksPromise = Promise.race([
        fetchSquadreBloccatePortaleMap().catch(() => ({})),
        new Promise<Record<string, SquadraBloccataPortaleRecord>>((resolve) => {
          setTimeout(() => resolve({}), 6_000);
        }),
      ]);

      const [clubDirDoc, zonaVarDoc, standingsRes, superlegaRes, locksMap, portalBlocksMap] =
        await Promise.all([
          fetchPublicOfficialFirestoreDoc('club_directory/public_list', {
            bypassCache,
            allowStaleFallback: false,
          }),
          fetchPublicOfficialFirestoreDoc('zonavar_public_state/current', {
            bypassCache,
            allowStaleFallback: false,
          }),
          fetchOfficialStandings(false).catch(() => null),
          superlegaPromise,
          locksPromise,
          portalBlocksPromise,
        ]);

    const portalReservedSet = new Set<string>(externalPortalReservedKeys ?? []);
    Object.values(locksMap).forEach((lock) => {
      if (String(lock.statoAssegnazione).toUpperCase() === 'RILASCIATA') return;
      [lock.lockId, lock.clubId, lock.nomeSquadra].forEach((val) => {
        if (val) {
          portalReservedSet.add(normalizeTextKey(val));
          const compact = normalizeClubKey(val);
          if (compact) portalReservedSet.add(compact);
        }
      });
    });

    const portalBlockedByKey = new Map<string, SquadraBloccataPortaleRecord>();
    Object.values(portalBlocksMap).forEach((blockRec) => {
      if (!blockRec || blockRec.bloccata === false) return;
      [blockRec.lockId, blockRec.clubId, blockRec.normalizedKey, blockRec.nomeSquadra].forEach(
        (val) => {
          if (val) {
            const k1 = normalizeTextKey(val);
            const k2 = normalizeClubKey(val);
            if (k1 && !portalBlockedByKey.has(k1)) portalBlockedByKey.set(k1, blockRec);
            if (k2 && !portalBlockedByKey.has(k2)) portalBlockedByKey.set(k2, blockRec);
          }
        }
      );
    });

    const rawClubs = clubDirDoc.data && Array.isArray(clubDirDoc.data.clubs) ? clubDirDoc.data.clubs : [];
    const zonaVarState: ZonaVarPublicState = {
      exists: zonaVarDoc.exists,
      hiddenClubs: Array.isArray(zonaVarDoc.data?.hiddenClubs)
        ? zonaVarDoc.data.hiddenClubs.map((item) => asStr(item).trim()).filter(Boolean)
        : [],
      blockedKeys: Array.isArray(zonaVarDoc.data?.blockedKeys)
        ? zonaVarDoc.data.blockedKeys.map((item) => asStr(item).trim()).filter(Boolean)
        : [],
      assignedKeys: Array.isArray(zonaVarDoc.data?.assignedKeys)
        ? zonaVarDoc.data.assignedKeys.map((item) => asStr(item).trim()).filter(Boolean)
        : Array.isArray(zonaVarDoc.data?.assignedClubs)
          ? zonaVarDoc.data.assignedClubs.map((item) => asStr(item).trim()).filter(Boolean)
          : [],
      updatedAt: asStr(zonaVarDoc.data?.updatedAt) || null,
    };

    const { hiddenSet, blockedSet, assignedSet: officialAssignedSet } =
      getUnavailableZonaVarClubKeys(zonaVarState);

    // Index standing rows per serieKey
    const rowMapBySerie = new Map<AllowedSerieKey, Map<string, OfficialStandingRow>>();
    for (const serieKey of ALLOWED_SERIE_KEYS) {
      const serieMap = new Map<string, OfficialStandingRow>();
      const rows = standingsRes?.series?.[serieKey]?.rows ?? [];
      for (const row of rows) {
        const rowKeys = [
          row.squadraNorm ? normalizeTextKey(row.squadraNorm) : '',
          normalizeTextKey(row.squadra),
          row.squadraNorm ? normalizeClubKey(row.squadraNorm) : '',
          normalizeClubKey(row.squadra),
        ].filter(Boolean);
        for (const rk of rowKeys) {
          if (!serieMap.has(rk)) {
            serieMap.set(rk, row);
          }
        }
      }
      rowMapBySerie.set(serieKey, serieMap);
    }

    const matchedStandingKeys = new Set<string>();
    const directoryCompactKeys = new Set<string>();
    const freeBySerie = createEmptyFreeBySerie();

    const baseDirectoryClubs: OfficialClub[] = rawClubs
      .map((raw): OfficialClub | null => {
        if (!raw || typeof raw !== 'object') return null;
        const d = raw as Record<string, unknown>;
        const id = asStr(d.id ?? d.clubId).trim();
        const nome = asStr(d.nome ?? d.nomeClub).trim();
        if (!id && !nome) return null;
        const normalizedSerie = normalizeSerieKey(asStr(d.serieKey || d.serie));
        return {
          id: id || `dir_${normalizeClubKey(nome)}`,
          clubId: asStr(d.clubId ?? id).trim() || id || `dir_${normalizeClubKey(nome)}`,
          numeroProgressivo: asOptNum(d.numeroProgressivo),
          nome,
          nomeClub: asStr(d.nomeClub ?? nome).trim() || nome,
          serie:
            asStr(d.serie).trim() ||
            (isAllowedSerieKeyValue(normalizedSerie) ? SERIE_LABELS[normalizedSerie] : ''),
          serieKey: normalizedSerie,
          linkedClassificaKey: asStr(d.linkedClassificaKey).trim(),
          isLegaTeam: Boolean(d.isLegaTeam),
          isSubentrato: Boolean(d.isSubentrato),
          source: asStr(d.source),
        };
      })
      .filter((c): c is OfficialClub => c !== null);

    // Merge standing rows absent from club_directory/public_list cleanly with canonical standing IDs
    const extraStandingsClubs: Array<OfficialClub & { _matchedRow: OfficialStandingRow }> = [];
    for (const dirClub of baseDirectoryClubs) {
      [dirClub.linkedClassificaKey, dirClub.nome, dirClub.nomeClub]
        .filter(Boolean)
        .forEach((v) => {
          directoryCompactKeys.add(normalizeClubKey(v));
        });
    }

    const buildAnnotatedClub = (
      club: OfficialClub,
      rawExtras?: Record<string, unknown>,
      preMatchedRow?: OfficialStandingRow | null
    ): ZonaVarAnnotatedClub => {
      const validSerieKey: AllowedSerieKey | null = isAllowedSerieKeyValue(club.serieKey)
        ? club.serieKey
        : null;
      const standingLink = resolveClubStandingsLink(club);
      const linkedSuffix = standingLink.includes('::')
        ? standingLink.split('::').slice(1).join('::')
        : '';

      const searchKeys = Array.from(
        new Set(
          [
            club.id,
            club.clubId,
            club.linkedClassificaKey,
            linkedSuffix,
            club.nome,
            club.nomeClub,
            club.id ? normalizeClubKey(club.id) : '',
            club.clubId ? normalizeClubKey(club.clubId) : '',
            club.linkedClassificaKey ? normalizeClubKey(club.linkedClassificaKey) : '',
            club.nome ? normalizeClubKey(club.nome) : '',
            club.nomeClub ? normalizeClubKey(club.nomeClub) : '',
          ]
            .filter(Boolean)
            .map(normalizeTextKey)
        )
      );

      let matchedRow: OfficialStandingRow | null = preMatchedRow ?? null;
      if (!matchedRow && validSerieKey) {
        const serieMap = rowMapBySerie.get(validSerieKey);
        if (serieMap) {
          for (const sk of searchKeys) {
            const hit = serieMap.get(sk);
            if (hit) {
              matchedRow = hit;
              break;
            }
          }
        }
      }
      if (!matchedRow) {
        for (const sKey of ALLOWED_SERIE_KEYS) {
          const sMap = rowMapBySerie.get(sKey);
          if (!sMap) continue;
          for (const sk of searchKeys) {
            const hit = sMap.get(sk);
            if (hit) {
              matchedRow = hit;
              break;
            }
          }
          if (matchedRow) break;
        }
      }

      if (matchedRow && validSerieKey) {
        if (matchedRow.squadraNorm) {
          matchedStandingKeys.add(`${validSerieKey}::${normalizeClubKey(matchedRow.squadraNorm)}`);
        }
        matchedStandingKeys.add(`${validSerieKey}::${normalizeClubKey(matchedRow.squadra)}`);
      }

      const rawStatus = normalizeTextKey(
        asStr(rawExtras?.zonaVarStato ?? rawExtras?.stato ?? rawExtras?.status ?? '')
      );
      const explicitAssegnata =
        rawExtras?.assegnata === true ||
        rawExtras?.isAssigned === true ||
        rawExtras?.occupata === true;
      const explicitDisponibile =
        rawExtras?.disponibile === false ||
        rawExtras?.isAvailable === false ||
        rawExtras?.libera === false ||
        rawExtras?.isLibera === false;

      const isHidden =
        searchKeys.some((k) => hiddenSet.has(k)) ||
        rawStatus === 'nascosta' ||
        rawStatus === 'hidden';
      const isBlocked =
        searchKeys.some((k) => blockedSet.has(k)) ||
        rawStatus === 'bloccata' ||
        rawStatus === 'blocked' ||
        rawStatus === 'chiusa';
      const lockIdSlug = (
        club.clubId ||
        club.id ||
        club.linkedClassificaKey ||
        club.nomeClub ||
        club.nome
      )
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 96);
      const lockId = `club_${lockIdSlug || 'unknown'}`;
      let portalBlockHit: SquadraBloccataPortaleRecord | undefined =
        portalBlockedByKey.get(normalizeTextKey(lockId)) ??
        portalBlockedByKey.get(normalizeClubKey(lockId));
      if (!portalBlockHit) {
        for (const sk of searchKeys) {
          const hit = portalBlockedByKey.get(sk) ?? portalBlockedByKey.get(normalizeClubKey(sk));
          if (hit) {
            portalBlockHit = hit;
            break;
          }
        }
      }
      const isBlockedByPortalStaff = Boolean(portalBlockHit);

      const isReservedInPortal =
        searchKeys.some((k) => portalReservedSet.has(k)) ||
        portalReservedSet.has(normalizeTextKey(lockId));
      const isAssignedInOfficial =
        searchKeys.some((k) => officialAssignedSet.has(k)) ||
        explicitAssegnata ||
        explicitDisponibile ||
        rawStatus === 'assegnata' ||
        rawStatus === 'assigned' ||
        rawStatus === 'occupata' ||
        rawStatus === 'indisponibile';

      let availabilityStatus: AvailabilityStatus = 'LIBERA';
      let exclusionReason: string | null = null;

      if (isHidden) {
        availabilityStatus = 'NASCOSTA';
        exclusionReason = 'Squadra nascosta in Zona VAR.';
      } else if (isBlocked) {
        availabilityStatus = 'BLOCCATA';
        exclusionReason = 'Squadra bloccata in Zona VAR.';
      } else if (isBlockedByPortalStaff) {
        availabilityStatus = 'BLOCCATA';
        exclusionReason =
          portalBlockHit?.motivo ||
          'Squadra bloccata dallo Staff del portale (già occupata o non disponibile).';
      } else if (isReservedInPortal) {
        availabilityStatus = 'ASSEGNATA';
        exclusionReason = 'Squadra già riservata o assegnata nel portale candidature.';
      } else if (isAssignedInOfficial) {
        availabilityStatus = 'ASSEGNATA';
        exclusionReason = 'Squadra risultante già assegnata o indisponibile nei dati ufficiali.';
      } else if (!validSerieKey) {
        availabilityStatus = 'DA_VERIFICARE';
        exclusionReason = `Serie ufficiale non valida o mancante (${club.serieKey || 'vuota'}).`;
      } else {
        availabilityStatus = 'LIBERA';
        freeBySerie[validSerieKey] += 1;
      }

      return {
        ...club,
        serie: club.serie || (validSerieKey ? SERIE_LABELS[validSerieKey] : ''),
        serieKey: validSerieKey ?? club.serieKey,
        normalizedKey: searchKeys[0] || normalizeTextKey(club.nome),
        lockId,
        isHiddenInZonaVar: isHidden,
        isBlockedInZonaVar: isBlocked || isBlockedByPortalStaff,
        isBlockedByPortalStaff,
        isReservedInPortal,
        availabilityStatus,
        isSelectable: availabilityStatus === 'LIBERA',
        exclusionReason,
        standingPos: matchedRow ? matchedRow.pos : null,
        standingPt: matchedRow ? matchedRow.pt : null,
        standingPtTotali: matchedRow ? matchedRow.ptTotali : null,
      };
    };

    const rawClubByIndex = rawClubs.filter((r) => Boolean(r && typeof r === 'object')) as Array<
      Record<string, unknown>
    >;
    const annotatedClubs: ZonaVarAnnotatedClub[] = baseDirectoryClubs.map((club, idx) =>
      buildAnnotatedClub(club, rawClubByIndex[idx], null)
    );

    const addedStandingDedupe = new Set<string>();
    for (const serieKey of ALLOWED_SERIE_KEYS) {
      const standing = standingsRes?.series?.[serieKey];
      if (!standing?.exists) continue;
      for (const row of standing.rows) {
        const keyNorm = normalizeClubKey(row.squadraNorm || row.squadra);
        const keyName = normalizeClubKey(row.squadra);
        const alreadyMatched =
          matchedStandingKeys.has(`${serieKey}::${keyNorm}`) ||
          matchedStandingKeys.has(`${serieKey}::${keyName}`) ||
          directoryCompactKeys.has(keyNorm) ||
          directoryCompactKeys.has(keyName);
        const dedupeKey = `${serieKey}::${keyNorm || keyName}`;
        if (alreadyMatched || addedStandingDedupe.has(dedupeKey)) {
          continue;
        }
        addedStandingDedupe.add(dedupeKey);
        const canonicalStandingId = `standing_${serieKey}_${keyNorm || keyName || 'club'}`;
        extraStandingsClubs.push({
          id: canonicalStandingId,
          clubId: canonicalStandingId,
          numeroProgressivo: null,
          nome: row.squadra,
          nomeClub: row.squadra,
          serie: row.serie || SERIE_LABELS[serieKey],
          serieKey,
          linkedClassificaKey: row.squadraNorm || row.squadra,
          isLegaTeam: true,
          isSubentrato: false,
          source: 'classifiche_serie_merged',
          _matchedRow: row,
        });
      }
    }

    for (const extra of extraStandingsClubs) {
      const { _matchedRow, ...clubOnly } = extra;
      annotatedClubs.push(buildAnnotatedClub(clubOnly, undefined, _matchedRow));
    }

    // Compute sporting health categories from imported Superlega matchdays (NEVER blocks availability)
    const matchdays = superlegaRes.mainData.giornate;
    const categoryMap = computeZonaVarClubCategories(annotatedClubs, matchdays);
    for (const club of annotatedClubs) {
      const lookupKeys = [
        normalizeClubKey(club.id || club.clubId || ''),
        normalizeClubKey(club.nome),
        normalizeClubKey(club.nomeClub),
        normalizeClubKey(resolveClubStandingsLink(club)),
      ].filter(Boolean);
      let hit: ClubCategoryDetails | undefined;
      for (const k of lookupKeys) {
        hit = categoryMap.get(k);
        if (hit) break;
      }
      club.sportCategory = hit?.category ?? 'REGOLARE';
      club.zeroMatchdaysCount = hit?.zeroMatchdaysCount ?? 0;
      club.consecutiveZerosLast3 = hit?.consecutiveZerosLast3 ?? 0;
    }

    const visibleClubs = annotatedClubs.filter((c) => !c.isHiddenInZonaVar);
    const out: ZonaVarIntegratedResponse = {
      ok: true,
      meta: buildPublicFallbackMeta(false),
      zonaVarState,
      clubsSummary: {
        totalClubs: annotatedClubs.length,
        visibleClubs: visibleClubs.length,
        hiddenClubsCount: annotatedClubs.filter((c) => c.availabilityStatus === 'NASCOSTA').length,
        blockedClubsCount: annotatedClubs.filter((c) => c.availabilityStatus === 'BLOCCATA').length,
        freeClubsCount: annotatedClubs.filter((c) => c.availabilityStatus === 'LIBERA').length,
        assignedClubsCount: annotatedClubs.filter((c) => c.availabilityStatus === 'ASSEGNATA').length,
        unverifiedClubsCount: annotatedClubs.filter((c) => c.availabilityStatus === 'DA_VERIFICARE').length,
        freeBySerie,
      },
      clubs: annotatedClubs,
      standingsBySerie:
        standingsRes?.series ??
        (Object.fromEntries(
          ALLOWED_SERIE_KEYS.map((k) => [
            k,
            sanitizeStandingDocClient(k, { exists: false, data: null }),
          ])
        ) as Record<AllowedSerieKey, SerieStandingData>),
      superlegaMain: superlegaRes.mainData,
    };
    if (!externalPortalReservedKeys && includeSuperlegaCategories) {
      clientMemoryCache.set('composite:zonavar:value', {
        value: out,
        expiresAt: Date.now() + RESOURCE_CACHE_TTL_MS.zonaVarState,
        updatedAtMs: Date.now(),
      });
    }
    return out;
  }
  })().finally(() => {
    if (!externalPortalReservedKeys) {
      inFlightRequests.delete(compositeKey);
    }
  });

  if (!externalPortalReservedKeys) {
    inFlightRequests.set(compositeKey, run);
  }
  return run;
}

export async function fetchAvailableTeams(bypassCache = false): Promise<AvailableTeamsResponse> {
  const compositeKey = `composite:available_teams:${bypassCache ? 'refresh' : 'cached'}`;
  const active = inFlightRequests.get(compositeKey);
  if (active) {
    return active as Promise<AvailableTeamsResponse>;
  }

  const run = (async (): Promise<AvailableTeamsResponse> => {
    try {
      const query = bypassCache ? '?refresh=1' : '';
      const res = await fetchOfficialJson<AvailableTeamsResponse>(`/available-teams${query}`, {
        bypassCache,
      });
      return {
        ...res,
        meta: { ...res.meta, sourceMode: 'cloud_functions' },
      };
    } catch (err) {
      if (!isBridgeUnavailableError(err)) {
        throw err;
      }
      const zv = await fetchOfficialZonaVarPublic(bypassCache);
      const teams: AvailableTeamDto[] = zv.clubs
        .filter(
          (c) =>
            (c.sportCategory ?? 'REGOLARE') === 'ALLARME_ROSSO' &&
            c.availabilityStatus === 'LIBERA' &&
            c.isSelectable &&
            isAllowedSerieKeyValue(c.serieKey)
        )
        .sort((a, b) => {
          const sOrder =
            ALLOWED_SERIE_KEYS.indexOf(a.serieKey as AllowedSerieKey) -
            ALLOWED_SERIE_KEYS.indexOf(b.serieKey as AllowedSerieKey);
          if (sOrder !== 0) return sOrder;
          return a.nome.localeCompare(b.nome, 'it');
        })
        .map((c) => ({
          id: c.id,
          clubId: c.clubId,
          normalizedKey: c.normalizedKey ?? c.clubId ?? c.id ?? '',
          nome: c.nome,
          nomeClub: c.nomeClub,
          serie: c.serie || SERIE_LABELS[c.serieKey as AllowedSerieKey],
          serieKey: c.serieKey as AllowedSerieKey,
          availabilityStatus: 'LIBERA',
          standingPos: c.standingPos,
          standingPt: c.standingPt,
          standingPtTotali: c.standingPtTotali,
          sportCategory: c.sportCategory ?? 'REGOLARE',
          zeroMatchdaysCount: c.zeroMatchdaysCount ?? 0,
          consecutiveZerosLast3: c.consecutiveZerosLast3 ?? 0,
        }));

      const freeBySerie = createEmptyFreeBySerie();
      for (const t of teams) {
        freeBySerie[t.serieKey] = (freeBySerie[t.serieKey] ?? 0) + 1;
      }

      return {
        ok: true,
        meta: zv.meta,
        updatedAt: zv.zonaVarState.updatedAt,
        totalFreeTeams: teams.length,
        bySerie: freeBySerie,
        teams,
      };
    }
  })().finally(() => {
    inFlightRequests.delete(compositeKey);
  });

  inFlightRequests.set(compositeKey, run);
  return run;
}

async function persistCandidaturaDirectToPortalFirestore(
  payload: SubmitCandidaturaTeamPayload
): Promise<SubmitCandidaturaTeamResponse> {
  let verifiedTeam: SubmitCandidaturaTeamResponse['selectedTeam'] = null;

  if (payload.tipoCandidatura === 'SUBENTRO') {
    if (!payload.selectedTeam) {
      throw new OfficialBridgeError(
        'Devi selezionare una squadra disponibile della Zona VAR per procedere con il subentro.',
        'MISSING_TEAM',
        400
      );
    }

    const zv = await fetchOfficialZonaVarPublic(true, undefined, {
      includeSuperlegaCategories: false,
    });
    const requestedKeys = new Set(
      [
        payload.selectedTeam.id,
        payload.selectedTeam.clubId,
        payload.selectedTeam.normalizedKey,
        payload.selectedTeam.nome,
      ]
        .filter(Boolean)
        .flatMap((v) => [normalizeTextKey(v), normalizeClubKey(v)])
        .filter(Boolean)
    );

    const targetClub = zv.clubs.find((club) => {
      if (club.serieKey !== payload.selectedTeam?.serieKey) {
        return false;
      }
      const clubKeys = [
        club.id,
        club.clubId,
        club.normalizedKey ?? '',
        club.nome,
        club.nomeClub,
      ]
        .filter(Boolean)
        .flatMap((v) => [normalizeTextKey(v), normalizeClubKey(v)]);
      return clubKeys.some((k) => requestedKeys.has(k));
    });

    if (!targetClub) {
      throw new OfficialBridgeError(
        'La squadra selezionata non risulta presente nei dati ufficiali Zona VAR. Aggiorna la lista e scegli una squadra disponibile.',
        'TEAM_NOT_FOUND',
        404
      );
    }

    if (targetClub.availabilityStatus !== 'LIBERA' || !targetClub.isSelectable) {
      throw new OfficialBridgeError(
        targetClub.exclusionReason ||
          'La squadra selezionata non è più disponibile per il subentro. Scegli una squadra libera.',
        targetClub.availabilityStatus === 'ASSEGNATA'
          ? 'TEAM_ALREADY_ASSIGNED'
          : 'TEAM_NOT_AVAILABLE',
        409
      );
    }

    const resolvedSerieKey = isAllowedSerieKeyValue(targetClub.serieKey)
      ? targetClub.serieKey
      : payload.selectedTeam.serieKey;

    verifiedTeam = {
      id: targetClub.id,
      clubId: targetClub.clubId,
      normalizedKey: targetClub.normalizedKey ?? normalizeClubKey(targetClub.nome),
      nome: targetClub.nome,
      serie: targetClub.serie || SERIE_LABELS[resolvedSerieKey] || 'Serie A',
      serieKey: resolvedSerieKey,
    };
  }

  const saved = await submitCandidatura({
    nome: payload.nome,
    cognome: payload.cognome,
    emailFantaleghe: payload.emailFantaleghe,
    cellulare: payload.cellulare,
    nomeSquadra: verifiedTeam ? verifiedTeam.nome : 'CANDIDATURA LIBERA',
    note: payload.note ?? '',
    tipoCandidatura: payload.tipoCandidatura,
    selectedTeam: verifiedTeam,
    consensoPrivacy: payload.consensoPrivacy,
    versioneInformativa: payload.versioneInformativa,
    regolamentoAccettato: payload.regolamentoAccettato,
    regolamentoVersione: payload.regolamentoVersione,
  });

  const accettazioneSyncedOnFirestore = await saveAccettazioneDocumentale({
    candidaturaId: saved.id,
    codiceCandidatura: saved.codiceCandidatura,
    emailFantaleghe: payload.emailFantaleghe,
    privacyAccettata: payload.consensoPrivacy,
    versionePrivacy: payload.versioneInformativa,
    regolamentoAccettato: payload.regolamentoAccettato,
    versioneRegolamento: payload.regolamentoVersione,
    regolamentoDocId: payload.regolamentoDocId,
    regoleChatAccettate: payload.regoleChatAccettate,
    versioneRegoleChat: payload.versioneRegoleChat,
  });

  clearOfficialClientCache();

  return {
    ok: true,
    id: saved.id,
    codiceCandidatura: saved.codiceCandidatura,
    accettazioneSyncedOnFirestore,
    selectedTeam: verifiedTeam,
  };
}

export async function submitCandidaturaWithOfficialTeam(
  payload: SubmitCandidaturaTeamPayload
): Promise<SubmitCandidaturaTeamResponse> {
  const baseUrl = resolveOfficialBridgeBaseUrl();
  if (!baseUrl) {
    return persistCandidaturaDirectToPortalFirestore(payload);
  }

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 15_000);
  let response: Response;
  let rawText = '';

  try {
    response = await fetch(`${baseUrl}/candidature`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    rawText = await response.text();
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new OfficialBridgeError(
        'Timeout durante l’invio della candidatura e la verifica della squadra.',
        'UPSTREAM_TIMEOUT',
        504
      );
    }
    return persistCandidaturaDirectToPortalFirestore(payload);
  } finally {
    window.clearTimeout(timer);
  }

  let parsed: { ok?: boolean; code?: string; error?: string } | null = null;
  try {
    parsed = rawText ? (JSON.parse(rawText) as { ok?: boolean; code?: string; error?: string }) : null;
  } catch {
    parsed = null;
  }

  if (response.status === 404) {
    return persistCandidaturaDirectToPortalFirestore(payload);
  }

  if (!response.ok || !parsed || parsed.ok !== true) {
    const code = parsed?.code || `HTTP_${response.status}`;
    const message =
      parsed?.error ||
      (response.status === 409
        ? 'La squadra selezionata non è più disponibile. Scegli un’altra squadra libera.'
        : `Errore HTTP ${response.status} durante il salvataggio della candidatura.`);
    throw new OfficialBridgeError(message, code, response.status);
  }

  clearOfficialClientCache();
  return parsed as unknown as SubmitCandidaturaTeamResponse;
}

export async function fetchOfficialComunicati(
  archiveNumber?: number,
  bypassCache = false
): Promise<ComunicatiResponse> {
  const query =
    typeof archiveNumber === 'number' && Number.isInteger(archiveNumber) && archiveNumber > 0
      ? `?archive=${archiveNumber}`
      : '';

  try {
    const res = await fetchOfficialJson<ComunicatiResponse>(`/comunicati${query}`, { bypassCache });
    return {
      ...res,
      meta: { ...res.meta, sourceMode: 'cloud_functions' },
    };
  } catch (err) {
    if (!isBridgeUnavailableError(err)) {
      throw err;
    }
    const validArchive =
      typeof archiveNumber === 'number' && Number.isInteger(archiveNumber) && archiveNumber > 0
        ? archiveNumber
        : null;
    const docId = validArchive ? `archive_${validArchive}` : 'main_data';
    const doc = await fetchPublicOfficialFirestoreDoc(`comunicati_db/${docId}`, bypassCache);
    return {
      ok: true,
      meta: buildPublicFallbackMeta(false),
      archiveNumber: validArchive,
      document: {
        docId,
        exists: doc.exists,
        data: doc.data,
        updatedAt: asStr(doc.data?.updatedAt) || null,
      },
    };
  }
}

export function fetchStaffZonaVarData(
  idToken: string,
  bypassCache = false
): Promise<StaffZonaVarResponse> {
  const query = bypassCache ? '?refresh=1' : '';
  return fetchOfficialJson<StaffZonaVarResponse>(`/staff/zonavar${query}`, {
    idToken,
    bypassCache: true,
  });
}
