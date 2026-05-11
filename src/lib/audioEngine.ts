/**
 * Global audio engine — single AudioContext, single source per <audio>.
 *
 * Graph:
 *   <audio> -> MediaElementSource -> [8x BiquadFilter EQ] -> preGain
 *           -> dryGain ─────────────────────┐
 *           -> convolver -> wetGain ────────┤-> stereoPanner -> limiter -> destination
 *
 * 8D audio = a slow sine LFO driving stereoPanner.pan, plus a touch of reverb
 * to simulate room cues. Works on every stream (CORS-safe or not, because
 * StereoPanner is a regular AudioNode after MediaElementSource has been built).
 *
 * All parameter changes use setTargetAtTime() for click-free transitions.
 */

const SMOOTH = 0.05;        // 50ms — smooths gain knobs
const SPATIAL_RATE_HZ = 0.18; // ~5.5s per full L↔R orbit
const SPATIAL_DEPTH = 0.92;  // 0..1 — how far the LFO swings the pan

type Mode = 'idle' | 'processed' | 'direct' | 'unsupported';

interface Engine {
  ctx: AudioContext | null;
  source: MediaElementAudioSourceNode | null;
  filters: BiquadFilterNode[];
  preGain: GainNode | null;
  dryGain: GainNode | null;
  wetGain: GainNode | null;
  convolver: ConvolverNode | null;
  stereoPanner: StereoPannerNode | null;
  panLfo: OscillatorNode | null;
  panLfoGain: GainNode | null;
  limiter: DynamicsCompressorNode | null;
  el: HTMLAudioElement | null;
  signature: string | null;
  mode: Mode;
  spatialEnabled: boolean;
  lateNightEnabled: boolean;
  listeners: Set<(m: Mode) => void>;
  cachedIR: AudioBuffer | null;
}

const engine: Engine = {
  ctx: null,
  source: null,
  filters: [],
  preGain: null,
  dryGain: null,
  wetGain: null,
  convolver: null,
  stereoPanner: null,
  panLfo: null,
  panLfoGain: null,
  limiter: null,
  el: null,
  signature: null,
  mode: 'idle',
  spatialEnabled: false,
  lateNightEnabled: false,
  listeners: new Set(),
  cachedIR: null,
};

const sourceCache = new WeakMap<HTMLAudioElement, MediaElementAudioSourceNode>();

const BAND_DEFS: Array<{ freq: number; type: BiquadFilterType; q: number }> = [
  { freq: 60,    type: 'lowshelf',  q: 0.7 },
  { freq: 170,   type: 'peaking',   q: 1.0 },
  { freq: 310,   type: 'peaking',   q: 1.0 },
  { freq: 600,   type: 'peaking',   q: 1.0 },
  { freq: 1000,  type: 'peaking',   q: 1.0 },
  { freq: 3000,  type: 'peaking',   q: 1.0 },
  { freq: 6000,  type: 'peaking',   q: 1.0 },
  { freq: 12000, type: 'highshelf', q: 0.7 },
];

function ensureCtx(): AudioContext | null {
  if (engine.ctx && engine.ctx.state !== 'closed') return engine.ctx;
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  if (!AC) return null;
  try {
    const ctx = new AC({ latencyHint: 'playback' });
    // Auto-resume if the OS suspends the context (common on Android background)
    ctx.addEventListener?.('statechange', () => {
      if (ctx.state === 'suspended') {
        // Only auto-resume when the page is visible; otherwise let the
        // visibility handler restore it on foreground.
        if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
          ctx.resume().catch(() => {});
        }
      }
    });
    engine.ctx = ctx;
    return engine.ctx;
  } catch {
    return null;
  }
}

function isCorsSafe(el: HTMLAudioElement): boolean {
  const src = el.currentSrc || el.src;
  if (!src) return false;
  if (el.crossOrigin === 'anonymous') return true;
  if (src.startsWith('blob:') || src.startsWith('data:')) return true;
  try {
    const u = new URL(src, window.location.href);
    if (u.origin === window.location.origin) return true;
    if (u.hostname.endsWith('supabase.co')) return true;
  } catch { /* ignore */ }
  return false;
}

