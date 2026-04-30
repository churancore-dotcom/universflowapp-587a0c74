import { useState, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Headphones, Music2, Waves, Zap, Check, Sparkles, Volume2 } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { iosSpring, iosBounce } from '@/lib/animations';
import { useAudioSettings } from '@/hooks/useAudioSettings';
import { usePremium } from '@/hooks/usePremium';
import PremiumLockOverlay from './PremiumLockOverlay';

interface AdvancedAudioSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

const equalizerPresets = [
  { id: 'flat', name: 'Flat', icon: Music2, description: 'No EQ applied', bands: [0, 0, 0, 0, 0] },
  { id: 'bass-boost', name: 'Bass Boost', icon: Zap, description: 'Enhanced low frequencies', bands: [6, 4, 0, 0, 0] },
  { id: 'vocal', name: 'Vocal', icon: Waves, description: 'Clear vocals', bands: [-2, 0, 3, 2, 0] },
  { id: 'rock', name: 'Rock', icon: Zap, description: 'Punchy mids & highs', bands: [4, 2, 0, 2, 4] },
  { id: 'electronic', name: 'Electronic', icon: Sparkles, description: 'Deep bass & crisp highs', bands: [5, 3, 0, 2, 4] },
  { id: 'acoustic', name: 'Acoustic', icon: Music2, description: 'Natural & warm', bands: [3, 1, 1, 2, 3] },
];

const audioQualities = [
  { id: '128', label: '128 kbps', description: 'Data saver', size: '~1MB/min' },
  { id: '256', label: '256 kbps', description: 'High quality', size: '~2MB/min' },
  { id: '320', label: '320 kbps', description: 'Very high', size: '~2.5MB/min' },
  { id: 'lossless', label: 'Lossless', description: 'Studio quality', size: '~10MB/min', premium: true },
];

