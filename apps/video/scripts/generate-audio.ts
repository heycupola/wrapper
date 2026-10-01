/* Synthesises public/audio/soundtrack.wav from the film timeline. Run: bun run audio
 *
 * If public/audio/music.(mp3|wav|m4a) exists, that track replaces the synthesised pad and
 * pulse; the sound effects are still generated here.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  BEAT_SECONDS,
  DURATION_SECONDS,
  PREFIX_LEAD,
  RUN_WORDS,
  SCRIPT,
  T,
  typedEnd,
} from "../src/timeline";

const SR = 48_000;
const TAU = Math.PI * 2;
const LENGTH = Math.ceil(DURATION_SECONDS * SR);
const OUT_DIR = join(import.meta.dir, "../public/audio");
const MUSIC = ["music.mp3", "music.wav", "music.m4a"].find((name) =>
  existsSync(join(OUT_DIR, name)),
);

type Bus = { l: Float32Array; r: Float32Array };
const bus = (): Bus => ({ l: new Float32Array(LENGTH), r: new Float32Array(LENGTH) });

const dry = bus();
const wet = bus();

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4_294_967_296;
  };
}
const random = mulberry32(7);

/* RBJ biquad. */
class Biquad {
  private b0 = 1;
  private b1 = 0;
  private b2 = 0;
  private a1 = 0;
  private a2 = 0;
  private x1 = 0;
  private x2 = 0;
  private y1 = 0;
  private y2 = 0;

  constructor(kind: "lowpass" | "highpass" | "bandpass", freq: number, q = 0.707) {
    this.set(kind, freq, q);
  }

  set(kind: "lowpass" | "highpass" | "bandpass", freq: number, q = 0.707) {
    const w = (TAU * Math.min(freq, SR * 0.45)) / SR;
    const alpha = Math.sin(w) / (2 * q);
    const cos = Math.cos(w);
    let b0: number;
    let b1: number;
    let b2: number;
    if (kind === "lowpass") {
      b0 = (1 - cos) / 2;
      b1 = 1 - cos;
      b2 = b0;
    } else if (kind === "highpass") {
      b0 = (1 + cos) / 2;
      b1 = -(1 + cos);
      b2 = b0;
    } else {
      b0 = alpha;
      b1 = 0;
      b2 = -alpha;
    }
    const a0 = 1 + alpha;
    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
    this.a1 = (-2 * cos) / a0;
    this.a2 = (1 - alpha) / a0;
  }

  run(x: number): number {
    const y =
      this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

function add(target: Bus, i: number, value: number, pan = 0) {
  if (i < 0 || i >= LENGTH) return;
  target.l[i] = (target.l[i] ?? 0) + value * Math.sqrt((1 - pan) / 2);
  target.r[i] = (target.r[i] ?? 0) + value * Math.sqrt((1 + pan) / 2);
}

/* A struck tone: sine partials with an exponential tail. */
function bell(
  at: number,
  freq: number,
  amp: number,
  decay: number,
  { pan = 0, send = 0.5, attack = 0.006, harmonics = [1, 0.18, 0.05] } = {},
) {
  const start = Math.floor(at * SR);
  const n = Math.floor((decay * 7 + attack) * SR);
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const env = Math.min(1, t / attack) * Math.exp(-t / decay);
    let v = 0;
    harmonics.forEach((h, j) => {
      v += h * Math.sin(TAU * freq * (j + 1) * t);
    });
    const s = v * env * amp;
    add(dry, start + k, s * (1 - send * 0.5), pan);
    add(wet, start + k, s * send, pan);
  }
}

function keyClick(at: number, amp = 0.2, body = 190, bright = 3200) {
  const start = Math.floor(at * SR);
  const band = new Biquad("bandpass", bright * (0.85 + random() * 0.3), 1.2);
  const pan = (random() - 0.5) * 0.3;
  const n = Math.floor(0.06 * SR);
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const click = band.run(random() * 2 - 1) * Math.exp(-t / 0.004);
    const thock = Math.sin(TAU * body * t) * Math.exp(-t / 0.012) * 0.6;
    add(dry, start + k, (click * 1.4 + thock) * amp, pan);
    add(wet, start + k, click * amp * 0.15, pan);
  }
}

function tap(at: number, amp = 0.12) {
  const start = Math.floor(at * SR);
  const n = Math.floor(0.05 * SR);
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const v =
      Math.sin(TAU * 1450 * t) * Math.exp(-t / 0.005) +
      Math.sin(TAU * 320 * t) * Math.exp(-t / 0.01) * 0.5;
    add(dry, start + k, v * amp, 0.15);
    add(wet, start + k, v * amp * 0.2, 0.15);
  }
}