function signature(el: HTMLAudioElement): string | null {
  const src = el.currentSrc || el.src;
  if (!src) return null;
  return `${src}::${el.crossOrigin || 'none'}`;
}

/** Studio Space presets — each defines an acoustic environment. */
export type StudioSpaceId = 'off' | 'vinyl' | 'studio' | 'bedroom' | 'hall' | 'cathedral' | 'stadium';

interface SpaceProfile {
  duration: number;   // IR length in seconds
  decay: number;      // exponential decay curve (higher = faster fade)
  predelay: number;   // initial silence in seconds (room size cue)
  density: number;    // 0..1 — early reflection density
  damping: number;    // 0..1 — high-frequency damping (0 = bright, 1 = dark)
  wet: number;        // recommended wet mix 0..1
  dry: number;        // recommended dry gain
}

const SPACE_PROFILES: Record<Exclude<StudioSpaceId, 'off'>, SpaceProfile> = {
  vinyl:     { duration: 0.4,  decay: 4.0, predelay: 0.001, density: 0.9, damping: 0.6, wet: 0.10, dry: 0.95 },
  studio:    { duration: 0.6,  decay: 3.2, predelay: 0.005, density: 0.85, damping: 0.35, wet: 0.12, dry: 0.93 },
  bedroom:   { duration: 0.9,  decay: 2.8, predelay: 0.008, density: 0.7, damping: 0.5, wet: 0.18, dry: 0.90 },
  hall:      { duration: 2.4,  decay: 1.8, predelay: 0.025, density: 0.55, damping: 0.25, wet: 0.28, dry: 0.85 },
  cathedral: { duration: 4.5,  decay: 1.2, predelay: 0.045, density: 0.4, damping: 0.15, wet: 0.34, dry: 0.80 },
  stadium:   { duration: 3.5,  decay: 1.5, predelay: 0.080, density: 0.35, damping: 0.30, wet: 0.30, dry: 0.82 },
};

let currentSpaceId: StudioSpaceId = 'off';

/** Build a stereo IR from a SpaceProfile. */
function buildSpaceIR(ctx: AudioContext, p: SpaceProfile): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * p.duration);
  const predelaySamples = Math.floor(ctx.sampleRate * p.predelay);
  const buf = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    let seed = (ch + 1) * 9301;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    // Simple one-pole LP for damping
    let lpState = 0;
    const lpCoef = 1 - p.damping * 0.7;
    for (let i = 0; i < length; i++) {
      if (i < predelaySamples) { data[i] = 0; continue; }
      const t = (i - predelaySamples) / (length - predelaySamples);
      const decay = Math.pow(1 - t, p.decay);
      // Sparser noise for less-dense spaces
      const sample = rand() < p.density ? (rand() * 2 - 1) : 0;
      lpState = lpState + lpCoef * (sample - lpState);
      data[i] = lpState * decay * 0.55;
    }
  }
  return buf;
}

/** Default fallback IR (used when no Studio Space is selected). */
function getReverbIR(ctx: AudioContext): AudioBuffer {
  if (engine.cachedIR && engine.cachedIR.sampleRate === ctx.sampleRate) return engine.cachedIR;
  const duration = 1.6;
  const length = Math.floor(ctx.sampleRate * duration);
  const buf = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    let seed = (ch + 1) * 9301;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    for (let i = 0; i < length; i++) {
      const decay = Math.pow(1 - i / length, 2.2);
      data[i] = (rand() * 2 - 1) * decay * 0.5;
    }
  }
  engine.cachedIR = buf;
  return buf;
}

/**
 * Apply a Studio Space — swaps the convolver IR and sets wet/dry to taste.
 * 'off' restores the default IR and zero wet (caller's reverb slider takes over).
 */
