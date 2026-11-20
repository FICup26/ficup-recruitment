/**
 * FICUP 26/27 - Backend (Google Apps Script)
 * File: Code.gs
 *
 * Entrypoint Web App (doGet / doPost) per:
 * - Waiting Room sicura (verifica codice + email, sblocco WhatsApp ufficiale solo se COMPLETATO)
 * - Notifiche email protette e idempotenti:
 *     1) Percorso Admin: verificato crittograficamente da Firestore tramite Firebase ID Token
 *     2) Percorso Wizard (nuova candidatura): prova di possesso (id + codice + email) + solo stato NUOVO + finestra recente + rate limit
 * - Trigger incrementale periodico (syncCandidatureTrigger ogni 10 minuti)
 */

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function sha256Short_(input) {
  var digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(input || ''),
    Utilities.Charset.UTF_8
  );
  return Utilities.base64EncodeWebSafe(digest).replace(/=+$/, '').slice(0, 32);
}

function getCacheCounter_(key) {
  var raw = CacheService.getScriptCache().get(key);
  var num = raw ? Number(raw) : 0;
  return isNaN(num) ? 0 : num;
}

function incrementCacheCounter_(key, ttlSeconds) {
  var cache = CacheService.getScriptCache();
  var next = getCacheCounter_(key) + 1;
  cache.put(key, String(next), ttlSeconds);
  return next;
}

function sanitizeHttpsUrl_(url) {
  var str = typeof url === 'string' ? url.trim() : '';
  if (!str) return '';
  return /^https:\/\/[^\s]+$/i.test(str) ? str : '';
}

function getOfficialWhatsappLinkForCandidatura_(candidaturaId) {
  var waAuth = candidaturaId ? fsGetDocument_('whatsapp_autorizzazioni', candidaturaId) : null;
  if (waAuth) {
    var authState = String(waAuth.statoAutorizzazione || '');
    if (authState === 'REVOCATO' || authState === 'NON_AUTORIZZATO') {
      return null;
    }
    var assigned = sanitizeHttpsUrl_(waAuth.linkAssegnato);
    if (assigned) {
      return assigned;
    }
  }

  var privateCfg = fsGetDocument_('configurazione', 'private') || {};
  var candidateOfficial =
    (privateCfg.linkWhatsappUfficiale && String(privateCfg.linkWhatsappUfficiale).trim()) ||
    getOfficialWhatsappFallback_() ||
    '';
  return sanitizeHttpsUrl_(candidateOfficial) || null;
}

function parseFirebaseJwtPayload_(token) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 8192) {
    return null;
  }
  var parts = token.split('.');
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    return null;
  }
  try {
    var b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4 !== 0) {
      b64 += '=';
    }
    var bytes = Utilities.base64Decode(b64);
    var jsonStr = Utilities.newBlob(bytes).getDataAsString('UTF-8');
    var payload = JSON.parse(jsonStr);
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    var nowSec = Math.floor(Date.now() / 1000);
    var expectedIss = 'https://securetoken.google.com/' + FICUP_CONFIG.PROJECT_ID;
    if (payload.aud !== FICUP_CONFIG.PROJECT_ID) return null;
    if (payload.iss !== expectedIss) return null;
    if (typeof payload.exp !== 'number' || payload.exp <= nowSec) return null;
    if (typeof payload.sub !== 'string' || !payload.sub) return null;
    if (payload.email_verified !== true) return null;
    if (typeof payload.email !== 'string' || !FICUP_CONFIG.EMAIL_REGEX.test(payload.email)) return null;

    return payload;
  } catch (e) {
    return null;
  }
}

function doGet() {
  return jsonResponse_({
    ok: true,
    service: 'FICUP 26/27 - Backend',
    operationalEmail: FICUP_CONFIG.OPERATIONAL_EMAIL,
    timestamp: new Date().toISOString()
  });
}

