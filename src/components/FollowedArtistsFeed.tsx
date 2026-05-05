import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Music, Heart } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayer, Song } from '@/contexts/PlayerContext';
import { supabase } from '@/integrations/supabase/client';
import { getUserArtistPrefs } from '@/lib/userArtistPrefs';
import { resolveIndexedTrack, prefetchIndexedTrack } from '@/lib/musicIndexer';
import { triggerHaptic } from '@/hooks/useHaptics';
import HorizontalSection from '@/components/HorizontalSection';
import { toast } from 'sonner';

interface FATrack extends Song {
  _external?: boolean;
  _createdAt?: number;
}

/**
 * Followed Artists feed — newest catalog tracks from artists the user follows,
 * topped up with external streams. Pre-prefetches the top of the list so taps
 * play instantly (Spotify-like).
 */
const FollowedArtistsFeed = () => {
  const { user } = useAuth();
  const { playSong, currentSong } = usePlayer();
  const [tracks, setTracks] = useState<FATrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!user) { setTracks([]); setLoading(false); return; }

    (async () => {
      try {
        const prefs = await getUserArtistPrefs(user.id);
        if (cancelled) return;
        if (!prefs.length) { setTracks([]); setLoading(false); return; }

        const names = prefs.map(p => p.artist_name);

        // Catalog tracks from followed artists — newest first
        const { data: catalog } = await supabase
          .from('songs')
          .select('id, title, artist, album, cover_url, audio_url, duration, artist_id, is_premium_only, created_at')
          .in('artist', names)
          .eq('is_visible', true)
          .order('created_at', { ascending: false })
          .limit(40);

        const catalogSongs: FATrack[] = (catalog || []).map((s: any) => ({
          id: s.id, title: s.title, artist: s.artist, album: s.album || undefined,
          cover_url: s.cover_url || undefined, audio_url: s.audio_url,
          duration: s.duration || undefined, artist_id: s.artist_id || undefined,
          is_premium_only: s.is_premium_only,
          _createdAt: new Date(s.created_at).getTime(),
        }));

        // Top up with fresh external streams from followed artists
        const externals: FATrack[] = prefs.slice(0, 12).map((p) => ({
          id: `fa-ext-${p.artist_name.toLowerCase().replace(/\s+/g, '-')}`,
          title: 'Latest single',
          artist: p.artist_name,
          cover_url: p.artist_image || undefined,
          audio_url: 'resolving',
          source: 'indexed',
          _external: true,
          _createdAt: new Date(p.created_at).getTime(),
        }));

        // Merge — catalog newest first, then externals; dedupe by artist+title
        const seen = new Set<string>();
        const merged: FATrack[] = [];
        for (const t of [...catalogSongs, ...externals]) {
          const key = `${t.artist}::${t.title}`.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          merged.push(t);
          if (merged.length >= 25) break;
        }

        if (!cancelled) setTracks(merged);
      } catch (e) {
        console.error('FollowedArtistsFeed load failed:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user]);

  // Pre-resolve top tracks so first taps are instant (Spotify-like)
  useEffect(() => {
    tracks.slice(0, 10).forEach((t) => {
      if (t._external || t.audio_url === 'resolving') {
        prefetchIndexedTrack(t.artist, t.title === 'Latest single' ? '' : t.title);
      }
    });
  }, [tracks]);

  const queue = useMemo(() => tracks, [tracks]);

  const handlePlay = async (track: FATrack) => {
    triggerHaptic('selection');
    if (!track._external) {
      playSong(track, undefined, queue);
      return;
    }
    setResolvingId(track.id);
    try {
      const resolved = await resolveIndexedTrack(track.artist, track.title === 'Latest single' ? '' : track.title);
      if (!resolved.streamUrl) throw new Error('No stream available');
      const song: Song = {
        id: track.id,
        title: resolved.title || track.title,
        artist: resolved.artist || track.artist,
        cover_url: resolved.cover_url || track.cover_url,
        audio_url: resolved.streamUrl,
        duration: resolved.duration,
        source: 'indexed',
      };
      playSong(song, undefined, queue);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not play this track');
    } finally {
      setResolvingId(null);
    }
  };

  if (!user || loading || tracks.length === 0) return null;

  return (
    <HorizontalSection title="From Your Artists" subtitle="Newest from artists you follow" songs={tracks}>
      {tracks.map((song, i) => (
        <motion.button
          key={song.id}
          onClick={() => handlePlay(song)}
          className="flex-shrink-0 w-[140px] snap-start text-left"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.03, duration: 0.3 }}
          whileTap={{ scale: 0.96 }}
          disabled={resolvingId === song.id}
        >
          <div
            className="relative w-[140px] h-[140px] rounded-2xl overflow-hidden mb-2 bg-muted"
            style={{ boxShadow: '0 6px 20px rgba(0,0,0,0.35)', border: '0.5px solid rgba(255,255,255,0.08)' }}
          >
            {song.cover_url ? (
              <img src={song.cover_url} alt="" className="w-full h-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                <Music className="w-7 h-7 text-muted-foreground" />
              </div>
            )}
            {currentSong?.id === song.id && <div className="absolute inset-0 bg-primary/10" />}
            <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-full bg-background/70 backdrop-blur-md flex items-center gap-1">
              <Heart className="w-2.5 h-2.5 text-primary" fill="currentColor" />
              <span className="text-[8px] font-bold text-primary uppercase tracking-wider">Following</span>
            </div>
          </div>
          <p className="text-[13px] font-bold truncate text-foreground leading-tight">{song.title}</p>
          <p className="text-[11px] text-muted-foreground/70 truncate mt-0.5">{song.artist}</p>
        </motion.button>
      ))}
    </HorizontalSection>
  );
};

export default FollowedArtistsFeed;
