import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, X, MessageSquare, Loader2, ThumbsUp, ThumbsDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { triggerHaptic } from '@/hooks/useHaptics';
import { toast } from 'sonner';

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  display_name: string;
  created_at: string;
  user_id: string;
}

interface ReactionState {
  likes: number;
  dislikes: number;
  myReaction: 'like' | 'dislike' | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
};

const ReviewsSheet = ({ isOpen, onClose }: Props) => {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reactions, setReactions] = useState<Record<string, ReactionState>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const fetchAll = async () => {
    const { data: revs } = await supabase
      .from('app_reviews')
      .select('id, rating, comment, display_name, created_at, user_id')
      .order('created_at', { ascending: false })
      .limit(100);
    const list = (revs as Review[]) || [];
    setReviews(list);

    if (list.length) {
      const ids = list.map(r => r.id);
      const { data: reacts } = await supabase
        .from('review_reactions' as any)
        .select('review_id, user_id, reaction')
        .in('review_id', ids);

      const map: Record<string, ReactionState> = {};
      list.forEach(r => { map[r.id] = { likes: 0, dislikes: 0, myReaction: null }; });
      (reacts || []).forEach((rr: any) => {
        const m = map[rr.review_id];
        if (!m) return;
        if (rr.reaction === 'like') m.likes++;
        else if (rr.reaction === 'dislike') m.dislikes++;
        if (user && rr.user_id === user.id) m.myReaction = rr.reaction;
      });
      setReactions(map);
    } else {
      setReactions({});
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetchAll();

    // Realtime updates
    const channel = supabase
      .channel('reviews-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_reviews' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'review_reactions' }, fetchAll)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, user?.id]);

  const handleReact = async (reviewId: string, type: 'like' | 'dislike') => {
    if (!user) { toast.error('Sign in to react'); return; }
    if (busy) return;
    triggerHaptic('impactLight');
    setBusy(reviewId);

    const current = reactions[reviewId];
    const isSame = current?.myReaction === type;
    const next: ReactionState = { ...current };

    try {
      if (isSame) {
        // Toggle off
        await supabase.from('review_reactions' as any)
          .delete().eq('review_id', reviewId).eq('user_id', user.id);
        if (type === 'like') next.likes = Math.max(0, next.likes - 1);
        else next.dislikes = Math.max(0, next.dislikes - 1);
        next.myReaction = null;
      } else {
        // Switching or new
        await supabase.from('review_reactions' as any)
          .upsert({ review_id: reviewId, user_id: user.id, reaction: type }, { onConflict: 'review_id,user_id' });
        if (current?.myReaction === 'like') next.likes = Math.max(0, next.likes - 1);
        if (current?.myReaction === 'dislike') next.dislikes = Math.max(0, next.dislikes - 1);
        if (type === 'like') next.likes++;
        else next.dislikes++;
        next.myReaction = type;
      }
      setReactions(prev => ({ ...prev, [reviewId]: next }));
    } catch (e) {
      console.error(e);
      toast.error('Could not save reaction');
    } finally {
      setBusy(null);
    }
  };

  const avg = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : '—';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[210] flex items-end"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(16px)' }}
        >
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-h-[85vh] rounded-t-3xl bg-card border-t border-border/50 flex flex-col"
          >
            <div className="flex items-center justify-between p-4 border-b border-border/40">
              <div>
                <h3 className="text-lg font-extrabold flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-primary" /> Reviews
                </h3>
                <p className="text-xs text-muted-foreground">
                  ⭐ {avg} · {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'} · live
                </p>
              </div>
              <button onClick={onClose} className="w-9 h-9 rounded-full bg-muted/40 flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : reviews.length === 0 ? (
                <div className="text-center py-12 text-sm text-muted-foreground">
                  No reviews yet — be the first ❤️
                </div>
              ) : (
                reviews.map((r) => {
                  const rx = reactions[r.id] || { likes: 0, dislikes: 0, myReaction: null };
                  return (
                    <motion.div
                      key={r.id}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-2xl p-3 bg-muted/30 border border-border/40"
                    >
                      <div className="flex items-center gap-2.5 mb-2">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                          style={{ background: `linear-gradient(135deg, hsl(${r.display_name.length * 31 % 360} 70% 45%), hsl(${r.display_name.length * 67 % 360} 70% 35%))` }}
                        >
                          {r.display_name[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold truncate">{r.display_name}</p>
                            <span className="text-[10px] text-muted-foreground flex-shrink-0">{timeAgo(r.created_at)}</span>
                          </div>
                          <div className="flex items-center gap-0.5 mt-0.5">
                            {[1, 2, 3, 4, 5].map(n => (
                              <Star key={n} className={`w-3 h-3 ${r.rating >= n ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`} />
                            ))}
                          </div>
                        </div>
                      </div>
                      {r.comment && <p className="text-sm text-foreground/90 leading-relaxed mb-2.5">{r.comment}</p>}

                      {/* Reaction bar */}
                      <div className="flex items-center gap-2 pt-1.5 border-t border-border/30">
                        <button
                          onClick={() => handleReact(r.id, 'like')}
                          disabled={busy === r.id}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                            rx.myReaction === 'like'
                              ? 'bg-primary/15 text-primary'
                              : 'bg-muted/40 text-muted-foreground active:bg-muted/60'
                          }`}
                        >
                          <ThumbsUp className="w-3.5 h-3.5" fill={rx.myReaction === 'like' ? 'currentColor' : 'none'} />
                          <span>{rx.likes}</span>
                        </button>
                        <button
                          onClick={() => handleReact(r.id, 'dislike')}
                          disabled={busy === r.id}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                            rx.myReaction === 'dislike'
                              ? 'bg-destructive/15 text-destructive'
                              : 'bg-muted/40 text-muted-foreground active:bg-muted/60'
                          }`}
                        >
                          <ThumbsDown className="w-3.5 h-3.5" fill={rx.myReaction === 'dislike' ? 'currentColor' : 'none'} />
                          <span>{rx.dislikes}</span>
                        </button>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ReviewsSheet;