function doPost(e) {
  try {
    var rawBody = e && e.postData && e.postData.contents ? String(e.postData.contents) : '';
    if (!rawBody || rawBody.length > 16384) {
      return jsonResponse_({ ok: false, code: 'BAD_REQUEST', error: 'Richiesta non valida.' });
    }

    var body;
    try {
      body = JSON.parse(rawBody);
    } catch (parseErr) {
      return jsonResponse_({ ok: false, code: 'BAD_REQUEST', error: 'Formato JSON non valido.' });
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return jsonResponse_({ ok: false, code: 'BAD_REQUEST', error: 'Payload richiesta non valido.' });
    }

    var action = typeof body.action === 'string' ? body.action.trim() : '';

    if (action === 'getWaitingRoomStatus') {
      return handleWaitingRoomLookup_(body);
    }

    if (action === 'notifyCandidaturaEvent') {
      return handleNotifyCandidaturaEvent_(body);
    }

    return jsonResponse_({ ok: false, code: 'UNSUPPORTED_ACTION', error: 'Azione non supportata.' });
  } catch (err) {
    console.error('Errore doPost:', err);
    return jsonResponse_({
      ok: false,
      code: 'INTERNAL_ERROR',
      error: 'Errore temporaneo del server. Riprova tra qualche istante.'
    });
  }
}

function recordWaitingRoomFailure_(codeKey, emailKey) {
  incrementCacheCounter_(codeKey, FICUP_CONFIG.WAITING_ROOM_WINDOW_SECONDS);
  incrementCacheCounter_(emailKey, FICUP_CONFIG.WAITING_ROOM_WINDOW_SECONDS);
  incrementCacheCounter_('wr_global_fail', 300);
}

function handleWaitingRoomLookup_(body) {
  var code = typeof body.codiceCandidatura === 'string' ? body.codiceCandidatura.trim().toUpperCase() : '';
  var email = typeof body.emailFantaleghe === 'string' ? body.emailFantaleghe.trim().toLowerCase() : '';

  if (!FICUP_CONFIG.CANDIDATURA_CODE_REGEX.test(code) || !FICUP_CONFIG.EMAIL_REGEX.test(email)) {
    return jsonResponse_({
      ok: false,
      code: 'INVALID_INPUT',
      error: 'Inserisci un codice FICUP26 valido e l’indirizzo email utilizzato in candidatura.'
    });
  }

  // Protezione anti brute-force e anti-esaurimento quota letture Spark
  if (
    getCacheCounter_('wr_global_lookup') >= FICUP_CONFIG.WAITING_ROOM_GLOBAL_MAX_LOOKUPS ||
    getCacheCounter_('wr_global_fail') >= FICUP_CONFIG.WAITING_ROOM_GLOBAL_MAX_FAILURES
  ) {
    return jsonResponse_({
      ok: false,
      code: 'RATE_LIMITED',
      error: 'Servizio temporaneamente congestionato. Riprova tra qualche minuto.'
    });
  }

  var codeKey = 'wr_fail_c_' + sha256Short_(code);
  var emailKey = 'wr_fail_e_' + sha256Short_(email);
  if (
    getCacheCounter_(codeKey) >= FICUP_CONFIG.WAITING_ROOM_MAX_FAILED_ATTEMPTS ||
    getCacheCounter_(emailKey) >= FICUP_CONFIG.WAITING_ROOM_MAX_FAILED_PER_EMAIL
  ) {
    return jsonResponse_({
      ok: false,
      code: 'RATE_LIMITED',
      error: 'Troppi tentativi ravvicinati. Attendi qualche minuto prima di riprovare.'
    });
  }

  incrementCacheCounter_('wr_global_lookup', 300);

  var docs = fsRunQuery_({
    from: [{ collectionId: 'candidature' }],
    where: {
      fieldFilter: {
        field: { fieldPath: 'codiceCandidatura' },
        op: 'EQUAL',
        value: { stringValue: code }
      }
    },
    limit: 1
  });

  if (!docs || docs.length === 0) {
    recordWaitingRoomFailure_(codeKey, emailKey);
    return jsonResponse_({
      ok: false,
      code: 'NOT_FOUND',
      error: 'Nessuna candidatura trovata con questa combinazione di codice ed email.'
    });
  }

  var cand = docs[0];
  var storedEmail = String(cand.emailFantaleghe || '').trim().toLowerCase();
  if (storedEmail !== email) {
    recordWaitingRoomFailure_(codeKey, emailKey);
    return jsonResponse_({
      ok: false,
      code: 'NOT_FOUND',
      error: 'Nessuna candidatura trovata con questa combinazione di codice ed email.'
    });
  }

  var cache = CacheService.getScriptCache();
  cache.remove(codeKey);
  cache.remove(emailKey);

  // Recupero aggiornamenti pubblici di stato da storico_operazioni (solo stati e timestamp, MAI note o dati admin)
  var historyDocs = fsRunQuery_({
    from: [{ collectionId: 'storico_operazioni' }],
    where: {
      fieldFilter: {
        field: { fieldPath: 'candidaturaId' },
        op: 'EQUAL',
        value: { stringValue: cand.id }
      }
    },
    limit: 30
  });

  var publicHistory = (historyDocs || [])
    .map(function (h) {
      return {
        statoNuovo: String(h.statoNuovo || ''),
        createdAtIso: h.createdAt || null
      };
    })
    .sort(function (a, b) {
      var ta = a.createdAtIso ? new Date(a.createdAtIso).getTime() : 0;
      var tb = b.createdAtIso ? new Date(b.createdAtIso).getTime() : 0;
      return ta - tb;
    });

  var publicCfg = fsGetDocument_('configurazione', 'public') || {};
  var safeProvisionalLink =
    cand.stato === 'RESPINTO'
      ? ''
      : sanitizeHttpsUrl_(publicCfg.linkWhatsappProvvisorio);

  // Il link WhatsApp ufficiale viene letto e restituito SOLO se lo stato reale è COMPLETATO
  var officialWhatsappLink = null;
  if (cand.stato === 'COMPLETATO') {
    officialWhatsappLink = getOfficialWhatsappLinkForCandidatura_(cand.id);
  }

  return jsonResponse_({
    ok: true,
    data: {
      codiceCandidatura: String(cand.codiceCandidatura || ''),
      nome: String(cand.nome || ''),
      nomeCompleto: ((cand.nome || '') + ' ' + (cand.cognome || '')).trim(),
      nomeSquadra: String(cand.nomeSquadra || ''),
      stato: String(cand.stato || 'NUOVO'),
      createdAtIso: cand.createdAt || null,
      updatedAtIso: cand.updatedAt || null,
      publicHistory: publicHistory,
      linkWhatsappProvvisorio: safeProvisionalLink,
      linkWhatsappUfficiale: officialWhatsappLink
    }
  });
}

