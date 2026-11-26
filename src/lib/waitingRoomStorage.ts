export interface WaitingRoomAcceptedDocs {
  versionePrivacy: string;
  versioneRegolamento: string;
  versioneRegoleChat: string;
  acceptedAtIso: string;
  accettazioneSyncedOnFirestore?: boolean;
}

export interface WaitingRoomPass {
  id: string;
  codiceCandidatura: string;
  tipoCandidatura?: 'LIBERA' | 'SUBENTRO';
  nomeCompleto: string;
  emailFantaleghe: string;
  cellulare?: string;
  nomeSquadra: string;
  serieSquadra?: string;
  submittedAtIso: string;
  acceptedDocs?: WaitingRoomAcceptedDocs;
}

const STORAGE_KEY = 'ficup_waiting_room_pass_v1';

export function loadWaitingRoomPass(): WaitingRoomPass | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<WaitingRoomPass>;
    if (
      typeof parsed.id === 'string' &&
      typeof parsed.codiceCandidatura === 'string' &&
      typeof parsed.nomeCompleto === 'string' &&
      typeof parsed.emailFantaleghe === 'string' &&
      typeof parsed.nomeSquadra === 'string' &&
      typeof parsed.submittedAtIso === 'string'
    ) {
      const result: WaitingRoomPass = {
        id: parsed.id,
        codiceCandidatura: parsed.codiceCandidatura,
        nomeCompleto: parsed.nomeCompleto,
        emailFantaleghe: parsed.emailFantaleghe,
        nomeSquadra: parsed.nomeSquadra,
        submittedAtIso: parsed.submittedAtIso,
      };
      if (parsed.tipoCandidatura === 'LIBERA' || parsed.tipoCandidatura === 'SUBENTRO') {
        result.tipoCandidatura = parsed.tipoCandidatura;
      }
      if (typeof parsed.serieSquadra === 'string' && parsed.serieSquadra.trim()) {
        result.serieSquadra = parsed.serieSquadra.trim();
      }
      if (typeof parsed.cellulare === 'string' && parsed.cellulare.trim()) {
        result.cellulare = parsed.cellulare;
      }
      if (
        parsed.acceptedDocs &&
        typeof parsed.acceptedDocs.versionePrivacy === 'string' &&
        typeof parsed.acceptedDocs.versioneRegolamento === 'string' &&
        typeof parsed.acceptedDocs.versioneRegoleChat === 'string'
      ) {
        result.acceptedDocs = parsed.acceptedDocs;
      }
      return result;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveWaitingRoomPass(pass: WaitingRoomPass): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pass));
  } catch {
    // Storage unavailable in restricted browser mode
  }
}

export function clearWaitingRoomPass(): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
}
