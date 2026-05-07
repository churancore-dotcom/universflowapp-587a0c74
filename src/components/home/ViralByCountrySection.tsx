import { useEffect, useState, useCallback, memo } from 'react';
import { motion } from 'framer-motion';
import { Flame, Play, Pause, Loader2 } from 'lucide-react';
import { usePlayer, type Song } from '@/contexts/PlayerContext';
import { getTopIndexedTracks, prefetchIndexedTrack, type IndexedTrack } from '@/lib/musicIndexer';
import { getGeo, flagFor } from '@/lib/geoLocation';

function ViralByCountrySectionComponent() {
  const [geo, setGeo] = useState<{ cc: string; name: string } | null>(null);
  const [tracks, setTracks] = useState<IndexedTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentSong, isPlaying, playSong, togglePlay } = usePlayer();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const g = await getGeo();
      if (cancelled) return;
      const cc = g?.country_code || '';
      const name = g?.country_name || 'Worldwide';
      setGeo({ cc, name });
      try {
        const res = await getTopIndexedTracks(30, cc || undefined);
        if (!cancelled) setTracks(res);
      } catch {
        if (!cancelled) setTracks([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    tracks.slice(0, 6).forEach((t) => prefetchIndexedTrack(t.artist, t.title));
  }, [tracks]);

  const handlePlay = useCallback((track: IndexedTrack) => {
    if (currentSong?.id === track.id) {
      togglePlay();
      return;
    }
    const queue: Song[] = tracks.map((t) => ({
      id: t.id, title: t.title, artist: t.artist, album: t.album,
      cover_url: t.cover_url, audio_url: 'resolving', duration: t.duration,
      source: 'indexed' as const,
    }));
    const song = queue.find((s) => s.id === track.id)!;
    playSong(song, undefined, queue);
  }, [tracks, currentSong, togglePlay, playSong]);

  if (loading) {
    return (
      <section className="mb-2">
        <div className="flex items-center gap-2 mb-3 px-1">
          <Flame className="w-5 h-5 text-primary" />
          <h2 className="text-[20px] font-bold tracking-tight">Viral right now</h2>
        </div>
        <div className="h-32 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      </section>
    );
  }

  if (tracks.length === 0) return null;

  const flag = flagFor(geo?.cc || '');
  const heading = geo?.name ? `Viral in ${geo.name}` : 'Viral right now';

  return (
    <section className="mb-2">
      <div className="flex items-center gap-2 mb-3 px-1">
        <span className="text-[20px] leading-none">{flag}</span>
        <h2 className="text-[20px] font-bold tracking-tight">{heading}</h2>
        <Flame className="w-4 h-4 text-primary" />
      </div>

      <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory hide-scrollbar pb-1 -mx-1 px-1">
        {tracks.map((track, i) => {
          const isActive = currentSong?.id === track.id;
          return (
            <motion.button
              key={track.id}
              onClick={() => handlePlay(track)}
              whileTap={{ scale: 0.95 }}
              className="snap-start flex-shrink-0 w-[148px] text-left"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.2) }}
            >
              <div className="relative w-[148px] h-[148px] rounded-md overflow-hidden bg-muted shadow-lg">
                {track.cover_url ? (
                  <img src={track.cover_url} alt={track.title} className="w-full h-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary/30 to-accent/30" />
                )}
                <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-black/60 backdrop-blur-sm text-white">
                  #{i + 1}
                </div>
                <div className="absolute bottom-1.5 right-1.5 w-9 h-9 rounded-full bg-primary flex items-center justify-center shadow-xl">
                  {isActive && isPlaying ? (
                    <Pause className="w-4 h-4 text-primary-foreground" fill="currentColor" />
                  ) : (
                    <Play className="w-4 h-4 text-primary-foreground ml-0.5" fill="currentColor" />
                  )}
                </div>
              </div>
              <p className={`mt-2 font-semibold text-[13px] truncate ${isActive ? 'text-primary' : ''}`}>
                {track.title}
              </p>
              <p className="text-[11px] text-muted-foreground/70 truncate">{track.artist}</p>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}

const ViralByCountrySection = memo(ViralByCountrySectionComponent);
ViralByCountrySection.displayName = 'ViralByCountrySection';
export default ViralByCountrySection;