function whoosh(at: number, duration: number, amp = 0.07, from = 280, peak = 2400) {
  const start = Math.floor(at * SR);
  const n = Math.floor(duration * SR);
  const filters = [new Biquad("lowpass", from, 0.9), new Biquad("lowpass", from, 0.9)];
  for (let k = 0; k < n; k++) {
    const p = k / n;
    if (k % 64 === 0) {
      const cutoff = from + (peak - from) * Math.sin(Math.PI * p) ** 2;
      filters.forEach((f) => f.set("lowpass", cutoff, 0.9));
    }
    const env = Math.sin(Math.PI * p) ** 2 * amp;
    add(dry, start + k, (filters[0]?.run(random() * 2 - 1) ?? 0) * env, -0.6 + p * 1.2);
    add(wet, start + k, (filters[1]?.run(random() * 2 - 1) ?? 0) * env * 0.6, 0.6 - p * 1.2);
  }
}

function glide(at: number, from: number, to: number, duration: number, amp: number) {
  const start = Math.floor(at * SR);
  const n = Math.floor((duration + 1.2) * SR);
  let phase = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const p = Math.min(1, t / duration);
    const f = from * (to / from) ** (p * p * (3 - 2 * p));
    phase += (TAU * f) / SR;
    const env = Math.min(1, t / 0.01) * Math.exp(-t / 0.35);
    const v = (Math.sin(phase) + 0.2 * Math.sin(phase * 2)) * env * amp;
    add(dry, start + k, v * 0.6, 0);
    add(wet, start + k, v * 0.7, 0);
  }
}

/* ---------- Music: pad chords with a soft pulse the pad ducks under. ---------- */

const CHORDS: { at: number; notes: number[] }[] = [
  { at: 0, notes: [55, 110, 164.81, 246.94, 329.63] },
  { at: T.direct, notes: [46.25, 92.5, 138.59, 220, 329.63] },
  { at: T.attention, notes: [36.71, 73.42, 110, 185, 277.18, 329.63] },
  { at: T.nothingLeaves, notes: [41.2, 82.41, 123.47, 164.81, 220, 246.94] },
  { at: T.outro, notes: [55, 110, 164.81, 220, 277.18, 329.63] },
];
const FADE = 1.4;
const PULSE_START = T.split;
const PULSE_END = T.outro - 0.05;

function beatEnvelope(t: number): number {
  if (t < PULSE_START || t >= PULSE_END) return 0;
  const since = (t - PULSE_START) % BEAT_SECONDS;
  return Math.exp(-since / 0.14);
}

function renderPad() {
  CHORDS.forEach((chord, index) => {
    const next = CHORDS[index + 1];
    const end = next ? next.at + FADE : DURATION_SECONDS;
    const start = Math.max(0, chord.at - (index === 0 ? 0 : 0.2));
    const i0 = Math.floor(start * SR);
    const i1 = Math.min(LENGTH, Math.floor(end * SR));
    const voices = [-0.0022, 0, 0.0019];
    const phases = chord.notes.map(() => voices.map(() => random() * TAU));
    const lfoRates = chord.notes.map(() => 0.07 + random() * 0.1);

    for (let i = i0; i < i1; i++) {
      const t = i / SR;
      const rise = index === 0 ? Math.min(1, t / 2.2) : Math.min(1, (t - start) / FADE);
      const fall = next ? Math.min(1, Math.max(0, (next.at + FADE - t) / FADE)) : 1;
      const env = Math.sin((Math.PI / 2) * rise) * Math.sin((Math.PI / 2) * fall);
      const duck = 1 - 0.32 * beatEnvelope(t);
      let l = 0;
      let r = 0;
      chord.notes.forEach((f, n) => {
        const weight = f < 60 ? 0.9 : f < 130 ? 0.7 : f < 250 ? 0.45 : 0.28;
        const tremolo = 0.75 + 0.25 * Math.sin(TAU * (lfoRates[n] ?? 0.1) * t + n);
        voices.forEach((d, v) => {
          const phase = TAU * f * (1 + d) * t + (phases[n]?.[v] ?? 0);
          const s = (Math.sin(phase) + 0.12 * Math.sin(phase * 2)) * weight * tremolo;
          if (v === 0) l += s;
          else if (v === 2) r += s;
          else {
            l += s * 0.7;
            r += s * 0.7;
          }
        });
      });
      const g = 0.034 * env * duck;
      dry.l[i] = (dry.l[i] ?? 0) + l * g;
      dry.r[i] = (dry.r[i] ?? 0) + r * g;
      wet.l[i] = (wet.l[i] ?? 0) + l * g * 0.35;
      wet.r[i] = (wet.r[i] ?? 0) + r * g * 0.35;
    }
  });
}

