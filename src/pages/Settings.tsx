import { useState, useEffect } from 'react';
import { ChevronLeft, Trash2, Info, Headphones, Bell, Palette, ChevronRight, Heart, Crown, Check, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '@/components/BottomNav';
import PageTransition from '@/components/PageTransition';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { usePremium } from '@/hooks/usePremium';
import { usePlayer } from '@/contexts/PlayerContext';
import { toast } from 'sonner';
import SupportChatModal from '@/components/SupportChatModal';

import { applyTheme, type ThemeMode } from '@/lib/themeBoot';

const Settings = () => {
  const navigate = useNavigate();
  const { isPremium } = usePremium();
  const { crossfade: cfEnabled, crossfadeDuration: cfDuration, toggleCrossfade, setCrossfadeDuration } = usePlayer();

  const [gaplessPlayback, setGaplessPlayback] = useState(() => localStorage.getItem('uf_gapless') !== 'false');
  const [autoplay, setAutoplay] = useState(() => localStorage.getItem('uf_autoplay') !== 'false');
  const [notifications, setNotifications] = useState(() => localStorage.getItem('uf_notifications') !== 'false');
  const [haptics, setHaptics] = useState(() => localStorage.getItem('uf_haptics') !== 'false');
  const [theme, setTheme] = useState<ThemeMode>(() => (localStorage.getItem('uf_theme') as ThemeMode) || 'default');
  const [cacheSize, setCacheSize] = useState('0 MB');
  const [showSupport, setShowSupport] = useState(false);

  useEffect(() => {
    const calcSize = async () => {
      try {
        if ('caches' in window) {
          const keys = await caches.keys();
          let total = 0;
          for (const key of keys) {
            const cache = await caches.open(key);
            const reqs = await cache.keys();
            total += reqs.length * 50000;
          }
          if ('indexedDB' in window) {
            const estimate = await navigator.storage?.estimate();
            if (estimate?.usage) total = estimate.usage;
          }
          if (total > 1024 * 1024 * 1024) setCacheSize(`${(total / (1024 * 1024 * 1024)).toFixed(2)} GB`);
          else if (total > 1024 * 1024) setCacheSize(`${(total / (1024 * 1024)).toFixed(1)} MB`);
          else if (total > 1024) setCacheSize(`${(total / 1024).toFixed(0)} KB`);
          else setCacheSize('0 MB');
        }
      } catch { setCacheSize('0 MB'); }
    };
    calcSize();
  }, []);

  useEffect(() => { applyTheme(theme); }, []);

  const handleGapless = (val: boolean) => { setGaplessPlayback(val); localStorage.setItem('uf_gapless', String(val)); };
  const handleAutoplay = (val: boolean) => { setAutoplay(val); localStorage.setItem('uf_autoplay', String(val)); };
  const handleNotifications = (val: boolean) => {
    setNotifications(val);
    localStorage.setItem('uf_notifications', String(val));
    if (val && 'Notification' in window) Notification.requestPermission();
  };
  const handleHaptics = (val: boolean) => { setHaptics(val); localStorage.setItem('uf_haptics', String(val)); };

  const handleTheme = (t: ThemeMode) => {
    setTheme(t);
    applyTheme(t);
    toast.success(`${themes.find(x => x.id === t)?.label} theme applied`);
  };

  const handleClearCache = async () => {
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
      if ('indexedDB' in window) {
        const dbs = await indexedDB.databases?.() || [];
        for (const db of dbs) { if (db.name) indexedDB.deleteDatabase(db.name); }
      }
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('audio_cache_') || key.startsWith('img_cache_'))) {
          localStorage.removeItem(key);
        }
      }
      setCacheSize('0 MB');
      toast.success('Cache cleared successfully');
    } catch { toast.error('Failed to clear cache'); }
  };

  const themes: { id: ThemeMode; label: string; preview: string; ring?: string }[] = [
    { id: 'light', label: 'Pearl', preview: 'linear-gradient(135deg, #ffffff 0%, #f4f1ec 100%)', ring: '#ff2d55' },
    { id: 'default', label: 'Dark', preview: 'linear-gradient(135deg, #1c1c1e 0%, #0a0a0a 100%)', ring: '#ff2d55' },
    { id: 'black', label: 'Onyx', preview: 'linear-gradient(135deg, #000000 0%, #0a0a0a 100%)', ring: '#ff2d55' },
    { id: 'sunset', label: 'Sunset', preview: 'linear-gradient(135deg, #ff6a00 0%, #ee0979 100%)', ring: '#ff7a3a' },
    { id: 'ocean', label: 'Ocean', preview: 'linear-gradient(135deg, #0093E9 0%, #00d4ff 100%)', ring: '#00aaff' },
    { id: 'midnight-gold', label: 'Gold', preview: 'linear-gradient(135deg, #1a1a2e 0%, #d4af37 100%)', ring: '#d4af37' },
  ];

  const isLight = theme === 'light';

  return (
    <PageTransition>
      <div className="h-[100dvh] bg-background flex flex-col overflow-hidden">
        <header
          className="flex-shrink-0 z-30 px-2 pt-3 pb-2 flex items-center safe-area-pt"
          style={{
            background: isLight ? 'hsl(var(--background) / 0.85)' : 'hsl(var(--background) / 0.85)',
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

        <main className="flex-1 overflow-y-auto px-4 pt-3 pb-32 space-y-4" style={{ WebkitOverflowScrolling: 'touch' }}>
          {/* Playback */}
          <section>
            <div className="flex items-center gap-2 mb-2 px-1">
              <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'hsl(28 100% 50% / 0.9)' }}>
                <Headphones className="w-3 h-3 text-white" />
              </div>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase">Playback</h2>
            </div>
            <div className="rounded-xl overflow-hidden bg-card border border-border/50">
              <div className="px-4 py-3 border-b border-border/50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">Crossfade</span>
                    {!isPremium && <Crown className="w-3 h-3 text-primary" fill="currentColor" />}
                    <Switch
                      checked={isPremium && cfEnabled}
                      onCheckedChange={(v) => {
                        if (!isPremium) { navigate('/premium'); return; }
                        toggleCrossfade();
                      }}
                      className="data-[state=checked]:bg-primary scale-75"
                    />
                  </div>
                  <span className="text-sm text-primary font-medium">{isPremium && cfEnabled ? `${cfDuration}s` : 'Off'}</span>
                </div>
                {isPremium && cfEnabled && (
                  <Slider value={[cfDuration]} onValueChange={([val]) => setCrossfadeDuration(val)} max={12} step={1} className="[&_[role=slider]]:w-5 [&_[role=slider]]:h-5" />
                )}
              </div>
              <div className="px-4 py-3 flex items-center justify-between border-b border-border/50">
                <span className="text-sm">Gapless Playback</span>
                <Switch checked={gaplessPlayback} onCheckedChange={handleGapless} className="data-[state=checked]:bg-primary scale-90" />
              </div>
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="text-sm">Autoplay</span>
                <Switch checked={autoplay} onCheckedChange={handleAutoplay} className="data-[state=checked]:bg-primary scale-90" />
              </div>
            </div>
          </section>

          {/* Support */}
          <section>
            <div className="flex items-center gap-2 mb-2 px-1">
              <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'hsl(350 100% 60% / 0.9)' }}>
                <Heart className="w-3 h-3 text-white" />
              </div>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase">Support</h2>
            </div>
            <div className="rounded-xl overflow-hidden bg-card border border-border/50">
              <button onClick={() => navigate(isPremium ? '/subscription' : '/premium')} className="w-full px-4 py-3 flex items-center justify-between border-b border-border/50 active:bg-muted/30">
                <div className="flex items-center gap-2">
                  {isPremium && <span className="px-1.5 py-0.5 rounded-full bg-primary/20 text-[10px] font-medium text-primary">Premium</span>}
                  <span className="text-sm">{isPremium ? 'Manage Subscription' : 'Upgrade to Premium'}</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Crown className="w-3.5 h-3.5 text-primary" />
                  <ChevronRight className="w-4 h-4" />
                </div>
              </button>
              <button onClick={() => setShowSupport(true)} className="w-full px-4 py-3 flex items-center justify-between active:bg-muted/30">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-primary" />
                  <span className="text-sm">Contact Support</span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </section>

          {/* Notifications */}
          <section>
            <div className="flex items-center gap-2 mb-2 px-1">
              <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'hsl(0 85% 58% / 0.9)' }}>
                <Bell className="w-3 h-3 text-white" />
              </div>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase">Notifications</h2>
            </div>
            <div className="rounded-xl overflow-hidden bg-card border border-border/50">
              <div className="px-4 py-3 flex items-center justify-between border-b border-border/50">
                <span className="text-sm">Push Notifications</span>
                <Switch checked={notifications} onCheckedChange={handleNotifications} className="data-[state=checked]:bg-primary scale-90" />
              </div>
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="text-sm">Haptic Feedback</span>
                <Switch checked={haptics} onCheckedChange={handleHaptics} className="data-[state=checked]:bg-primary scale-90" />
              </div>
            </div>
          </section>

          {/* Appearance - Theme */}
          <section>
            <div className="flex items-center gap-2 mb-2 px-1">
              <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'hsl(280 80% 60% / 0.9)' }}>
                <Palette className="w-3 h-3 text-white" />
              </div>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase">Appearance</h2>
            </div>
            <div className="rounded-xl overflow-hidden bg-card border border-border/50">
              <div className="px-4 py-3">
                <span className="text-sm mb-3 block">Theme</span>
                <div className="grid grid-cols-3 gap-3">
                  {themes.map(t => (
                    <button
                      key={t.id}
                      onClick={() => handleTheme(t.id)}
                      className="flex flex-col items-center gap-1.5"
                    >
                      <div
                        className="w-full aspect-square rounded-2xl relative flex items-center justify-center transition-all overflow-hidden"
                        style={{
                          background: t.preview,
                          border: theme === t.id ? `2.5px solid hsl(var(--primary))` : '2px solid hsl(var(--border))',
                          boxShadow: theme === t.id ? '0 0 16px hsl(var(--primary) / 0.45)' : 'none',
                        }}
                      >
                        {theme === t.id && (
                          <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shadow-lg">
                            <Check className="w-4 h-4 text-primary-foreground" />
                          </div>
                        )}
                      </div>
                      <span className="text-[11px] font-medium">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Storage */}
          <section>
            <div className="flex items-center gap-2 mb-2 px-1">
              <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'hsl(0 90% 58% / 0.9)' }}>
                <Trash2 className="w-3 h-3 text-white" />
              </div>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase">Storage</h2>
            </div>
            <div className="rounded-xl overflow-hidden bg-card border border-border/50">
              <button onClick={handleClearCache} className="w-full px-4 py-3 flex items-center justify-between text-destructive active:bg-destructive/10">
                <span className="text-sm font-medium">Clear Cache</span>
                <span className="text-sm text-muted-foreground">{cacheSize}</span>
              </button>
            </div>
          </section>

          {/* About */}
          <section>
            <div className="flex items-center gap-2 mb-2 px-1">
              <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'hsl(195 100% 55% / 0.9)' }}>
                <Info className="w-3 h-3 text-white" />
              </div>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase">About</h2>
            </div>
            <div className="rounded-xl overflow-hidden bg-card border border-border/50">
              <div className="px-4 py-3 flex items-center justify-between border-b border-border/50">
                <span className="text-sm">Version</span>
                <span className="text-sm text-muted-foreground">1.0.0</span>
              </div>
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="text-sm">Build</span>
                <span className="text-sm text-muted-foreground">2026.04.26</span>
              </div>
            </div>
          </section>
        </main>

        <BottomNav />
        <SupportChatModal isOpen={showSupport} onClose={() => setShowSupport(false)} />
      </div>
    </PageTransition>
  );
};

export default Settings;
