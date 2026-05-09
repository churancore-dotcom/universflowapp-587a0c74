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
    const name = COUNTRY_NAMES[country] || COUNTRY_NAMES.IN;
    getGeoTopTracks(name, 24)
      .then((res) => { if (!cancelled) setTracks(res); })
      .finally(() => { if (!cancelled) setLoading(false); });
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

  const countryName = country ? COUNTRY_NAMES[country] || 'your country' : 'your country';

  if (!loading && tracks.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4" style={{ color: '#FF6B2D' }} />
          <h2 className="text-sm font-bold text-foreground">Viral in {countryName}</h2>
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
