export interface WaitingRoomPass {
  id: string;
  codiceCandidatura: string;
  nomeCompleto: string;
  emailFantaleghe: string;
  nomeSquadra: string;
  submittedAtIso: string;
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
      return {
        id: parsed.id,
        codiceCandidatura: parsed.codiceCandidatura,
        nomeCompleto: parsed.nomeCompleto,
        emailFantaleghe: parsed.emailFantaleghe,
        nomeSquadra: parsed.nomeSquadra,
        submittedAtIso: parsed.submittedAtIso,
      };
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
