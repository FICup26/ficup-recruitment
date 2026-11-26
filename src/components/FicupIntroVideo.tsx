import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Globe,
  Loader2,
  Mail,
  Maximize2,
  MessageCircle,
  Minimize2,
  MousePointerClick,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CandidaturaStato } from '../lib/firestore';
import {
  INTRO_SCENES as SCENES,
  INTRO_VIDEO_TOTAL_DURATION_MS,
  ITALY_CITIES_12,
  ITALY_MAINLAND_PATH,
  ITALY_NETWORK_ROUTES,
  ITALY_SARDINIA_PATH,
  ITALY_SICILY_PATH,
  SQUAD_POSITIONS,
} from '../lib/ficupIntroScenes';
import { INTRO_VIDEO_MP4_URL, IntroAudioEngine } from '../lib/introAudioEngine';
import {
  buildProvisionalWhatsappUrl,
  isProvisionalWhatsappUnlockedByVideo,
  loadIntroVideoCompletion,
  saveIntroVideoCompletion,
} from '../lib/introVideoStorage';
import { FicupLogo } from './FicupLogo';

export { INTRO_VIDEO_TOTAL_DURATION_MS };

export interface FicupIntroVideoProps {
  codiceCandidatura: string;
  emailFantaleghe: string;
  nomeCandidato?: string;
  nomeSquadra?: string;
  serieSquadra?: string;
  tipoCandidatura?: 'LIBERA' | 'SUBENTRO';
  provisionalWhatsappUrl: string;
  canAccessProvisionalWa: boolean;
  realState: CandidaturaStato | null;
  variant?: 'phase1' | 'card';
  onUnlockStateChange?: (unlocked: boolean, justTriggered?: boolean) => void;
}



type PlayerPhase = 'idle' | 'playing' | 'paused' | 'completed';