function handleNotifyCandidaturaEvent_(body) {
  var candidaturaId = typeof body.candidaturaId === 'string' ? body.candidaturaId.trim() : '';
  if (!FICUP_CONFIG.DOC_ID_REGEX.test(candidaturaId)) {
    return jsonResponse_({
      ok: false,
      code: 'INVALID_INPUT',
      error: 'Identificativo candidatura non valido.'
    });
  }

  var idToken = typeof body.idToken === 'string' ? body.idToken.trim() : '';
  if (idToken) {
    return handleAdminNotify_(candidaturaId, idToken);
  }

  var code = typeof body.codiceCandidatura === 'string' ? body.codiceCandidatura.trim().toUpperCase() : '';
  var email = typeof body.emailFantaleghe === 'string' ? body.emailFantaleghe.trim().toLowerCase() : '';
  if (code && email) {
    return handlePublicWizardNotify_(candidaturaId, code, email);
  }

  return jsonResponse_({
    ok: false,
    code: 'UNAUTHORIZED',
    error: 'Autorizzazione o dati di verifica richiesti per attivare la notifica.'
  });
}

/**
 * Percorso Admin protetto: il Firebase ID Token viene verificato crittograficamente
 * dai server Firestore insieme alle regole isAdmin() (email verificata + amministratori.attivo == true).
 */
function handleAdminNotify_(candidaturaId, idToken) {
  var jwtClaims = parseFirebaseJwtPayload_(idToken);
  if (!jwtClaims) {
    return jsonResponse_({
      ok: false,
      code: 'UNAUTHORIZED',
      error: 'Token amministratore non valido o scaduto.'
    });
  }

  var cache = CacheService.getScriptCache();
  var debounceKey = 'notify_adm_cd_' + sha256Short_(candidaturaId);
  if (cache.get(debounceKey)) {
    return jsonResponse_({ ok: true, status: 'DEBOUNCED' });
  }

  // Verifica reale presso Firestore con il token del chiamante
  var authRead = fsGetDocumentWithUserToken_('candidature', candidaturaId, idToken);
  if (!authRead.authorized) {
    return jsonResponse_({
      ok: false,
      code: 'UNAUTHORIZED',
      error: 'Accesso riservato agli amministratori autorizzati.'
    });
  }

  if (!authRead.doc) {
    return jsonResponse_({
      ok: false,
      code: 'NOT_FOUND',
      error: 'Candidatura non trovata.'
    });
  }

  cache.put(debounceKey, '1', 5);
  var publicCfg = fsGetDocument_('configurazione', 'public') || {};
  var stats = processCandidaturaNotifications_(authRead.doc, publicCfg, { isPublicTrigger: false });

  return jsonResponse_({
    ok: true,
    stats: stats
  });
}

