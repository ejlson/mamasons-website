// Sound, all synthesised with Web Audio (no files): a slow piano lullaby, the sorbetero's handbell,
// a pop when a doll hops out and a little chime when one starts talking. Off unless the
// visitor chooses "Enter with sound"; the corner toggle mutes and unmutes.
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let on = false;
const listeners = new Set<(on: boolean) => void>();

function ensure() {
  if (ctx) return ctx;
  ctx = new AudioContext();
  master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);
  music();
  return ctx;
}

// ---- the music: an original, slow, spacious lullaby in the spirit of C418's ambient work
// (not a copy of any piece). A felt-piano voice wanders over four warm chords at ~66 bpm,
// with a soft sub note under each chord and a long generated reverb. The melody is chosen
// live from each chord's notes, so it never repeats exactly.
const BPM = 66;
const BEAT = 60 / BPM;
// chords as MIDI notes: Fmaj9, Am7(add11), Dm9, Bbmaj7#11 — warm, unresolved, a little wistful
const CHORDS = [
  { bass: 41, notes: [65, 69, 72, 76, 79] },
  { bass: 45, notes: [64, 67, 69, 72, 74] },
  { bass: 38, notes: [62, 65, 69, 72, 76] },
  { bass: 46, notes: [62, 65, 69, 70, 76] },
];
const hz = (m: number) => 440 * 2 ** ((m - 69) / 12);

function reverb(c: AudioContext, seconds = 4.5) {
  const len = Math.round(c.sampleRate * seconds);
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3.2;
  }
  const conv = c.createConvolver();
  conv.buffer = buf;
  return conv;
}

let musicBus: GainNode | null = null;
let wet: ConvolverNode | null = null;

/** A felt-piano note: soft attack, a quick fall then a long tail, slightly detuned partials. */
function piano(m: number, t: number, vel: number, len = 3.2) {
  const c = ctx!, f = hz(m);
  const out = c.createGain();
  out.gain.setValueAtTime(0.0001, t);
  out.gain.exponentialRampToValueAtTime(vel, t + 0.012);
  out.gain.exponentialRampToValueAtTime(vel * 0.35, t + 0.35);
  out.gain.exponentialRampToValueAtTime(0.0001, t + len);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(Math.min(4200, f * 6), t);
  lp.frequency.exponentialRampToValueAtTime(Math.max(500, f * 1.5), t + len * 0.6);
  for (const [r, a, type] of [[1, 1, 'triangle'], [2, 0.18, 'sine'], [1.002, 0.5, 'sine']] as const) {
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = f * r;
    const g = c.createGain();
    g.gain.value = a;
    o.connect(g).connect(lp);
    o.start(t);
    o.stop(t + len + 0.1);
  }
  lp.connect(out);
  out.connect(musicBus!);
  out.connect(wet!);
}

/** A soft sub-bass swell under each chord. */
function sub(m: number, t: number, len: number) {
  const c = ctx!, o = c.createOscillator(), g = c.createGain();
  o.frequency.value = hz(m);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.09, t + 1.2);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  o.connect(g).connect(musicBus!);
  o.start(t);
  o.stop(t + len + 0.1);
}

function music(until?: number) {
  const c = ctx!;
  musicBus = c.createGain();
  musicBus.gain.value = 1.4;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 5200;
  musicBus.connect(lp).connect(master!);
  wet = reverb(c);
  const wetGain = c.createGain();
  wetGain.gain.value = 0.9;
  wet.connect(wetGain).connect(master!);

  let bar = 0;
  let next = c.currentTime + 0.2;
  let last = 72;
  const schedule = () => {
    // look ahead two seconds on the audio clock
    while (next < (until ?? c.currentTime + 2)) {
      const ch = CHORDS[bar % CHORDS.length];
      const barLen = BEAT * 4;
      sub(ch.bass, next, barLen * 1.4);
      // a soft spread chord on the downbeat, low to high
      [ch.bass + 12, ch.notes[0], ch.notes[2]].forEach((n, i) => piano(n, next + i * 0.07, 0.05, 5));
      // the wandering line: 2 to 4 notes a bar, small steps, sometimes a rest
      const count = 2 + Math.floor(Math.random() * 3);
      let t = next + BEAT * (0.5 + Math.random());
      for (let i = 0; i < count && t < next + barLen; i++) {
        const pool = ch.notes.filter((n) => Math.abs(n - last) <= 5 && n !== last);
        const n = pool.length ? pool[Math.floor(Math.random() * pool.length)] : ch.notes[2];
        piano(n + (Math.random() < 0.15 ? 12 : 0), t, 0.07 + Math.random() * 0.03);
        last = n;
        t += BEAT * (Math.random() < 0.5 ? 1 : 1.5);
      }
      next += barLen;
      bar++;
    }
  };
  schedule();
  if (until === undefined) setInterval(schedule, 500);
}

