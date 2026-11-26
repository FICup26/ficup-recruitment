import {
  AlertCircle,
  CheckCircle2,
  Database,
  EyeOff,
  Info,
  Loader2,
  Lock,
  RefreshCw,
  Search,
  Server,
  ShieldAlert,
  ShieldBan,
  Trophy,
  Unlock,
  UserCheck,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { auth, firebaseConfigStatus } from '../lib/firebase';
import {
  blockTeamInPortalZonaVar,
  sanitizePortalLockId,
  unblockTeamInPortalZonaVar,
} from '../lib/firestore';
import {
  clearOfficialClientCache,
  fetchOfficialZonaVarPublic,
  fetchStaffZonaVarData,
  OfficialBridgeError,
  SERIE_LABELS,
  type AllowedSerieKey,
  type AvailabilityStatus,
  type StaffZonaVarResponse,
  type ZonaVarAnnotatedClub,
  type ZonaVarSportCategory,
} from '../lib/officialFicupClient';

const SERIE_ORDER: AllowedSerieKey[] = [
  'serie_a',
  'serie_b',
  'lega_pro_a',
  'lega_pro_b',
  'lega_pro_c',
];

const STATUS_BADGE_MAP: Record<
  AvailabilityStatus,
  { label: string; className: string }
> = {
  LIBERA: {
    label: 'Libera',
    className: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  },
  BLOCCATA: {
    label: 'Bloccata',
    className: 'bg-red-50 border-red-200 text-red-800',
  },
  NASCOSTA: {
    label: 'Nascosta',
    className: 'bg-amber-50 border-amber-200 text-amber-900',
  },
  ASSEGNATA: {
    label: 'Assegnata',
    className: 'bg-sky-50 border-sky-200 text-sky-900',
  },
  DA_VERIFICARE: {
    label: 'Da verificare',
    className: 'bg-slate-100 border-slate-300 text-slate-700',
  },
};

const SPORT_CATEGORY_BADGE_MAP: Record<
  ZonaVarSportCategory,
  { label: string; className: string } | null
> = {
  ALLARME_ROSSO: {
    label: 'ALLARME ROSSO',
    className: 'bg-red-100 border-red-300 text-red-900',
  },
  ATTENZIONE: {
    label: 'ATTENZIONE',
    className: 'bg-amber-100 border-amber-300 text-amber-900',
  },
  SOTTO_OSSERVAZIONE: {
    label: 'SOTTO OSSERVAZIONE',
    className: 'bg-sky-100 border-sky-300 text-sky-900',
  },
  REGOLARE: null,
};

function formatDateIso(iso: string | null): string {
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

export function AdminZonaVarSection() {
  const [data, setData] = useState<StaffZonaVarResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorInfo, setErrorInfo] = useState<{ code: string; message: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [serieFilter, setSerieFilter] = useState<'TUTTE' | AllowedSerieKey>('TUTTE');
  const [categoryFilter, setCategoryFilter] = useState<
    'CRITICHE' | 'ALLARME_ROSSO' | 'ATTENZIONE' | 'SOTTO_OSSERVAZIONE' | 'TUTTE'
  >('CRITICHE');
  const [statusFilter, setStatusFilter] = useState<'TUTTE' | 'SELEZIONABILI' | AvailabilityStatus>('TUTTE');
  const [selectedStandingSerie, setSelectedStandingSerie] = useState<AllowedSerieKey>('serie_a');
  const [blockTargetClub, setBlockTargetClub] = useState<ZonaVarAnnotatedClub | null>(null);
  const [blockReason, setBlockReason] = useState('Squadra già occupata / assegnata');
  const [actionBusyLockId, setActionBusyLockId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const loadLiveZonaVar = useCallback(async (bypassCache = false) => {
    setLoading(true);
    setErrorInfo(null);
    try {
      const currentUser = auth?.currentUser;
      if (!currentUser) {
        throw new OfficialBridgeError(
          'Sessione amministratore non disponibile per verificare il token.',
          'UNAUTHORIZED',
          401
        );
      }
      const idToken = await currentUser.getIdToken();
      try {
        const res = await fetchStaffZonaVarData(idToken, bypassCache);
        setData(res);
      } catch (bridgeErr) {
        const isUnavailable =
          bridgeErr instanceof OfficialBridgeError &&
          (bridgeErr.code === 'FUNCTIONS_URL_NOT_CONFIGURED' ||
            bridgeErr.code === 'NOT_DEPLOYED_OR_UNREACHABLE' ||
            bridgeErr.status === 404);
        if (!isUnavailable) {
          throw bridgeErr;
        }
        const fallback = await fetchOfficialZonaVarPublic(bypassCache);
        setData({
          ...fallback,
          authorizedAdmin: {
            ruolo: 'STAFF',
            nome: currentUser.displayName || currentUser.email || 'Staff',
          },
        });
      }
    } catch (err) {
      if (err instanceof OfficialBridgeError) {
        setErrorInfo({ code: err.code, message: err.message });
      } else {
        setErrorInfo({
          code: 'UNKNOWN_ERROR',
          message: err instanceof Error ? err.message : 'Errore nel caricamento dati Zona VAR.',
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLiveZonaVar(false);
  }, [loadLiveZonaVar]);

  const resolveClubLockId = useCallback((club: ZonaVarAnnotatedClub): string => {
    if (club.lockId && club.lockId.trim()) {
      return sanitizePortalLockId(club.lockId);
    }
    const rawSlug =
      club.clubId || club.id || club.linkedClassificaKey || club.nomeClub || club.nome;
    return sanitizePortalLockId(`club_${rawSlug}`);
  }, []);

  const handleConfirmBlockClub = async () => {
    if (!blockTargetClub) return;
    const currentUser = auth?.currentUser;
    if (!currentUser) {
      setActionFeedback({
        type: 'error',
        message: 'Sessione staff non disponibile. Effettua nuovamente l’accesso.',
      });
      return;
    }

    const lockId = resolveClubLockId(blockTargetClub);
    setActionBusyLockId(lockId);
    setActionFeedback(null);

    try {
      await blockTeamInPortalZonaVar({
        lockId,
        clubId: blockTargetClub.clubId || blockTargetClub.id || lockId,
        normalizedKey: blockTargetClub.normalizedKey || lockId,
        nomeSquadra: blockTargetClub.nome,
        serie: blockTargetClub.serie || blockTargetClub.serieKey,
        serieKey: blockTargetClub.serieKey,
        motivo: blockReason,
        adminUser: currentUser,
      });
      clearOfficialClientCache();
      setBlockTargetClub(null);
      await loadLiveZonaVar(true);
      setActionFeedback({
        type: 'success',
        message: `Squadra "${blockTargetClub.nome}" bloccata: non è più selezionabile dagli utenti né inclusa nelle inserzioni.`,
      });
    } catch (err) {
      setActionFeedback({
        type: 'error',
        message:
          err instanceof Error
            ? err.message
            : 'Impossibile bloccare la squadra sul portale.',
      });
    } finally {
      setActionBusyLockId(null);
    }
  };

  const handleUnblockClub = async (club: ZonaVarAnnotatedClub) => {
    const lockId = resolveClubLockId(club);
    setActionBusyLockId(lockId);
    setActionFeedback(null);

    try {
      await unblockTeamInPortalZonaVar(lockId);
      clearOfficialClientCache();
      await loadLiveZonaVar(true);
      setActionFeedback({
        type: 'success',
        message: `Blocco portale rimosso per "${club.nome}". La disponibilità segue ora i dati ufficiali FICUP.`,
      });
    } catch (err) {
      setActionFeedback({
        type: 'error',
        message:
          err instanceof Error
            ? err.message
            : 'Impossibile sbloccare la squadra sul portale.',
      });
    } finally {
      setActionBusyLockId(null);
    }
  };

  const isClubSelectable = useCallback((club: StaffZonaVarResponse['clubs'][number]) => {
    return (
      (club.sportCategory ?? 'REGOLARE') === 'ALLARME_ROSSO' &&
      club.availabilityStatus === 'LIBERA' &&
      club.isSelectable &&
      !club.isHiddenInZonaVar &&
      !club.isBlockedInZonaVar
    );
  }, []);

  const zonaVarStats = useMemo(() => {
    const emptyBySerie: Record<AllowedSerieKey, number> = {
      serie_a: 0,
      serie_b: 0,
      lega_pro_a: 0,
      lega_pro_b: 0,
      lega_pro_c: 0,
    };
    if (!data) {
      return {
        selectableCount: 0,
        criticalCount: 0,
        redCount: 0,
        attentionCount: 0,
        observationCount: 0,
        selectableBySerie: emptyBySerie,
      };
    }
    let selectableCount = 0;
    let criticalCount = 0;
    let redCount = 0;
    let attentionCount = 0;
    let observationCount = 0;
    const selectableBySerie = { ...emptyBySerie };

    for (const club of data.clubs) {
      const cat = club.sportCategory ?? 'REGOLARE';
      if (cat === 'ALLARME_ROSSO') redCount += 1;
      else if (cat === 'ATTENZIONE') attentionCount += 1;
      else if (cat === 'SOTTO_OSSERVAZIONE') observationCount += 1;

      if (cat === 'ALLARME_ROSSO' || cat === 'ATTENZIONE' || cat === 'SOTTO_OSSERVAZIONE') {
        criticalCount += 1;
      }

      if (isClubSelectable(club)) {
        selectableCount += 1;
        if (club.serieKey in selectableBySerie) {
          selectableBySerie[club.serieKey as AllowedSerieKey] += 1;
        }
      }
    }

    return {
      selectableCount,
      criticalCount,
      redCount,
      attentionCount,
      observationCount,
      selectableBySerie,
    };
  }, [data, isClubSelectable]);

  const filteredClubs = useMemo(() => {
    if (!data) {
      return [];
    }
    const q = searchTerm.trim().toLowerCase();
    return data.clubs.filter((club) => {
      const cat = club.sportCategory ?? 'REGOLARE';
      if (categoryFilter === 'CRITICHE') {
        if (cat !== 'ALLARME_ROSSO' && cat !== 'ATTENZIONE' && cat !== 'SOTTO_OSSERVAZIONE') {
          return false;
        }
      } else if (categoryFilter !== 'TUTTE' && cat !== categoryFilter) {
        return false;
      }
      if (serieFilter !== 'TUTTE' && club.serieKey !== serieFilter) {
        return false;
      }
      if (statusFilter === 'SELEZIONABILI') {
        if (!isClubSelectable(club)) {
          return false;
        }
      } else if (statusFilter !== 'TUTTE' && club.availabilityStatus !== statusFilter) {
        return false;
      }
      if (!q) {
        return true;
      }
      return (
        club.nome.toLowerCase().includes(q) ||
        club.nomeClub.toLowerCase().includes(q) ||
        club.clubId.toLowerCase().includes(q) ||
        club.serie.toLowerCase().includes(q)
      );
    });
  }, [data, searchTerm, serieFilter, categoryFilter, statusFilter, isClubSelectable]);

  const currentStanding = data?.standingsBySerie[selectedStandingSerie] ?? null;

  return (
    <div className="space-y-6">
      {/* Header & Bridge Connection Status */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-widest text-[#C69214]">
              Fonte Ufficiale FICUP · Sola Lettura
            </p>
            <h2 className="font-display text-xl font-extrabold text-[#0B1F4D]">
              GESTIONE SQUADRE — ZONA VAR (SOLA LETTURA)
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Consultazione in tempo reale di <span className="font-mono-tabular">club_directory/public_list</span>, <span className="font-mono-tabular">classifiche_serie</span>, <span className="font-mono-tabular">superlega_top10</span> e <span className="font-mono-tabular">zonavar_public_state/current</span> dal progetto ufficiale <span className="font-mono-tabular">ficup-c9186</span> integrati con gli slot assegnati in <span className="font-mono-tabular">candidature-ficup</span>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <span
              className={`px-3 py-1.5 rounded-lg border text-xs font-mono-tabular font-bold ${
                data
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}
            >
              {data ? 'COLLEGATO (READ-ONLY)' : 'CARICAMENTO...'}
            </span>
            <button
              type="button"
              disabled={loading}
              onClick={() => loadLiveZonaVar(true)}
              className="min-h-[36px] px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-[#0B1F4D] hover:bg-slate-50 disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Aggiorna</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-1">
            <div className="flex items-center gap-2 font-bold text-[#0B1F4D]">
              <Database className="w-4 h-4 text-[#0284C7]" />
              <span>Progetto Portale &amp; Prenotazioni</span>
            </div>
            <p className="font-mono-tabular text-slate-700">
              Project ID: {firebaseConfigStatus.projectId || 'candidature-ficup'}
            </p>
            <p className="font-mono-tabular text-slate-500">
              Database: {firebaseConfigStatus.databaseId} · Auth Admin verificata
            </p>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-1">
            <div className="flex items-center gap-2 font-bold text-[#0B1F4D]">
              <Server className="w-4 h-4 text-[#C69214]" />
              <span>Progetto Sorgente Ufficiale</span>
            </div>
            <p className="font-mono-tabular text-slate-800 font-semibold">
              Project ID: ficup-c9186 · (default)
            </p>
            <p className="font-mono-tabular text-slate-600 inline-flex items-center gap-1">
              <Lock className="w-3.5 h-3.5 text-emerald-700" />
              <span>Sola lettura rigorosa (0 scritture su ficup-c9186)</span>
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-4 text-xs text-sky-950 space-y-1.5">
          <p className="font-bold text-[#0B1F4D] inline-flex items-center gap-1.5">
            <Info className="w-4 h-4 text-[#0284C7] shrink-0" />
            <span>Blocco immediato delle squadre occupate (lato portale)</span>
          </p>
          <p className="leading-relaxed text-sky-900">
            Quando un candidato sceglie una squadra selezionabile o la squadra viene assegnata dallo staff, puoi usare il pulsante <strong>Blocca per utenti</strong> nella tabella qui sotto: la squadra passa subito a stato <strong>BLOCCATA</strong> sul portale (<span className="font-mono-tabular">candidature-ficup</span>), sparisce dal Wizard di candidatura, dalla Zona VAR pubblica e da <strong>Crea Inserzione</strong>, senza modificare i dati dell&apos;app ufficiale FICUP (<span className="font-mono-tabular">ficup-c9186</span>). Puoi sbloccarla in qualsiasi momento se torna libera.
          </p>
        </div>

        {loading && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 flex items-center justify-center gap-2 text-xs sm:text-sm text-slate-600">
            <Loader2 className="w-4 h-4 animate-spin text-[#0B1F4D]" />
            <span>Lettura in corso dalle fonti ufficiali Zona VAR...</span>
          </div>
        )}

        {!loading && errorInfo && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm text-amber-950 leading-relaxed">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-[#C69214] shrink-0 mt-0.5" />
              <div className="space-y-1.5">
                <p className="font-bold text-[#0B1F4D]">
                  Impossibile caricare la Zona VAR ({errorInfo.code})
                </p>
                <p>{errorInfo.message}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => loadLiveZonaVar(true)}
              className="min-h-[36px] px-4 py-1.5 rounded-lg bg-white border border-amber-300 text-xs font-bold text-[#0B1F4D] hover:bg-amber-100 cursor-pointer shrink-0 self-start sm:self-auto"
            >
              Riprova
            </button>
          </div>
        )}
      </div>

      {/* Live Integrated Zona VAR Data */}
      {data && (
        <>
          {/* KPI Summary (Allineato alle regole Zona VAR) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <p className="text-xs font-medium text-slate-500">Totale Club</p>
              <p className="mt-1 text-2xl font-extrabold text-[#0B1F4D] font-mono-tabular">
                {data.clubsSummary.totalClubs}
              </p>
            </div>
            <div className="bg-white border border-emerald-200 rounded-2xl p-4">
              <p className="text-xs font-medium text-emerald-700">Selezionabili</p>
              <p className="mt-1 text-2xl font-extrabold text-emerald-700 font-mono-tabular">
                {zonaVarStats.selectableCount}
              </p>
            </div>
            <div className="bg-white border border-red-200 rounded-2xl p-4">
              <p className="text-xs font-medium text-red-700">Bloccate</p>
              <p className="mt-1 text-2xl font-extrabold text-red-700 font-mono-tabular">
                {data.clubsSummary.blockedClubsCount}
              </p>
            </div>
            <div className="bg-white border border-amber-200 rounded-2xl p-4">
              <p className="text-xs font-medium text-amber-800">Nascoste</p>
              <p className="mt-1 text-2xl font-extrabold text-amber-700 font-mono-tabular">
                {data.clubsSummary.hiddenClubsCount}
              </p>
            </div>
            <div className="bg-white border border-sky-200 rounded-2xl p-4">
              <p className="text-xs font-medium text-sky-800">Assegnate</p>
              <p className="mt-1 text-2xl font-extrabold text-sky-700 font-mono-tabular">
                {data.clubsSummary.assignedClubsCount}
              </p>
            </div>
            <div className="bg-white border border-slate-300 rounded-2xl p-4">
              <p className="text-xs font-medium text-slate-600">Criticità Zona VAR</p>
              <p className="mt-1 text-2xl font-extrabold text-slate-700 font-mono-tabular">
                {zonaVarStats.criticalCount}
              </p>
            </div>
          </div>

          {/* Squadre Selezionabili per Serie */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <p className="text-xs font-bold uppercase tracking-wider text-[#0B1F4D]">
                Disponibilità Subentri Selezionabili per Serie
              </p>
              <span className="text-xs font-mono-tabular font-bold text-emerald-700">
                Totale selezionabili (Allarme Rosso + Libera): {zonaVarStats.selectableCount}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {SERIE_ORDER.map((s) => (
                <div
                  key={s}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 flex items-center justify-between"
                >
                  <span className="text-xs font-semibold text-slate-700">{SERIE_LABELS[s]}</span>
                  <span className="font-mono-tabular text-sm font-extrabold text-[#0B1F4D]">
                    {zonaVarStats.selectableBySerie[s] ?? 0}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Club Directory + Zona VAR Flags */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                <h3 className="font-display text-base font-bold text-[#0B1F4D]">
                  Directory Ufficiale Squadre &amp; Verifica Zona VAR
                </h3>
              </div>
              <span className="text-xs font-mono-tabular text-slate-500">
                Agg. Zona VAR: {formatDateIso(data.zonaVarState.updatedAt)} · Cache:{' '}
                {data.meta.cacheHit ? 'HIT' : 'LIVE'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Cerca club, ID o serie..."
                  className="w-full min-h-[42px] pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm"
                />
              </div>

              <select
                aria-label="Filtra per categoria Zona VAR"
                value={categoryFilter}
                onChange={(e) =>
                  setCategoryFilter(
                    e.target.value as
                      | 'CRITICHE'
                      | 'ALLARME_ROSSO'
                      | 'ATTENZIONE'
                      | 'SOTTO_OSSERVAZIONE'
                      | 'TUTTE'
                  )
                }
                className="min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm font-medium text-slate-800"
              >
                <option value="CRITICHE">
                  Criticità Zona VAR ({zonaVarStats.criticalCount})
                </option>
                <option value="ALLARME_ROSSO">
                  Allarme Rosso ({zonaVarStats.redCount})
                </option>
                <option value="ATTENZIONE">
                  Attenzione ({zonaVarStats.attentionCount})
                </option>
                <option value="SOTTO_OSSERVAZIONE">
                  Sotto Osservazione ({zonaVarStats.observationCount})
                </option>
                <option value="TUTTE">
                  Directory Completa ({data.clubsSummary.totalClubs})
                </option>
              </select>

              <select
                aria-label="Filtra per serie"
                value={serieFilter}
                onChange={(e) => setSerieFilter(e.target.value as 'TUTTE' | AllowedSerieKey)}
                className="min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm font-medium text-slate-800"
              >
                <option value="TUTTE">Tutte le serie</option>
                {SERIE_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {SERIE_LABELS[s]}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filtra per stato disponibilità"
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(
                    e.target.value as 'TUTTE' | 'SELEZIONABILI' | AvailabilityStatus
                  )
                }
                className="min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm font-medium text-slate-800"
              >
                <option value="TUTTE">Tutti gli stati</option>
                <option value="SELEZIONABILI">
                  Solo Selezionabili ({zonaVarStats.selectableCount})
                </option>
                <option value="BLOCCATA">Bloccate ({data.clubsSummary.blockedClubsCount})</option>
                <option value="NASCOSTA">Nascoste ({data.clubsSummary.hiddenClubsCount})</option>
                <option value="ASSEGNATA">Assegnate ({data.clubsSummary.assignedClubsCount})</option>
                <option value="DA_VERIFICARE">
                  Da verificare ({data.clubsSummary.unverifiedClubsCount})
                </option>
              </select>
            </div>

            {actionFeedback && (
              <div
                className={`rounded-xl border p-3.5 text-xs flex items-start justify-between gap-3 ${
                  actionFeedback.type === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    : 'border-red-200 bg-red-50 text-red-900'
                }`}
              >
                <p className="leading-relaxed font-medium">{actionFeedback.message}</p>
                <button
                  type="button"
                  onClick={() => setActionFeedback(null)}
                  className="text-xs font-bold underline shrink-0 cursor-pointer"
                >
                  Chiudi
                </button>
              </div>
            )}

            {blockTargetClub && (
              <div className="rounded-xl border border-amber-300 bg-amber-50/80 p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-extrabold text-[#0B1F4D] uppercase tracking-wide">
                      Conferma blocco squadra per utenti
                    </p>
                    <p className="text-xs text-amber-950">
                      Stai bloccando <strong>{blockTargetClub.nome}</strong> ({blockTargetClub.serie || blockTargetClub.serieKey}). Non sarà più selezionabile nel Wizard né inclusa negli annunci.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    maxLength={300}
                    value={blockReason}
                    onChange={(e) => setBlockReason(e.target.value)}
                    placeholder="Motivo del blocco (es. Squadra già occupata / assegnata)"
                    className="flex-1 min-h-[40px] px-3 py-1.5 rounded-lg border border-amber-300 bg-white text-xs text-slate-900"
                  />
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={Boolean(actionBusyLockId)}
                      onClick={handleConfirmBlockClub}
                      className="min-h-[40px] px-4 py-1.5 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {actionBusyLockId ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ShieldBan className="w-3.5 h-3.5" />
                      )}
                      <span>Conferma Blocco</span>
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(actionBusyLockId)}
                      onClick={() => setBlockTargetClub(null)}
                      className="min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
                    >
                      Annulla
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-96 overflow-y-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                  <tr className="text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="py-2.5 px-3 font-bold">#</th>
                    <th className="py-2.5 px-3 font-bold">Squadra</th>
                    <th className="py-2.5 px-3 font-bold">Serie</th>
                    <th className="py-2.5 px-3 font-bold">Classifica</th>
                    <th className="py-2.5 px-3 font-bold">Stato Zona VAR</th>
                    <th className="py-2.5 px-3 font-bold text-right">Azioni Staff</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredClubs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-500">
                        Nessun club corrisponde ai filtri selezionati.
                      </td>
                    </tr>
                  ) : (
                    filteredClubs.map((club) => {
                      const badge =
                        STATUS_BADGE_MAP[club.availabilityStatus] ?? STATUS_BADGE_MAP.DA_VERIFICARE;
                      const sportCat = club.sportCategory ?? 'REGOLARE';
                      const sportBadge = SPORT_CATEGORY_BADGE_MAP[sportCat];
                      const isLibera = club.availabilityStatus === 'LIBERA';
                      const isHiddenOrBlocked =
                        club.isHiddenInZonaVar ||
                        club.isBlockedInZonaVar ||
                        club.availabilityStatus === 'NASCOSTA' ||
                        club.availabilityStatus === 'BLOCCATA';
                      const lockId = resolveClubLockId(club);
                      const isBusy = actionBusyLockId === lockId;
                      const isOfficialBlock =
                        (club.isBlockedInZonaVar || club.availabilityStatus === 'BLOCCATA') &&
                        !club.isBlockedByPortalStaff;

                      let eligibilityLabel = 'NON SELEZIONABILE';
                      let eligibilityStyle = 'bg-slate-100 border-slate-300 text-slate-600';
                      if (sportCat === 'ALLARME_ROSSO' && isLibera && !isHiddenOrBlocked && club.isSelectable) {
                        eligibilityLabel = 'SELEZIONABILE';
                        eligibilityStyle = 'bg-emerald-50 border-emerald-300 text-emerald-800';
                      } else if (
                        (sportCat === 'ATTENZIONE' || sportCat === 'SOTTO_OSSERVAZIONE') &&
                        isLibera &&
                        !isHiddenOrBlocked
                      ) {
                        eligibilityLabel = 'SBLOCCO STAFF NECESSARIO';
                        eligibilityStyle = 'bg-amber-50 border-amber-300 text-amber-900';
                      }

                      return (
                        <tr
                          key={`${club.serieKey}:${club.id || club.clubId || club.nome}`}
                          className="hover:bg-slate-50"
                        >
                          <td className="py-2.5 px-3 font-mono-tabular text-slate-500">
                            {club.numeroProgressivo ?? '—'}
                          </td>
                          <td className="py-2.5 px-3">
                            <p className="font-bold text-[#0B1F4D]">{club.nome}</p>
                            <p className="text-[11px] font-mono-tabular text-slate-500">
                              ID: {club.clubId || club.id || 'n.d.'}
                              {club.isSubentrato ? ' · Subentrato' : ''}
                            </p>
                          </td>
                          <td className="py-2.5 px-3 text-slate-700">
                            {club.serie || club.serieKey}
                          </td>
                          <td className="py-2.5 px-3 font-mono-tabular text-slate-700">
                            {club.standingPos !== null
                              ? `#${club.standingPos} · ${club.standingPt ?? 0} pt (${club.standingPtTotali ?? 0})`
                              : '—'}
                          </td>
                          <td className="py-2.5 px-3 space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {sportBadge ? (
                                <span
                                  className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-bold ${sportBadge.className}`}
                                >
                                  {sportBadge.label}
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-bold bg-slate-100 border-slate-300 text-slate-700">
                                  REGOLARE
                                </span>
                              )}

                              <span
                                className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-bold ${eligibilityStyle}`}
                              >
                                {eligibilityLabel}
                              </span>

                              {!isLibera && (
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold ${badge.className}`}
                                >
                                  {club.availabilityStatus === 'NASCOSTA' && (
                                    <EyeOff className="w-3 h-3" />
                                  )}
                                  {club.availabilityStatus === 'ASSEGNATA' && (
                                    <UserCheck className="w-3 h-3" />
                                  )}
                                  {club.availabilityStatus === 'DA_VERIFICARE' && (
                                    <AlertCircle className="w-3 h-3" />
                                  )}
                                  <span>
                                    {club.isBlockedByPortalStaff ? 'Bloccata da Staff' : badge.label}
                                  </span>
                                </span>
                              )}
                            </div>
                            {club.exclusionReason && (
                              <p className="text-[11px] text-slate-500 leading-snug max-w-xs">
                                {club.exclusionReason}
                              </p>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            {club.isBlockedByPortalStaff ? (
                              <button
                                type="button"
                                disabled={isBusy || Boolean(actionBusyLockId)}
                                onClick={() => handleUnblockClub(club)}
                                className="min-h-[34px] px-2.5 py-1 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              >
                                {isBusy ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Unlock className="w-3.5 h-3.5" />
                                )}
                                <span>Sblocca</span>
                              </button>
                            ) : isOfficialBlock ? (
                              <span className="text-[11px] text-slate-400 font-medium">
                                Blocco FICUP
                              </span>
                            ) : club.availabilityStatus === 'NASCOSTA' ||
                              club.availabilityStatus === 'ASSEGNATA' ? (
                              <span className="text-[11px] text-slate-400 font-medium">
                                Non disponibile
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={isBusy || Boolean(actionBusyLockId)}
                                onClick={() => {
                                  setActionFeedback(null);
                                  setBlockReason('Squadra già occupata / assegnata');
                                  setBlockTargetClub(club);
                                }}
                                className="min-h-[34px] px-2.5 py-1 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-800 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              >
                                <ShieldBan className="w-3.5 h-3.5" />
                                <span>Blocca per utenti</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Official Standings Preview inside Admin Zona VAR */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-[#C69214]" />
                <h3 className="font-display text-base font-bold text-[#0B1F4D]">
                  Classifiche Ufficiali ({SERIE_LABELS[selectedStandingSerie]})
                </h3>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {SERIE_ORDER.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSelectedStandingSerie(s)}
                    className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                      selectedStandingSerie === s
                        ? 'bg-[#0B1F4D] text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {SERIE_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>

            {!currentStanding || currentStanding.rows.length === 0 ? (
              <p className="text-xs text-slate-500">
                Nessuna riga classifica presente per {SERIE_LABELS[selectedStandingSerie]}.
              </p>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="min-w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="py-2 px-3 font-bold">#</th>
                      <th className="py-2 px-3 font-bold">Squadra</th>
                      <th className="py-2 px-3 font-bold text-right">PT</th>
                      <th className="py-2 px-3 font-bold text-right">G</th>
                      <th className="py-2 px-3 font-bold text-right">V-N-P</th>
                      <th className="py-2 px-3 font-bold text-right">DR</th>
                      <th className="py-2 px-3 font-bold text-right">Pt Totali</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono-tabular">
                    {currentStanding.rows.map((row) => (
                      <tr key={`${row.pos}-${row.squadra}`}>
                        <td className="py-2 px-3 font-bold text-[#C69214]">{row.pos}</td>
                        <td className="py-2 px-3 font-sans font-semibold text-[#0B1F4D]">
                          {row.squadra}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-[#0B1F4D]">{row.pt}</td>
                        <td className="py-2 px-3 text-right text-slate-600">{row.g}</td>
                        <td className="py-2 px-3 text-right text-slate-600">
                          {row.v}-{row.n}-{row.p}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-600">
                          {row.dr > 0 ? `+${row.dr}` : row.dr}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-700">{row.ptTotali}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
