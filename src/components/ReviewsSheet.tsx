import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, X, MessageSquare, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  display_name: string;
  created_at: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const ReviewsSheet = ({ isOpen, onClose }: Props) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from('app_reviews')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      setReviews(data || []);
      setLoading(false);
    })();
  }, [isOpen]);

  const avg = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : '—';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[210] flex items-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(16px)' }}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
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
                  ⭐ {avg} · {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}
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
                reviews.map((r) => (
                  <div key={r.id} className="rounded-2xl p-3 bg-muted/30 border border-border/40">
                    <div className="flex items-center gap-2.5 mb-2">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                        style={{ background: `linear-gradient(135deg, hsl(${r.display_name.length * 31 % 360} 70% 45%), hsl(${r.display_name.length * 67 % 360} 70% 35%))` }}
                      >
                        {r.display_name[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{r.display_name}</p>
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map(n => (
                            <Star key={n} className={`w-3 h-3 ${r.rating >= n ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`} />
                          ))}
                        </div>
                      </div>
                    </div>
                    {r.comment && <p className="text-sm text-foreground/90 leading-relaxed">{r.comment}</p>}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ReviewsSheet;
