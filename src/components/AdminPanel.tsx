import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import {
  Activity,
  AlertCircle,
  Archive,
  Check,
  CheckCircle2,
  Copy,
  FileText,
  Loader2,
  LogOut,
  Megaphone,
  MessageCircle,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  verifyAppsScriptBackend,
  type AppsScriptConnectionDiagnostic,
} from '../lib/appsScriptClient';
import {
  auth,
  firebaseConfigStatus,
  googleProvider,
  isFirebaseConfigured,
  verifyFirebaseServices,
  type FirebaseEnvironmentDiagnostics,
} from '../lib/firebase';
import {
  archiveCandidaturaByAdmin,
  DEFAULT_PUBLIC_CONFIG,
  fetchAmministratori,
  fetchSquadreAssegnateMap,
  fetchWhatsappAutorizzazioniMap,
  getAdminConfig,
  isEffectiveWaAuthorized,
  resolveSimplifiedCandidaturaStato,
  resolveTeamReservationSummary,
  restoreCandidaturaByAdmin,
  saveAdminConfig,
  subscribeCandidature,
  verifyAdminAuthorization,
  type AmministratoreRecord,
  type CandidaturaRecord,
  type ConfigurazionePublica,
  type SimplifiedCandidaturaStato,
  type SquadraAssegnataRecord,
  type TeamReservationBadgeStatus,
  type WhatsappAutorizzazioneRecord,
} from '../lib/firestore';
import { parseFirestoreUiError } from '../lib/notifications';
import { AdminCreaInserzioneSection } from './AdminCreaInserzioneSection';
import { AdminDocumentiSection } from './AdminDocumentiSection';
import { AdminWhatsappSection } from './AdminWhatsappSection';
import { AdminZonaVarSection } from './AdminZonaVarSection';
import { CandidaturaDetailModal, simplifiedStatusBadgeStyle } from './CandidaturaDetailModal';
import { FicupLogo } from './FicupLogo';
import { SuperAdminDiagnosticPanel } from './SuperAdminDiagnosticPanel';

interface AdminPanelProps {
  publicConfig: Omit<ConfigurazionePublica, 'updatedAt' | 'updatedBy'>;
  onConfigSaved: (nextConfig: Omit<ConfigurazionePublica, 'updatedAt' | 'updatedBy'>) => void;
}

type AdminTab =
  | 'candidature'
  | 'archiviate'
  | 'documenti'
  | 'zonavar'
  | 'crea-inserzione'
  | 'whatsapp'
  | 'configurazione'
  | 'amministratori'
  | 'diagnostica';

type CandidaturaFilter = 'TUTTE' | SimplifiedCandidaturaStato;

