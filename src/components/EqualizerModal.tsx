import { useState, useCallback, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, RotateCcw, Volume2, Zap, Waves, Music2, Headphones, Globe, Radio } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { iosSpring } from '@/lib/animations';
import { usePlayer } from '@/contexts/PlayerContext';
import { toast } from 'sonner';
import { usePremium } from '@/hooks/usePremium';
import PremiumLockOverlay from './PremiumLockOverlay';
import {
  connectAudioElement,
  setBands as engineSetBands,
  setReverb as engineSetReverb,
  setSpatial as engineSetSpatial,
  resume as engineResume,
} from '@/lib/audioEngine';
import { useEngineState } from '@/hooks/useGlobalAudioEngine';

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

// Labels mirror the engine's BAND_DEFS (lowshelf 60Hz -> highshelf 12kHz)
const defaultBands: EQBand[] = [
  { frequency: 60, gain: 0, label: '60' },
  { frequency: 170, gain: 0, label: '170' },
  { frequency: 310, gain: 0, label: '310' },
  { frequency: 600, gain: 0, label: '600' },
  { frequency: 1000, gain: 0, label: '1k' },
  { frequency: 3000, gain: 0, label: '3k' },
  { frequency: 6000, gain: 0, label: '6k' },
  { frequency: 12000, gain: 0, label: '12k' },
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

const EqualizerModal = ({ isOpen, onClose }: EqualizerModalProps) => {
  const { audioElement, currentSong } = usePlayer();
  const { isPremium, isLoading: premiumLoading } = usePremium();
  const engineMode = useEngineState();
  const isConnected = engineMode === 'processed';

  const saved = loadSettings();
  const [bands, setBandsState] = useState<EQBand[]>(
    saved?.bands ? defaultBands.map((b, i) => ({ ...b, gain: saved.bands[i] ?? 0 })) : defaultBands
  );
  const [bassBoost, setBassBoost] = useState(saved?.bassBoost ?? 0);
  const [reverb, setReverb] = useState(saved?.reverb ?? 0);
  const [playbackSpeed, setPlaybackSpeed] = useState(saved?.playbackSpeed ?? 1);
  const [spatialAudio, setSpatialAudio] = useState(saved?.spatialAudio ?? false);
  const [activePreset, setActivePreset] = useState<string>(saved?.activePreset ?? 'flat');

  // Ensure the engine is wired the moment the modal opens / song changes
  useEffect(() => {
    if (audioElement) {
      engineResume();
      connectAudioElement(audioElement);
    }
  }, [audioElement, currentSong?.id]);

  // Push EQ band changes to the engine (smoothed, never rebuilds graph)
  useEffect(() => {
    engineResume();
    if (audioElement) connectAudioElement(audioElement);
    engineSetBands(bands.map(b => b.gain), bassBoost);
  }, [bands, bassBoost, audioElement]);

  useEffect(() => {
    engineSetReverb(reverb);
  }, [reverb]);

  useEffect(() => {
    engineSetSpatial(spatialAudio);
  }, [spatialAudio]);

  useEffect(() => {
    if (audioElement) audioElement.playbackRate = playbackSpeed;
  }, [playbackSpeed, audioElement]);

  // Persist
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
    setBandsState(prev => prev.map((b, i) => i === index ? { ...b, gain: value } : b));
    setActivePreset('custom');
  }, []);

  const handlePresetSelect = useCallback((preset: Preset) => {
    setBandsState(prev => prev.map((b, i) => ({ ...b, gain: preset.bands[i] ?? 0 })));
    setBassBoost(preset.bassBoost);
    setActivePreset(preset.id);
    toast.success(`${preset.name} preset applied`);
  }, []);

  const handleReset = useCallback(() => {
    setBandsState(defaultBands);
    setBassBoost(0);
    setReverb(0);
    setPlaybackSpeed(1);
    setSpatialAudio(false);
    setActivePreset('flat');
    if (audioElement) audioElement.playbackRate = 1;
    toast.success('Equalizer reset');
  }, [audioElement]);

  if (!isOpen) return null;

  // Premium gate
  if (!premiumLoading && !isPremium) {
    return (
      <AnimatePresence>
        <PremiumLockOverlay
          title="Studio-grade Equalizer"
          description="Shape every frequency with the 8-band EQ, bass boost, reverb and spatial audio. Available on Premium."
          onClose={onClose}
        />
      </AnimatePresence>
    );
  }

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
                  {isConnected ? 'Connected' : currentSong ? 'This stream does not expose safe audio processing' : 'Play a song to connect'}
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
              {!isConnected && currentSong && (
                <div
                  className="rounded-2xl px-4 py-3 text-xs text-muted-foreground"
                  style={{
                    background: 'rgba(28, 28, 30, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                  }}
                >
                  Equalizer settings are saved, but this specific stream is playing in direct mode to avoid broken vocals or silent playback.
                </div>
              )}

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
