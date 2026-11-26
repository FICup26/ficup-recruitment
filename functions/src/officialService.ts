import { ReadOnlyMemoryCache, sharedOfficialCache } from './cache';
import {
  CACHE_TTL_MS,
  OFFICIAL_DATABASE_ID,
  OFFICIAL_PROJECT_ID,
  PORTAL_PROJECT_ID,
} from './config';
import {
  defaultPortalStateAdapter,
  readWhitelistedOfficialDoc,
  type OfficialDocSnapshotResult,
  type PortalStateAdapter,
} from './firebaseAdmin';
import {
  ALLOWED_SERIE_KEYS,
  assertAllowedOfficialDocPath,
  buildClubMatchKeys,
  computeZonaVarClubCategories,
  getUnavailableZonaVarClubKeys,
  InvalidInputError,
  normalizeClubKey,
  normalizeCompactLookupKey,
  normalizeLookupKey,
  normalizeSerieKey,
  resolveCanonicalLockId,
  resolveClubStandingsLink,
  sanitizeClub,
  sanitizeComunicatiDocument,
  sanitizeStandingRow,
  sanitizeSuperlegaDocument,
  sanitizeZonaVarState,
  TeamConflictError,
  toIsoOrNull,
  validateArchiveNumberParam,
  validateGiornataParam,
  validatePortalCandidaturaPayload,
  validateSerieKeyParam,
  type AllowedSerieKey,
  type AvailabilityStatus,
  type ComunicatiSanitizedDocument,
  type OfficialClub,
  type OfficialStandingRow,
  type SuperlegaSanitizedDocument,
  type ZonaVarPublicState,
  type ZonaVarSportCategory,
} from './whitelist';

export type OfficialDocReader = (docPath: string) => Promise<OfficialDocSnapshotResult>;

const SERIE_KEY_TO_DISPLAY: Record<AllowedSerieKey, string> = {
  serie_a: 'Serie A',
  serie_b: 'Serie B',
  lega_pro_a: 'Lega Pro A',
  lega_pro_b: 'Lega Pro B',
  lega_pro_c: 'Lega Pro C',
};

export interface ServiceMeta {
  sourceProjectId: string;
  sourceDatabaseId: string;
  portalProjectId: string;
  readOnly: true;
  cacheHit: boolean;
  fetchedAtIso: string;
}

export interface ClubDirectoryResponse {
  meta: ServiceMeta;
  exists: boolean;
  updatedAt: string | null;
  totalClubs: number;
  clubs: OfficialClub[];
}

export interface SerieStandingData {
  serieKey: AllowedSerieKey;
  serie: string;
  exists: boolean;
  updatedAt: string | null;
  totalRows: number;
  rows: OfficialStandingRow[];
}

export interface SingleStandingResponse {
  meta: ServiceMeta;
  standing: SerieStandingData;
}

export interface AllStandingsResponse {
  meta: ServiceMeta;
  series: Record<AllowedSerieKey, SerieStandingData>;
  availableSeriesCount: number;
}

export interface MatchdayResultsResponse {
  meta: ServiceMeta;
  giornata: number;
  document: SuperlegaSanitizedDocument;
}

export interface SuperlegaAggregateResponse {
  meta: ServiceMeta;
  mainData: SuperlegaSanitizedDocument;
}