export function setStudioSpace(spaceId: StudioSpaceId) {
  currentSpaceId = spaceId;
  if (engine.mode !== 'processed' || !engine.ctx || !engine.convolver || !engine.dryGain || !engine.wetGain) return;
  const ctx = engine.ctx;
  const now = ctx.currentTime;
  if (spaceId === 'off') {
    engine.convolver.buffer = getReverbIR(ctx);
    engine.wetGain.gain.cancelScheduledValues(now);
    engine.dryGain.gain.cancelScheduledValues(now);
    engine.wetGain.gain.setTargetAtTime(0, now, SMOOTH);
    engine.dryGain.gain.setTargetAtTime(1, now, SMOOTH);
    return;
  }
  const profile = SPACE_PROFILES[spaceId];
  engine.convolver.buffer = buildSpaceIR(ctx, profile);
  engine.wetGain.gain.cancelScheduledValues(now);
  engine.dryGain.gain.cancelScheduledValues(now);
  engine.wetGain.gain.setTargetAtTime(profile.wet, now, SMOOTH);
  engine.dryGain.gain.setTargetAtTime(profile.dry, now, SMOOTH);
}

export function getStudioSpace(): StudioSpaceId {
  return currentSpaceId;
}

function disconnectAll() {
  const nodes: (AudioNode | null)[] = [
    engine.source, ...engine.filters, engine.preGain,
    engine.dryGain, engine.wetGain, engine.convolver,
    engine.stereoPanner, engine.panLfoGain, engine.limiter,
  ];
  for (const n of nodes) {
    if (!n) continue;
    try { n.disconnect(); } catch { /* ignore */ }
  }
  if (engine.panLfo) {
    try { engine.panLfo.stop(); } catch { /* ignore */ }
    try { engine.panLfo.disconnect(); } catch { /* ignore */ }
    engine.panLfo = null;
  }
}

function setMode(m: Mode) {
  if (engine.mode === m) return;
  engine.mode = m;
  for (const cb of engine.listeners) {
    try { cb(m); } catch { /* ignore */ }
  }
}

function buildProcessedChain(ctx: AudioContext, source: MediaElementAudioSourceNode) {
  // EQ bands
  const filters = BAND_DEFS.map((def) => {
    const f = ctx.createBiquadFilter();
    f.type = def.type;
    f.frequency.value = def.freq;
    f.Q.value = def.q;
    f.gain.value = 0;
    return f;
  });

  const preGain = ctx.createGain();
  preGain.gain.value = 0.92;

  const dryGain = ctx.createGain();
  dryGain.gain.value = 1;

  const wetGain = ctx.createGain();
  wetGain.gain.value = 0;

  const convolver = ctx.createConvolver();
  convolver.buffer = getReverbIR(ctx);

  const stereoPanner = ctx.createStereoPanner();
  stereoPanner.pan.value = 0;

  // True brick-wall limiter — prevents clipping warble at high EQ gains
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -1;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.1;

  // Wire graph
  source.connect(filters[0]);
  for (let i = 0; i < filters.length - 1; i++) filters[i].connect(filters[i + 1]);
  filters[filters.length - 1].connect(preGain);

  preGain.connect(dryGain);
  preGain.connect(convolver);
  convolver.connect(wetGain);

  dryGain.connect(stereoPanner);
  wetGain.connect(stereoPanner);
  stereoPanner.connect(limiter);
  limiter.connect(ctx.destination);

  engine.source = source;
  engine.filters = filters;
  engine.preGain = preGain;
  engine.dryGain = dryGain;
  engine.wetGain = wetGain;
  engine.convolver = convolver;
  engine.stereoPanner = stereoPanner;
  engine.limiter = limiter;
  engine.panLfo = null;
  engine.panLfoGain = null;

  // Re-apply the persisted spatial state on the fresh chain
  if (engine.spatialEnabled) startSpatialLfo();
  // Re-apply the persisted Studio Space on the fresh chain
  if (currentSpaceId !== 'off') setStudioSpace(currentSpaceId);
  // Re-apply Late Night compression on the fresh chain
  applyLateNightToLimiter();
}

/**
 * Late Night Mode — heavy dynamic range compression so quiet listening
 * keeps quiet vocals/details audible without loud peaks waking anyone.
 * Re-tunes the always-on limiter into a transparent night compressor +
 * makeup gain. Off restores brick-wall protection only.
 */
