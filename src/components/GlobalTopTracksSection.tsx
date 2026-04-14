import { useCallback, useEffect, useState } from 'react';
import { Loader2, Music2, Radio } from 'lucide-react';
import { toast } from 'sonner';
import { usePlayer, Song } from '@/contexts/PlayerContext';
import { getTopIndexedTracks, resolveIndexedTrack, type IndexedTrack } from '@/lib/musicIndexer';

const GlobalTopTracksSection = () => {
  const [tracks, setTracks] = useState<IndexedTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const { playSong, currentSong, isPlaying } = usePlayer();

  useEffect(() => {
    let cancelled = false;

    const loadTopTracks = async () => {
      try {
        const data = await getTopIndexedTracks(20);
        if (!cancelled) {
          setTracks(data);
        }
      } catch (error) {
        console.error('Failed to load top tracks:', error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadTopTracks();

    return () => {
      cancelled = true;
    };
  }, []);

  const handlePlay = useCallback(async (track: IndexedTrack) => {
    setResolvingId(track.id);
    try {
      const resolved = await resolveIndexedTrack(track.artist, track.title);
      if (!resolved.streamUrl) {
        throw new Error('No stream available for this track');
      }

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

      const allSongs: Song[] = tracks.map(t => ({
        id: t.id, title: t.title, artist: t.artist, album: t.album,
        cover_url: t.cover_url, audio_url: '', source: 'indexed' as const,
      }));
      playSong(song, undefined, allSongs);
    } catch (error) {
      console.error('Failed to resolve top track:', error);
      toast.error(error instanceof Error ? error.message : 'Could not play this track');
    } finally {
      setResolvingId(null);
    }
  }, [playSong]);

  if (loading) {
    return (
      <section className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <Radio className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">Global Top 20</h2>
        </div>
        <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-1">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="w-40 flex-shrink-0 rounded-3xl border border-border/50 bg-card/60 p-3 animate-pulse">
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
          <Radio className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">Global Top 20</h2>
        </div>
        <span className="text-[11px] text-muted-foreground">Live metadata + instant stream lookup</span>
      </div>

      <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-1">
        {tracks.map((track, index) => {
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
                  <img
                    src={track.cover_url}
                    alt={`${track.title} cover art`}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Music2 className="w-7 h-7 text-muted-foreground" />
                  </div>
                )}

                <div className="absolute left-2 top-2 rounded-full border border-border/60 bg-background/85 px-2 py-0.5 text-[10px] font-semibold text-foreground">
                  #{track.rank || index + 1}
                </div>

                <div className="absolute bottom-2 right-2 rounded-full border border-border/60 bg-background/85 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  {isResolving ? 'Loading' : isActive && isPlaying ? 'Playing' : 'Play'}
                </div>
              </div>

              <p className={`truncate text-[13px] font-semibold ${isActive ? 'text-primary' : 'text-foreground'}`}>
                {isResolving ? 'Resolving stream...' : track.title}
              </p>
              <p className="mt-1 truncate text-[11px] text-muted-foreground">{track.artist}</p>
              <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
                {isResolving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Radio className="w-3 h-3" />}
                <span>{track.listeners ? `${Math.round(track.listeners / 1000)}k listeners` : 'Tap to stream'}</span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default GlobalTopTracksSection;