import { useState, useEffect, useCallback, memo, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, User, Music, Loader2, Radio, Heart, Search as SearchIcon, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayer, Song } from '@/contexts/PlayerContext';
import {
  searchIndexedTracks,
  resolveIndexedTrack,
  searchArtistDirectory,
  getTopArtistsByTag,
  enrichArtistImages,
  type IndexedTrack,
} from '@/lib/musicIndexer';
import { followArtist, unfollowArtist, getUserArtistPrefs } from '@/lib/userArtistPrefs';
import { CURATED_ARTISTS, ARTIST_CATEGORIES, type ArtistCategory } from '@/lib/curatedArtists';
import BottomNav from '@/components/BottomNav';
import { toast } from 'sonner';
import { triggerHaptic } from '@/hooks/useHaptics';

interface ArtistEntry {
  name: string;
  image_url?: string;
  listeners?: number;
  category: string;
  source: 'catalog' | 'lastfm';
  catalogId?: string;
}

const ArtistRow = memo(({ artist, isFollowed, onFollow, onPlay, onOpen }: {
  artist: ArtistEntry;
  isFollowed: boolean;
  onFollow: (artist: ArtistEntry) => void;
  onPlay: (artist: ArtistEntry) => void;
  onOpen: (artist: ArtistEntry) => void;
}) => (
  <motion.div
    className="flex items-center gap-3 p-3 rounded-2xl"
    style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)' }}
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
  >
    <button
      onClick={() => { triggerHaptic('selection'); onOpen(artist); }}
      className="flex items-center gap-3 flex-1 min-w-0 text-left active:opacity-70"
    >
      <div className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0 bg-muted">
        {artist.image_url ? (
          <img src={artist.image_url} alt={artist.name} className="w-full h-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20">
            <User className="w-6 h-6 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate text-foreground">{artist.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">
          {artist.category} · <span className="text-primary">{artist.source === 'catalog' ? 'Catalog' : 'Web Stream'}</span>
        </p>
      </div>
    </button>
    <motion.button
      whileTap={{ scale: 0.85 }}
      onClick={() => { triggerHaptic('impactLight'); onFollow(artist); }}
      className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
      style={{
        background: isFollowed ? 'hsl(var(--primary) / 0.18)' : 'rgba(255,255,255,0.06)',
        border: `0.5px solid ${isFollowed ? 'hsl(var(--primary) / 0.4)' : 'rgba(255,255,255,0.10)'}`,
      }}
      aria-label={isFollowed ? 'Unfollow' : 'Follow'}
    >
      <Heart className={`w-4 h-4 ${isFollowed ? 'text-primary fill-primary' : 'text-muted-foreground'}`} />
    </motion.button>
  </motion.div>
));
ArtistRow.displayName = 'ArtistRow';

const AllArtists = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { playSong, currentSong, isPlaying } = usePlayer();
  const [allArtists, setAllArtists] = useState<ArtistEntry[]>([]);
  const [followed, setFollowed] = useState<Set<string>>(new Set());
  const [activeCategory, setActiveCategory] = useState<'All' | ArtistCategory>('All');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchingArtists, setSearchingArtists] = useState(false);
  const [artistSongs, setArtistSongs] = useState<IndexedTrack[]>([]);
  const [selectedArtist, setSelectedArtist] = useState<ArtistEntry | null>(null);
  const [loadingSongs, setLoadingSongs] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const enrichmentTriggered = useRef<Set<string>>(new Set());
  const focusHandledRef = useRef<string | null>(null);

  // Tags used to fetch *real* artist directories from Last.fm with Deezer PFPs.
  // Each category maps to one or more Last.fm tags so we get rich, themed lists.
  const CATEGORY_TAGS: Record<ArtistCategory, string[]> = useMemo(() => ({
    Trending: ['pop', 'hip-hop'],
    Indian: ['indian', 'bollywood'],
    Bollywood: ['bollywood', 'hindi'],
    Punjabi: ['punjabi', 'desi'],
    'Global Pop': ['pop'],
    'Hip-Hop': ['hip-hop', 'rap'],
    Rock: ['rock', 'alternative'],
    'K-Pop': ['k-pop'],
    Latin: ['latin', 'reggaeton'],
    Electronic: ['electronic', 'edm'],
    'R&B': ['rnb', 'soul'],
    Indie: ['indie', 'indie pop'],
  }), []);

  // Initial load: catalog artists + curated list + trending live artists + user follows
  useEffect(() => {
    const load = async () => {
      try {
        const [catalogRes, trendingRes, prefs] = await Promise.all([
          supabase.from('artists').select('id, name, photo_url, genre').limit(200),
          getTopArtistsByTag('pop', 40).catch(() => []),
          user ? getUserArtistPrefs(user.id).catch(() => []) : Promise.resolve([]),
        ]);

        const map = new Map<string, ArtistEntry>();

        // 1) Catalog artists (highest priority — admin-uploaded images)
        for (const a of catalogRes.data || []) {
          map.set(a.name.toLowerCase(), {
            name: a.name,
            image_url: a.photo_url || undefined,
            category: a.genre || 'Catalog',
            source: 'catalog',
            catalogId: a.id,
          });
        }

        // 2) Curated artists (well-known names by category)
        for (const c of CURATED_ARTISTS) {
          const key = c.name.toLowerCase();
          if (!map.has(key)) {
            map.set(key, { name: c.name, category: c.category, source: 'lastfm' });
          }
        }

        // 3) Live trending artists with real PFPs
        for (const t of trendingRes) {
          const key = t.name.toLowerCase();
          const existing = map.get(key);
          if (existing) {
            if (!existing.image_url && t.image_url) existing.image_url = t.image_url;
            if (t.listeners) existing.listeners = t.listeners;
          } else {
            map.set(key, {
              name: t.name,
              image_url: t.image_url,
              listeners: t.listeners,
              category: 'Trending',
              source: 'lastfm',
            });
          }
        }

        const initial = Array.from(map.values());
        setAllArtists(initial);
        setFollowed(new Set(prefs.map(p => p.artist_name.toLowerCase())));

        // Background-fill missing PFPs (Deezer) for the curated list — async, no blocking
        const missing = initial.filter(a => !a.image_url).map(a => a.name);
        if (missing.length) {
          enrichArtistImages(missing).then((images) => {
            if (!Object.keys(images).length) return;
            setAllArtists((prev) => prev.map((a) => images[a.name] ? { ...a, image_url: images[a.name] } : a));
          }).catch(() => {});
        }
      } catch (e) {
        console.error('Failed to load artists:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  // Lazy-load tag-based artists when user picks a category (so list keeps growing)
  useEffect(() => {
    if (activeCategory === 'All' || enrichmentTriggered.current.has(activeCategory)) return;
    enrichmentTriggered.current.add(activeCategory);
    const tags = CATEGORY_TAGS[activeCategory] || [];
    if (!tags.length) return;
    Promise.all(tags.map((tag) => getTopArtistsByTag(tag, 40).catch(() => [])))
      .then((buckets) => {
        const incoming = buckets.flat();
        if (!incoming.length) return;
        setAllArtists((prev) => {
          const map = new Map(prev.map((a) => [a.name.toLowerCase(), a]));
          for (const t of incoming) {
            const key = t.name.toLowerCase();
            const existing = map.get(key);
            if (existing) {
              if (!existing.image_url && t.image_url) existing.image_url = t.image_url;
              if (t.listeners && !existing.listeners) existing.listeners = t.listeners;
            } else {
              map.set(key, {
                name: t.name,
                image_url: t.image_url,
                listeners: t.listeners,
                category: activeCategory,
                source: 'lastfm',
              });
            }
          }
          return Array.from(map.values());
        });
      });
  }, [activeCategory, CATEGORY_TAGS]);

  // Debounce query
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  // When user types a search, also pull live artist matches (so unlimited artists)
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) return;
    setSearchingArtists(true);
    searchArtistDirectory(debouncedQuery, 30)
      .then((found) => {
        if (!found.length) return;
        setAllArtists((prev) => {
          const map = new Map(prev.map((a) => [a.name.toLowerCase(), a]));
          for (const f of found) {
            const key = f.name.toLowerCase();
            const existing = map.get(key);
            if (existing) {
              if (!existing.image_url && f.image_url) existing.image_url = f.image_url;
            } else {
              map.set(key, {
                name: f.name,
                image_url: f.image_url,
                listeners: f.listeners,
                category: 'Search',
                source: 'lastfm',
              });
            }
          }
          return Array.from(map.values());
        });
      })
      .finally(() => setSearchingArtists(false));
  }, [debouncedQuery]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allArtists.filter(a => {
      if (activeCategory === 'Trending' && a.category !== 'Trending') return false;
      if (activeCategory !== 'All' && activeCategory !== 'Trending' && a.category !== activeCategory) return false;
      if (q && !a.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [allArtists, activeCategory, query]);

  const handleFollow = useCallback(async (artist: ArtistEntry) => {
    if (!user) {
      toast.error('Sign in to follow artists');
      return;
    }
    const key = artist.name.toLowerCase();
    const isFollowed = followed.has(key);
    // Optimistic
    setFollowed(prev => {
      const next = new Set(prev);
      if (isFollowed) next.delete(key); else next.add(key);
      return next;
    });
    const ok = isFollowed
      ? await unfollowArtist(user.id, artist.name)
      : await followArtist(user.id, artist.name, { image: artist.image_url || null, source: artist.source });
    if (!ok) {
      // rollback
      setFollowed(prev => {
        const next = new Set(prev);
        if (isFollowed) next.add(key); else next.delete(key);
        return next;
      });
      toast.error('Could not update. Please try again.');
    } else {
      toast.success(isFollowed ? `Unfollowed ${artist.name}` : `Following ${artist.name}`);
    }
  }, [user, followed]);

  const handleOpenArtist = useCallback(async (artist: ArtistEntry) => {
    if (artist.source === 'catalog' && artist.catalogId) {
      navigate(`/artist/${artist.catalogId}`);
      return;
    }
    setSelectedArtist(artist);
    setLoadingSongs(true);
    setArtistSongs([]);
    try {
      const tracks = await searchIndexedTracks(artist.name, 50);
      setArtistSongs(tracks);
    } catch {
      toast.error('Failed to load songs for this artist');
    }
    setLoadingSongs(false);
  }, [navigate]);

  // Auto-open artist from ?focus= query (from Home featured / Library artist click)
  useEffect(() => {
    const focusName = searchParams.get('focus');
    if (!focusName || loading || focusHandledRef.current === focusName) return;
    const match = allArtists.find(a => a.name.toLowerCase() === focusName.toLowerCase());
    if (match) {
      focusHandledRef.current = focusName;
      handleOpenArtist(match);
      const next = new URLSearchParams(searchParams);
      next.delete('focus');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, allArtists, loading, handleOpenArtist, setSearchParams]);

  const handlePlayTrack = useCallback(async (track: IndexedTrack) => {
    setResolvingId(track.id);
    try {
      const resolved = await resolveIndexedTrack(track.artist, track.title);
      if (!resolved.streamUrl) throw new Error('Stream unavailable');
      const song: Song = {
        id: track.id,
        title: resolved.title || track.title,
        artist: resolved.artist || track.artist,
        album: track.album,
        cover_url: resolved.cover_url || track.cover_url,
        audio_url: resolved.streamUrl,
        duration: resolved.duration || track.duration,
        source: 'indexed',
      };
      playSong(song, undefined, artistSongs.map(t => ({
        id: t.id, title: t.title, artist: t.artist, album: t.album,
        cover_url: t.cover_url, audio_url: t.id === track.id ? resolved.streamUrl! : 'resolving', source: 'indexed' as const,
      })));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Playback failed');
    } finally {
      setResolvingId(null);
    }
  }, [playSong, artistSongs]);

  const categoriesWithAll = useMemo(() => ['All', ...ARTIST_CATEGORIES] as const, []);

  return (
    <div className="h-[100dvh] bg-background flex flex-col overflow-hidden relative">
      <header className="flex-shrink-0 z-30 px-4 pt-3 pb-3 safe-area-pt" style={{
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(40px) saturate(180%)',
        borderBottom: '0.5px solid rgba(255,255,255,0.06)',
      }}>
        <div className="flex items-center gap-3">
          <motion.button onClick={() => { triggerHaptic('impactLight'); selectedArtist ? setSelectedArtist(null) : navigate(-1); }}
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.10)' }}
            whileTap={{ scale: 0.85 }}>
            <ArrowLeft className="w-4 h-4" />
          </motion.button>
          <h1 className="text-xl font-bold tracking-tight truncate">
            {selectedArtist ? selectedArtist.name : 'Discover Artists'}
          </h1>
        </div>

        {!selectedArtist && (
          <>
            {/* Search */}
            <div className="mt-3 relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search artists..."
                className="w-full h-10 pl-9 pr-9 rounded-xl bg-white/5 border border-white/10 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/40"
              />
              {query && (
                <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Category chips */}
            <div className="mt-3 -mx-4 px-4 overflow-x-auto scrollbar-hide">
              <div className="flex gap-2 w-max">
                {categoriesWithAll.map(cat => {
                  const active = activeCategory === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => { triggerHaptic('selection'); setActiveCategory(cat as any); }}
                      className="px-3 h-8 rounded-full text-xs font-semibold whitespace-nowrap transition-all"
                      style={{
                        background: active ? 'hsl(var(--primary))' : 'rgba(255,255,255,0.06)',
                        color: active ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))',
                        border: `0.5px solid ${active ? 'hsl(var(--primary))' : 'rgba(255,255,255,0.10)'}`,
                      }}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </header>

      <main className="flex-1 overflow-y-auto px-4 pt-4 pb-36" style={{ WebkitOverflowScrolling: 'touch' }}>
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : selectedArtist ? (
          <div className="space-y-1">
            {loadingSongs ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : artistSongs.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No songs found for this artist</p>
            ) : (
              artistSongs.map((track, i) => {
                const isActive = currentSong?.id === track.id;
                const isResolving = resolvingId === track.id;
                return (
                  <motion.button key={track.id}
                    className={`flex items-center gap-3 p-3 rounded-2xl w-full text-left active:scale-[0.98] transition-all ${isActive ? 'bg-primary/10' : ''}`}
                    style={{ background: isActive ? undefined : 'rgba(255,255,255,0.03)' }}
                    onClick={() => !isResolving && handlePlayTrack(track)}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.02, 0.5) }}>
                    <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-muted">
                      {track.cover_url ? (
                        <img src={track.cover_url} alt="" className="w-full h-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><Music className="w-4 h-4 text-muted-foreground" /></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-semibold text-[13px] truncate ${isActive ? 'text-primary' : ''}`}>
                        {isResolving ? 'Loading...' : track.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">{track.artist}</p>
                    </div>
                    {isActive && isPlaying ? (
                      <div className="flex items-end gap-[2px] h-4">
                        {[0,1,2].map(j => <div key={j} className="w-[3px] bg-primary rounded-full animate-audio-wave" style={{ animationDelay: `${j*0.12}s` }} />)}
                      </div>
                    ) : isResolving ? (
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    ) : null}
                  </motion.button>
                );
              })
            )}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-12 text-sm">
            No artists match your search.
          </p>
        ) : (
          <div className="space-y-1.5">
            <p className="text-[11px] text-muted-foreground px-1 mb-1">
              {filtered.length} artists · Tap heart to follow
            </p>
            {filtered.map(a => (
              <ArtistRow
                key={a.name}
                artist={a}
                isFollowed={followed.has(a.name.toLowerCase())}
                onFollow={handleFollow}
                onPlay={handleOpenArtist}
                onOpen={handleOpenArtist}
              />
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default AllArtists;