/** Render the music offline, for previews. Returns a WAV blob. */
export async function renderMusic(seconds = 40): Promise<Blob> {
  const sr = 44100;
  const off = new OfflineAudioContext(2, sr * seconds, sr);
  ctx = off as unknown as AudioContext;
  master = off.createGain();
  master.gain.value = 1;
  master.connect(off.destination);
  music(seconds - 4);
  const buf = await off.startRendering();
  const n = buf.length, data = new DataView(new ArrayBuffer(44 + n * 4));
  const w = (o: number, str: string) => [...str].forEach((ch, i) => data.setUint8(o + i, ch.charCodeAt(0)));
  w(0, 'RIFF'); data.setUint32(4, 36 + n * 4, true); w(8, 'WAVE'); w(12, 'fmt ');
  data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, 2, true);
  data.setUint32(24, sr, true); data.setUint32(28, sr * 4, true); data.setUint16(32, 4, true); data.setUint16(34, 16, true);
  w(36, 'data'); data.setUint32(40, n * 4, true);
  const L = buf.getChannelData(0), R = buf.getChannelData(1);
  for (let i = 0; i < n; i++) {
    data.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true);
    data.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true);
  }
  ctx = null;
  master = null;
  return new Blob([data], { type: 'audio/wav' });
}

function env(g: GainNode, t: number, peak: number, attack: number, decay: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

/** The handbell: a struck bell is a few inharmonic partials decaying at different rates. */
export function bell(pitch = 880) {
  if (!on || !ctx) return;
  const t = ctx.currentTime;
  for (const [ratio, amp, dec] of [[1, 0.22, 1.6], [2.76, 0.1, 0.9], [5.4, 0.05, 0.5], [8.9, 0.025, 0.3]]) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = pitch * ratio;
    env(g, t, amp, 0.004, dec);
    o.connect(g).connect(master!);
    o.start(t);
    o.stop(t + dec + 0.1);
  }
}

/** A cork-like pop: a short sine sweeping down. */
export function pop(pitch = 520) {
  if (!on || !ctx) return;
  const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.setValueAtTime(pitch * 1.8, t);
  o.frequency.exponentialRampToValueAtTime(pitch * 0.6, t + 0.12);
  env(g, t, 0.18, 0.005, 0.14);
  o.connect(g).connect(master!);
  o.start(t);
  o.stop(t + 0.2);
}

/** A two-note chime for a doll starting to talk; smaller dolls chime higher. */
export function chime(size = 1) {
  if (!on || !ctx) return;
  const base = 660 / size;
  [0, 0.09].forEach((dt, i) => {
    const t = ctx!.currentTime + dt, o = ctx!.createOscillator(), g = ctx!.createGain();
    o.type = 'triangle';
    o.frequency.value = base * (i ? 1.5 : 1);
    env(g, t, 0.06, 0.006, 0.35);
    o.connect(g).connect(master!);
    o.start(t);
    o.stop(t + 0.45);
  });
}

export function setSound(next: boolean) {
  if (next) ensure();
  on = next;
  if (ctx && master) {
    if (next) void ctx.resume();
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(next ? 1 : 0, ctx.currentTime, 0.25);
  }
  listeners.forEach((f) => f(on));
}

export const soundOn = () => on;
export const onSound = (f: (on: boolean) => void) => listeners.add(f);
