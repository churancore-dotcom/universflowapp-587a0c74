import { useState, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Sparkles, X, Wand2, Music2, Moon, Sun, Zap, Heart, Loader2 } from 'lucide-react';
import { iosSpring } from '@/lib/animations';
import { toast } from 'sonner';
import { usePremium } from '@/hooks/usePremium';
import PremiumLockOverlay from './PremiumLockOverlay';
import { searchYTMusic, type YTMusicResult } from '@/lib/ytMusicSearch';
import { persistStreamSong } from '@/lib/streamSongs';

interface AIPlaylistGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  onPlaylistCreated?: () => void;
}

interface MoodOption {
  id: string;
  label: string;
  icon: React.ReactNode;
  prompt: string;
  queries: string[];
  gradient: string;
}

const moodOptions: MoodOption[] = [
  {
    id: 'energetic',
    label: 'Energetic',
    icon: <Zap className="w-5 h-5" />,
    prompt: 'high energy workout',
    queries: ['high energy workout hits', 'gym motivation songs', 'upbeat pop bangers', 'edm workout playlist'],
    gradient: 'from-orange-500 to-red-500',
  },
  {
    id: 'chill',
    label: 'Chill',
    icon: <Moon className="w-5 h-5" />,
    prompt: 'relaxing chill',
    queries: ['chill lofi beats', 'relaxing acoustic songs', 'calm ambient music', 'sunset chill mix'],
    gradient: 'from-blue-500 to-purple-500',
  },
  {
    id: 'happy',
    label: 'Happy',
    icon: <Sun className="w-5 h-5" />,
    prompt: 'happy feel good',
    queries: ['feel good happy songs', 'good vibes pop', 'happy hindi songs', 'sunshine indie hits'],
    gradient: 'from-yellow-500 to-orange-500',
  },
  {
    id: 'romantic',
    label: 'Romantic',
    icon: <Heart className="w-5 h-5" />,
    prompt: 'romantic love songs',
    queries: ['romantic love songs', 'best hindi romantic songs', 'slow love ballads', 'arijit singh romantic'],
    gradient: 'from-pink-500 to-rose-500',
  },
  {
    id: 'focus',
    label: 'Focus',
    icon: <Music2 className="w-5 h-5" />,
    prompt: 'focus study',
    queries: ['deep focus instrumental', 'study lofi mix', 'concentration piano music', 'ambient study beats'],
    gradient: 'from-cyan-500 to-blue-500',
  },
  {
    id: 'party',
    label: 'Party',
    icon: <Sparkles className="w-5 h-5" />,
    prompt: 'party dance',
    queries: ['party dance hits', 'club bangers 2024', 'bollywood party songs', 'edm party anthems'],
    gradient: 'from-violet-500 to-purple-500',
  },
];