function applyLateNightToLimiter() {
  if (!engine.ctx || !engine.limiter || !engine.preGain) return;
  const ctx = engine.ctx;
  const now = ctx.currentTime;
  const c = engine.limiter;
  if (engine.lateNightEnabled) {
    c.threshold.setTargetAtTime(-28, now, SMOOTH);
    c.knee.setTargetAtTime(18, now, SMOOTH);
    c.ratio.setTargetAtTime(8, now, SMOOTH);
    c.attack.setTargetAtTime(0.012, now, SMOOTH);
    c.release.setTargetAtTime(0.18, now, SMOOTH);
    // Makeup gain — quiet content now sits ~6dB louder
    engine.preGain.gain.setTargetAtTime(1.6, now, SMOOTH);
  } else {
    c.threshold.setTargetAtTime(-1, now, SMOOTH);
    c.knee.setTargetAtTime(0, now, SMOOTH);
    c.ratio.setTargetAtTime(20, now, SMOOTH);
    c.attack.setTargetAtTime(0.003, now, SMOOTH);
    c.release.setTargetAtTime(0.1, now, SMOOTH);
    engine.preGain.gain.setTargetAtTime(0.92, now, SMOOTH);
  }
}

export function setLateNight(enabled: boolean) {
  engine.lateNightEnabled = enabled;
  if (engine.mode !== 'processed') return;
  applyLateNightToLimiter();
}

export function getLateNight(): boolean {
  return engine.lateNightEnabled;
}

function buildDirectChain(source: MediaElementAudioSourceNode, ctx: AudioContext) {
  source.connect(ctx.destination);
  engine.source = source;
  engine.filters = [];
  engine.preGain = null;
  engine.dryGain = null;
  engine.wetGain = null;
  engine.convolver = null;
  engine.stereoPanner = null;
  engine.limiter = null;
  if (engine.panLfo) {
    try { engine.panLfo.stop(); } catch { /* ignore */ }
    engine.panLfo = null;
  }
  engine.panLfoGain = null;
}

function getOrCreateSource(ctx: AudioContext, el: HTMLAudioElement): MediaElementAudioSourceNode | null {
  let source = sourceCache.get(el);
  if (source) return source;
  try {
    source = ctx.createMediaElementSource(el);
    sourceCache.set(el, source);
    return source;
  } catch (e) {
    console.warn('[audioEngine] createMediaElementSource failed', e);
    setMode('unsupported');
    return null;
  }
}

/** Connect (or reconnect) the global engine to this audio element. */
export function connectAudioElement(el: HTMLAudioElement): boolean {
  const ctx = ensureCtx();
  if (!ctx) { setMode('unsupported'); return false; }

  const sig = signature(el);
  if (engine.el === el && engine.signature === sig && sig !== null) {
    if (ctx.state === 'suspended') ctx.resume().catch(() => { });
    if (engine.mode === 'processed') return true;
  }

  disconnectAll();
  const source = getOrCreateSource(ctx, el);
  if (!source) return false;

  engine.el = el;
  engine.signature = sig;

  if (!isCorsSafe(el)) {
    buildDirectChain(source, ctx);
    setMode('direct');
    if (ctx.state === 'suspended') ctx.resume().catch(() => { });
    return false;
  }

  try {
    buildProcessedChain(ctx, source);
    setMode('processed');
    if (ctx.state === 'suspended') ctx.resume().catch(() => { });
    return true;
  } catch (e) {
    // CORS / tainted source slipped past the check — fall back to direct
    console.warn('[audioEngine] Failed to build processed chain, falling back to direct', e);
    disconnectAll();
    buildDirectChain(source, ctx);
    setMode('direct');
    return false;
  }
}

/** Direct path — no EQ/effects. Used when EQ is off to save CPU. */
export function bypassAudioElement(el: HTMLAudioElement): boolean {
  if (engine.el !== el && !sourceCache.has(el)) {
    setMode('idle');
    return true;
  }
  const ctx = ensureCtx();
  if (!ctx) return false;
  const source = getOrCreateSource(ctx, el);
  if (!source) return false;

  if (engine.el === el && engine.mode === 'direct') return true;
  disconnectAll();
  engine.el = el;
  engine.signature = signature(el);
  buildDirectChain(source, ctx);
  setMode('direct');
  if (ctx.state === 'suspended' && document.visibilityState === 'visible') {
    ctx.resume().catch(() => { });
  }
  return true;
}

