import { useEffect, useMemo, useState, memo } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayer, type Song } from '@/contexts/PlayerContext';
import { triggerHaptic } from '@/hooks/useHaptics';
import { Play, Sparkles } from 'lucide-react';
import { getSongHistory } from '@/lib/songHistory';

interface Mix {
  id: string;
  title: string;
  subtitle: string;
  songs: Song[];
  accent: string; // hsl
}

const ACCENTS = [
  '350 100% 60%',
  '280 100% 65%',
  '210 100% 60%',
  '160 90% 50%',
  '40 100% 60%',
  '320 100% 65%',
];

function rowToSong(s: any): Song {
  return {
    id: s.id,
    title: s.title,
    artist: s.artist,
    album: s.album || undefined,
    cover_url: s.cover_url || undefined,
    audio_url: s.audio_url,
    duration: s.duration || undefined,
    genre: s.genre || undefined,
    mood: s.mood || undefined,
  } as Song;
}

function buildMixes(played: { song: Song; count: number; lastTs: number }[]): Mix[] {
  if (played.length < 3) return [];
  const mixes: Mix[] = [];
  let accentIdx = 0;
  const nextAccent = () => ACCENTS[accentIdx++ % ACCENTS.length];

  // 1. On Repeat — most-played overall
  const onRepeat = [...played]
    .filter(p => p.count >= 1)
    .sort((a, b) => b.count - a.count)
    .slice(0, 30)
    .map(p => p.song);
  if (onRepeat.length >= 3) {
    mixes.push({
      id: 'mix-on-repeat',
      title: 'On Repeat',
      subtitle: 'Songs you keep coming back to',
      songs: onRepeat,
      accent: nextAccent(),
    });
  }

  // 2. Per top artist mixes
  const byArtist = new Map<string, { song: Song; count: number }[]>();
  played.forEach(p => {
    const key = p.song.artist?.trim();
    if (!key) return;
    if (!byArtist.has(key)) byArtist.set(key, []);
    byArtist.get(key)!.push(p);
  });
  const topArtists = Array.from(byArtist.entries())
    .map(([artist, items]) => ({
      artist,
      total: items.reduce((s, i) => s + i.count, 0),
      songs: items.sort((a, b) => b.count - a.count).map(i => i.song),
    }))
    .filter(a => a.songs.length >= 3)
    .sort((a, b) => b.total - a.total)
    .slice(0, 2);
  topArtists.forEach(a => {
    mixes.push({
      id: `mix-artist-${a.artist}`,
      title: `${a.artist} Mix`,
      subtitle: `Made for fans of ${a.artist}`,
      songs: a.songs.slice(0, 30),
      accent: nextAccent(),
    });
  });

  // 3. Discover by genre
  const byGenre = new Map<string, Song[]>();
  played.forEach(p => {
    const g = p.song.genre?.trim();
    if (!g) return;
    if (!byGenre.has(g)) byGenre.set(g, []);
    byGenre.get(g)!.push(p.song);
  });
  const topGenre = Array.from(byGenre.entries())
    .filter(([, s]) => s.length >= 3)
    .sort((a, b) => b[1].length - a[1].length)[0];
  if (topGenre) {
    mixes.push({
      id: `mix-genre-${topGenre[0]}`,
      title: `${topGenre[0]} Mix`,
      subtitle: `Your favorite ${topGenre[0]} tracks`,
      songs: topGenre[1].slice(0, 30),
      accent: nextAccent(),
    });
  }

  // 4. Recently played mix
  const recent = [...played]
    .sort((a, b) => b.lastTs - a.lastTs)
    .slice(0, 25)
    .map(p => p.song);
  if (recent.length >= 5) {
    mixes.push({
      id: 'mix-recent',
      title: 'Daily Replay',
      subtitle: 'A blend from your latest sessions',
      songs: recent,
      accent: nextAccent(),
    });
  }

  return mixes;
}

