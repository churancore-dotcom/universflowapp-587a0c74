import { useState, useCallback, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, RotateCcw, Volume2, Zap, Waves, Music2, Headphones, Globe, Radio } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { iosSpring } from '@/lib/animations';
import { usePlayer } from '@/contexts/PlayerContext';
import { toast } from 'sonner';

interface EqualizerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface EQBand {
  frequency: number;
  gain: number;
  label: string;
}

interface Preset {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  bands: number[];
  bassBoost: number;
}

// Singleton audio graph - persists across modal open/close
const eqState: {
  ctx: AudioContext | null;
  source: MediaElementAudioSourceNode | null;
  filters: BiquadFilterNode[];
  gainNode: GainNode | null;
  compressor: DynamicsCompressorNode | null;
  convolver: ConvolverNode | null;
  dryGain: GainNode | null;
  wetGain: GainNode | null;
  pannerNode: StereoPannerNode | null;
  connectedElement: HTMLAudioElement | null;
  spatialInterval: number | null;
} = {
  ctx: null,
  source: null,
  filters: [],
  gainNode: null,
  compressor: null,
  convolver: null,
  dryGain: null,
  wetGain: null,
  pannerNode: null,
  connectedElement: null,
  spatialInterval: null,
};

const presets: Preset[] = [
  { id: 'flat', name: 'Flat', icon: Music2, bands: [0, 0, 0, 0, 0, 0, 0, 0], bassBoost: 0 },
  { id: 'bass-boost', name: 'Bass Boost', icon: Zap, bands: [3, 2, 1, 0, 0, 0, 0, 0], bassBoost: 30 },
  { id: 'treble-boost', name: 'Treble Boost', icon: Sparkles, bands: [0, 0, 0, 0, 1, 2, 3, 3], bassBoost: 0 },
  { id: 'vocal', name: 'Vocal', icon: Volume2, bands: [-1, 0, 1, 3, 3, 2, 0, -1], bassBoost: 0 },
  { id: '3d-audio', name: '3D Audio', icon: Globe, bands: [1, 0, -1, 0, 0, 1, 2, 1], bassBoost: 10 },
  { id: 'phonk', name: 'Phonk', icon: Headphones, bands: [4, 3, 1, 0, -1, 1, 2, 2], bassBoost: 40 },
  { id: 'deep-bass', name: 'Deep Bass', icon: Waves, bands: [5, 4, 2, 0, 0, 0, -1, -1], bassBoost: 50 },
  { id: 'concert', name: 'Concert', icon: Sparkles, bands: [2, 1, 0, 1, 1, 2, 2, 1], bassBoost: 10 },
];

const defaultBands: EQBand[] = [
  { frequency: 32, gain: 0, label: '32Hz' },
  { frequency: 64, gain: 0, label: '64Hz' },
  { frequency: 125, gain: 0, label: '125Hz' },
  { frequency: 500, gain: 0, label: '500Hz' },
  { frequency: 1000, gain: 0, label: '1kHz' },
  { frequency: 4000, gain: 0, label: '4kHz' },
  { frequency: 8000, gain: 0, label: '8kHz' },
  { frequency: 16000, gain: 0, label: '16kHz' },
];

const STORAGE_KEY = 'eq_settings';

function loadSettings() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return null;
}

function saveSettings(data: any) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

function createReverbIR(ctx: AudioContext, duration = 2, decay = 3) {
  const length = ctx.sampleRate * duration;
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const channelData = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return impulse;
}

// Keep a WeakMap so we never call createMediaElementSource twice on the same element
const sourceMap = new WeakMap<HTMLAudioElement, MediaElementAudioSourceNode>();

function isEqCompatibleSource(audioElement: HTMLAudioElement) {
  const sourceUrl = audioElement.currentSrc || audioElement.src;
  if (!sourceUrl) return false;
  if (audioElement.crossOrigin === 'anonymous') return true;
  return sourceUrl.startsWith('blob:') || sourceUrl.startsWith('data:');
}