export interface ZonaVarAnnotatedClub extends OfficialClub {
  normalizedKey: string;
  lockId: string;
  isHiddenInZonaVar: boolean;
  isBlockedInZonaVar: boolean;
  isReservedInPortal: boolean;
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

export type FreeBySerieCounts = Record<AllowedSerieKey, number>;

export interface ZonaVarIntegratedResponse {
  meta: ServiceMeta;
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
  meta: ServiceMeta;
  updatedAt: string | null;
  totalFreeTeams: number;
  bySerie: FreeBySerieCounts;
  teams: AvailableTeamDto[];
}

export interface SubmitCandidaturaResponse {
  id: string;
  codiceCandidatura: string;
  accettazioneSyncedOnFirestore: boolean;
  selectedTeam: {
    id: string;
    clubId: string;
    normalizedKey: string;
    nome: string;
    serie: string;
    serieKey: AllowedSerieKey;
  } | null;
}

export interface ComunicatiResponse {
  meta: ServiceMeta;
  archiveNumber: number | null;
  document: ComunicatiSanitizedDocument;
}

interface OfficialZonaVarBundle {
  zonaVarState: ZonaVarPublicState;
  clubsDirectoryExists: boolean;
  clubsUpdatedAt: string | null;
  clubs: OfficialClub[];
  standingsBySerie: Record<AllowedSerieKey, SerieStandingData>;
  superlegaMain: SuperlegaSanitizedDocument;
}

function buildMeta(cacheHit: boolean): ServiceMeta {
  return {
    sourceProjectId: OFFICIAL_PROJECT_ID,
    sourceDatabaseId: OFFICIAL_DATABASE_ID,
    portalProjectId: PORTAL_PROJECT_ID,
    readOnly: true,
    cacheHit,
    fetchedAtIso: new Date().toISOString(),
  };
}

function createEmptyFreeBySerie(): FreeBySerieCounts {
  return {
    serie_a: 0,
    serie_b: 0,
    lega_pro_a: 0,
    lega_pro_b: 0,
    lega_pro_c: 0,
  };
}

function normalizeSerieName(value: string): string {
  return value.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
}

function isAllowedSerieKeyValue(val: string): val is AllowedSerieKey {
  return (ALLOWED_SERIE_KEYS as readonly string[]).includes(val);
}

export class OfficialFicupService {
  private readonly reader: OfficialDocReader;
  private readonly cache: ReadOnlyMemoryCache;
  private readonly portal: PortalStateAdapter;

  constructor(
    reader: OfficialDocReader = readWhitelistedOfficialDoc,
    cache: ReadOnlyMemoryCache = sharedOfficialCache,
    portal: PortalStateAdapter = defaultPortalStateAdapter
  ) {
    this.reader = reader;
    this.cache = cache;
    this.portal = portal;
  }

  private async readSafe(docPath: string): Promise<OfficialDocSnapshotResult> {
    const safePath = assertAllowedOfficialDocPath(docPath);
    return this.reader(safePath);
  }

  public async getClubDirectory(): Promise<ClubDirectoryResponse> {
    const { value, cacheHit } = await this.cache.getOrLoad(
      'official:club_directory:public_list',
      CACHE_TTL_MS.clubDirectory,
      async () => this.loadClubDirectoryDirect()
    );

    return {
      meta: buildMeta(cacheHit),
      ...value,
    };
  }

  private async loadClubDirectoryDirect(): Promise<{
    exists: boolean;
    updatedAt: string | null;
    totalClubs: number;
    clubs: OfficialClub[];
  }> {
    const snap = await this.readSafe('club_directory/public_list');
    const rawClubs = snap.data && Array.isArray(snap.data.clubs) ? snap.data.clubs : [];
    const clubs = rawClubs
      .map(sanitizeClub)
      .filter((club): club is OfficialClub => club !== null);

    return {
      exists: snap.exists,
      updatedAt: snap.data ? toIsoOrNull(snap.data.updatedAt) : null,
      totalClubs: clubs.length,
      clubs,
    };
  }

  public async getSerieStanding(rawSerieKey: unknown): Promise<SingleStandingResponse> {
    const serieKey = validateSerieKeyParam(rawSerieKey);
    const { value, cacheHit } = await this.cache.getOrLoad(
      `official:classifiche_serie:${serieKey}`,
      CACHE_TTL_MS.standings,
      async () => this.loadSingleStanding(serieKey)
    );

    return {
      meta: buildMeta(cacheHit),
      standing: value,
    };
  }

  private async loadSingleStanding(serieKey: AllowedSerieKey): Promise<SerieStandingData> {
    const snap = await this.readSafe(`classifiche_serie/${serieKey}`);
    const rawRows = snap.data && Array.isArray(snap.data.rows) ? snap.data.rows : [];
    const rows = rawRows
      .map((row) => sanitizeStandingRow(row, serieKey))
      .filter((row): row is OfficialStandingRow => row !== null);

    const inferredSerie =
      (snap.data && typeof snap.data.serie === 'string' && snap.data.serie) ||
      rows[0]?.serie ||
      SERIE_KEY_TO_DISPLAY[serieKey];

    return {
      serieKey,
      serie: inferredSerie,
      exists: snap.exists,
      updatedAt: snap.data ? toIsoOrNull(snap.data.updatedAt) : null,
      totalRows: rows.length,
      rows,
    };
  }

