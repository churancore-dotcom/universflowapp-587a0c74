import { useState, useEffect } from 'react';
import { ChevronLeft, Trash2, Info, Headphones, Bell, Palette, ChevronRight, Heart, Crown, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '@/components/BottomNav';
import MiniPlayer from '@/components/MiniPlayer';
import FullscreenPlayer from '@/components/FullscreenPlayer';
import PageTransition from '@/components/PageTransition';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { usePremium } from '@/hooks/usePremium';
import { usePlayer } from '@/contexts/PlayerContext';
import { toast } from 'sonner';

type ThemeMode = 'default' | 'light' | 'black';

const applyTheme = (theme: ThemeMode) => {
  const root = document.documentElement;
  if (theme === 'light') {
    root.style.setProperty('--background', '0 0% 98%');
    root.style.setProperty('--foreground', '0 0% 5%');
    root.style.setProperty('--card', '0 0% 95%');
    root.style.setProperty('--card-foreground', '0 0% 5%');
    root.style.setProperty('--muted', '0 0% 90%');
    root.style.setProperty('--muted-foreground', '0 0% 40%');
    root.style.setProperty('--popover', '0 0% 96%');
    root.style.setProperty('--popover-foreground', '0 0% 5%');
    root.style.setProperty('--secondary', '0 0% 92%');
    root.style.setProperty('--secondary-foreground', '0 0% 10%');
    root.style.setProperty('--border', '0 0% 85%');
    root.style.setProperty('--input', '0 0% 90%');
    document.body.style.background = '#fafafa';
  } else if (theme === 'black') {
    root.style.setProperty('--background', '0 0% 0%');
    root.style.setProperty('--foreground', '0 0% 98%');
    root.style.setProperty('--card', '0 0% 3%');
    root.style.setProperty('--card-foreground', '0 0% 98%');
    root.style.setProperty('--muted', '0 0% 8%');
    root.style.setProperty('--muted-foreground', '0 0% 55%');
    root.style.setProperty('--popover', '0 0% 4%');
    root.style.setProperty('--popover-foreground', '0 0% 98%');
    root.style.setProperty('--secondary', '0 0% 6%');
    root.style.setProperty('--secondary-foreground', '0 0% 98%');
    root.style.setProperty('--border', '0 0% 10%');
    root.style.setProperty('--input', '0 0% 6%');
    document.body.style.background = '#000';
  } else {
    // Default dark
    root.style.setProperty('--background', '0 0% 0%');
    root.style.setProperty('--foreground', '0 0% 98%');
    root.style.setProperty('--card', '0 0% 7%');
    root.style.setProperty('--card-foreground', '0 0% 98%');
    root.style.setProperty('--muted', '0 0% 15%');
    root.style.setProperty('--muted-foreground', '0 0% 55%');
    root.style.setProperty('--popover', '0 0% 10%');
    root.style.setProperty('--popover-foreground', '0 0% 98%');
    root.style.setProperty('--secondary', '0 0% 12%');
    root.style.setProperty('--secondary-foreground', '0 0% 98%');
    root.style.setProperty('--border', '0 0% 15%');
    root.style.setProperty('--input', '0 0% 12%');
    document.body.style.background = '#000';
  }
  localStorage.setItem('uf_theme', theme);
};

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

  // Calculate cache size on mount
  useEffect(() => {
    const calcSize = async () => {
      try {
        if ('caches' in window) {
          const keys = await caches.keys();
          let total = 0;
          for (const key of keys) {
            const cache = await caches.open(key);
            const reqs = await cache.keys();
            total += reqs.length * 50000; // estimate
          }
          // Also check IndexedDB
          if ('indexedDB' in window) {
            const estimate = await navigator.storage?.estimate();
            if (estimate?.usage) total = estimate.usage;
          }
          if (total > 1024 * 1024) setCacheSize(`${(total / (1024 * 1024)).toFixed(1)} MB`);
          else if (total > 1024) setCacheSize(`${(total / 1024).toFixed(0)} KB`);
          else setCacheSize('0 MB');
        }
      } catch { setCacheSize('0 MB'); }
    };
    calcSize();
  }, []);

  // Apply theme on mount
  useEffect(() => {
    applyTheme(theme);
  }, []);

  const handleGapless = (val: boolean) => {
    setGaplessPlayback(val);
    localStorage.setItem('uf_gapless', String(val));
  };

  const handleAutoplay = (val: boolean) => {
    setAutoplay(val);
    localStorage.setItem('uf_autoplay', String(val));
  };

  const handleNotifications = (val: boolean) => {
    setNotifications(val);
    localStorage.setItem('uf_notifications', String(val));
    if (val && 'Notification' in window) {
      Notification.requestPermission();
    }
  };

  const handleHaptics = (val: boolean) => {
    setHaptics(val);
    localStorage.setItem('uf_haptics', String(val));
  };

  const handleTheme = (t: ThemeMode) => {
    setTheme(t);
    applyTheme(t);
    toast.success(`${t === 'default' ? 'Dark' : t === 'light' ? 'White' : 'Black'} theme applied`);
  };

  const handleClearCache = async () => {
    try {
      // Clear browser caches
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
      // Clear IndexedDB
      if ('indexedDB' in window) {
        const dbs = await indexedDB.databases?.() || [];
        for (const db of dbs) {
          if (db.name) indexedDB.deleteDatabase(db.name);
        }
      }
      // Clear localStorage audio cache entries
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('audio_cache_') || key.startsWith('img_cache_'))) {
          localStorage.removeItem(key);
        }
      }
      setCacheSize('0 MB');
      toast.success('Cache cleared successfully');
    } catch {
      toast.error('Failed to clear cache');
    }
  };

  const themes: { id: ThemeMode; label: string; color: string }[] = [
    { id: 'light', label: 'White', color: '#fafafa' },
    { id: 'default', label: 'Dark', color: '#1c1c1e' },
    { id: 'black', label: 'Black', color: '#000000' },
  ];

  return (
    <PageTransition>
      <div className="h-[100dvh] bg-background flex flex-col overflow-hidden">
        <header
          className="flex-shrink-0 z-30 px-2 pt-3 pb-2 flex items-center safe-area-pt"
          style={{
            background: theme === 'light' ? 'rgba(250, 250, 250, 0.85)' : 'rgba(0, 0, 0, 0.85)',
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
              <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'rgba(255, 149, 0, 0.9)' }}>
                <Headphones className="w-3 h-3 text-white" />
              </div>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase">Playback</h2>
            </div>
            <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(28, 28, 30, 0.8)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <div className="px-4 py-3 border-b border-white/[0.06]">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">Crossfade</span>
                    <Switch checked={cfEnabled} onCheckedChange={toggleCrossfade} className="data-[state=checked]:bg-primary scale-75" />
                  </div>
                  <span className="text-sm text-primary font-medium">{cfDuration}s</span>
                </div>
                {cfEnabled && (
                  <Slider value={[cfDuration]} onValueChange={([val]) => setCrossfadeDuration(val)} max={12} step={1} className="[&_[role=slider]]:w-5 [&_[role=slider]]:h-5 [&_[role=slider]]:bg-white" />
                )}
              </div>
              <div className="px-4 py-3 flex items-center justify-between border-b border-white/[0.06]">
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
              <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'rgba(175, 82, 222, 0.9)' }}>
                <Palette className="w-3 h-3 text-white" />
              </div>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase">Appearance</h2>
            </div>
            <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(28, 28, 30, 0.8)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <div className="px-4 py-3">
                <span className="text-sm mb-3 block">Theme</span>
                <div className="flex gap-3">
                  {themes.map(t => (
                    <button
                      key={t.id}
                      onClick={() => handleTheme(t.id)}
                      className="flex flex-col items-center gap-1.5 flex-1"
                    >
                      <div
                        className="w-12 h-12 rounded-xl relative flex items-center justify-center transition-all"
                        style={{
                          background: t.color,
                          border: theme === t.id ? '2px solid hsl(var(--primary))' : '2px solid rgba(255,255,255,0.1)',
                          boxShadow: theme === t.id ? '0 0 12px hsl(var(--primary) / 0.4)' : 'none',
                        }}
                      >
                        {theme === t.id && <Check className="w-4 h-4" style={{ color: t.id === 'light' ? '#000' : '#fff' }} />}
                      </div>
                      <span className="text-[11px] text-muted-foreground">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>
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
              <button onClick={handleClearCache} className="w-full px-4 py-3 flex items-center justify-between text-destructive active:bg-destructive/10">
                <span className="text-sm font-medium">Clear Cache</span>
                <span className="text-sm text-muted-foreground">{cacheSize}</span>
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
                <span className="text-sm text-muted-foreground">2026.04.02</span>
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
