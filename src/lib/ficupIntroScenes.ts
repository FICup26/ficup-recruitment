export interface SceneDefinition {
  id: number;
  title: string;
  startMs: number;
  durationMs: number;
}

export interface ItalyCityPoint {
  id: string;
  name: string;
  x: number;
  y: number;
  dx: number;
  dy: number;
  anchor: 'start' | 'middle' | 'end';
  wave: 1 | 2 | 3 | 4;
}

export const INTRO_VIDEO_TOTAL_DURATION_MS = 90000; // Esattamente 90 secondi (01:30)

export const INTRO_SCENES: SceneDefinition[] = [
  { id: 1, title: 'Fanta Italia Cup', startMs: 0, durationMs: 11000 },
  { id: 2, title: "FICUP unisce l'Italia", startMs: 11000, durationMs: 11000 },
  { id: 3, title: 'Gruppo WhatsApp Provvisorio', startMs: 22000, durationMs: 12000 },
  { id: 4, title: 'Candidatura Accettata!', startMs: 34000, durationMs: 12000 },
  { id: 5, title: 'Invito Fantaleghe via Email', startMs: 46000, durationMs: 11000 },
  { id: 6, title: 'Accesso al sito Fantaleghe', startMs: 57000, durationMs: 12000 },
  { id: 7, title: 'App, Squadra & Rosa', startMs: 69000, durationMs: 12000 },
  { id: 8, title: 'Inizio Avventura FICUP', startMs: 81000, durationMs: 9000 },
];

/**
 * Sagoma geografica dettagliata e proporzionata dell'Italia (Penisola, Sicilia, Sardegna)
 * in viewBox "0 0 400 470" basato su coordinate geografiche reali (6.5E..18.8E, 36.5N..47.2N).
 */
export const ITALY_MAINLAND_PATH =
  'M 28 122 L 26 95 L 44 68 L 78 58 L 96 42 L 138 22 L 178 16 L 210 26 L 234 52 L 222 72 L 194 92 L 188 122 L 214 152 L 242 184 L 264 218 L 306 238 L 336 254 L 368 286 L 382 308 L 362 316 L 338 294 L 316 300 L 312 318 L 328 340 L 324 374 L 304 402 L 290 398 L 296 368 L 306 342 L 290 318 L 264 294 L 234 274 L 204 248 L 176 226 L 154 196 L 142 168 L 116 144 L 88 134 L 64 144 L 46 156 L 32 140 Z';

export const ITALY_SICILY_PATH =
  'M 204 384 L 244 378 L 284 388 L 274 422 L 254 446 L 224 432 L 196 410 Z';

export const ITALY_SARDINIA_PATH =
  'M 78 264 L 106 258 L 114 296 L 110 342 L 94 358 L 74 348 L 68 302 Z';

/**
 * 12 città rappresentative di Nord, Centro, Sud e Isole con posizionamento geografico reale
 * e offset etichette calcolati per evitare qualsiasi sovrapposizione o uscita dalla mappa.
 */
export const ITALY_CITIES_12: ItalyCityPoint[] = [
  { id: 'to', name: 'Torino', x: 52, y: 103, dx: -10, dy: 4, anchor: 'end', wave: 1 },
  { id: 'mi', name: 'Milano', x: 96, y: 87, dx: 0, dy: -12, anchor: 'middle', wave: 1 },
  { id: 'ge', name: 'Genova', x: 89, y: 130, dx: -11, dy: 14, anchor: 'end', wave: 1 },
  { id: 've', name: 'Venezia', x: 190, y: 88, dx: 11, dy: -8, anchor: 'start', wave: 1 },
  { id: 'bo', name: 'Bologna', x: 161, y: 127, dx: 12, dy: -4, anchor: 'start', wave: 2 },
  { id: 'fi', name: 'Firenze', x: 158, y: 156, dx: 12, dy: 8, anchor: 'start', wave: 2 },
  { id: 'rm', name: 'Roma', x: 195, y: 233, dx: -12, dy: 5, anchor: 'end', wave: 2 },
  { id: 'na', name: 'Napoli', x: 248, y: 276, dx: -12, dy: 6, anchor: 'end', wave: 3 },
  { id: 'ba', name: 'Bari', x: 326, y: 265, dx: 11, dy: -6, anchor: 'start', wave: 3 },
  { id: 'cz', name: 'Catanzaro', x: 318, y: 355, dx: 11, dy: 4, anchor: 'start', wave: 3 },
  { id: 'pa', name: 'Palermo', x: 221, y: 388, dx: -12, dy: -6, anchor: 'end', wave: 4 },
  { id: 'ca', name: 'Cagliari', x: 94, y: 343, dx: 0, dy: 20, anchor: 'middle', wave: 4 },
];

export const ITALY_NETWORK_ROUTES: ReadonlyArray<readonly [string, string]> = [
  ['to', 'mi'],
  ['mi', 'ge'],
  ['mi', 've'],
  ['mi', 'bo'],
  ['ve', 'bo'],
  ['bo', 'fi'],
  ['fi', 'rm'],
  ['rm', 'na'],
  ['na', 'ba'],
  ['ba', 'cz'],
  ['na', 'cz'],
  ['cz', 'pa'],
  ['rm', 'ca'],
  ['pa', 'ca'],
];

export const SQUAD_POSITIONS = [
  { pos: 'P', x: '50%', y: '86%' },
  { pos: 'D', x: '22%', y: '66%' },
  { pos: 'D', x: '50%', y: '68%' },
  { pos: 'D', x: '78%', y: '66%' },
  { pos: 'C', x: '16%', y: '44%' },
  { pos: 'C', x: '39%', y: '46%' },
  { pos: 'C', x: '61%', y: '46%' },
  { pos: 'C', x: '84%', y: '44%' },
  { pos: 'A', x: '26%', y: '21%' },
  { pos: 'A', x: '50%', y: '18%' },
  { pos: 'A', x: '74%', y: '21%' },
] as const;
