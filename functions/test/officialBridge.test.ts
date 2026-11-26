import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import { createOfficialApiApp } from '../src/app';
import { ReadOnlyMemoryCache } from '../src/cache';
import { isOriginAllowed } from '../src/config';
import type { PortalStateAdapter } from '../src/firebaseAdmin';
import { OfficialFicupService, type OfficialDocReader } from '../src/officialService';
import {
  assertAllowedOfficialDocPath,
  buildClubMatchKeys,
  FORBIDDEN_COLLECTIONS,
  normalizeLookupKey,
  resolveCanonicalLockId,
  TeamConflictError,
  WhitelistViolationError,
} from '../src/whitelist';

interface MockPortalStore {
  registrationOpen: boolean;
  locks: Map<string, { candidaturaId: string; matchKeys: string[]; statoAssegnazione: string }>;
  candidature: Array<Record<string, unknown>>;
  extraReservedNames: Set<string>;
}

function createMockPortalAdapter(): {
  adapter: PortalStateAdapter;
  store: MockPortalStore;
} {
  const store: MockPortalStore = {
    registrationOpen: true,
    locks: new Map(),
    candidature: [],
    extraReservedNames: new Set(),
  };

  const adapter: PortalStateAdapter = {
    readPortalReservationKeys: async () => {
      const keys = new Set<string>(store.extraReservedNames);
      for (const [lockId, lock] of store.locks.entries()) {
        if (lock.statoAssegnazione === 'RILASCIATA') continue;
        keys.add(normalizeLookupKey(lockId));
        for (const mk of lock.matchKeys) {
          keys.add(normalizeLookupKey(mk));
        }
      }
      return keys;
    },
    isPortalRegistrationOpen: async () => store.registrationOpen,
    commitCandidaturaWithTeamReservation: async ({ submission, verifiedClub }) => {
      const lockId = resolveCanonicalLockId(verifiedClub);
      const existing = store.locks.get(lockId);
      if (existing && existing.statoAssegnazione !== 'RILASCIATA') {
        throw new TeamConflictError(
          'Squadra già prenotata da un altro candidato in concorrenza.',
          'TEAM_ALREADY_ASSIGNED'
        );
      }

      const id = `cand-${store.candidature.length + 1}`;
      const codiceCandidatura = `FICUP26-TST${String(store.candidature.length + 1).padStart(3, '0')}`;
      store.locks.set(lockId, {
        candidaturaId: id,
        matchKeys: buildClubMatchKeys(verifiedClub),
        statoAssegnazione: 'RISERVATA',
      });
      store.candidature.push({
        id,
        codiceCandidatura,
        nome: submission.nome,
        cognome: submission.cognome,
        emailFantaleghe: submission.emailFantaleghe,
        nomeSquadra: verifiedClub.nome,
        stato: 'NUOVO',
      });

      return {
        id,
        codiceCandidatura,
        accettazioneSyncedOnFirestore: true,
      };
    },
  };

  return { adapter, store };
}

