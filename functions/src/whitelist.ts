export const ALLOWED_SERIE_KEYS = [
  'serie_a',
  'serie_b',
  'lega_pro_a',
  'lega_pro_b',
  'lega_pro_c',
] as const;

export type AllowedSerieKey = (typeof ALLOWED_SERIE_KEYS)[number];

export const FORBIDDEN_COLLECTIONS = [
  'iscritti_db',
  'zonavar_candidature_inbox',
  'zonavar_wa_alerts',
  'gironi_db',
  'sentinel_runs',
  'sentinel_findings',
  'sentinel_actions',
  'sentinel_reports',
  'sentinel_config',
] as const;

const SUPERLEGA_DOC_REGEX = /^(main_data|giornata_([1-9]|[12][0-9]|3[0-8]))$/;
const COMUNICATI_DOC_REGEX = /^(main_data|archive_([1-9]\d{0,2}))$/;

export class WhitelistViolationError extends Error {
  public readonly statusCode = 403;
  constructor(message: string) {
    super(message);
    this.name = 'WhitelistViolationError';
  }
}

export class InvalidInputError extends Error {
  public readonly statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = 'InvalidInputError';
  }
}

export function isAllowedSerieKey(value: string): value is AllowedSerieKey {
  return (ALLOWED_SERIE_KEYS as readonly string[]).includes(value);
}

export function validateSerieKeyParam(raw: unknown): AllowedSerieKey {
  if (typeof raw !== 'string') {
    throw new InvalidInputError('Parametro serieKey mancante o non valido.');
  }
  const normalized = raw.trim().toLowerCase();
  if (!isAllowedSerieKey(normalized)) {
    throw new InvalidInputError(
      `Serie '${normalized}' non valida. Valori ammessi: ${ALLOWED_SERIE_KEYS.join(', ')}.`
    );
  }
  return normalized;
}

export function validateGiornataParam(raw: unknown): number {
  let num: number;
  if (typeof raw === 'number') {
    num = raw;
  } else if (typeof raw === 'string') {
    const cleaned = raw.trim().toLowerCase().replace(/^giornata_/, '');
    if (!/^\d{1,2}$/.test(cleaned)) {
      throw new InvalidInputError('Numero giornata non valido (atteso intero 1..38).');
    }
    num = Number(cleaned);
  } else {
    throw new InvalidInputError('Parametro giornata mancante.');
  }

  if (!Number.isInteger(num) || num < 1 || num > 38) {
    throw new InvalidInputError('Il numero giornata deve essere compreso tra 1 e 38.');
  }
  return num;
}

export function validateArchiveNumberParam(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === '') {
    return null;
  }
  const str = String(raw).trim().toLowerCase().replace(/^archive_/, '');
  if (!/^\d{1,3}$/.test(str)) {
    throw new InvalidInputError('Numero archivio comunicati non valido (atteso intero 1..999).');
  }
  const num = Number(str);
  if (!Number.isInteger(num) || num < 1 || num > 999) {
    throw new InvalidInputError('Numero archivio comunicati fuori intervallo (1..999).');
  }
  return num;
}

export function assertAllowedOfficialDocPath(docPath: string): string {
  if (typeof docPath !== 'string') {
    throw new WhitelistViolationError('Percorso documento non valido.');
  }
  const normalized = docPath.trim().replace(/^\/+|\/+$/g, '');
  const segments = normalized.split('/');
  if (segments.length !== 2) {
    throw new WhitelistViolationError(
      `Percorso '${normalized}' non consentito: ammesso solo accesso diretto collection/docId.`
    );
  }

  const [collectionId, docId] = segments;

  if ((FORBIDDEN_COLLECTIONS as readonly string[]).includes(collectionId)) {
    throw new WhitelistViolationError(
      `Accesso negato: la collezione '${collectionId}' è espressamente vietata.`
    );
  }

  if (collectionId === 'club_directory' && docId === 'public_list') {
    return normalized;
  }
  if (collectionId === 'classifiche_serie' && isAllowedSerieKey(docId)) {
    return normalized;
  }
  if (collectionId === 'superlega_top10' && SUPERLEGA_DOC_REGEX.test(docId)) {
    return normalized;
  }
  if (collectionId === 'zonavar_public_state' && docId === 'current') {
    return normalized;
  }
  if (collectionId === 'comunicati_db' && COMUNICATI_DOC_REGEX.test(docId)) {
    return normalized;
  }

  throw new WhitelistViolationError(
    `Documento '${normalized}' non presente nella whitelist ufficiale in sola lettura.`
  );
}

