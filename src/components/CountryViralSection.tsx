import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Flame, Loader2, Music } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Song, usePlayer } from '@/contexts/PlayerContext';
import { getGeoTopTracks, prefetchIndexedTrack, type IndexedTrack } from '@/lib/musicIndexer';
import { triggerHaptic } from '@/hooks/useHaptics';

// ISO-3166 alpha-2 → English country name (limited to common Last.fm-supported names)
const COUNTRY_NAMES: Record<string, string> = {
  IN: 'India', US: 'United States', GB: 'United Kingdom', CA: 'Canada', AU: 'Australia',
  DE: 'Germany', FR: 'France', BR: 'Brazil', MX: 'Mexico', JP: 'Japan', KR: 'South Korea',
  ES: 'Spain', IT: 'Italy', NL: 'Netherlands', SE: 'Sweden', NO: 'Norway', PL: 'Poland',
  RU: 'Russia', PT: 'Portugal', AR: 'Argentina', CL: 'Chile', CO: 'Colombia', ZA: 'South Africa',
  NG: 'Nigeria', EG: 'Egypt', TR: 'Turkey', ID: 'Indonesia', PH: 'Philippines', TH: 'Thailand',
  VN: 'Vietnam', MY: 'Malaysia', SG: 'Singapore', PK: 'Pakistan', BD: 'Bangladesh', LK: 'Sri Lanka',
  NP: 'Nepal', AE: 'United Arab Emirates', SA: 'Saudi Arabia', IE: 'Ireland', NZ: 'New Zealand',
};

function detectFallbackCountry(): string {
  try {
    const locale = (Intl.DateTimeFormat().resolvedOptions().locale || '').toUpperCase();
    const m = locale.match(/-([A-Z]{2})\b/);
    return m?.[1] || 'IN';
  } catch {
    return 'IN';
  }
}

/** Fetch Deezer top chart (global). Returns lightweight tracks needing stream resolution. */
async function getDeezerChart(limit = 30): Promise<IndexedTrack[]> {
  try {
    const res = await fetch(`https://api.deezer.com/chart/0/tracks?limit=${limit}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const items: any[] = Array.isArray(data?.data) ? data.data : [];
    return items.map((t) => ({
      id: `deezer-${t.id}`,
      title: t.title_short || t.title || 'Unknown',
      artist: t?.artist?.name || 'Unknown',
      cover_url: t?.album?.cover_big || t?.album?.cover_medium || undefined,
      duration: t?.duration || undefined,
    })) as IndexedTrack[];
  } catch {
    return [];
  }
}

const CountryViralSection = memo(function CountryViralSection() {
  const { user } = useAuth();
  const { currentSong, isPlaying, playSong, togglePlay } = usePlayer();
  const [country, setCountry] = useState<string | null>(null);
  const [tracks, setTracks] = useState<IndexedTrack[]>([]);
  const [loading, setLoading] = useState(true);

  // Resolve user country (profile first, then locale fallback)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let cc: string | null = null;
      if (user) {
        const { data } = await supabase.from('profiles').select('country_code').eq('user_id', user.id).maybeSingle();
        cc = (data?.country_code || '').toUpperCase() || null;
      }
      if (cancelled) return;
      setCountry(cc || detectFallbackCountry());
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    if (!country) return;
    let cancelled = false;
    setLoading(true);
    const TARGET = 24;

    (async () => {
      // 1) Admin-curated picks (global) come first
      const { data: picks } = await supabase
        .from('viral_picks')
        .select('track_id, title, artist, cover_url, audio_url, source, position')
        .eq('is_active', true)
        .order('position', { ascending: true })
        .limit(TARGET);

      const pinned: IndexedTrack[] = (picks || []).map((p) => ({
        id: p.track_id,
        title: p.title,
        artist: p.artist,
        cover_url: p.cover_url || undefined,
        audio_url: p.audio_url || undefined,
      }));

      const seen = new Set(pinned.map((t) => t.id));
      const need = Math.max(0, TARGET - pinned.length);

      // 2) Fill remainder by racing Last.fm (geo) + Deezer (global) in parallel
      let filler: IndexedTrack[] = [];
      if (need > 0) {
        const name = COUNTRY_NAMES[country] || COUNTRY_NAMES.IN;
        const [lastfmRes, deezerRes] = await Promise.allSettled([
          getGeoTopTracks(name, need + pinned.length),
          getDeezerChart(need + pinned.length),
        ]);
        const lastfm = lastfmRes.status === 'fulfilled' ? lastfmRes.value : [];
        const deezer = deezerRes.status === 'fulfilled' ? deezerRes.value : [];

        // Interleave: prioritize Last.fm (geo-targeted) but mix in Deezer for freshness
        const merged: IndexedTrack[] = [];
        const seenKeys = new Set<string>();
        const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 60);
        const max = Math.max(lastfm.length, deezer.length);
        for (let i = 0; i < max && merged.length < need; i++) {
          for (const t of [lastfm[i], deezer[i]]) {
            if (!t) continue;
            const k = norm(t.artist) + '|' + norm(t.title);
            if (seen.has(t.id) || seenKeys.has(k)) continue;
            seenKeys.add(k);
            merged.push(t);
            if (merged.length >= need) break;
          }
        }
        filler = merged;
      }

      if (!cancelled) {
        setTracks([...pinned, ...filler]);
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [country]);

  // Pre-resolve top 6 streams so taps feel instant
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

  const handleTap = useCallback((track: IndexedTrack, idx: number) => {
    triggerHaptic('impactLight');
    const song = queueAsSongs[idx];
    if (!song) return;
    if (currentSong?.id === song.id) togglePlay();
    else playSong(song, undefined, queueAsSongs);
  }, [queueAsSongs, currentSong?.id, togglePlay, playSong]);

  if (!loading && tracks.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4" style={{ color: '#FF6B2D' }} />
          <h2 className="text-sm font-bold text-foreground">Viral Right Now</h2>
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
                onClick={() => handleTap(track, i)}
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
                    <div className="absolute bottom-1.5 right-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground">
                      ▶
                    </div>
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

export default CountryViralSection;