function createMockReader(options?: { omitZonaVarState?: boolean }): {
  reader: OfficialDocReader;
  readCounts: Record<string, number>;
} {
  const readCounts: Record<string, number> = {};
  const docs: Record<string, Record<string, unknown>> = {
    'club_directory/public_list': {
      updatedAt: '2026-11-20T12:00:00.000Z',
      clubs: [
        {
          id: 'c1',
          clubId: 'club-001',
          numeroProgressivo: 1,
          nome: 'Real Test FC',
          nomeClub: 'Real Test FC',
          serie: 'Serie A',
          serieKey: 'serie_a',
          linkedClassificaKey: 'serie_a::realtestfc',
          isLegaTeam: true,
          isSubentrato: false,
          source: 'official',
          presidente: 'Mario Rossi PRIVATO',
          email: 'mario.rossi@privato.it',
          telefono: '+393331234567',
        },
        {
          id: 'c2',
          clubId: 'club-002',
          numeroProgressivo: 2,
          nome: 'Hidden FC',
          nomeClub: 'Hidden FC',
          serie: 'Serie B',
          serieKey: 'serie_b',
          linkedClassificaKey: 'hidden fc',
          isLegaTeam: true,
          isSubentrato: true,
          source: 'official',
          presidente: 'Luigi Bianchi PRIVATO',
        },
        {
          id: 'c3',
          clubId: 'club-003',
          numeroProgressivo: 3,
          nome: 'Libera B FC',
          nomeClub: 'Libera B FC',
          serie: 'Serie B',
          serieKey: 'serie_b',
          linkedClassificaKey: 'libera b fc',
          isLegaTeam: true,
          isSubentrato: false,
          source: 'official',
          presidente: 'Privacy B',
        },
        {
          id: 'c4',
          clubId: 'club-004',
          numeroProgressivo: 4,
          nome: 'Bloccata City',
          nomeClub: 'Bloccata City',
          serie: 'Serie A',
          serieKey: 'serie_a',
          linkedClassificaKey: 'bloccata city',
          isLegaTeam: true,
          isSubentrato: false,
          source: 'official',
        },
        {
          id: 'c5',
          clubId: 'club-005',
          numeroProgressivo: 5,
          nome: 'Subentrato United',
          nomeClub: 'Subentrato United',
          serie: 'Serie A',
          serieKey: 'serie_a',
          linkedClassificaKey: 'subentrato united',
          isLegaTeam: true,
          isSubentrato: true,
          source: 'official',
        },
        {
          id: 'c6',
          clubId: 'club-006',
          numeroProgressivo: 6,
          nome: 'Serie Mismatch FC',
          nomeClub: 'Serie Mismatch FC',
          serie: 'Serie A',
          serieKey: 'serie_a',
          linkedClassificaKey: 'serie mismatch fc',
          isLegaTeam: true,
          isSubentrato: false,
          source: 'official',
        },
      ],
    },
    'classifiche_serie/serie_a': {
      serie: 'Serie A',
      updatedAt: '2026-11-20T18:00:00.000Z',
      rows: [
        {
          pos: 1,
          posDisplay: '1',
          squadra: 'Real Test FC',
          squadraNorm: 'realtestfc',
          g: 12,
          v: 9,
          n: 2,
          p: 1,
          gf: 28,
          gs: 10,
          dr: 18,
          pt: 29,
          ptTotali: 890.5,
          serieKey: 'serie_a',
          serie: 'Serie A',
          presidente: 'NON DEVE APPARIRE',
        },
        {
          pos: 2,
          squadra: 'Bloccata City',
          squadraNorm: 'bloccata city',
          g: 12,
          v: 6,
          n: 3,
          p: 3,
          gf: 18,
          gs: 14,
          dr: 4,
          pt: 21,
          ptTotali: 810.0,
          serieKey: 'serie_a',
          serie: 'Serie A',
        },
        {
          pos: 3,
          squadra: 'Subentrato United',
          squadraNorm: 'subentrato united',
          g: 12,
          v: 5,
          n: 2,
          p: 5,
          gf: 15,
          gs: 16,
          dr: -1,
          pt: 17,
          ptTotali: 780.0,
          serieKey: 'serie_a',
          serie: 'Serie A',
        },
      ],
    },
    'classifiche_serie/serie_b': {
      serie: 'Serie B',
      updatedAt: '2026-11-20T18:00:00.000Z',
      rows: [
        {
          pos: 4,
          squadra: 'Libera B FC',
          squadraNorm: 'libera b fc',
          g: 12,
          v: 7,
          n: 1,
          p: 4,
          gf: 20,
          gs: 15,
          dr: 5,
          pt: 22,
          ptTotali: 815.5,
          serieKey: 'serie_b',
          serie: 'Serie B',
        },
        {
          pos: 8,
          squadra: 'Serie Mismatch FC',
          squadraNorm: 'serie mismatch fc',
          g: 12,
          v: 4,
          n: 4,
          p: 4,
          gf: 12,
          gs: 12,
          dr: 0,
          pt: 16,
          ptTotali: 760.0,
          serieKey: 'serie_b',
          serie: 'Serie B',
        },
        {
          pos: 10,
          squadra: 'Solo Classifica FC',
          squadraNorm: 'solo classifica fc',
          g: 12,
          v: 2,
          n: 2,
          p: 8,
          gf: 9,
          gs: 22,
          dr: -13,
          pt: 8,
          ptTotali: 700.0,
          serieKey: 'serie_b',
          serie: 'Serie B',
        },
      ],
    },
    'superlega_top10/giornata_12': {
      totalResultsImported: 50,
      updatedAt: '2026-11-20T21:00:00.000Z',
      top10: [
        {
          pos: 1,
          fantasquadra: 'Real Test FC',
          punteggio: 84.5,
          gol: 4,
          serie: 'Serie A',
          presidente: 'PII TOP10 DA ESCLUDERE',
        },
      ],
      allResults: [
        {
          fantasquadra: 'Real Test FC',
          punteggio: 84.5,
          gol: 4,
          serie: 'Serie A',
          presidente: 'PII ALLRESULTS DA ESCLUDERE',
          email: 'secret@example.com',
          cellulare: '+393401112233',
        },
      ],
      matches: [
        {
          homeTeam: 'Real Test FC',
          awayTeam: 'Hidden FC',
          homeGoals: 3,
          awayGoals: 1,
          homeScore: 84.5,
          awayScore: 68.0,
          serie: 'Serie A',
          presidente: 'PII MATCH DA ESCLUDERE',
        },
      ],
    },
    'superlega_top10/main_data': {
      updatedAt: '2026-11-20T21:30:00.000Z',
      data: [
        {
          giornata: 1,
          totalResultsImported: 50,
          updatedAt: '2026-09-15T20:00:00.000Z',
          top10: [
            {
              pos: 1,
              fantasquadra: 'Real Test FC',
              punteggio: 80.5,
              gol: 3,
              serie: 'Serie A',
              presidente: 'PII NESTED TOP10 DA ESCLUDERE',
            },
          ],
          allResults: [
            {
              fantasquadra: 'Real Test FC',
              punteggio: 80.5,
              gol: 3,
              serie: 'Serie A',
              presidente: 'PII NESTED ALLRESULTS DA ESCLUDERE',
            },
            {
              fantasquadra: 'Libera B FC',
              punteggio: 77.0,
              gol: 2,
              serie: 'Serie B',
              presidente: 'PII B DA ESCLUDERE',
            },
          ],
          matches: [
            {
              homeTeam: 'Real Test FC',
              awayTeam: 'Bloccata City',
              homeGoals: 3,
              awayGoals: 1,
              homeScore: 80.5,
              awayScore: 69.0,
              serie: 'Serie A',
              giornata: 1,
              presidente: 'PII NESTED MATCH DA ESCLUDERE',
            },
          ],
        },
        {
          giornata: 2,
          totalResultsImported: 50,
          updatedAt: '2026-09-22T20:00:00.000Z',
          top10: [
            {
              pos: 1,
              fantasquadra: 'Real Test FC',
              punteggio: 85.0,
              gol: 4,
              serie: 'Serie A',
              presidente: 'PII NESTED TOP10 G2',
            },
          ],
          allResults: [
            {
              fantasquadra: 'Real Test FC',
              punteggio: 85.0,
              gol: 4,
              serie: 'Serie A',
            },
            {
              fantasquadra: 'Libera B FC',
              punteggio: 74.0,
              gol: 2,
              serie: 'Serie B',
            },
          ],
          matches: [],
        },
      ],
    },
    'comunicati_db/main_data': {
      updatedAt: '2026-11-21T10:00:00.000Z',
      data: [
        {
          id: 'com-1',
          titolo: 'Comunicato Ufficiale n. 12',
          testo: 'Regolare svolgimento della giornata 12.',
          adminEmail: 'admin.privato@example.com',
        },
      ],
    },
  };

  if (!options?.omitZonaVarState) {
    docs['zonavar_public_state/current'] = {
      hiddenClubs: ['Hidden FC'],
      blockedKeys: ['club-004'],
      updatedAt: '2026-11-21T09:00:00.000Z',
    };
  }

  const reader: OfficialDocReader = async (docPath: string) => {
    readCounts[docPath] = (readCounts[docPath] || 0) + 1;
    const found = docs[docPath];
    if (!found) {
      return { path: docPath, exists: false, data: null };
    }
    return { path: docPath, exists: true, data: found };
  };

  return { reader, readCounts };
}

