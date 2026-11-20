export const GDPR_PRIVACY_VERSION = '2026.1';
export const CHAT_RULES_VERSION = '2026.1';
export const REGOLAMENTO_FALLBACK_VERSION = 'in-attesa-pubblicazione';

export interface LegalDocumentSection {
  id: string;
  title: string;
  paragraphs: string[];
  needsConfirmation?: boolean;
}

export const GDPR_PRIVACY_SECTIONS: LegalDocumentSection[] = [
  {
    id: 'titolare',
    title: '1. Titolare del trattamento e contatti',
    needsConfirmation: true,
    paragraphs: [
      'Titolare del trattamento: [DA CONFERMARE — Nome completo / Ragione sociale ed eventuale recapito/sede del Titolare legale del progetto FANTA ITALIA CUP].',
      'Referente operativo per la gestione delle candidature e delle richieste privacy: Staff FANTA ITALIA CUP — email dedicata scudetto26@gmail.com.',
    ],
  },
  {
    id: 'dati-raccolti',
    title: '2. Tipologia di dati personali raccolti (minimizzazione)',
    paragraphs: [
      'Il portale raccoglie esclusivamente i dati strettamente necessari per valutare e gestire la richiesta di partecipazione alla lega gratuita FICUP: Nome, Cognome, indirizzo email utilizzato su Fantaleghe, numero di cellulare (+39), nome della squadra proposta, eventuali note facoltative inserite dal candidato.',
      'Vengono inoltre registrati il codice identificativo univoco della candidatura (formato FICUP26-XXXXXX), i timestamp di invio/aggiornamento e la prova tecnica dell’accettazione di Informativa Privacy, Regolamento ufficiale e Regole della Chat WhatsApp Ufficiale (versione documento e data/ora di conferma).',
    ],
  },
  {
    id: 'finalita-base',
    title: '3. Finalità e base giuridica del trattamento',
    paragraphs: [
      'Finalità: valutazione della candidatura da parte dello staff FICUP, invio delle comunicazioni di servizio sullo stato della richiesta, predisposizione dell’invito di accesso su Fantaleghe, utilizzo del numero di cellulare per consentire l’accesso al gruppo WhatsApp ufficiale e per le comunicazioni organizzative della lega, nonché verifica del rispetto del regolamento della community.',
      'Base giuridica: consenso esplicito dell’interessato espresso prima dell’invio della candidatura (art. 6, par. 1, lett. a GDPR) ed esecuzione di misure precontrattuali/organizzative richieste dall’interessato per l’ammissione alla competizione (art. 6, par. 1, lett. b GDPR).',
    ],
  },
  {
    id: 'responsabili-destinatari',
    title: '4. Responsabili tecnici, infrastruttura e destinatari',
    paragraphs: [
      'I dati sono trattati con strumenti elettronici e archiviati su Google Cloud / Firebase (progetto candidature-ficup), protetti da autenticazione staff e regole di sicurezza che impediscono qualsiasi consultazione pubblica delle candidature.',
      'Le notifiche email transazionali relative alla candidatura sono elaborate tramite Google Apps Script dall’account operativo scudetto26@gmail.com. L’invito di ingresso nella lega comporta l’utilizzo dell’indirizzo email dichiarato sulla piattaforma esterna Fantaleghe; l’accesso ai gruppi WhatsApp avviene tramite invito volontario sulla piattaforma WhatsApp (Meta).',
    ],
  },
  {
    id: 'trasferimenti-conservazione',
    title: '5. Trasferimenti extra-UE e periodo di conservazione',
    needsConfirmation: true,
    paragraphs: [
      'Trasferimenti extra-UE: [DA CONFERMARE — indicazione delle eventuali garanzie/Clausole Contrattuali Standard applicate dai fornitori cloud Google LLC e Meta Platforms per eventuali trattamenti fuori dallo Spazio Economico Europeo].',
      'Periodo di conservazione: [DA CONFERMARE — i dati della candidatura saranno conservati per il tempo necessario alla gestione del reclutamento e per la durata della stagione sportiva FICUP, salvo precedente richiesta di cancellazione o obblighi organizzativi di storico].',
    ],
  },
  {
    id: 'diritti',
    title: '6. Diritti dell’interessato',
    paragraphs: [
      'Ai sensi degli artt. 15–22 del Regolamento (UE) 2016/679 (GDPR), l’interessato può in qualunque momento richiedere l’accesso ai propri dati personali, la rettifica di dati inesatti, la cancellazione (diritto all’oblio), la limitazione del trattamento, l’opposizione o la revoca del consenso senza pregiudicare la liceità del trattamento basata sul consenso prima della revoca.',
      'È inoltre riconosciuto il diritto di proporre reclamo all’Autorità Garante per la protezione dei dati personali. Per esercitare i propri diritti è sufficiente scrivere a scudetto26@gmail.com indicando il proprio codice candidatura FICUP26.',
    ],
  },
];