function bypassEQGraph(audioElement: HTMLAudioElement) {
  if (!eqState.ctx) return false;

  try {
    eqState.source?.disconnect();
    eqState.filters.forEach((filter) => {
      try { filter.disconnect(); } catch {}
    });
    eqState.gainNode?.disconnect();
    eqState.compressor?.disconnect();
    eqState.dryGain?.disconnect();
    eqState.wetGain?.disconnect();
    eqState.convolver?.disconnect();
    eqState.pannerNode?.disconnect();
  } catch {}

  const source = sourceMap.get(audioElement);
  if (source) {
    try {
      source.disconnect();
      source.connect(eqState.ctx.destination);
    } catch {}
  }

  eqState.connectedElement = null;
  eqState.filters = [];
  eqState.gainNode = null;
  eqState.compressor = null;
  eqState.dryGain = null;
  eqState.wetGain = null;
  eqState.convolver = null;
  eqState.pannerNode = null;

  return false;
}

function buildChain(ctx: AudioContext, source: MediaElementAudioSourceNode) {
  // Create 8 peaking filters with musical Q values
  const filters = defaultBands.map((band) => {
    const filter = ctx.createBiquadFilter();
    filter.type = 'peaking';
    filter.frequency.value = band.frequency;
    // Use wider Q for bass, tighter for treble — more natural sound
    filter.Q.value = band.frequency < 200 ? 0.5 : band.frequency < 2000 ? 0.7 : 1.0;
    filter.gain.value = 0;
    return filter;
  });

  // Master gain
  const gainNode = ctx.createGain();
  gainNode.gain.value = 1;

  // Compressor/limiter — prevents clipping and distortion
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -6;    // Start compressing at -6dB
  compressor.knee.value = 12;         // Soft knee for natural sound
  compressor.ratio.value = 4;         // 4:1 compression ratio
  compressor.attack.value = 0.003;    // Fast attack to catch transients
  compressor.release.value = 0.15;    // Smooth release

  // Reverb (dry/wet)
  const dryGain = ctx.createGain();
  dryGain.gain.value = 1;
  const wetGain = ctx.createGain();
  wetGain.gain.value = 0;
  const convolver = ctx.createConvolver();
  convolver.buffer = createReverbIR(ctx);

  // Stereo panner
  const pannerNode = ctx.createStereoPanner();
  pannerNode.pan.value = 0;

  // Wire: source -> filters -> gain -> compressor -> [dry + convolver->wet] -> panner -> destination
  source.connect(filters[0]);
  for (let i = 0; i < filters.length - 1; i++) {
    filters[i].connect(filters[i + 1]);
  }
  filters[filters.length - 1].connect(gainNode);
  gainNode.connect(compressor);
  compressor.connect(dryGain);
  compressor.connect(convolver);
  convolver.connect(wetGain);
  dryGain.connect(pannerNode);
  wetGain.connect(pannerNode);
  pannerNode.connect(ctx.destination);

  eqState.source = source;
  eqState.filters = filters;
  eqState.gainNode = gainNode;
  eqState.compressor = compressor;
  eqState.dryGain = dryGain;
  eqState.wetGain = wetGain;
  eqState.convolver = convolver;
  eqState.pannerNode = pannerNode;
}

function initEQGraph(audioElement: HTMLAudioElement): boolean {
  if (!isEqCompatibleSource(audioElement)) {
    return bypassEQGraph(audioElement);
  }

  if (eqState.connectedElement === audioElement && eqState.ctx && eqState.filters.length) {
    if (eqState.ctx.state === 'suspended') eqState.ctx.resume();
    return true;
  }

  try {
    // Create or reuse AudioContext
    if (!eqState.ctx || eqState.ctx.state === 'closed') {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return false;
      eqState.ctx = new AC();
    }
    const ctx = eqState.ctx;

    // Disconnect old chain cleanly
    try {
      eqState.source?.disconnect();
      eqState.filters.forEach(f => { try { f.disconnect(); } catch {} });
      eqState.gainNode?.disconnect();
      eqState.compressor?.disconnect();
      eqState.dryGain?.disconnect();
      eqState.wetGain?.disconnect();
      eqState.convolver?.disconnect();
      eqState.pannerNode?.disconnect();
    } catch {}
    eqState.filters = [];

    // Get or create source for this element
    let source = sourceMap.get(audioElement);
    if (!source) {
      source = ctx.createMediaElementSource(audioElement);
      sourceMap.set(audioElement, source);
    }

    buildChain(ctx, source);
    eqState.connectedElement = audioElement;

    if (ctx.state === 'suspended') ctx.resume();
    return true;
  } catch (error) {
    console.error('EQ init error:', error);
    return bypassEQGraph(audioElement);
  }
}

