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

interface SessionSongPayload {
  id: string;
  title: string;
  artist: string;
  cover_url?: string;
  audio_url: string;
  duration?: number;
}

interface PlaybackStatePayload {
  song: SessionSongPayload | null;
  isPlaying: boolean;
  playbackPosition: number;
  syncedAt: number;
}

const parseSessionSong = (value: unknown): SessionSongPayload | null => {
  if (!value || typeof value !== 'object') return null;

  const record = value as Record<string, unknown>;

  if (
    typeof record.id !== 'string' ||
    typeof record.title !== 'string' ||
    typeof record.artist !== 'string' ||
    typeof record.audio_url !== 'string'
  ) {
    return null;
  }

  return {
    id: record.id,
    title: record.title,
    artist: record.artist,
    audio_url: record.audio_url,
    cover_url: typeof record.cover_url === 'string' ? record.cover_url : undefined,
    duration: typeof record.duration === 'number' ? record.duration : undefined,
  };
};

const PlayWithMate = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isPremium } = usePremium();
  const { currentSong, isPlaying, progress, audioElement, playSong, play, pause, seek } = usePlayer();

  const [mode, setMode] = useState<'choose' | 'host' | 'join'>('choose');
  const [sessionCode, setSessionCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const channelRef = useRef<any>(null);
  const broadcastIntervalRef = useRef<number | null>(null);
  const persistIntervalRef = useRef<number | null>(null);
  const isApplyingRemoteStateRef = useRef(false);

  const buildSongPayload = useCallback((song: Song | null): SessionSongPayload | null => {
    if (!song?.audio_url) return null;

    return {
      id: song.id,
      title: song.title,
      artist: song.artist,
      cover_url: song.cover_url,
      audio_url: song.audio_url,
      duration: song.duration,
    };
  }, []);

  const getPlaybackState = useCallback((): PlaybackStatePayload => ({
    song: buildSongPayload(currentSong),
    isPlaying,
    playbackPosition: Math.max(audioElement?.currentTime ?? 0, progress),
    syncedAt: Date.now(),
  }), [audioElement, buildSongPayload, currentSong, isPlaying, progress]);

  const clearSessionSync = useCallback(() => {
    if (broadcastIntervalRef.current) {
      window.clearInterval(broadcastIntervalRef.current);
      broadcastIntervalRef.current = null;
    }

    if (persistIntervalRef.current) {
      window.clearInterval(persistIntervalRef.current);
      persistIntervalRef.current = null;
    }

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  const applyRemoteState = useCallback(async (payload: PlaybackStatePayload | null | undefined) => {
    if (!payload?.song?.audio_url) return;

    const remoteSong: Song = {
      id: payload.song.id || 'mate-song',
      title: payload.song.title || 'Unknown',
      artist: payload.song.artist || 'Unknown',
      cover_url: payload.song.cover_url,
      audio_url: payload.song.audio_url,
      duration: payload.song.duration,
    };

    const sameSong = currentSong?.id === remoteSong.id && currentSong?.audio_url === remoteSong.audio_url;
    const remotePosition = Number(payload.playbackPosition) || 0;
    const localPosition = audioElement?.currentTime ?? progress;

    isApplyingRemoteStateRef.current = true;

    try {
      if (!sameSong) {
        playSong(remoteSong, null, [remoteSong]);
        window.setTimeout(() => {
          if (remotePosition > 0) seek(remotePosition);
          if (payload.isPlaying) play();
          else pause();
        }, 250);
        return;
      }

      if (Math.abs(localPosition - remotePosition) > 1.2) {
        seek(remotePosition);
      }

      if (payload.isPlaying) play();
      else pause();
    } finally {
      window.setTimeout(() => {
        isApplyingRemoteStateRef.current = false;
      }, 300);
    }
  }, [audioElement, currentSong?.audio_url, currentSong?.id, pause, play, playSong, progress, seek]);

  const persistSessionState = useCallback(async (sid: string) => {
    const state = getPlaybackState();

    await supabase
      .from('listening_sessions')
      .update({
        current_song_data: state.song ?? {},
        is_playing: state.isPlaying,
        playback_position: state.playbackPosition,
      })
      .eq('id', sid);
  }, [getPlaybackState]);

  const broadcastPlaybackState = useCallback(async () => {
    if (!channelRef.current) return;

    const state = getPlaybackState();
    if (!state.song) return;

    await channelRef.current.send({
      type: 'broadcast',
      event: 'playback-state',
      payload: state,
    });
  }, [getPlaybackState]);

  useEffect(() => {
    if (mode !== 'host' || !sessionId || !isConnected || isApplyingRemoteStateRef.current) return;

    const syncTimer = window.setTimeout(() => {
      broadcastPlaybackState();
      persistSessionState(sessionId);
    }, 120);

    return () => window.clearTimeout(syncTimer);
  }, [broadcastPlaybackState, currentSong?.audio_url, currentSong?.id, isConnected, isPlaying, mode, persistSessionState, sessionId]);

  useEffect(() => {
    if (mode !== 'host' || !sessionId || !isConnected) return;

    broadcastIntervalRef.current = window.setInterval(() => {
      broadcastPlaybackState();
    }, 900);

    persistIntervalRef.current = window.setInterval(() => {
      persistSessionState(sessionId);
    }, 2500);

    return () => {
      if (broadcastIntervalRef.current) {
        window.clearInterval(broadcastIntervalRef.current);
        broadcastIntervalRef.current = null;
      }

      if (persistIntervalRef.current) {
        window.clearInterval(persistIntervalRef.current);
        persistIntervalRef.current = null;
      }
    };
  }, [broadcastPlaybackState, isConnected, mode, persistSessionState, sessionId]);

  useEffect(() => {
    return () => {
      clearSessionSync();
    };
  }, [clearSessionSync]);

  const subscribeToSession = useCallback((sid: string, isHost: boolean) => {
    clearSessionSync();

    const channel = supabase
      .channel(`session-${sid}`)
      .on('broadcast', {
        event: 'playback-state',
      }, ({ payload }) => {
        if (!isHost) {
          applyRemoteState(payload as PlaybackStatePayload);
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'listening_sessions',
        filter: `id=eq.${sid}`,
      }, (payload) => {
        const updated = payload.new as any;
        if (!updated.is_active && !isHost) {
          toast.info('Session ended');
          clearSessionSync();
          setIsConnected(false);
          setSessionId(null);
          setSessionCode('');
          setMode('choose');
          return;
        }

        if (!isHost) {
          applyRemoteState({
            song: parseSessionSong(updated.current_song_data),
            isPlaying: Boolean(updated.is_playing),
            playbackPosition: Number(updated.playback_position) || 0,
            syncedAt: Date.now(),
          });
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' && isHost) {
          broadcastPlaybackState();
        }
      });

    channelRef.current = channel;
  }, [applyRemoteState, broadcastPlaybackState, clearSessionSync]);

  const createSession = async () => {
    if (!user) return;
    setLoading(true);
    const code = generateCode();
    try {
      const { data, error } = await supabase.from('listening_sessions').insert({
        host_user_id: user.id, session_code: code,
        current_song_data: currentSong ? {
          id: currentSong.id, title: currentSong.title, artist: currentSong.artist,
          cover_url: currentSong.cover_url, audio_url: currentSong.audio_url, duration: currentSong.duration,
        } : {},
        is_playing: isPlaying, playback_position: 0,
      }).select().single();
      if (error) throw error;
      await supabase.from('listening_session_members').insert({ session_id: data.id, user_id: user.id });
      setSessionCode(code); setSessionId(data.id); setIsConnected(true); setMode('host');
      subscribeToSession(data.id, true);
      persistSessionState(data.id);
      toast.success('Session created! Share the code'); triggerHaptic('success');
    } catch { toast.error('Failed to create session'); }
    setLoading(false);
  };

  const joinSession = async () => {
    if (!user || !joinCode.trim()) return;
    setLoading(true);
    try {
      const { data: session, error } = await supabase.from('listening_sessions').select('*')
        .eq('session_code', joinCode.toUpperCase().trim()).eq('is_active', true).maybeSingle();
      if (error || !session) { toast.error('Invalid or expired code'); setLoading(false); return; }
      await supabase.from('listening_session_members').insert({ session_id: session.id, user_id: user.id });
      setSessionId(session.id); setSessionCode(session.session_code); setIsConnected(true); setMode('join');
      await applyRemoteState({
        song: parseSessionSong(session.current_song_data),
        isPlaying: Boolean(session.is_playing),
        playbackPosition: Number(session.playback_position) || 0,
        syncedAt: Date.now(),
      });
      subscribeToSession(session.id, false);
      toast.success('Connected! Listening together ❤️'); triggerHaptic('success');
    } catch { toast.error('Failed to join'); }
    setLoading(false);
  };

  const leaveSession = async () => {
    if (sessionId && user) {
      await supabase.from('listening_session_members').delete().eq('session_id', sessionId).eq('user_id', user.id);
      if (mode === 'host') await supabase.from('listening_sessions').update({ is_active: false }).eq('id', sessionId);
    }
    clearSessionSync();
    setIsConnected(false); setSessionId(null); setSessionCode(''); setJoinCode(''); setMode('choose'); triggerHaptic('impactMedium');
  };

  const copyCode = () => { navigator.clipboard.writeText(sessionCode); toast.success('Code copied!'); triggerHaptic('impactLight'); };

  // Premium gate (rendered after all hooks)
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
                <motion.button onClick={createSession} disabled={loading}
                  className="w-full p-5 rounded-3xl mb-4 text-left"
                  style={{ background: 'linear-gradient(135deg, hsl(var(--primary)/0.15), hsl(280 100% 65%/0.1))', border: '0.5px solid hsl(var(--primary)/0.2)' }}
                  whileTap={{ scale: 0.97 }}>
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'hsl(var(--primary)/0.2)' }}>
                      {loading ? <Loader2 className="w-6 h-6 text-primary animate-spin" /> : <Heart className="w-6 h-6 text-primary" />}
                    </div>
                    <div>
                      <p className="text-base font-bold text-foreground">Start a Session</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Get a secret code and share it</p>
                    </div>
                  </div>
                </motion.button>
                <div className="p-5 rounded-3xl" style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)' }}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.06)' }}>
                      <Users className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-base font-bold">Join a Session</p>
                      <p className="text-xs text-muted-foreground">Enter your mate's code</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      placeholder="Enter code" maxLength={6}
                      className="flex-1 h-12 text-center text-lg font-bold tracking-[0.3em] uppercase rounded-xl border-0"
                      style={{ background: 'rgba(255,255,255,0.06)' }} />
                    <Button onClick={joinSession} disabled={joinCode.length < 6 || loading}
                      className="h-12 px-5 rounded-xl bg-primary text-primary-foreground">
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Join'}
                    </Button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div key="connected" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                <div className="text-center mb-6">
                  <motion.div className="w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, hsl(var(--primary)/0.3), hsl(280 100% 65%/0.2))' }}
                    animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 2, repeat: Infinity }}>
                    <Heart className="w-12 h-12 text-primary" fill="currentColor" />
                  </motion.div>
                  <h2 className="text-xl font-bold mb-1">Listening Together</h2>
                  <p className="text-muted-foreground text-sm">{mode === 'host' ? 'You control the music' : 'Synced with your mate'}</p>
                </div>
                <motion.button onClick={copyCode} className="w-full p-4 rounded-2xl mb-4 flex items-center justify-between"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)' }} whileTap={{ scale: 0.97 }}>
                  <div>
                    <p className="text-xs text-muted-foreground">Session Code</p>
                    <p className="text-2xl font-bold tracking-[0.2em] text-primary">{sessionCode}</p>
                  </div>
                  <Copy className="w-5 h-5 text-muted-foreground" />
                </motion.button>
                {currentSong && (
                  <div className="p-4 rounded-2xl flex items-center gap-3" style={{
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))',
                    border: '0.5px solid rgba(255,255,255,0.08)',
                  }}>
                    <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0">
                      {currentSong.cover_url ? <img src={currentSong.cover_url} alt="" className="w-full h-full object-cover" /> :
                        <div className="w-full h-full bg-primary/20 flex items-center justify-center"><Music className="w-6 h-6 text-primary" /></div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{currentSong.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{currentSong.artist}</p>
                    </div>
                  </div>
                )}
                <Button onClick={leaveSession} variant="destructive" className="w-full mt-6 rounded-xl h-12">
                  <X className="w-4 h-4 mr-2" /> End Session
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
        <BottomNav /><MiniPlayer /><FullscreenPlayer />
      </div>
    </PageTransition>
  );
};

export default PlayWithMate;
