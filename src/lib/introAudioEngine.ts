/**
 * Motore audio FICUP 26/27 (Videoclip Ufficiale 90 secondi):
 * - Riproduce la nuova colonna sonora ufficiale caricata in /public/assets/aistudio/
 *   (Katy Perry - Firework [Alesco Remix]) con volume bilanciato sui 90 secondi esatti.
 * - Zero voce parlata o sintesi vocale artificiale.
 * - Effetti sonori di qualità via Web Audio sincronizzati sulle 8 scene (0s -> 90s).
 */

const baseEnv = import.meta.env.BASE_URL || '/';
const normalizedBase = baseEnv.endsWith('/') ? baseEnv : `${baseEnv}/`;

export const INTRO_MUSIC_TRACK_URL = `${normalizedBase}assets/aistudio/Katy_Perry_-_Firework__Alesco_Remix__320k_cef8378c.mp3`;
export const INTRO_VIDEO_MP4_URL = `${normalizedBase}assets/ficup-intro-90s.mp4?v=20261122-v3`;

interface SfxMilestone {
  id: string;
  atMs: number;
  type: 'kickoff' | 'whoosh' | 'code_spark' | 'chat_pop' | 'email_ping' | 'squad_ready' | 'finale';
}

// 8 scene distribuite esattamente su 90 secondi (90.000 ms)
const SFX_MILESTONES_90S: SfxMilestone[] = [
  { id: 'start', atMs: 150, type: 'kickoff' },
  { id: 'sc2', atMs: 11000, type: 'whoosh' },
  { id: 'code', atMs: 12800, type: 'code_spark' },
  { id: 'sc3', atMs: 22000, type: 'whoosh' },
  { id: 'chat1', atMs: 24500, type: 'chat_pop' },
  { id: 'chat2', atMs: 27200, type: 'chat_pop' },
  { id: 'sc4', atMs: 34000, type: 'whoosh' },
  { id: 'sc5', atMs: 46000, type: 'whoosh' },
  { id: 'email', atMs: 47800, type: 'email_ping' },
  { id: 'sc6', atMs: 57000, type: 'whoosh' },
  { id: 'sc7', atMs: 69000, type: 'whoosh' },
  { id: 'squad', atMs: 71000, type: 'squad_ready' },
  { id: 'sc8', atMs: 81000, type: 'whoosh' },
  { id: 'finale', atMs: 81400, type: 'finale' },
];

export class IntroAudioEngine {
  private audioEl: HTMLAudioElement | null = null;
  private ctx: AudioContext | null = null;
  private sfxGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private enabled = true;
  private userVolume = 0.8;
  private isPlaying = false;
  private triggeredSfx = new Set<string>();
  private audioBlocked = false;