async function withTestServer(
  fn: (
    baseUrl: string,
    readCounts: Record<string, number>,
    portalStore: MockPortalStore
  ) => Promise<void>,
  options?: { omitZonaVarState?: boolean }
) {
  const { reader, readCounts } = createMockReader(options);
  const { adapter, store } = createMockPortalAdapter();
  const cache = new ReadOnlyMemoryCache();
  const service = new OfficialFicupService(reader, cache, adapter);
  const app = createOfficialApiApp(service);

  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await fn(baseUrl, readCounts, store);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve()))
    );
  }
}

function buildCandidaturePayload(team: {
  id: string;
  clubId: string;
  normalizedKey: string;
  serieKey: string;
  nome: string;
}, suffix = '1') {
  return {
    nome: `Marco${suffix}`,
    cognome: 'Verdi',
    emailFantaleghe: `marco.${suffix}@example.it`,
    cellulare: '+39 347 892 4156',
    note: 'Pronto al subentro immediato',
    consensoPrivacy: true,
    versioneInformativa: '2026.1',
    regolamentoAccettato: true,
    regolamentoVersione: '2026.1',
    regolamentoDocId: 'regolamento_attivo',
    regoleChatAccettate: true,
    versioneRegoleChat: '2026.1',
    selectedTeam: team,
  };
}

