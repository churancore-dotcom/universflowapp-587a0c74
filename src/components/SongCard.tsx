import React, { memo, useCallback, useMemo, useState } from 'react';
import { Play, Pause, ListPlus, Eye } from 'lucide-react';
import { usePlayer, Song } from '@/contexts/PlayerContext';
import { useDownloads } from '@/contexts/DownloadContext';
import { useNavigate } from 'react-router-dom';
import DownloadButton from './DownloadButton';
import LikeButton from './LikeButton';
import AddToPlaylistModal from './AddToPlaylistModal';
import CreatePlaylistModal from './CreatePlaylistModal';
import OptimizedImage from './OptimizedImage';
import { triggerHaptic } from '@/hooks/useHaptics';

interface SongCardProps {
  song: Song;
  index?: number;
  sectionSongs?: Song[]; // All songs in the section for queue
}

// Simple CSS-only audio wave - no framer-motion for performance
const AudioWave = memo(({ isPlaying }: { isPlaying: boolean }) => (
  <div className="flex items-end gap-[3px] h-4">
    {[0, 1, 2].map((i) => (
      <div
        key={i}
        className={`w-[3px] bg-white rounded-full transition-all duration-300 ${
          isPlaying ? 'animate-audio-wave' : 'h-[5px]'
        }`}
        style={{ animationDelay: `${i * 0.12}s` }}
      />
    ))}
  </div>
));

AudioWave.displayName = 'AudioWave';

const SongCard = memo(({ song, index = 0, sectionSongs }: SongCardProps) => {
  const { currentSong, isPlaying, playSong, togglePlay } = usePlayer();
  const { isDownloaded, getDownloadedUrl } = useDownloads();
  const navigate = useNavigate();
  
  const [showAddToPlaylist, setShowAddToPlaylist] = useState(false);
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  
  const isCurrentSong = useMemo(() => currentSong?.id === song.id, [currentSong?.id, song.id]);
  const downloaded = useMemo(() => isDownloaded(song.id), [isDownloaded, song.id]);

  const handleArtistClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (song.artist_id) {
      navigate(`/artist/${song.artist_id}`);
    }
  }, [song.artist_id, navigate]);

  const handleClick = useCallback(() => {
    triggerHaptic('impactLight');
    if (isCurrentSong) {
      togglePlay();
    } else {
      const offlineUrl = getDownloadedUrl(song.id);
      // Pass the section songs as the queue so next/prev work
      playSong(song, offlineUrl, sectionSongs);
    }
  }, [isCurrentSong, togglePlay, getDownloadedUrl, song, playSong, sectionSongs]);

  // Format play count for display
  const formatViews = useCallback((count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  }, []);

  const handleAddToPlaylist = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowAddToPlaylist(true);
  }, []);

  return (
    <div
      className="group relative flex-shrink-0 w-[150px] snap-start active:scale-[0.97] transition-transform duration-150 will-change-transform"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Card Container - mobile optimized */}
      <div
        className="relative aspect-square rounded-2xl overflow-hidden bg-muted/30 cursor-pointer shadow-lg"
        onClick={handleClick}
      >
        {/* Cover Image - Lazy loaded */}
        {song.cover_url ? (
          <OptimizedImage
            src={song.cover_url}
            alt={song.title}
            className="w-full h-full"
            eager={index < 4}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/30 via-purple-500/20 to-accent/30 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
              <Play className="w-5 h-5 text-white/60" />
            </div>
          </div>
        )}
        
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-80" />
        
        {/* Action buttons - 44px min touch targets */}
        <div className="absolute top-2 right-2 z-20 flex flex-col gap-1.5">
          <LikeButton songId={song.id} size="sm" className="bg-black/50 backdrop-blur-md rounded-full w-9 h-9" />
          <DownloadButton song={song} size="sm" />
          <button
            onClick={handleAddToPlaylist}
            className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white/80 active:bg-black/70 transition-colors"
          >
            <ListPlus className="w-4 h-4" />
          </button>
        </div>
        
        {/* Downloaded badge */}
        {downloaded && (
          <div className="absolute top-2 left-2 z-10">
            <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center shadow-md">
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        )}

        {/* Now Playing indicator */}
        {isCurrentSong && (
          <div className="absolute bottom-2 right-2">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-lg">
              <AudioWave isPlaying={isPlaying} />
            </div>
          </div>
        )}
      </div>
      
      {/* Song Info - larger text for mobile */}
      <div className="mt-2.5 px-0.5">
        <p className={`font-semibold text-sm truncate leading-tight ${isCurrentSong ? 'text-primary' : 'text-foreground'}`}>
          {song.title}
        </p>
        <div className="flex items-center justify-between mt-1">
          <button 
            className="flex items-center gap-1.5 flex-1 min-h-[44px] -my-2"
            onClick={handleArtistClick}
          >
            {song.artist_photo_url && (
              <img 
                src={song.artist_photo_url} 
                alt={song.artist}
                className="w-4 h-4 rounded-full object-cover"
                loading="lazy"
              />
            )}
            <p className={`text-xs text-muted-foreground/80 truncate font-medium ${song.artist_id ? 'active:text-primary transition-colors' : ''}`}>
              {song.artist}
            </p>
          </button>
          {/* Play count / Views */}
          {(song.play_count ?? 0) > 0 && (
            <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground/60">
              <Eye className="w-3 h-3" />
              <span>{formatViews(song.play_count ?? 0)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Add to Playlist Modal - Lazy mounted */}
      {showAddToPlaylist && (
        <AddToPlaylistModal
          isOpen={showAddToPlaylist}
          onClose={() => setShowAddToPlaylist(false)}
          song={song}
          onCreateNew={() => {
            setShowAddToPlaylist(false);
            setShowCreatePlaylist(true);
          }}
        />
      )}

      {/* Create Playlist Modal - Lazy mounted */}
      {showCreatePlaylist && (
        <CreatePlaylistModal
          isOpen={showCreatePlaylist}
          onClose={() => setShowCreatePlaylist(false)}
          onCreated={() => {
            setShowCreatePlaylist(false);
            setShowAddToPlaylist(true);
          }}
        />
      )}
    </div>
  );
});

SongCard.displayName = 'SongCard';

export default SongCard;
