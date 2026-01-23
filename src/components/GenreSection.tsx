import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { iosSpring } from '@/lib/animations';

interface GenreCardProps {
  genre: string;
  gradient: string;
  icon: string;
  delay: number;
}

const GenreCard = memo(({ genre, gradient, icon, delay }: GenreCardProps) => {
  const navigate = useNavigate();

  return (
    <motion.button
      className="flex-shrink-0 w-[120px] h-[80px] rounded-2xl overflow-hidden relative snap-start"
      onClick={() => navigate(`/search?genre=${encodeURIComponent(genre)}`)}
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ ...iosSpring, delay }}
      whileHover={{ scale: 1.05, y: -4 }}
      whileTap={{ scale: 0.95 }}
    >
      <div className={`absolute inset-0 ${gradient}`} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
      <div className="absolute inset-0 flex flex-col items-center justify-center p-3">
        <span className="text-2xl mb-1">{icon}</span>
        <span className="text-[12px] font-bold text-white text-center leading-tight">
          {genre}
        </span>
      </div>
    </motion.button>
  );
});

GenreCard.displayName = 'GenreCard';

const genres = [
  { genre: 'Pop', gradient: 'bg-gradient-to-br from-pink-500 to-rose-600', icon: '🎤' },
  { genre: 'Hip Hop', gradient: 'bg-gradient-to-br from-amber-500 to-orange-600', icon: '🎧' },
  { genre: 'Rock', gradient: 'bg-gradient-to-br from-red-500 to-rose-700', icon: '🎸' },
  { genre: 'Electronic', gradient: 'bg-gradient-to-br from-cyan-500 to-blue-600', icon: '🎹' },
  { genre: 'R&B', gradient: 'bg-gradient-to-br from-purple-500 to-violet-700', icon: '💜' },
  { genre: 'Indie', gradient: 'bg-gradient-to-br from-emerald-500 to-teal-600', icon: '🌿' },
  { genre: 'Jazz', gradient: 'bg-gradient-to-br from-yellow-600 to-amber-700', icon: '🎷' },
  { genre: 'Classical', gradient: 'bg-gradient-to-br from-slate-500 to-gray-700', icon: '🎻' },
  { genre: 'Lo-Fi', gradient: 'bg-gradient-to-br from-indigo-500 to-purple-600', icon: '🌙' },
  { genre: 'Phonk', gradient: 'bg-gradient-to-br from-rose-600 to-red-800', icon: '🔥' },
];

const GenreSection = () => {
  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-4 px-1">
        <span className="text-xl">🎵</span>
        <h2 className="text-[20px] font-bold tracking-tight">Browse by Genre</h2>
      </div>
      
      <div 
        className="flex gap-3 overflow-x-auto pb-3 hide-scrollbar snap-x snap-mandatory -mx-5 px-5"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {genres.map((g, i) => (
          <GenreCard
            key={g.genre}
            genre={g.genre}
            gradient={g.gradient}
            icon={g.icon}
            delay={i * 0.04}
          />
        ))}
      </div>
    </section>
  );
};

export default memo(GenreSection);
