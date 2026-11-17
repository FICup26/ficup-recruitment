/**
 * FICUP 26/27 - Backend (Google Apps Script)
 * File: EmailTemplates.gs
 *
 * Modelli email HTML e testo per i flussi automatici di FANTA ITALIA CUP.
 * Non include mai noteInterne o dati amministrativi riservati.
 */

function escapeHtml_(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function wrapEmailHtml_(title, badgeText, bodyHtml, portalUrl) {
  var footerLink = portalUrl
    ? '<p style="margin:18px 0 0 0;"><a href="' +
      escapeHtml_(portalUrl) +
      '/#/waiting-room" style="display:inline-block;background:#0B1F4D;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:10px;font-size:14px;">Apri la tua Waiting Room</a></p>'
    : '';

  return (
    '<div style="font-family:Arial,Helvetica,sans-serif;background:#F8FAFC;padding:24px;color:#0B1F4D;">' +
    '<div style="max-width:600px;margin:0 auto;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:16px;overflow:hidden;">' +
    '<div style="background:#0B1F4D;padding:20px 24px;border-bottom:3px solid #D4AF37;">' +
    '<p style="margin:0;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#FDE68A;font-weight:bold;">FANTA ITALIA CUP · THE FOOTBALL UNIVERSE</p>' +
    '<h1 style="margin:6px 0 0 0;font-size:20px;color:#FFFFFF;">' +
    escapeHtml_(title) +
    '</h1>' +
    '</div>' +
    '<div style="padding:24px;font-size:15px;line-height:1.6;color:#334155;">' +
    '<p style="margin:0 0 14px 0;font-size:12px;font-weight:bold;color:#C69214;text-transform:uppercase;letter-spacing:1px;">' +
    escapeHtml_(badgeText) +
    '</p>' +
    bodyHtml +
    footerLink +
    '</div>' +
    '<div style="padding:16px 24px;background:#F8FAFC;border-top:1px solid #E2E8F0;font-size:12px;color:#64748B;">' +
    'FANTA ITALIA CUP · Email operativa: ' +
    escapeHtml_(FICUP_CONFIG.OPERATIONAL_EMAIL) +
    '</div>' +
    '</div>' +
    '</div>'
  );
}

function buildEmailPayload_(eventType, candidatura, publicConfig) {
  var portalUrl = getPortalBaseUrl_();
  var fullName = ((candidatura.nome || '') + ' ' + (candidatura.cognome || '')).trim();
  var code = candidatura.codiceCandidatura || '';
  var team = candidatura.nomeSquadra || '';
  var candidateEmail = String(candidatura.emailFantaleghe || '').trim().toLowerCase();
  var season = (publicConfig && publicConfig.stagione) || FICUP_CONFIG.SEASON_DEFAULT;
  var budget = (publicConfig && publicConfig.budgetIniziale) || 250;
  var market = (publicConfig && publicConfig.modalitaMercato) || 'ASTA LIBERA';
  var waProvvisorio = (publicConfig && publicConfig.linkWhatsappProvvisorio) || '';

  switch (eventType) {
    case 'NUOVO_CANDIDATO': {
      var subject = 'FANTA ITALIA CUP — Candidatura ricevuta (' + code + ')';
      var text = [
        'Ciao ' + (candidatura.nome || 'Fantallenatore') + ',',
        '',
        'abbiamo ricevuto correttamente la tua candidatura per FANTA ITALIA CUP (' + season + ').',
        'Codice identificativo: ' + code,
        'Squadra indicata: ' + team,
        '',
        'Lo staff esaminerà la richiesta e potrai seguire tutti gli aggiornamenti nella Waiting Room usando il tuo codice candidatura e questa email.',
        waProvvisorio ? 'Gruppo WhatsApp provvisorio: ' + waProvvisorio : '',
        portalUrl ? 'Waiting Room: ' + portalUrl + '/#/waiting-room' : '',
        '',
        'A presto in campo,',
        'Staff FANTA ITALIA CUP (' + FICUP_CONFIG.OPERATIONAL_EMAIL + ')'
      ]
        .filter(Boolean)
        .join('\n');

      var htmlBody =
        '<p>Ciao <strong>' +
        escapeHtml_(candidatura.nome || 'Fantallenatore') +
        '</strong>,</p>' +
        '<p>abbiamo ricevuto correttamente la tua candidatura per la lega nazionale gratuita <strong>FANTA ITALIA CUP (' +
        escapeHtml_(season) +
        ')</strong>.</p>' +
        '<div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:16px;margin:16px 0;">' +
        '<p style="margin:0 0 6px 0;font-size:12px;color:#64748B;">Codice candidatura univoco</p>' +
        '<p style="margin:0;font-size:22px;font-weight:bold;color:#0B1F4D;letter-spacing:1px;">' +
        escapeHtml_(code) +
        '</p>' +
        '<p style="margin:8px 0 0 0;font-size:14px;">Squadra: <strong>' +
        escapeHtml_(team) +
        '</strong></p>' +
        '</div>' +
        '<p>Puoi monitorare in qualsiasi momento lo stato della tua candidatura nella <strong>Waiting Room</strong> inserendo il tuo codice e la tua email Fantaleghe.</p>' +
        (waProvvisorio
          ? '<p>Per coordinarti con lo staff entra nel <a href="' +
            escapeHtml_(waProvvisorio) +
            '">Gruppo WhatsApp Provvisorio</a> indicando il codice <strong>' +
            escapeHtml_(code) +
            '</strong>.</p>'
          : '');

      return {
        to: candidateEmail,
        subject: subject,
        textBody: text,
        htmlBody: wrapEmailHtml_('Candidatura ricevuta', 'Stato: In valutazione', htmlBody, portalUrl)
      };
    }

    case 'NUOVO_ADMIN': {
      var adminSubject = '[FICUP ' + season + '] Nuova candidatura ' + code + ' - ' + fullName;
      var adminText = [
        'Nuova candidatura registrata su Firestore.',
        '',
        'Codice: ' + code,
        'Candidato: ' + fullName,
        'Email Fantaleghe: ' + candidateEmail,
        'Squadra proposta: ' + team,
        candidatura.note ? 'Note del candidato: ' + candidatura.note : 'Note del candidato: nessuna',
        '',
        portalUrl ? 'Apri Area Staff: ' + portalUrl + '/#/admin' : 'Accedi al Pannello Amministrativo per la valutazione.'
      ].join('\n');

      var adminHtml =
        '<p>È stata registrata una nuova candidatura sul portale <strong>FANTA ITALIA CUP</strong>.</p>' +
        '<table style="width:100%;border-collapse:collapse;margin:14px 0;font-size:14px;">' +
        '<tr><td style="padding:6px 0;color:#64748B;">Codice:</td><td style="padding:6px 0;font-weight:bold;color:#0B1F4D;">' +
        escapeHtml_(code) +
        '</td></tr>' +
        '<tr><td style="padding:6px 0;color:#64748B;">Fantallenatore:</td><td style="padding:6px 0;font-weight:bold;">' +
        escapeHtml_(fullName) +
        '</td></tr>' +
        '<tr><td style="padding:6px 0;color:#64748B;">Email Fantaleghe:</td><td style="padding:6px 0;">' +
        escapeHtml_(candidateEmail) +
        '</td></tr>' +
        '<tr><td style="padding:6px 0;color:#64748B;">Squadra:</td><td style="padding:6px 0;font-weight:bold;">' +
        escapeHtml_(team) +
        '</td></tr>' +
        '<tr><td style="padding:6px 0;color:#64748B;">Note candidato:</td><td style="padding:6px 0;">' +
        escapeHtml_(candidatura.note || 'Nessuna') +
        '</td></tr>' +
        '</table>' +
        (portalUrl
          ? '<p><a href="' +
            escapeHtml_(portalUrl) +
            '/#/admin" style="display:inline-block;background:#C69214;color:#FFFFFF;text-decoration:none;font-weight:bold;padding:10px 18px;border-radius:8px;">Apri Area Staff</a></p>'
          : '');

      return {
        to: FICUP_CONFIG.OPERATIONAL_EMAIL,
        subject: adminSubject,
        textBody: adminText,
        htmlBody: wrapEmailHtml_('Nuova candidatura ricevuta', 'Notifica amministrativa', adminHtml, '')
      };
    }

    case 'STATO_APPROVATO': {
      var appSubject = 'FANTA ITALIA CUP — Candidatura approvata (' + code + ')';
      var appText = [
        'Ciao ' + (candidatura.nome || 'Fantallenatore') + ',',
        '',
        'la tua candidatura (' + code + ') con la squadra "' + team + '" è stata approvata dallo staff FANTA ITALIA CUP.',
        'A breve ti invieremo l’invito ufficiale di accesso su Fantaleghe all’indirizzo ' + candidateEmail + '.',
        portalUrl ? 'Controlla gli aggiornamenti nella Waiting Room: ' + portalUrl + '/#/waiting-room' : '',
        '',
        'Staff FANTA ITALIA CUP (' + FICUP_CONFIG.OPERATIONAL_EMAIL + ')'
      ]
        .filter(Boolean)
        .join('\n');

      var appHtml =
        '<p>Ciao <strong>' +
        escapeHtml_(candidatura.nome || 'Fantallenatore') +
        '</strong>,</p>' +
        '<p>ottima notizia: la tua candidatura (<strong>' +
        escapeHtml_(code) +
        '</strong>) per la squadra <strong>' +
        escapeHtml_(team) +
        '</strong> è stata <strong>approvata</strong> dallo staff!</p>' +
        '<p>A breve riceverai l’invito ufficiale per accedere alla lega su Fantaleghe all’indirizzo <strong>' +
        escapeHtml_(candidateEmail) +
        '</strong>.</p>';

      return {
        to: candidateEmail,
        subject: appSubject,
        textBody: appText,
        htmlBody: wrapEmailHtml_('Candidatura approvata', 'Stato: Approvata', appHtml, portalUrl)
      };
    }

    case 'STATO_INVITO_INVIATO': {
      var invSubject = 'FANTA ITALIA CUP — Invito Fantaleghe inviato (' + code + ')';
      var invText = [
        'Ciao ' + (candidatura.nome || 'Fantallenatore') + ',',
        '',
        'abbiamo inviato il tuo invito ufficiale su Fantaleghe all’indirizzo ' + candidateEmail + '.',
        '',
        'Prossimi passaggi:',
        '1. Controlla la tua email (anche Spam/Promozioni) e apri il link dell’invito Fantaleghe.',
        '2. Completa l’accesso alla competizione ' + season + '.',
        '3. Personalizza liberamente la tua rosa (' + budget + ' crediti, modalità ' + market + ') e imposta il nome della tua squadra.',
        '4. Avvisa lo staff sul gruppo WhatsApp provvisorio appena hai completato l’ingresso.',
        '',
        'Staff FANTA ITALIA CUP (' + FICUP_CONFIG.OPERATIONAL_EMAIL + ')'
      ].join('\n');

      var invHtml =
        '<p>Ciao <strong>' +
        escapeHtml_(candidatura.nome || 'Fantallenatore') +
        '</strong>,</p>' +
        '<p>abbiamo inviato l’invito ufficiale su <strong>Fantaleghe</strong> all’indirizzo <strong>' +
        escapeHtml_(candidateEmail) +
        '</strong> (controlla anche Spam o Promozioni).</p>' +
        '<ol style="padding-left:20px;margin:14px 0;">' +
        '<li>Apri l’invito Fantaleghe e accedi alla lega <strong>' +
        escapeHtml_(season) +
        '</strong>.</li>' +
        '<li>Personalizza liberamente tutta la rosa con il budget di <strong>' +
        escapeHtml_(budget) +
        ' crediti</strong> (' +
        escapeHtml_(market) +
        ').</li>' +
        '<li>Imposta il nome definitivo della tua squadra.</li>' +
        '<li>Avvisa lo staff sul gruppo WhatsApp provvisorio appena hai terminato per la verifica finale.</li>' +
        '</ol>';

      return {
        to: candidateEmail,
        subject: invSubject,
        textBody: invText,
        htmlBody: wrapEmailHtml_('Invito ufficiale inviato', 'Stato: Invito inviato', invHtml, portalUrl)
      };
    }

    case 'STATO_COMPLETATO': {
      var compSubject = 'FANTA ITALIA CUP — Ingresso completato! (' + code + ')';
      var compText = [
        'Ciao ' + (candidatura.nome || 'Fantallenatore') + ',',
        '',
        'il tuo ingresso in FANTA ITALIA CUP (' + season + ') con la squadra "' + team + '" è stato verificato e completato!',
        'Ora puoi accedere alla tua Waiting Room per sbloccare il collegamento al gruppo WhatsApp ufficiale della community.',
        portalUrl ? 'Apri la Waiting Room: ' + portalUrl + '/#/waiting-room' : '',
        '',
        'Buona stagione!',
        'Staff FANTA ITALIA CUP (' + FICUP_CONFIG.OPERATIONAL_EMAIL + ')'
      ]
        .filter(Boolean)
        .join('\n');

      var compHtml =
        '<p>Ciao <strong>' +
        escapeHtml_(candidatura.nome || 'Fantallenatore') +
        '</strong>,</p>' +
        '<p>il tuo ingresso in <strong>FANTA ITALIA CUP (' +
        escapeHtml_(season) +
        ')</strong> con la squadra <strong>' +
        escapeHtml_(team) +
        '</strong> è stato verificato e completato con successo!</p>' +
        '<p>Accedi subito alla tua <strong>Waiting Room</strong> inserendo il codice <strong>' +
        escapeHtml_(code) +
        '</strong> e la tua email per sbloccare il collegamento diretto al <strong>Gruppo WhatsApp Ufficiale</strong>.</p>';

      return {
        to: candidateEmail,
        subject: compSubject,
        textBody: compText,
        htmlBody: wrapEmailHtml_('Benvenuto nella community ufficiale!', 'Stato: Accesso completato', compHtml, portalUrl)
      };
    }

    case 'STATO_RESPINTO': {
      var rejSubject = 'FANTA ITALIA CUP — Aggiornamento candidatura (' + code + ')';
      var rejText = [
        'Ciao ' + (candidatura.nome || 'Fantallenatore') + ',',
        '',
        'ti ringraziamo per aver inviato la tua candidatura (' + code + ') per FANTA ITALIA CUP (' + season + ').',
        'Al momento non è stato possibile accogliere la richiesta per la stagione in corso.',
        'Per eventuali chiarimenti puoi scrivere a ' + FICUP_CONFIG.OPERATIONAL_EMAIL + '.',
        '',
        'Staff FANTA ITALIA CUP'
      ].join('\n');

      var rejHtml =
        '<p>Ciao <strong>' +
        escapeHtml_(candidatura.nome || 'Fantallenatore') +
        '</strong>,</p>' +
        '<p>ti ringraziamo per l’interesse verso <strong>FANTA ITALIA CUP (' +
        escapeHtml_(season) +
        ')</strong> e per la candidatura <strong>' +
        escapeHtml_(code) +
        '</strong>.</p>' +
        '<p>Al momento non è stato possibile accogliere la tua richiesta nella lega. Per qualsiasi informazione puoi contattarci rispondendo a <strong>' +
        escapeHtml_(FICUP_CONFIG.OPERATIONAL_EMAIL) +
        '</strong>.</p>';

      return {
        to: candidateEmail,
        subject: rejSubject,
        textBody: rejText,
        htmlBody: wrapEmailHtml_('Aggiornamento sulla tua candidatura', 'Esito valutazione', rejHtml, portalUrl)
      };
    }

    default:
      throw new Error('Tipo evento email sconosciuto: ' + eventType);
  }
}
