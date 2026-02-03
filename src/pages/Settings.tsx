import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Trash2, Info, Headphones, Bell, Palette, ChevronRight, Heart, Crown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '@/components/BottomNav';
import MiniPlayer from '@/components/MiniPlayer';
import FullscreenPlayer from '@/components/FullscreenPlayer';
import PageTransition from '@/components/PageTransition';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { usePremium } from '@/hooks/usePremium';

const Settings = () => {
  const navigate = useNavigate();
  const { isPremium } = usePremium();
  const [crossfade, setCrossfade] = useState(3);
  const [gaplessPlayback, setGaplessPlayback] = useState(true);
  const [autoplay, setAutoplay] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [haptics, setHaptics] = useState(true);

  return (
    <PageTransition>
      <div className="h-[100dvh] bg-black flex flex-col overflow-hidden">
        {/* Header */}
        <header
          className="flex-shrink-0 z-30 px-2 pt-3 pb-2 flex items-center safe-area-pt"
          style={{
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(40px)',
            WebkitBackdropFilter: 'blur(40px)',
          }}
        >
          <button onClick={() => navigate(-1)} className="flex items-center gap-0.5 px-2 py-2 -ml-1 text-primary">
            <ChevronLeft className="w-5 h-5" />
            <span className="text-sm">Back</span>
          </button>
          <h1 className="text-sm font-semibold absolute left-1/2 -translate-x-1/2">Settings</h1>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto px-4 pt-3 pb-32 space-y-4" style={{ WebkitOverflowScrolling: 'touch' }}>
          {/* Playback */}
          <section>
            <div className="flex items-center gap-2 mb-2 px-1">
              <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'rgba(255, 149, 0, 0.9)' }}>
                <Headphones className="w-3 h-3 text-white" />
              </div>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase">Playback</h2>
            </div>
            <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(28, 28, 30, 0.8)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <div className="px-4 py-3 border-b border-white/[0.06]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm">Crossfade</span>
                  <span className="text-sm text-primary font-medium">{crossfade}s</span>
                </div>
                <Slider value={[crossfade]} onValueChange={([val]) => setCrossfade(val)} max={12} step={1} className="[&_[role=slider]]:w-5 [&_[role=slider]]:h-5 [&_[role=slider]]:bg-white" />
              </div>
              <div className="px-4 py-3 flex items-center justify-between border-b border-white/[0.06]">
                <span className="text-sm">Gapless Playback</span>
                <Switch checked={gaplessPlayback} onCheckedChange={setGaplessPlayback} className="data-[state=checked]:bg-primary scale-90" />
              </div>
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="text-sm">Autoplay</span>
                <Switch checked={autoplay} onCheckedChange={setAutoplay} className="data-[state=checked]:bg-primary scale-90" />
              </div>
            </div>
          </section>

          {/* Support */}
          <section>
            <div className="flex items-center gap-2 mb-2 px-1">
              <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'rgba(255, 45, 85, 0.9)' }}>
                <Heart className="w-3 h-3 text-white" />
              </div>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase">Support</h2>
            </div>
            <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(28, 28, 30, 0.8)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <button onClick={() => navigate('/support')} className="w-full px-4 py-3 flex items-center justify-between border-b border-white/[0.06] active:bg-white/5">
                <div className="flex items-center gap-2">
                  {isPremium && <span className="px-1.5 py-0.5 rounded-full bg-primary/20 text-[10px] font-medium text-primary">Premium</span>}
                  <span className="text-sm">{isPremium ? 'Manage Subscription' : 'Upgrade to Premium'}</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Crown className="w-3.5 h-3.5 text-primary" />
                  <ChevronRight className="w-4 h-4" />
                </div>
              </button>
              <button onClick={() => navigate('/support')} className="w-full px-4 py-3 flex items-center justify-between active:bg-white/5">
                <span className="text-sm">Buy Me a Coffee</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </section>

          {/* Notifications */}
          <section>
            <div className="flex items-center gap-2 mb-2 px-1">
              <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'rgba(255, 59, 48, 0.9)' }}>
                <Bell className="w-3 h-3 text-white" />
              </div>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase">Notifications</h2>
            </div>
            <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(28, 28, 30, 0.8)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <div className="px-4 py-3 flex items-center justify-between border-b border-white/[0.06]">
                <span className="text-sm">Push Notifications</span>
                <Switch checked={notifications} onCheckedChange={setNotifications} className="data-[state=checked]:bg-primary scale-90" />
              </div>
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="text-sm">Haptic Feedback</span>
                <Switch checked={haptics} onCheckedChange={setHaptics} className="data-[state=checked]:bg-primary scale-90" />
              </div>
            </div>
          </section>

          {/* Appearance */}
          <section>
            <div className="flex items-center gap-2 mb-2 px-1">
              <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'rgba(175, 82, 222, 0.9)' }}>
                <Palette className="w-3 h-3 text-white" />
              </div>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase">Appearance</h2>
            </div>
            <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(28, 28, 30, 0.8)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <button className="w-full px-4 py-3 flex items-center justify-between active:bg-white/5">
                <span className="text-sm">Theme</span>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="text-sm">Dark</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </button>
            </div>
          </section>

          {/* Storage */}
          <section>
            <div className="flex items-center gap-2 mb-2 px-1">
              <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'rgba(255, 69, 58, 0.9)' }}>
                <Trash2 className="w-3 h-3 text-white" />
              </div>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase">Storage</h2>
            </div>
            <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(28, 28, 30, 0.8)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <button className="w-full px-4 py-3 flex items-center justify-between text-destructive active:bg-destructive/10">
                <span className="text-sm font-medium">Clear Cache</span>
                <span className="text-sm text-muted-foreground">0 MB</span>
              </button>
            </div>
          </section>

          {/* About */}
          <section>
            <div className="flex items-center gap-2 mb-2 px-1">
              <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'rgba(90, 200, 250, 0.9)' }}>
                <Info className="w-3 h-3 text-white" />
              </div>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase">About</h2>
            </div>
            <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(28, 28, 30, 0.8)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <div className="px-4 py-3 flex items-center justify-between border-b border-white/[0.06]">
                <span className="text-sm">Version</span>
                <span className="text-sm text-muted-foreground">1.0.0</span>
              </div>
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="text-sm">Build</span>
                <span className="text-sm text-muted-foreground">2026.02.03</span>
              </div>
            </div>
          </section>
        </main>

        <BottomNav />
        <MiniPlayer />
        <FullscreenPlayer />
      </div>
    </PageTransition>
  );
};

export default Settings;