  private ensureAudioElement(): HTMLAudioElement | null {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') {
      return null;
    }
    if (!this.audioEl) {
      const el = new Audio(INTRO_MUSIC_TRACK_URL);
      el.preload = 'auto';
      el.loop = false;
      el.volume = this.enabled ? this.effectiveMusicVolume() : 0;
      el.muted = !this.enabled;
      this.audioEl = el;
    }
    return this.audioEl;
  }

  private ensureSfxContext(): AudioContext | null {
    if (typeof window === 'undefined') {
      return null;
    }
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) {
      return null;
    }
    if (!this.ctx) {
      this.ctx = new AudioCtx();
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(this.effectiveSfxVolume(), this.ctx.currentTime);
      this.sfxGain.connect(this.ctx.destination);
      this.noiseBuffer = this.buildNoiseBuffer(this.ctx, 0.8);
    }
    return this.ctx;
  }

  private buildNoiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.04 * white) / 1.04;
      data[i] = lastOut * 1.4;
    }
    return buffer;
  }

  private effectiveMusicVolume(): number {
    return Math.max(0, Math.min(0.72, this.userVolume * 0.72));
  }

  private effectiveSfxVolume(): number {
    return this.enabled ? Math.max(0, Math.min(0.16, this.userVolume * 0.16)) : 0;
  }

  public isBlocked(): boolean {
    return this.audioBlocked;
  }

  public async startFromUserGesture(seekElapsedMs = 0): Promise<boolean> {
    this.enabled = true;
    this.isPlaying = true;

    const ctx = this.ensureSfxContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => null);
    }
    if (ctx && this.sfxGain) {
      this.sfxGain.gain.setTargetAtTime(this.effectiveSfxVolume(), ctx.currentTime, 0.02);
    }

    const el = this.ensureAudioElement();
    if (!el) {
      this.audioBlocked = false;
      return true;
    }

    el.muted = false;
    el.volume = this.effectiveMusicVolume();
    const targetSec = Math.max(0, seekElapsedMs / 1000);
    if (Math.abs(el.currentTime - targetSec) > 0.35) {
      try {
        el.currentTime = targetSec;
      } catch {
        // Ignore seek errors before metadata load
      }
    }

    try {
      // Invocato sincronicamente dentro l'evento click/touch per sbloccare Android Chrome & Safari
      await el.play();
      this.audioBlocked = false;
      return true;
    } catch {
      this.audioBlocked = true;
      return false;
    }
  }

  public async unlockOnUserGesture(): Promise<boolean> {
    return this.startFromUserGesture(0);
  }

  public getVolume(): number {
    return this.userVolume;
  }

  public setVolume(nextVolume: number): void {
    this.userVolume = Math.max(0, Math.min(1, nextVolume));
    if (this.audioEl) {
      this.audioEl.volume = this.enabled ? this.effectiveMusicVolume() : 0;
    }
    if (this.ctx && this.sfxGain) {
      this.sfxGain.gain.setTargetAtTime(this.effectiveSfxVolume(), this.ctx.currentTime, 0.05);
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public async setEnabled(enable: boolean): Promise<boolean> {
    this.enabled = enable;
    const el = this.ensureAudioElement();
    if (!enable) {
      if (el) {
        el.muted = true;
        el.volume = 0;
      }
      if (this.ctx && this.sfxGain) {
        this.sfxGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
      }
      this.audioBlocked = false;
      return true;
    }

    if (this.ctx && this.sfxGain) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => null);
      }
      this.sfxGain.gain.setTargetAtTime(this.effectiveSfxVolume(), this.ctx.currentTime, 0.05);
    }

    if (el) {
      el.muted = false;
      el.volume = this.effectiveMusicVolume();
      if (this.isPlaying) {
        try {
          await el.play();
          this.audioBlocked = false;
          return true;
        } catch {
          this.audioBlocked = true;
          return false;
        }
      }
    }
    return true;
  }

  public setPlaying(playing: boolean, seekElapsedMs?: number): void {
    this.isPlaying = playing;
    const el = this.ensureAudioElement();
    if (!el) {
      return;
    }

    if (!playing) {
      try {
        el.pause();
      } catch {
        // Ignore
      }
      return;
    }

    if (typeof seekElapsedMs === 'number' && Number.isFinite(seekElapsedMs)) {
      const targetSec = Math.max(0, seekElapsedMs / 1000);
      if (Math.abs(el.currentTime - targetSec) > 0.45) {
        try {
          el.currentTime = targetSec;
        } catch {
          // Ignore seek errors before metadata load
        }
      }
    }

    if (this.enabled) {
      el.muted = false;
      el.volume = this.effectiveMusicVolume();
      if (el.paused) {
        el.play()
          .then(() => {
            this.audioBlocked = false;
          })
          .catch(() => {
            this.audioBlocked = true;
          });
      }
    } else {
      el.muted = true;
    }
  }

  public resetTimeline(): void {
    this.triggeredSfx.clear();
    if (this.audioEl) {
      try {
        this.audioEl.pause();
        this.audioEl.currentTime = 0;
      } catch {
        // Ignore
      }
    }
  }

  public syncPlayback(elapsedMs: number): void {
    if (!this.isPlaying || !this.enabled) {
      return;
    }

    // Fade-in iniziale (0..0.9s) e fade-out morbido negli ultimi 3 secondi (87s..90s)
    if (this.audioEl) {
      if (elapsedMs < 900) {
        const inRatio = Math.max(0.15, Math.min(1, elapsedMs / 900));
        this.audioEl.volume = this.effectiveMusicVolume() * inRatio;
      } else if (elapsedMs >= 87000) {
        const outRatio = Math.max(0, Math.min(1, (90000 - elapsedMs) / 3000));
        this.audioEl.volume = this.effectiveMusicVolume() * outRatio;
      } else {
        this.audioEl.volume = this.effectiveMusicVolume();
      }
    }

    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || !this.sfxGain) {
      return;
    }

    for (const sfx of SFX_MILESTONES_90S) {
      if (!this.triggeredSfx.has(sfx.id) && elapsedMs >= sfx.atMs && elapsedMs < sfx.atMs + 1200) {
        this.triggeredSfx.add(sfx.id);
        this.playSfx(sfx.type);
      }
    }
  }

  public fadeOutAndStop(): void {
    this.isPlaying = false;
    const el = this.audioEl;
    if (!el) {
      return;
    }
    try {
      el.pause();
      el.currentTime = 0;
    } catch {
      // Ignore
    }
  }

  private playSfx(type: SfxMilestone['type']): void {
    const ctx = this.ctx;
    const sfx = this.sfxGain;
    if (!ctx || !sfx) {
      return;
    }
    const now = ctx.currentTime;

    if (type === 'kickoff') {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(115, now);
      osc.frequency.exponentialRampToValueAtTime(38, now + 0.45);
      g.gain.setValueAtTime(0.48, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
      osc.connect(g);
      g.connect(sfx);
      osc.start(now);
      osc.stop(now + 0.6);
      return;
    }

    if (type === 'whoosh') {
      if (!this.noiseBuffer) return;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(300, now);
      filter.frequency.exponentialRampToValueAtTime(1550, now + 0.2);
      filter.frequency.exponentialRampToValueAtTime(400, now + 0.45);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.28, now + 0.14);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.46);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(sfx);
      src.start(now);
      src.stop(now + 0.5);
      return;
    }

    if (type === 'code_spark' || type === 'email_ping' || type === 'squad_ready' || type === 'finale') {
      const notes =
        type === 'code_spark'
          ? [587.33, 880, 1174.66]
          : type === 'email_ping'
            ? [659.25, 987.77]
            : type === 'squad_ready'
              ? [440, 554.37, 659.25]
              : [293.66, 440, 587.33, 739.99, 880];
      notes.forEach((f, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, now + i * 0.08);
        g.gain.setValueAtTime(0.0001, now + i * 0.08);
        g.gain.linearRampToValueAtTime(0.22, now + i * 0.08 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.08 + 0.55);
        osc.connect(g);
        g.connect(sfx);
        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.6);
      });
      return;
    }

    if (type === 'chat_pop') {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(540, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.07);
      g.gain.setValueAtTime(0.22, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      osc.connect(g);
      g.connect(sfx);
      osc.start(now);
      osc.stop(now + 0.14);
    }
  }

  public dispose(): void {
    this.isPlaying = false;
    if (this.audioEl) {
      try {
        this.audioEl.pause();
        this.audioEl.src = '';
      } catch {
        // Ignore
      }
      this.audioEl = null;
    }
    if (this.ctx) {
      this.ctx.close().catch(() => null);
      this.ctx = null;
      this.sfxGain = null;
    }
  }
}