// =============================================================================
// Field Sanitizers & Privacy Filters (Zero PII / Zero 'presidente')
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

export function isBannedPiiKey(key: string): boolean {
  return BANNED_PII_KEYS.has(key.trim().toLowerCase());
}

export function stripBannedFieldsDeep(value: unknown, depth = 0): unknown {
  if (depth > 8 || value === null || value === undefined) {
    return value ?? null;
  }
  if (Array.isArray(value)) {
    return value.map((item) => stripBannedFieldsDeep(item, depth + 1));
  }
  if (typeof value === 'object') {
    // Handle Firestore Timestamp-like objects
    const maybeTs = value as { toDate?: () => Date; _seconds?: number; seconds?: number };
    if (typeof maybeTs.toDate === 'function') {
      return maybeTs.toDate().toISOString();
    }
    if (typeof maybeTs._seconds === 'number') {
      return new Date(maybeTs._seconds * 1000).toISOString();
    }
    if (typeof maybeTs.seconds === 'number') {
      return new Date(maybeTs.seconds * 1000).toISOString();
    }

    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (isBannedPiiKey(k)) {
        continue;
      }
      out[k] = stripBannedFieldsDeep(v, depth + 1);
    }
    return out;
  }
  return value;
}

export function toIsoOrNull(value: unknown): string | null {
  if (!value) {
    return null;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  if (typeof value === 'object') {
    const ts = value as { toDate?: () => Date; _seconds?: number; seconds?: number };
    if (typeof ts.toDate === 'function') {
      return ts.toDate().toISOString();
    }
    if (typeof ts._seconds === 'number') {
      return new Date(ts._seconds * 1000).toISOString();
    }
    if (typeof ts.seconds === 'number') {
      return new Date(ts.seconds * 1000).toISOString();
    }
  }
  return null;
}

function asString(val: unknown, fallback = ''): string {
  return typeof val === 'string' ? val : val === null || val === undefined ? fallback : String(val);
}

function asNumber(val: unknown, fallback = 0): number {
  if (typeof val === 'number' && Number.isFinite(val)) {
    return val;
  }
  if (typeof val === 'string' && val.trim() !== '') {
    const n = Number(val.replace(',', '.'));
    if (Number.isFinite(n)) {
      return n;
    }
  }
  return fallback;
}

function asOptionalNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === '') {
    return null;
  }
  if (typeof val === 'number' && Number.isFinite(val)) {
    return val;
  }
  if (typeof val === 'string' && val.trim() !== '') {
    const n = Number(val.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  return null;
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

export class TeamConflictError extends Error {
  public readonly statusCode = 409;
  public readonly code: string;
  constructor(message: string, code = 'TEAM_NOT_AVAILABLE') {
    super(message);
    this.name = 'TeamConflictError';
    this.code = code;
  }
}

export function normalizeLookupKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function normalizeCompactLookupKey(value: string): string {
  const withoutSeriePrefix = value.includes('::') ? value.split('::').slice(1).join('::') : value;
  return normalizeLookupKey(withoutSeriePrefix).replace(/[^a-z0-9]/g, '');
}

function asOptionalBool(val: unknown): boolean | null {
  if (typeof val === 'boolean') {
    return val;
  }
  if (typeof val === 'string') {
    const clean = val.trim().toLowerCase();
    if (clean === 'true' || clean === 'si' || clean === 'sì' || clean === '1') {
      return true;
    }
    if (clean === 'false' || clean === 'no' || clean === '0') {
      return false;
    }
  }
  return null;
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
  officialStatusRaw: string;
  explicitDisponibile: boolean | null;
  explicitAssegnata: boolean | null;
}

export function sanitizeClub(raw: unknown): OfficialClub | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const d = raw as Record<string, unknown>;
  const id = asString(d.id ?? d.clubId).trim();
  const nome = asString(d.nome ?? d.nomeClub).trim();
  if (!id && !nome) {
    return null;
  }
  const officialStatusRaw = normalizeLookupKey(
    asString(d.zonaVarStato ?? d.stato ?? d.status ?? '')
  );
  const explicitDisponibile = asOptionalBool(
    d.disponibile ?? d.isAvailable ?? d.libera ?? d.isLibera
  );
  const explicitAssegnata = asOptionalBool(d.assegnata ?? d.isAssigned ?? d.occupata);

  return {
    id,
    clubId: asString(d.clubId ?? d.id).trim(),
    numeroProgressivo: asOptionalNumber(d.numeroProgressivo),
    nome,
    nomeClub: asString(d.nomeClub ?? d.nome).trim(),
    serie: asString(d.serie).trim(),
    serieKey: asString(d.serieKey).trim().toLowerCase(),
    linkedClassificaKey: asString(d.linkedClassificaKey).trim(),
    isLegaTeam: Boolean(d.isLegaTeam),
    isSubentrato: Boolean(d.isSubentrato),
    source: asString(d.source).trim(),
    officialStatusRaw,
    explicitDisponibile,
    explicitAssegnata,
  };
}

export function buildClubMatchKeys(
  club: Pick<OfficialClub, 'id' | 'clubId' | 'nome' | 'nomeClub' | 'linkedClassificaKey'>
): string[] {
  const keys = [
    club.id,
    club.clubId,
    club.linkedClassificaKey,
    club.nome,
    club.nomeClub,
  ]
    .filter((v) => typeof v === 'string' && v.trim().length > 0)
    .map((v) => normalizeLookupKey(v));
  return Array.from(new Set(keys));
}

export function resolveCanonicalLockId(
  club: Pick<OfficialClub, 'id' | 'clubId' | 'linkedClassificaKey' | 'nome' | 'nomeClub'>
): string {
  const canonicalSource =
    club.clubId || club.id || club.linkedClassificaKey || club.nomeClub || club.nome;
  const slug = normalizeLookupKey(canonicalSource)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 96);
  return `club_${slug || 'unknown'}`;
}

