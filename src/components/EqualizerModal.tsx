import { useState, useCallback, useEffect, useRef, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, RotateCcw, Volume2, Zap, Waves, Music2 } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { iosSpring } from '@/lib/animations';

interface EqualizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  audioContext: AudioContext | null;
  sourceNode: MediaElementAudioSourceNode | null;
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
  { name: 'Flat', icon: <Music2 className="w-4 h-4" />, bands: [0, 0, 0, 0, 0, 0], bassBoost: 0, reverb: 0, spatialAudio: false },
  { name: 'Bass Boost', icon: <Zap className="w-4 h-4" />, bands: [6, 5, 3, 0, -1, -2], bassBoost: 50, reverb: 0, spatialAudio: false },
  { name: 'Treble Boost', icon: <Sparkles className="w-4 h-4" />, bands: [-2, -1, 0, 2, 4, 5], bassBoost: 0, reverb: 0, spatialAudio: false },
  { name: 'Vocal', icon: <Volume2 className="w-4 h-4" />, bands: [-2, 0, 3, 4, 2, 0], bassBoost: 0, reverb: 20, spatialAudio: false },
  { name: '3D Audio', icon: <Waves className="w-4 h-4" />, bands: [0, 0, 0, 0, 0, 0], bassBoost: 20, reverb: 40, spatialAudio: true },
];

const defaultBands: EQBand[] = [
  { frequency: 60, gain: 0, label: '60Hz' },
  { frequency: 230, gain: 0, label: '230Hz' },
  { frequency: 910, gain: 0, label: '910Hz' },
  { frequency: 3600, gain: 0, label: '3.6kHz' },
  { frequency: 14000, gain: 0, label: '14kHz' },
  { frequency: 20000, gain: 0, label: '20kHz' },
];

const FrequencySlider = memo(({ band, index, onChange }: { band: EQBand; index: number; onChange: (index: number, value: number) => void }) => {
  return (
    <div className="flex flex-col items-center gap-3">
      <span className="text-xs text-muted-foreground font-medium">{band.gain > 0 ? '+' : ''}{band.gain}dB</span>
      <div className="h-32 flex items-center">
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
      <span className="text-[11px] text-muted-foreground/70">{band.label}</span>
    </div>
  );
});

FrequencySlider.displayName = 'FrequencySlider';

const EqualizerModal = ({ isOpen, onClose }: EqualizerModalProps) => {
  const [bands, setBands] = useState<EQBand[]>(defaultBands);
  const [bassBoost, setBassBoost] = useState(0);
  const [reverb, setReverb] = useState(0);
  const [spatialAudio, setSpatialAudio] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>('Flat');

  const handleBandChange = useCallback((index: number, value: number) => {
    setBands(prev => prev.map((b, i) => i === index ? { ...b, gain: value } : b));
    setActivePreset(null);
  }, []);

  const handlePresetSelect = useCallback((preset: Preset) => {
    setBands(prev => prev.map((b, i) => ({ ...b, gain: preset.bands[i] })));
    setBassBoost(preset.bassBoost);
    setReverb(preset.reverb);
    setSpatialAudio(preset.spatialAudio);
    setActivePreset(preset.name);
  }, []);

  const handleReset = useCallback(() => {
    setBands(defaultBands);
    setBassBoost(0);
    setReverb(0);
    setSpatialAudio(false);
    setActivePreset('Flat');
  }, []);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] flex items-end justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/60 backdrop-blur-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        />

        {/* Modal */}
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
                <p className="text-xs text-muted-foreground">Fine-tune your sound</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <motion.button
                onClick={handleReset}
                className="w-10 h-10 rounded-full flex items-center justify-center glass"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <RotateCcw className="w-4 h-4 text-muted-foreground" />
              </motion.button>
              <motion.button
                onClick={onClose}
                className="w-10 h-10 rounded-full flex items-center justify-center glass"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <X className="w-5 h-5" />
              </motion.button>
            </div>
          </div>

          <div className="p-5 space-y-6 max-h-[70vh] overflow-y-auto">
            {/* Presets */}
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Presets</h3>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {presets.map((preset) => (
                  <motion.button
                    key={preset.name}
                    onClick={() => handlePresetSelect(preset)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-full whitespace-nowrap transition-all ${
                      activePreset === preset.name
                        ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white'
                        : 'glass text-muted-foreground hover:text-foreground'
                    }`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {preset.icon}
                    <span className="text-sm font-medium">{preset.name}</span>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* EQ Bands */}
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-4">Frequency Bands</h3>
              <div 
                className="flex justify-between px-4 py-6 rounded-2xl"
                style={{
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 100%)',
                  border: '1px solid rgba(255,255,255,0.05)',
                }}
              >
                {bands.map((band, index) => (
                  <FrequencySlider
                    key={band.frequency}
                    band={band}
                    index={index}
                    onChange={handleBandChange}
                  />
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
                  <span className="text-xs text-muted-foreground">{bassBoost}%</span>
                </div>
                <Slider
                  value={[bassBoost]}
                  min={0}
                  max={100}
                  step={5}
                  onValueChange={([value]) => {
                    setBassBoost(value);
                    setActivePreset(null);
                  }}
                  className="w-full"
                />
              </div>

              {/* Reverb */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Waves className="w-4 h-4 text-cyan-400" />
                    <span className="text-sm">Reverb</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{reverb}%</span>
                </div>
                <Slider
                  value={[reverb]}
                  min={0}
                  max={100}
                  step={5}
                  onValueChange={([value]) => {
                    setReverb(value);
                    setActivePreset(null);
                  }}
                  className="w-full"
                />
              </div>

              {/* 3D Spatial Audio Toggle */}
              <motion.button
                onClick={() => {
                  setSpatialAudio(!spatialAudio);
                  setActivePreset(null);
                }}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${
                  spatialAudio
                    ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30'
                    : 'glass'
                }`}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    spatialAudio ? 'bg-cyan-500' : 'bg-white/10'
                  }`}>
                    <Sparkles className={`w-4 h-4 ${spatialAudio ? 'text-white' : 'text-muted-foreground'}`} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium">3D Spatial Audio</p>
                    <p className="text-xs text-muted-foreground">Immersive surround sound</p>
                  </div>
                </div>
                <div className={`w-12 h-7 rounded-full p-1 transition-colors ${
                  spatialAudio ? 'bg-cyan-500' : 'bg-white/10'
                }`}>
                  <motion.div
                    className="w-5 h-5 rounded-full bg-white shadow-lg"
                    animate={{ x: spatialAudio ? 20 : 0 }}
                    transition={iosSpring}
                  />
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
