import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Heart, Copy, Users, Music, Loader2, X, Crown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayer, Song } from '@/contexts/PlayerContext';
import { usePremium } from '@/hooks/usePremium';
import BottomNav from '@/components/BottomNav';
import MiniPlayer from '@/components/MiniPlayer';
import FullscreenPlayer from '@/components/FullscreenPlayer';
import PageTransition from '@/components/PageTransition';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { triggerHaptic } from '@/hooks/useHaptics';

const generateCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
};

const PlayWithMate = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isPremium } = usePremium();
  const { currentSong, isPlaying, playSong, seek, togglePlay } = usePlayer();
  
  const [mode, setMode] = useState<'choose' | 'host' | 'join'>('choose');
  const [sessionCode, setSessionCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [memberCount, setMemberCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const channelRef = useRef<any>(null);

  // Premium gate
  if (!isPremium) {
    return (
      <PageTransition>
        <div className="h-[100dvh] bg-background flex flex-col overflow-hidden">
          <header className="flex-shrink-0 z-30 px-2 pt-3 pb-2 flex items-center safe-area-pt"
            style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)' }}>
            <button onClick={() => navigate(-1)} className="flex items-center gap-0.5 px-2 py-2 -ml-1 text-primary">
              <ChevronLeft className="w-5 h-5" /><span className="text-sm">Back</span>
            </button>
          </header>
          <main className="flex-1 flex items-center justify-center px-6">
            <div className="text-center">
              <div className="w-20 h-20 rounded-3xl mx-auto mb-4 flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, hsl(var(--primary)/0.2), hsl(280 100% 65%/0.2))' }}>
                <Crown className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-xl font-bold mb-2">Premium Feature</h2>
              <p className="text-muted-foreground text-sm mb-6">
                Play with Mate is exclusively available for Premium members. Upgrade to listen together with friends!
              </p>
              <Button onClick={() => navigate('/profile')} className="rounded-xl bg-primary text-primary-foreground">
                Upgrade to Premium
              </Button>
            </div>
          </main>
          <BottomNav />
        </div>
      </PageTransition>
    );
  }

  const createSession = async () => {
    if (!user) return;
    setLoading(true);
    const code = generateCode();
    
    try {
      const { data, error } = await supabase
        .from('listening_sessions')
        .insert({
          host_user_id: user.id,
          session_code: code,
          current_song_data: currentSong ? {
            id: currentSong.id,
            title: currentSong.title,
            artist: currentSong.artist,
            cover_url: currentSong.cover_url,
            audio_url: currentSong.audio_url,
            duration: currentSong.duration,
          } : {},
          is_playing: isPlaying,
          playback_position: 0,
        })
        .select()
        .single();

      if (error) throw error;

      // Join as member
      await supabase.from('listening_session_members').insert({
        session_id: data.id,
        user_id: user.id,
      });

      setSessionCode(code);
      setSessionId(data.id);
      setIsConnected(true);
      setMemberCount(1);
      setMode('host');
      
      // Subscribe to realtime
      subscribeToSession(data.id, true);
      
      toast.success('Session created! Share the code with your mate');
      triggerHaptic('notificationSuccess');
    } catch (err) {
      console.error('Failed to create session:', err);
      toast.error('Failed to create session');
    }
    setLoading(false);
  };

  const joinSession = async () => {
    if (!user || !joinCode.trim()) return;
    setLoading(true);

    try {
      const { data: session, error } = await supabase
        .from('listening_sessions')
        .select('*')
        .eq('session_code', joinCode.toUpperCase().trim())
        .eq('is_active', true)
        .maybeSingle();

      if (error || !session) {
        toast.error('Invalid or expired session code');
        setLoading(false);
        return;
      }

      // Join as member
      await supabase.from('listening_session_members').insert({
        session_id: session.id,
        user_id: user.id,
      });

      setSessionId(session.id);
      setSessionCode(session.session_code);
      setIsConnected(true);
      setMode('join');

      // Play the host's current song
      const songData = session.current_song_data as any;
      if (songData?.audio_url) {
        const song: Song = {
          id: songData.id || 'mate-song',
          title: songData.title || 'Unknown',
          artist: songData.artist || 'Unknown',
          cover_url: songData.cover_url,
          audio_url: songData.audio_url,
          duration: songData.duration,
        };
        playSong(song);
        if (session.playback_position > 0) {
          setTimeout(() => seek(Number(session.playback_position)), 500);
        }
      }

      subscribeToSession(session.id, false);
      toast.success('Connected! Listening together now ❤️');
      triggerHaptic('notificationSuccess');
    } catch (err) {
      console.error('Failed to join session:', err);
      toast.error('Failed to join session');
    }
    setLoading(false);
  };

  const subscribeToSession = (sid: string, isHost: boolean) => {
    const channel = supabase
      .channel(`session-${sid}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'listening_sessions',
        filter: `id=eq.${sid}`,
      }, (payload) => {
        const updated = payload.new as any;
        
        if (!isHost) {
          // Sync song
          const songData = updated.current_song_data as any;
          if (songData?.audio_url) {
            const song: Song = {
              id: songData.id || 'mate-song',
              title: songData.title || 'Unknown',
              artist: songData.artist || 'Unknown',
              cover_url: songData.cover_url,
              audio_url: songData.audio_url,
              duration: songData.duration,
            };
            playSong(song);
            if (updated.playback_position > 0) {
              setTimeout(() => seek(Number(updated.playback_position)), 300);
            }
          }
        }
      })
      .subscribe();

    channelRef.current = channel;
  };

  // Host: sync current song to session
  useEffect(() => {
    if (mode !== 'host' || !sessionId || !currentSong) return;

    const syncTimer = setTimeout(async () => {
      await supabase
        .from('listening_sessions')
        .update({
          current_song_data: {
            id: currentSong.id,
            title: currentSong.title,
            artist: currentSong.artist,
            cover_url: currentSong.cover_url,
            audio_url: currentSong.audio_url,
            duration: currentSong.duration,
          },
          is_playing: isPlaying,
        })
        .eq('id', sessionId);
    }, 300);

    return () => clearTimeout(syncTimer);
  }, [currentSong?.id, isPlaying, mode, sessionId]);

  const leaveSession = async () => {
    if (sessionId && user) {
      await supabase.from('listening_session_members').delete()
        .eq('session_id', sessionId).eq('user_id', user.id);
      
      if (mode === 'host') {
        await supabase.from('listening_sessions').update({ is_active: false }).eq('id', sessionId);
      }
    }
    
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }
    
    setIsConnected(false);
    setSessionId(null);
    setMode('choose');
    triggerHaptic('impactMedium');
  };

  useEffect(() => {
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, []);

  const copyCode = () => {
    navigator.clipboard.writeText(sessionCode);
    toast.success('Code copied!');
    triggerHaptic('impactLight');
  };

  return (
    <PageTransition>
      <div className="h-[100dvh] bg-background flex flex-col overflow-hidden">
        <header className="flex-shrink-0 z-30 px-2 pt-3 pb-2 flex items-center safe-area-pt"
          style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)' }}>
          <button onClick={() => isConnected ? leaveSession() : navigate(-1)} className="flex items-center gap-0.5 px-2 py-2 -ml-1 text-primary">
            <ChevronLeft className="w-5 h-5" />
            <span className="text-sm">{isConnected ? 'Leave' : 'Back'}</span>
          </button>
          <h1 className="text-sm font-semibold absolute left-1/2 -translate-x-1/2">Play with Mate ❤️</h1>
        </header>

        <main className="flex-1 overflow-y-auto px-4 pt-6 pb-32" style={{ WebkitOverflowScrolling: 'touch' }}>
          <AnimatePresence mode="wait">
            {!isConnected ? (
              <motion.div key="choose" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                {/* Create Session */}
                <motion.button
                  onClick={createSession}
                  disabled={loading}
                  className="w-full p-5 rounded-3xl mb-4 text-left"
                  style={{
                    background: 'linear-gradient(135deg, hsl(var(--primary)/0.15), hsl(280 100% 65%/0.1))',
                    border: '0.5px solid hsl(var(--primary)/0.2)',
                  }}
                  whileTap={{ scale: 0.97 }}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                      style={{ background: 'hsl(var(--primary)/0.2)' }}>
                      {loading ? <Loader2 className="w-6 h-6 text-primary animate-spin" /> : <Heart className="w-6 h-6 text-primary" />}
                    </div>
                    <div>
                      <p className="text-base font-bold text-foreground">Start a Session</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Get a secret code and share it</p>
                    </div>
                  </div>
                </motion.button>

                {/* Join Session */}
                <div className="p-5 rounded-3xl" style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '0.5px solid rgba(255,255,255,0.08)',
                }}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                      style={{ background: 'rgba(255,255,255,0.06)' }}>
                      <Users className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-base font-bold">Join a Session</p>
                      <p className="text-xs text-muted-foreground">Enter your mate's code</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      placeholder="Enter 6-digit code"
                      maxLength={6}
                      className="flex-1 h-12 text-center text-lg font-bold tracking-[0.3em] uppercase rounded-xl border-0"
                      style={{ background: 'rgba(255,255,255,0.06)' }}
                    />
                    <Button
                      onClick={joinSession}
                      disabled={joinCode.length < 6 || loading}
                      className="h-12 px-5 rounded-xl bg-primary text-primary-foreground"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Join'}
                    </Button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div key="connected" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                {/* Connected State */}
                <div className="text-center mb-6">
                  <motion.div
                    className="w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, hsl(var(--primary)/0.3), hsl(280 100% 65%/0.2))' }}
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Heart className="w-12 h-12 text-primary" fill="currentColor" />
                  </motion.div>
                  <h2 className="text-xl font-bold mb-1">Listening Together</h2>
                  <p className="text-muted-foreground text-sm">
                    {mode === 'host' ? 'You control the music' : 'Synced with your mate'}
                  </p>
                </div>

                {/* Session Code */}
                <motion.button
                  onClick={copyCode}
                  className="w-full p-4 rounded-2xl mb-4 flex items-center justify-between"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)' }}
                  whileTap={{ scale: 0.97 }}
                >
                  <div>
                    <p className="text-xs text-muted-foreground">Session Code</p>
                    <p className="text-2xl font-bold tracking-[0.2em] text-primary">{sessionCode}</p>
                  </div>
                  <Copy className="w-5 h-5 text-muted-foreground" />
                </motion.button>

                {/* Now Playing */}
                {currentSong && (
                  <div className="p-4 rounded-2xl flex items-center gap-3" style={{
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))',
                    border: '0.5px solid rgba(255,255,255,0.08)',
                  }}>
                    <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0">
                      {currentSong.cover_url ? (
                        <img src={currentSong.cover_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-primary/20 flex items-center justify-center">
                          <Music className="w-6 h-6 text-primary" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{currentSong.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{currentSong.artist}</p>
                    </div>
                    <div className="flex items-end gap-[2px] h-4">
                      {[0, 1, 2, 3].map(i => (
                        <div key={i} className="w-[3px] bg-primary rounded-full animate-audio-wave"
                          style={{ animationDelay: `${i * 0.12}s` }} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Leave Button */}
                <Button onClick={leaveSession} variant="destructive" className="w-full mt-6 rounded-xl h-12">
                  <X className="w-4 h-4 mr-2" /> End Session
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
