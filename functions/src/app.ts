import express, { type NextFunction, type Request, type Response } from 'express';
import { isOriginAllowed, OFFICIAL_DATABASE_ID, OFFICIAL_PROJECT_ID, PORTAL_PROJECT_ID } from './config';
import { AuthVerificationError, verifyPortalAdminFromHeader } from './firebaseAdmin';
import { defaultOfficialService, OfficialFicupService } from './officialService';
import { InvalidInputError, TeamConflictError, WhitelistViolationError } from './whitelist';

function resolveErrorStatus(err: unknown): {
  statusCode: number;
  code: string;
  message: string;
} {
  if (err instanceof InvalidInputError) {
    return { statusCode: 400, code: 'INVALID_INPUT', message: err.message };
  }
  if (err instanceof TeamConflictError) {
    return { statusCode: 409, code: err.code, message: err.message };
  }
  if (err instanceof WhitelistViolationError) {
    return { statusCode: 403, code: 'WHITELIST_VIOLATION', message: err.message };
  }
  if (err instanceof AuthVerificationError) {
    return { statusCode: err.statusCode, code: err.code, message: err.message };
  }

  const anyErr = err as { statusCode?: number; type?: string; code?: string | number; message?: string };
  if (anyErr?.type === 'entity.parse.failed' || anyErr?.statusCode === 400) {
    return {
      statusCode: 400,
      code: 'INVALID_JSON',
      message: 'Formato JSON della richiesta non valido.',
    };
  }
  if (anyErr?.statusCode === 504 || anyErr?.code === 'FIRESTORE_TIMEOUT') {
    return {
      statusCode: 504,
      code: 'UPSTREAM_TIMEOUT',
      message: 'Timeout durante la lettura dal database ufficiale ficup-c9186.',
    };
  }
  if (anyErr?.code === 7 || anyErr?.code === 'permission-denied' || anyErr?.code === 'PERMISSION_DENIED') {
    return {
      statusCode: 503,
      code: 'IAM_READ_PERMISSION_REQUIRED',
      message:
        'Collegamento predisposto ma in attesa di autorizzazione IAM (roles/datastore.viewer) sul progetto ufficiale ficup-c9186.',
    };
  }

  return {
    statusCode: 500,
    code: 'INTERNAL_ERROR',
    message: 'Errore tecnico temporaneo durante il recupero dei dati ufficiali.',
  };
}

function logTechnicalError(routeLabel: string, err: unknown): void {
  const anyErr = err as { code?: unknown; name?: unknown; message?: unknown };
  // Never log PII, tokens, or request bodies
  console.error(
    JSON.stringify({
      severity: 'ERROR',
      component: 'officialFicupApi',
      route: routeLabel,
      errorName: typeof anyErr?.name === 'string' ? anyErr.name : 'Error',
      errorCode: anyErr?.code ? String(anyErr.code) : 'UNKNOWN',
      message: typeof anyErr?.message === 'string' ? anyErr.message.slice(0, 240) : 'Unknown error',
    })
  );
}

function isCandidatureWriteRoute(pathname: string): boolean {
  const clean = pathname.replace(/\/+$/, '') || '/';
  return clean === '/candidature' || clean === '/api/official/candidature';
}

