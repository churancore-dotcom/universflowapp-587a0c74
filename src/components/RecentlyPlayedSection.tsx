import React, { memo, useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Clock, Play, Pause } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Song, usePlayer } from '@/contexts/PlayerContext';
import { useDownloads } from '@/contexts/DownloadContext';
import { iosSpring } from '@/lib/animations';

interface RecentlyPlayedItemProps {
  song: Song;
  playedAt: string;
  onClick: () => void;
  isActive: boolean;
  isPlaying: boolean;
}

const RecentlyPlayedItem = memo(({ song, playedAt, onClick, isActive, isPlaying }: RecentlyPlayedItemProps) => {
  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <motion.button
      className={`flex items-center gap-3 w-full p-3 rounded-2xl transition-colors ${
        isActive ? 'bg-primary/10' : 'active:bg-white/5'
      }`}
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
    >
      <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-muted flex-shrink-0 shadow-lg">
        {song.cover_url ? (
          <img src={song.cover_url} alt={song.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/30 to-accent/30" />
        )}
        <div className={`absolute inset-0 flex items-center justify-center ${isActive ? 'bg-black/40' : 'bg-black/20'}`}>
          {isActive && isPlaying ? (
            <Pause className="w-5 h-5 text-white" fill="white" />
          ) : (
            <Play className="w-5 h-5 text-white ml-0.5" fill="white" />
          )}
        </div>
      </div>
      
      <div className="flex-1 min-w-0 text-left">
        <p className={`font-semibold text-[15px] truncate ${isActive ? 'text-primary' : ''}`}>
          {song.title}
        </p>
        <p className="text-[13px] text-muted-foreground truncate">
          {song.artist}
        </p>
      </div>
      
      <span className="text-[11px] text-muted-foreground/60 flex-shrink-0">
        {timeAgo(playedAt)}
      </span>
    </motion.button>
  );
});

RecentlyPlayedItem.displayName = 'RecentlyPlayedItem';

const RecentlyPlayedSection = () => {
  const { user } = useAuth();
  const { currentSong, isPlaying, playSong, togglePlay } = usePlayer();
  const { getDownloadedUrl } = useDownloads();
  const [recentSongs, setRecentSongs] = useState<{ song: Song; played_at: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    
    const fetchRecent = async () => {
      const { data } = await supabase
        .from('recently_played')
        .select(`
          played_at,
          songs (
            id, title, artist, album, cover_url, audio_url, duration, artist_id,
            artists (id, name, photo_url)
          )
        `)
        .eq('user_id', user.id)
        .order('played_at', { ascending: false })
        .limit(10);

      if (data) {
        // Deduplicate by song id
        const seen = new Set<string>();
        const unique = data.filter((item: any) => {
          if (!item.songs || seen.has(item.songs.id)) return false;
          seen.add(item.songs.id);
          return true;
        }).slice(0, 5);

        setRecentSongs(unique.map((item: any) => {
          const s = item.songs;
          const artistData = s.artists as { id: string; name: string; photo_url: string | null } | null;
          return {
            played_at: item.played_at,
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

    fetchRecent();
  }, [user]);

  const handlePlay = useCallback((song: Song) => {
    if (currentSong?.id === song.id) {
      togglePlay();
    } else {
      const offlineUrl = getDownloadedUrl(song.id);
      playSong(song, offlineUrl);
    }
  }, [currentSong, togglePlay, playSong, getDownloadedUrl]);

  if (loading || recentSongs.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-4 px-1">
        <Clock className="w-5 h-5 text-primary" />
        <h2 className="text-[20px] font-bold tracking-tight">Recently Played</h2>
      </div>
      
      <motion.div
        className="rounded-3xl overflow-hidden"
        style={{
          background: 'rgba(28, 28, 30, 0.6)',
          backdropFilter: 'blur(20px)',
        }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={iosSpring}
      >
        {recentSongs.map(({ song, played_at }) => (
          <RecentlyPlayedItem
            key={`${song.id}-${played_at}`}
            song={song}
            playedAt={played_at}
            onClick={() => handlePlay(song)}
            isActive={currentSong?.id === song.id}
            isPlaying={currentSong?.id === song.id && isPlaying}
          />
        ))}
      </motion.div>
    </section>
  );
};

export default memo(RecentlyPlayedSection);
