import { useState, useEffect, memo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MessageCircle, Send, X, Smile } from 'lucide-react';
import { iosSpring } from '@/lib/animations';
import { toast } from 'sonner';

interface SongReactionsProps {
  songId: string;
  songTitle: string;
}

interface Reaction {
  emoji: string;
  count: number;
  hasReacted: boolean;
}

interface Comment {
  id: string;
  user_email: string;
  content: string;
  created_at: string;
}

const EMOJI_OPTIONS = ['❤️', '🔥', '😍', '🎵', '💯', '🙌', '✨', '🎶'];

const SongReactions = memo(({ songId, songTitle }: SongReactionsProps) => {
  const { user } = useAuth();
  const [reactions, setReactions] = useState<Record<string, Reaction>>({});
  const [comments, setComments] = useState<Comment[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const fetchReactionsAndComments = useCallback(async () => {
    if (!songId) return;

    try {
      // Fetch reactions
      const { data: reactionsData } = await supabase
        .from('song_reactions')
        .select('emoji, user_id')
        .eq('song_id', songId);

      if (reactionsData) {
        const reactionMap: Record<string, Reaction> = {};
        EMOJI_OPTIONS.forEach(emoji => {
          const emojiReactions = reactionsData.filter(r => r.emoji === emoji);
          reactionMap[emoji] = {
            emoji,
            count: emojiReactions.length,
            hasReacted: emojiReactions.some(r => r.user_id === user?.id),
          };
        });
        setReactions(reactionMap);
      }

      // Fetch comments
      const { data: commentsData } = await supabase
        .from('song_comments')
        .select('id, user_email, content, created_at')
        .eq('song_id', songId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (commentsData) {
        setComments(commentsData);
      }
    } catch (error) {
      console.error('Failed to fetch reactions:', error);
    }
  }, [songId, user?.id]);

  useEffect(() => {
    fetchReactionsAndComments();

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`song-reactions-${songId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'song_reactions', filter: `song_id=eq.${songId}` }, fetchReactionsAndComments)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'song_comments', filter: `song_id=eq.${songId}` }, fetchReactionsAndComments)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [songId, fetchReactionsAndComments]);

  const handleReaction = async (emoji: string) => {
    if (!user) {
      toast.error('Please sign in to react');
      return;
    }

    try {
      const reaction = reactions[emoji];
      
      if (reaction?.hasReacted) {
        // Remove reaction
        await supabase
          .from('song_reactions')
          .delete()
          .eq('song_id', songId)
          .eq('user_id', user.id)
          .eq('emoji', emoji);
      } else {
        // Add reaction
        await supabase
          .from('song_reactions')
          .insert({
            song_id: songId,
            user_id: user.id,
            emoji,
          });
      }
      
      fetchReactionsAndComments();
    } catch (error) {
      console.error('Failed to toggle reaction:', error);
      toast.error('Failed to react');
    }
  };

  const handleSubmitComment = async () => {
    if (!user || !newComment.trim()) return;

    setIsLoading(true);
    try {
      await supabase
        .from('song_comments')
        .insert({
          song_id: songId,
          user_id: user.id,
          user_email: user.email || 'Anonymous',
          content: newComment.trim(),
        });

      setNewComment('');
      toast.success('Comment added!');
      fetchReactionsAndComments();
    } catch (error) {
      console.error('Failed to add comment:', error);
      toast.error('Failed to add comment');
    } finally {
      setIsLoading(false);
    }
  };

  const activeReactions = Object.values(reactions).filter(r => r.count > 0);

  return (
    <div className="space-y-3">
      {/* Quick reactions */}
      <div className="flex items-center gap-1 flex-wrap">
        {activeReactions.length > 0 ? (
          activeReactions.map((reaction) => (
            <motion.button
              key={reaction.emoji}
              onClick={() => handleReaction(reaction.emoji)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-sm transition-all ${
                reaction.hasReacted
                  ? 'bg-primary/20 border border-primary/40'
                  : 'glass'
              }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={iosSpring}
            >
              <span>{reaction.emoji}</span>
              <span className="text-xs text-muted-foreground">{reaction.count}</span>
            </motion.button>
          ))
        ) : null}

        {/* Add reaction button */}
        <motion.button
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className="w-8 h-8 rounded-full flex items-center justify-center glass"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          transition={iosSpring}
        >
          <Smile className="w-4 h-4 text-muted-foreground" />
        </motion.button>

        {/* Comments toggle */}
        <motion.button
          onClick={() => setShowComments(!showComments)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all ${
            showComments ? 'bg-primary/20 border border-primary/40' : 'glass'
          }`}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          transition={iosSpring}
        >
          <MessageCircle className="w-4 h-4" />
          {comments.length > 0 && (
            <span className="text-xs">{comments.length}</span>
          )}
        </motion.button>
      </div>

      {/* Emoji picker */}
      <AnimatePresence>
        {showEmojiPicker && (
          <motion.div
            className="flex gap-2 p-3 rounded-2xl glass"
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={iosSpring}
          >
            {EMOJI_OPTIONS.map((emoji) => (
              <motion.button
                key={emoji}
                onClick={() => {
                  handleReaction(emoji);
                  setShowEmojiPicker(false);
                }}
                className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all ${
                  reactions[emoji]?.hasReacted ? 'bg-primary/30' : 'hover:bg-white/10'
                }`}
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.9 }}
              >
                {emoji}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Comments section */}
      <AnimatePresence>
        {showComments && (
          <motion.div
            className="rounded-2xl overflow-hidden"
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
            }}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={iosSpring}
          >
            {/* Comment input */}
            <div className="p-3 border-b border-white/5">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder={`Comment on "${songTitle}"...`}
                  className="flex-1 bg-white/5 rounded-xl px-4 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmitComment()}
                />
                <motion.button
                  onClick={handleSubmitComment}
                  disabled={!newComment.trim() || isLoading}
                  className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary disabled:opacity-50"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Send className="w-4 h-4 text-white" />
                </motion.button>
              </div>
            </div>

            {/* Comments list */}
            <div className="max-h-64 overflow-y-auto">
              {comments.length === 0 ? (
                <p className="text-center text-muted-foreground/50 text-sm py-8">
                  No comments yet. Be the first!
                </p>
              ) : (
                comments.map((comment) => (
                  <motion.div
                    key={comment.id}
                    className="p-3 border-b border-white/5 last:border-0"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-primary">
                        {comment.user_email.split('@')[0]}
                      </span>
                      <span className="text-[10px] text-muted-foreground/50">
                        {new Date(comment.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{comment.content}</p>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

SongReactions.displayName = 'SongReactions';

export default SongReactions;
