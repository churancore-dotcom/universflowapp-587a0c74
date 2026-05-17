import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Flame, Loader2, Music, Sparkles, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Song, usePlayer } from '@/contexts/PlayerContext';
import { prefetchIndexedTrack, type IndexedTrack } from '@/lib/musicIndexer';
import { triggerHaptic } from '@/hooks/useHaptics';

type ChartType = 'trending' | 'viral' | 'latest';

interface Props {
  chartType: ChartType;
  /** When true, uses the signed-in user's country. Otherwise GLOBAL. */
  perCountry?: boolean;
  title?: string;
}

const META: Record<ChartType, { title: string; Icon: typeof Flame; color: string }> = {
  trending: { title: 'Trending Now',  Icon: TrendingUp, color: '#FF2D55' },
  viral:    { title: 'Viral',         Icon: Flame,      color: '#FF6B2D' },
  latest:   { title: 'New Releases',  Icon: Sparkles,   color: '#5AC8FA' },
};

function detectFallbackCountry(): string {
  try {
    const locale = (Intl.DateTimeFormat().resolvedOptions().locale || '').toUpperCase();
    const m = locale.match(/-([A-Z]{2})\b/);
    return m?.[1] || 'IN';
  } catch { return 'IN'; }
}

const ChartSection = memo(function ChartSection({ chartType, perCountry = false, title }: Props) {
  const { user } = useAuth();
  const { currentSong, isPlaying, playSong, togglePlay } = usePlayer();
  const [country, setCountry] = useState<string>('GLOBAL');
  const [tracks, setTracks] = useState<IndexedTrack[]>([]);
  const [loading, setLoading] = useState(true);

  // Resolve user country once (only when perCountry)
  useEffect(() => {
    if (!perCountry) { setCountry('GLOBAL'); return; }
    let cancelled = false;
    (async () => {
      let cc: string | null = null;
      if (user) {
        const { data } = await supabase.from('profiles').select('country_code').eq('user_id', user.id).maybeSingle();
        cc = (data?.country_code || '').toUpperCase() || null;
      }
      if (!cancelled) setCountry(cc || detectFallbackCountry());
    })();
    return () => { cancelled = true; };
  }, [perCountry, user?.id]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      // Try requested country, fall back to GLOBAL if empty
      const tryFetch = async (cc: string) => {
        const { data } = await supabase
          .from('chart_tracks')
          .select('title, artist, cover_url, source, external_id, rank')
          .eq('chart_type', chartType)
          .eq('country_code', cc)
          .order('rank', { ascending: true })
          .limit(30);
        return data ?? [];
      };

      let rows = await tryFetch(country);
      if (rows.length === 0 && country !== 'GLOBAL') rows = await tryFetch('GLOBAL');

      const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 60);
      const seen = new Set<string>();
      const mapped: IndexedTrack[] = [];
      for (const r of rows) {
        const k = norm(r.artist) + '|' + norm(r.title);
        if (seen.has(k)) continue;
        seen.add(k);
        mapped.push({
          id: `chart-${chartType}-${r.source}-${r.external_id ?? norm(r.artist + r.title)}`,
          title: r.title,
          artist: r.artist,
          cover_url: r.cover_url || undefined,
        } as IndexedTrack);
        if (mapped.length >= 24) break;
      }

      if (!cancelled) {
        setTracks(mapped);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [chartType, country]);

  // Pre-resolve top 6 streams so first taps feel instant
  useEffect(() => {
    tracks.slice(0, 6).forEach((t) => prefetchIndexedTrack(t.artist, t.title));
  }, [tracks]);

  const queueAsSongs: Song[] = useMemo(() => tracks.map((t) => ({
    id: t.id,
    title: t.title,
    artist: t.artist,
    album: t.album,
    cover_url: t.cover_url,
    audio_url: 'resolving',
    duration: t.duration,
    source: 'indexed' as const,
  })), [tracks]);

  const handleTap = useCallback((idx: number) => {
    triggerHaptic('impactLight');
    const song = queueAsSongs[idx];
    if (!song) return;
    if (currentSong?.id === song.id) togglePlay();
    else playSong(song, undefined, queueAsSongs);
  }, [queueAsSongs, currentSong?.id, togglePlay, playSong]);

  if (!loading && tracks.length === 0) return null;

  const meta = META[chartType];
  const heading = title ?? (perCountry && country !== 'GLOBAL' ? `${meta.title} · ${country}` : `${meta.title} · Worldwide`);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <meta.Icon className="w-4 h-4" style={{ color: meta.color }} />
          <h2 className="text-sm font-bold text-foreground">{heading}</h2>
        </div>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Live</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-1">
          {tracks.map((track, i) => {
            const active = currentSong?.id === track.id;
            return (
              <button
                key={track.id}
                type="button"
                onClick={() => handleTap(i)}
                className="w-32 flex-shrink-0 text-left active:scale-[0.96] transition-transform"
              >
                <div className={`relative mb-2 aspect-square overflow-hidden rounded-2xl bg-muted/50 ${active ? 'ring-2 ring-primary' : ''}`}>
                  {track.cover_url ? (
                    <img src={track.cover_url} alt={`${track.title} cover`} className="h-full w-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Music className="w-7 h-7 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[10px] font-bold text-white">
                    #{i + 1}
                  </div>
                  {active && isPlaying && (
                    <div className="absolute bottom-1.5 right-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground">▶</div>
                  )}
                </div>
                <p className={`truncate text-[12px] font-semibold ${active ? 'text-primary' : 'text-foreground'}`}>{track.title}</p>
                <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{track.artist}</p>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
});

export default ChartSection;