const AIPlaylistGenerator = memo(({ isOpen, onClose, onPlaylistCreated }: AIPlaylistGeneratorProps) => {
  const { user } = useAuth();
  const { isPremium, isLoading: premiumLoading } = usePremium();
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState('');

  if (isOpen && !premiumLoading && !isPremium) {
    return (
      <AnimatePresence>
        <PremiumLockOverlay
          title="AI Playlist Generator"
          description="Create mood-matched playlists in seconds. Available with Premium."
          onClose={onClose}
        />
      </AnimatePresence>
    );
  }

  const generatePlaylist = async () => {
    if (!user || (!selectedMood && !customPrompt.trim())) {
      toast.error('Please select a mood or enter a description');
      return;
    }

    setIsGenerating(true);
    
    try {
      const mood = moodOptions.find((m) => m.id === selectedMood);
      const customQuery = customPrompt.trim();
      const queries = customQuery
        ? [customQuery, `${customQuery} songs`, `${customQuery} hits`, `best ${customQuery}`]
        : mood?.queries || [];

      setGenerationStep('Searching YouTube...');

      // Run searches in parallel across all queries
      const searchResults = await Promise.all(
        queries.map((q) => searchYTMusic(q).catch(() => [] as YTMusicResult[])),
      );

      // Interleave results so the playlist mixes from each query, then dedupe
      const seen = new Set<string>();
      const interleaved: YTMusicResult[] = [];
      const maxLen = Math.max(...searchResults.map((r) => r.length), 0);
      for (let i = 0; i < maxLen; i++) {
        for (const list of searchResults) {
          const item = list[i];
          if (!item || seen.has(item.videoId)) continue;
          // Skip very short clips (per content sourcing preference)
          if (item.duration && item.duration < 120) continue;
          seen.add(item.videoId);
          interleaved.push(item);
        }
      }

      const picked = interleaved.slice(0, 20);

      if (picked.length === 0) {
        toast.error('No tracks found. Try a different vibe.');
        return;
      }

      setGenerationStep('Saving tracks...');

      // Persist as stream songs (audio_url resolved on play)
      await Promise.all(
        picked.map((r) =>
          persistStreamSong({
            id: r.id,
            title: r.title,
            artist: r.artist,
            cover_url: r.cover_url,
            audio_url: 'resolving',
            duration: r.duration,
            source: 'indexed',
          } as any),
        ),
      );

      setGenerationStep('Creating playlist...');

      const playlistTitle = customQuery
        ? `AI: ${customQuery.slice(0, 30)}${customQuery.length > 30 ? '…' : ''}`
        : `AI: ${mood?.label} Mix`;

      const { data: newPlaylist, error: playlistError } = await supabase
        .from('playlists')
        .insert({
          title: playlistTitle,
          description: `AI-generated from YouTube · ${queries[0]}`,
          user_id: user.id,
          is_public: false,
        })
        .select()
        .single();

      if (playlistError) throw playlistError;

      const playlistSongs = picked.map((r, index) => ({
        playlist_id: newPlaylist.id,
        song_id: r.id,
        position: index,
        track_source: 'indexed',
      }));

      const { error: songsInsertError } = await supabase
        .from('playlist_songs')
        .insert(playlistSongs);

      if (songsInsertError) throw songsInsertError;

      setGenerationStep('Done! ✨');
      await new Promise((r) => setTimeout(r, 400));

      toast.success(`Created "${playlistTitle}" with ${picked.length} songs!`);
      onPlaylistCreated?.();
      onClose();
    } catch (error) {
      console.error('Failed to generate playlist:', error);
      toast.error('Failed to generate playlist');
    } finally {
      setIsGenerating(false);
      setGenerationStep('');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/70 backdrop-blur-xl"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          className="relative w-full max-w-md rounded-3xl overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, rgba(30, 30, 35, 0.98) 0%, rgba(20, 20, 25, 0.99) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
          initial={{ y: 50, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 50, opacity: 0, scale: 0.95 }}
          transition={iosSpring}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-white/5">
            <div className="flex items-center gap-3">
              <motion.div 
                className="w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br from-violet-500 to-pink-500"
                animate={{
                  boxShadow: [
                    '0 0 20px rgba(168, 85, 247, 0.4)',
                    '0 0 40px rgba(168, 85, 247, 0.6)',
                    '0 0 20px rgba(168, 85, 247, 0.4)',
                  ],
                }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Wand2 className="w-6 h-6 text-white" />
              </motion.div>
              <div>
                <h2 className="text-lg font-semibold">AI DJ</h2>
                <p className="text-xs text-muted-foreground">Create a personalized playlist</p>
              </div>
            </div>
            <motion.button
              onClick={onClose}
              className="w-10 h-10 rounded-full flex items-center justify-center glass"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <X className="w-5 h-5" />
            </motion.button>
          </div>

          <div className="p-5 space-y-6">
            {/* Mood selection */}
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Select a mood</h3>
              <div className="grid grid-cols-3 gap-2">
                {moodOptions.map((mood) => (
                  <motion.button
                    key={mood.id}
                    onClick={() => {
                      setSelectedMood(mood.id === selectedMood ? null : mood.id);
                      setCustomPrompt('');
                    }}
                    className={`flex flex-col items-center gap-2 p-4 rounded-2xl transition-all ${
                      selectedMood === mood.id
                        ? `bg-gradient-to-br ${mood.gradient} text-white`
                        : 'glass hover:bg-white/10'
                    }`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    transition={iosSpring}
                  >
                    {mood.icon}
                    <span className="text-xs font-medium">{mood.label}</span>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Or divider */}
            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-xs text-muted-foreground">or describe your vibe</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            {/* Custom prompt */}
            <div>
              <textarea
                value={customPrompt}
                onChange={(e) => {
                  setCustomPrompt(e.target.value);
                  setSelectedMood(null);
                }}
                placeholder="e.g., Rainy day coffee shop vibes, or 90s throwback hits..."
                className="w-full h-24 bg-white/5 rounded-2xl px-4 py-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
              />
            </div>

            {/* Generate button */}
            <motion.button
              onClick={generatePlaylist}
              disabled={isGenerating || (!selectedMood && !customPrompt.trim())}
              className="w-full py-4 rounded-2xl font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-3 bg-gradient-to-r from-violet-500 to-pink-500"
              whileHover={{ scale: isGenerating ? 1 : 1.02 }}
              whileTap={{ scale: isGenerating ? 1 : 0.98 }}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{generationStep}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>Generate Playlist</span>
                </>
              )}
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
});

AIPlaylistGenerator.displayName = 'AIPlaylistGenerator';

export default AIPlaylistGenerator;
