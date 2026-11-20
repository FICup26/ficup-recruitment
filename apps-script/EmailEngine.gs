/**
 * FICUP 26/27 - Backend (Google Apps Script)
 * File: EmailEngine.gs
 *
 * Motore idempotente di invio email tramite Gmail (scudetto26@gmail.com)
 * con tracciamento su Firestore nella raccolta /email_logs.
 */

function buildEmailLogId_(candidaturaId, eventType) {
  return candidaturaId + '__' + eventType;
}

function getEventTypesForCandidatura_(candidatura) {
  var stato = String(candidatura.stato || 'NUOVO');
  if (stato === 'NUOVO') {
    return ['NUOVO_CANDIDATO', 'NUOVO_ADMIN'];
  }
  if (NOTIFIABLE_STATES[stato]) {
    return ['STATO_' + stato.replace(/\s+/g, '_')];
  }
  return [];
}

function checkPerEmailNuovoLimit_(email) {
  var clean = String(email || '').trim().toLowerCase();
  if (!clean) return false;
  var key = 'nuovo_mail_' + sha256Short_(clean);
  var cache = CacheService.getScriptCache();
  var countRaw = cache.get(key);
  var count = countRaw ? Number(countRaw) : 0;
  return count < FICUP_CONFIG.PUBLIC_NOTIFY_MAX_PER_EMAIL_PER_HOUR;
}

function recordPerEmailNuovoSend_(email) {
  var clean = String(email || '').trim().toLowerCase();
  if (!clean) return;
  var key = 'nuovo_mail_' + sha256Short_(clean);
  var cache = CacheService.getScriptCache();
  var countRaw = cache.get(key);
  var count = countRaw ? Number(countRaw) : 0;
  cache.put(key, String(count + 1), 3600);
}

function buildAutoCompletionHistoryId_(candidaturaId) {
  var candidate = String(candidaturaId || '') + '__AUTO_COMPLETATO';
  if (FICUP_CONFIG.DOC_ID_REGEX.test(candidate)) {
    return candidate;
  }
  return 'sys_ac_' + sha256Short_(candidaturaId);
}

function isSystemAutoCompletedOnly_(candidaturaId) {
  var historyDocs = fsRunQuery_({
    from: [{ collectionId: 'storico_operazioni' }],
    where: {
      fieldFilter: {
        field: { fieldPath: 'candidaturaId' },
        op: 'EQUAL',
        value: { stringValue: candidaturaId }
      }
    },
    limit: 30
  });

  if (!historyDocs || historyDocs.length === 0) {
    return false;
  }

  var hasSystemCompletato = false;
  var hasManualStateTransition = false;
  for (var i = 0; i < historyDocs.length; i++) {
    var entry = historyDocs[i];
    if (String(entry.adminUid || '') === 'SYSTEM_APPS_SCRIPT' && String(entry.statoNuovo || '') === 'COMPLETATO') {
      hasSystemCompletato = true;
    } else if (
      String(entry.adminUid || '') !== 'SYSTEM_APPS_SCRIPT' &&
      String(entry.statoPrecedente || '') !== String(entry.statoNuovo || '')
    ) {
      hasManualStateTransition = true;
    }
  }
  return hasSystemCompletato && !hasManualStateTransition;
}

function hasManualAdminHistory_(candidaturaId) {
  var historyDocs = fsRunQuery_({
    from: [{ collectionId: 'storico_operazioni' }],
    where: {
      fieldFilter: {
        field: { fieldPath: 'candidaturaId' },
        op: 'EQUAL',
        value: { stringValue: candidaturaId }
      }
    },
    limit: 30
  });

  if (!historyDocs || historyDocs.length === 0) {
    return false;
  }

  for (var i = 0; i < historyDocs.length; i++) {
    if (String(historyDocs[i].adminUid || '') !== 'SYSTEM_APPS_SCRIPT') {
      return true;
    }
  }
  return false;
}

function areNuovoEmailsConfirmedSent_(candidaturaId) {
  var candLog = fsGetDocument_('email_logs', buildEmailLogId_(candidaturaId, 'NUOVO_CANDIDATO'));
  var adminLog = fsGetDocument_('email_logs', buildEmailLogId_(candidaturaId, 'NUOVO_ADMIN'));
  return Boolean(
    candLog &&
      candLog.status === 'SENT' &&
      adminLog &&
      adminLog.status === 'SENT'
  );
}