export const OFFICIAL_CHAT_RULES_SECTIONS: LegalDocumentSection[] = [
  {
    id: 'rispetto-comportamento',
    title: '1. Rispetto reciproco e clima della community',
    paragraphs: [
      'La Chat WhatsApp Ufficiale di FANTA ITALIA CUP nasce per vivere insieme la passione per il calcio e per il Fantacalcio. È obbligatorio mantenere sempre un linguaggio educato e rispettoso verso tutti i partecipanti e verso lo staff.',
      'Sono severamente vietati insulti personali, offese, discriminazioni, provocazioni reiterate, molestie o atteggiamenti aggressivi che rovinino il clima sportivo del gruppo.',
    ],
  },
  {
    id: 'pertinenza-spam',
    title: '2. Pertinenza dei messaggi e divieto di spam',
    paragraphs: [
      'Il gruppo è dedicato alle comunicazioni ufficiali della lega, al confronto sportivo, alle giornate di campionato e alle iniziative FICUP.',
      'È vietato inviare spam, catene, link promozionali, pubblicità non autorizzate, contenuti politici, contenuti volgari o materiale non pertinente alla vita della lega.',
    ],
  },
  {
    id: 'correttezza-fantaleghe',
    title: '3. Fair play, gestione squadra e decisioni dello Staff',
    paragraphs: [
      'Ogni fantallenatore si impegna a gestire con serietà e continuità la propria squadra su Fantaleghe, rispettando le scadenze di formazione, il regolamento della competizione e gli eventuali richiami organizzativi dello staff.',
      'Eventuali contestazioni o chiarimenti regolamentari vanno esposti in modo civile e costruttivo nelle sedi indicate dallo staff, evitando polemiche pubbliche distruttive in chat.',
    ],
  },
  {
    id: 'privacy-link',
    title: '4. Riservatezza del link ufficiale e sanzioni',
    paragraphs: [
      'Il collegamento di invito al Gruppo WhatsApp Ufficiale è strettamente personale e riservato ai fantallenatori approvati dallo staff: è vietato condividerlo o diffonderlo a terzi non autorizzati.',
      'La violazione delle presenti regole può comportare richiami ufficiali, sospensione temporanea o rimozione definitiva dal gruppo e dalla competizione a discrezione dello staff FICUP.',
    ],
  },
];

/**
 * Rimuove o maschera eventuali link WhatsApp grezzi da testi configurati manualmente,
 * garantendo che gli utenti non autorizzati non vedano mai il link ufficiale prima dello sblocco.
 */
export function maskSensitiveWhatsappLinks(rawText: string): string {
  return rawText.replace(
    /https?:\/\/chat\.whatsapp\.com\/[^\s]+/gi,
    '[Link ufficiale riservato: si sblocca dopo il completamento confermato della candidatura]'
  );
}
