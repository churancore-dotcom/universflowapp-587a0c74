import React, { memo, useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Play, Pause } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Song, usePlayer } from '@/contexts/PlayerContext';
import { useDownloads } from '@/contexts/DownloadContext';
import { iosSpring } from '@/lib/animations';
import LikeButton from './LikeButton';

interface TopChartItemProps {
  song: Song;
  rank: number;
  playCount: number;
  onClick: () => void;
  isActive: boolean;
  isPlaying: boolean;
}

const TopChartItem = memo(({ song, rank, playCount, onClick, isActive, isPlaying }: TopChartItemProps) => {
  const formatPlays = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  };

  return (
    <motion.button
      className={`flex items-center gap-3 w-full p-3 rounded-2xl transition-colors ${
        isActive ? 'bg-primary/10' : 'active:bg-white/5'
      }`}
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
    >
      {/* Rank */}
      <div className="w-8 flex-shrink-0 text-center">
        <span className={`text-lg font-bold ${rank <= 3 ? 'gradient-text' : 'text-muted-foreground'}`}>
          {rank}
        </span>
      </div>

      {/* Cover */}
      <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-muted flex-shrink-0 shadow-lg">
        {song.cover_url ? (
          <img src={song.cover_url} alt={song.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/30 to-accent/30" />
        )}
        {isActive && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            {isPlaying ? (
              <Pause className="w-4 h-4 text-white" fill="white" />
            ) : (
              <Play className="w-4 h-4 text-white ml-0.5" fill="white" />
            )}
          </div>
        )}
      </div>
      
      {/* Info */}
      <div className="flex-1 min-w-0 text-left">
        <p className={`font-semibold text-[15px] truncate ${isActive ? 'text-primary' : ''}`}>
          {song.title}
        </p>
        <p className="text-[13px] text-muted-foreground truncate">
          {song.artist}
        </p>
      </div>
      
      {/* Plays count */}
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground/60 flex-shrink-0 mr-1">
        <TrendingUp className="w-3 h-3" />
        <span>{formatPlays(playCount)}</span>
      </div>

      <LikeButton songId={song.id} size="sm" />
    </motion.button>
  );
});

TopChartItem.displayName = 'TopChartItem';

const TopChartsSection = () => {
  const { currentSong, isPlaying, playSong, togglePlay, setQueue } = usePlayer();
  const { getDownloadedUrl } = useDownloads();
  const [topSongs, setTopSongs] = useState<{ song: Song; play_count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTop = async () => {
      const { data } = await supabase
        .from('songs')
        .select(`
          id, title, artist, album, cover_url, audio_url, duration, artist_id, play_count,
          artists (id, name, photo_url)
        `)
        .eq('is_visible', true)
        .order('play_count', { ascending: false })
        .limit(10);

      if (data) {
        setTopSongs(data.map((s: any) => {
          const artistData = s.artists as { id: string; name: string; photo_url: string | null } | null;
          return {
            play_count: s.play_count || 0,
            song: {
              id: s.id,
              title: s.title,
              artist: s.artist,
              album: s.album || undefined,
              cover_url: s.cover_url || undefined,
              audio_url: s.audio_url,
              duration: s.duration || undefined,
              artist_id: artistData?.id || s.artist_id || undefined,
              artist_photo_url: artistData?.photo_url || undefined,
            }
          };
        }));
      }
      setLoading(false);
    };

    fetchTop();
  }, []);

  const handlePlay = useCallback((song: Song, index: number) => {
    if (currentSong?.id === song.id) {
      togglePlay();
    } else {
      // Set queue from clicked song
      const queue = topSongs.map(t => t.song);
      const reordered = [...queue.slice(index), ...queue.slice(0, index)];
      setQueue(reordered);
      const offlineUrl = getDownloadedUrl(song.id);
      playSong(song, offlineUrl);
    }
  }, [currentSong, togglePlay, playSong, getDownloadedUrl, topSongs, setQueue]);

  if (loading || topSongs.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-4 px-1">
        <TrendingUp className="w-5 h-5 text-accent" />
        <h2 className="text-[20px] font-bold tracking-tight">Top Charts</h2>
      </div>
      
      <motion.div
        className="rounded-3xl overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(28, 28, 30, 0.7), rgba(40, 40, 42, 0.6))',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
        }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={iosSpring}
      >
        {topSongs.slice(0, 5).map(({ song, play_count }, index) => (
          <TopChartItem
            key={song.id}
            song={song}
            rank={index + 1}
            playCount={play_count}
            onClick={() => handlePlay(song, index)}
            isActive={currentSong?.id === song.id}
            isPlaying={currentSong?.id === song.id && isPlaying}
          />
        ))}
      </motion.div>
    </section>
  );
};

export default memo(TopChartsSection);