  private async loadAllStandingsDirect(): Promise<{
    series: Record<AllowedSerieKey, SerieStandingData>;
    availableSeriesCount: number;
  }> {
    const results = await Promise.allSettled(
      ALLOWED_SERIE_KEYS.map((key) => this.loadSingleStanding(key))
    );

    const series = {} as Record<AllowedSerieKey, SerieStandingData>;
    let availableSeriesCount = 0;

    ALLOWED_SERIE_KEYS.forEach((key, idx) => {
      const outcome = results[idx];
      if (outcome.status === 'fulfilled') {
        series[key] = outcome.value;
        if (outcome.value.exists) {
          availableSeriesCount += 1;
        }
      } else {
        series[key] = {
          serieKey: key,
          serie: SERIE_KEY_TO_DISPLAY[key],
          exists: false,
          updatedAt: null,
          totalRows: 0,
          rows: [],
        };
      }
    });

    return { series, availableSeriesCount };
  }

  public async getAllStandings(): Promise<AllStandingsResponse> {
    const { value, cacheHit } = await this.cache.getOrLoad(
      'official:classifiche_serie:all',
      CACHE_TTL_MS.standings,
      async () => this.loadAllStandingsDirect()
    );

    return {
      meta: buildMeta(cacheHit),
      ...value,
    };
  }

  public async getMatchdayResults(rawGiornata: unknown): Promise<MatchdayResultsResponse> {
    const giornata = validateGiornataParam(rawGiornata);
    const docId = `giornata_${giornata}`;

    const { value, cacheHit } = await this.cache.getOrLoad(
      `official:superlega_top10:${docId}`,
      CACHE_TTL_MS.superlega,
      async () => {
        const snap = await this.readSafe(`superlega_top10/${docId}`);
        return sanitizeSuperlegaDocument(docId, snap.data);
      }
    );

    return {
      meta: buildMeta(cacheHit),
      giornata,
      document: value,
    };
  }

  private async loadSuperlegaDirect(): Promise<SuperlegaSanitizedDocument> {
    const snap = await this.readSafe('superlega_top10/main_data');
    return sanitizeSuperlegaDocument('main_data', snap.data);
  }

  public async getSuperlegaAggregate(): Promise<SuperlegaAggregateResponse> {
    const { value, cacheHit } = await this.cache.getOrLoad(
      'official:superlega_top10:main_data',
      CACHE_TTL_MS.superlega,
      async () => this.loadSuperlegaDirect()
    );

    return {
      meta: buildMeta(cacheHit),
      mainData: value,
    };
  }

  private async loadOfficialZonaVarBundle(bypassCache: boolean): Promise<{
    bundle: OfficialZonaVarBundle;
    cacheHit: boolean;
  }> {
    if (bypassCache) {
      const [zonaVarSnap, dir, standings, superlegaMain] = await Promise.all([
        this.readSafe('zonavar_public_state/current'),
        this.loadClubDirectoryDirect(),
        this.loadAllStandingsDirect(),
        this.loadSuperlegaDirect(),
      ]);

      return {
        cacheHit: false,
        bundle: {
          zonaVarState: sanitizeZonaVarState(zonaVarSnap.data),
          clubsDirectoryExists: dir.exists,
          clubsUpdatedAt: dir.updatedAt,
          clubs: dir.clubs,
          standingsBySerie: standings.series,
          superlegaMain,
        },
      };
    }

    const { value, cacheHit } = await this.cache.getOrLoad(
      'official:zonavar:bundle',
      CACHE_TTL_MS.zonaVarPublic,
      async () => {
        const [zonaVarSnap, dir, standings, superlegaMain] = await Promise.all([
          this.readSafe('zonavar_public_state/current'),
          this.getClubDirectory(),
          this.getAllStandings(),
          this.getSuperlegaAggregate(),
        ]);

        return {
          zonaVarState: sanitizeZonaVarState(zonaVarSnap.data),
          clubsDirectoryExists: dir.exists,
          clubsUpdatedAt: dir.updatedAt,
          clubs: dir.clubs,
          standingsBySerie: standings.series,
          superlegaMain: superlegaMain.mainData,
        } satisfies OfficialZonaVarBundle;
      }
    );

    return { bundle: value, cacheHit };
  }

