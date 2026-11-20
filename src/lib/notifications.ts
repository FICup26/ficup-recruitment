import type { CandidaturaRecord, CandidaturaStato } from './firestore';

export const FICUP_OPERATIONAL_EMAIL = 'scudetto26@gmail.com';

export type NotificationTemplateKey =
  | 'NUOVA_CANDIDATURA_STAFF'
  | 'CONFERMA_RICEZIONE_CANDIDATO'
  | 'APPROVAZIONE'
  | 'INVITO_INVIATO'
  | 'COMPLETAMENTO';

export interface PreparedEmailDraft {
  key: NotificationTemplateKey;
  label: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  htmlBody?: string;
  mailtoHref: string;
  hasOfficialWhatsappLink: boolean;
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isValidWhatsappInviteUrl(url: string | undefined): url is string {
  return typeof url === 'string' && /^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]+/i.test(url.trim());
}

function buildApprovalHtmlEmail(params: {
  nome: string;
  codiceCandidatura: string;
  nomeSquadra: string;
  emailFantaleghe: string;
  operationalEmail: string;
  officialWhatsappLink?: string;
}): string {
  const safeNome = escapeHtml(params.nome);
  const safeCode = escapeHtml(params.codiceCandidatura);
  const safeTeam = escapeHtml(params.nomeSquadra);
  const safeEmail = escapeHtml(params.emailFantaleghe);
  const safeOpEmail = escapeHtml(params.operationalEmail);
  const validWaLink = isValidWhatsappInviteUrl(params.officialWhatsappLink)
    ? params.officialWhatsappLink.trim()
    : '';
  const safeWaLink = validWaLink ? escapeHtml(validWaLink) : '';

  const whatsappBlockHtml = validWaLink
    ? `
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0 18px 0;">
        <tr>
          <td align="center" style="padding:20px 16px;background-color:#F0FDF4;border:1px solid #BBF7D0;border-radius:12px;">
            <p style="margin:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#14532D;font-weight:bold;">
              Accesso riservato al Gruppo WhatsApp Ufficiale FICUP 26/27
            </p>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td align="center" bgcolor="#15803D" style="border-radius:10px;background-color:#15803D;">
                  <a href="${safeWaLink}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 24px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:#FFFFFF;text-decoration:none;letter-spacing:0.4px;border-radius:10px;">
                    ENTRA NEL GRUPPO WHATSAPP UFFICIALE
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:14px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#334155;word-break:break-all;">
              Se il pulsante non dovesse aprirsi, copia o clicca questo link diretto:<br />
              <a href="${safeWaLink}" target="_blank" rel="noopener noreferrer" style="color:#0284C7;text-decoration:underline;">${safeWaLink}</a>
            </p>
          </td>
        </tr>
      </table>
    `
    : '';

  return `
<div style="margin:0;padding:16px;background-color:#F8FAFC;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;margin:0 auto;background-color:#FFFFFF;border:1px solid #E2E8F0;border-radius:14px;overflow:hidden;">
    <tr>
      <td style="background-color:#0B1F4D;padding:22px 24px;border-bottom:3px solid #C69214;">
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;letter-spacing:1.6px;text-transform:uppercase;color:#FDE68A;">
          FANTA ITALIA CUP · STAGIONE 26/27
        </p>
        <h1 style="margin:6px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:20px;line-height:1.3;color:#FFFFFF;">
          Benvenuto in FICUP 26/27!
        </h1>
      </td>
    </tr>
    <tr>
      <td style="padding:24px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1E293B;">
        <p style="margin:0 0 14px 0;">Ciao <strong>${safeNome}</strong>,</p>
        <p style="margin:0 0 14px 0;">
          siamo felici di darti il benvenuto ufficiale in <strong>FICUP 26/27</strong>! La tua candidatura (<strong>${safeCode}</strong>) per la squadra <strong>&ldquo;${safeTeam}&rdquo;</strong> è stata verificata e approvata dallo staff.
        </p>
        <p style="margin:0 0 14px 0;">
          A breve riceverai l&apos;invito ufficiale di accesso su Fantaleghe all&apos;indirizzo <strong>${safeEmail}</strong>.
        </p>
        ${whatsappBlockHtml}
        <p style="margin:18px 0 0 0;font-size:14px;color:#475569;">
          Ti aspettiamo nella community.<br />
          <strong>Staff FANTA ITALIA CUP</strong> (${safeOpEmail})
        </p>
      </td>
    </tr>
  </table>
</div>`.trim();
}