export function normalizeClubKey(value: string): string {
  return normalizeCompactLookupKey(value);
}

export function cleanSuperlegaTeamName(value: string): string {
  return asString(value).trim().replace(/\s+/g, ' ');
}

export function getNormalizedSuperlegaTeamKey(value: string): string {
  return normalizeCompactLookupKey(value);
}

export function normalizeSerieKey(value: string): string {
  const clean = asString(value).trim().toLowerCase().replace(/[_-]+/g, '_');
  if (clean.includes('serie_a') || clean === 'a') return 'serie_a';
  if (clean.includes('serie_b') || clean === 'b') return 'serie_b';
  if (clean.includes('lega_pro_a') || clean === 'legapro_a' || clean === 'pro_a') return 'lega_pro_a';
  if (clean.includes('lega_pro_b') || clean === 'legapro_b' || clean === 'pro_b') return 'lega_pro_b';
  if (clean.includes('lega_pro_c') || clean === 'legapro_c' || clean === 'pro_c') return 'lega_pro_c';
  return clean;
}

export function resolveClubStandingsLink(club: OfficialClub): string {
  return club.linkedClassificaKey || club.nome || club.nomeClub;
}

export function getUnavailableZonaVarClubKeys(state: ZonaVarPublicState): {
  hiddenSet: Set<string>;
  blockedSet: Set<string>;
  assignedSet: Set<string>;
} {
  const hiddenSet = new Set<string>();
  const blockedSet = new Set<string>();
  const assignedSet = new Set<string>();
  const addItems = (target: Set<string>, list: string[] | undefined) => {
    for (const item of list ?? []) {
      const clean = asString(item).trim();
      if (!clean) continue;
      target.add(normalizeLookupKey(clean));
      const compact = normalizeCompactLookupKey(clean);
      if (compact) target.add(compact);
    }
  };
  addItems(hiddenSet, state.hiddenClubs);
  addItems(blockedSet, state.blockedKeys);
  addItems(assignedSet, state.assignedKeys);
  return { hiddenSet, blockedSet, assignedSet };
}

