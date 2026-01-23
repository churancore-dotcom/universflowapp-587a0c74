import React, { useState, forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Music, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { iosSpring, iosBounce } from '@/lib/animations';

interface CreatePlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const CreatePlaylistModal = forwardRef<HTMLDivElement, CreatePlaylistModalProps>(({ isOpen, onClose, onCreated }, ref) => {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!user || !title.trim()) {
      toast.error('Please enter a playlist name');
      return;
    }

    setLoading(true);

    const { error } = await supabase
      .from('playlists')
      .insert({
        user_id: user.id,
        title: title.trim(),
        description: description.trim() || null,
        is_public: isPublic,
      });

    if (error) {
      console.error('Error creating playlist:', error);
      toast.error('Failed to create playlist');
    } else {
      toast.success('Playlist created! 🎵');
      setTitle('');
      setDescription('');
      onCreated();
      onClose();
    }

    setLoading(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-md mx-auto"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={iosSpring}
          >
            <div 
              className="rounded-3xl overflow-hidden"
              style={{
                background: 'rgba(28, 28, 30, 0.95)',
                backdropFilter: 'blur(40px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-white/10">
                <h2 className="text-lg font-semibold">New Playlist</h2>
                <motion.button
                  onClick={onClose}
                  className="p-2 rounded-full hover:bg-white/10 transition-colors"
                  whileTap={{ scale: 0.9 }}
                >
                  <X className="w-5 h-5" />
                </motion.button>
              </div>

              {/* Content */}
              <div className="p-5 space-y-5">
                {/* Playlist artwork placeholder */}
                <motion.div 
                  className="w-32 h-32 mx-auto rounded-2xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, hsl(211 100% 50% / 0.3), hsl(328 100% 54% / 0.3))' }}
                  whileHover={{ scale: 1.05 }}
                  transition={iosBounce}
                >
                  <Music className="w-12 h-12 text-white/50" />
                </motion.div>

                {/* Title input */}
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">
                    Playlist Name
                  </label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="My Awesome Playlist"
                    className="bg-white/5 border-white/10 rounded-xl h-12"
                    maxLength={50}
                  />
                </div>

                {/* Description input */}
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">
                    Description (optional)
                  </label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What's this playlist about?"
                    className="bg-white/5 border-white/10 rounded-xl resize-none"
                    rows={3}
                    maxLength={200}
                  />
                </div>

                {/* Privacy toggle */}
                <motion.button
                  className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5"
                  onClick={() => setIsPublic(!isPublic)}
                  whileTap={{ scale: 0.98 }}
                >
                  <span className="font-medium">Public Playlist</span>
                  <div 
                    className={`w-12 h-7 rounded-full transition-colors relative ${isPublic ? 'bg-primary' : 'bg-white/20'}`}
                  >
                    <motion.div 
                      className="absolute top-1 w-5 h-5 rounded-full bg-white shadow-md"
                      animate={{ left: isPublic ? 26 : 4 }}
                      transition={iosBounce}
                    />
                  </div>
                </motion.button>
              </div>

              {/* Footer */}
              <div className="p-5 pt-0">
                <motion.button
                  onClick={handleCreate}
                  disabled={loading || !title.trim()}
                  className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={iosBounce}
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    'Create Playlist'
                  )}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
});

CreatePlaylistModal.displayName = 'CreatePlaylistModal';

export default CreatePlaylistModal;
