import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, Info, CheckCircle2, AlertTriangle, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { triggerHaptic } from '@/hooks/useHaptics';

interface Announcement {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning';
  target_audience: 'all' | 'premium' | 'free';
  created_at: string;
}

const STORAGE_KEY = 'uf_seen_announcements_v1';

const getSeen = (): Set<string> => {
  try { return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')); } catch { return new Set(); }
};
const saveSeen = (set: Set<string>) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...set])); } catch { /* ignore */ }
};

const typeIcon = (t: string) => t === 'success' ? CheckCircle2 : t === 'warning' ? AlertTriangle : Info;
const typeColor = (t: string) => t === 'success' ? 'hsl(145 80% 50%)' : t === 'warning' ? 'hsl(40 100% 55%)' : 'hsl(var(--primary))';

const timeAgo = (iso: string) => {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const AnnouncementBell = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<Announcement[]>([]);
  const [open, setOpen] = useState(false);
  const [openedIds, setOpenedIds] = useState<Set<string>>(new Set());
  const seenRef = useRef<Set<string>>(getSeen());

  const recordEvent = useCallback(async (announcementId: string, eventType: 'delivered' | 'opened' | 'clicked') => {
    if (!user) return;
    try {
      // ON CONFLICT DO NOTHING via upsert with ignoreDuplicates
      await supabase.from('announcement_events').insert({
        announcement_id: announcementId,
        user_id: user.id,
        event_type: eventType,
      });
    } catch { /* unique violation = already recorded, fine */ }
  }, [user]);

  const fetchAnnouncements = useCallback(async () => {
    if (!user) { setItems([]); return; }
    // Determine audience
    const { data: sub } = await supabase
      .from('user_subscriptions')
      .select('subscription_type, status, expires_at')
      .eq('user_id', user.id)
      .maybeSingle();
    const isPremium = sub && sub.status === 'active' &&
      sub.subscription_type !== 'free' &&
      (!sub.expires_at || new Date(sub.expires_at) > new Date());
    const audienceFilter = isPremium ? ['all', 'premium'] : ['all', 'free'];

    const nowIso = new Date().toISOString();
    const { data } = await supabase
      .from('announcements')
      .select('id, title, message, type, target_audience, created_at, is_active, starts_at, ends_at')
      .eq('is_active', true)
      .lte('starts_at', nowIso)
      .in('target_audience', audienceFilter)
      .order('created_at', { ascending: false })
      .limit(20);

    const filtered = (data || []).filter(a => !a.ends_at || new Date(a.ends_at) > new Date());
    setItems(filtered as Announcement[]);

    // Record delivered event for new ones
    for (const a of filtered) {
      if (!seenRef.current.has(a.id)) {
        await recordEvent(a.id, 'delivered');
        seenRef.current.add(a.id);
      }
    }
    saveSeen(seenRef.current);
  }, [user, recordEvent]);

  useEffect(() => {
    fetchAnnouncements();
    const ch = supabase
      .channel('user_announcements_feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, fetchAnnouncements)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchAnnouncements]);

  const unreadCount = items.filter(i => !openedIds.has(i.id)).length;

  const handleOpen = async () => {
    triggerHaptic('impactLight');
    setOpen(true);
    // Mark all as opened
    const next = new Set(openedIds);
    for (const a of items) {
      if (!next.has(a.id)) {
        next.add(a.id);
        await recordEvent(a.id, 'opened');
      }
    }
    setOpenedIds(next);
  };

  const handleClick = async (id: string) => {
    await recordEvent(id, 'clicked');
    triggerHaptic('impactLight');
  };

  if (!user) return null;

  return (
    <>
      <button
        onClick={handleOpen}
        className="relative w-9 h-9 rounded-full bg-muted/40 backdrop-blur-md flex items-center justify-center active:scale-95 transition-transform"
        aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[210] flex items-end"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(20px)' }}
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
                    <Bell className="w-5 h-5 text-primary" /> Notifications
                  </h3>
                  <p className="text-xs text-muted-foreground">{items.length} {items.length === 1 ? 'update' : 'updates'}</p>
                </div>
                <button onClick={() => setOpen(false)} className="w-9 h-9 rounded-full bg-muted/40 flex items-center justify-center">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
                {items.length === 0 ? (
                  <div className="text-center py-12">
                    <Bell className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">You're all caught up</p>
                  </div>
                ) : items.map((a) => {
                  const Icon = typeIcon(a.type);
                  const color = typeColor(a.type);
                  return (
                    <motion.button
                      key={a.id}
                      layout
                      onClick={() => handleClick(a.id)}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="w-full text-left rounded-2xl p-3.5 bg-muted/30 border border-border/40 active:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: `${color}20`, color }}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-0.5">
                            <p className="text-sm font-bold leading-tight">{a.title}</p>
                            <span className="text-[10px] text-muted-foreground flex-shrink-0 mt-0.5">{timeAgo(a.created_at)}</span>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">{a.message}</p>
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default AnnouncementBell;