/**
 * Percorso Pubblico Wizard protetto:
 * - Richiede prova di possesso completa (candidaturaId + codiceCandidatura + emailFantaleghe)
 * - Rate limit multipli prima di leggere Firestore
 * - Consente esclusivamente stato NUOVO e solo entro PUBLIC_NOTIFY_MAX_AGE_MINUTES dalla creazione
 * - Applica riserva di quota Gmail giornaliera per proteggere le email staff
 */
function handlePublicWizardNotify_(candidaturaId, code, email) {
  if (!FICUP_CONFIG.CANDIDATURA_CODE_REGEX.test(code) || !FICUP_CONFIG.EMAIL_REGEX.test(email)) {
    return jsonResponse_({
      ok: false,
      code: 'INVALID_INPUT',
      completed: false,
      emailConfirmed: false,
      linkWhatsappUfficiale: null,
      error: 'Parametri di verifica candidatura non validi.'
    });
  }

  var failCodeKey = 'notify_pub_fail_' + sha256Short_(code);
  if (
    getCacheCounter_(failCodeKey) >= FICUP_CONFIG.PUBLIC_NOTIFY_MAX_FAILED_PER_CODE ||
    getCacheCounter_('notify_pub_global') >= FICUP_CONFIG.PUBLIC_NOTIFY_GLOBAL_MAX_PER_WINDOW
  ) {
    return jsonResponse_({
      ok: false,
      code: 'RATE_LIMITED',
      completed: false,
      emailConfirmed: false,
      linkWhatsappUfficiale: null,
      error: 'Limite temporaneo di notifiche raggiunto. Il controllo periodico completerà l’invio automaticamente.'
    });
  }

  var cand = fsGetDocument_('candidature', candidaturaId);
  var storedEmail = cand ? String(cand.emailFantaleghe || '').trim().toLowerCase() : '';
  if (!cand || cand.codiceCandidatura !== code || storedEmail !== email) {
    incrementCacheCounter_(failCodeKey, FICUP_CONFIG.NOTIFY_WINDOW_SECONDS);
    return jsonResponse_({
      ok: false,
      code: 'UNAUTHORIZED',
      completed: false,
      emailConfirmed: false,
      linkWhatsappUfficiale: null,
      error: 'Richiesta di notifica non autorizzata.'
    });
  }

  if (cand.archiviata === true) {
    return jsonResponse_({
      ok: false,
      code: 'FORBIDDEN_STATE',
      completed: false,
      emailConfirmed: false,
      stato: String(cand.stato || 'NUOVO'),
      linkWhatsappUfficiale: null,
      error: 'Candidatura archiviata.'
    });
  }

  // Idempotenza sicura e recupero storico: se già COMPLETATO non reinvia email duplicate,
  // ma verifica/recupera l'eventuale registrazione mancante in storico_operazioni.
  if (cand.stato === 'COMPLETATO') {
    var existingCompletion = autoCompleteCandidaturaIfEmailConfirmed_(candidaturaId);
    if (!existingCompletion.historyRecorded) {
      return jsonResponse_({
        ok: false,
        code: existingCompletion.reason || 'HISTORY_WRITE_FAILED',
        status: existingCompletion.reason || 'HISTORY_WRITE_FAILED',
        completed: false,
        historyRecorded: false,
        emailConfirmed: Boolean(existingCompletion.emailConfirmed),
        stato: 'COMPLETATO',
        linkWhatsappUfficiale: null,
        stats: { processed: 0, sent: 0, skipped: 0, failed: 0 },
        error:
          existingCompletion.error ||
          'Stato COMPLETATO presente ma registrazione obbligatoria nello storico non confermata.'
      });
    }

    if (existingCompletion.manualCompleted) {
      var manualOfficialLink = existingCompletion.emailConfirmed
        ? getOfficialWhatsappLinkForCandidatura_(candidaturaId)
        : null;
      return jsonResponse_({
        ok: true,
        status: 'MANUAL_ADMIN_COMPLETED',
        completed: Boolean(existingCompletion.emailConfirmed),
        historyRecorded: true,
        manualCompleted: true,
        emailConfirmed: Boolean(existingCompletion.emailConfirmed),
        stato: 'COMPLETATO',
        linkWhatsappUfficiale: manualOfficialLink,
        stats: { processed: 0, sent: 0, skipped: 0, failed: 0 }
      });
    }

    var alreadyOfficialLink = existingCompletion.emailConfirmed
      ? getOfficialWhatsappLinkForCandidatura_(candidaturaId)
      : null;
    return jsonResponse_({
      ok: true,
      status: existingCompletion.historyRecovered ? 'COMPLETED' : 'ALREADY_COMPLETED',
      completed: Boolean(existingCompletion.completed && existingCompletion.historyRecorded),
      historyRecorded: true,
      historyRecovered: Boolean(existingCompletion.historyRecovered),
      emailConfirmed: Boolean(existingCompletion.emailConfirmed),
      stato: 'COMPLETATO',
      linkWhatsappUfficiale: alreadyOfficialLink,
      stats: { processed: 0, sent: 0, skipped: 0, failed: 0 }
    });
  }

  if (cand.stato !== 'NUOVO') {
    return jsonResponse_({
      ok: false,
      code: 'FORBIDDEN_STATE',
      completed: false,
      emailConfirmed: false,
      stato: String(cand.stato || ''),
      linkWhatsappUfficiale: null,
      error: 'Questo endpoint pubblico è consentito esclusivamente per nuove candidature.'
    });
  }

  if (cand.createdAt) {
    var ageMinutes = (Date.now() - new Date(cand.createdAt).getTime()) / 60000;
    if (ageMinutes > FICUP_CONFIG.PUBLIC_NOTIFY_MAX_AGE_MINUTES) {
      return jsonResponse_({
        ok: false,
        code: 'DEFERRED_TO_TRIGGER',
        status: 'DEFERRED_TO_TRIGGER',
        completed: false,
        emailConfirmed: false,
        stato: String(cand.stato || 'NUOVO'),
        linkWhatsappUfficiale: null,
        error: 'Finestra di verifica immediata superata; il trigger periodico completerà la pratica.'
      });
    }
  }

  var alreadyDispatched = areNuovoEmailsConfirmedSent_(candidaturaId);
  if (!alreadyDispatched && !checkPerEmailNuovoLimit_(email)) {
    return jsonResponse_({
      ok: false,
      code: 'RATE_LIMITED',
      completed: false,
      emailConfirmed: false,
      stato: String(cand.stato || 'NUOVO'),
      linkWhatsappUfficiale: null,
      error: 'Troppi invii ravvicinati verso questo indirizzo email.'
    });
  }

  incrementCacheCounter_('notify_pub_global', FICUP_CONFIG.NOTIFY_WINDOW_SECONDS);

  var publicCfg = fsGetDocument_('configurazione', 'public') || {};
  var stats = alreadyDispatched
    ? { processed: 0, sent: 0, skipped: 2, failed: 0 }
    : processCandidaturaNotifications_(cand, publicCfg, { isPublicTrigger: true });

  var confirmed = stats.failed === 0 && areNuovoEmailsConfirmedSent_(candidaturaId);
  if (!confirmed) {
    return jsonResponse_({
      ok: true,
      status: 'EMAIL_NOT_CONFIRMED',
      completed: false,
      emailConfirmed: false,
      stato: 'NUOVO',
      linkWhatsappUfficiale: null,
      stats: stats,
      error: 'Invio email non confermato dal server: stato candidatura mantenuto su NUOVO.'
    });
  }

  var completion = autoCompleteCandidaturaIfEmailConfirmed_(candidaturaId);
  if (completion.completed && completion.historyRecorded && completion.stato === 'COMPLETATO') {
    var officialWhatsappLink = getOfficialWhatsappLinkForCandidatura_(candidaturaId);
    return jsonResponse_({
      ok: true,
      status: completion.alreadyCompleted ? 'ALREADY_COMPLETED' : 'COMPLETED',
      completed: true,
      historyRecorded: true,
      emailConfirmed: true,
      stato: 'COMPLETATO',
      linkWhatsappUfficiale: officialWhatsappLink,
      stats: stats
    });
  }

  if (completion.reason === 'HISTORY_WRITE_FAILED') {
    return jsonResponse_({
      ok: false,
      code: 'HISTORY_WRITE_FAILED',
      status: 'HISTORY_WRITE_FAILED',
      completed: false,
      historyRecorded: false,
      emailConfirmed: true,
      stato: 'COMPLETATO',
      linkWhatsappUfficiale: null,
      stats: stats,
      error:
        completion.error ||
        'Stato aggiornato a COMPLETATO ma registrazione obbligatoria nello storico operazioni non riuscita.'
    });
  }

  return jsonResponse_({
    ok: true,
    status: completion.reason || 'NOT_COMPLETED',
    completed: false,
    historyRecorded: Boolean(completion.historyRecorded),
    emailConfirmed: true,
    stato: completion.stato || String(cand.stato || 'NUOVO'),
    linkWhatsappUfficiale: null,
    stats: stats
  });
}

