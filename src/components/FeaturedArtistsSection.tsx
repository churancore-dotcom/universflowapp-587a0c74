import React, { memo, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { User, Music } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { iosSpring } from '@/lib/animations';

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

  return (
    <motion.button
      className="flex-shrink-0 w-[100px] snap-start"
      onClick={() => navigate(`/artist/${artist.id}`)}
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ ...iosSpring, delay: index * 0.06 }}
      whileHover={{ scale: 1.05, y: -5 }}
      whileTap={{ scale: 0.95 }}
    >
      <div className="relative w-[100px] h-[100px] rounded-full overflow-hidden mb-3 mx-auto shadow-xl">
        {artist.photo_url ? (
          <img 
            src={artist.photo_url} 
            alt={artist.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/40 to-accent/40 flex items-center justify-center">
            <User className="w-10 h-10 text-white/60" />
          </div>
        )}
        {/* Gradient ring */}
        <motion.div
          className="absolute inset-[-2px] rounded-full -z-10"
          style={{
            background: 'linear-gradient(135deg, hsl(220 100% 60%), hsl(330 100% 60%))',
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        />
      </div>
      
      <p className="text-[13px] font-semibold text-center truncate">
        {artist.name}
      </p>
      <div className="flex items-center justify-center gap-1 mt-0.5">
        <Music className="w-3 h-3 text-muted-foreground" />
        <p className="text-[11px] text-muted-foreground">
          {artist.song_count} songs
        </p>
      </div>
    </motion.button>
  );
});

ArtistCard.displayName = 'ArtistCard';

const FeaturedArtistsSection = () => {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchArtists = async () => {
      // Get artists with song counts
      const { data: artistsData } = await supabase
        .from('artists')
        .select('id, name, photo_url, genre');

      if (artistsData) {
        // Get song counts for each artist
        const artistsWithCounts = await Promise.all(
          artistsData.map(async (artist) => {
            const { count } = await supabase
              .from('songs')
              .select('*', { count: 'exact', head: true })
              .eq('artist_id', artist.id)
              .eq('is_visible', true);

            return {
              ...artist,
              song_count: count || 0,
            };
          })
        );

        // Sort by song count and filter those with songs
        const sorted = artistsWithCounts
          .filter(a => a.song_count > 0)
          .sort((a, b) => b.song_count - a.song_count)
          .slice(0, 10);

        setArtists(sorted);
      }
      setLoading(false);
    };

    fetchArtists();
  }, []);

  if (loading || artists.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-4 px-1">
        <span className="text-xl">🌟</span>
        <h2 className="text-[20px] font-bold tracking-tight">Featured Artists</h2>
      </div>
      
      <div 
        className="flex gap-4 overflow-x-auto pb-3 hide-scrollbar snap-x snap-mandatory -mx-5 px-5"
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