export function buildNotificationDraft(
  key: NotificationTemplateKey,
  candidatura: Pick<
    CandidaturaRecord,
    'codiceCandidatura' | 'nome' | 'cognome' | 'emailFantaleghe' | 'nomeSquadra'
  >,
  operationalEmail: string = FICUP_OPERATIONAL_EMAIL,
  options?: {
    officialWhatsappLink?: string;
    isVerifiedForWhatsappLink?: boolean;
  }
): PreparedEmailDraft {
  const fullName = `${candidatura.nome} ${candidatura.cognome}`.trim();
  let subject = '';
  let body = '';
  let htmlBody: string | undefined;
  let to = candidatura.emailFantaleghe;
  let label = '';

  const allowOfficialWhatsapp =
    key === 'APPROVAZIONE' &&
    options?.isVerifiedForWhatsappLink !== false &&
    isValidWhatsappInviteUrl(options?.officialWhatsappLink);
  const officialWaLink = allowOfficialWhatsapp ? options!.officialWhatsappLink!.trim() : '';

  switch (key) {
    case 'NUOVA_CANDIDATURA_STAFF':
      label = 'Notifica nuova candidatura (Staff)';
      to = operationalEmail;
      subject = `[FICUP 26/27] Nuova candidatura ${candidatura.codiceCandidatura} - ${fullName}`;
      body = [
        `Nuova candidatura ricevuta sul portale FICUP Recruitment 26/27.`,
        ``,
        `Codice: ${candidatura.codiceCandidatura}`,
        `Fantallenatore: ${fullName}`,
        `Email Fantaleghe: ${candidatura.emailFantaleghe}`,
        `Squadra proposta: ${candidatura.nomeSquadra}`,
        ``,
        `Accedi al Pannello Amministrativo per verificare ed elaborare la richiesta.`,
      ].join('\n');
      break;

    case 'CONFERMA_RICEZIONE_CANDIDATO':
      label = 'Conferma ricezione candidato';
      subject = `FICUP 26/27 — Candidatura ricevuta (${candidatura.codiceCandidatura})`;
      body = [
        `Ciao ${candidatura.nome},`,
        ``,
        `abbiamo ricevuto correttamente la tua candidatura per la lega nazionale gratuita FICUP 26/27.`,
        `Codice identificativo: ${candidatura.codiceCandidatura}`,
        `Squadra indicata: ${candidatura.nomeSquadra}`,
        ``,
        `Il nostro staff verificherà le informazioni e ti contatterà per completare la procedura.`,
        ``,
        `A presto in campo,`,
        `Staff FICUP (${operationalEmail})`,
      ].join('\n');
      break;

    case 'APPROVAZIONE': {
      label = 'Notifica approvazione e ingresso';
      subject = `FICUP 26/27 — Candidatura approvata e benvenuto ufficiale (${candidatura.codiceCandidatura})`;
      const lines = [
        `Ciao ${candidatura.nome},`,
        ``,
        `benvenuto ufficialmente in FICUP 26/27!`,
        `La tua candidatura (${candidatura.codiceCandidatura}) per la squadra "${candidatura.nomeSquadra}" è stata verificata e approvata dallo staff FICUP.`,
        `A breve riceverai l'invito ufficiale di accesso su Fantaleghe a questo indirizzo email (${candidatura.emailFantaleghe}).`,
      ];
      if (officialWaLink) {
        lines.push(
          ``,
          `ENTRA NEL GRUPPO WHATSAPP UFFICIALE:`,
          `${officialWaLink}`,
          ``,
          `(Link diretto riservato ai partecipanti ammessi: ti invitiamo a non condividerlo all'esterno.)`
        );
      } else {
        lines.push(
          ``,
          `Resta connesso sull'Area Personale o sul gruppo WhatsApp provvisorio per il coordinamento finale.`
        );
      }
      lines.push(``, `Ti aspettiamo in lega!`, `Staff FICUP (${operationalEmail})`);
      body = lines.join('\n');
      htmlBody = buildApprovalHtmlEmail({
        nome: candidatura.nome,
        codiceCandidatura: candidatura.codiceCandidatura,
        nomeSquadra: candidatura.nomeSquadra,
        emailFantaleghe: candidatura.emailFantaleghe,
        operationalEmail,
        officialWhatsappLink: officialWaLink || undefined,
      });
      break;
    }

    case 'INVITO_INVIATO':
      label = 'Comunicazione invito inviato';
      subject = `FICUP 26/27 — Invito Fantaleghe inviato (${candidatura.codiceCandidatura})`;
      body = [
        `Ciao ${candidatura.nome},`,
        ``,
        `ti abbiamo inviato l'invito ufficiale per accedere alla competizione FICUP 26/27 su Fantaleghe all'indirizzo ${candidatura.emailFantaleghe}.`,
        ``,
        `Prossimi passaggi:`,
        `1. Apri il link presente nell'invito Fantaleghe.`,
        `2. Completa l'accesso alla competizione.`,
        `3. Personalizza liberamente la tua rosa (budget 250 crediti, modalità Asta Libera) e cambia il nome della squadra.`,
        `4. Avvisa lo staff sul gruppo WhatsApp provvisorio appena hai terminato.`,
        ``,
        `Staff FICUP (${operationalEmail})`,
      ].join('\n');
      break;

    case 'COMPLETAMENTO':
      label = 'Comunicazione completamento';
      subject = `FICUP 26/27 — Ingresso completato (${candidatura.codiceCandidatura})`;
      body = [
        `Ciao ${candidatura.nome},`,
        ``,
        `il tuo ingresso in FICUP 26/27 con la squadra "${candidatura.nomeSquadra}" è stato verificato e completato.`,
        `Ora puoi accedere al gruppo WhatsApp ufficiale della community FICUP dalla tua Area Personale.`,
        ``,
        `Buona stagione!`,
        `Staff FICUP (${operationalEmail})`,
      ].join('\n');
      break;
  }

  const mailtoHref = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return {
    key,
    label,
    from: operationalEmail,
    to,
    subject,
    body,
    htmlBody,
    mailtoHref,
    hasOfficialWhatsappLink: Boolean(officialWaLink),
  };
}

