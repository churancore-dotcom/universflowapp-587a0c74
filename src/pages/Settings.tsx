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

type ThemeMode = 'default' | 'light' | 'black' | 'sunset' | 'ocean' | 'midnight-gold';

interface ThemeTokens {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  muted: string;
  mutedForeground: string;
  popover: string;
  popoverForeground: string;
  secondary: string;
  secondaryForeground: string;
  border: string;
  input: string;
  primary?: string;
  accent?: string;
  ring?: string;
  bodyBg: string;
}

const THEMES: Record<ThemeMode, ThemeTokens> = {
  default: {
    background: '0 0% 0%', foreground: '0 0% 98%',
    card: '0 0% 7%', cardForeground: '0 0% 98%',
    muted: '0 0% 15%', mutedForeground: '0 0% 55%',
    popover: '0 0% 10%', popoverForeground: '0 0% 98%',
    secondary: '0 0% 12%', secondaryForeground: '0 0% 98%',
    border: '0 0% 15%', input: '0 0% 12%',
    primary: '350 100% 60%', accent: '330 100% 65%', ring: '350 100% 60%',
    bodyBg: '#000',
  },
  light: {
    // Premium clean white with soft warm undertone
    background: '30 25% 98%', foreground: '230 18% 12%',
    card: '0 0% 100%', cardForeground: '230 18% 12%',
    muted: '230 14% 94%', mutedForeground: '230 8% 42%',
    popover: '0 0% 100%', popoverForeground: '230 18% 12%',
    secondary: '230 14% 96%', secondaryForeground: '230 18% 12%',
    border: '230 14% 88%', input: '230 14% 95%',
    primary: '350 100% 52%', accent: '330 95% 58%', ring: '350 100% 52%',
    bodyBg: '#f9f8f6',
  },
  black: {
    background: '0 0% 0%', foreground: '0 0% 98%',
    card: '0 0% 3%', cardForeground: '0 0% 98%',
    muted: '0 0% 8%', mutedForeground: '0 0% 55%',
    popover: '0 0% 4%', popoverForeground: '0 0% 98%',
    secondary: '0 0% 6%', secondaryForeground: '0 0% 98%',
    border: '0 0% 10%', input: '0 0% 6%',
    primary: '350 100% 60%', accent: '330 100% 65%', ring: '350 100% 60%',
    bodyBg: '#000',
  },
  sunset: {
    // Warm copper / sunset orange
    background: '20 28% 6%', foreground: '30 30% 96%',
    card: '20 30% 10%', cardForeground: '30 30% 96%',
    muted: '20 20% 16%', mutedForeground: '25 18% 65%',
    popover: '20 30% 11%', popoverForeground: '30 30% 96%',
    secondary: '20 26% 14%', secondaryForeground: '30 30% 96%',
    border: '20 22% 18%', input: '20 25% 14%',
    primary: '14 100% 60%', accent: '38 100% 60%', ring: '14 100% 60%',
    bodyBg: '#180e09',
  },
  ocean: {
    // Deep premium ocean blue
    background: '215 40% 6%', foreground: '210 30% 96%',
    card: '215 38% 10%', cardForeground: '210 30% 96%',
    muted: '215 25% 16%', mutedForeground: '210 18% 65%',
    popover: '215 38% 11%', popoverForeground: '210 30% 96%',
    secondary: '215 30% 14%', secondaryForeground: '210 30% 96%',
    border: '215 25% 20%', input: '215 28% 14%',
    primary: '195 100% 55%', accent: '180 90% 55%', ring: '195 100% 55%',
    bodyBg: '#070e18',
  },
  'midnight-gold': {
    // Luxe black with gold accents
    background: '240 12% 4%', foreground: '40 20% 96%',
    card: '240 12% 8%', cardForeground: '40 20% 96%',
    muted: '240 10% 14%', mutedForeground: '40 8% 60%',
    popover: '240 12% 10%', popoverForeground: '40 20% 96%',
    secondary: '240 10% 12%', secondaryForeground: '40 20% 96%',
    border: '240 12% 18%', input: '240 12% 12%',
    primary: '42 95% 58%', accent: '36 90% 60%', ring: '42 95% 58%',
    bodyBg: '#08080d',
  },
};

const applyTheme = (theme: ThemeMode) => {
  const root = document.documentElement;
  const t = THEMES[theme] || THEMES.default;
  root.style.setProperty('--background', t.background);
  root.style.setProperty('--foreground', t.foreground);
  root.style.setProperty('--card', t.card);
  root.style.setProperty('--card-foreground', t.cardForeground);
  root.style.setProperty('--muted', t.muted);
  root.style.setProperty('--muted-foreground', t.mutedForeground);
  root.style.setProperty('--popover', t.popover);
  root.style.setProperty('--popover-foreground', t.popoverForeground);
  root.style.setProperty('--secondary', t.secondary);
  root.style.setProperty('--secondary-foreground', t.secondaryForeground);
  root.style.setProperty('--border', t.border);
  root.style.setProperty('--input', t.input);
  if (t.primary) {
    root.style.setProperty('--primary', t.primary);
    root.style.setProperty('--ring', t.primary);
    root.style.setProperty('--sidebar-primary', t.primary);
    root.style.setProperty('--sidebar-ring', t.primary);
    root.style.setProperty('--glow-primary', t.primary);
    root.style.setProperty('--gradient-start', t.primary);
  }
  if (t.accent) {
    root.style.setProperty('--accent', t.accent);
    root.style.setProperty('--glow-accent', t.accent);
    root.style.setProperty('--gradient-mid', t.accent);
  }
  document.body.style.background = t.bodyBg;
  localStorage.setItem('uf_theme', theme);
};

// Re-export so other modules can apply on boot
export { applyTheme };

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
          if (total > 1024 * 1024) setCacheSize(`${(total / (1024 * 1024)).toFixed(1)} MB`);
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
                    <Switch checked={cfEnabled} onCheckedChange={toggleCrossfade} className="data-[state=checked]:bg-primary scale-75" />
                  </div>
                  <span className="text-sm text-primary font-medium">{cfDuration}s</span>
                </div>
                {cfEnabled && (
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
              <button onClick={() => navigate('/support')} className="w-full px-4 py-3 flex items-center justify-between border-b border-border/50 active:bg-muted/30">
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
