import {
  AlertCircle,
  Award,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Flame,
  Loader2,
  Lock,
  RefreshCw,
  Search,
  Shield,
  Trophy,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchOfficialMatchday,
  fetchOfficialStandings,
  fetchOfficialSuperlega,
  fetchOfficialZonaVarPublic,
  OfficialBridgeError,
  SERIE_LABELS,
  type AllStandingsResponse,
  type AllowedSerieKey,
  type MatchdayResultsResponse,
  type SuperlegaAggregateResponse,
  type ZonaVarIntegratedResponse,
} from '../lib/officialFicupClient';

export type OfficialTab = 'classifiche' | 'superlega' | 'giornate' | 'zonavar';

const PENDING_OFFICIAL_TAB_KEY = '__ficupPendingOfficialTab';

export function setPendingOfficialTab(tab: OfficialTab): void {
  if (typeof window === 'undefined') return;
  (window as unknown as Record<string, unknown>)[PENDING_OFFICIAL_TAB_KEY] = tab;
}

function consumePendingOfficialTab(): OfficialTab | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as Record<string, unknown>;
  const pending = win[PENDING_OFFICIAL_TAB_KEY];
  if (
    pending === 'classifiche' ||
    pending === 'superlega' ||
    pending === 'giornate' ||
    pending === 'zonavar'
  ) {
    delete win[PENDING_OFFICIAL_TAB_KEY];
    return pending;
  }
  return null;
}

const SERIE_ORDER: AllowedSerieKey[] = [
  'serie_a',
  'serie_b',
  'lega_pro_a',
  'lega_pro_b',
  'lega_pro_c',
];