test('Whitelist: consents valid official paths and blocks all forbidden collections', () => {
  assert.equal(assertAllowedOfficialDocPath('club_directory/public_list'), 'club_directory/public_list');
  assert.equal(assertAllowedOfficialDocPath('classifiche_serie/serie_a'), 'classifiche_serie/serie_a');
  assert.equal(assertAllowedOfficialDocPath('superlega_top10/giornata_1'), 'superlega_top10/giornata_1');
  assert.equal(assertAllowedOfficialDocPath('superlega_top10/giornata_38'), 'superlega_top10/giornata_38');
  assert.equal(assertAllowedOfficialDocPath('superlega_top10/main_data'), 'superlega_top10/main_data');
  assert.equal(assertAllowedOfficialDocPath('zonavar_public_state/current'), 'zonavar_public_state/current');
  assert.equal(assertAllowedOfficialDocPath('comunicati_db/main_data'), 'comunicati_db/main_data');
  assert.equal(assertAllowedOfficialDocPath('comunicati_db/archive_3'), 'comunicati_db/archive_3');

  for (const forbidden of FORBIDDEN_COLLECTIONS) {
    assert.throws(
      () => assertAllowedOfficialDocPath(`${forbidden}/any_doc`),
      WhitelistViolationError
    );
  }

  assert.throws(() => assertAllowedOfficialDocPath('superlega_top10/giornata_39'), WhitelistViolationError);
  assert.throws(() => assertAllowedOfficialDocPath('superlega_top10/giornata_0'), WhitelistViolationError);
  assert.throws(() => assertAllowedOfficialDocPath('classifiche_serie/serie_z'), WhitelistViolationError);
  assert.throws(() => assertAllowedOfficialDocPath('candidature/abc'), WhitelistViolationError);
});

test('CORS: allows ficup.web.app and blocks arbitrary origins without wildcard', () => {
  assert.equal(isOriginAllowed('https://ficup.web.app'), true);
  assert.equal(isOriginAllowed('https://candidature-ficup.web.app'), true);
  assert.equal(isOriginAllowed('https://ficup26.github.io'), true);
  assert.equal(isOriginAllowed('https://evil-domain.example.com'), false);
});

