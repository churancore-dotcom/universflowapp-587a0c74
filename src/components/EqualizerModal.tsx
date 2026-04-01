import { useState, useCallback, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, RotateCcw, Volume2, Zap, Waves, Music2, Headphones, Radio, Globe } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { iosSpring } from '@/lib/animations';
import { usePlayer } from '@/contexts/PlayerContext';
import { toast } from 'sonner';
import { audioEngine } from '@/lib/equalizer';

interface EqualizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  audioContext?: AudioContext | null;
  sourceNode?: MediaElementAudioSourceNode | null;
}

interface EQBand {
  frequency: number;
  gain: number;
  label: string;
}

interface Preset {
  name: string;
  icon: React.ReactNode;
  bands: number[];
  bassBoost: number;
  reverb: number;
  spatialAudio: boolean;
}

const presets: Preset[] = [
  { name: 'Flat', icon: <Music2 className="w-4 h-4" />, bands: [0, 0, 0, 0, 0, 0, 0, 0], bassBoost: 0, reverb: 0, spatialAudio: false },
  { name: 'Bass Boost', icon: <Zap className="w-4 h-4" />, bands: [8, 6, 4, 1, 0, -1, -2, -2], bassBoost: 60, reverb: 0, spatialAudio: false },
  { name: 'Treble Boost', icon: <Sparkles className="w-4 h-4" />, bands: [-2, -1, 0, 1, 3, 5, 6, 7], bassBoost: 0, reverb: 0, spatialAudio: false },
  { name: 'Vocal', icon: <Volume2 className="w-4 h-4" />, bands: [-3, -1, 1, 4, 5, 3, 1, 0], bassBoost: 0, reverb: 25, spatialAudio: false },
  { name: '8D Audio', icon: <Globe className="w-4 h-4" />, bands: [2, 1, 0, -1, 0, 1, 2, 3], bassBoost: 15, reverb: 55, spatialAudio: true },
  { name: 'Phonk', icon: <Radio className="w-4 h-4" />, bands: [7, 5, 3, 0, -2, 1, 3, 4], bassBoost: 70, reverb: 15, spatialAudio: false },
  { name: 'Deep Bass', icon: <Headphones className="w-4 h-4" />, bands: [10, 8, 5, 2, 0, -1, -2, -3], bassBoost: 80, reverb: 10, spatialAudio: false },
  { name: 'Concert', icon: <Sparkles className="w-4 h-4" />, bands: [3, 1, 0, -1, 0, 2, 4, 5], bassBoost: 10, reverb: 60, spatialAudio: true },
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

function FrequencySliderComponent({ band, index, onChange }: { band: EQBand; index: number; onChange: (i: number, v: number) => void }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-[10px] text-muted-foreground font-medium tabular-nums">
        {band.gain > 0 ? '+' : ''}{band.gain}
      </span>
      <div className="h-28 flex items-center">
        <Slider
          orientation="vertical"
          value={[band.gain]}
          min={-12}
          max={12}
          step={1}
          onValueChange={([value]) => onChange(index, value)}
          className="h-full"
        />
      </div>
      <span className="text-[9px] text-muted-foreground/70">{band.label}</span>
    </div>
  );
}
const FrequencySlider = memo(FrequencySliderComponent);
FrequencySlider.displayName = 'FrequencySlider';

