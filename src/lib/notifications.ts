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
  mailtoHref: string;
}

export function buildNotificationDraft(
  key: NotificationTemplateKey,
  candidatura: Pick<
    CandidaturaRecord,
    'codiceCandidatura' | 'nome' | 'cognome' | 'emailFantaleghe' | 'nomeSquadra'
  >,
  operationalEmail: string = FICUP_OPERATIONAL_EMAIL
): PreparedEmailDraft {
  const fullName = `${candidatura.nome} ${candidatura.cognome}`.trim();
  let subject = '';
  let body = '';
  let to = candidatura.emailFantaleghe;
  let label = '';

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
        `Se non l'hai ancora fatto, entra nel gruppo WhatsApp provvisorio per restare in contatto con lo staff durante la verifica.`,
        ``,
        `A presto in campo,`,
        `Staff FICUP (${operationalEmail})`,
      ].join('\n');
      break;

    case 'APPROVAZIONE':
      label = 'Notifica approvazione';
      subject = `FICUP 26/27 — Candidatura approvata (${candidatura.codiceCandidatura})`;
      body = [
        `Ciao ${candidatura.nome},`,
        ``,
        `la tua candidatura (${candidatura.codiceCandidatura}) per la squadra "${candidatura.nomeSquadra}" è stata approvata dallo staff FICUP.`,
        `A breve riceverai l'invito ufficiale di accesso su Fantaleghe a questo indirizzo email (${candidatura.emailFantaleghe}).`,
        ``,
        `Resta connesso sul gruppo WhatsApp provvisorio per il coordinamento finale.`,
        ``,
        `Staff FICUP (${operationalEmail})`,
      ].join('\n');
      break;

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
        `Ora puoi accedere al gruppo WhatsApp ufficiale della community FICUP.`,
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
    mailtoHref,
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