test('Endpoints: strip presidente & PII fields and enforce GET-only + validation', async () => {
  await withTestServer(async (baseUrl, readCounts) => {
    // 1. Health
    const healthRes = await fetch(`${baseUrl}/api/official/health`);
    assert.equal(healthRes.status, 200);
    const healthBody = (await healthRes.json()) as { readOnly: boolean; sourceProjectId: string };
    assert.equal(healthBody.readOnly, true);
    assert.equal(healthBody.sourceProjectId, 'ficup-c9186');

    // 2. Clubs — no PII leaked
    const clubsRes = await fetch(`${baseUrl}/clubs`, {
      headers: { Origin: 'https://ficup.web.app' },
    });
    assert.equal(clubsRes.status, 200);
    assert.equal(clubsRes.headers.get('access-control-allow-origin'), 'https://ficup.web.app');
    const clubsText = await clubsRes.text();
    assert.equal(clubsText.includes('presidente'), false);
    assert.equal(clubsText.includes('mario.rossi@privato.it'), false);
    assert.equal(clubsText.includes('+393331234567'), false);

    // 3. Matchday 12 — strict field sanitization on allResults, top10, matches
    const mdRes = await fetch(`${baseUrl}/matchdays/12`);
    assert.equal(mdRes.status, 200);
    const mdBody = (await mdRes.json()) as {
      document: {
        allResults: Array<Record<string, unknown>>;
        top10: Array<Record<string, unknown>>;
        matches: Array<Record<string, unknown>>;
      };
    };
    assert.deepEqual(Object.keys(mdBody.document.allResults[0]).sort(), [
      'fantasquadra',
      'gol',
      'punteggio',
      'serie',
    ]);
    const mdText = JSON.stringify(mdBody);
    assert.equal(mdText.includes('presidente'), false);
    assert.equal(mdText.includes('secret@example.com'), false);

    // 4. Concurrent caching deduplication
    const beforeCount = readCounts['classifiche_serie/serie_a'] ?? 0;
    const [r1, r2, r3] = await Promise.all([
      fetch(`${baseUrl}/standings/serie_a`),
      fetch(`${baseUrl}/standings/serie_a`),
      fetch(`${baseUrl}/standings/serie_a`),
    ]);
    assert.equal(r1.status, 200);
    assert.equal(r2.status, 200);
    assert.equal(r3.status, 200);
    assert.equal(readCounts['classifiche_serie/serie_a'] - beforeCount, 1);

    // 5. Missing series doc handled cleanly (exists: false, HTTP 200)
    const missingRes = await fetch(`${baseUrl}/standings/lega_pro_a`);
    assert.equal(missingRes.status, 200);
    const missingBody = (await missingRes.json()) as { standing: { exists: boolean; rows: unknown[] } };
    assert.equal(missingBody.standing.exists, false);
    assert.deepEqual(missingBody.standing.rows, []);

    // 6. Zona VAR integrated response classifies all 5 categories cleanly
    const zvRes = await fetch(`${baseUrl}/zonavar`);
    assert.equal(zvRes.status, 200);
    const zvBody = (await zvRes.json()) as {
      clubsSummary: {
        totalClubs: number;
        visibleClubs: number;
        hiddenClubsCount: number;
        blockedClubsCount: number;
        freeClubsCount: number;
        assignedClubsCount: number;
        unverifiedClubsCount: number;
        freeBySerie: Record<string, number>;
      };
      clubs: Array<{
        nome: string;
        availabilityStatus: string;
        isSelectable: boolean;
      }>;
    };
    assert.equal(zvBody.clubsSummary.totalClubs, 7); // 6 directory clubs + 1 orphan standing row
    assert.equal(zvBody.clubsSummary.freeClubsCount, 2); // Real Test FC (Serie A) + Libera B FC (Serie B)
    assert.equal(zvBody.clubsSummary.hiddenClubsCount, 1); // Hidden FC
    assert.equal(zvBody.clubsSummary.blockedClubsCount, 1); // Bloccata City
    assert.equal(zvBody.clubsSummary.assignedClubsCount, 0);
    assert.equal(zvBody.clubsSummary.unverifiedClubsCount, 3); // Subentrato United + Serie Mismatch FC + Solo Classifica FC
    assert.equal(zvBody.clubsSummary.freeBySerie.serie_a, 1);
    assert.equal(zvBody.clubsSummary.freeBySerie.serie_b, 1);

    // 7. Comunicati sanitizes adminEmail
    const comRes = await fetch(`${baseUrl}/comunicati`);
    assert.equal(comRes.status, 200);
    const comText = await comRes.text();
    assert.equal(comText.includes('admin.privato@example.com'), false);

    // 8. Validation rejections
    const badSerie = await fetch(`${baseUrl}/standings/iscritti_db`);
    assert.equal(badSerie.status, 400);
    const badGiornata = await fetch(`${baseUrl}/matchdays/99`);
    assert.equal(badGiornata.status, 400);
    const badArchive = await fetch(`${baseUrl}/comunicati?archive=../../secret`);
    assert.equal(badArchive.status, 400);

    // 9. Method lock across ALL official endpoints (POST/PUT/PATCH/DELETE rejected with 405)
    for (const path of ['/clubs', '/standings', '/standings/serie_a', '/zonavar', '/available-teams', '/comunicati']) {
      for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
        const res = await fetch(`${baseUrl}${path}`, { method, body: method === 'DELETE' ? undefined : '{}' });
        assert.equal(res.status, 405, `Expected 405 for ${method} ${path}, got ${res.status}`);
      }
    }

    // Also /candidature rejects GET/PUT/PATCH/DELETE with 405
    for (const method of ['GET', 'PUT', 'PATCH', 'DELETE']) {
      const res = await fetch(`${baseUrl}/candidature`, { method });
      assert.equal(res.status, 405, `Expected 405 for ${method} /candidature, got ${res.status}`);
    }

    // 10. Disallowed CORS origin rejected with 403
    const badCors = await fetch(`${baseUrl}/clubs`, {
      headers: { Origin: 'https://untrusted-site.example' },
    });
    assert.equal(badCors.status, 403);
    assert.equal(badCors.headers.get('access-control-allow-origin'), null);

    // 11. Staff endpoint without Bearer token returns 401
    const unauthStaff = await fetch(`${baseUrl}/staff/zonavar`);
    assert.equal(unauthStaff.status, 401);
  });
});