function formatTimer(ms: number): string {
  const clamped = Math.max(0, Math.min(INTRO_VIDEO_TOTAL_DURATION_MS, ms));
  const totalSec = Math.floor(clamped / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function getSceneIndexAtElapsed(elapsedMs: number): number {
  for (let i = SCENES.length - 1; i >= 0; i -= 1) {
    if (elapsedMs >= SCENES[i].startMs) {
      return i;
    }
  }
  return 0;
}

/**
 * Verifica che il buffer inizi con un box MP4 ISO Base Media valido ("ftyp" ai byte 4..7).
 * Impedisce di scaricare pagine HTML, 404 SPA o file corrotti rinominati .mp4.
 */


const STADIUM_MOTES = [
  { id: 1, left: '8%', top: '22%', size: 3, delay: 0, dur: 4.2 },
  { id: 2, left: '19%', top: '68%', size: 2, delay: 0.6, dur: 4.8 },
  { id: 3, left: '34%', top: '16%', size: 3, delay: 1.1, dur: 4.0 },
  { id: 4, left: '49%', top: '76%', size: 2, delay: 0.4, dur: 4.9 },
  { id: 5, left: '64%', top: '24%', size: 3, delay: 1.4, dur: 4.5 },
  { id: 6, left: '78%', top: '64%', size: 2, delay: 0.5, dur: 5.1 },
  { id: 7, left: '89%', top: '28%', size: 3, delay: 1.7, dur: 4.3 },
];

const CELEBRATION_CONFETTI = [
  { id: 1, left: '6%', color: '#D4AF37', delay: 0.0, rot: 40, dur: 3.1 },
  { id: 2, left: '14%', color: '#10B981', delay: 0.3, rot: -55, dur: 2.9 },
  { id: 3, left: '23%', color: '#38BDF8', delay: 0.12, rot: 65, dur: 3.3 },
  { id: 4, left: '33%', color: '#FDE68A', delay: 0.45, rot: -35, dur: 2.8 },
  { id: 5, left: '67%', color: '#F43F5E', delay: 0.22, rot: 50, dur: 3.0 },
  { id: 6, left: '76%', color: '#10B981', delay: 0.08, rot: -60, dur: 3.2 },
  { id: 7, left: '85%', color: '#D4AF37', delay: 0.35, rot: 45, dur: 2.7 },
  { id: 8, left: '93%', color: '#38BDF8', delay: 0.18, rot: -45, dur: 3.1 },
];

const CELEBRATION_STARS = [
  { id: 1, left: '10%', top: '18%', delay: 0.1 },
  { id: 2, left: '22%', top: '72%', delay: 0.5 },
  { id: 3, left: '79%', top: '20%', delay: 0.3 },
  { id: 4, left: '89%', top: '70%', delay: 0.7 },
];

const FINALE_CONFETTI = [
  { id: 1, left: '10%', color: '#D4AF37', delay: 0.0, rot: 25 },
  { id: 2, left: '20%', color: '#10B981', delay: 0.2, rot: -40 },
  { id: 3, left: '30%', color: '#38BDF8', delay: 0.1, rot: 55 },
  { id: 4, left: '42%', color: '#FDE68A', delay: 0.3, rot: -20 },
  { id: 5, left: '54%', color: '#FFFFFF', delay: 0.14, rot: 45 },
  { id: 6, left: '66%', color: '#D4AF37', delay: 0.08, rot: -50 },
  { id: 7, left: '78%', color: '#10B981', delay: 0.25, rot: 35 },
  { id: 8, left: '89%', color: '#38BDF8', delay: 0.12, rot: -30 },
];

export function FicupIntroVideo({
  codiceCandidatura,
  emailFantaleghe,
  nomeCandidato,
  nomeSquadra,
  serieSquadra,
  tipoCandidatura,
  provisionalWhatsappUrl,
  canAccessProvisionalWa,
  realState,
  variant = 'card',
  onUnlockStateChange,
}: FicupIntroVideoProps) {
  const prefersReducedMotion = Boolean(useReducedMotion());
  const portalStageRef = useRef<HTMLDivElement | null>(null);
  const audioEngineRef = useRef<IntroAudioEngine | null>(null);
  const onUnlockStateChangeRef = useRef(onUnlockStateChange);
  onUnlockStateChangeRef.current = onUnlockStateChange;

  const [phase, setPhase] = useState<PlayerPhase>('idle');
  const [stageOpen, setStageOpen] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [unlockedByVideo, setUnlockedByVideo] = useState(false);
  const [justUnlockedPulse, setJustUnlockedPulse] = useState(false);

  const [audioEnabled, setAudioEnabled] = useState(true);
  const [volumePercent, setVolumePercent] = useState(80);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);



  const isNativeFullscreenSupported =
    typeof document !== 'undefined' &&
    Boolean(
      document.fullscreenEnabled &&
        typeof HTMLElement.prototype.requestFullscreen === 'function'
    );

  const getOrCreateAudio = useCallback((): IntroAudioEngine => {
    if (!audioEngineRef.current) {
      audioEngineRef.current = new IntroAudioEngine();
    }
    return audioEngineRef.current;
  }, []);



  useEffect(() => {
    audioEngineRef.current?.setPlaying(false);
    audioEngineRef.current?.resetTimeline();

    const stored = loadIntroVideoCompletion(codiceCandidatura, emailFantaleghe);
    const unlocked = isProvisionalWhatsappUnlockedByVideo(stored);

    setStageOpen(false);
    setUnlockedByVideo(unlocked);
    setJustUnlockedPulse(false);
    setElapsedMs(stored?.videoCompleted ? INTRO_VIDEO_TOTAL_DURATION_MS : 0);
    setPhase(unlocked ? 'completed' : 'idle');
    window.setTimeout(() => {
      onUnlockStateChangeRef.current?.(unlocked, false);
    }, 0);
  }, [codiceCandidatura, emailFantaleghe]);

  useEffect(() => {
    return () => {
      audioEngineRef.current?.dispose();
      audioEngineRef.current = null;
      if (typeof document !== 'undefined') {
        document.body.style.overflow = '';
      }
    };
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }
    if (stageOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
    return undefined;
  }, [stageOpen]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }
    const onFsChange = () => {
      setNativeFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Orologio rAF sincronizzato sui 90 secondi reali
  useEffect(() => {
    if (!stageOpen || phase !== 'playing') {
      audioEngineRef.current?.setPlaying(false);
      return;
    }

    const engine = audioEngineRef.current;
    if (engine) {
      engine.setPlaying(true, elapsedMs);
      setAudioBlocked(engine.isBlocked());
    }

    let rafId = 0;
    let lastTimestamp = performance.now();

    const tick = (now: number) => {
      const rawDelta = now - lastTimestamp;
      lastTimestamp = now;
      const safeDelta = rawDelta > 0 && rawDelta <= 250 && !document.hidden ? rawDelta : 0;

      setElapsedMs((prev) => {
        const next = Math.min(INTRO_VIDEO_TOTAL_DURATION_MS, prev + safeDelta);
        audioEngineRef.current?.syncPlayback(next);
        return next;
      });

      rafId = window.requestAnimationFrame(tick);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        audioEngineRef.current?.setPlaying(false);
        setPhase((cur) => (cur === 'playing' ? 'paused' : cur));
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    rafId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(rafId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageOpen, phase]);

  const unlockProvisionalWhatsapp = useCallback(
    (reachedFullEnd: boolean) => {
      saveIntroVideoCompletion({
        codiceCandidatura,
        emailFantaleghe,
        videoOpened: true,
        videoCompleted: reachedFullEnd,
        userConfirmed: true,
      });
      setUnlockedByVideo((prev) => {
        const wasAlreadyUnlocked = prev;
        setJustUnlockedPulse(true);
        window.setTimeout(() => {
          onUnlockStateChangeRef.current?.(true, !wasAlreadyUnlocked);
        }, 0);
        return true;
      });
    },
    [codiceCandidatura, emailFantaleghe]
  );

  // Chiusura naturale al raggiungimento esatto dei 90 secondi
  useEffect(() => {
    if (phase === 'playing' && elapsedMs >= INTRO_VIDEO_TOTAL_DURATION_MS) {
      setPhase('completed');
      audioEngineRef.current?.fadeOutAndStop();

      if (typeof document !== 'undefined' && document.fullscreenElement) {
        document.exitFullscreen().catch(() => null);
      }
      setNativeFullscreen(false);
      setStageOpen(false);
      unlockProvisionalWhatsapp(true);
    }
  }, [phase, elapsedMs, unlockProvisionalWhatsapp]);

  const currentSceneIndex = getSceneIndexAtElapsed(elapsedMs);
  const currentScene = SCENES[currentSceneIndex] ?? SCENES[0];
  const remainingMs = Math.max(0, INTRO_VIDEO_TOTAL_DURATION_MS - elapsedMs);
  const progressRatio = Math.min(1, Math.max(0, elapsedMs / INTRO_VIDEO_TOTAL_DURATION_MS));

  const launchFullscreenPlayer = () => {
    const engine = getOrCreateAudio();
    engine.resetTimeline();
    engine.setVolume(volumePercent / 100);

    // Imposta Audio ON di default all'apertura del videoclip e avvia sincronicamente nel gesto utente
    setAudioEnabled(true);
    setAudioBlocked(false);
    setElapsedMs(0);
    setStageOpen(true);
    setPhase('playing');

    engine
      .startFromUserGesture(0)
      .then((ok) => {
        setAudioBlocked(!ok);
      })
      .catch(() => {
        setAudioBlocked(true);
      });
  };

  // Primo tocco sullo schermo sblocca subito l'audio se il browser mobile lo aveva bloccato
  const handleStageFirstTapUnlock = () => {
    if (!audioBlocked || !audioEnabled) {
      return;
    }
    const engine = getOrCreateAudio();
    engine.setVolume(volumePercent / 100);
    engine
      .startFromUserGesture(elapsedMs)
      .then((ok) => {
        setAudioBlocked(!ok);
      })
      .catch(() => {
        setAudioBlocked(true);
      });
  };

  const handleClosePlayer = () => {
    audioEngineRef.current?.fadeOutAndStop();
    if (typeof document !== 'undefined' && document.fullscreenElement) {
      document.exitFullscreen().catch(() => null);
    }
    setNativeFullscreen(false);
    setStageOpen(false);
    const completedAll = elapsedMs >= INTRO_VIDEO_TOTAL_DURATION_MS - 300;
    setPhase('completed');
    unlockProvisionalWhatsapp(completedAll);
  };

  const handleTogglePause = async () => {
    if (phase === 'playing') {
      setPhase('paused');
      audioEngineRef.current?.setPlaying(false);
    } else if (phase === 'paused') {
      if (audioEnabled) {
        const engine = getOrCreateAudio();
        const unlocked = await engine.startFromUserGesture(elapsedMs);
        setAudioBlocked(!unlocked);
      }
      setPhase('playing');
    }
  };

  const handleToggleAudio = async () => {
    const nextEnabled = audioBlocked ? true : !audioEnabled;
    setAudioEnabled(nextEnabled);
    const engine = getOrCreateAudio();
    engine.setVolume(volumePercent / 100);
    if (nextEnabled) {
      const unlocked =
        phase === 'playing'
          ? await engine.startFromUserGesture(elapsedMs)
          : await engine.setEnabled(true);
      setAudioBlocked(!unlocked);
    } else {
      await engine.setEnabled(false);
      setAudioBlocked(false);
    }
  };

  const handleVolumeChange = async (nextPct: number) => {
    const clamped = Math.max(0, Math.min(100, nextPct));
    setVolumePercent(clamped);
    const engine = getOrCreateAudio();
    engine.setVolume(clamped / 100);
    if (clamped === 0 && audioEnabled) {
      setAudioEnabled(false);
      await engine.setEnabled(false);
    } else if (clamped > 0 && !audioEnabled) {
      setAudioEnabled(true);
      const unlocked =
        phase === 'playing'
          ? await engine.startFromUserGesture(elapsedMs)
          : await engine.setEnabled(true);
      setAudioBlocked(!unlocked);
    }
  };

  const handleToggleNativeFullscreen = async () => {
    if (!isNativeFullscreenSupported) {
      return;
    }
    if (!document.fullscreenElement && portalStageRef.current) {
      try {
        await portalStageRef.current.requestFullscreen();
        setNativeFullscreen(true);
      } catch {
        setNativeFullscreen(false);
      }
    } else if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        // Ignore
      }
      setNativeFullscreen(false);
    }
  };



  const prefilledWhatsappLink = buildProvisionalWhatsappUrl(
    provisionalWhatsappUrl,
    {
      codiceCandidatura,
      nomeCandidato,
      nomeSquadra: tipoCandidatura === 'LIBERA' ? '' : nomeSquadra,
      serieSquadra: tipoCandidatura === 'LIBERA' ? '' : serieSquadra,
      tipoCandidatura,
    }
  );
  const isUnlockedForWhatsapp =
    unlockedByVideo && canAccessProvisionalWa && Boolean(prefilledWhatsappLink);

  // Fullscreen reale 100% viewport (100dvh, responsive portrait/landscape Android & desktop)
  const fullscreenStagePortal =
    stageOpen && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={portalStageRef}
            onPointerDown={handleStageFirstTapUnlock}
            role="dialog"
            aria-modal="true"
            aria-label="Videoclip introduttivo ufficiale FANTA ITALIA CUP 90 secondi"
            className="fixed inset-0 z-[9999] w-full h-[100dvh] m-0 p-0 border-0 rounded-none overflow-hidden bg-[#020714] text-white select-none flex flex-col justify-between"
          >
            {/* Sfondo atmosferico full-bleed */}
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_15%,rgba(21,57,133,0.68)_0%,#06112E_58%,#020714_100%)] pointer-events-none"
            />

            {/* Movimento di camera cinematografico GPU (solo transform) */}
            <motion.div
              aria-hidden="true"
              animate={
                prefersReducedMotion || phase !== 'playing'
                  ? { scale: 1, x: 0 }
                  : { scale: [1, 1.05, 1.015], x: [-6, 6, -6] }
              }
              transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute inset-0 pointer-events-none will-change-transform"
            >
              <div
                className="absolute -top-28 left-[8%] w-56 sm:w-64 h-[76vh] bg-gradient-to-b from-[#FDE68A]/18 via-[#FDE68A]/5 to-transparent -rotate-12 pointer-events-none"
                style={{ opacity: phase === 'playing' ? 1 : 0.35 }}
              />
              <div
                className="absolute -top-28 right-[8%] w-56 sm:w-64 h-[76vh] bg-gradient-to-b from-[#FDE68A]/18 via-[#FDE68A]/5 to-transparent rotate-12 pointer-events-none"
                style={{ opacity: phase === 'playing' ? 1 : 0.35 }}
              />
              <div className="absolute inset-x-0 bottom-0 h-[32dvh] bg-[radial-gradient(ellipse_at_50%_100%,rgba(16,185,129,0.24)_0%,transparent_75%)] pointer-events-none" />
            </motion.div>

            {/* Particelle GPU leggere */}
            {!prefersReducedMotion && phase === 'playing' && (
              <div aria-hidden="true" className="absolute inset-0 overflow-hidden pointer-events-none">
                {STADIUM_MOTES.map((mote) => (
                  <motion.span
                    key={mote.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: [0.2, 0.75, 0.2], y: [-10, 10, -10] }}
                    transition={{
                      duration: mote.dur,
                      delay: mote.delay,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                    style={{
                      left: mote.left,
                      top: mote.top,
                      width: mote.size,
                      height: mote.size,
                    }}
                    className="absolute rounded-full bg-[#FDE68A] will-change-transform"
                  />
                ))}
              </div>
            )}

            {/* TOP HUD COMPATTO A RIGA UNICA: discreto, non sottrae spazio alle scene */}
            <header
              className="relative z-20 shrink-0 w-full bg-gradient-to-b from-black/85 via-black/45 to-transparent"
              style={{
                paddingTop: 'max(0.45rem, env(safe-area-inset-top))',
                paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
                paddingRight: 'max(0.75rem, env(safe-area-inset-right))',
                paddingBottom: '0.45rem',
              }}
            >
              <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-mono-tabular text-[11px] sm:text-xs font-extrabold text-[#FDE68A] shrink-0">
                    {currentScene.id}/{SCENES.length}
                  </span>
                  <span aria-hidden="true" className="text-white/35 text-xs shrink-0">
                    ·
                  </span>
                  <span className="text-[11px] sm:text-xs font-semibold text-white/95 truncate">
                    {currentScene.title}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleToggleAudio}
                    aria-label={
                      audioEnabled && !audioBlocked
                        ? 'Audio attivo, tocca per disattivare'
                        : 'Attiva audio'
                    }
                    className={`h-8 px-2.5 rounded-lg border text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap ${
                      audioBlocked
                        ? 'bg-[#D4AF37] text-[#071436] border-[#FDE68A] animate-pulse'
                        : audioEnabled && volumePercent > 0
                          ? 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-400/50 text-emerald-200'
                          : 'bg-white/10 hover:bg-white/20 border-white/20 text-slate-300'
                    }`}
                  >
                    {audioEnabled && !audioBlocked && volumePercent > 0 ? (
                      <Volume2 className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                    ) : (
                      <VolumeX className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span>
                      {audioBlocked
                        ? 'Attiva Audio'
                        : audioEnabled && volumePercent > 0
                          ? 'Audio ON'
                          : 'Audio OFF'}
                    </span>
                  </button>

                  <label className="hidden md:inline-flex items-center gap-1.5 h-8 px-2 rounded-lg bg-white/10 border border-white/15">
                    <span className="sr-only">Volume audio</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={audioEnabled ? volumePercent : 0}
                      onChange={(e) => handleVolumeChange(Number(e.target.value))}
                      aria-label="Volume audio"
                      className="w-16 accent-[#D4AF37] cursor-pointer"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={handleTogglePause}
                    aria-label={phase === 'paused' ? 'Riprendi videoclip' : 'Metti in pausa'}
                    className="h-8 px-2.5 rounded-lg bg-white/12 hover:bg-white/22 border border-white/20 text-[11px] font-bold text-white inline-flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap"
                  >
                    {phase === 'paused' ? (
                      <>
                        <Play className="w-3 h-3 fill-current text-[#FDE68A] shrink-0" />
                        <span>Play</span>
                      </>
                    ) : (
                      <>
                        <Pause className="w-3 h-3 text-[#FDE68A] shrink-0" />
                        <span className="hidden sm:inline">Pausa</span>
                      </>
                    )}
                  </button>

                  {isNativeFullscreenSupported && (
                    <button
                      type="button"
                      onClick={handleToggleNativeFullscreen}
                      aria-label={
                        nativeFullscreen
                          ? 'Esci da schermo intero'
                          : 'Espandi a schermo intero'
                      }
                      className="h-8 w-8 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white inline-flex items-center justify-center cursor-pointer transition-colors shrink-0"
                    >
                      {nativeFullscreen ? (
                        <Minimize2 className="w-3.5 h-3.5" />
                      ) : (
                        <Maximize2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleClosePlayer}
                    aria-label="Chiudi il videoclip e prosegui"
                    className="h-8 px-2.5 rounded-lg bg-white/95 text-[#071436] hover:bg-[#FDE68A] text-[11px] font-extrabold inline-flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap shrink-0"
                  >
                    <X className="w-3.5 h-3.5 shrink-0" />
                    <span>Chiudi</span>
                  </button>
                </div>
              </div>

              {audioBlocked && phase === 'playing' && (
                <div className="max-w-7xl mx-auto mt-1.5 text-center sm:text-left">
                  <button
                    type="button"
                    onClick={handleToggleAudio}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#D4AF37]/20 border border-[#FDE68A]/50 text-[11px] font-semibold text-[#FDE68A] cursor-pointer"
                  >
                    <Volume2 className="w-3 h-3 shrink-0" />
                    <span>Tocca qui o sullo schermo per avviare la musica</span>
                  </button>
                </div>
              )}
            </header>

            {/* PALCO CENTRALE RESPONSIVE: centrato, scalato e protetto da overflow/tagli */}
            <main className="relative z-10 min-h-0 flex-1 w-full overflow-y-auto overscroll-contain flex items-center justify-center px-3 sm:px-8 py-1.5 sm:py-3">
              <div className="w-full max-w-5xl mx-auto my-auto">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentScene.id}
                    initial={
                      prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.985, y: 8 }
                    }
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={
                      prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 1.01, y: -6 }
                    }
                    transition={{ duration: prefersReducedMotion ? 0.16 : 0.42, ease: 'easeOut' }}
                    className="w-full"
                  >
                    <CinematicSceneViewport90s
                      sceneNumber={currentScene.id}
                      sceneElapsedMs={Math.max(0, elapsedMs - currentScene.startMs)}
                      codiceCandidatura={codiceCandidatura || 'FICUP26-XXXXXX'}
                      reducedMotion={prefersReducedMotion}
                    />
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* OVERLAY PAUSA */}
              {phase === 'paused' && (
                <div className="fixed inset-0 z-30 bg-[#020714]/86 backdrop-blur-xs flex flex-col items-center justify-center p-5 text-center space-y-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#FDE68A]">
                    In pausa · {formatTimer(elapsedMs)} / 01:30
                  </p>
                  <p className="font-display text-2xl sm:text-3xl font-black text-white">
                    Videoclip FICUP in pausa
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={handleTogglePause}
                      className="h-10 px-5 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#E7C860] to-[#C69214] text-[#071436] text-xs font-black inline-flex items-center gap-2 cursor-pointer hover:brightness-105 transition-all"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Riprendi</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleClosePlayer}
                      className="h-10 px-5 rounded-xl border border-white/30 bg-white/10 text-white text-xs font-bold hover:bg-white/20 transition-colors cursor-pointer"
                    >
                      Chiudi e continua
                    </button>
                  </div>
                </div>
              )}
            </main>

            {/* BOTTOM HUD ULTRA-COMPATTO */}
            <footer
              className="relative z-20 shrink-0 w-full bg-gradient-to-t from-black/90 via-black/55 to-transparent"
              style={{
                paddingTop: '0.4rem',
                paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
                paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
                paddingRight: 'max(0.75rem, env(safe-area-inset-right))',
              }}
            >
              <div className="max-w-7xl mx-auto space-y-1">
                <div
                  className="relative h-1.5 w-full rounded-full bg-white/15 overflow-hidden pointer-events-none"
                  aria-hidden="true"
                >
                  <div
                    className="h-full w-full origin-left bg-gradient-to-r from-[#D4AF37] via-[#FDE68A] to-emerald-400 transition-transform duration-150 ease-linear"
                    style={{ transform: `scaleX(${progressRatio})` }}
                  />
                </div>

                <div className="flex items-center justify-between gap-2 text-[10px] sm:text-xs text-slate-300 font-mono-tabular">
                  <span>
                    <strong className="text-white">{formatTimer(elapsedMs)}</strong> / 01:30
                  </span>
                  <span className="hidden sm:inline font-sans text-slate-400 truncate">
                    Presentazione ufficiale FANTA ITALIA CUP · Puoi chiudere in qualsiasi momento
                  </span>
                  <span>
                    -<strong className="text-[#FDE68A]">{formatTimer(remainingMs)}</strong>
                  </span>
                </div>
              </div>
            </footer>
          </div>,
          document.body
        )
      : null;

  const actionButtons = (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3">
        <button
          type="button"
          onClick={launchFullscreenPlayer}
          className="min-h-[52px] px-6 py-3 rounded-2xl bg-gradient-to-r from-[#D4AF37] via-[#E7C860] to-[#C69214] text-[#071436] text-sm sm:text-base font-black tracking-wide hover:brightness-105 active:scale-[0.98] transition-all inline-flex items-center justify-center gap-2.5 shadow-[0_14px_30px_-10px_rgba(212,175,55,0.55)] cursor-pointer"
        >
          {unlockedByVideo ? (
            <>
              <RotateCcw className="w-4 h-4 shrink-0" />
              <span>GUARDA IL VIDEOCLIP FICUP</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current shrink-0" />
              <span>GUARDA IL VIDEOCLIP FICUP</span>
            </>
          )}
        </button>
      </div>
    </div>
  );

  // VARIANTE FASE 1 (Post-invio snello su RecruitmentStep6)
  if (variant === 'phase1') {
    return (
      <div className="space-y-4">
        {actionButtons}

        <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-200">
          <span className="font-mono-tabular font-bold text-[#FDE68A]">01:30 · MP4 H.264/AAC</span>
          <span aria-hidden="true" className="text-white/30">
            ·
          </span>
          <span>
            {unlockedByVideo
              ? 'Gruppo WhatsApp Provvisorio sbloccato qui sotto'
              : 'Apri il videoclip per sbloccare il Gruppo WhatsApp Provvisorio'}
          </span>
        </div>

        {fullscreenStagePortal}
      </div>
    );
  }

  // VARIANTE AREA PERSONALE
  return (
    <section
      id="ficup-intro-video-gate"
      aria-labelledby="ficup-intro-video-heading"
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#071436] via-[#0B1F4D] to-[#112A68] text-white p-6 sm:p-8 shadow-lg"
    >
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#D4AF37] via-[#FDE68A] to-emerald-400"
      />

      <div className="relative z-10 space-y-6">
        <div className="space-y-4">
          <div className="space-y-2 max-w-3xl">
            <div className="flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.2em] text-[#FDE68A]">
              <Sparkles className="w-4 h-4 text-[#D4AF37]" />
              <span>Presentazione FICUP · 01:30 · Scaricabile in MP4</span>
            </div>
            <h2
              id="ficup-intro-video-heading"
              className="font-display text-xl sm:text-3xl font-black tracking-tight text-white"
            >
              IL TUO VIAGGIO IN FANTA ITALIA CUP COMINCIA QUI
            </h2>
            <p className="text-sm sm:text-base text-slate-200 leading-relaxed">
              Guarda il nostro videoclip introduttivo completo: dalla candidatura al Gruppo Provvisorio, fino all&apos;invito ufficiale e alla tua rosa su Fantaleghe.
            </p>
          </div>

          {actionButtons}
        </div>

        <div className="pt-4 border-t border-white/15">
          {!canAccessProvisionalWa ? (
            <div className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-200">
              <AlertCircle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
              <span>
                {realState === 'RESPINTO'
                  ? 'L’accesso al Gruppo WhatsApp Provvisorio non è disponibile per candidature non accolte.'
                  : 'Inserisci una candidatura valida per abilitare il collegamento.'}
              </span>
            </div>
          ) : isUnlockedForWhatsapp ? (
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Gruppo Provvisorio sbloccato</span>
                </p>
                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                  Presentati brevemente nel gruppo provvisorio con il tuo codice personale{' '}
                  <strong className="font-mono-tabular text-[#FDE68A]">
                    {codiceCandidatura}
                  </strong>
                  .
                </p>
              </div>

              <motion.a
                href={prefilledWhatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                animate={
                  justUnlockedPulse && !prefersReducedMotion
                    ? {
                        scale: [1, 1.03, 1],
                        boxShadow: [
                          '0 0 0 0 rgba(16,185,129,0)',
                          '0 0 28px 6px rgba(52,211,153,0.55)',
                          '0 0 12px 2px rgba(52,211,153,0.25)',
                        ],
                      }
                    : undefined
                }
                transition={{ duration: 1.6, repeat: justUnlockedPulse ? 3 : 0 }}
                className="min-h-[54px] px-6 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-[#042419] text-sm font-black tracking-wide transition-colors inline-flex items-center justify-center gap-2.5 shadow-lg shrink-0"
              >
                <MessageCircle className="w-5 h-5" />
                <span>ENTRA NEL GRUPPO WHATSAPP PROVVISORIO</span>
                <ExternalLink className="w-4 h-4 opacity-80" />
              </motion.a>
            </div>
          ) : (
            <p className="text-xs sm:text-sm text-slate-300">
              Apri il videoclip qui sopra per sbloccare subito il pulsante per il{' '}
              <strong className="text-white">Gruppo WhatsApp Provvisorio</strong>.
            </p>
          )}
        </div>
      </div>

      {fullscreenStagePortal}
    </section>
  );
}

/**
 * 8 Scene cinematografiche responsive su 90 secondi totali.
 * Dimensioni fluide via clamp() e limiti dvh affinché nessun testo o illustrazione
 * venga mai tagliato o sovrapposto su Android piccoli e schermi grandi.
 */
function CinematicSceneViewport90s({
  sceneNumber,
  sceneElapsedMs,
  codiceCandidatura,
  reducedMotion,
}: {
  sceneNumber: number;
  sceneElapsedMs: number;
  codiceCandidatura: string;
  reducedMotion: boolean;
}) {
  // SCENA 1 (00-11s) — Stadio spettacolare, fari e Logo Ufficiale FICUP
  if (sceneNumber === 1) {
    const showLogo = sceneElapsedMs >= 800;
    const showTitle = sceneElapsedMs >= 2000;
    const showSub = sceneElapsedMs >= 4200;
    return (
      <div className="relative flex flex-col items-center justify-center text-center py-1 sm:py-3 space-y-2.5 sm:space-y-4">
        <svg
          aria-hidden="true"
          viewBox="0 0 960 240"
          className="w-full max-w-2xl h-[clamp(3.8rem,13dvh,8.5rem)] opacity-90 pointer-events-none"
        >
          <defs>
            <linearGradient id="ficupTurf90" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#059669" stopOpacity="0.65" />
              <stop offset="100%" stopColor="#022C22" stopOpacity="0.15" />
            </linearGradient>
          </defs>
          <path
            d="M90 70 Q480 15 870 70"
            fill="none"
            stroke="#FDE68A"
            strokeOpacity="0.35"
            strokeWidth="2"
          />
          {[160, 320, 480, 640, 800].map((cx, idx) => (
            <motion.circle
              key={cx}
              cx={cx}
              cy={idx === 2 ? 40 : 54}
              r={5}
              fill="#FDE68A"
              animate={reducedMotion ? { opacity: 0.9 } : { opacity: [0.35, 1, 0.7] }}
              transition={{ duration: 1.8, delay: idx * 0.16, repeat: Infinity }}
            />
          ))}
          <polygon
            points="150,105 810,105 930,232 30,232"
            fill="url(#ficupTurf90)"
            stroke="#34D399"
            strokeOpacity="0.45"
            strokeWidth="1.5"
          />
          <line
            x1="480"
            y1="105"
            x2="480"
            y2="232"
            stroke="#E2E8F0"
            strokeOpacity="0.45"
            strokeWidth="2"
          />
          <ellipse
            cx="480"
            cy="168"
            rx="100"
            ry="28"
            fill="none"
            stroke="#E2E8F0"
            strokeOpacity="0.45"
            strokeWidth="2"
          />
          <circle cx="480" cy="168" r="4.5" fill="#FDE68A" />
        </svg>

        <motion.div
          initial={reducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.86 }}
          animate={{ opacity: showLogo ? 1 : 0.2, scale: showLogo ? 1 : 0.92 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        >
          <div className="p-1.5 sm:p-2 rounded-2xl bg-white shadow-[0_0_50px_rgba(212,175,55,0.5)] inline-block">
            <FicupLogo size="hero" className="w-16 h-16 sm:w-24 sm:h-24" />
          </div>
        </motion.div>

        <motion.div
          initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
          animate={{ opacity: showTitle ? 1 : 0, y: showTitle ? 0 : 12 }}
          transition={{ duration: 0.5 }}
          className="space-y-1.5 sm:space-y-2.5 max-w-2xl px-1"
        >
          <p className="text-[11px] sm:text-xs font-black uppercase tracking-[0.22em] text-[#FDE68A]">
            FANTA ITALIA CUP · STAGIONE 26/27
          </p>
          <h3 className="font-display text-[clamp(1.45rem,5.4vw,3.35rem)] leading-[1.1] font-black tracking-tight text-white text-balance break-words">
            L&apos;universo del Fantacalcio.
          </h3>
          {showSub && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-[clamp(0.85rem,2.4vw,1.2rem)] leading-snug text-slate-200 font-medium text-balance"
            >
              Una lega nazionale gratuita. Una passione che unisce tutta l&apos;Italia.
            </motion.p>
          )}
        </motion.div>
      </div>
    );
  }

  // SCENA 2 (11-22s) — 1. FICUP UNISCE L'ITALIA (Mappa grande geografica + 12 città animate)
    // SCENA 2 (11-22s) — 1. FICUP UNISCE L'ITALIA (Effetto fibra ottica luminosa + 12 città)
  if (sceneNumber === 2) {
    const showCodeCard = sceneElapsedMs >= 1600;
    return (
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-7 items-center py-1">
        <div className="md:col-span-6 flex justify-center">
          <motion.svg
            viewBox="-45 -15 490 500"
            initial={reducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="w-[clamp(16rem,72vw,28rem)] max-h-[42dvh] md:max-h-[64dvh] h-auto filter drop-shadow-[0_0_32px_rgba(56,189,248,0.42)]"
          >
            <defs>
              <linearGradient id="fiberGlowGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.85" />
                <stop offset="50%" stopColor="#818CF8" stopOpacity="0.65" />
                <stop offset="100%" stopColor="#34D399" stopOpacity="0.8" />
              </linearGradient>
              <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Glowing fiber-optic interwoven silhouette */}
            <motion.path
              d={ITALY_MAINLAND_PATH}
              fill="rgba(8,28,65,0.78)"
              stroke="url(#fiberGlowGrad)"
              strokeWidth="3.8"
              strokeLinejoin="round"
              filter="url(#neonGlow)"
              initial={reducedMotion ? { pathLength: 1 } : { pathLength: 0.08, opacity: 0.3 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 1.3, ease: 'easeInOut' }}
            />
            <motion.path
              d={ITALY_SICILY_PATH}
              fill="rgba(8,28,65,0.78)"
              stroke="url(#fiberGlowGrad)"
              strokeWidth="3.4"
              strokeLinejoin="round"
              filter="url(#neonGlow)"
              initial={reducedMotion ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.4 }}
            />
            <motion.path
              d={ITALY_SARDINIA_PATH}
              fill="rgba(8,28,65,0.78)"
              stroke="url(#fiberGlowGrad)"
              strokeWidth="3.4"
              strokeLinejoin="round"
              filter="url(#neonGlow)"
              initial={reducedMotion ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.5 }}
            />

            {/* Glowing optical energy network routes */}
            {ITALY_NETWORK_ROUTES.map(([fromId, toId], idx) => {
              const from = ITALY_CITIES_12.find((c) => c.id === fromId);
              const to = ITALY_CITIES_12.find((c) => c.id === toId);
              if (!from || !to) return null;
              return (
                <motion.line
                  key={`${fromId}-${toId}`}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke="#FDE68A"
                  strokeWidth="2.4"
                  strokeOpacity="0.9"
                  strokeDasharray="6 3"
                  strokeLinecap="round"
                  initial={reducedMotion ? { pathLength: 1 } : { pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 0.95 }}
                  transition={{ duration: 0.9, delay: 0.7 + idx * 0.1 }}
                />
              );
            })}

            {/* 12 Cities with luminous pulses and progressive labels */}
            {ITALY_CITIES_12.map((city, idx) => {
              const delaySec = 0.5 + (city.wave - 1) * 0.55 + (idx % 3) * 0.14;
              return (
                <motion.g
                  key={city.id}
                  initial={reducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.45, delay: delaySec }}
                >
                  {!reducedMotion && (
                    <motion.circle
                      cx={city.x}
                      cy={city.y}
                      r={14}
                      fill="#38BDF8"
                      fillOpacity={0.35}
                      animate={{ scale: [0.8, 1.8, 0.8], opacity: [0.6, 0.1, 0.6] }}
                      transition={{ duration: 2.0, delay: delaySec, repeat: Infinity }}
                    />
                  )}
                  <circle
                    cx={city.x}
                    cy={city.y}
                    r={6}
                    fill="#34D399"
                    stroke="#FFFFFF"
                    strokeWidth="2"
                  />
                  <text
                    x={city.x + city.dx}
                    y={city.y + city.dy}
                    textAnchor={city.anchor}
                    fill="#FFFFFF"
                    stroke="#020714"
                    strokeWidth="4.5"
                    paintOrder="stroke"
                    fontSize="15"
                    fontWeight="900"
                    style={{ letterSpacing: '0.02em' }}
                  >
                    {city.name}
                  </text>
                </motion.g>
              );
            })}
          </motion.svg>
        </div>

        <div className="md:col-span-6 space-y-2.5 sm:space-y-4 text-center md:text-left">
          <div className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-black uppercase tracking-[0.2em] text-[#38BDF8]">
            <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#FDE68A] shrink-0" />
            <span>1. Invio della candidatura</span>
          </div>
          <h3 className="font-display text-[clamp(1.4rem,4.8vw,2.85rem)] leading-[1.08] font-black text-white text-balance break-words">
            FICUP UNISCE L'ITALIA.
          </h3>
          <p className="text-[clamp(0.85rem,2.2vw,1.15rem)] leading-snug sm:leading-relaxed text-slate-200 font-medium">
            Una sola passione, tante città, un'unica community. Conserva il tuo codice personale FICUP.
          </p>

          <motion.div
            initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
            animate={{ opacity: showCodeCard ? 1 : 0.3, y: showCodeCard ? 0 : 10 }}
            className="inline-flex flex-wrap items-center justify-center gap-2 rounded-xl bg-white/10 border border-[#D4AF37]/60 px-4 py-2 sm:px-5 sm:py-2.5 max-w-full"
          >
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#FDE68A]">
              Codice personale:
            </span>
            <span className="font-mono-tabular text-base sm:text-xl font-black text-white tracking-wider break-all">
              {codiceCandidatura}
            </span>
          </motion.div>
        </div>
      </div>
    );
  }

if (sceneNumber === 3) {
    const showReply = sceneElapsedMs >= 3000;
    return (
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-7 items-center py-1">
        <div className="md:col-span-5 flex justify-center">
          <div className="w-full max-w-[310px] sm:max-w-sm rounded-2xl sm:rounded-3xl border border-emerald-400/40 bg-[#071A2F]/95 overflow-hidden shadow-2xl">
            <div className="bg-emerald-700 px-3.5 py-2.5 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-white text-[#071436] flex items-center justify-center shrink-0">
                <MessageCircle className="w-4 h-4 text-emerald-700" />
              </div>
              <div className="min-w-0 text-left">
                <p className="text-[11px] sm:text-xs font-black text-white truncate">
                  FICUP · Gruppo Provvisorio
                </p>
                <p className="text-[10px] text-emerald-100 truncate">Accoglienza nuovi candidati</p>
              </div>
            </div>

            <div className="p-3 sm:p-4 space-y-2 bg-[#091829] text-left">
              <motion.div
                initial={reducedMotion ? { opacity: 1 } : { opacity: 0, x: 14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.35 }}
                className="ml-auto max-w-[92%] rounded-xl rounded-tr-xs bg-emerald-800/80 border border-emerald-500/40 px-3 py-2 text-[11px] sm:text-xs text-white leading-snug break-words"
              >
                Ciao a tutti! Ho inviato la richiesta per entrare in FICUP. Codice:{' '}
                <strong className="font-mono-tabular text-[#FDE68A]">
                  {codiceCandidatura}
                </strong>
              </motion.div>

              <motion.div
                initial={reducedMotion ? { opacity: 1 } : { opacity: 0, x: -14 }}
                animate={{ opacity: showReply ? 1 : 0, x: showReply ? 0 : -14 }}
                transition={{ duration: 0.4 }}
                className="mr-auto max-w-[92%] rounded-xl rounded-tl-xs bg-white/10 border border-white/15 px-3 py-2 text-[11px] sm:text-xs text-slate-100 leading-snug"
              >
                Benvenuto! La tua richiesta è stata presa in carico. Segui gli aggiornamenti qui e nella tua Area Personale!
              </motion.div>
            </div>
          </div>
        </div>

        <div className="md:col-span-7 space-y-2.5 sm:space-y-4 text-center md:text-left">
          <div className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-black uppercase tracking-[0.18em] text-emerald-400">
            <MessageCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span>2. Gruppo WhatsApp Provvisorio</span>
          </div>
          <h3 className="font-display text-[clamp(1.3rem,4.8vw,2.75rem)] leading-[1.12] font-black text-white text-balance break-words">
            Entra nel gruppo provvisorio.
          </h3>
          <p className="text-[clamp(0.82rem,2.2vw,1.12rem)] leading-snug sm:leading-relaxed text-slate-200">
            Accedi alla chat di accoglienza, presentati brevemente condividendo il tuo codice{' '}
            <strong className="text-[#FDE68A] font-mono-tabular">FICUP26</strong> e resta aggiornato con lo staff.
          </p>
        </div>
      </div>
    );
  }

  // SCENA 4 (34-46s) — 3. FESTA DI ACCETTAZIONE DELLA CANDIDATURA!
    // SCENA 4 (34-46s) — 3. ACCETTAZIONE DELLA CANDIDATURA (Elegante, professionale, senza festa)
  if (sceneNumber === 4) {
    return (
      <div className="relative flex flex-col items-center justify-center text-center py-3 px-3">
        <motion.div
          initial={reducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.92, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="relative z-10 max-w-xl w-full rounded-3xl bg-[#040E27]/94 border border-[#D4AF37]/65 px-5 py-6 sm:px-10 sm:py-8 shadow-[0_0_70px_rgba(212,175,55,0.32)] space-y-4"
        >
          {/* Logo FICUP valorizzato in modo professionale */}
          <div className="flex justify-center">
            <div className="p-2 rounded-2xl bg-white shadow-[0_0_30px_rgba(212,175,55,0.45)] inline-block">
              <FicupLogo size="hero" className="w-16 h-16 sm:w-22 sm:h-22" />
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-black uppercase tracking-[0.2em] text-[#FDE68A]">
            <ShieldCheck className="w-4 h-4 text-[#D4AF37] shrink-0" />
            <span>3. Conferma ufficiale dello Staff</span>
          </div>

          <h3 className="font-display text-[clamp(1.5rem,5.4vw,3.2rem)] leading-[1.08] font-black text-white tracking-tight text-balance">
            CANDIDATURA ACCETTATA!
          </h3>

          <p className="text-[clamp(1rem,3vw,1.4rem)] font-black tracking-wide text-[#FDE68A] text-balance">
            BENVENUTO NELLA FAMIGLIA FICUP!
          </p>

          <div className="rounded-xl bg-white/10 border border-emerald-400/40 px-4 py-2.5 text-xs sm:text-sm text-slate-100">
            Richiesta <strong className="font-mono-tabular text-[#FDE68A]">{codiceCandidatura}</strong>{' '}
            approvata con successo · Stato verificabile nell&apos;<strong>Area Personale</strong>.
          </div>
        </motion.div>
      </div>
    );
  }

if (sceneNumber === 5) {
    const showSpamHint = sceneElapsedMs >= 2400;
    return (
      <div className="flex flex-col items-center justify-center text-center space-y-3.5 sm:space-y-5 py-1 max-w-2xl mx-auto">
        <motion.div
          animate={
            reducedMotion
              ? undefined
              : {
                  y: [0, -6, 0],
                  boxShadow: [
                    '0 0 0 rgba(212,175,55,0)',
                    '0 0 36px rgba(212,175,55,0.45)',
                    '0 0 0 rgba(212,175,55,0)',
                  ],
                }
          }
          transition={{ duration: 2.5, repeat: Infinity }}
          className="w-14 h-14 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#D4AF37] to-[#C69214] text-[#071436] flex items-center justify-center shadow-xl"
        >
          <Mail className="w-7 h-7 sm:w-10 sm:h-10" />
        </motion.div>

        <div className="space-y-2 sm:space-y-3">
          <p className="text-[11px] sm:text-xs font-black uppercase tracking-[0.2em] text-[#FDE68A]">
            4. Conferma &amp; Invito Ufficiale
          </p>
          <h3 className="font-display text-[clamp(1.3rem,4.8vw,2.75rem)] leading-[1.12] font-black text-white text-balance break-words">
            Ricevi l&apos;invito Fantaleghe via email!
          </h3>
          <p className="text-[clamp(0.82rem,2.2vw,1.12rem)] leading-snug sm:leading-relaxed text-slate-200">
            Dopo l&apos;approvazione dello staff riceverai la mail ufficiale con il link diretto per entrare nella lega.
          </p>
        </div>

        <motion.div
          initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
          animate={{ opacity: showSpamHint ? 1 : 0, y: showSpamHint ? 0 : 10 }}
          transition={{ duration: 0.45 }}
          className="rounded-xl sm:rounded-2xl bg-white/10 border border-[#FDE68A]/45 px-3.5 py-2.5 sm:px-5 sm:py-3 flex items-center gap-2.5 text-left max-w-lg"
        >
          <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-[#FDE68A] shrink-0" />
          <p className="text-[11px] sm:text-sm text-slate-100 leading-snug">
            <strong>Suggerimento utile:</strong> controlla sempre anche le cartelle{' '}
            <strong>Spam</strong> e <strong>Promozioni</strong> della tua casella email.
          </p>
        </motion.div>
      </div>
    );
  }

  // SCENA 6 (57-69s) — 5. Apertura del link e accesso al sito Fantaleghe con le proprie credenziali
  if (sceneNumber === 6) {
    const showLoginStep = sceneElapsedMs >= 3000;
    return (
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-7 items-center py-1">
        <div className="md:col-span-6 space-y-2.5 sm:space-y-4 text-center md:text-left">
          <div className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-black uppercase tracking-[0.18em] text-[#38BDF8]">
            <Globe className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span>5. Accesso su Fantaleghe</span>
          </div>
          <h3 className="font-display text-[clamp(1.3rem,4.8vw,2.75rem)] leading-[1.12] font-black text-white text-balance break-words">
            Apri il link e accedi al sito Fantaleghe.
          </h3>
          <p className="text-[clamp(0.82rem,2.2vw,1.12rem)] leading-snug sm:leading-relaxed text-slate-200">
            Tocca il link ricevuto nell&apos;email, entra sul sito Fantaleghe con le{' '}
            <strong>tue credenziali</strong> e conferma l&apos;ingresso nella competizione.
          </p>
        </div>

        <div className="md:col-span-6 flex justify-center">
          <div className="w-full max-w-[310px] sm:max-w-sm rounded-2xl sm:rounded-3xl border border-[#38BDF8]/40 bg-[#081A3E] p-4 sm:p-5 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between text-xs text-slate-300 border-b border-white/15 pb-2.5">
              <span className="font-bold text-[#38BDF8]">fantaleghe.it</span>
              <MousePointerClick className="w-4 h-4 text-[#FDE68A]" />
            </div>

            <div className="space-y-2 text-left">
              <div className="rounded-xl bg-white/10 px-3 py-2 text-[11px] sm:text-xs text-slate-200 leading-snug">
                1. Apri il link dell&apos;invito ufficiale ricevuto via email
              </div>
              <motion.div
                initial={reducedMotion ? { opacity: 1 } : { opacity: 0.35 }}
                animate={{ opacity: showLoginStep ? 1 : 0.45 }}
                className="rounded-xl bg-emerald-600/30 border border-emerald-400/40 px-3 py-2 text-[11px] sm:text-xs font-bold text-white flex items-center gap-2 leading-snug"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
                <span>2. Accedi con email e password Fantaleghe</span>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // SCENA 7 (69-81s) — 6 & 7. App Fantaleghe, modifica nome squadra e completamento della rosa
  if (sceneNumber === 7) {
    const showTeamReady = sceneElapsedMs >= 3000;
    return (
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-7 items-center py-1">
        <div className="md:col-span-5 flex justify-center">
          <div className="w-full max-w-[270px] sm:max-w-xs rounded-2xl sm:rounded-3xl border-2 border-emerald-400/45 bg-gradient-to-b from-emerald-950 to-[#041E16] p-3 sm:p-4 shadow-2xl space-y-2.5">
            <div className="flex items-center justify-between text-[10px] sm:text-xs font-bold text-emerald-200 border-b border-emerald-500/30 pb-1.5">
              <span>APP FANTALEGHE</span>
              <span className="font-mono-tabular text-[#FDE68A]">MODIFICA ROSA</span>
            </div>

            <div className="relative h-[clamp(7.8rem,22dvh,13rem)] rounded-xl border border-emerald-400/35 bg-emerald-900/35 overflow-hidden">
              <div className="absolute inset-x-0 top-1/2 h-px bg-emerald-300/25" />
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 sm:w-16 sm:h-16 rounded-full border border-emerald-300/25" />
              {SQUAD_POSITIONS.map((p, idx) => (
                <motion.span
                  key={`${p.pos}-${idx}`}
                  initial={reducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.4 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: idx * 0.08 }}
                  style={{ left: p.x, top: p.y }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[#D4AF37] text-[#071436] text-[9px] sm:text-[10px] font-black flex items-center justify-center shadow-md"
                >
                  {p.pos}
                </motion.span>
              ))}
            </div>

            <div
              className={`rounded-xl px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold text-center transition-colors ${
                showTeamReady ? 'bg-emerald-600 text-white' : 'bg-white/10 text-emerald-200'
              }`}
            >
              {showTeamReady ? 'Nome club e rosa salvati!' : 'Personalizza nome squadra'}
            </div>
          </div>
        </div>

        <div className="md:col-span-7 space-y-2.5 sm:space-y-4 text-center md:text-left">
          <div className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-black uppercase tracking-[0.18em] text-emerald-400">
            <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#FDE68A] shrink-0" />
            <span>6 &amp; 7 · App Fantaleghe &amp; Squadra</span>
          </div>
          <h3 className="font-display text-[clamp(1.3rem,4.8vw,2.75rem)] leading-[1.12] font-black text-white text-balance break-words">
            Apri l&apos;app, rinomina il club e completa la rosa.
          </h3>
          <p className="text-[clamp(0.82rem,2.2vw,1.12rem)] leading-snug sm:leading-relaxed text-slate-200">
            Scarica o apri l&apos;app Fantaleghe, imposta il nome della tua squadra e schiera tutta la tua rosa pronta a competere.
          </p>
        </div>
      </div>
    );
  }

  // SCENA 8 (81-90s) — 8. Inizio dell'avventura FICUP
  const showFinalStamp = sceneElapsedMs >= 2200;
  return (
    <div className="relative text-center space-y-3.5 sm:space-y-5 py-1 overflow-hidden">
      {!reducedMotion && (
        <div aria-hidden="true" className="absolute inset-0 overflow-hidden pointer-events-none">
          {FINALE_CONFETTI.map((item) => (
            <motion.span
              key={item.id}
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: [-10, 180], opacity: [0, 1, 0], rotate: [0, item.rot] }}
              transition={{ duration: 2.8, delay: item.delay, repeat: Infinity }}
              style={{ left: item.left, backgroundColor: item.color }}
              className="absolute top-0 w-2 h-3 rounded-xs"
            />
          ))}
        </div>
      )}

      <div className="relative z-10 flex justify-center">
        <div className="p-1.5 sm:p-2 rounded-2xl bg-white shadow-[0_0_50px_rgba(212,175,55,0.6)] inline-block">
          <FicupLogo size="hero" className="w-16 h-16 sm:w-24 sm:h-24" />
        </div>
      </div>

      <motion.div
        initial={reducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.95 }}
        animate={{ opacity: showFinalStamp ? 1 : 0.75, scale: showFinalStamp ? 1 : 0.97 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 space-y-2.5 sm:space-y-3 max-w-2xl mx-auto px-1"
      >
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-[#071436] text-[11px] font-black uppercase tracking-wider">
          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>8 · Inizia l&apos;avventura</span>
        </div>
        <h3 className="font-display text-[clamp(1.45rem,5.4vw,3.35rem)] leading-[1.1] font-black text-white tracking-tight text-balance break-words">
          FICUP TI ASPETTA. <span className="text-[#FDE68A]">CI VEDIAMO IN CAMPO!</span>
        </h3>
        <p className="text-[clamp(0.85rem,2.2vw,1.1rem)] leading-snug text-slate-200 text-balance">
          Al completamento potrai accedere al Gruppo WhatsApp Ufficiale dalla tua Area Personale.
        </p>
      </motion.div>
    </div>
  );
}
