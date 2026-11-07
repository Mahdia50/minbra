// ---------------------------------------------------------------------------
// Tiny synthesised sound-effects engine (WebAudio).
//
// No audio files are shipped: every effect is generated from oscillators, which
// keeps the bundle small and avoids licensing issues. Everything is wrapped in
// try/catch because browsers block audio until the first user gesture.
// ---------------------------------------------------------------------------

export type SfxName =
  | "click"
  | "join"
  | "leave"
  | "yourTurn"
  | "vote"
  | "reveal"
  | "win"
  | "lose"
  | "tick"
  | "error";

let ctx: AudioContext | null = null;
let enabled = true;

export function setSfxEnabled(value: boolean) {
  enabled = value;
}

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

interface Tone {
  freq: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
  sweepTo?: number;
}

const RECIPES: Record<SfxName, Tone[]> = {
  click: [{ freq: 420, duration: 0.06, type: "triangle", gain: 0.05 }],
  join: [
    { freq: 480, duration: 0.1, type: "sine", gain: 0.06 },
    { freq: 720, duration: 0.14, type: "sine", gain: 0.05, delay: 0.08 },
  ],
  leave: [
    { freq: 420, duration: 0.1, type: "sine", gain: 0.05 },
    { freq: 260, duration: 0.16, type: "sine", gain: 0.045, delay: 0.08 },
  ],
  yourTurn: [
    { freq: 660, duration: 0.12, type: "triangle", gain: 0.07 },
    { freq: 880, duration: 0.16, type: "triangle", gain: 0.06, delay: 0.11 },
  ],
  vote: [{ freq: 540, duration: 0.09, type: "square", gain: 0.035 }],
  reveal: [
    { freq: 320, duration: 0.18, type: "sine", gain: 0.06, sweepTo: 660 },
    { freq: 780, duration: 0.22, type: "sine", gain: 0.05, delay: 0.16 },
  ],
  win: [
    { freq: 523, duration: 0.14, type: "triangle", gain: 0.07 },
    { freq: 659, duration: 0.14, type: "triangle", gain: 0.07, delay: 0.13 },
    { freq: 784, duration: 0.26, type: "triangle", gain: 0.07, delay: 0.26 },
  ],
  lose: [
    { freq: 392, duration: 0.16, type: "sawtooth", gain: 0.045 },
    { freq: 294, duration: 0.24, type: "sawtooth", gain: 0.04, delay: 0.14 },
  ],
  tick: [{ freq: 1200, duration: 0.03, type: "square", gain: 0.025 }],
  error: [
    { freq: 200, duration: 0.12, type: "sawtooth", gain: 0.05 },
    { freq: 160, duration: 0.16, type: "sawtooth", gain: 0.05, delay: 0.1 },
  ],
};

export function playSfx(name: SfxName) {
  if (!enabled) return;
  const audio = context();
  if (!audio) return;

  try {
    const now = audio.currentTime;
    for (const tone of RECIPES[name]) {
      const start = now + (tone.delay ?? 0);
      const osc = audio.createOscillator();
      const amp = audio.createGain();
      osc.type = tone.type ?? "sine";
      osc.frequency.setValueAtTime(tone.freq, start);
      if (tone.sweepTo) {
        osc.frequency.exponentialRampToValueAtTime(tone.sweepTo, start + tone.duration);
      }
      const peak = tone.gain ?? 0.05;
      amp.gain.setValueAtTime(0.0001, start);
      amp.gain.exponentialRampToValueAtTime(peak, start + 0.012);
      amp.gain.exponentialRampToValueAtTime(0.0001, start + tone.duration);
      osc.connect(amp).connect(audio.destination);
      osc.start(start);
      osc.stop(start + tone.duration + 0.02);
    }
  } catch {
    /* audio is a nice-to-have, never let it break the game */
  }
}