  private evaluateZonaVarAvailability(
    bundle: OfficialZonaVarBundle,
    portalReservedKeys: Set<string>
  ): {
    clubs: ZonaVarAnnotatedClub[];
    clubsSummary: ZonaVarIntegratedResponse['clubsSummary'];
  } {
    const { zonaVarState, clubs, standingsBySerie, superlegaMain } = bundle;

    const { hiddenSet, blockedSet, assignedSet: officialAssignedSet } =
      getUnavailableZonaVarClubKeys(zonaVarState);
    const expandedPortalKeys = new Set<string>(portalReservedKeys);
    portalReservedKeys.forEach((k) => {
      const compact = normalizeClubKey(k);
      if (compact) expandedPortalKeys.add(compact);
    });

    const rowMapBySerie = new Map<AllowedSerieKey, Map<string, OfficialStandingRow>>();
    for (const serieKey of ALLOWED_SERIE_KEYS) {
      const serieMap = new Map<string, OfficialStandingRow>();
      const rows = standingsBySerie[serieKey]?.rows ?? [];
      for (const row of rows) {
        const rowKeys = Array.from(
          new Set(
            [
              row.squadraNorm,
              row.squadra,
              row.squadraNorm ? normalizeCompactLookupKey(row.squadraNorm) : '',
              row.squadra ? normalizeCompactLookupKey(row.squadra) : '',
            ]
              .filter(Boolean)
              .map(normalizeLookupKey)
          )
        );
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

    for (const dirClub of clubs) {
      [dirClub.linkedClassificaKey, dirClub.nome, dirClub.nomeClub]
        .filter(Boolean)
        .forEach((v) => directoryCompactKeys.add(normalizeClubKey(v)));
    }

    const evaluateSingleClub = (
      club: OfficialClub,
      preMatchedRow?: OfficialStandingRow | null
    ): ZonaVarAnnotatedClub => {
      const normalizedSerieRaw = normalizeSerieKey(club.serieKey || club.serie);
      const validSerieKey: AllowedSerieKey | null = isAllowedSerieKeyValue(normalizedSerieRaw)
        ? normalizedSerieRaw
        : null;

      const candidateKeys = Array.from(
        new Set(
          [
            ...buildClubMatchKeys(club),
            club.id ? normalizeClubKey(club.id) : '',
            club.clubId ? normalizeClubKey(club.clubId) : '',
            club.linkedClassificaKey ? normalizeClubKey(club.linkedClassificaKey) : '',
            club.nome ? normalizeClubKey(club.nome) : '',
            club.nomeClub ? normalizeClubKey(club.nomeClub) : '',
          ].filter(Boolean)
        )
      );
      const lockId = resolveCanonicalLockId(club);
      const normalizedKey = candidateKeys[0] || normalizeLookupKey(club.nome || club.clubId || club.id);

      const isHiddenInZonaVar =
        candidateKeys.some((k) => hiddenSet.has(k)) ||
        club.officialStatusRaw === 'nascosta' ||
        club.officialStatusRaw === 'hidden';

      const isBlockedInZonaVar =
        candidateKeys.some((k) => blockedSet.has(k)) ||
        club.officialStatusRaw === 'bloccata' ||
        club.officialStatusRaw === 'blocked' ||
        club.officialStatusRaw === 'chiusa';

      const isReservedInPortal =
        candidateKeys.some((k) => expandedPortalKeys.has(k)) ||
        expandedPortalKeys.has(normalizeLookupKey(lockId));

      const isAssignedInOfficial =
        candidateKeys.some((k) => officialAssignedSet.has(k)) ||
        club.explicitAssegnata === true ||
        club.explicitDisponibile === false ||
        club.officialStatusRaw === 'assegnata' ||
        club.officialStatusRaw === 'assigned' ||
        club.officialStatusRaw === 'occupata' ||
        club.officialStatusRaw === 'indisponibile';

      const standingLink = resolveClubStandingsLink(club);
      const linkedSuffix = standingLink.includes('::')
        ? standingLink.split('::').slice(1).join('::')
        : '';
      const standingSearchKeys = Array.from(
        new Set(
          [
            club.linkedClassificaKey,
            linkedSuffix,
            club.nome,
            club.nomeClub,
            club.linkedClassificaKey ? normalizeCompactLookupKey(club.linkedClassificaKey) : '',
            club.nome ? normalizeCompactLookupKey(club.nome) : '',
            club.nomeClub ? normalizeCompactLookupKey(club.nomeClub) : '',
          ]
            .filter(Boolean)
            .map(normalizeLookupKey)
        )
      );

      let matchedRow: OfficialStandingRow | null = preMatchedRow ?? null;
      if (!matchedRow && validSerieKey !== null) {
        const serieMap = rowMapBySerie.get(validSerieKey);
        if (serieMap) {
          for (const sk of standingSearchKeys) {
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
          for (const sk of standingSearchKeys) {
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

      let availabilityStatus: AvailabilityStatus;
      let exclusionReason: string | null = null;

      if (isHiddenInZonaVar) {
        availabilityStatus = 'NASCOSTA';
        exclusionReason = 'Squadra nascosta in Zona VAR (hiddenClubs).';
      } else if (isBlockedInZonaVar) {
        availabilityStatus = 'BLOCCATA';
        exclusionReason = 'Squadra bloccata in Zona VAR (blockedKeys).';
      } else if (isReservedInPortal) {
        availabilityStatus = 'ASSEGNATA';
        exclusionReason = 'Squadra già riservata o assegnata nel portale candidature.';
      } else if (isAssignedInOfficial) {
        availabilityStatus = 'ASSEGNATA';
        exclusionReason = 'Squadra risultante già assegnata o indisponibile nei dati ufficiali.';
      } else if (validSerieKey === null) {
        availabilityStatus = 'DA_VERIFICARE';
        exclusionReason = `Serie ufficiale non valida o mancante (${club.serieKey || 'vuota'}).`;
      } else {
        availabilityStatus = 'LIBERA';
        freeBySerie[validSerieKey] += 1;
      }

      return {
        ...club,
        serie: club.serie || (validSerieKey ? SERIE_KEY_TO_DISPLAY[validSerieKey] : ''),
        serieKey: validSerieKey ?? club.serieKey,
        normalizedKey,
        lockId,
        isHiddenInZonaVar,
        isBlockedInZonaVar,
        isReservedInPortal,
        availabilityStatus,
        isSelectable: availabilityStatus === 'LIBERA',
        exclusionReason,
        standingPos: matchedRow ? matchedRow.pos : null,
        standingPt: matchedRow ? matchedRow.pt : null,
        standingPtTotali: matchedRow ? matchedRow.ptTotali : null,
      };
    };

    const annotatedClubs: ZonaVarAnnotatedClub[] = clubs.map((club) =>
      evaluateSingleClub(club, null)
    );

    const addedStandingKeys = new Set<string>();
    for (const serieKey of ALLOWED_SERIE_KEYS) {
      const standing = standingsBySerie[serieKey];
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
        if (alreadyMatched || addedStandingKeys.has(dedupeKey)) {
          continue;
        }
        addedStandingKeys.add(dedupeKey);
        const canonicalId = `standing_${serieKey}_${keyNorm || keyName || 'club'}`;
        annotatedClubs.push(
          evaluateSingleClub(
            {
              id: canonicalId,
              clubId: canonicalId,
              numeroProgressivo: null,
              nome: row.squadra,
              nomeClub: row.squadra,
              serie: row.serie || SERIE_KEY_TO_DISPLAY[serieKey],
              serieKey,
              linkedClassificaKey: row.squadraNorm || row.squadra,
              isLegaTeam: true,
              isSubentrato: false,
              source: 'classifiche_serie_merged',
              officialStatusRaw: '',
              explicitDisponibile: null,
              explicitAssegnata: null,
            },
            row
          )
        );
      }
    }

    const rawMatchdays = (superlegaMain.giornate ?? []).map(
      (md) => md as unknown as Record<string, unknown>
    );
    const categoryMap = computeZonaVarClubCategories(annotatedClubs, rawMatchdays);
    for (const club of annotatedClubs) {
      const keys = [
        normalizeClubKey(club.id || club.clubId || ''),
        normalizeClubKey(club.nome),
        normalizeClubKey(club.nomeClub),
        normalizeClubKey(resolveClubStandingsLink(club)),
      ].filter(Boolean);
      let hit;
      for (const k of keys) {
        hit = categoryMap.get(k);
        if (hit) break;
      }
      club.sportCategory = hit?.category ?? 'REGOLARE';
      club.zeroMatchdaysCount = hit?.zeroMatchdaysCount ?? 0;
      club.consecutiveZerosLast3 = hit?.consecutiveZerosLast3 ?? 0;
    }

    const clubsSummary: ZonaVarIntegratedResponse['clubsSummary'] = {
      totalClubs: annotatedClubs.length,
      visibleClubs: annotatedClubs.filter((c) => !c.isHiddenInZonaVar).length,
      hiddenClubsCount: annotatedClubs.filter((c) => c.availabilityStatus === 'NASCOSTA').length,
      blockedClubsCount: annotatedClubs.filter((c) => c.availabilityStatus === 'BLOCCATA').length,
      freeClubsCount: annotatedClubs.filter((c) => c.availabilityStatus === 'LIBERA').length,
      assignedClubsCount: annotatedClubs.filter((c) => c.availabilityStatus === 'ASSEGNATA').length,
      unverifiedClubsCount: annotatedClubs.filter((c) => c.availabilityStatus === 'DA_VERIFICARE')
        .length,
      freeBySerie,
    };

    return { clubs: annotatedClubs, clubsSummary };
  }

  public async getPublicZonaVar(bypassCache = false): Promise<ZonaVarIntegratedResponse> {
    const [{ bundle, cacheHit }, portalReservedKeys] = await Promise.all([
      this.loadOfficialZonaVarBundle(bypassCache),
      this.portal.readPortalReservationKeys(),
    ]);

    const { clubs, clubsSummary } = this.evaluateZonaVarAvailability(bundle, portalReservedKeys);

    return {
      meta: buildMeta(cacheHit),
      zonaVarState: bundle.zonaVarState,
      clubsSummary,
      clubs,
      standingsBySerie: bundle.standingsBySerie,
      superlegaMain: bundle.superlegaMain,
    };
  }

  public async getAvailableTeams(bypassCache = false): Promise<AvailableTeamsResponse> {
    const [{ bundle, cacheHit }, portalReservedKeys] = await Promise.all([
      this.loadOfficialZonaVarBundle(bypassCache),
      this.portal.readPortalReservationKeys(),
    ]);

    const { clubs, clubsSummary } = this.evaluateZonaVarAvailability(bundle, portalReservedKeys);

    const teams: AvailableTeamDto[] = clubs
      .filter((club): club is ZonaVarAnnotatedClub & { serieKey: AllowedSerieKey } => {
        return (
          club.availabilityStatus === 'LIBERA' &&
          club.isSelectable &&
          isAllowedSerieKeyValue(club.serieKey)
        );
      })
      .sort((a, b) => {
        const sOrder =
          ALLOWED_SERIE_KEYS.indexOf(a.serieKey) - ALLOWED_SERIE_KEYS.indexOf(b.serieKey);
        if (sOrder !== 0) return sOrder;
        return a.nome.localeCompare(b.nome, 'it');
      })
      .map((club) => ({
        id: club.id,
        clubId: club.clubId,
        normalizedKey: club.normalizedKey,
        nome: club.nome,
        nomeClub: club.nomeClub,
        serie: club.serie || SERIE_KEY_TO_DISPLAY[club.serieKey],
        serieKey: club.serieKey,
        availabilityStatus: 'LIBERA',
        standingPos: club.standingPos,
        standingPt: club.standingPt,
        standingPtTotali: club.standingPtTotali,
        sportCategory: club.sportCategory ?? 'REGOLARE',
        zeroMatchdaysCount: club.zeroMatchdaysCount ?? 0,
        consecutiveZerosLast3: club.consecutiveZerosLast3 ?? 0,
      }));

    return {
      meta: buildMeta(cacheHit),
      updatedAt: bundle.zonaVarState.updatedAt || bundle.clubsUpdatedAt,
      totalFreeTeams: teams.length,
      bySerie: clubsSummary.freeBySerie,
      teams,
    };
  }

  public async submitCandidaturaWithTeam(body: unknown): Promise<SubmitCandidaturaResponse> {
    const submission = validatePortalCandidaturaPayload(body);

    const isOpen = await this.portal.isPortalRegistrationOpen();
    if (!isOpen) {
      throw new InvalidInputError(
        'Le iscrizioni risultano momentaneamente chiuse dallo staff FICUP.'
      );
    }

    if (submission.tipoCandidatura === 'LIBERA' || !submission.selectedTeam) {
      const commitRes = await this.portal.commitPortalFreeCandidatura({ submission });
      return {
        ...commitRes,
        selectedTeam: null,
      };
    }

    // Live bypass-cache verification directly against ficup-c9186 + candidature-ficup
    const [{ bundle }, portalReservedKeys] = await Promise.all([
      this.loadOfficialZonaVarBundle(true),
      this.portal.readPortalReservationKeys(),
    ]);

    const { clubs } = this.evaluateZonaVarAvailability(bundle, portalReservedKeys);

    const requestedIds = new Set(
      [
        submission.selectedTeam.id,
        submission.selectedTeam.clubId,
        submission.selectedTeam.normalizedKey,
        submission.selectedTeam.nome,
      ]
        .filter(Boolean)
        .flatMap((v) => [normalizeLookupKey(v), normalizeClubKey(v)])
        .filter(Boolean)
    );

    const targetClub = clubs.find((club) => {
      if (club.serieKey !== submission.selectedTeam?.serieKey) {
        return false;
      }
      const keys = [
        ...buildClubMatchKeys(club),
        club.id ? normalizeClubKey(club.id) : '',
        club.clubId ? normalizeClubKey(club.clubId) : '',
        club.nome ? normalizeClubKey(club.nome) : '',
      ].filter(Boolean);
      return keys.some((k) => requestedIds.has(k));
    });

    if (!targetClub) {
      throw new TeamConflictError(
        'La squadra selezionata non risulta presente nei dati ufficiali Zona VAR. Aggiorna la lista e scegli una squadra disponibile.',
        'TEAM_NOT_FOUND'
      );
    }

    if (targetClub.availabilityStatus !== 'LIBERA' || !targetClub.isSelectable) {
      throw new TeamConflictError(
        targetClub.exclusionReason ||
          'La squadra selezionata non è più disponibile per il subentro. Scegli una squadra libera.',
        targetClub.availabilityStatus === 'ASSEGNATA'
          ? 'TEAM_ALREADY_ASSIGNED'
          : 'TEAM_NOT_AVAILABLE'
      );
    }

    if (!isAllowedSerieKeyValue(targetClub.serieKey)) {
      throw new TeamConflictError(
        'Serie ufficiale della squadra non valida per il subentro.',
        'TEAM_NOT_AVAILABLE'
      );
    }

    const commitRes = await this.portal.commitCandidaturaWithTeamReservation({
      submission,
      verifiedClub: targetClub as ZonaVarAnnotatedClub & { serieKey: AllowedSerieKey },
    });

    // Clear official cache immediately after atomic commit
    this.cache.clear();

    return {
      ...commitRes,
      selectedTeam: {
        id: targetClub.id,
        clubId: targetClub.clubId,
        normalizedKey: targetClub.normalizedKey,
        nome: targetClub.nome,
        serie: targetClub.serie || SERIE_KEY_TO_DISPLAY[targetClub.serieKey],
        serieKey: targetClub.serieKey,
      },
    };
  }

  public async getComunicati(rawArchive?: unknown): Promise<ComunicatiResponse> {
    const archiveNumber = validateArchiveNumberParam(rawArchive);
    const docId = archiveNumber === null ? 'main_data' : `archive_${archiveNumber}`;

    const { value, cacheHit } = await this.cache.getOrLoad(
      `official:comunicati_db:${docId}`,
      CACHE_TTL_MS.comunicati,
      async () => {
        const snap = await this.readSafe(`comunicati_db/${docId}`);
        return sanitizeComunicatiDocument(docId, snap.data);
      }
    );

    return {
      meta: buildMeta(cacheHit),
      archiveNumber,
      document: value,
    };
  }
}

export const defaultOfficialService = new OfficialFicupService();