function processCandidaturaNotifications_(candidatura, publicConfig, options) {
  if (!candidatura || !candidatura.id || !candidatura.emailFantaleghe) {
    return { processed: 0, sent: 0, skipped: 0, failed: 0 };
  }

  if (candidatura.archiviata === true) {
    return { processed: 0, sent: 0, skipped: 0, failed: 0 };
  }

  var opts = options || {};
  var events = getEventTypesForCandidatura_(candidatura);
  if (events.length === 0) {
    return { processed: 0, sent: 0, skipped: 0, failed: 0 };
  }

  // Evita l'invio ridondante di STATO_COMPLETATO dal trigger periodico se la candidatura
  // è stata completata automaticamente al momento della ricezione senza passaggio manuale staff.
  if (
    String(candidatura.stato || '') === 'COMPLETATO' &&
    isSystemAutoCompletedOnly_(candidatura.id)
  ) {
    return { processed: 0, sent: 0, skipped: events.length, failed: 0 };
  }

  var config = publicConfig || fsGetDocument_('configurazione', 'public') || {};
  var stats = { processed: 0, sent: 0, skipped: 0, failed: 0 };

  for (var i = 0; i < events.length; i++) {
    var result = dispatchSingleIdempotentEmail_(candidatura, events[i], config, opts);
    stats.processed += 1;
    if (result === 'SENT') stats.sent += 1;
    else if (result === 'FAILED' || result === 'RETRY_EXHAUSTED') stats.failed += 1;
    else stats.skipped += 1;
  }

  return stats;
}

function dispatchSingleIdempotentEmail_(candidatura, eventType, publicConfig, options) {
  var opts = options || {};
  var isPublicTrigger = Boolean(opts.isPublicTrigger);

  // Protezione anti email-bombing su NUOVO_CANDIDATO per lo stesso indirizzo email
  if (eventType === 'NUOVO_CANDIDATO' && !checkPerEmailNuovoLimit_(candidatura.emailFantaleghe)) {
    return 'SKIPPED_EMAIL_RATE_LIMIT';
  }

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    return 'SKIPPED_LOCK';
  }

  var logId = buildEmailLogId_(candidatura.id, eventType);
  var now = new Date();
  var payload;
  var existing;
  var nextAttempts = 1;

  try {
    existing = fsGetDocument_('email_logs', logId);

    if (existing) {
      if (existing.status === 'SENT' || existing.status === 'RETRY_EXHAUSTED') {
        return 'ALREADY_HANDLED';
      }

      if (existing.status === 'PROCESSING' && existing.updatedAt) {
        var ageMs = now.getTime() - new Date(existing.updatedAt).getTime();
        if (ageMs < FICUP_CONFIG.PROCESSING_LOCK_TIMEOUT_MS) {
          return 'IN_PROGRESS';
        }
      }

      if (existing.nextRetryAt && new Date(existing.nextRetryAt).getTime() > now.getTime()) {
        return 'WAITING_RETRY';
      }

      var prevAttempts = Number(existing.attempts || 0);
      if (
        (existing.status === 'FAILED' || existing.status === 'PROCESSING') &&
        prevAttempts >= FICUP_CONFIG.MAX_EMAIL_RETRIES
      ) {
        fsPatchDocument_('email_logs', logId, {
          status: 'RETRY_EXHAUSTED',
          updatedAt: now
        });
        return 'RETRY_EXHAUSTED';
      }

      nextAttempts = existing.status === 'SKIPPED_QUOTA' ? prevAttempts : prevAttempts + 1;
    }

    payload = buildEmailPayload_(eventType, candidatura, publicConfig);

    if (!payload.to || !FICUP_CONFIG.EMAIL_REGEX.test(payload.to)) {
      throw new Error('Destinatario email non valido per evento ' + eventType);
    }

    // Controllo quota Gmail giornaliera residua (riserva una soglia minima per le azioni staff)
    var remainingQuota = MailApp.getRemainingDailyQuota();
    var minRequired = isPublicTrigger ? FICUP_CONFIG.PUBLIC_NOTIFY_QUOTA_RESERVE : 0;
    if (remainingQuota <= minRequired) {
      var quotaRetry = new Date(now.getTime() + FICUP_CONFIG.QUOTA_RETRY_DELAY_MINUTES * 60000);
      var quotaMsg =
        remainingQuota <= 0
          ? 'Quota giornaliera Gmail esaurita (rimanente: 0)'
          : 'Quota residua (' + remainingQuota + ') riservata alle comunicazioni staff prioritarie';
      if (!existing) {
        fsCreateDocumentIfAbsent_('email_logs', logId, {
          candidaturaId: candidatura.id,
          codiceCandidatura: candidatura.codiceCandidatura || '',
          eventType: eventType,
          statoCandidatura: candidatura.stato || '',
          recipient: payload.to,
          subject: payload.subject,
          status: 'SKIPPED_QUOTA',
          attempts: 0,
          maxAttempts: FICUP_CONFIG.MAX_EMAIL_RETRIES,
          lastError: quotaMsg,
          createdAt: now,
          updatedAt: now,
          sentAt: null,
          nextRetryAt: quotaRetry
        });
      } else {
        fsPatchDocument_('email_logs', logId, {
          status: 'SKIPPED_QUOTA',
          lastError: quotaMsg,
          updatedAt: now,
          nextRetryAt: quotaRetry
        });
      }
      return 'SKIPPED_QUOTA';
    }

    if (!existing) {
      var created = fsCreateDocumentIfAbsent_('email_logs', logId, {
        candidaturaId: candidatura.id,
        codiceCandidatura: candidatura.codiceCandidatura || '',
        eventType: eventType,
        statoCandidatura: candidatura.stato || '',
        recipient: payload.to,
        subject: payload.subject,
        status: 'PROCESSING',
        attempts: nextAttempts,
        maxAttempts: FICUP_CONFIG.MAX_EMAIL_RETRIES,
        lastError: '',
        createdAt: now,
        updatedAt: now,
        sentAt: null,
        nextRetryAt: null
      });

      if (!created) {
        return 'ALREADY_HANDLED';
      }
    } else {
      fsPatchDocument_('email_logs', logId, {
        status: 'PROCESSING',
        attempts: nextAttempts,
        recipient: payload.to,
        subject: payload.subject,
        updatedAt: now,
        nextRetryAt: null
      });
    }
  } finally {
    lock.releaseLock();
  }

  // Invio effettivo fuori dal lock breve
  var emailSent = false;
  try {
    MailApp.sendEmail(payload.to, payload.subject, payload.textBody, {
      htmlBody: payload.htmlBody,
      name: FICUP_CONFIG.SENDER_NAME,
      replyTo: FICUP_CONFIG.OPERATIONAL_EMAIL
    });
    emailSent = true;
    if (eventType === 'NUOVO_CANDIDATO') {
      recordPerEmailNuovoSend_(candidatura.emailFantaleghe);
    }
  } catch (sendErr) {
    var errTime = new Date();
    var errMsg = sendErr && sendErr.message ? sendErr.message : String(sendErr);
    var isExhausted = nextAttempts >= FICUP_CONFIG.MAX_EMAIL_RETRIES;
    var nextRetry = isExhausted
      ? null
      : new Date(errTime.getTime() + FICUP_CONFIG.RETRY_DELAY_MINUTES * 60000);

    try {
      fsPatchDocument_('email_logs', logId, {
        status: isExhausted ? 'RETRY_EXHAUSTED' : 'FAILED',
        lastError: errMsg.slice(0, 500),
        updatedAt: errTime,
        nextRetryAt: nextRetry
      });
    } catch (patchErr) {
      console.error('Errore aggiornamento stato FAILED email_logs ' + logId + ':', patchErr);
    }
    return isExhausted ? 'RETRY_EXHAUSTED' : 'FAILED';
  }

  // Patch separato per SENT: se l'email è partita, non deve mai ricadere in FAILED
  if (emailSent) {
    var sentTime = new Date();
    var sentPatch = {
      status: 'SENT',
      lastError: '',
      sentAt: sentTime,
      updatedAt: sentTime,
      nextRetryAt: null
    };
    try {
      fsPatchDocument_('email_logs', logId, sentPatch);
    } catch (sentPatchErr1) {
      try {
        Utilities.sleep(300);
        fsPatchDocument_('email_logs', logId, sentPatch);
      } catch (sentPatchErr2) {
        console.error('Email inviata ma errore patch SENT per ' + logId + ':', sentPatchErr2);
      }
    }
    return 'SENT';
  }
  return 'FAILED';
}