function renderPulse() {
  const hat = new Biquad("highpass", 7000, 0.8);
  let beat = 0;
  for (let at = PULSE_START; at < PULSE_END; at += BEAT_SECONDS, beat++) {
    const build = Math.min(1, 0.55 + ((at - PULSE_START) / (T.regroup - PULSE_START)) * 0.45);
    const start = Math.floor(at * SR);
    const n = Math.floor(0.45 * SR);
    let phase = 0;
    for (let k = 0; k < n; k++) {
      const t = k / SR;
      const f = 48 + 62 * Math.exp(-t / 0.03);
      phase += (TAU * f) / SR;
      const v = Math.sin(phase) * Math.exp(-t / 0.16) * Math.min(1, t / 0.002);
      add(dry, start + k, v * 0.3 * build, 0);
    }
    if (at + BEAT_SECONDS / 2 < PULSE_END) {
      const off = Math.floor((at + BEAT_SECONDS / 2) * SR);
      const m = Math.floor(0.05 * SR);
      const amp = (beat % 4 === 3 ? 0.05 : 0.032) * build;
      for (let k = 0; k < m; k++) {
        const v = hat.run(random() * 2 - 1) * Math.exp(-(k / SR) / 0.012);
        add(dry, off + k, v * amp, 0.25);
      }
    }
  }
}

/* ---------- Cues pulled from the script. ---------- */

function renderCues() {
  for (const line of SCRIPT) {
    const typed = line.typed;
    if (!typed) continue;
    [...typed.text].forEach((_, i) => {
      const at = typed.at + i * typed.rate;
      if (typed.by === "host") keyClick(at + (random() - 0.5) * 0.008);
      else tap(at);
    });
    if (line !== SCRIPT[0]) {
      const done = typedEnd(line) + 0.04;
      if (typed.by === "host") keyClick(done, 0.26, 140, 2400);
      else tap(done, 0.15);
    }
  }
  keyClick(T.enter, 0.28, 130, 2200);

  for (const at of [T.guestPress, T.unsharePress]) {
    keyClick(at - PREFIX_LEAD, 0.26, 150, 2600);
    keyClick(at - PREFIX_LEAD + 0.012, 0.2, 170, 3000);
    keyClick(at, 0.26, 160, 2800);
  }

  whoosh(T.pullOut - 0.1, 1.5, 0.08, 200, 1800);
  whoosh(T.split - 0.05, 1.1, 0.06);
  whoosh(T.relay - 0.1, 0.9, 0.045);
  whoosh(T.relayBack - 0.1, 0.9, 0.035);
  whoosh(T.attention + 0.3, 1.0, 0.05);
  whoosh(T.regroup - 0.05, 1.1, 0.06);
  whoosh(T.outro - 0.1, 1.2, 0.07, 200, 1600);

  /* Live: the only bright moment in the film. */
  bell(T.live, 659.25, 0.1, 0.7, { pan: -0.15, send: 0.7 });
  bell(T.live + 0.09, 987.77, 0.075, 0.8, { pan: 0.15, send: 0.8 });
  bell(T.live + 0.18, 1318.51, 0.03, 0.9, { pan: 0.3, send: 0.9 });

  bell(T.relay + 0.45, 880, 0.035, 0.18, { send: 0.6 });
  bell(T.relayBack + 0.45, 1174.66, 0.03, 0.18, { send: 0.6 });

  const notify = T.notify;
  bell(notify, 1567.98, 0.06, 0.3, { pan: 0.2, send: 0.6 });
  bell(notify + 0.12, 2093, 0.05, 0.4, { pan: 0.25, send: 0.7 });
  tap(T.attentionTap, 0.16);

  glide(T.unshare, 493.88, 329.63, 0.35, 0.12);

  RUN_WORDS.slice(1).forEach((_, i) => {
    bell(T.runWords + i * T.runWordSeconds, 1318.51, 0.022, 0.08, { send: 0.3 });
  });

  /* Resolve on the mark. */
  const chord = [110, 164.81, 220, 277.18, 329.63, 440];
  chord.forEach((f, i) => {
    bell(T.mark + i * 0.03, f, 0.07 - i * 0.007, 1.6, {
      pan: (i / (chord.length - 1)) * 0.6 - 0.3,
      send: 0.8,
      attack: 0.02,
    });
  });
  bell(T.mark, 55, 0.18, 1.4, { send: 0.2, attack: 0.01, harmonics: [1, 0.3] });

  /* Hand-off to Cupola: an air swell into a soft, higher voicing of the same chord. */
  whoosh(T.handoff - 0.1, 1.0, 0.04, 240, 1400);
  [220, 329.63, 440, 554.37].forEach((f, i) => {
    bell(T.cupola + i * 0.04, f, 0.05 - i * 0.008, 1.8, {
      pan: (i / 3) * 0.5 - 0.25,
      send: 0.85,
      attack: 0.03,
    });
  });
}

