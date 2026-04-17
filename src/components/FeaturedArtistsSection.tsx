import React, { memo, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { User, Sparkles, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { triggerHaptic } from '@/hooks/useHaptics';
import { getFeaturedIndexedArtists } from '@/lib/indexedArtists';

interface Artist {
  id: string;
  name: string;
  photo_url: string | null;
  genre: string | null;
  song_count: number;
}

const ArtistCard = memo(({ artist, index }: { artist: Artist; index: number }) => {
  const navigate = useNavigate();

  return (
    <motion.button
      className="flex-shrink-0 w-[82px] snap-start text-center"
      onClick={() => {
        triggerHaptic('selection');
        navigate(`/artist/${artist.id}`);
      }}
      initial={{ opacity: 0, scale: 0.8, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      whileTap={{ scale: 0.9 }}
    >
      <div className="relative w-[68px] h-[68px] mx-auto mb-2.5">
        {/* Gradient ring glow */}
        <div 
          className="absolute -inset-[4px] rounded-full opacity-50"
          style={{
            background: 'conic-gradient(from 0deg, hsl(var(--primary)), hsl(280 100% 65%), hsl(210 100% 60%), hsl(var(--primary)))',
            filter: 'blur(4px)',
          }}
        />
        <div 
          className="absolute inset-0 rounded-full p-[2.5px]"
          style={{
            background: 'conic-gradient(from 0deg, hsl(var(--primary)), hsl(280 100% 65%), hsl(210 100% 60%), hsl(var(--primary)))',
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
      
      <p className="text-[11px] font-bold truncate text-foreground leading-tight">
        {artist.name}
      </p>
      <p className="text-[9px] text-muted-foreground/40 mt-0.5 font-medium">
        Artist
      </p>
    </motion.button>
  );
});

ArtistCard.displayName = 'ArtistCard';

const FeaturedArtistsSection = () => {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchArtists = async () => {
      try {
        const { data, error } = await supabase
          .from('artists')
          .select('id, name, photo_url, genre')
          .order('name');

        if (error) throw error;

        if (data && data.length > 0) {
          setArtists(data.map(a => ({ ...a, song_count: 0 })));
        } else {
          const indexedArtists = await getFeaturedIndexedArtists(12);
          setArtists(indexedArtists.map((artist) => ({
            id: artist.id,
            name: artist.name,
            photo_url: artist.image_url || null,
            genre: 'Live',
            song_count: artist.listeners || 0,
          })));
        }
      } catch (err) {
        console.error('Failed to fetch artists:', err);
        try {
          const indexedArtists = await getFeaturedIndexedArtists(12);
          setArtists(indexedArtists.map((artist) => ({
            id: artist.id,
            name: artist.name,
            photo_url: artist.image_url || null,
            genre: 'Live',
            song_count: artist.listeners || 0,
          })));
        } catch (fallbackErr) {
          console.error('Failed to fetch live artists:', fallbackErr);
        }
      }
      setLoading(false);
    };

    fetchArtists();
  }, []);

  if (loading || artists.length === 0) return null;

  return (
    <section className="mb-2">
      <div
        className="rounded-3xl p-4 pb-3"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)',
          border: '0.5px solid rgba(255,255,255,0.08)',
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-lg flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, hsl(var(--primary) / 0.2), hsl(var(--primary) / 0.1))',
              }}
            >
              <Sparkles className="w-3.5 h-3.5 text-primary" />
            </div>
            <h2 className="text-[16px] font-bold tracking-tight text-foreground">Featured Artists</h2>
          </div>
          <motion.button
            className="flex items-center gap-1 text-xs font-medium text-primary"
            onClick={() => { triggerHaptic('selection'); navigate('/artists'); }}
            whileTap={{ scale: 0.95 }}
          >
            View All <ChevronRight className="w-3.5 h-3.5" />
          </motion.button>
        </div>
        
        <div 
          className="flex gap-3 overflow-x-auto pb-1 hide-scrollbar snap-x snap-mandatory -mx-4 px-4"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {artists.map((artist, i) => (
            <ArtistCard key={artist.id} artist={artist} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default memo(FeaturedArtistsSection);