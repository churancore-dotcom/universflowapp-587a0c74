import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Loader2, Play } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import LikeButton from '@/components/LikeButton';
import { TabTransition } from '@/components/PageTransition';
import { usePlayer, type Song } from '@/contexts/PlayerContext';
import { getCollectionBySlug } from '@/lib/collections';
import { prefetchIndexedTrack, searchIndexedTracks, type IndexedTrack } from '@/lib/musicIndexer';
import { triggerHaptic } from '@/hooks/useHaptics';
import { supabase } from '@/integrations/supabase/client';

export default function Collection() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const collection = getCollectionBySlug(slug);
  const [tracks, setTracks] = useState<IndexedTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const { playSong, currentSong, isPlaying } = usePlayer();

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const res = await searchIndexedTracks(collection.query, 50);
      setTracks(res);
    } finally {
      setLoading(false);
    }
  }, [collection.query]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await load(true);
    })().catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [load]);

  // Realtime: refresh collection tracks instantly when viral chart updates
  useEffect(() => {
    const channel = supabase
      .channel(`collection-refresh-${slug}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'viral_chart_refreshes' }, () => {
        load(false);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [slug, load]);

  useEffect(() => {
    tracks.slice(0, 8).forEach((track) => prefetchIndexedTrack(track.artist, track.title));
  }, [tracks]);

  const playTrack = useCallback((track: IndexedTrack) => {
    const queue: Song[] = tracks.map((t) => ({
      id: t.id,
      title: t.title,
      artist: t.artist,
      album: t.album,
      cover_url: t.cover_url,
      audio_url: 'resolving',
      duration: t.duration,
      source: 'indexed' as const,
    }));
    const song = queue.find((item) => item.id === track.id);
    if (song) playSong(song, undefined, queue);
  }, [playSong, tracks]);

  return (
    <TabTransition>
      <div className="h-[100dvh] bg-background flex flex-col overflow-hidden relative">
        <header className="relative flex-shrink-0 px-4 pt-3 pb-5 safe-area-pt overflow-hidden" style={{ background: collection.gradient }}>
          <div className="absolute inset-0 bg-background/25" />
          <div className="relative z-10">
            <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-background/50 backdrop-blur-xl flex items-center justify-center mb-5">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[42px] leading-none mb-2">{collection.emoji}</p>
                <h1 className="text-[34px] font-black leading-[0.95] whitespace-pre-line tracking-tight text-primary-foreground">{collection.label}</h1>
                <p className="mt-2 text-primary-foreground/80 text-sm font-semibold">{collection.subtitle}</p>
              </div>
              {tracks[0] && (
                <motion.button onClick={() => { triggerHaptic('selection'); playTrack(tracks[0]); }} whileTap={{ scale: 0.92 }} className="w-14 h-14 rounded-full bg-primary-foreground text-background flex items-center justify-center shadow-xl flex-shrink-0">
                  <Play className="w-6 h-6 ml-0.5" fill="currentColor" />
                </motion.button>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 pt-4 pb-32" style={{ WebkitOverflowScrolling: 'touch' }}>
          {loading ? (
            <div className="h-40 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : (
            <div className="space-y-1">
              {tracks.map((track, index) => {
                const song: Song = { id: track.id, title: track.title, artist: track.artist, album: track.album, cover_url: track.cover_url, audio_url: 'resolving', duration: track.duration, source: 'indexed' };
                const active = currentSong?.id === track.id;
                return (
                  <motion.button key={`${track.id}-${index}`} onClick={() => playTrack(track)} className={`w-full flex items-center gap-3 py-2.5 rounded-xl text-left ${active ? 'bg-primary/10' : ''}`} whileTap={{ scale: 0.98 }}>
                    <span className="w-6 text-center text-[12px] font-bold text-muted-foreground">{index + 1}</span>
                    {track.cover_url ? <img src={track.cover_url} alt={track.title} className="w-12 h-12 rounded-lg object-cover" loading="lazy" referrerPolicy="no-referrer" /> : <div className="w-12 h-12 rounded-lg bg-muted" />}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold truncate ${active ? 'text-primary' : ''}`}>{track.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                    </div>
                    <LikeButton songId={track.id} song={song} size="sm" />
                    {active && isPlaying ? <span className="text-[10px] font-black text-primary pr-1">LIVE</span> : null}
                  </motion.button>
                );
              })}
            </div>
          )}
        </main>
        <BottomNav />
      </div>
    </TabTransition>
  );
}