function formatIsoDate(iso: string | null): string {
  if (!iso) {
    return '—';
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

function asStringField(val: unknown, fallback = ''): string {
  return typeof val === 'string'
    ? val
    : val === null || val === undefined
      ? fallback
      : String(val);
}

export function OfficialLeagueSection() {
  const [activeTab, setActiveTab] = useState<OfficialTab>(() => consumePendingOfficialTab() ?? 'classifiche');
  const [selectedSerie, setSelectedSerie] = useState<AllowedSerieKey>('serie_a');
  const [selectedGiornata, setSelectedGiornata] = useState<number>(1);
  const [hasAutoSelectedLatestGiornata, setHasAutoSelectedLatestGiornata] = useState(false);
  const [clubSearch, setClubSearch] = useState('');

  const [standingsData, setStandingsData] = useState<AllStandingsResponse | null>(null);
  const [superlegaData, setSuperlegaData] = useState<SuperlegaAggregateResponse | null>(null);
  const [matchdayData, setMatchdayData] = useState<MatchdayResultsResponse | null>(null);
  const [zonaVarData, setZonaVarData] = useState<ZonaVarIntegratedResponse | null>(null);

  const standingsRef = useRef<AllStandingsResponse | null>(null);
  const superlegaRef = useRef<SuperlegaAggregateResponse | null>(null);
  const zonaVarRef = useRef<ZonaVarIntegratedResponse | null>(null);
  const matchdayByNumRef = useRef<Map<number, MatchdayResultsResponse>>(new Map());
  const selectedGiornataRef = useRef<number>(1);

  standingsRef.current = standingsData;
  superlegaRef.current = superlegaData;
  zonaVarRef.current = zonaVarData;
  selectedGiornataRef.current = selectedGiornata;

  const [loading, setLoading] = useState(false);
  const [errorInfo, setErrorInfo] = useState<{ code: string; message: string } | null>(null);

  const availableGiornate = useMemo(() => {
    const list = superlegaData?.mainData.availableGiornate ?? [];
    if (list.length > 0) {
      return list;
    }
    return Array.from({ length: 11 }, (_, i) => i + 1);
  }, [superlegaData]);

  // Seleziona automaticamente l'ultima giornata reale disponibile
  useEffect(() => {
    const list = superlegaData?.mainData.availableGiornate ?? [];
    if (!hasAutoSelectedLatestGiornata && list.length > 0) {
      setSelectedGiornata(list[list.length - 1]);
      setHasAutoSelectedLatestGiornata(true);
    }
  }, [superlegaData, hasAutoSelectedLatestGiornata]);

  const loadTabData = useCallback(async (tab: OfficialTab, forceRefresh = false) => {
    setLoading(true);
    setErrorInfo(null);
    try {
      if (tab === 'classifiche') {
        if (standingsRef.current && !forceRefresh) {
          return;
        }
        const standingsRes = await fetchOfficialStandings(forceRefresh);
        standingsRef.current = standingsRes;
        setStandingsData(standingsRes);
      } else if (tab === 'superlega') {
        if (superlegaRef.current && !forceRefresh) {
          return;
        }
        const agg = await fetchOfficialSuperlega(forceRefresh);
        superlegaRef.current = agg;
        setSuperlegaData(agg);
      } else if (tab === 'giornate') {
        const currentSuperlega = superlegaRef.current;
        const agg =
          !currentSuperlega || forceRefresh
            ? await fetchOfficialSuperlega(forceRefresh)
            : currentSuperlega;
        if (!currentSuperlega || forceRefresh) {
          superlegaRef.current = agg;
          setSuperlegaData(agg);
        }

        const avail = agg.mainData.availableGiornate;
        const currentGiornata = selectedGiornataRef.current;
        const targetGiornata =
          avail.length > 0 && !avail.includes(currentGiornata)
            ? avail[avail.length - 1]
            : currentGiornata;
        if (targetGiornata !== currentGiornata) {
          selectedGiornataRef.current = targetGiornata;
          setSelectedGiornata(targetGiornata);
        }

        const nestedMatchday = agg.mainData.giornate.find(
          (item) => item.giornata === targetGiornata
        );

        if (nestedMatchday && !forceRefresh) {
          const built: MatchdayResultsResponse = {
            ok: true,
            meta: agg.meta,
            giornata: targetGiornata,
            document: {
              docId: `giornata_${targetGiornata}`,
              exists: true,
              giornata: targetGiornata,
              top10: nestedMatchday.top10,
              allResults: nestedMatchday.allResults,
              matches: nestedMatchday.matches,
              giornate: [],
              availableGiornate: avail,
              cumulativeTop10: agg.mainData.cumulativeTop10,
              totalResultsImported: nestedMatchday.totalResultsImported,
              updatedAt: nestedMatchday.updatedAt,
            },
          };
          matchdayByNumRef.current.set(targetGiornata, built);
          setMatchdayData(built);
        } else {
          const cachedMd = !forceRefresh ? matchdayByNumRef.current.get(targetGiornata) : undefined;
          if (cachedMd) {
            setMatchdayData(cachedMd);
          } else {
            const md = await fetchOfficialMatchday(targetGiornata, forceRefresh);
            matchdayByNumRef.current.set(targetGiornata, md);
            setMatchdayData(md);
          }
        }
      } else if (tab === 'zonavar') {
        if (zonaVarRef.current && !forceRefresh) {
          return;
        }
        const res = await fetchOfficialZonaVarPublic(forceRefresh);
        zonaVarRef.current = res;
        setZonaVarData(res);
        // Popola anche i cache state locali se disponibili
        if (!standingsRef.current) {
          const builtStandings: AllStandingsResponse = {
            ok: true,
            meta: res.meta,
            series: res.standingsBySerie,
            availableSeriesCount: SERIE_ORDER.filter((k) => res.standingsBySerie[k]?.exists).length,
          };
          standingsRef.current = builtStandings;
          setStandingsData(builtStandings);
        }
        if (!superlegaRef.current && res.superlegaMain?.exists) {
          const builtSuperlega: SuperlegaAggregateResponse = {
            ok: true,
            meta: res.meta,
            mainData: res.superlegaMain,
          };
          superlegaRef.current = builtSuperlega;
          setSuperlegaData(builtSuperlega);
        }
      }
    } catch (err) {
      if (err instanceof OfficialBridgeError) {
        setErrorInfo({ code: err.code, message: err.message });
      } else {
        setErrorInfo({
          code: 'UNKNOWN_ERROR',
          message:
            err instanceof Error ? err.message : 'Impossibile caricare i dati ufficiali FICUP.',
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTabData(activeTab, false);
  }, [activeTab, selectedGiornata, loadTabData]);

  useEffect(() => {
    const pending = consumePendingOfficialTab();
    if (pending) {
      setActiveTab(pending);
    }
    const handleTabSelect = (event: Event) => {
      const detail = (event as CustomEvent<OfficialTab>).detail;
      if (
        detail === 'classifiche' ||
        detail === 'superlega' ||
        detail === 'giornate' ||
        detail === 'zonavar'
      ) {
        consumePendingOfficialTab();
        setActiveTab(detail);
      }
    };
    window.addEventListener('ficup:select-official-tab', handleTabSelect);
    return () => window.removeEventListener('ficup:select-official-tab', handleTabSelect);
  }, []);

  const currentStanding = standingsData?.series[selectedSerie] ?? null;

  const cumulativeTop10 = useMemo(() => {
    return superlegaData?.mainData.cumulativeTop10 ?? [];
  }, [superlegaData]);

  const filteredZonaVarClubs = useMemo(() => {
    if (!zonaVarData) return [];
    const term = clubSearch.trim().toLowerCase();
    return zonaVarData.clubs
      .filter((c) => !c.isHiddenInZonaVar)
      .filter((c) => {
        const cat = c.sportCategory ?? 'REGOLARE';
        return cat === 'ALLARME_ROSSO' || cat === 'ATTENZIONE' || cat === 'SOTTO_OSSERVAZIONE';
      })
      .filter((c) => {
        if (!term) return true;
        return (
          c.nome.toLowerCase().includes(term) ||
          c.serie.toLowerCase().includes(term) ||
          (c.serieKey && c.serieKey.toLowerCase().includes(term))
        );
      });
  }, [zonaVarData, clubSearch]);

  const selectableCount = useMemo(() => {
    if (!zonaVarData) return 0;
    return zonaVarData.clubs.filter(
      (c) =>
        (c.sportCategory ?? 'REGOLARE') === 'ALLARME_ROSSO' &&
        c.availabilityStatus === 'LIBERA' &&
        !c.isHiddenInZonaVar &&
        !c.isBlockedInZonaVar
    ).length;
  }, [zonaVarData]);

  const matchdayMatches = useMemo(() => {
    return matchdayData?.document.matches ?? [];
  }, [matchdayData]);

  const handlePrevGiornata = () => {
    const idx = availableGiornate.indexOf(selectedGiornata);
    if (idx > 0) {
      setSelectedGiornata(availableGiornate[idx - 1]);
    }
  };

  const handleNextGiornata = () => {
    const idx = availableGiornate.indexOf(selectedGiornata);
    if (idx >= 0 && idx < availableGiornate.length - 1) {
      setSelectedGiornata(availableGiornate[idx + 1]);
    }
  };

  return (
    <section
      id="classifiche"
      className="scroll-mt-16 w-full max-w-full bg-slate-50/70 border-b border-slate-200 py-8 sm:py-14 px-2 sm:px-4 lg:px-6"
    >
      <div className="w-full max-w-full space-y-6">
        {/* Header Sezione Classifiche: compatto, full-width, zero margini sprecati */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#0B1F4D] text-[#C69214] text-[10px] sm:text-xs font-bold tracking-wider uppercase">
              <Trophy className="w-3 h-3" />
              <span>Lega Nazionale FICUP · Classifiche Ufficiali</span>
            </div>
            <h2 className="font-display text-xl sm:text-2xl lg:text-3xl font-black text-[#0B1F4D] tracking-tight">
              Classifiche & Zona VAR
            </h2>
            <p className="text-xs text-slate-600">
              Graduatorie complete Serie A, Serie B, Lega Pro, Superlega Top 10 e disponibilità squadre.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => loadTabData(activeTab, true)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-bold text-[#0B1F4D] hover:bg-slate-50 shadow-2xs active:scale-95 transition-all cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#C69214] ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Sincronizzazione...' : 'Aggiorna'}</span>
            </button>
          </div>
        </div>

        {/* Tab di Navigazione Principale a Tutta Larghezza (4 pulsanti orizzontali senza scroll) */}
        <div className="grid grid-cols-4 gap-1 sm:gap-2 w-full p-1 rounded-xl bg-slate-200/80 border border-slate-300">
          <button
            type="button"
            onClick={() => setActiveTab('classifiche')}
            className={`py-2 px-1 sm:px-3 rounded-lg text-[11px] sm:text-sm font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 cursor-pointer text-center leading-tight ${
              activeTab === 'classifiche'
                ? 'bg-[#0B1F4D] text-white shadow-xs'
                : 'text-slate-700 hover:text-[#0B1F4D] hover:bg-white/50'
            }`}
          >
            <Trophy className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'classifiche' ? 'text-[#C69214]' : 'text-slate-500'}`} />
            <span className="whitespace-normal sm:whitespace-nowrap">Serie</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('superlega')}
            className={`py-2 px-1 sm:px-3 rounded-lg text-[11px] sm:text-sm font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 cursor-pointer text-center leading-tight ${
              activeTab === 'superlega'
                ? 'bg-[#0B1F4D] text-white shadow-xs'
                : 'text-slate-700 hover:text-[#0B1F4D] hover:bg-white/50'
            }`}
          >
            <Award className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'superlega' ? 'text-[#C69214]' : 'text-slate-500'}`} />
            <span className="whitespace-normal sm:whitespace-nowrap">Superlega</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('giornate')}
            className={`py-2 px-1 sm:px-3 rounded-lg text-[11px] sm:text-sm font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 cursor-pointer text-center leading-tight ${
              activeTab === 'giornate'
                ? 'bg-[#0B1F4D] text-white shadow-xs'
                : 'text-slate-700 hover:text-[#0B1F4D] hover:bg-white/50'
            }`}
          >
            <CalendarDays className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'giornate' ? 'text-[#C69214]' : 'text-slate-500'}`} />
            <span className="whitespace-normal sm:whitespace-nowrap">Giornate</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('zonavar')}
            className={`py-2 px-1 sm:px-3 rounded-lg text-[11px] sm:text-sm font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 cursor-pointer text-center leading-tight ${
              activeTab === 'zonavar'
                ? 'bg-[#0B1F4D] text-white shadow-xs'
                : 'text-slate-700 hover:text-[#0B1F4D] hover:bg-white/50'
            }`}
          >
            <Shield className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'zonavar' ? 'text-[#C69214]' : 'text-slate-500'}`} />
            <span className="whitespace-normal sm:whitespace-nowrap">Zona VAR</span>
          </button>
        </div>

        {/* Notifica di errore Firestore (se presente) */}
        {errorInfo && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-red-900 text-xs">
            <div className="flex items-start gap-2.5 flex-1">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="space-y-1 flex-1">
                <p className="font-bold">Avviso sincronizzazione Firestore</p>
                <p className="text-red-700">{errorInfo.message}</p>
              </div>
            </div>
            <button
              type="button"
              disabled={loading}
              onClick={() => loadTabData(activeTab, true)}
              className="min-h-[34px] px-3.5 py-1.5 rounded-lg bg-white border border-red-300 text-xs font-bold text-red-900 hover:bg-red-100 disabled:opacity-50 cursor-pointer shrink-0 self-start sm:self-auto"
            >
              Riprova
            </button>
          </div>
        )}

        {/* Loading Spinner */}
        {loading && (
          <div className="py-12 text-center space-y-2">
            <Loader2 className="w-6 h-6 text-[#0B1F4D] animate-spin mx-auto" />
            <p className="text-xs font-semibold text-slate-600">Sincronizzazione dati ufficiali...</p>
          </div>
        )}

        {/* =====================================================================
            TAB 1: CLASSIFICHE SERIE (Full-Width, Zero Scroll Orizzontale)
           ===================================================================== */}
        {activeTab === 'classifiche' && !loading && (
          <div className="space-y-4 w-full">
            {/* Selettore Rapido delle Serie (Pills che vanno a capo fluidamente) */}
            <div className="flex flex-wrap items-center gap-1.5 w-full">
              {SERIE_ORDER.map((sk) => {
                const isSelected = selectedSerie === sk;
                return (
                  <button
                    key={sk}
                    type="button"
                    onClick={() => setSelectedSerie(sk)}
                    className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-[#0B1F4D] text-white shadow-xs ring-2 ring-[#C69214]/60'
                        : 'bg-white text-slate-700 border border-slate-300 hover:border-[#C69214]'
                    }`}
                  >
                    <span>{SERIE_LABELS[sk]}</span>
                    {standingsData?.series[sk]?.rows && (
                      <span
                        className={`text-[10px] font-mono-tabular px-1.5 py-0.2 rounded-full ${
                          isSelected ? 'bg-[#C69214] text-[#071436]' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {standingsData.series[sk].rows.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Intestazione e Specifiche Ultime 3 Giornate */}
            <div className="rounded-xl bg-amber-50/80 border border-amber-200/80 px-3.5 py-2.5 text-xs text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="font-bold flex items-center gap-1.5 text-[#0B1F4D]">
                <Trophy className="w-4 h-4 text-[#C69214]" />
                <span>Tutti i Punteggi (116 Squadre) · Specifiche delle Ultime 3 Giornate</span>
              </span>
              <span className="text-[11px] font-mono-tabular text-amber-900">
                Graduatoria e trend recente
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 px-1 text-xs text-slate-500 font-mono-tabular">
              <span className="font-bold text-[#0B1F4D] uppercase tracking-wide">
                {SERIE_LABELS[selectedSerie]} · Stagione Ufficiale
              </span>
              {currentStanding?.updatedAt && (
                <span>Aggiornato: {formatIsoDate(currentStanding.updatedAt)}</span>
              )}
            </div>

            {/* Righe Classifica Continue Full-Width (Adattive su Smartphone, Zero Scroll Orizzontale) */}
            {!currentStanding || currentStanding.rows.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-600">
                Nessun dato registrato al momento per {SERIE_LABELS[selectedSerie]}.
              </div>
            ) : (
              <div className="w-full divide-y divide-slate-200/90 border-t border-b border-slate-200">
                {currentStanding.rows.map((row, idx) => {
                  const isFirst = row.pos === 1 || idx === 0;
                  const isSecond = row.pos === 2 || idx === 1;
                  const isThird = row.pos === 3 || idx === 2;

                  return (
                    <div
                      key={`${row.pos}-${row.squadra}`}
                      className={`w-full py-2.5 px-2 flex items-center justify-between gap-2.5 transition-colors ${
                        isFirst ? 'bg-amber-50/50' : isSecond ? 'bg-slate-100/50' : isThird ? 'bg-amber-100/20' : 'hover:bg-slate-100/40'
                      }`}
                    >
                      {/* Posizione Podio Badge */}
                      <div className="w-7 sm:w-8 text-center shrink-0">
                        {isFirst ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-lg text-xs font-black text-[#071436] bg-gradient-to-br from-[#D4AF37] to-[#C69214] shadow-xs">
                            1
                          </span>
                        ) : isSecond ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-lg text-xs font-black text-slate-800 bg-gradient-to-br from-slate-200 to-slate-400 shadow-xs">
                            2
                          </span>
                        ) : isThird ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-lg text-xs font-black text-white bg-gradient-to-br from-amber-600 to-amber-800 shadow-xs">
                            3
                          </span>
                        ) : (
                          <span className="font-mono-tabular text-xs font-bold text-slate-600">
                            {row.pos}
                          </span>
                        )}
                      </div>

                      {/* Nome Squadra e Statistiche Compatte Integrate Verticalmente */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-display text-xs sm:text-sm font-extrabold text-[#0B1F4D] truncate">
                            {row.squadra}
                          </span>
                          {isFirst && (
                            <Trophy className="w-3.5 h-3.5 text-[#C69214] shrink-0" />
                          )}
                        </div>
                        {/* Riga di statistiche fluida: sempre visibile senza scroll orizzontale */}
                        <div className="font-mono-tabular text-[10px] sm:text-xs text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                          <span>{row.g}G</span>
                          <span className="text-slate-400">·</span>
                          <span className="text-emerald-700 font-semibold">{row.v}V</span>
                          <span className="text-amber-700 font-semibold">{row.n}N</span>
                          <span className="text-rose-700 font-semibold">{row.p}P</span>
                          <span className="text-slate-400">·</span>
                          <span>GF {row.gf} GS {row.gs}</span>
                          <span className="text-slate-400">·</span>
                          <span className={row.dr > 0 ? 'text-emerald-700 font-bold' : row.dr < 0 ? 'text-rose-700 font-bold' : 'text-slate-600'}>
                            DR {row.dr > 0 ? `+${row.dr}` : row.dr}
                          </span>
                          <span className="text-slate-400 hidden xs:inline">·</span>
                          <span className="hidden xs:inline text-slate-600">Tot {row.ptTotali}</span>
                        </div>
                      </div>

                      {/* Punti in Grande Risalto */}
                      <div className="text-right shrink-0 font-mono-tabular">
                        <div className="text-base sm:text-xl font-black text-[#0B1F4D] leading-none">
                          {row.pt}
                        </div>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-[#C69214]">
                          PT
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* =====================================================================
            TAB 2: SUPERLEGA TOP 10 CUMULATIVA (Full-Width, Zero Scroll)
           ===================================================================== */}
        {activeTab === 'superlega' && !loading && superlegaData && (
          <div className="space-y-4 w-full">
            <div className="flex items-center justify-between gap-2 px-1 text-xs text-slate-500 font-mono-tabular">
              <span className="font-bold text-[#0B1F4D] uppercase tracking-wide">
                SUPERLEGA TOP 10 GENERALE CUMULATIVA
              </span>
              {superlegaData.mainData.updatedAt && (
                <span>Aggiornato: {formatIsoDate(superlegaData.mainData.updatedAt)}</span>
              )}
            </div>

            {cumulativeTop10.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-600">
                Nessun dato cumulativo Superlega Top 10 disponibile.
              </div>
            ) : (
              <div className="w-full divide-y divide-slate-200/90 border-t border-b border-slate-200">
                {cumulativeTop10.map((row) => {
                  const isFirst = row.pos === 1;
                  const isSecond = row.pos === 2;
                  const isThird = row.pos === 3;

                  return (
                    <div
                      key={`${row.pos}-${row.fantasquadra}-${row.serie}`}
                      className={`w-full py-2.5 px-2 flex items-center justify-between gap-2.5 transition-colors ${
                        isFirst ? 'bg-amber-50/50' : 'hover:bg-slate-100/40'
                      }`}
                    >
                      {/* Badge Posizione */}
                      <div className="w-7 sm:w-8 text-center shrink-0">
                        <span
                          className={`inline-flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-lg text-xs font-black ${
                            isFirst
                              ? 'bg-[#C69214] text-[#071436] shadow-xs'
                              : isSecond
                              ? 'bg-slate-300 text-slate-900 shadow-xs'
                              : isThird
                              ? 'bg-amber-700 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {row.pos}
                        </span>
                      </div>

                      {/* Nome Fantasquadra e Dati Integrati */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-display text-xs sm:text-sm font-extrabold text-[#0B1F4D] truncate">
                            {row.fantasquadra}
                          </span>
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-slate-200/80 text-slate-700">
                            {row.serie}
                          </span>
                          {isFirst && <Flame className="w-3.5 h-3.5 text-[#C69214] shrink-0" />}
                        </div>
                        <div className="font-mono-tabular text-[10px] sm:text-xs text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                          <span>{row.golTotali} gol</span>
                          <span className="text-slate-400">·</span>
                          <span>Med {row.mediaPunteggio.toFixed(1)}</span>
                          <span className="text-slate-400">·</span>
                          <span className="text-[#C69214] font-semibold">Max {row.migliorPunteggio.toFixed(1)}</span>
                          <span className="text-slate-400">·</span>
                          <span>{row.giornateGiocate} Giornate</span>
                        </div>
                      </div>

                      {/* Punti Totali */}
                      <div className="text-right shrink-0 font-mono-tabular">
                        <div className="text-base sm:text-xl font-black text-[#0B1F4D] leading-none">
                          {row.punteggioTotale.toFixed(1)}
                        </div>
                        <span className="text-[9px] font-bold text-slate-500">
                          {row.presenzeTop10}x TOP10
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* =====================================================================
            TAB 3: SINGOLE GIORNATE (Selettore a Tendina Compatto, Zero Scroll)
           ===================================================================== */}
        {activeTab === 'giornate' && !loading && matchdayData && (
          <div className="space-y-4 w-full">
            {/* Selettore Compatto a Tendina con Frecce Prev / Next (Sostituisce la barra orizzontale) */}
            <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white border border-slate-300">
              <button
                type="button"
                onClick={handlePrevGiornata}
                disabled={availableGiornate.indexOf(selectedGiornata) <= 0}
                aria-label="Giornata precedente"
                className="w-9 h-9 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-700 disabled:opacity-30 cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div className="flex-1 text-center">
                <select
                  value={selectedGiornata}
                  onChange={(e) => setSelectedGiornata(Number(e.target.value))}
                  aria-label="Seleziona giornata"
                  className="w-full text-center font-display font-extrabold text-xs sm:text-sm text-[#0B1F4D] bg-transparent py-1 cursor-pointer focus:outline-none"
                >
                  {availableGiornate.map((g) => (
                    <option key={g} value={g}>
                      Giornata {g} (Risultati Ufficiali)
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={handleNextGiornata}
                disabled={availableGiornate.indexOf(selectedGiornata) >= availableGiornate.length - 1}
                aria-label="Giornata successiva"
                className="w-9 h-9 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-700 disabled:opacity-30 cursor-pointer"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Risultati della Giornata */}
            {!matchdayData.document.exists ? (
              <div className="py-8 text-center text-xs text-slate-600">
                Nessun punteggio disponibile per la Giornata {selectedGiornata}.
              </div>
            ) : (
              <div className="space-y-5 w-full">
                {/* Top 10 della Giornata */}
                <div className="space-y-2">
                  <h3 className="font-display text-xs sm:text-sm font-extrabold text-[#0B1F4D] uppercase tracking-wider flex items-center gap-1.5 px-1">
                    <Trophy className="w-3.5 h-3.5 text-[#C69214]" />
                    <span>Top 10 Giornata {selectedGiornata}</span>
                  </h3>
                  <div className="w-full divide-y divide-slate-200 border-t border-b border-slate-200">
                    {matchdayData.document.top10.map((item, idx) => (
                      <div
                        key={`${asStringField(item.fantasquadra ?? item.squadra, String(idx))}-${idx}`}
                        className="py-2 px-2 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-5 h-5 rounded bg-[#0B1F4D] text-[#C69214] font-mono-tabular font-bold flex items-center justify-center text-[10px] shrink-0">
                            {asStringField(item.pos, String(idx + 1))}
                          </span>
                          <span className="font-bold text-[#0B1F4D] truncate">
                            {asStringField(item.fantasquadra ?? item.squadra, '—')}
                          </span>
                          {typeof item.serie === 'string' && (
                            <span className="text-[10px] text-slate-500">{item.serie}</span>
                          )}
                        </div>
                        <span className="font-mono-tabular font-black text-[#0B1F4D] shrink-0">
                          {asStringField(item.punteggio ?? item.pt, '—')} pt
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tutti i Punteggi Giornata */}
                {matchdayData.document.allResults.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-display text-xs sm:text-sm font-extrabold text-[#0B1F4D] uppercase tracking-wider flex items-center gap-1.5 px-1">
                      <Users className="w-3.5 h-3.5 text-[#0284C7]" />
                      <span>Tutti i Punteggi ({matchdayData.document.allResults.length} Squadre)</span>
                    </h3>
                    <div className="w-full max-h-72 overflow-y-auto divide-y divide-slate-200 border-t border-b border-slate-200 pr-1">
                      {matchdayData.document.allResults.map((res, idx) => (
                        <div
                          key={`${res.fantasquadra}-${idx}`}
                          className="py-1.5 px-2 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0">
                            <span className="font-semibold text-[#0B1F4D] truncate block">
                              {res.fantasquadra}
                            </span>
                            <span className="text-[10px] text-slate-500">{res.serie || 'FICUP'}</span>
                          </div>
                          <div className="text-right font-mono-tabular shrink-0">
                            <span className="font-bold text-[#0B1F4D]">{res.punteggio} pt</span>
                            <span className="text-[10px] text-slate-500 ml-1.5">({res.gol} gol)</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Partite Giornata */}
                {matchdayMatches.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-display text-xs sm:text-sm font-extrabold text-[#0B1F4D] uppercase tracking-wider flex items-center gap-1.5 px-1">
                      <CalendarDays className="w-3.5 h-3.5 text-[#C69214]" />
                      <span>Partite Disputate ({matchdayMatches.length})</span>
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {matchdayMatches.map((m, idx) => {
                        const home = asStringField(m.homeTeam ?? m.casa, '—');
                        const away = asStringField(m.awayTeam ?? m.trasferta, '—');
                        const res = asStringField(m.risultato ?? `${m.homeGoals ?? 0} - ${m.awayGoals ?? 0}`, '—');
                        return (
                          <div
                            key={`${home}-${away}-${idx}`}
                            className="p-2 rounded-lg bg-white border border-slate-200 text-xs flex items-center justify-between gap-2"
                          >
                            <span className="font-semibold text-[#0B1F4D] truncate flex-1">{home}</span>
                            <span className="px-2 py-0.5 rounded bg-[#0B1F4D] text-white font-mono-tabular font-bold shrink-0">
                              {res}
                            </span>
                            <span className="font-semibold text-[#0B1F4D] truncate flex-1 text-right">{away}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* =====================================================================
            TAB 4: SQUADRE & ZONA VAR PUBBLICA (Full-Width, Zero Scroll)
           ===================================================================== */}
        {activeTab === 'zonavar' && !loading && zonaVarData && (
          <div className="space-y-4 w-full">
            {/* Metriche Disponibilità Compatte */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full text-center">
              <div className="p-2.5 rounded-xl bg-white border border-slate-300">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Totale</p>
                <p className="text-lg sm:text-xl font-black text-[#0B1F4D] font-mono-tabular">
                  {zonaVarData.clubsSummary.totalClubs}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-300">
                <p className="text-[10px] font-bold text-emerald-800 uppercase flex items-center justify-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Selezionabili</span>
                </p>
                <p className="text-lg sm:text-xl font-black text-emerald-800 font-mono-tabular">
                  {selectableCount}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300">
                <p className="text-[10px] font-bold text-amber-800 uppercase flex items-center justify-center gap-1">
                  <Lock className="w-3 h-3" />
                  <span>Bloccate</span>
                </p>
                <p className="text-lg sm:text-xl font-black text-amber-800 font-mono-tabular">
                  {zonaVarData.clubsSummary.blockedClubsCount}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-300">
                <p className="text-[10px] font-bold text-slate-600 uppercase">Nascoste</p>
                <p className="text-lg sm:text-xl font-black text-slate-700 font-mono-tabular">
                  {zonaVarData.clubsSummary.hiddenClubsCount}
                </p>
              </div>
            </div>

            {/* Barra di Ricerca Squadra */}
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={clubSearch}
                onChange={(e) => setClubSearch(e.target.value)}
                placeholder="Cerca squadra o serie..."
                className="w-full min-h-[40px] pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B1F4D]"
              />
            </div>

            {/* Lista Squadre in Formato Griglia Continua */}
            {filteredZonaVarClubs.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500">
                Nessuna squadra trovata con il filtro specificato.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 w-full">
                {filteredZonaVarClubs.map((club) => {
                  const isLibera = club.availabilityStatus === 'LIBERA';
                  const sportCategory = club.sportCategory ?? 'REGOLARE';
                  const isHiddenOrBlocked = club.isHiddenInZonaVar || club.isBlockedInZonaVar || club.availabilityStatus === 'NASCOSTA' || club.availabilityStatus === 'BLOCCATA';

                  let eligibilityLabel = '';
                  let eligibilityStyle = '';
                  if (sportCategory === 'ALLARME_ROSSO' && isLibera && !isHiddenOrBlocked) {
                    eligibilityLabel = 'SELEZIONABILE';
                    eligibilityStyle = 'bg-emerald-50 text-emerald-800 border-emerald-300';
                  } else if ((sportCategory === 'ATTENZIONE' || sportCategory === 'SOTTO_OSSERVAZIONE') && isLibera && !isHiddenOrBlocked) {
                    eligibilityLabel = 'SBLOCCO STAFF NECESSARIO';
                    eligibilityStyle = 'bg-amber-50 text-amber-900 border-amber-300';
                  } else {
                    eligibilityLabel = 'NON SELEZIONABILE';
                    eligibilityStyle = 'bg-slate-100 text-slate-600 border-slate-300';
                  }

                  let rightBadgeLabel: string = club.availabilityStatus;
                  let rightBadgeStyle = isLibera ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900';

                  if (sportCategory === 'ALLARME_ROSSO') {
                    if (isLibera && !isHiddenOrBlocked) {
                      rightBadgeLabel = 'SELEZIONABILE';
                      rightBadgeStyle = 'bg-emerald-100 text-emerald-800';
                    } else if (club.availabilityStatus === 'BLOCCATA') {
                      rightBadgeLabel = 'BLOCCATA';
                      rightBadgeStyle = 'bg-amber-100 text-amber-900';
                    } else if (club.availabilityStatus === 'NASCOSTA') {
                      rightBadgeLabel = 'NASCOSTA';
                      rightBadgeStyle = 'bg-slate-200 text-slate-700';
                    }
                  } else if (sportCategory === 'ATTENZIONE' || sportCategory === 'SOTTO_OSSERVAZIONE') {
                    if (club.availabilityStatus === 'BLOCCATA') {
                      rightBadgeLabel = 'BLOCCATA';
                      rightBadgeStyle = 'bg-amber-100 text-amber-900';
                    } else if (club.availabilityStatus === 'NASCOSTA') {
                      rightBadgeLabel = 'NASCOSTA';
                      rightBadgeStyle = 'bg-slate-200 text-slate-700';
                    } else {
                      rightBadgeLabel = 'SBLOCCO STAFF';
                      rightBadgeStyle = 'bg-amber-100 text-amber-900';
                    }
                  }

                  return (
                    <div
                      key={club.id || club.clubId || club.nome}
                      className="p-3 rounded-xl bg-white border border-slate-200 flex flex-col gap-2 text-xs min-w-0"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-[#0B1F4D] truncate">{club.nome}</p>
                          <p className="text-[10px] text-slate-500 truncate">
                            {club.serie}
                            {club.standingPos !== null ? ` · ${club.standingPos}° pos` : ''}
                            {club.clubId || club.id ? ` · ID: ${club.clubId || club.id}` : ''}
                          </p>
                        </div>
                        <span
                          className={`text-[9px] font-mono-tabular font-bold px-2 py-0.5 rounded-full shrink-0 ${rightBadgeStyle}`}
                        >
                          {rightBadgeLabel}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
                        {sportCategory === 'ALLARME_ROSSO' && (
                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-red-100 text-red-800 border border-red-200">
                            ALLARME ROSSO
                          </span>
                        )}
                        {sportCategory === 'ATTENZIONE' && (
                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                            ATTENZIONE
                          </span>
                        )}
                        {sportCategory === 'SOTTO_OSSERVAZIONE' && (
                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 border border-sky-200">
                            SOTTO OSSERVAZIONE
                          </span>
                        )}

                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${eligibilityStyle}`}>
                          {eligibilityLabel}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
