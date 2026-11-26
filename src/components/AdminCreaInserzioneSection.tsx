import {
  Copy,
  ExternalLink,
  Loader2,
  Megaphone,
  RefreshCw,
  Share2,
  Sparkles,
  Smartphone,
  CheckCircle2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchAvailableTeams, type AvailableTeamDto } from '../lib/officialFicupClient';

function formatShortDate(date: Date | null): string {
  if (!date) return '—';
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function AdminCreaInserzioneSection() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teams, setTeams] = useState<AvailableTeamDto[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [customText, setCustomText] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedTiktok, setCopiedTiktok] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  const loadEligibleTeams = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAvailableTeams(forceRefresh);
      // Strictly filter for ALLARME_ROSSO, LIBERA, and selectable
      const eligible = (res.teams ?? []).filter(
        (t) =>
          (t.sportCategory ?? 'REGOLARE') === 'ALLARME_ROSSO' &&
          t.availabilityStatus === 'LIBERA'
      );
      setTeams(eligible);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossibile caricare le squadre disponibili.');
      setTeams([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEligibleTeams(false);
  }, [loadEligibleTeams]);

  const portalUrl = typeof window !== 'undefined' ? window.location.origin : 'https://ficup-26-27.ai.studio';

  const generatedAdText = useMemo(() => {
    if (teams.length === 0) {
      return 'Al momento non ci sono squadre disponibili per il subentro.';
    }

    const teamLines = teams
      .map((t) => {
        const posStr = t.standingPos !== null ? ` — #${t.standingPos}° posizione (${t.standingPt ?? 0} pt)` : '';
        return `🔹 *${t.nome}*\n   Lega: ${t.serie}${posStr}`;
      })
      .join('\n\n');

    return `🏆 *FICUP 26/27 — NUOVE OPPORTUNITÀ DI SUBENTRO!*

⚽ Vuoi entrare nella nostra lega nazionale?

Sono disponibili nuove opportunità per prendere il comando di squadre FICUP e lottare per il titolo!

📋 *SQUADRE DISPONIBILI:*

${teamLines}

Non perdere l'occasione di entrare nella community FICUP e diventare protagonista della stagione!

👉 *CANDIDATI ORA:*
${portalUrl}

*FICUP — IL CALCIO FANTASTICO, SENZA LIMITI!*`;
  }, [teams, portalUrl]);

  // Sync customText when generatedAdText changes (if user hasn't heavily modified or on initial load)
  useEffect(() => {
    setCustomText(generatedAdText);
  }, [generatedAdText]);

  const tiktokText = useMemo(() => {
    if (teams.length === 0) {
      return 'Al momento non ci sono squadre disponibili per il subentro su FICUP 26/27! #FICUP #Fantacalcio';
    }
    const names = teams.map((t) => `${t.nome} (${t.serie})`).join(', ');
    return `🔥 Vuoi subentrare in FICUP 26/27? Squadre disponibili: ${names}! Candidati subito su ${portalUrl} #FICUP #Fantacalcio #Subentro #Fantalega`;
  }, [teams, portalUrl]);

  const handleCopy = async (textToCopy: string, isTiktok = false) => {
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(textToCopy);
      if (isTiktok) {
        setCopiedTiktok(true);
        window.setTimeout(() => setCopiedTiktok(false), 2500);
      } else {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      setCopyError('Impossibile copiare automaticamente negli appunti. Seleziona e copia il testo manualmente.');
    }
  };

  const handleWhatsAppShare = () => {
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(customText)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleFacebookShare = () => {
    handleCopy(customText);
    const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(portalUrl)}`;
    window.open(fbUrl, '_blank', 'noopener,noreferrer');
  };

  const handleOpenTiktok = () => {
    handleCopy(tiktokText, true);
    window.open('https://www.tiktok.com', '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-6">
      {/* Header Sezione */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0B1F4D] text-[#C69214] text-xs font-bold tracking-wide uppercase">
            <Megaphone className="w-3.5 h-3.5" />
            <span>Staff · Marketing & Social</span>
          </div>
          <h2 className="font-display text-xl sm:text-2xl font-black text-[#0B1F4D]">
            Crea Inserzione Multiplatform
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            Genera automaticamente annunci professionali per WhatsApp, Facebook e TikTok basati sulle squadre in Allarme Rosso realmente disponibili.
          </p>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={() => loadEligibleTeams(true)}
          className="min-h-[44px] px-4 py-2 rounded-xl bg-[#0B1F4D] text-white text-xs sm:text-sm font-bold hover:bg-[#153985] active:scale-95 transition-all inline-flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`w-4 h-4 text-[#D4AF37] ${loading ? 'animate-spin' : ''}`} />
          <span>Aggiorna Squadre</span>
        </button>
      </div>

      {/* Stato Caricamento / Errore */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs sm:text-sm text-red-900">
          <p className="font-bold">Errore di recupero dati</p>
          <p>{error}</p>
        </div>
      )}

      {/* Contenuto Principale: 2 Colonne su Desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Colonna Sinistra: Statistiche & Elenco Squadre Incluse */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-xs font-extrabold text-[#0B1F4D] uppercase tracking-wider">
                Squadre Incluse ({teams.length})
              </span>
              <span className="text-[11px] font-mono-tabular text-slate-500">
                Aggiornato: {formatShortDate(lastUpdated)}
              </span>
            </div>

            {loading && !lastUpdated ? (
              <div className="py-12 text-center space-y-2">
                <Loader2 className="w-6 h-6 text-[#0B1F4D] animate-spin mx-auto" />
                <p className="text-xs text-slate-500">Verifica squadre in corso...</p>
              </div>
            ) : teams.length === 0 ? (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-center space-y-2">
                <p className="text-xs font-bold text-amber-900">Nessuna squadra disponibile</p>
                <p className="text-[11px] text-amber-800">
                  Al momento non ci sono squadre in Allarme Rosso libere per il subentro. L&apos;annuncio indicherà che non vi sono disponibilità.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {teams.map((t) => (
                  <div
                    key={`${t.serieKey}:${t.clubId || t.id}`}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-[#0B1F4D] truncate">{t.nome}</p>
                      <p className="text-[10px] text-slate-500 truncate">
                        {t.serie} {t.standingPos !== null ? `· #${t.standingPos}° pos (${t.standingPt ?? 0} pt)` : ''}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[9px] uppercase shrink-0">
                      Disponibile
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-xl bg-sky-50 border border-sky-200 p-3.5 text-xs text-sky-950 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#0284C7]" />
                <span>Regole di Inclusione</span>
              </p>
              <p className="text-[11px] leading-relaxed text-sky-900">
                L&apos;inserzione include esclusivamente i club in <strong>Allarme Rosso</strong> con stato amministrativo <strong>Libera</strong>. Le squadre in Attenzione, Sotto Osservazione, Regolari o Bloccate sono escluse per garantire la conformità al regolamento.
              </p>
            </div>
          </div>
        </div>

        {/* Colonna Destra: Anteprima, Modifica e Pulsanti di Condivisione */}
        <div className="lg:col-span-7 space-y-5">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-extrabold text-[#0B1F4D] uppercase tracking-wider flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-[#C69214]" />
                <span>Anteprima e Modifica Annuncio</span>
              </h3>
              <button
                type="button"
                onClick={() => handleCopy(customText)}
                className="min-h-[36px] px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold text-[#0B1F4D] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copiato!' : 'Copia Testo'}</span>
              </button>
            </div>

            {/* Area di Modifica Testo */}
            <div className="space-y-1.5">
              <label htmlFor="ad-text-editor" className="text-xs font-bold text-slate-700">
                Testo dell&apos;annuncio (modificabile prima della condivisione):
              </label>
              <textarea
                id="ad-text-editor"
                rows={12}
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                className="w-full p-3.5 rounded-xl border border-slate-300 bg-slate-50/50 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B1F4D]"
              />
            </div>

            {/* Pulsanti di Condivisione Multiplatform */}
            <div className="space-y-3 pt-2">
              <p className="text-xs font-bold text-[#0B1F4D] uppercase tracking-wider">
                Condividi su Piattaforma
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* WhatsApp */}
                <button
                  type="button"
                  onClick={handleWhatsAppShare}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold inline-flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Condividi WhatsApp</span>
                </button>

                {/* Facebook */}
                <button
                  type="button"
                  onClick={handleFacebookShare}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold inline-flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Condividi Facebook</span>
                </button>

                {/* TikTok */}
                <button
                  type="button"
                  onClick={handleOpenTiktok}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-black active:scale-95 text-white text-xs font-bold inline-flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  <Smartphone className="w-4 h-4 text-[#D4AF37]" />
                  <span>{copiedTiktok ? 'Testo TikTok Copiato!' : 'Copia TikTok & Apri'}</span>
                </button>
              </div>

              {copyError && (
                <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {copyError}
                </p>
              )}

              <p className="text-[11px] text-slate-500 italic text-center pt-1">
                Nota: Le piattaforme social apriranno la condivisione/app ufficiale. La pubblicazione finale è effettuata dallo staff.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