const EqualizerModal = ({ isOpen, onClose }: EqualizerModalProps) => {
  const { audioElement } = usePlayer();
  const [bands, setBands] = useState<EQBand[]>(() => {
    try { const s = localStorage.getItem('eq_bands'); if (s) return JSON.parse(s); } catch {} return defaultBands;
  });
  const [bassBoost, setBassBoost] = useState(() => { try { return Number(localStorage.getItem('eq_bass')) || 0; } catch { return 0; } });
  const [reverb, setReverb] = useState(() => { try { return Number(localStorage.getItem('eq_reverb')) || 0; } catch { return 0; } });
  const [spatialAudio, setSpatialAudio] = useState(() => { try { return localStorage.getItem('eq_spatial') === 'true'; } catch { return false; } });
  const [playbackSpeed, setPlaybackSpeed] = useState(() => { try { return Number(localStorage.getItem('eq_speed')) || 1; } catch { return 1; } });
  const [activePreset, setActivePreset] = useState<string | null>(() => { try { return localStorage.getItem('eq_preset') || 'Flat'; } catch { return 'Flat'; } });
  const [connected, setConnected] = useState(false);

  // Persist settings
  useEffect(() => {
    try {
      localStorage.setItem('eq_bands', JSON.stringify(bands));
      localStorage.setItem('eq_bass', String(bassBoost));
      localStorage.setItem('eq_reverb', String(reverb));
      localStorage.setItem('eq_spatial', String(spatialAudio));
      localStorage.setItem('eq_speed', String(playbackSpeed));
      if (activePreset) localStorage.setItem('eq_preset', activePreset);
    } catch {}
  }, [bands, bassBoost, reverb, spatialAudio, playbackSpeed, activePreset]);

  // Bind engine when modal opens
  useEffect(() => {
    if (!audioElement || !isOpen) return;
    let cancelled = false;
    (async () => {
      const ok = await audioEngine.bind(audioElement);
      if (cancelled) return;
      setConnected(ok);
      if (ok) {
        // Apply all current settings immediately
        audioEngine.setBands(bands.map(b => b.gain));
        audioEngine.setBassBoost(bassBoost, bands.map(b => b.gain));
        audioEngine.setReverb(reverb);
        audioEngine.set8D(spatialAudio);
      }
    })();
    return () => { cancelled = true; };
  }, [audioElement, isOpen]);

  // Resume on open
  useEffect(() => { if (isOpen) audioEngine.resume(); }, [isOpen]);

  // Push changes to engine
  useEffect(() => { if (connected) audioEngine.setBands(bands.map(b => b.gain)); }, [bands, connected]);
  useEffect(() => { if (connected) audioEngine.setBassBoost(bassBoost, bands.map(b => b.gain)); }, [bassBoost, bands, connected]);
  useEffect(() => { if (connected) audioEngine.setReverb(reverb); }, [reverb, connected]);
  useEffect(() => {
    if (connected) audioEngine.set8D(spatialAudio);
    return () => { if (!spatialAudio) audioEngine.set8D(false); };
  }, [spatialAudio, connected]);
  useEffect(() => { if (audioElement) audioElement.playbackRate = playbackSpeed; }, [playbackSpeed, audioElement]);

  const handleBandChange = useCallback((index: number, value: number) => {
    setBands(prev => prev.map((b, i) => i === index ? { ...b, gain: value } : b));
    setActivePreset(null);
  }, []);

  const handlePresetSelect = useCallback((preset: Preset) => {
    setBands(prev => prev.map((b, i) => ({ ...b, gain: preset.bands[i] ?? 0 })));
    setBassBoost(preset.bassBoost);
    setReverb(preset.reverb);
    setSpatialAudio(preset.spatialAudio);
    setActivePreset(preset.name);
    toast.success(`${preset.name} preset applied`);
  }, []);

  const handleReset = useCallback(() => {
    setBands(defaultBands);
    setBassBoost(0);
    setReverb(0);
    setSpatialAudio(false);
    setPlaybackSpeed(1);
    setActivePreset('Flat');
    if (audioElement) audioElement.playbackRate = 1;
    toast.success('Equalizer reset');
  }, [audioElement]);

  if (!isOpen) return null;

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
                <p className="text-xs text-muted-foreground">
                  {connected ? '● Connected' : 'Play a song to connect'}
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
            {/* Presets */}
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Presets</h3>
              <div className="grid grid-cols-4 gap-2">
                {presets.map((preset) => (
                  <motion.button
                    key={preset.name}
                    onClick={() => handlePresetSelect(preset)}
                    className={`flex flex-col items-center gap-1.5 px-2 py-2.5 rounded-xl transition-all ${
                      activePreset === preset.name
                        ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white'
                        : 'glass text-muted-foreground hover:text-foreground'
                    }`}
                    whileTap={{ scale: 0.95 }}
                  >
                    {preset.icon}
                    <span className="text-[10px] font-medium leading-tight">{preset.name}</span>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* 8-Band EQ */}
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">8-Band Equalizer</h3>
              <div
                className="flex justify-between px-2 py-4 rounded-2xl"
                style={{
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 100%)',
                  border: '1px solid rgba(255,255,255,0.05)',
                }}
              >
                {bands.map((band, index) => (
                  <FrequencySlider key={band.frequency} band={band} index={index} onChange={handleBandChange} />
                ))}
              </div>
            </div>

            {/* Effects */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">Effects</h3>
              {/* Bass Boost */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-orange-400" />
                    <span className="text-sm">Bass Boost</span>
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">{bassBoost}%</span>
                </div>
                <Slider value={[bassBoost]} min={0} max={100} step={5} onValueChange={([v]) => { setBassBoost(v); setActivePreset(null); }} className="w-full" />
              </div>
              {/* Reverb */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Waves className="w-4 h-4 text-cyan-400" />
                    <span className="text-sm">Reverb</span>
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">{reverb}%</span>
                </div>
                <Slider value={[reverb]} min={0} max={100} step={5} onValueChange={([v]) => { setReverb(v); setActivePreset(null); }} className="w-full" />
              </div>
              {/* Playback Speed */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Radio className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm">Playback Speed</span>
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">{playbackSpeed}x</span>
                </div>
                <Slider value={[playbackSpeed]} min={0.5} max={2} step={0.05} onValueChange={([v]) => setPlaybackSpeed(v)} className="w-full" />
                <div className="flex justify-between text-[10px] text-muted-foreground/50 px-1">
                  <span>0.5x</span><span>1x</span><span>1.5x</span><span>2x</span>
                </div>
              </div>

              {/* 8D Audio Toggle */}
              <motion.button
                onClick={() => {
                  setSpatialAudio(!spatialAudio);
                  setActivePreset(null);
                  toast.success(spatialAudio ? '8D Audio disabled' : '8D Audio enabled — sound rotates around you');
                }}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${
                  spatialAudio ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30' : 'glass'
                }`}
                whileTap={{ scale: 0.99 }}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${spatialAudio ? 'bg-cyan-500' : 'bg-white/10'}`}>
                    <Sparkles className={`w-4 h-4 ${spatialAudio ? 'text-white' : 'text-muted-foreground'}`} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium">8D Audio</p>
                    <p className="text-xs text-muted-foreground">Sound rotates around your head</p>
                  </div>
                </div>
                <div className={`w-12 h-7 rounded-full p-1 transition-colors ${spatialAudio ? 'bg-cyan-500' : 'bg-white/10'}`}>
                  <motion.div className="w-5 h-5 rounded-full bg-white shadow-lg" animate={{ x: spatialAudio ? 20 : 0 }} transition={iosSpring} />
                </div>
              </motion.button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default EqualizerModal;