/** Apply 8 band gains in dB. Smoothed via setTargetAtTime. Clamped ±6dB for safety. */
export function setBands(gainsDb: number[], bassBoostPercent = 0) {
  if (engine.mode !== 'processed' || !engine.ctx || !engine.filters.length) return;
  const ctx = engine.ctx;
  const now = ctx.currentTime;
  const boost = (Math.min(60, Math.max(0, bassBoostPercent)) / 60) * 4; // safe +4dB max

  for (let i = 0; i < engine.filters.length; i++) {
    let g = gainsDb[i] ?? 0;
    if (i === 0) g += boost;
    else if (i === 1) g += boost * 0.6;
    else if (i === 2) g += boost * 0.25;
    g = Math.max(-6, Math.min(6, g));
    const param = engine.filters[i].gain;
    param.cancelScheduledValues(now);
    param.setTargetAtTime(g, now, SMOOTH);
  }
}

/** 0..100 wet mix. Capped at 35% wet so vocals stay intelligible. */
export function setReverb(percent: number) {
  if (engine.mode !== 'processed' || !engine.ctx || !engine.dryGain || !engine.wetGain) return;
  const ctx = engine.ctx;
  const now = ctx.currentTime;
  const wet = Math.max(0, Math.min(0.35, percent / 100 * 0.45));
  const dry = 1 - wet * 0.4;
  engine.dryGain.gain.cancelScheduledValues(now);
  engine.wetGain.gain.cancelScheduledValues(now);
  engine.dryGain.gain.setTargetAtTime(dry, now, SMOOTH);
  engine.wetGain.gain.setTargetAtTime(wet, now, SMOOTH);
}

function startSpatialLfo() {
  if (!engine.ctx || !engine.stereoPanner) return;
  const ctx = engine.ctx;
  if (engine.panLfo) {
    try { engine.panLfo.stop(); } catch { /* ignore */ }
    try { engine.panLfo.disconnect(); } catch { /* ignore */ }
  }
  if (engine.panLfoGain) {
    try { engine.panLfoGain.disconnect(); } catch { /* ignore */ }
  }
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = SPATIAL_RATE_HZ;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = SPATIAL_DEPTH;
  lfo.connect(lfoGain);
  lfoGain.connect(engine.stereoPanner.pan);
  lfo.start();
  engine.panLfo = lfo;
  engine.panLfoGain = lfoGain;

  // Add a touch of reverb for the "room" cue
  if (engine.dryGain && engine.wetGain) {
    const now = ctx.currentTime;
    engine.wetGain.gain.cancelScheduledValues(now);
    engine.dryGain.gain.cancelScheduledValues(now);
    engine.wetGain.gain.setTargetAtTime(0.22, now, SMOOTH);
    engine.dryGain.gain.setTargetAtTime(0.85, now, SMOOTH);
  }
}

function stopSpatialLfo() {
  if (engine.panLfo) {
    try { engine.panLfo.stop(); } catch { /* ignore */ }
    try { engine.panLfo.disconnect(); } catch { /* ignore */ }
    engine.panLfo = null;
  }
  if (engine.panLfoGain) {
    try { engine.panLfoGain.disconnect(); } catch { /* ignore */ }
    engine.panLfoGain = null;
  }
  if (engine.ctx && engine.stereoPanner) {
    const now = engine.ctx.currentTime;
    engine.stereoPanner.pan.cancelScheduledValues(now);
    engine.stereoPanner.pan.setTargetAtTime(0, now, SMOOTH);
  }
}

/** Toggle 8D auto-rotating spatial mode. Single boolean — no extra knobs. */
export function setSpatial(enabled: boolean) {
  engine.spatialEnabled = enabled;
  if (engine.mode !== 'processed') return;
  if (enabled) startSpatialLfo();
  else stopSpatialLfo();
}

export function resume() {
  if (engine.ctx?.state === 'suspended') {
    engine.ctx.resume().catch(() => { });
  }
}

export function getState(): Mode {
  return engine.mode;
}

export function subscribe(cb: (m: Mode) => void): () => void {
  engine.listeners.add(cb);
  cb(engine.mode);
  return () => engine.listeners.delete(cb);
}
