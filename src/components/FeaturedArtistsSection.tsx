import React, { memo, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { User, Music, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { triggerHaptic } from '@/hooks/useHaptics';

interface Artist {
  id: string;
  name: string;
  photo_url: string | null;
  genre: string | null;
  song_count: number;
}

interface ArtistCardProps {
  artist: Artist;
  index: number;
}

const ArtistCard = memo(({ artist, index }: ArtistCardProps) => {
  const navigate = useNavigate();

  const handleClick = () => {
    triggerHaptic('selection');
    navigate(`/artist/${artist.id}`);
  };

  return (
    <motion.button
      className="flex-shrink-0 w-[72px] snap-start text-center active:scale-95 transition-transform"
      onClick={handleClick}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.04, duration: 0.2 }}
    >
      {/* Avatar with gradient ring */}
      <div className="relative w-[60px] h-[60px] mx-auto mb-1.5">
        <div 
          className="absolute inset-0 rounded-full p-[2px]"
          style={{
            background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(330 100% 60%))',
          }}
        >
          <div className="w-full h-full rounded-full overflow-hidden bg-background">
            {artist.photo_url ? (
              <img 
                src={artist.photo_url} 
                alt={artist.name}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                <User className="w-5 h-5 text-muted-foreground" />
              </div>
            )}
          </div>
        </div>
      </div>
      
      <p className="text-[11px] font-medium truncate text-foreground leading-tight">
        {artist.name}
      </p>
      <p className="text-[9px] text-muted-foreground">
        {artist.song_count} {artist.song_count === 1 ? 'song' : 'songs'}
      </p>
    </motion.button>
  );
});

ArtistCard.displayName = 'ArtistCard';

const FeaturedArtistsSection = () => {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchArtists = async () => {
      const { data: artistsData } = await supabase
        .from('artists')
        .select('id, name, photo_url, genre');

      if (artistsData) {
        const artistsWithCounts = await Promise.all(
          artistsData.map(async (artist) => {
            const { count } = await supabase
              .from('songs')
              .select('*', { count: 'exact', head: true })
              .eq('artist_id', artist.id)
              .eq('is_visible', true);

            return { ...artist, song_count: count || 0 };
          })
        );

        const sorted = artistsWithCounts
          .filter(a => a.song_count > 0)
          .sort((a, b) => b.song_count - a.song_count)
          .slice(0, 12);

        setArtists(sorted);
      }
      setLoading(false);
    };

    fetchArtists();
  }, []);

  if (loading || artists.length === 0) return null;

  return (
    <section className="mb-2">
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles className="w-3.5 h-3.5 text-primary" />
        <h2 className="text-base font-bold tracking-tight text-foreground">Artists</h2>
      </div>
      
      {/* Horizontal scroll - optimized for mobile */}
      <div 
        className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar snap-x snap-mandatory -mx-3 px-3"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {artists.map((artist, i) => (
          <ArtistCard key={artist.id} artist={artist} index={i} />
        ))}
      </div>
    </section>
  );
};

export default memo(FeaturedArtistsSection);