function retryPendingEmailLogs_(maxSends) {
  var pendingLogs = fsRunQuery_({
    from: [{ collectionId: 'email_logs' }],
    where: {
      fieldFilter: {
        field: { fieldPath: 'status' },
        op: 'IN',
        value: {
          arrayValue: {
            values: [{ stringValue: 'FAILED' }, { stringValue: 'SKIPPED_QUOTA' }]
          }
        }
      }
    },
    limit: 20
  });

  if (!pendingLogs || pendingLogs.length === 0) {
    return 0;
  }

  var nowMs = Date.now();
  var config = fsGetDocument_('configurazione', 'public') || {};
  var retried = 0;
  var budget = typeof maxSends === 'number' ? maxSends : FICUP_CONFIG.MAX_EMAILS_PER_TRIGGER_RUN;

  for (var i = 0; i < pendingLogs.length; i++) {
    if (retried >= budget) {
      break;
    }
    var log = pendingLogs[i];
    if (log.nextRetryAt && new Date(log.nextRetryAt).getTime() > nowMs) {
      continue;
    }
    if (!log.candidaturaId || !log.eventType) {
      continue;
    }
    var cand = fsGetDocument_('candidature', log.candidaturaId);
    if (!cand) {
      fsPatchDocument_('email_logs', log.id, {
        status: 'RETRY_EXHAUSTED',
        lastError: 'Documento candidatura non più presente su Firestore.',
        updatedAt: new Date(),
        nextRetryAt: null
      });
      continue;
    }
    if (cand.archiviata === true) {
      continue;
    }
    var outcome = dispatchSingleIdempotentEmail_(cand, log.eventType, config, { isPublicTrigger: false });
    if (outcome === 'SENT') {
      retried += 1;
    }
  }

  return retried;
}
