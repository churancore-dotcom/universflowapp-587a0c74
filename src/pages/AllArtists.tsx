import { useState, useEffect, useCallback, memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, User, Music, Loader2, Radio, Heart, Search as SearchIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayer, Song } from '@/contexts/PlayerContext';
import { searchIndexedTracks, resolveIndexedTrack, type IndexedTrack } from '@/lib/musicIndexer';
import { getFeaturedIndexedArtists } from '@/lib/indexedArtists';
import { followArtist, unfollowArtist, getUserArtistPrefs } from '@/lib/userArtistPrefs';
import BottomNav from '@/components/BottomNav';
import MiniPlayer from '@/components/MiniPlayer';
import FullscreenPlayer from '@/components/FullscreenPlayer';
import { toast } from 'sonner';
import { triggerHaptic } from '@/hooks/useHaptics';

interface CatalogArtist {
  id: string;
  name: string;
  photo_url: string | null;
  genre: string | null;
  song_count: number;
}

interface StreamArtist {
  name: string;
  listeners: number;
  image_url?: string;
  source: 'lastfm';
}

const CatalogArtistCard = memo(({ artist }: { artist: CatalogArtist }) => {
  const navigate = useNavigate();
  return (
    <motion.button
      className="flex items-center gap-3 p-3 rounded-2xl w-full text-left active:scale-[0.98] transition-all"
      style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)' }}
      onClick={() => { triggerHaptic('selection'); navigate(`/artist/${artist.id}`); }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.97 }}
    >
      <div className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0 bg-muted">
        {artist.photo_url ? (
          <img src={artist.photo_url} alt={artist.name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20">
            <User className="w-6 h-6 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate text-foreground">{artist.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{artist.song_count} {artist.song_count === 1 ? 'song' : 'songs'} · Catalog</p>
      </div>
      {artist.genre && (
        <span className="text-[10px] px-2 py-1 rounded-full bg-primary/10 text-primary font-medium flex-shrink-0">
          {artist.genre}
        </span>
      )}
    </motion.button>
  );
});
CatalogArtistCard.displayName = 'CatalogArtistCard';

const StreamArtistCard = memo(({ artist, onPlay }: { artist: StreamArtist; onPlay: (name: string) => void }) => (
  <motion.button
    className="flex items-center gap-3 p-3 rounded-2xl w-full text-left active:scale-[0.98] transition-all"
    style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)' }}
    onClick={() => { triggerHaptic('selection'); onPlay(artist.name); }}
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    whileTap={{ scale: 0.97 }}
  >
    <div className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0 bg-muted">
      {artist.image_url ? (
        <img src={artist.image_url} alt={artist.name} className="w-full h-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20">
          <User className="w-6 h-6 text-muted-foreground" />
        </div>
      )}
    </div>
    <div className="flex-1 min-w-0">
      <p className="font-semibold text-sm truncate text-foreground">{artist.name}</p>
      <p className="text-xs text-muted-foreground mt-0.5">
        {artist.listeners ? `${Math.round(artist.listeners / 1000)}k listeners` : 'Tap to explore'} · <span className="text-primary">Web Stream</span>
      </p>
    </div>
    <Radio className="w-4 h-4 text-primary flex-shrink-0" />
  </motion.button>
));
StreamArtistCard.displayName = 'StreamArtistCard';

const AllArtists = () => {
  const navigate = useNavigate();
  const { playSong, currentSong, isPlaying } = usePlayer();
  const [catalogArtists, setCatalogArtists] = useState<CatalogArtist[]>([]);
  const [liveArtists, setLiveArtists] = useState<StreamArtist[]>([]);
  const [artistSongs, setArtistSongs] = useState<IndexedTrack[]>([]);
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingSongs, setLoadingSongs] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [artistsRes, songsRes] = await Promise.all([
          supabase.from('artists').select('id, name, photo_url, genre'),
          supabase.from('songs').select('artist_id').eq('is_visible', true).not('artist_id', 'is', null),
        ]);
        if (artistsRes.data && songsRes.data) {
          const countMap = new Map<string, number>();
          for (const s of songsRes.data) {
            if (s.artist_id) countMap.set(s.artist_id, (countMap.get(s.artist_id) || 0) + 1);
          }
          const sorted = artistsRes.data
            .map(a => ({ ...a, song_count: countMap.get(a.id) || 0 }))
            .filter(a => a.song_count > 0)
            .sort((a, b) => b.song_count - a.song_count);
          setCatalogArtists(sorted);
        }

        const indexedArtists = await getFeaturedIndexedArtists(20);
        setLiveArtists(indexedArtists.map((artist) => ({
          name: artist.name,
          listeners: artist.listeners || 0,
          image_url: artist.image_url,
          source: 'lastfm',
        })));
      } catch (e) {
        console.error('Failed to load artists:', e);
        try {
          const indexedArtists = await getFeaturedIndexedArtists(20);
          setLiveArtists(indexedArtists.map((artist) => ({
            name: artist.name,
            listeners: artist.listeners || 0,
            image_url: artist.image_url,
            source: 'lastfm',
          })));
        } catch (fallbackErr) {
          console.error('Failed to load live artists:', fallbackErr);
        }
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleStreamArtistPlay = useCallback(async (artistName: string) => {
    setSelectedArtist(artistName);
    setLoadingSongs(true);
    setArtistSongs([]);
    try {
      const tracks = await searchIndexedTracks(artistName, 50);
      setArtistSongs(tracks);
    } catch (e) {
      toast.error('Failed to load songs for this artist');
    }
    setLoadingSongs(false);
  }, []);

  const handlePlayTrack = useCallback(async (track: IndexedTrack) => {
    setResolvingId(track.id);
    try {
      const resolved = await resolveIndexedTrack(track.artist, track.title);
      if (!resolved.streamUrl) throw new Error('Stream unavailable');
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
      playSong(song, undefined, artistSongs.map(t => ({
        id: t.id, title: t.title, artist: t.artist, album: t.album,
        cover_url: t.cover_url, audio_url: t.id === track.id ? resolved.streamUrl! : 'resolving', source: 'indexed' as const,
      })));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Playback failed');
    } finally {
      setResolvingId(null);
    }
  }, [playSong, artistSongs]);

  return (
    <div className="h-[100dvh] bg-background flex flex-col overflow-hidden relative">
      <header className="flex-shrink-0 z-30 px-4 pt-3 pb-3 safe-area-pt" style={{
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(40px) saturate(180%)',
        borderBottom: '0.5px solid rgba(255,255,255,0.06)',
      }}>
        <div className="flex items-center gap-3">
          <motion.button onClick={() => { triggerHaptic('impactLight'); navigate(-1); }}
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.10)' }}
            whileTap={{ scale: 0.85 }}>
            <ArrowLeft className="w-4 h-4" />
          </motion.button>
          <h1 className="text-xl font-bold tracking-tight">
            {selectedArtist ? selectedArtist : 'All Artists'}
          </h1>
        </div>
        {selectedArtist && (
          <button onClick={() => { setSelectedArtist(null); setArtistSongs([]); }}
            className="mt-2 text-xs text-primary font-medium">
            ← Back to all artists
          </button>
        )}
      </header>

      <main className="flex-1 overflow-y-auto px-4 pt-4 pb-36" style={{ WebkitOverflowScrolling: 'touch' }}>
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : selectedArtist ? (
          <div className="space-y-1">
            {loadingSongs ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : artistSongs.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No songs found for this artist</p>
            ) : (
              artistSongs.map((track, i) => {
                const isActive = currentSong?.id === track.id;
                const isResolving = resolvingId === track.id;
                return (
                  <motion.button key={track.id}
                    className={`flex items-center gap-3 p-3 rounded-2xl w-full text-left active:scale-[0.98] transition-all ${isActive ? 'bg-primary/10' : ''}`}
                    style={{ background: isActive ? undefined : 'rgba(255,255,255,0.03)' }}
                    onClick={() => !isResolving && handlePlayTrack(track)}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.02, 0.5) }}>
                    <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-muted">
                      {track.cover_url ? (
                        <img src={track.cover_url} alt="" className="w-full h-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><Music className="w-4 h-4 text-muted-foreground" /></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-semibold text-[13px] truncate ${isActive ? 'text-primary' : ''}`}>
                        {isResolving ? 'Loading...' : track.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">{track.artist}</p>
                    </div>
                    {isActive && isPlaying ? (
                      <div className="flex items-end gap-[2px] h-4">
                        {[0,1,2].map(j => <div key={j} className="w-[3px] bg-primary rounded-full animate-audio-wave" style={{ animationDelay: `${j*0.12}s` }} />)}
                      </div>
                    ) : isResolving ? (
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    ) : null}
                  </motion.button>
                );
              })
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {catalogArtists.length > 0 && (
              <div>
                <h2 className="text-sm font-bold mb-3 flex items-center gap-1.5">
                  <Music className="w-4 h-4 text-primary" /> Catalog Artists · {catalogArtists.length}
                </h2>
                <div className="space-y-1.5">
                  {catalogArtists.map(a => <CatalogArtistCard key={a.id} artist={a} />)}
                </div>
              </div>
            )}

            {liveArtists.length > 0 && (
              <div>
                <h2 className="text-sm font-bold mb-3 flex items-center gap-1.5">
                  <Radio className="w-4 h-4 text-primary" /> Live Artists · {liveArtists.length}
                </h2>
                <div className="space-y-1.5">
                  {liveArtists.map((artist) => <StreamArtistCard key={artist.name} artist={artist} onPlay={handleStreamArtistPlay} />)}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <BottomNav />
      <MiniPlayer />
      <FullscreenPlayer />
    </div>
  );
};

export default AllArtists;