export function getSuggestedTemplateForState(stato: CandidaturaStato): NotificationTemplateKey {
  switch (stato) {
    case 'APPROVATO':
      return 'APPROVAZIONE';
    case 'INVITO INVIATO':
    case 'DA COMPLETARE':
      return 'INVITO_INVIATO';
    case 'COMPLETATO':
      return 'COMPLETAMENTO';
    default:
      return 'CONFERMA_RICEZIONE_CANDIDATO';
  }
}

export function parseFirestoreUiError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  try {
    const parsed = JSON.parse(raw) as {
      code?: string | null;
      error?: string;
      path?: string;
      operationType?: string;
    };
    const code = (parsed.code ?? '').toLowerCase();
    const detail = parsed.error ?? raw;
    const lower = detail.toLowerCase();
    if (
      code === 'permission-denied' ||
      lower.includes('permission-denied') ||
      lower.includes('missing or insufficient permissions')
    ) {
      return 'Permessi Firestore insufficienti o regole di sicurezza non ancora pubblicate nella Firebase Console per questo database.';
    }
    if (code === 'not-found' || lower.includes('not-found')) {
      return 'Database o documento Cloud Firestore non trovato. Verifica il database ID configurato per candidature-ficup.';
    }
    if (code === 'failed-precondition' || lower.includes('failed-precondition')) {
      return 'Precondizione Firestore non soddisfatta (es. indice richiesto o stato istanza non valido).';
    }
    if (code === 'unavailable' || lower.includes('offline') || lower.includes('unavailable')) {
      return 'Database Cloud Firestore attualmente non raggiungibile. Verifica la connessione o lo stato di attivazione del servizio su Firebase Console.';
    }
    return detail;
  } catch {
    const lower = raw.toLowerCase();
    if (lower.includes('permission-denied') || lower.includes('insufficient permissions')) {
      return 'Operazione bloccata dalle regole Firestore: verifica i permessi o la pubblicazione delle regole.';
    }
    if (lower.includes('offline') || lower.includes('unavailable')) {
      return 'Database Cloud Firestore attualmente non raggiungibile. Verifica la connessione o lo stato di attivazione del servizio su Firebase Console.';
    }
    return raw;
  }
}
