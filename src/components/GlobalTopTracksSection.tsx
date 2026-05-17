import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Music2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { usePlayer, Song } from '@/contexts/PlayerContext';
import { useAuth } from '@/contexts/AuthContext';
import { getUserArtistPrefs } from '@/lib/userArtistPrefs';
import { prefetchIndexedTrack, resolveIndexedTrack, getArtistTopTracksByName, type IndexedTrack } from '@/lib/musicIndexer';
import { supabase } from '@/integrations/supabase/client';

/**
 * Top 30 from the user's followed artists.
 * (Renamed from "Global Top 30" — same component name kept to avoid churn.)
 */
const GlobalTopTracksSection = () => {
  const { user } = useAuth();
  const { playSong, currentSong } = usePlayer();
  const [tracks, setTracks] = useState<IndexedTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [followedCount, setFollowedCount] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    if (!user) { setLoading(false); return; }
    (async () => {
      const prefs = await getUserArtistPrefs(user.id);
      if (cancelled) return;
      setFollowedCount(prefs.length);
      if (prefs.length === 0) { setLoading(false); return; }

      const names = prefs.map(p => p.artist_name).filter(Boolean);

      try {
        // 1) Pull whatever we already have cached in stream_songs (instant)
        const { data, error } = await supabase
          .from('stream_songs')
          .select('track_id, title, artist, album, cover_url, duration')
          .in('artist', names)
          .order('last_seen_at', { ascending: false })
          .limit(30);
        if (error) throw error;
        if (cancelled) return;
        const seen = new Set<string>();
        const mapped: IndexedTrack[] = [];
        for (const r of (data || [])) {
          const key = `${(r.artist || '').toLowerCase()}::${(r.title || '').toLowerCase()}`;
          if (seen.has(key)) continue;
          seen.add(key);
          mapped.push({
            id: r.track_id, title: r.title, artist: r.artist,
            album: r.album ?? undefined, cover_url: r.cover_url ?? undefined,
            duration: r.duration ?? undefined,
          });
        }
        setTracks(mapped);

        // 2) If the cache is thin (< 30), fan out and pull live top tracks per
        // followed artist via the Piped/Last.fm indexer so the rail always fills.
        if (mapped.length < 30) {
          const perArtist = Math.max(2, Math.ceil((30 - mapped.length) / Math.max(1, names.length)));
          const lists = await Promise.all(
            names.slice(0, 12).map((n) => getArtistTopTracksByName(n, perArtist).catch(() => [] as IndexedTrack[]))
          );
          if (cancelled) return;
          for (const list of lists) {
            for (const t of list) {
              const key = `${(t.artist || '').toLowerCase()}::${(t.title || '').toLowerCase()}`;
              if (seen.has(key)) continue;
              seen.add(key);
              mapped.push(t);
              if (mapped.length >= 30) break;
            }
            if (mapped.length >= 30) break;
          }
          if (!cancelled) setTracks([...mapped]);
        }
      } catch (e) {
        console.error('top-30 followed load failed', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    tracks.slice(0, 8).forEach(t => prefetchIndexedTrack(t.artist, t.title));
  }, [tracks]);

  const handlePlay = useCallback(async (track: IndexedTrack) => {
    setResolvingId(track.id);
    const startIdx = tracks.findIndex(t => t.id === track.id);
    // Try the clicked track, then walk forward through the rail on failure.
    // Max 5 attempts so a regional outage doesn't spin forever.
    const order = [track, ...tracks.slice(startIdx + 1)].slice(0, 5);
    let lastErr: unknown = null;
    try {
      for (const candidate of order) {
        try {
          const resolved = await resolveIndexedTrack(candidate.artist, candidate.title);
          if (!resolved.streamUrl) throw new Error('No stream');
          const song: Song = {
            id: candidate.id,
            title: resolved.title || candidate.title,
            artist: resolved.artist || candidate.artist,
            album: candidate.album,
            cover_url: resolved.cover_url || candidate.cover_url,
            audio_url: resolved.streamUrl,
            duration: resolved.duration || candidate.duration,
            source: 'indexed',
          };
          const queue: Song[] = tracks.map(t => ({
            id: t.id, title: t.title, artist: t.artist, album: t.album,
            cover_url: t.cover_url, audio_url: 'resolving', source: 'indexed' as const,
          }));
          if (candidate.id !== track.id) {
            toast.message(`Skipped to "${candidate.title}" — original stream unavailable`);
          }
          playSong(song, undefined, queue);
          return;
        } catch (e) {
          lastErr = e;
          // try next
        }
      }
      toast.error(lastErr instanceof Error ? lastErr.message : 'Could not play this track');
    } finally {
      setResolvingId(null);
    }
  }, [playSong, tracks]);

  // No followed artists yet → soft CTA
  if (!loading && followedCount === 0) {
    return (
      <section className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <Sparkles className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">Top 30 from Your Artists</h2>
        </div>
        <div className="rounded-2xl border border-border/50 bg-card/50 p-5 text-center">
          <p className="text-sm text-foreground/90 font-semibold mb-1">Follow artists to unlock this rail</p>
          <p className="text-xs text-muted-foreground mb-3">We'll surface their hottest tracks here.</p>
          <Link to="/artists" className="inline-block px-4 py-2 rounded-full text-xs font-bold bg-primary text-primary-foreground">Discover artists</Link>
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <Sparkles className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">Top 30 from Your Artists</h2>
        </div>
        <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="w-40 flex-shrink-0 rounded-3xl border border-border/50 bg-card/60 p-3 animate-pulse">
              <div className="mb-3 aspect-square rounded-2xl bg-muted/60" />
              <div className="h-3 rounded bg-muted/60 mb-2" />
              <div className="h-3 w-2/3 rounded bg-muted/40" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (tracks.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">Top 30 from Your Artists</h2>
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-1">
        {tracks.map((track) => {
          const isActive = currentSong?.id === track.id;
          const isResolving = resolvingId === track.id;
          return (
            <button
              key={track.id}
              type="button"
              onClick={() => !isResolving && handlePlay(track)}
              className="w-40 flex-shrink-0 rounded-3xl border border-border/50 bg-card/70 p-3 text-left transition-transform active:scale-[0.98]"
            >
              <div className="relative mb-3 aspect-square overflow-hidden rounded-2xl bg-muted/50">
                {track.cover_url ? (
                  <img src={track.cover_url} alt={`${track.title} cover art`} className="h-full w-full object-cover" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center"><Music2 className="w-7 h-7 text-muted-foreground" /></div>
                )}
                {isResolving && (
                  <div className="absolute bottom-2 right-2 rounded-full border border-border/60 bg-background/85 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin" />
                  </div>
                )}
              </div>
              <p className={`truncate text-[13px] font-semibold ${isActive ? 'text-primary' : 'text-foreground'}`}>{track.title}</p>
              <p className="mt-1 truncate text-[11px] text-muted-foreground">{track.artist}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default GlobalTopTracksSection;