test('Zona VAR & Candidature: /available-teams filters strictly LIBERA and prevents double assignment atomically', async () => {
  await withTestServer(async (baseUrl, _readCounts, store) => {
    // 1. /available-teams exposes strictly the 2 LIBERA clubs with zero PII
    const availRes = await fetch(`${baseUrl}/available-teams`);
    assert.equal(availRes.status, 200);
    const availText = await availRes.text();
    assert.equal(availText.includes('presidente'), false);
    const availBody = JSON.parse(availText) as {
      totalFreeTeams: number;
      bySerie: Record<string, number>;
      teams: Array<{
        id: string;
        clubId: string;
        normalizedKey: string;
        nome: string;
        serieKey: string;
        availabilityStatus: string;
      }>;
    };

    assert.equal(availBody.totalFreeTeams, 2);
    assert.equal(availBody.bySerie.serie_a, 1);
    assert.equal(availBody.bySerie.serie_b, 1);
    const teamNames = availBody.teams.map((t) => t.nome).sort();
    assert.deepEqual(teamNames, ['Libera B FC', 'Real Test FC']);

    const freeRealTest = availBody.teams.find((t) => t.nome === 'Real Test FC')!;
    const freeLiberaB = availBody.teams.find((t) => t.nome === 'Libera B FC')!;

    // 2. Submitting a blocked / hidden / unverified team is rejected with 409 Conflict
    const blockedAttempt = await fetch(`${baseUrl}/api/official/candidature`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        buildCandidaturePayload({
          id: 'c4',
          clubId: 'club-004',
          normalizedKey: 'bloccata city',
          serieKey: 'serie_a',
          nome: 'Bloccata City',
        })
      ),
    });
    assert.equal(blockedAttempt.status, 409);

    const hiddenAttempt = await fetch(`${baseUrl}/candidature`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        buildCandidaturePayload({
          id: 'c2',
          clubId: 'club-002',
          normalizedKey: 'hidden fc',
          serieKey: 'serie_b',
          nome: 'Hidden FC',
        })
      ),
    });
    assert.equal(hiddenAttempt.status, 409);

    const mismatchAttempt = await fetch(`${baseUrl}/candidature`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        buildCandidaturePayload({
          id: 'c6',
          clubId: 'club-006',
          normalizedKey: 'serie mismatch fc',
          serieKey: 'serie_a',
          nome: 'Serie Mismatch FC',
        })
      ),
    });
    assert.equal(mismatchAttempt.status, 409);
    assert.equal(store.candidature.length, 0);

    // 3. Concurrent submission race for the SAME free team (Real Test FC) -> 1 succeeds (201), 1 fails (409)
    const [race1, race2] = await Promise.all([
      fetch(`${baseUrl}/candidature`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildCandidaturePayload(freeRealTest, 'A')),
      }),
      fetch(`${baseUrl}/candidature`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildCandidaturePayload(freeRealTest, 'B')),
      }),
    ]);

    const statuses = [race1.status, race2.status].sort((a, b) => a - b);
    assert.deepEqual(statuses, [201, 409]);
    assert.equal(store.candidature.length, 1);

    // 4. Subsequent GET /available-teams immediately excludes Real Test FC
    const afterRes = await fetch(`${baseUrl}/available-teams`);
    assert.equal(afterRes.status, 200);
    const afterBody = (await afterRes.json()) as {
      totalFreeTeams: number;
      teams: Array<{ nome: string }>;
    };
    assert.equal(afterBody.totalFreeTeams, 1);
    assert.deepEqual(afterBody.teams.map((t) => t.nome), ['Libera B FC']);

    // 5. Admin Zona VAR now reports Real Test FC as ASSEGNATA
    const zvAfter = await fetch(`${baseUrl}/zonavar`);
    const zvAfterBody = (await zvAfter.json()) as {
      clubsSummary: { freeClubsCount: number; assignedClubsCount: number };
      clubs: Array<{ nome: string; availabilityStatus: string }>;
    };
    assert.equal(zvAfterBody.clubsSummary.freeClubsCount, 1);
    assert.equal(zvAfterBody.clubsSummary.assignedClubsCount, 1);
    const assignedClub = zvAfterBody.clubs.find((c) => c.nome === 'Real Test FC');
    assert.equal(assignedClub?.availabilityStatus, 'ASSEGNATA');

    // 6. Second candidate choosing Libera B FC succeeds cleanly
    const secondTeamOk = await fetch(`${baseUrl}/candidature`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildCandidaturePayload(freeLiberaB, 'C')),
    });
    assert.equal(secondTeamOk.status, 201);
    assert.equal(store.candidature.length, 2);
  });
});