const AdvancedAudioSettings = memo(function AdvancedAudioSettings({ 
  isOpen, 
  onClose 
}: AdvancedAudioSettingsProps) {
  const { settings, updateSetting } = useAudioSettings();
  const { isPremium, isLoading: premiumLoading } = usePremium();
  
  const selectedPreset = settings.selectedPreset;
  const selectedQuality = settings.selectedQuality;
  const spatialAudio = settings.spatialAudio;
  const dynamicNormalization = settings.dynamicNormalization;
  const customBands = settings.customBands;

  const setSelectedPreset = (value: string) => updateSetting('selectedPreset', value);
  const setSelectedQuality = (value: string) => updateSetting('selectedQuality', value);
  const setSpatialAudio = (value: boolean) => updateSetting('spatialAudio', value);
  const setDynamicNormalization = (value: boolean) => updateSetting('dynamicNormalization', value);
  const setCustomBands = (value: number[]) => updateSetting('customBands', value);

  useEffect(() => {
    const preset = equalizerPresets.find(p => p.id === selectedPreset);
    if (preset && selectedPreset !== 'custom') {
      setCustomBands(preset.bands);
    }
  }, [selectedPreset]);

  const handleBandChange = (index: number, value: number[]) => {
    const newBands = [...customBands];
    newBands[index] = value[0];
    setCustomBands(newBands);
    setSelectedPreset('custom');
  };

  const bandLabels = ['60Hz', '230Hz', '910Hz', '4kHz', '14kHz'];

  // Premium gate
  if (isOpen && !premiumLoading && !isPremium) {
    return (
      <AnimatePresence>
        <PremiumLockOverlay
          title="Advanced Audio Lab"
          description="Custom EQ presets, lossless quality, dynamic normalization and spatial audio. Available on Premium."
          onClose={onClose}
        />
      </AnimatePresence>
    );
  }

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent 
        side="bottom" 
        className="h-[90vh] bg-black/95 border-t border-white/10 rounded-t-3xl p-0 overflow-hidden"
      >
        <motion.div
          className="h-full flex flex-col"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          transition={iosSpring}
        >
          {/* Header */}
          <div 
            className="sticky top-0 z-10 px-5 pt-4 pb-3"
            style={{
              background: 'rgba(0, 0, 0, 0.9)',
              backdropFilter: 'blur(40px)',
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <motion.div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #06b6d4, #0891b2)' }}
                  whileHover={{ scale: 1.05 }}
                  transition={iosBounce}
                >
                  <Headphones className="w-5 h-5 text-white" />
                </motion.div>
                <div>
                  <h2 className="text-lg font-bold">Advanced Audio</h2>
                  <p className="text-xs text-muted-foreground">Premium sound settings</p>
                </div>
              </div>
              <motion.button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10"
                whileHover={{ scale: 1.1, backgroundColor: 'rgba(255, 255, 255, 0.15)' }}
                whileTap={{ scale: 0.9 }}
              >
                <X className="w-4 h-4" />
              </motion.button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-5 pb-10 space-y-6">
            
            {/* Audio Quality */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...iosSpring, delay: 0.1 }}
            >
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">AUDIO QUALITY</h3>
              <div 
                className="rounded-2xl overflow-hidden"
                style={{ background: 'rgba(28, 28, 30, 0.8)', border: '1px solid rgba(255, 255, 255, 0.06)' }}
              >
                {audioQualities.map((quality, index) => (
                  <motion.button
                    key={quality.id}
                    className={`w-full flex items-center justify-between px-4 py-3.5 text-left ${
                      index !== audioQualities.length - 1 ? 'border-b border-white/[0.06]' : ''
                    }`}
                    onClick={() => setSelectedQuality(quality.id)}
                    whileTap={{ scale: 0.98, backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{quality.label}</span>
                        {quality.premium && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-400">
                            PREMIUM
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">{quality.description}</span>
                        <span className="text-[10px] text-muted-foreground/60">• {quality.size}</span>
                      </div>
                    </div>
                    <motion.div
                      className={`w-5 h-5 rounded-full flex items-center justify-center ${
                        selectedQuality === quality.id 
                          ? 'bg-cyan-500' 
                          : 'border-2 border-white/20'
                      }`}
                      animate={{ scale: selectedQuality === quality.id ? 1 : 0.9 }}
                      transition={iosBounce}
                    >
                      {selectedQuality === quality.id && (
                        <Check className="w-3 h-3 text-white" />
                      )}
                    </motion.div>
                  </motion.button>
                ))}
              </div>
            </motion.section>

            {/* Equalizer Presets */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...iosSpring, delay: 0.15 }}
            >
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">EQUALIZER</h3>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {equalizerPresets.map((preset) => {
                  const Icon = preset.icon;
                  const isSelected = selectedPreset === preset.id;
                  return (
                    <motion.button
                      key={preset.id}
                      className="relative rounded-xl p-3 text-center overflow-hidden"
                      style={{
                        background: isSelected 
                          ? 'linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(8, 145, 178, 0.1))'
                          : 'rgba(28, 28, 30, 0.8)',
                        border: isSelected 
                          ? '1px solid rgba(6, 182, 212, 0.4)'
                          : '1px solid rgba(255, 255, 255, 0.06)',
                      }}
                      onClick={() => setSelectedPreset(preset.id)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Icon className={`w-5 h-5 mx-auto mb-1.5 ${isSelected ? 'text-cyan-400' : 'text-muted-foreground'}`} />
                      <span className={`text-xs font-medium ${isSelected ? 'text-cyan-400' : ''}`}>
                        {preset.name}
                      </span>
                    </motion.button>
                  );
                })}
              </div>

              {/* Custom EQ Bands */}
              <div 
                className="rounded-2xl p-4"
                style={{ background: 'rgba(28, 28, 30, 0.8)', border: '1px solid rgba(255, 255, 255, 0.06)' }}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs text-muted-foreground">Custom Equalizer</span>
                  <motion.button
                    className="text-xs text-cyan-400"
                    onClick={() => {
                      setCustomBands([0, 0, 0, 0, 0]);
                      setSelectedPreset('flat');
                    }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Reset
                  </motion.button>
                </div>
                <div className="flex justify-between gap-2">
                  {customBands.map((band, index) => (
                    <div key={index} className="flex flex-col items-center gap-2 flex-1">
                      <div className="h-32 flex items-center justify-center">
                        <Slider
                          orientation="vertical"
                          value={[band]}
                          min={-12}
                          max={12}
                          step={1}
                          onValueChange={(value) => handleBandChange(index, value)}
                          className="h-full"
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground">{bandLabels[index]}</span>
                      <span className="text-[10px] text-cyan-400 font-mono">
                        {band > 0 ? '+' : ''}{band}dB
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.section>

            {/* Spatial Audio & Other Settings */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...iosSpring, delay: 0.2 }}
            >
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">AUDIO ENHANCEMENTS</h3>
              <div 
                className="rounded-2xl overflow-hidden"
                style={{ background: 'rgba(28, 28, 30, 0.8)', border: '1px solid rgba(255, 255, 255, 0.06)' }}
              >
                {/* Spatial Audio */}
                <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/[0.06]">
                  <div className="flex items-center gap-3">
                    <motion.div 
                      className="w-9 h-9 rounded-lg flex items-center justify-center"
                      style={{ 
                        background: spatialAudio 
                          ? 'linear-gradient(135deg, #8b5cf6, #6366f1)' 
                          : 'rgba(118, 118, 128, 0.12)' 
                      }}
                      animate={{ scale: spatialAudio ? 1 : 0.95 }}
                      transition={iosBounce}
                    >
                      <Waves className={`w-4 h-4 ${spatialAudio ? 'text-white' : 'text-muted-foreground'}`} />
                    </motion.div>
                    <div>
                      <span className="font-medium block">Spatial Audio</span>
                      <span className="text-xs text-muted-foreground">Immersive 3D sound experience</span>
                    </div>
                  </div>
                  <Switch 
                    checked={spatialAudio} 
                    onCheckedChange={setSpatialAudio}
                  />
                </div>

                {/* Dynamic Normalization */}
                <div className="flex items-center justify-between px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <motion.div 
                      className="w-9 h-9 rounded-lg flex items-center justify-center"
                      style={{ 
                        background: dynamicNormalization 
                          ? 'linear-gradient(135deg, #10b981, #059669)' 
                          : 'rgba(118, 118, 128, 0.12)' 
                      }}
                      animate={{ scale: dynamicNormalization ? 1 : 0.95 }}
                      transition={iosBounce}
                    >
                      <Volume2 className={`w-4 h-4 ${dynamicNormalization ? 'text-white' : 'text-muted-foreground'}`} />
                    </motion.div>
                    <div>
                      <span className="font-medium block">Volume Normalization</span>
                      <span className="text-xs text-muted-foreground">Consistent volume across tracks</span>
                    </div>
                  </div>
                  <Switch 
                    checked={dynamicNormalization} 
                    onCheckedChange={setDynamicNormalization}
                  />
                </div>
              </div>
            </motion.section>

            {/* Info Note */}
            <motion.div
              className="flex items-start gap-3 px-4 py-3 rounded-xl"
              style={{ background: 'rgba(6, 182, 212, 0.1)', border: '1px solid rgba(6, 182, 212, 0.2)' }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...iosSpring, delay: 0.25 }}
            >
              <Sparkles className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
              <p className="text-xs text-cyan-300/80">
                Audio enhancements require compatible headphones for the best experience. 
                Lossless playback uses significantly more data.
              </p>
            </motion.div>
          </div>
        </motion.div>
      </SheetContent>
    </Sheet>
  );
});

export default AdvancedAudioSettings;
