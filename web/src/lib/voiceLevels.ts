/**
 * Who is talking.
 *
 * ## Why this is worth the complexity
 *
 * Voice chat without a speaking indicator has two failure modes that both
 * quietly kill a call, and neither produces an error:
 *
 * 1. **"Can you hear me?"** — you talk for ten seconds into a muted mic or a
 *    dead peer connection before anyone tells you. With an indicator you see
 *    your own bar move (or not) and fix it in one second, silently.
 * 2. **Nobody knows who's talking.** In a six-person room over a phone
 *    speaker, voices are compressed and unfamiliar. Players end up saying each
 *    other's names constantly just to address someone, which is exhausting and
 *    makes the room feel chaotic.
 *
 * Both are solved by the same thing: a level meter per person, wired to the
 * player list. It is the single highest-value addition to the voice stack.
 *
 * ## How it works
 *
 * One AudioContext, one AnalyserNode per stream, and ONE requestAnimationFrame
 * loop that walks every analyser. A loop per peer would mean six rAF callbacks
 * competing on a phone that is also running a game; one loop that iterates is
 * the same work with a fraction of the scheduling overhead.
 *
 * React state is only updated when the *set of speakers changes*, not on every
 * frame — a 60fps setState across a six-player list would re-render the whole
 * room sixty times a second and visibly drop the game's own animations.
 */

/** RMS above this counts as speech. Empirical: below it is breath and fan noise. */
const SPEAK_ON = 0.045;
/**
 * And below THIS counts as silence. The gap is deliberate hysteresis: with a
 * single threshold, a normal voice crossing it on every syllable makes the
 * indicator strobe, which is worse than having no indicator at all.
 */
const SPEAK_OFF = 0.028;
/**
 * Keep showing "speaking" for this long after the level drops. Speech has gaps
 * between words; without a hold the indicator flickers through every sentence.
 */
const HOLD_MS = 320;

interface Tracked {
  analyser: AnalyserNode;
  source: MediaStreamAudioSourceNode;
  /**
   * Typed as ArrayBuffer-backed explicitly: TS 5.7+ made Float32Array generic
   * over its buffer type, and getFloatTimeDomainData won't accept the
   * SharedArrayBuffer-compatible default.
   */
  buffer: Float32Array<ArrayBuffer>;
  speaking: boolean;
  lastLoudAt: number;
  /** Smoothed 0..1 level for the meter. */
  level: number;
}

export class VoiceLevelMonitor {
  private ctx: AudioContext | null = null;
  private tracked = new Map<string, Tracked>();
  private raf: number | null = null;
  private onSpeakingChange: (speaking: Set<string>) => void;
  private lastEmitted = "";

  /**
   * Live levels, keyed by id, mutated in place every frame.
   *
   * Handed out as a stable Map rather than pushed through React state: a meter
   * that animates at 60fps must not cause 60 re-renders a second. Consumers
   * read it from an animation frame of their own (or from a CSS variable they
   * set directly), and only the *speaking set* crosses the React boundary.
   */
  readonly levels = new Map<string, number>();

  constructor(onSpeakingChange: (speaking: Set<string>) => void) {
    this.onSpeakingChange = onSpeakingChange;
  }

  /**
   * The AudioContext starts suspended until a user gesture on most browsers.
   * Creating it lazily (rather than at module load) means we never create one
   * for a player who only ever listens with the tab muted.
   */
  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    try {
      this.ctx = new Ctor();
      return this.ctx;
    } catch {
      return null;
    }
  }

  /** Resume after a user gesture. Safe to call repeatedly. */
  resume(): void {
    if (this.ctx?.state === "suspended") void this.ctx.resume().catch(() => {});
  }

  add(id: string, stream: MediaStream): void {
    if (this.tracked.has(id)) this.remove(id);
    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      // 512 bins is ~11ms of audio at 48kHz: fine enough to catch the start of
      // a word, coarse enough that the RMS isn't dominated by a single click.
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(analyser);

      this.tracked.set(id, {
        analyser,
        source,
        buffer: new Float32Array(new ArrayBuffer(analyser.fftSize * 4)),
        speaking: false,
        lastLoudAt: 0,
        level: 0,
      });
      this.start();
    } catch {
      /* A stream with no live audio track. Nothing to meter. */
    }
  }

  remove(id: string): void {
    const entry = this.tracked.get(id);
    if (!entry) return;
    try {
      entry.source.disconnect();
      entry.analyser.disconnect();
    } catch {
      /* already torn down */
    }
    this.tracked.delete(id);
    this.levels.delete(id);
    if (this.tracked.size === 0) this.stop();
  }

  private start(): void {
    if (this.raf !== null) return;
    const tick = () => {
      this.sample();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  private stop(): void {
    if (this.raf !== null) {
      cancelAnimationFrame(this.raf);
      this.raf = null;
    }
    this.lastEmitted = "";
    this.levels.clear();
    this.onSpeakingChange(new Set());
  }

  private sample(): void {
    const now = performance.now();
    const speaking = new Set<string>();

    for (const [id, entry] of this.tracked) {
      entry.analyser.getFloatTimeDomainData(entry.buffer);

      let sumSquares = 0;
      for (let i = 0; i < entry.buffer.length; i++) {
        sumSquares += entry.buffer[i] * entry.buffer[i];
      }
      const rms = Math.sqrt(sumSquares / entry.buffer.length);

      // Attack fast, release slow: a meter that shoots up instantly and falls
      // away gently reads as responsive; the reverse reads as broken.
      entry.level =
        rms > entry.level ? rms : entry.level * 0.82 + rms * 0.18;

      if (rms > SPEAK_ON) {
        entry.speaking = true;
        entry.lastLoudAt = now;
      } else if (entry.speaking && rms < SPEAK_OFF && now - entry.lastLoudAt > HOLD_MS) {
        entry.speaking = false;
      }

      if (entry.speaking) speaking.add(id);
      this.levels.set(id, Math.min(1, entry.level * 6));
    }

    // Only the speaking SET crosses into React, and only when it changes.
    // Pushing levels through state would re-render every player row sixty
    // times a second and visibly stall the game's own animations on a phone.
    const key = [...speaking].sort().join(",");
    if (key !== this.lastEmitted) {
      this.lastEmitted = key;
      this.onSpeakingChange(speaking);
    }
  }

  destroy(): void {
    for (const id of [...this.tracked.keys()]) this.remove(id);
    this.stop();
    if (this.ctx && this.ctx.state !== "closed") {
      void this.ctx.close().catch(() => {});
    }
    this.ctx = null;
  }
}