/* ---------- Freeverb-style room on the wet bus. ---------- */

function reverb(input: Float32Array, spread: number): Float32Array {
  const combs = [1557, 1617, 1491, 1422, 1277, 1356, 1188, 1116].map((n) => {
    const size = Math.round(((n + spread) * SR) / 44_100);
    return { buf: new Float32Array(size), i: 0, store: 0 };
  });
  const allpasses = [556, 441, 341, 225].map((n) => {
    const size = Math.round(((n + spread) * SR) / 44_100);
    return { buf: new Float32Array(size), i: 0 };
  });
  const feedback = 0.86;
  const damp = 0.3;
  const out = new Float32Array(input.length);
  for (let s = 0; s < input.length; s++) {
    const x = (input[s] ?? 0) * 0.015;
    let y = 0;
    for (const c of combs) {
      const o = c.buf[c.i] ?? 0;
      c.store = o * (1 - damp) + c.store * damp;
      c.buf[c.i] = x + c.store * feedback;
      c.i = (c.i + 1) % c.buf.length;
      y += o;
    }
    for (const a of allpasses) {
      const o = a.buf[a.i] ?? 0;
      a.buf[a.i] = y + o * 0.5;
      a.i = (a.i + 1) % a.buf.length;
      y = o - y;
    }
    out[s] = y * 3;
  }
  return out;
}

function writeWav(path: string, l: Float32Array, r: Float32Array) {
  const data = Buffer.alloc(LENGTH * 4);
  for (let i = 0; i < LENGTH; i++) {
    data.writeInt16LE(Math.round((l[i] ?? 0) * 32_767), i * 4);
    data.writeInt16LE(Math.round((r[i] ?? 0) * 32_767), i * 4 + 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(2, 22);
  header.writeUInt32LE(SR, 24);
  header.writeUInt32LE(SR * 4, 28);
  header.writeUInt16LE(4, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  writeFileSync(path, Buffer.concat([header, data]));
}

if (!MUSIC) {
  renderPad();
  renderPulse();
}
renderCues();

const roomL = reverb(wet.l, 0);
const roomR = reverb(wet.r, 23);
const left = new Float32Array(LENGTH);
const right = new Float32Array(LENGTH);
let peak = 0;
for (let i = 0; i < LENGTH; i++) {
  const t = i / SR;
  const master = Math.min(1, t / 0.4) * Math.min(1, Math.max(0, (DURATION_SECONDS - t) / 1.6));
  left[i] = ((dry.l[i] ?? 0) + (roomL[i] ?? 0)) * master;
  right[i] = ((dry.r[i] ?? 0) + (roomR[i] ?? 0)) * master;
  peak = Math.max(peak, Math.abs(left[i] ?? 0), Math.abs(right[i] ?? 0));
}
/* Effects alone would normalise far too hot under a real track; keep the level the mix had. */
const gain = Math.min(0.89 / peak, 2.8);
for (let i = 0; i < LENGTH; i++) {
  left[i] = Math.tanh((left[i] ?? 0) * gain * 1.1) / Math.tanh(1.1);
  right[i] = Math.tanh((right[i] ?? 0) * gain * 1.1) / Math.tanh(1.1);
}

mkdirSync(OUT_DIR, { recursive: true });
writeWav(join(OUT_DIR, "soundtrack.wav"), left, right);
writeFileSync(
  join(import.meta.dir, "../src/audio.generated.ts"),
  `/* Generated by scripts/generate-audio.ts. Do not edit. */\n\nexport const MUSIC_FILE: string | null = ${MUSIC ? JSON.stringify(`audio/${MUSIC}`) : "null"};\n`,
);
console.log(
  `soundtrack.wav · ${DURATION_SECONDS}s · ${MUSIC ? `effects over ${MUSIC}` : "synthesised music"}`,
);