export function createOfficialApiApp(service: OfficialFicupService = defaultOfficialService) {
  const app = express();
  app.disable('x-powered-by');

  // Strict security headers, CORS allowlist (never wildcard '*'), and strict HTTP verb locks
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Vary', 'Origin');

    const origin = req.headers.origin;
    if (origin) {
      if (!isOriginAllowed(origin)) {
        res.status(403).json({
          ok: false,
          code: 'CORS_ORIGIN_FORBIDDEN',
          error: 'Origine cross-origin non autorizzata.',
        });
        return;
      }
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.setHeader('Access-Control-Max-Age', '600');
    }

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    if (isCandidatureWriteRoute(req.path)) {
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST, OPTIONS');
        res.status(405).json({
          ok: false,
          code: 'METHOD_NOT_ALLOWED',
          error: 'Consentito esclusivamente il metodo POST per inviare una candidatura su candidature-ficup.',
        });
        return;
      }
      next();
      return;
    }

    // Architectural read-only lock for ALL official read endpoints: reject POST, PUT, PATCH, DELETE
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET, OPTIONS');
      res.status(405).json({
        ok: false,
        code: 'METHOD_NOT_ALLOWED',
        error: 'Endpoint ufficiali strettamente in sola lettura: consentito esclusivamente il metodo GET.',
      });
      return;
    }

    next();
  });

  const jsonBodyParser = express.json({ limit: '32kb' });
  const router = express.Router();

  router.get('/health', (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      ok: true,
      service: 'ficup-official-readonly-bridge',
      portalProjectId: PORTAL_PROJECT_ID,
      sourceProjectId: OFFICIAL_PROJECT_ID,
      sourceDatabaseId: OFFICIAL_DATABASE_ID,
      readOnly: true,
      timestamp: new Date().toISOString(),
    });
  });

  // 1. Directory delle squadre (club_directory/public_list)
  router.get('/clubs', async (_req: Request, res: Response) => {
    try {
      const data = await service.getClubDirectory();
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
      res.status(200).json({ ok: true, ...data });
    } catch (err) {
      logTechnicalError('GET /clubs', err);
      const resolved = resolveErrorStatus(err);
      res.status(resolved.statusCode).json({ ok: false, code: resolved.code, error: resolved.message });
    }
  });

  // 2. Tutte le classifiche ufficiali (classifiche_serie/*)
  router.get('/standings', async (_req: Request, res: Response) => {
    try {
      const data = await service.getAllStandings();
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
      res.status(200).json({ ok: true, ...data });
    } catch (err) {
      logTechnicalError('GET /standings', err);
      const resolved = resolveErrorStatus(err);
      res.status(resolved.statusCode).json({ ok: false, code: resolved.code, error: resolved.message });
    }
  });

  // 3. Classifica di una singola serie (classifiche_serie/{serieKey})
  router.get('/standings/:serieKey', async (req: Request, res: Response) => {
    try {
      const data = await service.getSerieStanding(req.params.serieKey);
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
      res.status(200).json({ ok: true, ...data });
    } catch (err) {
      logTechnicalError('GET /standings/:serieKey', err);
      const resolved = resolveErrorStatus(err);
      res.status(resolved.statusCode).json({ ok: false, code: resolved.code, error: resolved.message });
    }
  });

  // 4. Risultati di una singola giornata (superlega_top10/giornata_1..38)
  router.get('/matchdays/:giornata', async (req: Request, res: Response) => {
    try {
      const data = await service.getMatchdayResults(req.params.giornata);
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
      res.status(200).json({ ok: true, ...data });
    } catch (err) {
      logTechnicalError('GET /matchdays/:giornata', err);
      const resolved = resolveErrorStatus(err);
      res.status(resolved.statusCode).json({ ok: false, code: resolved.code, error: resolved.message });
    }
  });

  // 5. Dati aggregati della Superlega (superlega_top10/main_data)
  router.get('/superlega', async (_req: Request, res: Response) => {
    try {
      const data = await service.getSuperlegaAggregate();
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
      res.status(200).json({ ok: true, ...data });
    } catch (err) {
      logTechnicalError('GET /superlega', err);
      const resolved = resolveErrorStatus(err);
      res.status(resolved.statusCode).json({ ok: false, code: resolved.code, error: resolved.message });
    }
  });

  // 6. Dati pubblici integrati Zona VAR (zonavar_public_state/current + directory + classifiche + superlega)
  router.get('/zonavar', async (req: Request, res: Response) => {
    try {
      const bypassCache = req.query.refresh === '1';
      const data = await service.getPublicZonaVar(bypassCache);
      res.setHeader('Cache-Control', bypassCache ? 'no-store' : 'public, max-age=30, stale-while-revalidate=60');
      res.status(200).json({ ok: true, ...data });
    } catch (err) {
      logTechnicalError('GET /zonavar', err);
      const resolved = resolveErrorStatus(err);
      res.status(resolved.statusCode).json({ ok: false, code: resolved.code, error: resolved.message });
    }
  });

  // 7. Squadre ufficiali effettivamente LIBERE e selezionabili per i candidati
  router.get('/available-teams', async (req: Request, res: Response) => {
    try {
      const bypassCache = req.query.refresh === '1';
      const data = await service.getAvailableTeams(bypassCache);
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({ ok: true, ...data });
    } catch (err) {
      logTechnicalError('GET /available-teams', err);
      const resolved = resolveErrorStatus(err);
      res.setHeader('Cache-Control', 'no-store');
      res.status(resolved.statusCode).json({ ok: false, code: resolved.code, error: resolved.message });
    }
  });

  // 8. Invio atomico candidatura + prenotazione squadra esclusivamente su candidature-ficup
  router.post(
    '/candidature',
    (req: Request, res: Response, next: NextFunction) => {
      jsonBodyParser(req, res, (err) => {
        if (err) {
          const resolved = resolveErrorStatus(err);
          res.status(resolved.statusCode).json({
            ok: false,
            code: resolved.code,
            error: resolved.message,
          });
          return;
        }
        next();
      });
    },
    async (req: Request, res: Response) => {
      try {
        const result = await service.submitCandidaturaWithTeam(req.body);
        res.setHeader('Cache-Control', 'no-store');
        res.status(201).json({ ok: true, ...result });
      } catch (err) {
        logTechnicalError('POST /candidature', err);
        const resolved = resolveErrorStatus(err);
        res.setHeader('Cache-Control', 'no-store');
        res.status(resolved.statusCode).json({ ok: false, code: resolved.code, error: resolved.message });
      }
    }
  );

  // 9. Comunicati pubblici (comunicati_db/main_data o archive_{N})
  router.get('/comunicati', async (req: Request, res: Response) => {
    try {
      const data = await service.getComunicati(req.query.archive);
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
      res.status(200).json({ ok: true, ...data });
    } catch (err) {
      logTechnicalError('GET /comunicati', err);
      const resolved = resolveErrorStatus(err);
      res.status(resolved.statusCode).json({ ok: false, code: resolved.code, error: resolved.message });
    }
  });

  // 10. Endpoint autenticato Staff (Firebase Auth & amministratori su candidature-ficup)
  router.get('/staff/zonavar', async (req: Request, res: Response) => {
    try {
      const adminUser = await verifyPortalAdminFromHeader(req.headers.authorization);
      const bypassCache = req.query.refresh === '1';
      const data = await service.getPublicZonaVar(bypassCache);
      res.setHeader('Cache-Control', 'private, no-store');
      res.status(200).json({
        ok: true,
        authorizedAdmin: {
          ruolo: adminUser.ruolo,
          nome: adminUser.nome,
        },
        ...data,
      });
    } catch (err) {
      logTechnicalError('GET /staff/zonavar', err);
      const resolved = resolveErrorStatus(err);
      res.setHeader('Cache-Control', 'private, no-store');
      res.status(resolved.statusCode).json({ ok: false, code: resolved.code, error: resolved.message });
    }
  });

  // Mount at both root (direct Cloud Functions URL) and /api/official (Firebase Hosting rewrite)
  app.use('/api/official', router);
  app.use('/', router);

  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      ok: false,
      code: 'ENDPOINT_NOT_FOUND',
      error: 'Endpoint ufficiale non trovato.',
    });
  });

  return app;
}