/**
 * Trigger temporale periodico incrementale (ogni 10 minuti).
 * Legge solo le candidature con updatedAt > LAST_SYNC_ISO per rispettare le quote Spark,
 * con limite di sicurezza per singolo ciclo più eventuali retry controllati.
 */
function syncCandidatureTrigger() {
  var props = PropertiesService.getScriptProperties();
  var lastSyncIso = props.getProperty('LAST_SYNC_ISO');
  if (!lastSyncIso) {
    lastSyncIso = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  }

  var docs = fsRunQuery_({
    from: [{ collectionId: 'candidature' }],
    where: {
      fieldFilter: {
        field: { fieldPath: 'updatedAt' },
        op: 'GREATER_THAN',
        value: { timestampValue: lastSyncIso }
      }
    },
    orderBy: [{ field: { fieldPath: 'updatedAt' }, direction: 'ASCENDING' }],
    limit: 50
  });

  var publicCfg = fsGetDocument_('configurazione', 'public') || {};
  var maxUpdatedIso = lastSyncIso;
  var sentInRun = 0;
  var processedCount = 0;
  var hasPendingHistoryFailure = false;

  for (var i = 0; i < docs.length; i++) {
    if (sentInRun >= FICUP_CONFIG.MAX_EMAILS_PER_TRIGGER_RUN) {
      break;
    }
    var cand = docs[i];
    var candHealthy = true;
    if (cand.archiviata !== true) {
      if (
        String(cand.stato || '') === 'COMPLETATO' &&
        !fsGetDocument_('storico_operazioni', buildAutoCompletionHistoryId_(cand.id)) &&
        !hasManualAdminHistory_(cand.id) &&
        areNuovoEmailsConfirmedSent_(cand.id)
      ) {
        var recRes = autoCompleteCandidaturaIfEmailConfirmed_(cand.id);
        if (!recRes.historyRecorded) {
          candHealthy = false;
          hasPendingHistoryFailure = true;
        }
      }

      if (candHealthy) {
        var stats = processCandidaturaNotifications_(cand, publicCfg, { isPublicTrigger: false });
        sentInRun += stats.sent || 0;
        if (
          String(cand.stato || '') === 'NUOVO' &&
          (stats.failed || 0) === 0 &&
          areNuovoEmailsConfirmedSent_(cand.id)
        ) {
          var compRes = autoCompleteCandidaturaIfEmailConfirmed_(cand.id);
          if (compRes.reason === 'HISTORY_WRITE_FAILED') {
            candHealthy = false;
            hasPendingHistoryFailure = true;
          }
        }
      }
    }
    processedCount += 1;
    if (
      !hasPendingHistoryFailure &&
      candHealthy &&
      cand.updatedAt &&
      new Date(cand.updatedAt).getTime() > new Date(maxUpdatedIso).getTime()
    ) {
      maxUpdatedIso = cand.updatedAt;
    }
  }

  var remainingBudget = Math.max(0, FICUP_CONFIG.MAX_EMAILS_PER_TRIGGER_RUN - sentInRun);
  if (remainingBudget > 0) {
    retryPendingEmailLogs_(remainingBudget);
  }

  if (processedCount > 0 && maxUpdatedIso !== lastSyncIso) {
    // Overlap di 2 secondi per sicurezza contro millisecondi uguali; l'idempotenza su email_logs evita duplicati
    var safeCursor = new Date(new Date(maxUpdatedIso).getTime() - 2000).toISOString();
    props.setProperty('LAST_SYNC_ISO', safeCursor);
  }
}

/**
 * Funzione helper da eseguire UNA SOLA VOLTA manualmente dall'editor Apps Script
 * per installare il trigger incrementale ogni 10 minuti senza duplicati.
 */
function installIncrementalTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'syncCandidatureTrigger') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('syncCandidatureTrigger').timeBased().everyMinutes(10).create();
}

/**
 * Test diagnostico in sola lettura eseguibile dall'editor Apps Script.
 */
function testFirestoreReadOnly() {
  var cfg = fsGetDocument_('configurazione', 'public');
  Logger.log('Configurazione public letta: ' + JSON.stringify(cfg));
  var quota = MailApp.getRemainingDailyQuota();
  Logger.log('Quota email residua oggi: ' + quota);
}
