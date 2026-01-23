import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { iosSpring } from '@/lib/animations';

interface MoodCardProps {
  mood: string;
  emoji: string;
  gradient: string;
  delay: number;
}

const MoodCard = memo(({ mood, emoji, gradient, delay }: MoodCardProps) => {
  const navigate = useNavigate();

  return (
    <motion.button
      className="flex-shrink-0 w-[100px] aspect-square rounded-3xl overflow-hidden relative snap-start"
      onClick={() => navigate(`/search?mood=${encodeURIComponent(mood)}`)}
      initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
      animate={{ opacity: 1, scale: 1, rotate: 0 }}
      transition={{ ...iosSpring, delay }}
      whileHover={{ scale: 1.08, rotate: 3 }}
      whileTap={{ scale: 0.92 }}
    >
      <div className={`absolute inset-0 ${gradient}`} />
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span 
          className="text-4xl mb-2"
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: delay * 2 }}
        >
          {emoji}
        </motion.span>
        <span className="text-[11px] font-bold text-white/90">
          {mood}
        </span>
      </div>
    </motion.button>
  );
});

MoodCard.displayName = 'MoodCard';

const moods = [
  { mood: 'Chill', emoji: '😌', gradient: 'bg-gradient-to-br from-sky-400 to-cyan-500' },
  { mood: 'Energetic', emoji: '⚡', gradient: 'bg-gradient-to-br from-orange-400 to-red-500' },
  { mood: 'Romantic', emoji: '💕', gradient: 'bg-gradient-to-br from-pink-400 to-rose-500' },
  { mood: 'Focus', emoji: '🎯', gradient: 'bg-gradient-to-br from-violet-500 to-purple-600' },
  { mood: 'Party', emoji: '🎉', gradient: 'bg-gradient-to-br from-yellow-400 to-amber-500' },
  { mood: 'Sad', emoji: '💙', gradient: 'bg-gradient-to-br from-slate-500 to-gray-600' },
  { mood: 'Workout', emoji: '💪', gradient: 'bg-gradient-to-br from-green-500 to-emerald-600' },
  { mood: 'Sleep', emoji: '🌙', gradient: 'bg-gradient-to-br from-indigo-600 to-purple-700' },
];

const MoodSection = () => {
  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-4 px-1">
        <span className="text-xl">✨</span>
        <h2 className="text-[20px] font-bold tracking-tight">Match Your Mood</h2>
      </div>
      
      <div 
        className="flex gap-3 overflow-x-auto pb-3 hide-scrollbar snap-x snap-mandatory -mx-5 px-5"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {moods.map((m, i) => (
          <MoodCard
            key={m.mood}
            mood={m.mood}
            emoji={m.emoji}
            gradient={m.gradient}
            delay={i * 0.05}
          />
        ))}
      </div>
    </section>
  );
};

export default memo(MoodSection);