const StackedCard = ({ mix, onPlay }: { mix: Mix; onPlay: () => void }) => {
  const covers = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const s of mix.songs) {
      if (s.cover_url && !seen.has(s.cover_url)) {
        seen.add(s.cover_url);
        list.push(s.cover_url);
        if (list.length === 3) break;
      }
    }
    return list;
  }, [mix.songs]);

  return (
    <motion.button
      onClick={() => { triggerHaptic('selection'); onPlay(); }}
      whileTap={{ scale: 0.96 }}
      className="flex-shrink-0 w-[160px] text-left"
    >
      {/* Stacked artwork — YouTube-style fanned cards */}
      <div className="relative h-[160px] mb-2.5">
        {/* Back card 2 */}
        {covers[2] && (
          <div
            className="absolute top-1 left-4 right-4 h-[152px] rounded-[14px] overflow-hidden"
            style={{
              transform: 'scale(0.86)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              border: '0.5px solid rgba(255,255,255,0.08)',
            }}
          >
            <img src={covers[2]} alt="" className="w-full h-full object-cover opacity-70" />
          </div>
        )}
        {/* Back card 1 */}
        {covers[1] && (
          <div
            className="absolute top-2 left-2 right-2 h-[156px] rounded-[14px] overflow-hidden"
            style={{
              transform: 'scale(0.93)',
              boxShadow: '0 6px 16px rgba(0,0,0,0.45)',
              border: '0.5px solid rgba(255,255,255,0.10)',
            }}
          >
            <img src={covers[1]} alt="" className="w-full h-full object-cover opacity-85" />
          </div>
        )}
        {/* Front card */}
        <div
          className="absolute inset-0 rounded-[14px] overflow-hidden"
          style={{
            boxShadow: `0 10px 28px hsl(${mix.accent} / 0.35), 0 4px 14px rgba(0,0,0,0.5)`,
            border: '0.5px solid rgba(255,255,255,0.12)',
          }}
        >
          {covers[0] ? (
            <img src={covers[0]} alt={mix.title} className="w-full h-full object-cover" />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, hsl(${mix.accent} / 0.6), hsl(${mix.accent} / 0.2))`,
              }}
            >
              <Sparkles className="w-10 h-10 text-white/80" />
            </div>
          )}
          {/* Mix badge */}
          <div
            className="absolute top-2 left-2 px-2 py-0.5 rounded-md flex items-center gap-1"
            style={{
              background: 'rgba(0,0,0,0.55)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              border: '0.5px solid rgba(255,255,255,0.12)',
            }}
          >
            <Sparkles className="w-2.5 h-2.5" style={{ color: `hsl(${mix.accent})` }} />
            <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-white">Mix</span>
          </div>
          {/* Bottom gradient + title */}
          <div
            className="absolute inset-x-0 bottom-0 p-2.5"
            style={{
              background: 'linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0.0))',
            }}
          >
            <p className="text-[13px] font-bold text-white leading-tight line-clamp-2">{mix.title}</p>
          </div>
          {/* Play button */}
          <div
            className="absolute bottom-2 right-2 w-9 h-9 rounded-full flex items-center justify-center"
            style={{
              background: `hsl(${mix.accent})`,
              boxShadow: `0 4px 12px hsl(${mix.accent} / 0.5)`,
            }}
          >
            <Play className="w-4 h-4 text-white fill-white ml-0.5" />
          </div>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground/70 line-clamp-2 px-0.5">{mix.subtitle}</p>
    </motion.button>
  );
};

const AutoMixSectionComponent = () => {
  const { user } = useAuth();
  const { playSong } = usePlayer();
  const [mixes, setMixes] = useState<Mix[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const aggregate = new Map<string, { song: Song; count: number; lastTs: number }>();

      // 1. Recently played from DB (catalog songs)
      if (user?.id) {
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const { data } = await supabase
          .from('recently_played')
          .select('song_id, played_at, songs(*)')
          .eq('user_id', user.id)
          .gte('played_at', since)
          .order('played_at', { ascending: false })
          .limit(500);

        (data || []).forEach((row: any) => {
          if (!row.songs) return;
          const song = rowToSong(row.songs);
          const ts = new Date(row.played_at).getTime();
          const ex = aggregate.get(song.id);
          if (ex) {
            ex.count++;
            if (ts > ex.lastTs) ex.lastTs = ts;
          } else {
            aggregate.set(song.id, { song, count: 1, lastTs: ts });
          }
        });
      }

      // 2. Local song history (external streams) as supplemental signal
      try {
        const local = getSongHistory();
        local.forEach(h => {
          const id = h.id;
          if (aggregate.has(id)) {
            const ex = aggregate.get(id)!;
            ex.count++;
            if (h.ts > ex.lastTs) ex.lastTs = h.ts;
          } else if (h.audio_url) {
            aggregate.set(id, {
              song: {
                id: h.id,
                title: h.title,
                artist: h.artist,
                album: h.album,
                cover_url: h.cover_url,
                audio_url: h.audio_url,
                duration: h.duration,
                source: h.source,
              } as Song,
              count: 1,
              lastTs: h.ts,
            });
          }
        });
      } catch { /* ignore */ }

      const built = buildMixes(Array.from(aggregate.values()));
      if (!cancelled) setMixes(built);
    };
    load();
    return () => { cancelled = true; };
  }, [user?.id]);

  if (mixes.length === 0) return null;

  return (
    <section className="pt-1">
      <div className="flex items-center justify-between px-1 mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, hsl(350 100% 60% / 0.25), hsl(280 100% 65% / 0.15))',
              border: '0.5px solid hsl(350 100% 60% / 0.25)',
            }}
          >
            <Sparkles className="w-3.5 h-3.5" style={{ color: 'hsl(350 100% 60%)' }} />
          </div>
          <div>
            <h2 className="text-[16px] font-bold text-foreground tracking-tight">Made For You</h2>
            <p className="text-[10px] text-muted-foreground/60">Auto-mixes from your listening</p>
          </div>
        </div>
      </div>
      <div
        className="flex gap-3 overflow-x-auto px-1 pb-2 -mx-1 hide-scrollbar"
        style={{ WebkitOverflowScrolling: 'touch', scrollSnapType: 'x mandatory' }}
      >
        {mixes.map(mix => (
          <div key={mix.id} style={{ scrollSnapAlign: 'start' }}>
            <StackedCard
              mix={mix}
              onPlay={() => {
                if (mix.songs.length === 0) return;
                playSong(mix.songs[0], null, mix.songs);
              }}
            />
          </div>
        ))}
      </div>
    </section>
  );
};

const AutoMixSection = memo(AutoMixSectionComponent);
AutoMixSection.displayName = 'AutoMixSection';
export default AutoMixSection;
