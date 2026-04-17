import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Heart, Users, Copy, Share2, Crown, Music, Loader2, LogOut, Radio, Disc3, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageTransition from '@/components/PageTransition';
import BottomNav from '@/components/BottomNav';
import MiniPlayer from '@/components/MiniPlayer';
import FullscreenPlayer from '@/components/FullscreenPlayer';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { usePremium } from '@/hooks/usePremium';
import { usePlayer } from '@/contexts/PlayerContext';
import { usePlayWithMate } from '@/contexts/PlayWithMateContext';
import { toast } from 'sonner';

const PlayWithMate = () => {
  const navigate = useNavigate();
  const { isPremium } = usePremium();
  const { currentSong } = usePlayer();
  const { isConnected, loading, room, participants, createSession, joinSession, leaveSession } = usePlayWithMate();
  const [joinCode, setJoinCode] = useState('');

  const hostLabel = useMemo(() => participants.find((participant) => participant.isHost)?.username || 'Host', [participants]);

  const handleCopy = async () => {
    if (!room?.sessionCode) return;
    await navigator.clipboard.writeText(room.sessionCode);
    toast.success('Code copied');
  };

  const handleShare = async () => {
    if (!room?.sessionCode) return;
    const text = `Join my Play with Mate room on Univers Flow. Code: ${room.sessionCode}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Play with Mate ❤️', text });
      } else {
        await navigator.clipboard.writeText(text);
      }
      toast.success('Invite ready');
    } catch {
      toast.error('Could not share right now');
    }
  };

  if (!isPremium) {
    return (
      <PageTransition>
        <div className="h-[100dvh] bg-background flex flex-col overflow-hidden">
          <header className="flex-shrink-0 z-30 px-2 pt-3 pb-2 flex items-center safe-area-pt bg-background/90 backdrop-blur-xl">
            <button onClick={() => navigate(-1)} className="flex items-center gap-1 px-2 py-2 -ml-1 text-primary">
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm">Back</span>
            </button>
          </header>
          <main className="flex-1 flex items-center justify-center px-6">
            <div className="text-center">
              <div className="w-20 h-20 rounded-3xl mx-auto mb-4 flex items-center justify-center bg-primary/15">
                <Crown className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-xl font-bold mb-2">Premium Feature</h2>
              <p className="text-sm text-muted-foreground mb-6">Upgrade to host synced rooms and listen together anywhere.</p>
              <Button onClick={() => navigate('/profile')} className="rounded-xl">Upgrade to Premium</Button>
            </div>
          </main>
          <BottomNav />
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="h-[100dvh] bg-background flex flex-col overflow-hidden">
        <header className="flex-shrink-0 z-30 px-2 pt-3 pb-2 flex items-center safe-area-pt bg-background/90 backdrop-blur-xl">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1 px-2 py-2 -ml-1 text-primary">
            <ChevronLeft className="w-5 h-5" />
            <span className="text-sm">Back</span>
          </button>
          <h1 className="text-sm font-semibold absolute left-1/2 -translate-x-1/2">Play with Mate ❤️</h1>
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
                  <Button onClick={() => void createSession()} disabled={loading} className="w-full mt-4 rounded-xl h-12">Start Play with Mate</Button>
                </div>

                <div className="rounded-3xl border border-border bg-card/70 p-5">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center">
                      <Users className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-base font-bold">Join a room</p>
                      <p className="text-xs text-muted-foreground">Paste the 6-letter code and jump in instantly.</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} maxLength={6} placeholder="ENTER CODE" className="h-12 rounded-xl text-center text-lg font-bold tracking-[0.3em] uppercase" />
                    <Button onClick={() => void joinSession(joinCode)} disabled={joinCode.trim().length !== 6 || loading} className="h-12 rounded-xl px-5">Join</Button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div key="room" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                <div className="rounded-3xl border border-border bg-card/70 p-5">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center">
                      <Radio className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-base font-bold">How this room works</p>
                      <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-2"><Disc3 className="w-3.5 h-3.5 text-primary" /><span>The host can play songs from Home, Search, Library, or Artist pages.</span></div>
                        <div className="flex items-center gap-2"><Users className="w-3.5 h-3.5 text-primary" /><span>Everyone in the room hears the same song and sees who joined live.</span></div>
                        <div className="flex items-center gap-2"><Sparkles className="w-3.5 h-3.5 text-primary" /><span>You can leave this screen and the room stays active until the host ends it.</span></div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-border bg-card/70 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Room Code</p>
                      <p className="text-3xl font-bold tracking-[0.22em] text-primary">{room?.sessionCode}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => void handleCopy()} className="w-11 h-11 rounded-2xl bg-secondary flex items-center justify-center"><Copy className="w-4 h-4" /></button>
                      <button onClick={() => void handleShare()} className="w-11 h-11 rounded-2xl bg-secondary flex items-center justify-center"><Share2 className="w-4 h-4 text-primary" /></button>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-secondary p-4">
                      <p className="text-xs text-muted-foreground">Live members</p>
                      <p className="text-2xl font-bold text-primary mt-1">{participants.length}</p>
                    </div>
                    <div className="rounded-2xl bg-secondary p-4">
                      <p className="text-xs text-muted-foreground">Room host</p>
                      <p className="text-sm font-semibold mt-2 truncate">{hostLabel}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-border bg-card/70 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-bold">Who joined</p>
                      <p className="text-xs text-muted-foreground">Live presence stays active while you move around the app.</p>
                    </div>
                    <Users className="w-4 h-4 text-primary" />
                  </div>
                  <div className="space-y-3">
                    {participants.map((participant) => (
                      <div key={participant.userId} className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full overflow-hidden bg-primary/15 flex items-center justify-center">
                          {participant.avatarUrl ? (
                            <img src={participant.avatarUrl} alt={participant.username} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-sm font-bold text-primary">{participant.username.slice(0, 1).toUpperCase()}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{participant.username}</p>
                          <p className="text-xs text-muted-foreground">{participant.isHost ? 'Controls the room' : 'Listening live'}</p>
                        </div>
                        {participant.isHost && <span className="px-2 py-1 rounded-full text-[10px] font-semibold bg-primary/15 text-primary">HOST</span>}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-border bg-card/70 p-5">
                  <p className="text-xs text-muted-foreground mb-2">Now shared in this room</p>
                  {currentSong ? (
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl overflow-hidden bg-secondary flex items-center justify-center">
                        {currentSong.cover_url ? <img src={currentSong.cover_url} alt={currentSong.title} className="w-full h-full object-cover" /> : <Music className="w-6 h-6 text-primary" />}
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
                  {room?.role === 'host' ? 'End Room' : 'Leave Room'}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <BottomNav />
        <MiniPlayer />
        <FullscreenPlayer />
      </div>
    </PageTransition>
  );
};

export default PlayWithMate;