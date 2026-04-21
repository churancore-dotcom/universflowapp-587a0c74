import { useEffect, useState, useCallback, memo } from 'react';
import { Sparkles, Loader2, Music2, Radio } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayer, type Song } from '@/contexts/PlayerContext';
import { getUserArtistPrefs } from '@/lib/userArtistPrefs';
import { searchIndexedTracks, resolveIndexedTrack, prefetchIndexedTrack, type IndexedTrack } from '@/lib/musicIndexer';

const PER_ARTIST = 4;

const MadeForYouSection = memo(() => {
  const { user } = useAuth();
  const { playSong, currentSong, isPlaying } = usePlayer();
  const [tracks, setTracks] = useState<IndexedTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let cancelled = false;

    (async () => {
      try {
        const prefs = await getUserArtistPrefs(user.id);
        if (!prefs.length) { if (!cancelled) setLoading(false); return; }

        // Fetch top tracks for each picked artist in parallel (cap to first 5 artists for speed)
        const artistsToQuery = prefs.slice(0, 5);
        const results = await Promise.all(
          artistsToQuery.map(p => searchIndexedTracks(p.artist_name, PER_ARTIST).catch(() => []))
        );

        // Interleave so different artists alternate
        const interleaved: IndexedTrack[] = [];
        const maxLen = Math.max(...results.map(r => r.length), 0);
        for (let i = 0; i < maxLen; i++) {
          for (const list of results) if (list[i]) interleaved.push(list[i]);
        }

        // Dedupe by id
        const seen = new Set<string>();
        const deduped = interleaved.filter(t => {
          if (seen.has(t.id)) return false;
          seen.add(t.id);
          return true;
        }).slice(0, 24);

        if (!cancelled) setTracks(deduped);
      } catch (e) {
        console.error('MadeForYou load failed:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user?.id]);

  // Prefetch first few stream URLs
  useEffect(() => {
    tracks.slice(0, 6).forEach(t => prefetchIndexedTrack(t.artist, t.title));
  }, [tracks]);

  const handlePlay = useCallback(async (track: IndexedTrack) => {
    setResolvingId(track.id);
    try {
      const resolved = await resolveIndexedTrack(track.artist, track.title);
      if (!resolved.streamUrl) throw new Error('No stream available');
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
        cover_url: t.cover_url, audio_url: t.id === track.id ? resolved.streamUrl! : 'resolving',
        source: 'indexed' as const,
      }));
      playSong(song, undefined, queue);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not play this track');
    } finally {
      setResolvingId(null);
    }
  }, [playSong, tracks]);

  if (!user || loading) return null;
  if (tracks.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, hsl(var(--primary) / 0.25), hsl(var(--primary) / 0.1))' }}
          >
            <Sparkles className="w-3.5 h-3.5 text-primary" />
          </div>
          <h2 className="text-sm font-bold text-foreground">Made For You</h2>
        </div>
        <span className="text-[10px] text-muted-foreground">From your artists</span>
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
                  <img src={track.cover_url} alt={track.title} className="h-full w-full object-cover"
                    loading="lazy" decoding="async" referrerPolicy="no-referrer" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Music2 className="w-7 h-7 text-muted-foreground" />
                  </div>
                )}
                {(isResolving || (isActive && isPlaying)) && (
                  <div className="absolute bottom-2 right-2 rounded-full border border-border/60 bg-background/85 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    {isResolving ? '...' : '▶'}
                  </div>
                )}
              </div>
              <p className={`truncate text-[13px] font-semibold ${isActive ? 'text-primary' : 'text-foreground'}`}>
                {track.title}
              </p>
              <p className="mt-1 truncate text-[11px] text-muted-foreground">{track.artist}</p>
              <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
                {isResolving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Radio className="w-3 h-3" />}
                <span>For you</span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
});

MadeForYouSection.displayName = 'MadeForYouSection';
export default MadeForYouSection;
