import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, Heart, Users, Copy, Share2, Music, Loader2, LogOut,
  Radio, Disc3, Sparkles, Minimize2, Link2, UserMinus, QrCode, Lightbulb, Check, X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageTransition from '@/components/PageTransition';
import BottomNav from '@/components/BottomNav';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { usePlayer } from '@/contexts/PlayerContext';
import { usePlayWithMate } from '@/contexts/PlayWithMateContext';
import { triggerHaptic } from '@/hooks/useHaptics';
import { toast } from 'sonner';
import { usePremium } from '@/hooks/usePremium';
import PremiumLockOverlay from '@/components/PremiumLockOverlay';
import SEOHead from '@/components/SEOHead';

const QUICK_REACTIONS = ['❤️', '🔥', '😂', '🎶', '🥹', '🙌'];

const PlayWithMate = () => {
  const navigate = useNavigate();
  const { currentSong } = usePlayer();
  const { isPremium, isLoading: premiumLoading } = usePremium();
  const {
    isConnected, loading, room, participants, reactions, inviteUrl, suggestions,
    createSession, joinSession, leaveSession, sendReaction, kickParticipant,
    suggestTrack, acceptSuggestion, dismissSuggestion,
  } = usePlayWithMate();
  const [joinCode, setJoinCode] = useState('');

  const hostLabel = useMemo(
    () => participants.find((p) => p.isHost)?.username || 'Host',
    [participants],
  );
  const isHost = room?.role === 'host';

  const copy = async (text: string, label = 'Copied') => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(label);
      triggerHaptic('selection');
    } catch {
      toast.error('Could not copy');
    }
  };

  const handleShare = async () => {
    if (!inviteUrl || !room?.sessionCode) return;
    const text = `🎶 Listen with me on Univers Flow!\nCode: ${room.sessionCode}\n${inviteUrl}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Play with Mate ❤️', text, url: inviteUrl });
      } else {
        await navigator.clipboard.writeText(text);
        toast.success('Invite copied');
      }
    } catch {/* user cancelled */}
  };

  const qrUrl = inviteUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(inviteUrl)}`
    : null;

  if (premiumLoading) {
    return <PageTransition><div className="h-[100dvh] bg-background" /></PageTransition>;
  }

  if (!premiumLoading && !isPremium) {
    return (
      <PageTransition>
        <PremiumLockOverlay title="Play with Mate is Premium" onClose={() => navigate(-1)} />
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <SEOHead
        title="Listen Together — Univers Flow"
        description="Sync songs in real time with friends in a private Univers Flow listening room. Premium feature."
        keywords="listen together, sync music, Univers Flow rooms, listening party"
      />
      <div className="h-[100dvh] bg-background flex flex-col overflow-hidden">
        <header className="flex-shrink-0 z-30 px-2 pt-3 pb-2 flex items-center safe-area-pt bg-background/90 backdrop-blur-xl">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1 px-2 py-2 -ml-1 text-primary">
            <ChevronLeft className="w-5 h-5" />
            <span className="text-sm">Back</span>
          </button>
          <h1 className="text-sm font-semibold absolute left-1/2 -translate-x-1/2">Play with Mate ❤️</h1>
          {isConnected && (
            <button
              onClick={() => { triggerHaptic('selection'); navigate(-1); }}
              className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-full bg-primary/15 text-primary text-xs font-semibold"
              aria-label="Minimize room"
            >
              <Minimize2 className="w-3.5 h-3.5" />
              Minimize
            </button>
          )}
        </header>

        <main className="flex-1 overflow-y-auto px-4 pt-5 pb-32" style={{ WebkitOverflowScrolling: 'touch' }}>
          <AnimatePresence mode="wait">
            {!isConnected ? (
              <motion.div key="setup" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                <div className="rounded-3xl border border-border bg-card/70 p-5">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center">
                      {loading ? <Loader2 className="w-6 h-6 text-primary animate-spin" /> : <Heart className="w-6 h-6 text-primary" />}
                    </div>
                    <div>
                      <p className="text-base font-bold">Start a room</p>
                      <p className="text-xs text-muted-foreground">Create one code, keep browsing, and everyone stays synced.</p>
                    </div>
                  </div>
                  <Button onClick={() => void createSession()} disabled={loading} className="w-full mt-4 rounded-xl h-12">
                    Start Play with Mate
                  </Button>
                </div>

                <div className="rounded-3xl border border-border bg-card/70 p-5">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center">
                      <Users className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-base font-bold">Join a room</p>
                      <p className="text-xs text-muted-foreground">Paste the 6-letter code or open an invite link.</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      maxLength={6}
                      placeholder="ENTER CODE"
                      className="h-12 rounded-xl text-center text-lg font-bold tracking-[0.3em] uppercase"
                    />
                    <Button
                      onClick={() => void joinSession(joinCode)}
                      disabled={joinCode.trim().length !== 6 || loading}
                      className="h-12 rounded-xl px-5"
                    >
                      Join
                    </Button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div key="room" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                {/* Animated invite card */}
                <motion.div
                  layout
                  className="relative overflow-hidden rounded-3xl p-5 border border-primary/30"
                  style={{
                    background: 'linear-gradient(135deg, hsl(var(--primary) / 0.18), hsl(var(--primary) / 0.04) 60%, hsl(var(--card) / 0.7))',
                  }}
                >
                  <motion.div
                    className="absolute -top-12 -right-12 w-48 h-48 rounded-full"
                    style={{ background: 'hsl(var(--primary) / 0.25)', filter: 'blur(40px)' }}
                    animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0.9, 0.6] }}
                    transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                  />
                  <div className="relative flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-primary/80 font-semibold">Live invite</p>
                      <p className="text-4xl font-black tracking-[0.22em] text-primary mt-1">{room?.sessionCode}</p>
                      <p className="text-xs text-muted-foreground mt-2 truncate">{inviteUrl}</p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        <button
                          onClick={() => room?.sessionCode && void copy(room.sessionCode, 'Code copied')}
                          className="flex items-center gap-1.5 px-3 h-9 rounded-full bg-background/60 backdrop-blur text-xs font-semibold border border-border"
                        >
                          <Copy className="w-3.5 h-3.5" /> Code
                        </button>
                        <button
                          onClick={() => inviteUrl && void copy(inviteUrl, 'Link copied')}
                          className="flex items-center gap-1.5 px-3 h-9 rounded-full bg-background/60 backdrop-blur text-xs font-semibold border border-border"
                        >
                          <Link2 className="w-3.5 h-3.5" /> Link
                        </button>
                        <button
                          onClick={() => void handleShare()}
                          className="flex items-center gap-1.5 px-3 h-9 rounded-full bg-primary text-primary-foreground text-xs font-semibold"
                        >
                          <Share2 className="w-3.5 h-3.5" /> Share
                        </button>
                      </div>
                    </div>
                    {qrUrl && (
                      <div className="flex flex-col items-center gap-1 shrink-0">
                        <div className="w-20 h-20 rounded-xl bg-white p-1.5 flex items-center justify-center">
                          <img src={qrUrl} alt="Room QR code" className="w-full h-full object-contain" />
                        </div>
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <QrCode className="w-2.5 h-2.5" /> Scan
                        </span>
                      </div>
                    )}
                  </div>
                </motion.div>

                {/* Quick reactions */}
                <div className="rounded-3xl border border-border bg-card/70 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-bold">Quick reactions</p>
                    <Sparkles className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
                    {QUICK_REACTIONS.map((emoji) => (
                      <motion.button
                        key={emoji}
                        whileTap={{ scale: 0.85 }}
                        onClick={() => void sendReaction(emoji)}
                        className="shrink-0 w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center text-2xl active:bg-primary/20"
                      >
                        {emoji}
                      </motion.button>
                    ))}
                  </div>
                  <AnimatePresence>
                    {reactions.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground"
                      >
                        <span className="truncate">
                          {reactions[reactions.length - 1].username} reacted {reactions[reactions.length - 1].emoji}
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* How it works */}
                <div className="rounded-3xl border border-border bg-card/70 p-5">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
                      <Radio className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold">How this room works</p>
                      <div className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                        <div className="flex items-center gap-2"><Disc3 className="w-3 h-3 text-primary" /><span>Host plays anything from Home, Search, or Library.</span></div>
                        <div className="flex items-center gap-2"><Users className="w-3 h-3 text-primary" /><span>Everyone hears the same song in real time.</span></div>
                        <div className="flex items-center gap-2"><Heart className="w-3 h-3 text-primary" /><span>Tap the floating heart anywhere to come back.</span></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-secondary p-4">
                    <p className="text-xs text-muted-foreground">Live members</p>
                    <p className="text-2xl font-bold text-primary mt-1">{participants.length}</p>
                  </div>
                  <div className="rounded-2xl bg-secondary p-4">
                    <p className="text-xs text-muted-foreground">Room host</p>
                    <p className="text-sm font-semibold mt-2 truncate">{hostLabel}</p>
                  </div>
                </div>

                {/* Who joined + host controls */}
                <div className="rounded-3xl border border-border bg-card/70 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-bold">Who joined</p>
                      <p className="text-xs text-muted-foreground">Live presence stays active across the app.</p>
                    </div>
                    <Users className="w-4 h-4 text-primary" />
                  </div>
                  {participants.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-3">Waiting for friends to join…</p>
                  ) : (
                    <div className="space-y-3">
                      {participants.map((p) => (
                        <motion.div
                          key={p.userId}
                          layout
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -8 }}
                          className="flex items-center gap-3"
                        >
                          <div className="w-11 h-11 rounded-full overflow-hidden bg-primary/15 flex items-center justify-center shrink-0">
                            {p.avatarUrl ? (
                              <img src={p.avatarUrl} alt={p.username} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-sm font-bold text-primary">{p.username.slice(0, 1).toUpperCase()}</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{p.username}</p>
                            <p className="text-xs text-muted-foreground">{p.isHost ? 'Controls the room' : 'Listening live'}</p>
                          </div>
                          {p.isHost ? (
                            <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-primary/15 text-primary">HOST</span>
                          ) : isHost ? (
                            <button
                              onClick={() => void kickParticipant(p.userId)}
                              className="w-9 h-9 rounded-full bg-destructive/15 text-destructive flex items-center justify-center active:scale-95"
                              aria-label={`Remove ${p.username}`}
                            >
                              <UserMinus className="w-4 h-4" />
                            </button>
                          ) : null}
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Suggest a track (guests) */}
                {!isHost && (
                  <div className="rounded-3xl border border-primary/30 bg-card/70 p-5">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
                        <Lightbulb className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold">Suggest a track</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Tap to send the host whatever you're listening to right now.
                        </p>
                        <Button
                          disabled={!currentSong}
                          onClick={() => currentSong && void suggestTrack({
                            title: currentSong.title,
                            artist: currentSong.artist,
                            cover_url: currentSong.cover_url,
                            audio_url: currentSong.audio_url,
                            source: currentSong.source,
                          })}
                          className="mt-3 h-10 rounded-xl w-full"
                        >
                          <Sparkles className="w-4 h-4 mr-2" />
                          {currentSong ? `Suggest "${currentSong.title}"` : 'Play a song to suggest'}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Suggestion inbox (host only) */}
                {isHost && suggestions.length > 0 && (
                  <div className="rounded-3xl border border-primary/40 bg-card/70 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-sm font-bold flex items-center gap-2">
                          <Lightbulb className="w-4 h-4 text-primary" />
                          Guest suggestions
                        </p>
                        <p className="text-xs text-muted-foreground">Pick one to play instantly for everyone.</p>
                      </div>
                      <span className="px-2 py-1 rounded-full bg-primary/15 text-primary text-[10px] font-bold">
                        {suggestions.length}
                      </span>
                    </div>
                    <div className="space-y-2">
                      <AnimatePresence>
                        {suggestions.map((s) => (
                          <motion.div
                            key={s.id}
                            layout
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="flex items-center gap-3 p-2 rounded-2xl bg-background/40"
                          >
                            <div className="w-11 h-11 rounded-xl bg-secondary overflow-hidden flex items-center justify-center shrink-0">
                              {s.cover_url ? (
                                <img src={s.cover_url} alt={s.title} className="w-full h-full object-cover" />
                              ) : (
                                <Music className="w-4 h-4 text-primary" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold truncate">{s.title}</p>
                              <p className="text-[11px] text-muted-foreground truncate">
                                {s.artist} • from {s.username}
                              </p>
                            </div>
                            <button
                              onClick={() => void acceptSuggestion(s.id)}
                              className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center active:scale-95"
                              aria-label="Play suggestion"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => dismissSuggestion(s.id)}
                              className="w-9 h-9 rounded-full bg-secondary text-muted-foreground flex items-center justify-center active:scale-95"
                              aria-label="Dismiss"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>
                )}

                {/* Now playing */}
                <div className="rounded-3xl border border-border bg-card/70 p-5">
                  <p className="text-xs text-muted-foreground mb-2">Now shared in this room</p>
                  {currentSong ? (
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl overflow-hidden bg-secondary flex items-center justify-center shrink-0">
                        {currentSong.cover_url ? (
                          <img src={currentSong.cover_url} alt={currentSong.title} className="w-full h-full object-cover" />
                        ) : (
                          <Music className="w-6 h-6 text-primary" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold truncate">{currentSong.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{currentSong.artist}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Start any song anywhere in the app and the room will sync it.</p>
                  )}
                </div>

                <Button variant="destructive" onClick={() => void leaveSession()} className="w-full h-12 rounded-xl">
                  <LogOut className="w-4 h-4 mr-2" />
                  {isHost ? 'End Room' : 'Leave Room'}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <BottomNav />
      </div>
    </PageTransition>
  );
};

export default PlayWithMate;
