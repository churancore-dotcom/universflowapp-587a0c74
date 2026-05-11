import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Sparkles, Search as SearchIcon, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { triggerHaptic } from '@/hooks/useHaptics';
import { toast } from 'sonner';
import { CURATED_ARTISTS } from '@/lib/curatedArtists';

interface ArtistOption {
  name: string;
  image?: string;
  source: 'catalog' | 'lastfm';
  category: string;
}

interface Props {
  onComplete: () => void;
}

// Build the full fallback list from the curated catalog (~60 artists across genres)
const FALLBACK_ARTISTS: ArtistOption[] = CURATED_ARTISTS.map(a => ({
  name: a.name,
  source: 'lastfm',
  category: a.category,
}));

const MIN = 3;
const MAX = 10;

// Fetch a real artist photo from Deezer (CORS-friendly, no key required)
async function fetchDeezerImage(name: string): Promise<string | null> {
  try {
    const r = await fetch(
      `https://api.deezer.com/search/artist?q=${encodeURIComponent(name)}&limit=1`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!r.ok) return null;
    const j = await r.json();
    const a = j?.data?.[0];
    return a?.picture_xl || a?.picture_big || a?.picture_medium || null;
  } catch {
    return null;
  }
}

const ArtistPicker = ({ onComplete }: Props) => {
  const { user } = useAuth();
  const [artists, setArtists] = useState<ArtistOption[]>(FALLBACK_ARTISTS);
  const [picks, setPicks] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState<string>('All');
  const [saving, setSaving] = useState(false);

  // Merge catalog artists in (with their photos) + hydrate Deezer images for the rest
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // 1) Pull catalog artists (these have real photo_url)
      const { data } = await supabase
        .from('artists')
        .select('name, photo_url, genre')
        .limit(60);
      if (!cancelled && data?.length) {
        const catalogArtists: ArtistOption[] = data.map((a: any) => ({
          name: a.name,
          image: a.photo_url || undefined,
          source: 'catalog',
          category: a.genre || 'On Universflow',
        }));
        setArtists(prev => {
          const seen = new Set(prev.map(p => p.name.toLowerCase()));
          return [...catalogArtists.filter(a => !seen.has(a.name.toLowerCase())), ...prev];
        });
      }

      // 2) Hydrate missing photos from Deezer in small concurrent batches
      const list = FALLBACK_ARTISTS;
      const BATCH = 6;
      for (let i = 0; i < list.length; i += BATCH) {
        if (cancelled) return;
        const batch = list.slice(i, i + BATCH);
        const results = await Promise.all(
          batch.map(async a => ({ name: a.name, img: await fetchDeezerImage(a.name) }))
        );
        if (cancelled) return;
        setArtists(prev =>
          prev.map(a => {
            const hit = results.find(r => r.name === a.name);
            return hit?.img && !a.image ? { ...a, image: hit.img } : a;
          })
        );
      }
    })();
    return () => { cancelled = true; };
  }, []);


  const categories = useMemo(() => {
    const set = new Set<string>(['All']);
    artists.forEach(a => set.add(a.category));
    return Array.from(set);
  }, [artists]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return artists.filter(a => {
      if (activeCat !== 'All' && a.category !== activeCat) return false;
      if (q && !a.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [artists, activeCat, search]);

  const toggle = (name: string) => {
    triggerHaptic('impactLight');
    setPicks(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        if (next.size >= MAX) {
          toast.error(`You can pick up to ${MAX} artists`);
          return prev;
        }
        next.add(name);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (picks.size < MIN) {
      toast.error(`Pick at least ${MIN} artists to continue`);
      return;
    }
    if (!user) {
      onComplete();
      return;
    }
    setSaving(true);
    try {
      const rows = Array.from(picks).map(name => {
        const a = artists.find(x => x.name === name);
        return {
          user_id: user.id,
          artist_name: name,
          artist_image: a?.image || null,
          artist_source: a?.source || 'lastfm',
        };
      });
      const { error } = await supabase
        .from('user_artist_preferences')
        .upsert(rows, { onConflict: 'user_id,artist_name' });
      if (error) throw error;
      localStorage.setItem(`uf_artists_picked_${user.id}`, '1');
      triggerHaptic('success');
      toast.success('Your feed is being personalized 🎶');
      onComplete();
    } catch (e: any) {
      toast.error(e.message || 'Could not save your picks');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-[200] bg-background overflow-y-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Hero */}
      <div className="px-5 pt-12 pb-4 text-center">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 280, damping: 18 }}
          className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3"
          style={{ background: 'linear-gradient(135deg, #FF2D55, #FF6482)' }}
        >
          <Sparkles className="w-7 h-7 text-white" />
        </motion.div>
        <h1 className="text-2xl font-extrabold tracking-tight">Pick your vibe</h1>
        <p className="text-xs text-muted-foreground mt-1.5 px-4">
          Choose <span className="text-primary font-semibold">{MIN}–{MAX}</span> artists you love.<br />
          We'll fill your feed with them — and a few new sounds you'll thank us for.
        </p>
      </div>

      {/* Search */}
      <div className="px-5 pb-3">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search any artist…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-11 pl-9 pr-4 rounded-xl bg-card/70 border border-border/50 text-sm focus:outline-none focus:border-primary/60"
          />
        </div>
      </div>

      {/* Categories */}
      <div className="flex gap-2 px-5 overflow-x-auto hide-scrollbar pb-3">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => { triggerHaptic('impactLight'); setActiveCat(cat); }}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
              activeCat === cat ? 'bg-primary text-primary-foreground' : 'bg-card/70 text-muted-foreground border border-border/50'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="px-5 pb-32 grid grid-cols-3 gap-3">
        <AnimatePresence>
          {visible.map((a) => {
            const isPicked = picks.has(a.name);
            return (
              <motion.button
                key={a.name}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => toggle(a.name)}
                className="relative aspect-square rounded-2xl overflow-hidden bg-card/70 border border-border/40"
              >
                {a.image ? (
                  <img src={a.image} alt={a.name} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center" style={{ background: `linear-gradient(135deg, hsl(${a.name.length * 23 % 360} 70% 35%), hsl(${a.name.length * 47 % 360} 70% 25%))` }}>
                    <span className="text-2xl font-extrabold text-white/90">{a.name[0]}</span>
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 px-2 py-1.5 bg-gradient-to-t from-black/85 to-transparent">
                  <p className="text-[11px] font-semibold text-white truncate">{a.name}</p>
                </div>
                <AnimatePresence>
                  {isPicked && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.5 }}
                      className="absolute inset-0 flex items-center justify-center"
                      style={{ background: 'rgba(255, 45, 85, 0.55)' }}
                    >
                      <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
                        <Check className="w-5 h-5 text-primary" strokeWidth={3} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Sticky CTA */}
      <div className="fixed inset-x-0 bottom-0 px-4 pb-6 pt-3" style={{ background: 'linear-gradient(to top, hsl(var(--background)) 60%, transparent)' }}>
        <button
          onClick={handleSave}
          disabled={saving || picks.size < MIN}
          className="w-full h-12 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition-opacity disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #FF2D55, #FF6482)', color: '#fff' }}
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              {picks.size < MIN ? `Pick ${MIN - picks.size} more` : `Continue with ${picks.size}`}
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
};

export default ArtistPicker;
