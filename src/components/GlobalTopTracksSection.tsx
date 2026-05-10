import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Music2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { usePlayer, Song } from '@/contexts/PlayerContext';
import { useAuth } from '@/contexts/AuthContext';
import { getUserArtistPrefs } from '@/lib/userArtistPrefs';
import { getTopIndexedTracks, prefetchIndexedTrack, resolveIndexedTrack, type IndexedTrack } from '@/lib/musicIndexer';

const normalize = (v?: string | null) => v?.trim().toLowerCase() || '';

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
      const followed = new Set(prefs.map(p => normalize(p.artist_name)));
      setFollowedCount(prefs.length);
      if (prefs.length === 0) { setLoading(false); return; }

      try {
        const top = await getTopIndexedTracks(200);
        if (cancelled) return;
        const filtered = top.filter(t => followed.has(normalize(t.artist))).slice(0, 30);
        setTracks(filtered);
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
    try {
      const resolved = await resolveIndexedTrack(track.artist, track.title);
      if (!resolved.streamUrl) throw new Error('No stream available for this track');
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
      const queue: Song[] = tracks.map(t => ({
        id: t.id, title: t.title, artist: t.artist, album: t.album,
        cover_url: t.cover_url, audio_url: 'resolving', source: 'indexed' as const,
      }));
      playSong(song, undefined, queue);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not play this track');
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