test('Fail-closed safety: missing zonavar_public_state/current yields zero LIBERA teams', async () => {
  await withTestServer(
    async (baseUrl) => {
      const availRes = await fetch(`${baseUrl}/available-teams`);
      assert.equal(availRes.status, 200);
      const availBody = (await availRes.json()) as { totalFreeTeams: number; teams: unknown[] };
      assert.equal(availBody.totalFreeTeams, 0);
      assert.deepEqual(availBody.teams, []);
    },
    { omitZonaVarState: true }
  );
});

test('Superlega main_data: parses nested data[] giornate, computes cumulativeTop10 and strips nested PII', async () => {
  await withTestServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/superlega`);
    assert.equal(res.status, 200);
    const rawText = await res.text();
    assert.equal(rawText.includes('presidente'), false);
    assert.equal(rawText.includes('PII NESTED'), false);

    const body = JSON.parse(rawText) as {
      ok: boolean;
      mainData: {
        exists: boolean;
        availableGiornate: number[];
        giornate: Array<{ giornata: number; top10: unknown[]; allResults: unknown[]; matches: unknown[] }>;
        cumulativeTop10: Array<{
          pos: number;
          fantasquadra: string;
          serie: string;
          punteggioTotale: number;
          golTotali: number;
          giornateGiocate: number;
          mediaPunteggio: number;
          migliorPunteggio: number;
          presenzeTop10: number;
        }>;
      };
    };

    assert.equal(body.ok, true);
    assert.equal(body.mainData.exists, true);
    assert.deepEqual(body.mainData.availableGiornate, [1, 2]);
    assert.equal(body.mainData.giornate.length, 2);
    assert.equal(body.mainData.cumulativeTop10.length, 2);
    assert.equal(body.mainData.cumulativeTop10[0].pos, 1);
    assert.equal(body.mainData.cumulativeTop10[0].fantasquadra, 'Real Test FC');
    assert.equal(body.mainData.cumulativeTop10[0].punteggioTotale, 165.5);
    assert.equal(body.mainData.cumulativeTop10[0].golTotali, 7);
    assert.equal(body.mainData.cumulativeTop10[0].giornateGiocate, 2);
    assert.equal(body.mainData.cumulativeTop10[0].presenzeTop10, 2);
    assert.equal(body.mainData.cumulativeTop10[1].fantasquadra, 'Libera B FC');
    assert.equal(body.mainData.cumulativeTop10[1].punteggioTotale, 151);
  });
});


