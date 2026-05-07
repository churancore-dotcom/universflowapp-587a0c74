import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Music2, Radio } from 'lucide-react';
import { toast } from 'sonner';
import { usePlayer, Song } from '@/contexts/PlayerContext';
import { detectCountry, getTopIndexedTracks, prefetchIndexedTrack, resolveIndexedTrack, type IndexedTrack } from '@/lib/musicIndexer';


const GlobalTopTracksSection = () => {
  const [tracks, setTracks] = useState<IndexedTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const { playSong, currentSong, isPlaying } = usePlayer();
  const country = useMemo(() => detectCountry(), []);
  const regionLabel = 'Top Charts';

  useEffect(() => {
    let cancelled = false;

    const loadTopTracks = async () => {
      try {
        const data = await getTopIndexedTracks(30, country);
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

  useEffect(() => {
    tracks.slice(0, 8).forEach((track) => {
      prefetchIndexedTrack(track.artist, track.title);
    });
  }, [tracks]);

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
        cover_url: t.cover_url, audio_url: 'resolving', source: 'indexed' as const,
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
      <section className="space-y-2">
        <h2 className="text-[20px] font-extrabold tracking-tight px-1">{regionLabel}</h2>
        <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-1 -mx-3 px-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="w-36 flex-shrink-0 animate-pulse">
              <div className="mb-2 aspect-square rounded-md bg-muted/60" />
              <div className="h-3 rounded bg-muted/60 mb-1.5" />
              <div className="h-3 w-2/3 rounded bg-muted/40" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (tracks.length === 0) return null;

  return (
    <section className="space-y-2">
      <h2 className="text-[20px] font-extrabold tracking-tight px-1">{regionLabel}</h2>

      <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-1 -mx-3 px-3 snap-x">
        {tracks.map((track) => {
          const isActive = currentSong?.id === track.id;
          const isResolving = resolvingId === track.id;

          return (
            <button
              key={track.id}
              type="button"
              onClick={() => !isResolving && handlePlay(track)}
              className="group w-36 flex-shrink-0 snap-start text-left active:scale-[0.97] transition-transform"
            >
              <div
                className="relative mb-2 aspect-square overflow-hidden rounded-md bg-muted/50"
                style={{ boxShadow: '0 6px 18px rgba(0,0,0,0.45)' }}
              >
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

                {(isResolving || isActive) && (
                  <div className="absolute bottom-2 right-2 w-9 h-9 rounded-full bg-primary flex items-center justify-center shadow-xl">
                    {isResolving ? (
                      <Loader2 className="w-4 h-4 text-primary-foreground animate-spin" />
                    ) : isPlaying ? (
                      <span className="text-primary-foreground text-[11px] font-bold">II</span>
                    ) : (
                      <span className="text-primary-foreground text-[12px] font-bold ml-[1px]">▶</span>
                    )}
                  </div>
                )}
              </div>

              <p className={`truncate text-[14px] font-bold leading-tight ${isActive ? 'text-primary' : 'text-foreground'}`}>
                {track.title}
              </p>
              <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{track.artist}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default GlobalTopTracksSection;