const EqualizerModal = ({ isOpen, onClose }: EqualizerModalProps) => {
  const { audioElement, currentSong } = usePlayer();

  const saved = loadSettings();
  const [bands, setBands] = useState<EQBand[]>(
    saved?.bands ? defaultBands.map((b, i) => ({ ...b, gain: saved.bands[i] ?? 0 })) : defaultBands
  );
  const [bassBoost, setBassBoost] = useState(saved?.bassBoost ?? 0);
  const [reverb, setReverb] = useState(saved?.reverb ?? 0);
  const [playbackSpeed, setPlaybackSpeed] = useState(saved?.playbackSpeed ?? 1);
  const [spatialAudio, setSpatialAudio] = useState(saved?.spatialAudio ?? false);
  const [activePreset, setActivePreset] = useState<string>(saved?.activePreset ?? 'flat');
  const [isConnected, setIsConnected] = useState(false);

  // Connect to audio element and apply saved settings
  useEffect(() => {
    if (!audioElement) {
      setIsConnected(false);
      return;
    }

    const connected = initEQGraph(audioElement);
    setIsConnected(connected);

    if (connected) {
      applyBands(bands, bassBoost);
      applyReverb(reverb);
      applySpeed(playbackSpeed, audioElement);
      applySpatial(spatialAudio);
      return;
    }

    applySpeed(playbackSpeed, audioElement);
    applySpatial(false);
  }, [audioElement, currentSong?.id]);

  // Resume AudioContext on user interaction / play
  useEffect(() => {
    if (!audioElement) return;
    const resume = () => {
      if (eqState.ctx?.state === 'suspended') {
        eqState.ctx.resume();
      }
    };
    audioElement.addEventListener('play', resume);
    document.addEventListener('click', resume, { once: true });
    return () => {
      audioElement.removeEventListener('play', resume);
      document.removeEventListener('click', resume);
    };
  }, [audioElement]);

  // Helper functions that directly manipulate the audio graph
  function applyBands(currentBands: EQBand[], currentBassBoost: number) {
    if (!eqState.filters.length || !eqState.ctx) return;
    const ctx = eqState.ctx;
    const now = ctx.currentTime;
    // Bass boost: scale to max +6dB extra on lowest bands (was 3.5 — caused clipping)
    const boost = (currentBassBoost / 100) * 4;

    currentBands.forEach((band, i) => {
      if (!eqState.filters[i]) return;
      let gain = band.gain;
      // Apply bass boost only to the lowest 3 bands with tapering
      if (i === 0) gain += boost;
      else if (i === 1) gain += boost * 0.6;
      else if (i === 2) gain += boost * 0.25;
      // Clamp to safe range — the compressor handles the rest
      const safeGain = Math.max(-8, Math.min(8, gain));
      eqState.filters[i].gain.setTargetAtTime(safeGain, now, 0.05);
    });

    // Auto-reduce master gain when boosting heavily to prevent distortion
    if (eqState.gainNode) {
      const maxGain = Math.max(...currentBands.map(b => Math.abs(b.gain)), boost);
      const masterGain = maxGain > 4 ? 1 - (maxGain - 4) * 0.06 : 1;
      eqState.gainNode.gain.setTargetAtTime(Math.max(0.62, masterGain), now, 0.05);
    }
  }

  function applyReverb(reverbLevel: number) {
    if (!eqState.dryGain || !eqState.wetGain) return;
    const wet = reverbLevel / 100;
    // Keep dry signal strong, blend reverb subtly
    eqState.dryGain.gain.value = 1 - (wet * 0.08);
    eqState.wetGain.gain.value = wet * 0.1;
  }

  function applySpeed(speed: number, el?: HTMLAudioElement | null) {
    const target = el || audioElement;
    if (target) target.playbackRate = speed;
  }

  function applySpatial(enabled: boolean) {
    if (eqState.spatialInterval) {
      clearInterval(eqState.spatialInterval);
      eqState.spatialInterval = null;
    }

    if (enabled && eqState.pannerNode) {
      let angle = 0;
      eqState.spatialInterval = window.setInterval(() => {
        angle += 0.02;
        if (eqState.pannerNode) {
          eqState.pannerNode.pan.value = Math.sin(angle) * 0.2;
        }
      }, 80);
    } else if (eqState.pannerNode) {
      eqState.pannerNode.pan.value = 0;
    }
  }

  // Apply EQ band changes
  useEffect(() => {
    applyBands(bands, bassBoost);
  }, [bands, bassBoost]);

  useEffect(() => {
    applyReverb(reverb);
  }, [reverb]);

  useEffect(() => {
    applySpeed(playbackSpeed);
  }, [playbackSpeed, audioElement]);

  useEffect(() => {
    applySpatial(spatialAudio);
    return () => {
      if (eqState.spatialInterval) {
        clearInterval(eqState.spatialInterval);
        eqState.spatialInterval = null;
      }
    };
  }, [spatialAudio]);

  // Save settings on change
  useEffect(() => {
    saveSettings({
      bands: bands.map(b => b.gain),
      bassBoost,
      reverb,
      playbackSpeed,
      spatialAudio,
      activePreset,
    });
  }, [bands, bassBoost, reverb, playbackSpeed, spatialAudio, activePreset]);

  const handleBandChange = useCallback((index: number, value: number) => {
    setBands(prev => prev.map((b, i) => i === index ? { ...b, gain: value } : b));
    setActivePreset('custom');
  }, []);

  const handlePresetSelect = useCallback((preset: Preset) => {
    setBands(prev => prev.map((b, i) => ({ ...b, gain: preset.bands[i] ?? 0 })));
    setBassBoost(preset.bassBoost);
    setActivePreset(preset.id);
    toast.success(`${preset.name} preset applied`);
  }, []);

  const handleReset = useCallback(() => {
    setBands(defaultBands);
    setBassBoost(0);
    setReverb(0);
    setPlaybackSpeed(1);
    setSpatialAudio(false);
    setActivePreset('flat');
    if (audioElement) audioElement.playbackRate = 1;
    // Reset master gain
    if (eqState.gainNode && eqState.ctx) {
      eqState.gainNode.gain.setTargetAtTime(1, eqState.ctx.currentTime, 0.05);
    }
    toast.success('Equalizer reset');
  }, [audioElement]);

  if (!isOpen) return null;

  const speedMarks = [0.5, 1, 1.5, 2];

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] flex items-end justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="absolute inset-0 bg-black/60 backdrop-blur-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        />

        <motion.div
          className="relative w-full max-w-lg mx-4 mb-4 rounded-3xl overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, rgba(30, 30, 35, 0.98) 0%, rgba(20, 20, 25, 0.99) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={iosSpring}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-violet-500 to-purple-600">
                <Waves className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Equalizer</h2>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  {isConnected && <span className="w-1.5 h-1.5 rounded-full bg-green-400" />}
                  {isConnected ? 'Connected' : currentSong ? 'EQ unavailable for this stream' : 'Play a song to connect'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <motion.button onClick={handleReset} className="w-10 h-10 rounded-full flex items-center justify-center glass" whileTap={{ scale: 0.95 }}>
                <RotateCcw className="w-4 h-4 text-muted-foreground" />
              </motion.button>
              <motion.button onClick={onClose} className="w-10 h-10 rounded-full flex items-center justify-center glass" whileTap={{ scale: 0.95 }}>
                <X className="w-5 h-5" />
              </motion.button>
            </div>
          </div>

          <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
            {/* Presets 2x4 Grid */}
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Presets</h3>
              <div className="grid grid-cols-4 gap-2">
                {presets.map((preset) => {
                  const Icon = preset.icon;
                  const isSelected = activePreset === preset.id;
                  return (
                    <motion.button
                      key={preset.id}
                      onClick={() => handlePresetSelect(preset)}
                      className="relative flex flex-col items-center gap-2 py-3 px-2 rounded-xl overflow-hidden transition-all"
                      style={{
                        background: isSelected
                          ? 'linear-gradient(135deg, hsl(var(--primary)), hsl(270 80% 55%))'
                          : 'rgba(28, 28, 30, 0.8)',
                        border: isSelected
                          ? '1px solid hsl(var(--primary) / 0.6)'
                          : '1px solid rgba(255, 255, 255, 0.06)',
                      }}
                      whileTap={{ scale: 0.96 }}
                    >
                      <Icon className={`w-5 h-5 ${isSelected ? 'text-white' : 'text-muted-foreground'}`} />
                      <span className={`text-[11px] font-medium leading-tight text-center ${isSelected ? 'text-white' : 'text-muted-foreground'}`}>
                        {preset.name}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* 8-Band Equalizer */}
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">8-Band Equalizer</h3>
              <div
                className="rounded-2xl p-4"
                style={{
                  background: 'rgba(28, 28, 30, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                }}
              >
                <div className="flex justify-between mb-2 px-1">
                  {bands.map((band) => (
                    <span key={band.frequency} className="text-[10px] text-muted-foreground font-mono w-8 text-center">
                      {band.gain > 0 ? '+' : ''}{band.gain}
                    </span>
                  ))}
                </div>

                <div className="flex justify-between gap-1 mb-2">
                  {bands.map((band, index) => (
                    <div key={band.frequency} className="flex-1 flex items-center h-24">
                      <Slider
                        orientation="vertical"
                        value={[band.gain]}
                        min={-8}
                        max={8}
                        step={1}
                        onValueChange={([value]) => handleBandChange(index, value)}
                        className="h-full [&_[role=slider]]:w-5 [&_[role=slider]]:h-5 [&_[role=slider]]:bg-rose-500 [&_[role=slider]]:border-2 [&_[role=slider]]:border-rose-400 [&_[data-radix-slider-track]]:bg-white/10 [&_[data-radix-slider-range]]:bg-rose-500/40"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex justify-between px-1">
                  {bands.map((band) => (
                    <span key={band.frequency} className="text-[9px] text-muted-foreground/60 w-8 text-center">
                      {band.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Effects */}
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Effects</h3>
              <div className="space-y-4">
                {/* Bass Boost */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-orange-400" />
                      <span className="text-sm font-medium">Bass Boost</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{bassBoost}%</span>
                  </div>
                  <Slider
                    value={[bassBoost]}
                    min={0}
                    max={100}
                    step={5}
                    onValueChange={([value]) => { setBassBoost(value); setActivePreset('custom'); }}
                    className="w-full [&_[role=slider]]:bg-rose-500 [&_[role=slider]]:border-rose-400 [&_[data-radix-slider-range]]:bg-rose-500/60"
                  />
                </div>

                {/* Reverb */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Waves className="w-4 h-4 text-blue-400" />
                      <span className="text-sm font-medium">Reverb</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{reverb}%</span>
                  </div>
                  <Slider
                    value={[reverb]}
                    min={0}
                    max={100}
                    step={5}
                    onValueChange={([value]) => setReverb(value)}
                    className="w-full [&_[role=slider]]:bg-rose-500 [&_[role=slider]]:border-rose-400 [&_[data-radix-slider-range]]:bg-rose-500/60"
                  />
                </div>

                {/* Playback Speed */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Radio className="w-4 h-4 text-rose-400" />
                      <span className="text-sm font-medium">Playback Speed</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{playbackSpeed}x</span>
                  </div>
                  <Slider
                    value={[playbackSpeed * 100]}
                    min={50}
                    max={200}
                    step={25}
                    onValueChange={([value]) => setPlaybackSpeed(value / 100)}
                    className="w-full [&_[role=slider]]:bg-rose-500 [&_[role=slider]]:border-rose-400 [&_[data-radix-slider-range]]:bg-rose-500"
                  />
                  <div className="flex justify-between mt-1">
                    {speedMarks.map(s => (
                      <span key={s} className="text-[10px] text-muted-foreground/50">{s}x</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 3D Spatial Audio */}
            <div
              className="flex items-center justify-between p-4 rounded-2xl"
              style={{
                background: 'rgba(28, 28, 30, 0.8)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/5">
                  <Globe className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <span className="text-sm font-medium">3D Spatial Audio</span>
                  <p className="text-[11px] text-muted-foreground">Immersive surround sound</p>
                </div>
              </div>
              <Switch
                checked={spatialAudio}
                onCheckedChange={setSpatialAudio}
                className="data-[state=checked]:bg-primary"
              />
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default EqualizerModal;