function formatShortDate(date: Date | null): string {
  if (!date) {
    return '—';
  }
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function reservationBadgeStyle(status: TeamReservationBadgeStatus): string {
  switch (status) {
    case 'ASSEGNATA':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    case 'RISERVATA':
      return 'bg-sky-50 text-sky-900 border-sky-200';
    case 'LIBERA':
      return 'bg-indigo-50 text-indigo-800 border-indigo-200';
    case 'RILASCIATA':
      return 'bg-slate-100 text-slate-600 border-slate-300';
    default:
      return 'bg-amber-50 text-amber-800 border-amber-200';
  }
}

function formatAdminDiagnosticError(err: unknown): string {
  const friendly = parseFirestoreUiError(err);
  const raw = err instanceof Error ? err.message : String(err);
  try {
    const parsed = JSON.parse(raw) as {
      code?: string | null;
      error?: string;
      path?: string | null;
    };
    const parts: string[] = [];
    if (parsed.code) {
      parts.push(`Codice: ${parsed.code}`);
    }
    if (parsed.path) {
      parts.push(`Percorso: ${parsed.path}`);
    }
    if (parsed.error && parsed.error !== friendly) {
      parts.push(`Dettaglio: ${parsed.error}`);
    }
    return parts.length > 0 ? `${friendly}\n[${parts.join(' · ')}]` : friendly;
  } catch {
    return friendly;
  }
}

export function AdminPanel({ publicConfig, onConfigSaved }: AdminPanelProps) {
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [adminRecord, setAdminRecord] = useState<AmministratoreRecord | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  const [activeTab, setActiveTab] = useState<AdminTab>('candidature');

  // Candidature state
  const [candidature, setCandidature] = useState<CandidaturaRecord[]>([]);
  const [candLoading, setCandLoading] = useState(false);
  const [candError, setCandError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [archivedSearchTerm, setArchivedSearchTerm] = useState('');
  const [stateFilter, setStateFilter] = useState<CandidaturaFilter>('TUTTE');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [waAuthMap, setWaAuthMap] = useState<Record<string, WhatsappAutorizzazioneRecord>>({});
  const [teamLocksMap, setTeamLocksMap] = useState<Record<string, SquadraAssegnataRecord>>({});
  const [archiveTarget, setArchiveTarget] = useState<CandidaturaRecord | null>(null);
  const [archiveSubmitting, setArchiveSubmitting] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [archiveFeedback, setArchiveFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Admins list state
  const [adminsList, setAdminsList] = useState<AmministratoreRecord[]>([]);
  const [adminsLoading, setAdminsLoading] = useState(false);
  const [adminsError, setAdminsError] = useState<string | null>(null);

  // Config form state
  const [cfgForm, setCfgForm] = useState(publicConfig);
  const [cfgSaving, setCfgSaving] = useState(false);
  const [cfgError, setCfgError] = useState<string | null>(null);
  const [cfgSaved, setCfgSaved] = useState(false);

  // Diagnostics state
  const [diagnostics, setDiagnostics] = useState<FirebaseEnvironmentDiagnostics | null>(null);
  const [appsScriptDiag, setAppsScriptDiag] = useState<AppsScriptConnectionDiagnostic | null>(null);
  const [appsScriptProbeLoading, setAppsScriptProbeLoading] = useState(false);
  const [diagLoading, setDiagLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<'email' | 'uid' | null>(null);
  const [copiedPhoneRowId, setCopiedPhoneRowId] = useState<string | null>(null);

  useEffect(() => {
    setCfgForm(publicConfig);
  }, [publicConfig]);

  // Listen to Firebase Auth state
  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setAuthLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthError(null);

      if (!currentUser) {
        setAdminRecord(null);
        setAuthLoading(false);
        return;
      }

      if (!currentUser.emailVerified) {
        setAdminRecord(null);
        setAuthLoading(false);
        return;
      }

      setAuthLoading(true);
      try {
        const record = await verifyAdminAuthorization(currentUser);
        setAdminRecord(record);
      } catch (err) {
        setAdminRecord(null);
        setAuthError(formatAdminDiagnosticError(err));
      } finally {
        setAuthLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Subscribe to candidature only when verified & authorized admin
  useEffect(() => {
    if (!adminRecord) {
      setCandidature([]);
      return;
    }

    setCandLoading(true);
    setCandError(null);

    const unsubscribe = subscribeCandidature(
      (items) => {
        setCandidature(items);
        setCandLoading(false);
      },
      (err) => {
        setCandError(parseFirestoreUiError(err));
        setCandLoading(false);
      }
    );

    return () => unsubscribe();
  }, [adminRecord]);

  const loadWhatsappAuthMap = async () => {
    if (!adminRecord) {
      setWaAuthMap({});
      setTeamLocksMap({});
      return;
    }
    const [waRes, locksRes] = await Promise.allSettled([
      fetchWhatsappAutorizzazioniMap(),
      fetchSquadreAssegnateMap(),
    ]);
    if (waRes.status === 'fulfilled') {
      setWaAuthMap(waRes.value);
    }
    if (locksRes.status === 'fulfilled') {
      setTeamLocksMap(locksRes.value);
    }
  };

  useEffect(() => {
    if (!adminRecord) {
      setWaAuthMap({});
      setTeamLocksMap({});
      return;
    }
    loadWhatsappAuthMap();
  }, [adminRecord]);

  const loadAdmins = async () => {
    if (!adminRecord) {
      return;
    }
    setAdminsLoading(true);
    setAdminsError(null);
    try {
      const list = await fetchAmministratori();
      setAdminsList(list);
    } catch (err) {
      setAdminsError(parseFirestoreUiError(err));
    } finally {
      setAdminsLoading(false);
    }
  };

  const runDiagnostics = async (includeAppsScriptProbe = false) => {
    setDiagLoading(true);
    try {
      const [fbRes, gasRes] = await Promise.all([
        verifyFirebaseServices(),
        verifyAppsScriptBackend({ includeFirestoreReadProbe: includeAppsScriptProbe }),
      ]);
      setDiagnostics(fbRes);
      setAppsScriptDiag(gasRes);
    } finally {
      setDiagLoading(false);
    }
  };

  const runAppsScriptProbe = async () => {
    setAppsScriptProbeLoading(true);
    try {
      const gasRes = await verifyAppsScriptBackend({ includeFirestoreReadProbe: true });
      setAppsScriptDiag(gasRes);
    } finally {
      setAppsScriptProbeLoading(false);
    }
  };

  useEffect(() => {
    if (!adminRecord) {
      return;
    }
    if (activeTab === 'amministratori') {
      loadAdmins();
    }
    if (activeTab === 'diagnostica') {
      runDiagnostics();
    }
    if (activeTab === 'configurazione') {
      getAdminConfig()
        .then((remote) => {
          if (remote) {
            setCfgForm({
              stagione: remote.stagione,
              iscrizioniAperte: remote.iscrizioniAperte,
              budgetIniziale: remote.budgetIniziale,
              modalitaMercato: remote.modalitaMercato,
              versioneInformativa: remote.versioneInformativa,
              emailOperativa: remote.emailOperativa,
              linkWhatsappProvvisorio: remote.linkWhatsappProvvisorio,
              linkWhatsappUfficiale: remote.linkWhatsappUfficiale,
            });
          }
        })
        .catch(() => null);
    }
  }, [adminRecord, activeTab]);

  const handleGoogleSignIn = async () => {
    if (!auth) {
      return;
    }
    setSigningIn(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: string }).code)
          : '';
      if (code === 'auth/configuration-not-found') {
        setAuthError(
          'Firebase Authentication non è ancora stato attivato per candidature-ficup nella Firebase Console (abilitare Authentication e il provider Google).'
        );
      } else if (code === 'auth/unauthorized-domain') {
        setAuthError(
          'Dominio corrente non autorizzato in Firebase Authentication (aggiungerlo in Authentication > Impostazioni > Domini autorizzati).'
        );
      } else if (code === 'auth/popup-closed-by-user') {
        setAuthError('Accesso annullato prima del completamento.');
      } else {
        setAuthError(err instanceof Error ? err.message : 'Errore durante l’accesso Google.');
      }
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    if (!auth) {
      return;
    }
    await signOut(auth);
    setAdminRecord(null);
    setSelectedId(null);
  };

  const handleReverifyRole = async () => {
    if (!user) {
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    try {
      const record = await verifyAdminAuthorization(user);
      setAdminRecord(record);
    } catch (err) {
      setAuthError(formatAdminDiagnosticError(err));
    } finally {
      setAuthLoading(false);
    }
  };

  const copyText = async (value: string, tag: 'email' | 'uid') => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(tag);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Ignore
    }
  };

  const copyCandidatePhone = async (rowId: string, phone: string) => {
    if (!phone || typeof navigator === 'undefined' || !navigator.clipboard) {
      return;
    }
    try {
      await navigator.clipboard.writeText(phone);
      setCopiedPhoneRowId(rowId);
      window.setTimeout(() => setCopiedPhoneRowId(null), 2000);
    } catch {
      // Ignore
    }
  };

  const handleSaveConfig = async (e: FormEvent) => {
    e.preventDefault();
    if (!user?.email) {
      return;
    }
    setCfgSaving(true);
    setCfgError(null);
    setCfgSaved(false);
    try {
      await saveAdminConfig(cfgForm, user.email);
      onConfigSaved({
        ...cfgForm,
        linkWhatsappUfficiale: '',
      });
      setCfgSaved(true);
    } catch (err) {
      setCfgError(parseFirestoreUiError(err));
    } finally {
      setCfgSaving(false);
    }
  };

  const handleConfirmArchive = async () => {
    if (!archiveTarget || !user || archiveSubmitting) {
      return;
    }
    const target = archiveTarget;
    setArchiveSubmitting(true);
    setArchiveFeedback(null);
    try {
      await archiveCandidaturaByAdmin({
        candidaturaId: target.id,
        codiceCandidatura: target.codiceCandidatura,
        statoCorrente: target.stato,
        adminUser: user,
      });
      setArchiveTarget(null);
      if (selectedId === target.id) {
        setSelectedId(null);
      }
      setArchiveFeedback({
        type: 'success',
        message: `Candidatura ${target.codiceCandidatura} (${target.nome} ${target.cognome}) archiviata con successo. Non è più visibile nell'elenco principale ma resta recuperabile nella sezione Archiviate.`,
      });
    } catch (err) {
      setArchiveFeedback({
        type: 'error',
        message: parseFirestoreUiError(err),
      });
    } finally {
      setArchiveSubmitting(false);
    }
  };

  const handleRestoreCandidatura = async (item: CandidaturaRecord) => {
    if (!user || restoringId) {
      return;
    }
    setRestoringId(item.id);
    setArchiveFeedback(null);
    try {
      await restoreCandidaturaByAdmin({
        candidaturaId: item.id,
        codiceCandidatura: item.codiceCandidatura,
        statoCorrente: item.stato,
        adminUser: user,
      });
      setArchiveFeedback({
        type: 'success',
        message: `Candidatura ${item.codiceCandidatura} (${item.nome} ${item.cognome}) ripristinata nell'elenco principale con lo stato originale ${item.stato}.`,
      });
    } catch (err) {
      setArchiveFeedback({
        type: 'error',
        message: parseFirestoreUiError(err),
      });
    } finally {
      setRestoringId(null);
    }
  };

  const activeCandidature = useMemo(
    () => candidature.filter((c) => !c.archiviata),
    [candidature]
  );

  const archivedCandidature = useMemo(
    () => candidature.filter((c) => c.archiviata),
    [candidature]
  );

  const metrics = useMemo(() => {
    const total = activeCandidature.length;
    let daVerificare = 0;
    let completato = 0;
    let respinto = 0;
    let autorizzatiWa = 0;

    for (const c of activeCandidature) {
      const waAuth = waAuthMap[c.id];
      const simplified = resolveSimplifiedCandidaturaStato(c, waAuth);
      if (simplified === 'COMPLETATO') {
        completato += 1;
      } else if (simplified === 'RESPINTO') {
        respinto += 1;
      } else {
        daVerificare += 1;
      }
      if (isEffectiveWaAuthorized(c, waAuth)) {
        autorizzatiWa += 1;
      }
    }

    return {
      total,
      daVerificare,
      completato,
      respinto,
      autorizzatiWa,
    };
  }, [activeCandidature, waAuthMap]);

  const filteredCandidature = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return activeCandidature.filter((c) => {
      const simplified = resolveSimplifiedCandidaturaStato(c, waAuthMap[c.id]);
      if (stateFilter !== 'TUTTE' && simplified !== stateFilter) {
        return false;
      }
      if (!q) {
        return true;
      }
      const assignedTeam = waAuthMap[c.id]?.squadraAssegnataZonaVar ?? '';
      const lock = teamLocksMap[c.id];
      return (
        c.codiceCandidatura.toLowerCase().includes(q) ||
        c.nome.toLowerCase().includes(q) ||
        c.cognome.toLowerCase().includes(q) ||
        c.emailFantaleghe.toLowerCase().includes(q) ||
        c.cellulare.toLowerCase().includes(q) ||
        c.nomeSquadra.toLowerCase().includes(q) ||
        c.squadraZonaVarNome.toLowerCase().includes(q) ||
        c.squadraZonaVarSerie.toLowerCase().includes(q) ||
        (lock?.serie ?? '').toLowerCase().includes(q) ||
        assignedTeam.toLowerCase().includes(q)
      );
    });
  }, [activeCandidature, searchTerm, stateFilter, waAuthMap, teamLocksMap]);

  const filteredArchivedCandidature = useMemo(() => {
    const q = archivedSearchTerm.trim().toLowerCase();
    return archivedCandidature.filter((c) => {
      if (!q) {
        return true;
      }
      const assignedTeam = waAuthMap[c.id]?.squadraAssegnataZonaVar ?? '';
      const lock = teamLocksMap[c.id];
      return (
        c.codiceCandidatura.toLowerCase().includes(q) ||
        c.nome.toLowerCase().includes(q) ||
        c.cognome.toLowerCase().includes(q) ||
        c.emailFantaleghe.toLowerCase().includes(q) ||
        c.cellulare.toLowerCase().includes(q) ||
        c.nomeSquadra.toLowerCase().includes(q) ||
        c.squadraZonaVarNome.toLowerCase().includes(q) ||
        c.squadraZonaVarSerie.toLowerCase().includes(q) ||
        (lock?.serie ?? '').toLowerCase().includes(q) ||
        c.archiviataByEmail.toLowerCase().includes(q) ||
        assignedTeam.toLowerCase().includes(q)
      );
    });
  }, [archivedCandidature, archivedSearchTerm, waAuthMap, teamLocksMap]);

  const selectedCandidatura = useMemo(
    () => candidature.find((c) => c.id === selectedId) ?? null,
    [candidature, selectedId]
  );

  // 1. Missing Firebase Web App config guard
  if (!isFirebaseConfigured) {
    return (
      <div className="bg-slate-50/70 min-h-[calc(100vh-4.5rem)] py-10 px-4">
        <div className="max-w-2xl mx-auto bg-white border border-amber-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-4">
          <div className="flex items-center gap-3 text-amber-800">
            <ShieldAlert className="w-6 h-6 shrink-0" />
            <h1 className="font-display text-xl font-bold">Configurazione Firebase mancante</h1>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">
            L&apos;Area Staff richiede la configurazione completa della Web App Firebase (
            <span className="font-mono-tabular">candidature-ficup</span>). Parametri mancanti:{' '}
            <span className="font-mono-tabular font-semibold">
              {firebaseConfigStatus.missingFields.join(', ')}
            </span>
            .
          </p>
        </div>
      </div>
    );
  }

  // 2. Auth Loading
  if (authLoading) {
    return (
      <div className="bg-slate-50/70 min-h-[calc(100vh-4.5rem)] flex items-center justify-center px-4 py-16">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 text-[#0B1F4D] animate-spin mx-auto" />
          <p className="text-sm font-medium text-slate-600">
            Verifica identità e autorizzazioni staff su Firestore...
          </p>
        </div>
      </div>
    );
  }

  // 3. Not signed in
  if (!user) {
    return (
      <div className="bg-slate-50/70 min-h-[calc(100vh-4.5rem)] py-12 sm:py-16 px-4">
        <div className="max-w-lg mx-auto bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-5">
          <div className="flex items-center gap-3.5">
            <FicupLogo size="md" className="ring-1 ring-slate-200 p-0.5 bg-white shrink-0" />
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#C69214]">
                Area Riservata Staff · FANTA ITALIA CUP
              </p>
              <h1 className="mt-0.5 font-display text-2xl font-extrabold text-[#0B1F4D]">
                Accesso Pannello Amministrativo
              </h1>
            </div>
          </div>

          <p className="text-sm text-slate-600 leading-relaxed">
            L&apos;accesso è protetto tramite <strong>Firebase Authentication (Google)</strong> e verifica del profilo nella raccolta Firestore{' '}
            <span className="font-mono-tabular">amministratori</span>.
          </p>

          {authError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 flex items-start gap-2.5 text-xs sm:text-sm text-red-800">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          <button
            type="button"
            disabled={signingIn}
            onClick={handleGoogleSignIn}
            className="min-h-[48px] w-full px-5 py-3 rounded-xl bg-[#0B1F4D] text-white text-sm font-bold hover:bg-[#153985] disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-2.5 cursor-pointer"
          >
            {signingIn && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>Accedi con Google</span>
          </button>
        </div>
      </div>
    );
  }

  // 4. Signed in but NOT authorized in Firestore `amministratori` -> Bootstrap SUPER_ADMIN guide
  if (!adminRecord) {
    return (
      <div className="bg-slate-50/70 min-h-[calc(100vh-4.5rem)] py-8 sm:py-12 px-4">
        <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-red-700">
                  {authError ? 'Errore verifica Firestore' : 'Accesso non autorizzato'}
                </p>
                <h1 className="mt-0.5 font-display text-xl font-extrabold text-[#0B1F4D]">
                  {authError
                    ? 'Impossibile completare la verifica su Firestore'
                    : 'Profilo non abilitato in Firestore'}
                </h1>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              className="min-h-[40px] px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Esci</span>
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-xs sm:text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-slate-600">
                Email Google: <strong className="text-slate-900">{user.email ?? 'N/D'}</strong> (
                {user.emailVerified ? 'verificata' : 'NON verificata'})
              </span>
              {user.email && (
                <button
                  type="button"
                  onClick={() => copyText(user.email!, 'email')}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#153985] cursor-pointer"
                >
                  {copiedId === 'email' ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>Copia email</span>
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-slate-600">
                UID Auth: <span className="font-mono-tabular text-slate-900">{user.uid}</span>
              </span>
              <button
                type="button"
                onClick={() => copyText(user.uid, 'uid')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#153985] cursor-pointer"
              >
                {copiedId === 'uid' ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>Copia UID</span>
              </button>
            </div>
          </div>

          {authError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs sm:text-sm text-red-800 whitespace-pre-line break-words">
              {authError}
            </div>
          )}

          {/* Manual Bootstrap SUPER_ADMIN Procedure */}
          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 space-y-3 text-xs sm:text-sm text-slate-800">
            <h2 className="font-bold text-[#0B1F4D]">
              Procedura manuale di bootstrap primo SUPER_ADMIN (Firebase Console)
            </h2>
            <p className="leading-relaxed">
              Per sicurezza, le regole Firestore vietano l&apos;auto-registrazione degli amministratori dal client. Per abilitare il primo{' '}
              <span className="font-mono-tabular font-semibold">SUPER_ADMIN</span> su{' '}
              <span className="font-mono-tabular">candidature-ficup</span>:
            </p>
            <ol className="list-decimal pl-5 space-y-1.5 leading-relaxed">
              <li>
                Apri la <strong>Firebase Console</strong> → <em>Firestore Database → Dati</em>.
              </li>
              <li>
                Crea (o seleziona) la raccolta{' '}
                <span className="font-mono-tabular font-semibold">amministratori</span>.
              </li>
              <li>
                Crea un documento usando come <strong>ID documento</strong> la tua email verificata (
                <span className="font-mono-tabular">{user.email}</span>) oppure il tuo UID (
                <span className="font-mono-tabular">{user.uid}</span>).
              </li>
              <li>
                Inserisci esattamente questi 6 campi (nessun campo aggiuntivo):
                <ul className="list-disc pl-5 mt-1 font-mono-tabular text-xs space-y-0.5 text-slate-700">
                  <li>email (string): &quot;{user.email ?? 'admin@esempio.it'}&quot;</li>
                  <li>nome (string): &quot;{user.displayName ?? 'Responsabile FANTA ITALIA CUP'}&quot;</li>
                  <li>ruolo (string): &quot;SUPER_ADMIN&quot;</li>
                  <li>attivo (boolean): true</li>
                  <li>createdAt (timestamp): data/ora corrente</li>
                  <li>updatedAt (timestamp): data/ora corrente</li>
                </ul>
              </li>
              <li>Salva il documento e clicca il pulsante qui sotto per ricontrollare l&apos;accesso.</li>
            </ol>
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-3">
            <button
              type="button"
              onClick={handleReverifyRole}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#0B1F4D] text-white text-sm font-bold hover:bg-[#153985] transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4 text-[#D4AF37]" />
              <span>Ricontrolla autorizzazione</span>
            </button>
          </div>

          {user.emailVerified && user.email?.toLowerCase() === 'fabry.amoroso@gmail.com' && (
            <SuperAdminDiagnosticPanel />
          )}
        </div>
      </div>
    );
  }

  // 5. Authorized Admin Dashboard
  return (
    <div className="bg-slate-50/70 min-h-[calc(100vh-4.5rem)] py-6 sm:py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6">
        {/* Admin Top Header Bar */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <FicupLogo size="sm" className="ring-1 ring-slate-200 p-0.5 bg-white shrink-0" />
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="font-semibold text-[#0B1F4D] inline-flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#C69214]" />
                  {adminRecord.ruolo}
                </span>
                <span aria-hidden="true">·</span>
                <span className="break-all">{adminRecord.email}</span>
              </div>
              <h1 className="mt-0.5 font-display text-xl sm:text-2xl font-extrabold text-[#0B1F4D]">
                Pannello Amministrativo FANTA ITALIA CUP ({publicConfig.stagione})
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            <LogOut className="w-4 h-4" />
            <span>Disconnetti</span>
          </button>
        </div>

        {/* Admin Sub-Navigation Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setActiveTab('candidature')}
            className={`min-h-[44px] px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              activeTab === 'candidature'
                ? 'bg-[#0B1F4D] text-white'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            Candidature ({metrics.total})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('archiviate')}
            className={`min-h-[44px] px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'archiviate'
                ? 'bg-[#0B1F4D] text-white'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            <span>Archiviate ({archivedCandidature.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('documenti')}
            className={`min-h-[44px] px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'documenti'
                ? 'bg-[#0B1F4D] text-white'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Documenti Ufficiali</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('zonavar')}
            className={`min-h-[44px] px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'zonavar'
                ? 'bg-[#0B1F4D] text-white'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Squadre · Zona VAR</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('crea-inserzione')}
            className={`min-h-[44px] px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'crea-inserzione'
                ? 'bg-[#0B1F4D] text-white'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Megaphone className="w-3.5 h-3.5 text-[#C69214]" />
            <span>Crea Inserzione</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('whatsapp')}
            className={`min-h-[44px] px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'whatsapp'
                ? 'bg-[#0B1F4D] text-white'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>Accessi WhatsApp ({metrics.autorizzatiWa})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('configurazione')}
            className={`min-h-[44px] px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'configurazione'
                ? 'bg-[#0B1F4D] text-white'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Configurazione</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('amministratori')}
            className={`min-h-[44px] px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'amministratori'
                ? 'bg-[#0B1F4D] text-white'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Amministratori</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('diagnostica')}
            className={`min-h-[44px] px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'diagnostica'
                ? 'bg-[#0B1F4D] text-white'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Diagnostica Firebase</span>
          </button>
        </div>

        {/* TAB 1: CANDIDATURE */}
        {activeTab === 'candidature' && (
          <div className="space-y-6">
            {/* 4 KPI Metric Cards Semplificate */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white border border-slate-200 rounded-2xl p-4">
                <p className="text-xs font-medium text-slate-500">Totale</p>
                <p className="mt-1 text-2xl font-extrabold text-[#0B1F4D] font-mono-tabular">
                  {metrics.total}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-4">
                <p className="text-xs font-medium text-slate-500">Da verificare</p>
                <p className="mt-1 text-2xl font-extrabold text-amber-700 font-mono-tabular">
                  {metrics.daVerificare}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-4">
                <p className="text-xs font-medium text-slate-500">Completato</p>
                <p className="mt-1 text-2xl font-extrabold text-emerald-700 font-mono-tabular">
                  {metrics.completato}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-4">
                <p className="text-xs font-medium text-slate-500">Respinto</p>
                <p className="mt-1 text-2xl font-extrabold text-red-700 font-mono-tabular">
                  {metrics.respinto}
                </p>
              </div>
            </div>

            {/* Search + Simplified 3-State Filters */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Cerca per codice FICUP26, nome, cognome, cellulare, email Fantaleghe o squadra..."
                  className="w-full min-h-[44px] pl-10 pr-4 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B1F4D]/20"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setStateFilter('TUTTE')}
                  className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    stateFilter === 'TUTTE'
                      ? 'bg-[#0B1F4D] text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  TUTTE ({metrics.total})
                </button>
                <button
                  type="button"
                  onClick={() => setStateFilter('DA VERIFICARE')}
                  className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    stateFilter === 'DA VERIFICARE'
                      ? 'bg-amber-700 text-white'
                      : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
                  }`}
                >
                  DA VERIFICARE ({metrics.daVerificare})
                </button>
                <button
                  type="button"
                  onClick={() => setStateFilter('COMPLETATO')}
                  className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    stateFilter === 'COMPLETATO'
                      ? 'bg-emerald-700 text-white'
                      : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                  }`}
                >
                  COMPLETATO ({metrics.completato})
                </button>
                <button
                  type="button"
                  onClick={() => setStateFilter('RESPINTO')}
                  className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    stateFilter === 'RESPINTO'
                      ? 'bg-red-700 text-white'
                      : 'bg-red-50 text-red-800 border border-red-200 hover:bg-red-100'
                  }`}
                >
                  RESPINTO ({metrics.respinto})
                </button>
              </div>
            </div>

            {archiveFeedback && (
              <div
                className={`rounded-2xl border p-4 flex items-start justify-between gap-3 text-xs sm:text-sm ${
                  archiveFeedback.type === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    : 'border-red-200 bg-red-50 text-red-800'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {archiveFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-700" />
                  ) : (
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-700" />
                  )}
                  <span>{archiveFeedback.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setArchiveFeedback(null)}
                  aria-label="Chiudi avviso"
                  className="p-1 rounded-lg hover:bg-black/5 cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {candError && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 flex items-start gap-2.5 text-sm text-red-800">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <span>{candError}</span>
              </div>
            )}

            {candLoading ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-2">
                <Loader2 className="w-6 h-6 animate-spin text-[#0B1F4D] mx-auto" />
                <p className="text-sm text-slate-600">Caricamento candidature da Firestore...</p>
              </div>
            ) : filteredCandidature.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-1.5">
                <p className="text-base font-bold text-[#0B1F4D]">Nessuna candidatura trovata</p>
                <p className="text-sm text-slate-600">
                  {activeCandidature.length === 0
                    ? 'Nessuna candidatura attiva presente nell’elenco principale.'
                    : 'Nessun risultato corrisponde ai filtri selezionati.'}
                </p>
              </div>
            ) : (
              <>
                {/* Mobile Cards View */}
                <div className="lg:hidden space-y-3">
                  {filteredCandidature.map((item) => {
                    const waAuth = waAuthMap[item.id];
                    const simplifiedStato = resolveSimplifiedCandidaturaStato(item, waAuth);
                    const teamInfo = resolveTeamReservationSummary(
                      item,
                      teamLocksMap[item.id],
                      waAuth
                    );
                    return (
                    <article
                      key={item.id}
                      className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-mono-tabular text-xs font-bold text-[#0B1F4D]">
                            {item.codiceCandidatura}
                          </p>
                          <h3 className="text-base font-bold text-slate-900">
                            {item.nome} {item.cognome}
                          </h3>
                        </div>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-md border text-[11px] font-bold shrink-0 ${simplifiedStatusBadgeStyle(
                            simplifiedStato
                          )}`}
                        >
                          {simplifiedStato}
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 space-y-1.5">
                        <p className="break-all">
                          <strong>Email:</strong> {item.emailFantaleghe}
                        </p>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-mono-tabular">
                            <strong>Cellulare:</strong>{' '}
                            {item.cellulare ? (
                              <span className="text-[#0B1F4D] font-semibold">
                                {item.cellulare}
                              </span>
                            ) : (
                              <span className="text-amber-800">Non presente</span>
                            )}
                          </p>
                          {item.cellulare && (
                            <button
                              type="button"
                              onClick={() => copyCandidatePhone(item.id, item.cellulare)}
                              className="min-h-[28px] px-2 py-0.5 rounded-md border border-slate-300 bg-slate-50 text-[11px] font-semibold text-[#0B1F4D] inline-flex items-center gap-1 cursor-pointer"
                            >
                              {copiedPhoneRowId === item.id ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-700" />
                                  <span>Copiato</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Copia</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 space-y-1">
                          <div className="flex flex-wrap items-center justify-between gap-1.5">
                            <span className="font-semibold text-[#0B1F4D]">
                              <strong>{item.tipoCandidatura === 'LIBERA' ? 'Percorso:' : 'Squadra scelta:'}</strong>{' '}
                              {teamInfo.chosenTeam}
                              {teamInfo.chosenSerie ? ` · ${teamInfo.chosenSerie}` : ''}
                            </span>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-bold ${reservationBadgeStyle(
                                teamInfo.reservationStatus
                              )}`}
                            >
                              {teamInfo.reservationStatus}
                            </span>
                          </div>
                          {teamInfo.assignedTeam && teamInfo.assignedTeam !== teamInfo.chosenTeam && (
                            <p className="text-[11px] text-emerald-800 font-medium">
                              Riferimento assegnazione: {teamInfo.assignedTeam}
                            </p>
                          )}
                        </div>
                        <p className="font-mono-tabular">
                          <strong>Data:</strong> {formatShortDate(item.createdAt)}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedId(item.id)}
                          className="min-h-[44px] w-full px-4 py-2 rounded-xl bg-[#0B1F4D] text-white text-xs font-bold hover:bg-[#153985] transition-colors cursor-pointer"
                        >
                          DETTAGLI
                        </button>
                        <button
                          type="button"
                          onClick={() => setArchiveTarget(item)}
                          className="min-h-[44px] w-full px-4 py-2 rounded-xl border border-red-200 bg-red-50 text-red-700 text-xs font-bold hover:bg-red-100 transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>ELIMINA</span>
                        </button>
                      </div>
                    </article>
                    );
                  })}
                </div>

                {/* Desktop Table View */}
                <div className="hidden lg:block bg-white border border-slate-200 rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                          <th className="py-3 px-4">Codice</th>
                          <th className="py-3 px-4">Nome e cognome</th>
                          <th className="py-3 px-4">Cellulare</th>
                          <th className="py-3 px-4">Email Fantaleghe</th>
                          <th className="py-3 px-4">Squadra scelta · Prenotazione</th>
                          <th className="py-3 px-4">Data</th>
                          <th className="py-3 px-4">Stato</th>
                          <th className="py-3 px-4 text-right">Azioni</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-sm">
                        {filteredCandidature.map((item) => {
                          const waAuth = waAuthMap[item.id];
                          const simplifiedStato = resolveSimplifiedCandidaturaStato(
                            item,
                            waAuth
                          );
                          const teamInfo = resolveTeamReservationSummary(
                            item,
                            teamLocksMap[item.id],
                            waAuth
                          );
                          return (
                          <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4 font-mono-tabular text-xs font-bold text-[#0B1F4D] whitespace-nowrap">
                              {item.codiceCandidatura}
                            </td>
                            <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                              {item.nome} {item.cognome}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              {item.cellulare ? (
                                <div className="inline-flex items-center gap-1.5">
                                  <span className="font-mono-tabular text-xs font-semibold text-[#0B1F4D]">
                                    {item.cellulare}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => copyCandidatePhone(item.id, item.cellulare)}
                                    title="Copia numero di cellulare"
                                    className="p-1 rounded border border-slate-200 text-slate-500 hover:text-[#0B1F4D] hover:bg-slate-100 cursor-pointer"
                                  >
                                    {copiedPhoneRowId === item.id ? (
                                      <Check className="w-3 h-3 text-emerald-700" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs text-amber-800">Assente</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-slate-600 break-all">
                              {item.emailFantaleghe}
                            </td>
                            <td className="py-3 px-4">
                              <div className="space-y-1">
                                <p className="font-semibold text-[#0B1F4D]">
                                  {teamInfo.chosenTeam}
                                  {teamInfo.chosenSerie && (
                                    <span className="ml-1.5 text-xs font-normal text-slate-500">
                                      ({teamInfo.chosenSerie})
                                    </span>
                                  )}
                                </p>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-bold ${
                                      item.tipoCandidatura === 'LIBERA'
                                        ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                                        : 'bg-sky-50 text-sky-900 border-sky-200'
                                    }`}
                                  >
                                    {item.tipoCandidatura === 'LIBERA' ? 'CANDIDATURA LIBERA' : 'SUBENTRO'}
                                  </span>
                                  <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-bold ${reservationBadgeStyle(
                                      teamInfo.reservationStatus
                                    )}`}
                                  >
                                    {teamInfo.reservationStatus}
                                  </span>
                                  {teamInfo.assignedTeam &&
                                    teamInfo.assignedTeam !== teamInfo.chosenTeam && (
                                      <span className="text-[11px] text-emerald-800 font-medium">
                                        Assegnata: {teamInfo.assignedTeam}
                                      </span>
                                    )}
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 font-mono-tabular text-xs text-slate-600 whitespace-nowrap">
                              {formatShortDate(item.createdAt)}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-md border text-[11px] font-bold ${simplifiedStatusBadgeStyle(
                                  simplifiedStato
                                )}`}
                              >
                                {simplifiedStato}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <div className="inline-flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setSelectedId(item.id)}
                                  className="min-h-[36px] px-3.5 py-1.5 rounded-lg bg-[#0B1F4D] text-white text-xs font-bold hover:bg-[#153985] transition-colors cursor-pointer"
                                >
                                  DETTAGLI
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setArchiveTarget(item)}
                                  className="min-h-[36px] px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs font-bold hover:bg-red-100 transition-colors inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>ELIMINA</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB: ARCHIVIATE */}
        {activeTab === 'archiviate' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-bold text-[#0B1F4D]">
                    Archivio candidature ({archivedCandidature.length})
                  </h2>
                  <p className="mt-1 text-xs sm:text-sm text-slate-600">
                    Le candidature archiviate restano conservate integralmente con dati, documenti accettati, autorizzazioni WhatsApp e storico operazioni. Puoi ripristinarle nell&apos;elenco principale in qualsiasi momento mantenendo il loro stato originale.
                  </p>
                </div>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={archivedSearchTerm}
                  onChange={(e) => setArchivedSearchTerm(e.target.value)}
                  placeholder="Cerca nelle candidature archiviate per codice, nome, email, cellulare, squadra o operatore..."
                  className="w-full min-h-[44px] pl-10 pr-4 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B1F4D]/20"
                />
              </div>
            </div>

            {archiveFeedback && (
              <div
                className={`rounded-2xl border p-4 flex items-start justify-between gap-3 text-xs sm:text-sm ${
                  archiveFeedback.type === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    : 'border-red-200 bg-red-50 text-red-800'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {archiveFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-700" />
                  ) : (
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-700" />
                  )}
                  <span>{archiveFeedback.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setArchiveFeedback(null)}
                  aria-label="Chiudi avviso"
                  className="p-1 rounded-lg hover:bg-black/5 cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {candLoading ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-2">
                <Loader2 className="w-6 h-6 animate-spin text-[#0B1F4D] mx-auto" />
                <p className="text-sm text-slate-600">Caricamento archivio da Firestore...</p>
              </div>
            ) : filteredArchivedCandidature.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-1.5">
                <p className="text-base font-bold text-[#0B1F4D]">Nessuna candidatura archiviata</p>
                <p className="text-sm text-slate-600">
                  {archivedCandidature.length === 0
                    ? 'Le candidature rimosse dall’elenco principale tramite ELIMINA compariranno qui.'
                    : 'Nessun risultato corrisponde alla ricerca nell’archivio.'}
                </p>
              </div>
            ) : (
              <>
                {/* Mobile Archived Cards */}
                <div className="lg:hidden space-y-3">
                  {filteredArchivedCandidature.map((item) => {
                    const waAuth = waAuthMap[item.id];
                    const simplifiedStato = resolveSimplifiedCandidaturaStato(item, waAuth);
                    const teamInfo = resolveTeamReservationSummary(
                      item,
                      teamLocksMap[item.id],
                      waAuth
                    );
                    const isRestoring = restoringId === item.id;
                    return (
                      <article
                        key={item.id}
                        className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-mono-tabular text-xs font-bold text-[#0B1F4D]">
                              {item.codiceCandidatura}
                            </p>
                            <h3 className="text-base font-bold text-slate-900">
                              {item.nome} {item.cognome}
                            </h3>
                          </div>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-md border text-[11px] font-bold shrink-0 ${simplifiedStatusBadgeStyle(
                              simplifiedStato
                            )}`}
                          >
                            {simplifiedStato} ({item.stato})
                          </span>
                        </div>

                        <div className="text-xs text-slate-600 space-y-1">
                          <p className="break-all">
                            <strong>Email:</strong> {item.emailFantaleghe}
                          </p>
                          <p>
                            <strong>Squadra scelta:</strong> {teamInfo.chosenTeam}
                            {teamInfo.chosenSerie ? ` · ${teamInfo.chosenSerie}` : ''} ·{' '}
                            <span
                              className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-bold ${reservationBadgeStyle(
                                teamInfo.reservationStatus
                              )}`}
                            >
                              {teamInfo.reservationStatus}
                            </span>
                          </p>
                          <p>
                            <strong>Archiviata da:</strong> {item.archiviataByEmail || '—'}
                          </p>
                          <p className="font-mono-tabular">
                            <strong>Data archiviazione:</strong> {formatShortDate(item.archiviataAt)}
                          </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedId(item.id)}
                            className="min-h-[44px] w-full px-4 py-2 rounded-xl border border-slate-300 bg-white text-[#0B1F4D] text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer"
                          >
                            DETTAGLI
                          </button>
                          <button
                            type="button"
                            disabled={Boolean(restoringId)}
                            onClick={() => handleRestoreCandidatura(item)}
                            className="min-h-[44px] w-full px-4 py-2 rounded-xl bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            {isRestoring ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <RotateCcw className="w-3.5 h-3.5" />
                            )}
                            <span>RIPRISTINA CANDIDATURA</span>
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>

                {/* Desktop Archived Table */}
                <div className="hidden lg:block bg-white border border-slate-200 rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                          <th className="py-3 px-4">Codice</th>
                          <th className="py-3 px-4">Nome e cognome</th>
                          <th className="py-3 px-4">Squadra</th>
                          <th className="py-3 px-4">Stato originale</th>
                          <th className="py-3 px-4">Archiviata da</th>
                          <th className="py-3 px-4">Data archiviazione</th>
                          <th className="py-3 px-4 text-right">Azioni</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-sm">
                        {filteredArchivedCandidature.map((item) => {
                          const waAuth = waAuthMap[item.id];
                          const simplifiedStato = resolveSimplifiedCandidaturaStato(
                            item,
                            waAuth
                          );
                          const teamInfo = resolveTeamReservationSummary(
                            item,
                            teamLocksMap[item.id],
                            waAuth
                          );
                          const isRestoring = restoringId === item.id;
                          return (
                            <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-3 px-4 font-mono-tabular text-xs font-bold text-[#0B1F4D] whitespace-nowrap">
                                {item.codiceCandidatura}
                              </td>
                              <td className="py-3 px-4">
                                <p className="font-semibold text-slate-900 whitespace-nowrap">
                                  {item.nome} {item.cognome}
                                </p>
                                <p className="text-xs text-slate-500 break-all">
                                  {item.emailFantaleghe}
                                </p>
                              </td>
                              <td className="py-3 px-4 text-slate-800">
                                <p className="font-semibold text-[#0B1F4D]">
                                  {teamInfo.chosenTeam}
                                  {teamInfo.chosenSerie && (
                                    <span className="ml-1.5 text-xs font-normal text-slate-500">
                                      ({teamInfo.chosenSerie})
                                    </span>
                                  )}
                                </p>
                                <span
                                  className={`mt-1 inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-bold ${reservationBadgeStyle(
                                    teamInfo.reservationStatus
                                  )}`}
                                >
                                  {teamInfo.reservationStatus}
                                </span>
                              </td>
                              <td className="py-3 px-4 whitespace-nowrap">
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-md border text-[11px] font-bold ${simplifiedStatusBadgeStyle(
                                    simplifiedStato
                                  )}`}
                                >
                                  {simplifiedStato} ({item.stato})
                                </span>
                              </td>
                              <td className="py-3 px-4 text-xs text-slate-600 break-all">
                                {item.archiviataByEmail || '—'}
                              </td>
                              <td className="py-3 px-4 font-mono-tabular text-xs text-slate-600 whitespace-nowrap">
                                {formatShortDate(item.archiviataAt)}
                              </td>
                              <td className="py-3 px-4 text-right whitespace-nowrap">
                                <div className="inline-flex items-center justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedId(item.id)}
                                    className="min-h-[36px] px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-[#0B1F4D] text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer"
                                  >
                                    DETTAGLI
                                  </button>
                                  <button
                                    type="button"
                                    disabled={Boolean(restoringId)}
                                    onClick={() => handleRestoreCandidatura(item)}
                                    className="min-h-[36px] px-3.5 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 disabled:opacity-50 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                                  >
                                    {isRestoring ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <RotateCcw className="w-3.5 h-3.5" />
                                    )}
                                    <span>RIPRISTINA CANDIDATURA</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB: DOCUMENTI UFFICIALI */}
        {activeTab === 'documenti' && <AdminDocumentiSection adminUser={user} />}

        {/* TAB: SQUADRE ZONA VAR */}
        {activeTab === 'zonavar' && <AdminZonaVarSection />}

        {/* TAB: CREA INSERZIONE */}
        {activeTab === 'crea-inserzione' && <AdminCreaInserzioneSection />}

        {/* TAB: ACCESSI WHATSAPP */}
        {activeTab === 'whatsapp' && (
          <AdminWhatsappSection adminUser={user} candidature={activeCandidature} />
        )}

        {/* TAB 2: CONFIGURAZIONE */}
        {activeTab === 'configurazione' && (
          <form
            onSubmit={handleSaveConfig}
            className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5 max-w-3xl"
          >
            <div>
              <h2 className="font-display text-lg font-bold text-[#0B1F4D]">
                Configurazione pubblica (<span className="font-mono-tabular">configurazione/public</span>)
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-slate-600">
                I parametri salvati qui aggiornano i valori mostrati nella homepage, nella Waiting Room e nei passaggi della procedura guidata.
              </p>
            </div>

            {cfgError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs sm:text-sm text-red-800">
                {cfgError}
              </div>
            )}

            {cfgSaved && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs sm:text-sm text-emerald-800">
                Configurazione salvata correttamente su Firestore.
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Stagione
                </label>
                <input
                  type="text"
                  required
                  maxLength={16}
                  value={cfgForm.stagione}
                  onChange={(e) => setCfgForm({ ...cfgForm, stagione: e.target.value })}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Budget iniziale (crediti)
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  max={10000}
                  value={cfgForm.budgetIniziale}
                  onChange={(e) =>
                    setCfgForm({ ...cfgForm, budgetIniziale: Number(e.target.value) || 0 })
                  }
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-mono-tabular"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Modalità mercato
                </label>
                <input
                  type="text"
                  required
                  maxLength={40}
                  value={cfgForm.modalitaMercato}
                  onChange={(e) => setCfgForm({ ...cfgForm, modalitaMercato: e.target.value })}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Versione informativa privacy
                </label>
                <input
                  type="text"
                  required
                  maxLength={32}
                  value={cfgForm.versioneInformativa}
                  onChange={(e) =>
                    setCfgForm({ ...cfgForm, versioneInformativa: e.target.value })
                  }
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-mono-tabular"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Email operativa FANTA ITALIA CUP
              </label>
              <input
                type="email"
                required
                maxLength={160}
                value={cfgForm.emailOperativa}
                onChange={(e) => setCfgForm({ ...cfgForm, emailOperativa: e.target.value })}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Link Gruppo WhatsApp Provvisorio (Step 4)
              </label>
              <input
                type="url"
                maxLength={300}
                value={cfgForm.linkWhatsappProvvisorio}
                onChange={(e) =>
                  setCfgForm({ ...cfgForm, linkWhatsappProvvisorio: e.target.value })
                }
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-mono-tabular"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Link Gruppo WhatsApp Ufficiale (salvato in configurazione/private · sbloccato solo su stato COMPLETATO)
              </label>
              <input
                type="url"
                maxLength={300}
                value={cfgForm.linkWhatsappUfficiale}
                onChange={(e) =>
                  setCfgForm({ ...cfgForm, linkWhatsappUfficiale: e.target.value })
                }
                placeholder="https://chat.whatsapp.com/..."
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-mono-tabular"
              />
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={cfgForm.iscrizioniAperte}
                onChange={(e) => setCfgForm({ ...cfgForm, iscrizioniAperte: e.target.checked })}
                className="w-5 h-5 rounded border-slate-300 text-[#0B1F4D]"
              />
              <span className="text-sm font-medium text-slate-800">
                Candidature pubbliche aperte
              </span>
            </label>

            <div className="flex flex-wrap justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCfgForm(DEFAULT_PUBLIC_CONFIG)}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Ripristina valori predefiniti
              </button>
              <button
                type="submit"
                disabled={cfgSaving}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#0B1F4D] text-white text-sm font-bold hover:bg-[#153985] disabled:opacity-50 inline-flex items-center gap-2 cursor-pointer"
              >
                {cfgSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Salva configurazione</span>
              </button>
            </div>
          </form>
        )}

        {/* TAB 3: AMMINISTRATORI */}
        {activeTab === 'amministratori' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold text-[#0B1F4D]">
                  Amministratori autorizzati
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-slate-600">
                  Elenco letto dalla raccolta <span className="font-mono-tabular">amministratori</span>. La creazione e modifica dei profili amministrativi richiede il ruolo{' '}
                  <span className="font-mono-tabular">SUPER_ADMIN</span> tramite Firebase Console nel rispetto di{' '}
                  <span className="font-mono-tabular">firestore.rules</span>.
                </p>
              </div>
              <button
                type="button"
                onClick={loadAdmins}
                className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Aggiorna</span>
              </button>
            </div>

            {adminsError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs sm:text-sm text-red-800">
                {adminsError}
              </div>
            )}

            {adminsLoading ? (
              <div className="py-6 flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Caricamento amministratori...</span>
              </div>
            ) : adminsList.length === 0 ? (
              <p className="text-sm text-slate-500">Nessun documento trovato.</p>
            ) : (
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-200">
                {adminsList.map((adm) => (
                  <div
                    key={adm.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm"
                  >
                    <div>
                      <p className="font-bold text-slate-900">{adm.nome}</p>
                      <p className="text-xs text-slate-600">{adm.email}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono-tabular font-semibold text-[#0B1F4D]">
                        {adm.ruolo}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={
                          adm.attivo ? 'font-semibold text-emerald-700' : 'font-semibold text-red-700'
                        }
                      >
                        {adm.attivo ? 'Attivo' : 'Disattivato'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: DIAGNOSTICA FIREBASE */}
        {activeTab === 'diagnostica' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold text-[#0B1F4D]">
                  Verifica tecnica servizi Firebase
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-slate-600">
                  Controllo in tempo reale tramite{' '}
                  <span className="font-mono-tabular">verifyFirebaseServices()</span>.
                </p>
              </div>
              <button
                type="button"
                disabled={diagLoading}
                onClick={() => runDiagnostics(false)}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#0B1F4D] text-white text-xs font-semibold hover:bg-[#153985] disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                {diagLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                <span>Riesegui verifica</span>
              </button>
            </div>

            {diagnostics && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                {[
                  { label: 'Firebase App', item: diagnostics.appInitialized },
                  { label: 'Cloud Firestore', item: diagnostics.firestore },
                  { label: 'Firebase Authentication', item: diagnostics.auth },
                  { label: 'Firebase App Check (opzionale)', item: diagnostics.appCheck },
                ].map(({ label, item }) => (
                  <div
                    key={label}
                    className={`rounded-xl border p-4 space-y-1 ${
                      item.ok
                        ? 'border-emerald-200 bg-emerald-50/50'
                        : 'border-amber-200 bg-amber-50/50'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-slate-900">
                      {item.ok ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-amber-700" />
                      )}
                      <span>{label}</span>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed">{item.detail}</p>
                  </div>
                ))}
              </div>
            )}

            {appsScriptDiag && (
              <div
                className={`rounded-xl border p-4 space-y-2.5 text-sm ${
                  appsScriptDiag.webAppReachable &&
                  appsScriptDiag.firestoreReadProbeOk !== false &&
                  appsScriptDiag.endpointSecurityActive !== false
                    ? 'border-emerald-200 bg-emerald-50/50'
                    : 'border-amber-200 bg-amber-50/50'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    {appsScriptDiag.webAppReachable ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                    )}
                    <span>Backend Google Apps Script (sola lettura · 0 email)</span>
                  </div>
                  <button
                    type="button"
                    disabled={appsScriptProbeLoading || !appsScriptDiag.urlValidFormat}
                    onClick={runAppsScriptProbe}
                    className="min-h-[36px] px-3 py-1.5 rounded-lg bg-[#0B1F4D] text-white text-xs font-semibold hover:bg-[#153985] disabled:opacity-50 inline-flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                  >
                    {appsScriptProbeLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Activity className="w-3.5 h-3.5 text-[#D4AF37]" />
                    )}
                    <span>Test sola lettura Firestore + sicurezza</span>
                  </button>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">{appsScriptDiag.detail}</p>
                <div className="flex flex-wrap gap-3 text-[11px] font-mono-tabular text-slate-600">
                  <span>URL configurato: {appsScriptDiag.configured ? 'sì' : 'no'}</span>
                  <span>Web App GET: {appsScriptDiag.webAppReachable ? 'OK' : 'NO'}</span>
                  {appsScriptDiag.firestoreReadProbeOk !== null && (
                    <span>
                      Lettura Firestore OAuth: {appsScriptDiag.firestoreReadProbeOk ? 'OK' : 'KO'}
                    </span>
                  )}
                  {appsScriptDiag.endpointSecurityActive !== null && (
                    <span>
                      Blocco UNAUTHORIZED: {appsScriptDiag.endpointSecurityActive ? 'OK' : 'KO'}
                    </span>
                  )}
                </div>
              </div>
            )}

            {adminRecord.ruolo === 'SUPER_ADMIN' && <SuperAdminDiagnosticPanel />}
          </div>
        )}
      </div>

      <CandidaturaDetailModal
        candidatura={selectedCandidatura}
        adminUser={user}
        operationalEmail={publicConfig.emailOperativa}
        teamLock={selectedCandidatura ? (teamLocksMap[selectedCandidatura.id] ?? null) : null}
        onClose={() => setSelectedId(null)}
        onWhatsappAuthChanged={loadWhatsappAuthMap}
        onRestoreCandidatura={handleRestoreCandidatura}
      />

      {archiveTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="archive-confirm-title"
          onClick={() => {
            if (!archiveSubmitting) {
              setArchiveTarget(null);
            }
          }}
        >
          <div
            className="bg-white w-full max-w-md rounded-2xl border border-slate-200 shadow-xl p-6 space-y-5 text-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-center justify-center shrink-0">
                <Archive className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <p className="font-mono-tabular text-xs font-bold text-[#0B1F4D]">
                  {archiveTarget.codiceCandidatura} · {archiveTarget.nome} {archiveTarget.cognome}
                </p>
                <h2
                  id="archive-confirm-title"
                  className="font-display text-lg font-extrabold text-[#0B1F4D]"
                >
                  Conferma archiviazione candidatura
                </h2>
              </div>
            </div>

            <p className="text-sm text-slate-700 leading-relaxed">
              Vuoi davvero archiviare questa candidatura? Non sarà più visibile nell&apos;elenco principale, ma resterà conservata nello storico e potrà essere recuperata.
            </p>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 pt-1">
              <button
                type="button"
                disabled={archiveSubmitting}
                onClick={() => setArchiveTarget(null)}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs sm:text-sm font-bold hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
              >
                ANNULLA
              </button>
              <button
                type="button"
                disabled={archiveSubmitting}
                onClick={handleConfirmArchive}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-red-700 text-white text-xs sm:text-sm font-bold hover:bg-red-800 disabled:opacity-50 inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                {archiveSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>CONFERMA ARCHIVIAZIONE</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