function extractMatchdayScoreEntriesServer(md: Record<string, unknown>): SuperlegaAllResultItem[] {
  const all = Array.isArray(md.allResults) ? md.allResults : [];
  if (all.length > 0) {
    return all
      .map(sanitizeAllResultItem)
      .filter((item): item is SuperlegaAllResultItem => item !== null);
  }
  const top10 = Array.isArray(md.top10) ? md.top10 : [];
  return top10
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const e = entry as Record<string, unknown>;
      const fantasquadra = cleanSuperlegaTeamName(asString(e.fantasquadra ?? e.squadra));
      if (!fantasquadra) return null;
      return {
        fantasquadra,
        punteggio: asNumber(e.punteggio ?? e.pt),
        gol: asNumber(e.gol),
        serie: asString(e.serie),
      };
    })
    .filter((item): item is SuperlegaAllResultItem => item !== null);
}

export function getClubsWithZeroInLast3ImportedMatches(
  matchdays: Array<Record<string, unknown>>
): Map<string, number> {
  const zeroCounts = new Map<string, number>();
  const sorted = [...matchdays].sort(
    (a, b) => asNumber(a.giornata ?? a.matchday) - asNumber(b.giornata ?? b.matchday)
  );
  const lastThree = sorted.slice(-3);

  for (const md of lastThree) {
    const results = extractMatchdayScoreEntriesServer(md);
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

export interface ServerClubCategoryDetails {
  category: ZonaVarSportCategory;
  zeroMatchdaysCount: number;
  consecutiveZerosLast3: number;
}

export function computeZonaVarClubCategories(
  clubs: Array<Pick<OfficialClub, 'id' | 'clubId' | 'nome' | 'nomeClub' | 'linkedClassificaKey'>>,
  matchdays: Array<Record<string, unknown>>
): Map<string, ServerClubCategoryDetails> {
  const sorted = [...matchdays]
    .filter((md) => asNumber(md.giornata ?? md.matchday) >= 1)
    .sort((a, b) => asNumber(a.giornata ?? a.matchday) - asNumber(b.giornata ?? b.matchday));

  const totalZerosByKey = new Map<string, number>();
  const knownKeys = new Set<string>();

  for (const md of sorted) {
    const results = extractMatchdayScoreEntriesServer(md);
    const seen = new Set<string>();
    for (const res of results) {
      const compactKey = getNormalizedSuperlegaTeamKey(res.fantasquadra);
      if (!compactKey || seen.has(compactKey)) continue;
      seen.add(compactKey);
      knownKeys.add(compactKey);
      if (res.punteggio === 0) {
        totalZerosByKey.set(compactKey, (totalZerosByKey.get(compactKey) ?? 0) + 1);
      }
    }
  }

  const last3Mds = sorted.slice(-3);
  const categories = new Map<string, ServerClubCategoryDetails>();

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
      if (knownKeys.has(ck) || totalZerosByKey.has(ck)) {
        matchedKey = ck;
        break;
      }
    }

    const totalZeros = matchedKey ? (totalZerosByKey.get(matchedKey) ?? 0) : 0;
    let tailZeros = 0;
    if (matchedKey && last3Mds.length > 0) {
      for (let i = last3Mds.length - 1; i >= 0; i -= 1) {
        const mdResults = extractMatchdayScoreEntriesServer(last3Mds[i]);
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

    const details: ServerClubCategoryDetails = {
      category,
      zeroMatchdaysCount: totalZeros,
      consecutiveZerosLast3: tailZeros,
    };
    for (const ck of clubKeys) {
      if (!categories.has(ck)) {
        categories.set(ck, details);
      }
    }
  }

  return categories;
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

export function sanitizeStandingRow(
  raw: unknown,
  fallbackSerieKey: AllowedSerieKey
): OfficialStandingRow | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const d = raw as Record<string, unknown>;
  const squadra = asString(d.squadra).trim();
  if (!squadra) {
    return null;
  }
  const pos = asNumber(d.pos);
  return {
    pos,
    posDisplay: asString(d.posDisplay, String(pos)).trim() || String(pos),
    squadra,
    squadraNorm: asString(d.squadraNorm).trim(),
    g: asNumber(d.g),
    v: asNumber(d.v),
    n: asNumber(d.n),
    p: asNumber(d.p),
    gf: asNumber(d.gf),
    gs: asNumber(d.gs),
    dr: asNumber(d.dr),
    pt: asNumber(d.pt),
    ptTotali: asNumber(d.ptTotali),
    serieKey: asString(d.serieKey, fallbackSerieKey).trim().toLowerCase(),
    serie: asString(d.serie).trim(),
  };
}

export interface SuperlegaAllResultItem {
  fantasquadra: string;
  punteggio: number;
  gol: number;
  serie: string;
}

export function sanitizeAllResultItem(raw: unknown): SuperlegaAllResultItem | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const d = raw as Record<string, unknown>;
  const fantasquadra = asString(d.fantasquadra);
  if (!fantasquadra) {
    return null;
  }
  // Strictly return ONLY the 4 allowed fields — never 'presidente' or other personal fields
  return {
    fantasquadra,
    punteggio: asNumber(d.punteggio),
    gol: asNumber(d.gol),
    serie: asString(d.serie),
  };
}

export interface SuperlegaMatchdaySummary {
  giornata: number;
  top10: unknown[];
  allResults: SuperlegaAllResultItem[];
  matches: unknown[];
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
  top10: unknown[];
  allResults: SuperlegaAllResultItem[];
  matches: unknown[];
  giornate: SuperlegaMatchdaySummary[];
  availableGiornate: number[];
  cumulativeTop10: SuperlegaCumulativeRow[];
  totalResultsImported: number | null;
  updatedAt: string | null;
}

function buildCumulativeSuperlegaTop10(
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
      if (rawEntry && typeof rawEntry === 'object') {
        const e = rawEntry as Record<string, unknown>;
        const name = asString(e.fantasquadra ?? e.squadra).trim();
        if (name) {
          top10Names.add(normalizeLookupKey(name));
        }
      }
    }

    const sourceList: SuperlegaAllResultItem[] =
      md.allResults.length > 0
        ? md.allResults
        : md.top10
            .map((entry) => {
              if (!entry || typeof entry !== 'object') return null;
              const e = entry as Record<string, unknown>;
              const fantasquadra = asString(e.fantasquadra ?? e.squadra).trim();
              if (!fantasquadra) return null;
              return {
                fantasquadra,
                punteggio: asNumber(e.punteggio ?? e.pt),
                gol: asNumber(e.gol),
                serie: asString(e.serie),
              };
            })
            .filter((item): item is SuperlegaAllResultItem => item !== null);

    for (const item of sourceList) {
      const key = `${normalizeLookupKey(item.fantasquadra)}::${normalizeLookupKey(item.serie)}`;
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
      if (top10Names.has(normalizeLookupKey(item.fantasquadra))) {
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
      if (b.punteggioTotale !== a.punteggioTotale) {
        return b.punteggioTotale - a.punteggioTotale;
      }
      if (b.golTotali !== a.golTotali) {
        return b.golTotali - a.golTotali;
      }
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

export function sanitizeSuperlegaDocument(
  docId: string,
  raw: Record<string, unknown> | null
): SuperlegaSanitizedDocument {
  if (!raw) {
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

  const rawTop10 = Array.isArray(raw.top10) ? raw.top10 : [];
  const rawAllResults = Array.isArray(raw.allResults) ? raw.allResults : [];
  const rawMatches = Array.isArray(raw.matches) ? raw.matches : [];
  const rawNestedData = Array.isArray(raw.data) ? raw.data : [];

  const giornate: SuperlegaMatchdaySummary[] = rawNestedData
    .map((entry): SuperlegaMatchdaySummary | null => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }
      const d = entry as Record<string, unknown>;
      const g = asOptionalNumber(d.giornata);
      if (g === null || !Number.isInteger(g) || g < 1 || g > 38) {
        return null;
      }
      const mdTop10 = Array.isArray(d.top10) ? d.top10 : [];
      const mdAll = Array.isArray(d.allResults) ? d.allResults : [];
      const mdMatches = Array.isArray(d.matches) ? d.matches : [];
      return {
        giornata: g,
        top10: mdTop10.map((item) => stripBannedFieldsDeep(item)),
        allResults: mdAll
          .map(sanitizeAllResultItem)
          .filter((item): item is SuperlegaAllResultItem => item !== null),
        matches: mdMatches.map((item) => stripBannedFieldsDeep(item)),
        totalResultsImported: asOptionalNumber(d.totalResultsImported),
        updatedAt: toIsoOrNull(d.updatedAt),
      };
    })
    .filter((item): item is SuperlegaMatchdaySummary => item !== null)
    .sort((a, b) => a.giornata - b.giornata);

  const sanitizedTop10 = rawTop10.map((entry) => stripBannedFieldsDeep(entry));
  const sanitizedAllResults = rawAllResults
    .map(sanitizeAllResultItem)
    .filter((item): item is SuperlegaAllResultItem => item !== null);
  const sanitizedMatches = rawMatches.map((entry) => stripBannedFieldsDeep(entry));

  const latestMatchday = giornate.length > 0 ? giornate[giornate.length - 1] : null;
  const effectiveTop10 =
    sanitizedTop10.length > 0 ? sanitizedTop10 : (latestMatchday?.top10 ?? []);
  const availableGiornate = giornate.map((md) => md.giornata);
  const cumulativeTop10 =
    giornate.length > 0 ? buildCumulativeSuperlegaTop10(giornate) : [];

  return {
    docId,
    exists: true,
    giornata: asOptionalNumber(raw.giornata),
    top10: effectiveTop10,
    allResults: sanitizedAllResults,
    matches: sanitizedMatches,
    giornate,
    availableGiornate,
    cumulativeTop10,
    totalResultsImported:
      asOptionalNumber(raw.totalResultsImported) ?? latestMatchday?.totalResultsImported ?? null,
    updatedAt: toIsoOrNull(raw.updatedAt) ?? latestMatchday?.updatedAt ?? null,
  };
}

export interface ZonaVarPublicState {
  exists: boolean;
  hiddenClubs: string[];
  blockedKeys: string[];
  assignedKeys: string[];
  updatedAt: string | null;
}

export function sanitizeZonaVarState(raw: Record<string, unknown> | null): ZonaVarPublicState {
  if (!raw) {
    return {
      exists: false,
      hiddenClubs: [],
      blockedKeys: [],
      assignedKeys: [],
      updatedAt: null,
    };
  }

  const hiddenClubs = Array.isArray(raw.hiddenClubs)
    ? raw.hiddenClubs.map((item) => asString(item).trim()).filter(Boolean)
    : [];
  const blockedKeys = Array.isArray(raw.blockedKeys)
    ? raw.blockedKeys.map((item) => asString(item).trim()).filter(Boolean)
    : [];
  const rawAssigned = Array.isArray(raw.assignedKeys)
    ? raw.assignedKeys
    : Array.isArray(raw.assignedClubs)
      ? raw.assignedClubs
      : [];
  const assignedKeys = rawAssigned.map((item) => asString(item).trim()).filter(Boolean);

  return {
    exists: true,
    hiddenClubs,
    blockedKeys,
    assignedKeys,
    updatedAt: toIsoOrNull(raw.updatedAt),
  };
}

export interface ComunicatiSanitizedDocument {
  docId: string;
  exists: boolean;
  data: Record<string, unknown> | null;
  updatedAt: string | null;
}

export function sanitizeComunicatiDocument(
  docId: string,
  raw: Record<string, unknown> | null
): ComunicatiSanitizedDocument {
  if (!raw) {
    return {
      docId,
      exists: false,
      data: null,
      updatedAt: null,
    };
  }

  const sanitized = stripBannedFieldsDeep(raw) as Record<string, unknown>;
  return {
    docId,
    exists: true,
    data: sanitized,
    updatedAt: toIsoOrNull(raw.updatedAt),
  };
}

// =============================================================================
// Server-Side Candidature Input & Italian Mobile Validation (candidature-ficup)
// =============================================================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ITALIAN_MOBILE_REGEX = /^\+393[1-9]\d{8}$/;

const BLOCKED_DUMMY_MOBILE_NUMBERS = new Set([
  '320000000',
  '3200000000',
  '3333333333',
  '3000000000',
  '3111111111',
  '3222222222',
  '3444444444',
  '3555555555',
  '3666666666',
  '3777777777',
  '3888888888',
  '3999999999',
  '3401234567',
  '3471234567',
  '3331234567',
  '3201234567',
  '3123456789',
  '3987654321',
]);

const ARTIFICIAL_SEQUENCE_SUBSTRINGS = [
  '012345',
  '123456',
  '234567',
  '345678',
  '456789',
  '567890',
  '987654',
  '876543',
  '765432',
  '654321',
  '543210',
  '098765',
];

export function normalizeAndValidateItalianPhoneServer(raw: unknown): string {
  if (typeof raw !== 'string') {
    throw new InvalidInputError('Numero di cellulare obbligatorio.');
  }
  const cleaned = raw.trim().replace(/[\s\-()./]/g, '');
  if (!cleaned || !/^\+?\d+$/.test(cleaned)) {
    throw new InvalidInputError(
      'Inserire un numero di cellulare italiano valido con prefisso +39.'
    );
  }

  let normalized = cleaned;
  if (normalized.startsWith('00')) {
    if (!normalized.startsWith('0039')) {
      throw new InvalidInputError(
        'Sono ammessi esclusivamente numeri di cellulare italiani con prefisso +39.'
      );
    }
    normalized = `+39${normalized.slice(4)}`;
  } else if (normalized.startsWith('+')) {
    if (!normalized.startsWith('+39')) {
      throw new InvalidInputError(
        'Sono ammessi esclusivamente numeri di cellulare italiani con prefisso +39.'
      );
    }
  } else if (normalized.startsWith('39') && normalized.length >= 11) {
    normalized = `+${normalized}`;
  } else {
    normalized = `+39${normalized}`;
  }

  const subscriber = normalized.slice(3);
  if (/^(\d)\1+$/.test(subscriber) || /^(\d)\1+$/.test(cleaned.replace(/^\+/, ''))) {
    throw new InvalidInputError(
      'Numero non valido: non sono ammessi numeri composti da cifre tutte uguali.'
    );
  }
  if (subscriber.startsWith('0') || !subscriber.startsWith('3') || subscriber.length !== 10) {
    throw new InvalidInputError(
      'Il numero di cellulare italiano deve contenere esattamente 10 cifre dopo +39 (inizia con 3).'
    );
  }
  if (!ITALIAN_MOBILE_REGEX.test(normalized) || BLOCKED_DUMMY_MOBILE_NUMBERS.has(subscriber)) {
    throw new InvalidInputError('Numero di cellulare italiano non valido o di esempio.');
  }
  const distinctDigits = new Set(subscriber.split('')).size;
  if (
    distinctDigits <= 2 ||
    /(\d)\1{6,}/.test(subscriber) ||
    /(\d)\1{5}$/.test(subscriber) ||
    /^\d{2}(\d{2})\1{3}$/.test(subscriber)
  ) {
    throw new InvalidInputError('Numero non valido: sequenza ripetitiva non ammessa.');
  }
  const tailSevenDigits = subscriber.slice(3);
  if (
    ARTIFICIAL_SEQUENCE_SUBSTRINGS.some(
      (seq) => subscriber.includes(seq) || tailSevenDigits.includes(seq)
    )
  ) {
    throw new InvalidInputError('Numero non valido: sequenza numerica artificiale non ammessa.');
  }

  return `+39 ${subscriber.slice(0, 3)} ${subscriber.slice(3, 6)} ${subscriber.slice(6)}`;
}

export interface ValidatedCandidaturaSubmission {
  nome: string;
  cognome: string;
  emailFantaleghe: string;
  cellulare: string;
  note: string;
  tipoCandidatura: 'LIBERA' | 'SUBENTRO';
  consensoPrivacy: true;
  versioneInformativa: string;
  regolamentoAccettato: true;
  regolamentoVersione: string;
  regolamentoDocId: string;
  regoleChatAccettate: true;
  versioneRegoleChat: string;
  selectedTeam: {
    id: string;
    clubId: string;
    normalizedKey: string;
    serieKey: AllowedSerieKey;
    nome: string;
  } | null;
}

export function validatePortalCandidaturaPayload(body: unknown): ValidatedCandidaturaSubmission {
  if (!body || typeof body !== 'object') {
    throw new InvalidInputError('Payload candidatura mancante o non valido.');
  }
  const b = body as Record<string, unknown>;

  const nome = asString(b.nome).trim().slice(0, 80);
  const cognome = asString(b.cognome).trim().slice(0, 80);
  const emailFantaleghe = asString(b.emailFantaleghe).trim().toLowerCase().slice(0, 160);
  const cellulare = normalizeAndValidateItalianPhoneServer(b.cellulare);
  const note = asString(b.note).trim().slice(0, 750);
  const rawTipo = asString(b.tipoCandidatura).trim().toUpperCase();
  const tipoCandidatura: 'LIBERA' | 'SUBENTRO' = rawTipo === 'LIBERA' ? 'LIBERA' : 'SUBENTRO';

  if (nome.length < 1 || cognome.length < 1) {
    throw new InvalidInputError('Nome e cognome sono obbligatori.');
  }
  if (!EMAIL_REGEX.test(emailFantaleghe) || emailFantaleghe.length < 5) {
    throw new InvalidInputError('Indirizzo email Fantaleghe non valido.');
  }
  if (b.consensoPrivacy !== true) {
    throw new InvalidInputError("Il consenso all'Informativa Privacy è obbligatorio.");
  }
  if (b.regolamentoAccettato !== true) {
    throw new InvalidInputError("L'accettazione del Regolamento Ufficiale è obbligatoria.");
  }
  if (b.regoleChatAccettate !== true) {
    throw new InvalidInputError("L'accettazione delle Regole Chat WhatsApp è obbligatoria.");
  }

  let selectedTeam: ValidatedCandidaturaSubmission['selectedTeam'] = null;
  if (tipoCandidatura === 'SUBENTRO') {
    const rawTeam = b.selectedTeam;
    if (!rawTeam || typeof rawTeam !== 'object') {
      throw new InvalidInputError(
        'Devi selezionare una squadra disponibile dalla Zona VAR ufficiale.'
      );
    }
    const t = rawTeam as Record<string, unknown>;
    const teamId = asString(t.id ?? t.clubId).trim();
    const teamClubId = asString(t.clubId ?? t.id).trim();
    const teamSerieKey = validateSerieKeyParam(t.serieKey);
    const teamNome = asString(t.nome ?? t.nomeClub).trim().slice(0, 80);
    const rawNormKey = asString(t.normalizedKey).trim();
    const normalizedKey = normalizeLookupKey(rawNormKey || teamClubId || teamId || teamNome);

    if (!teamId && !teamClubId) {
      throw new InvalidInputError('Identificativo ufficiale della squadra mancante.');
    }
    if (!normalizedKey) {
      throw new InvalidInputError('Chiave canonica della squadra mancante.');
    }

    selectedTeam = {
      id: teamId || teamClubId,
      clubId: teamClubId || teamId,
      normalizedKey,
      serieKey: teamSerieKey,
      nome: teamNome,
    };
  }

  return {
    nome,
    cognome,
    emailFantaleghe,
    cellulare,
    note,
    tipoCandidatura,
    consensoPrivacy: true,
    versioneInformativa: asString(b.versioneInformativa).trim().slice(0, 32) || '2026.1',
    regolamentoAccettato: true,
    regolamentoVersione:
      asString(b.regolamentoVersione).trim().slice(0, 64) || 'in-attesa-pubblicazione',
    regolamentoDocId: asString(b.regolamentoDocId).trim().slice(0, 128) || 'nessuno',
    regoleChatAccettate: true,
    versioneRegoleChat: asString(b.versioneRegoleChat).trim().slice(0, 32) || '2026.1',
    selectedTeam,
  };
}

