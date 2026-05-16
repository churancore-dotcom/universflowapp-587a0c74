import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayer, type Song } from '@/contexts/PlayerContext';
import { playerProgressStore } from '@/lib/playerProgressStore';
import { toast } from 'sonner';
import { triggerHaptic } from '@/hooks/useHaptics';

type RoomRole = 'host' | 'guest';

interface SessionSongPayload {
  id: string;
  title: string;
  artist: string;
  cover_url?: string;
  audio_url: string;
  duration?: number;
  source?: string;
}

interface PlaybackStatePayload {
  song: SessionSongPayload | null;
  isPlaying: boolean;
  playbackPosition: number;
  syncedAt: number;
}

export interface MateParticipant {
  userId: string;
  username: string;
  avatarUrl?: string;
  isHost: boolean;
}

export interface MateReaction {
  id: string;
  userId: string;
  username: string;
  emoji: string;
  createdAt: number;
}

export interface MateSuggestion {
  id: string;
  userId: string;
  username: string;
  title: string;
  artist: string;
  cover_url?: string;
  audio_url?: string;
  source?: string;
  createdAt: number;
}

interface ActiveRoom {
  sessionId: string;
  sessionCode: string;
  role: RoomRole;
  hostUserId: string;
}

interface PlayWithMateContextValue {
  isConnected: boolean;
  loading: boolean;
  room: ActiveRoom | null;
  participants: MateParticipant[];
  reactions: MateReaction[];
  suggestions: MateSuggestion[];
  isMinimized: boolean;
  setMinimized: (minimized: boolean) => void;
  createSession: () => Promise<void>;
  joinSession: (code: string) => Promise<void>;
  leaveSession: () => Promise<void>;
  sendReaction: (emoji: string) => Promise<void>;
  suggestTrack: (track: { title: string; artist: string; cover_url?: string; audio_url?: string; source?: string }) => Promise<void>;
  acceptSuggestion: (suggestionId: string) => Promise<void>;
  dismissSuggestion: (suggestionId: string) => void;
  kickParticipant: (userId: string) => Promise<void>;
  inviteUrl: string | null;
}

const PlayWithMateContext = createContext<PlayWithMateContextValue | undefined>(undefined);

const STORAGE_KEY = 'uf_mate_room';

const generateCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i += 1) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
};

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
    source: typeof record.source === 'string' ? record.source : undefined,
  };
};

const readStoredRoom = (): ActiveRoom | null => {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveRoom;
    if (!parsed?.sessionId || !parsed?.sessionCode || !parsed?.role || !parsed?.hostUserId) return null;
    return parsed;
  } catch {
    return null;
  }
};

const writeStoredRoom = (room: ActiveRoom | null) => {
  if (room) {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(room));
    return;
  }

  window.sessionStorage.removeItem(STORAGE_KEY);
};

export const PlayWithMateProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const { currentSong, isPlaying, audioElement, playSong, play, pause, seek } = usePlayer();

  const [room, setRoom] = useState<ActiveRoom | null>(readStoredRoom());
  const [participants, setParticipants] = useState<MateParticipant[]>([]);
  const [reactions, setReactions] = useState<MateReaction[]>([]);
  const [suggestions, setSuggestions] = useState<MateSuggestion[]>([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<{ username: string; avatarUrl?: string } | null>(null);

  const channelRef = useRef<any>(null);
  const broadcastIntervalRef = useRef<number | null>(null);
  const persistIntervalRef = useRef<number | null>(null);
  const restoringRef = useRef(false);
  const applyingRemoteStateRef = useRef(false);
  const progressRef = { get current() { return playerProgressStore.getProgress(); } } as { current: number };

  const clearRealtime = useCallback(() => {
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

    setParticipants([]);
  }, []);

  const clearRoomState = useCallback(() => {
    setRoom(null);
    setParticipants([]);
    setSuggestions([]);
    writeStoredRoom(null);
  }, []);

  useEffect(() => {
    if (!user) {
      clearRealtime();
      clearRoomState();
      restoringRef.current = false;
      setProfile(null);
      return;
    }

    let active = true;

    void (async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('username, avatar_url')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!active) return;
        setProfile({
          username: data?.username || user.email?.split('@')[0] || 'Listener',
          avatarUrl: data?.avatar_url || undefined,
        });
      } catch {
        if (!active) return;
        setProfile({ username: user.email?.split('@')[0] || 'Listener' });
      }
    })();

    return () => {
      active = false;
    };
  }, [clearRealtime, clearRoomState, user]);

  const buildSongPayload = useCallback((song: Song | null): SessionSongPayload | null => {
    if (!song?.audio_url) return null;
    return {
      id: song.id,
      title: song.title,
      artist: song.artist,
      cover_url: song.cover_url,
      audio_url: song.audio_url,
      duration: song.duration,
      source: (song as any).source,
    };
  }, []);

  const getPlaybackState = useCallback(
    (): PlaybackStatePayload => ({
      song: buildSongPayload(currentSong),
      isPlaying,
      playbackPosition: Math.max(audioElement?.currentTime ?? 0, progressRef.current),
      syncedAt: Date.now(),
    }),
    [audioElement, buildSongPayload, currentSong, isPlaying],
  );

  const applyRemoteState = useCallback(
    async (payload: PlaybackStatePayload | null | undefined) => {
      if (!payload?.song?.audio_url) return;

      const hostSource = payload.song.source;

      const remoteSong: Song = {
        id: payload.song.id,
        title: payload.song.title,
        artist: payload.song.artist,
        cover_url: payload.song.cover_url,
        audio_url: payload.song.audio_url,
        duration: payload.song.duration,
        source: (hostSource as any) || 'indexed',
      };

      const sameSong =
        currentSong?.id === remoteSong.id &&
        currentSong?.audio_url === remoteSong.audio_url;
      const remotePosition = Number(payload.playbackPosition) || 0;
      const localPosition = audioElement?.currentTime ?? playerProgressStore.getProgress();

      applyingRemoteStateRef.current = true;

      const clearFlag = () => {
        window.setTimeout(() => {
          applyingRemoteStateRef.current = false;
        }, 250);
      };

      try {
        if (!sameSong) {
          playSong(remoteSong, undefined, [remoteSong]);

          // Wait for the audio element to be ready before seeking/playing,
          // instead of a fixed 180ms timeout that races resolution.
          const audio = audioElement;
          const applyOnReady = () => {
            try {
              if (remotePosition > 0) seek(remotePosition);
              if (payload.isPlaying) play();
              else pause();
            } finally {
              clearFlag();
            }
          };

          if (audio) {
            // If already loaded enough, apply immediately
            if (audio.readyState >= 2) {
              applyOnReady();
            } else {
              const onReady = () => {
                audio.removeEventListener('canplay', onReady);
                audio.removeEventListener('loadedmetadata', onReady);
                applyOnReady();
              };
              audio.addEventListener('canplay', onReady, { once: true });
              audio.addEventListener('loadedmetadata', onReady, { once: true });
              // Safety timeout in case events never fire (resolve failure)
              window.setTimeout(() => {
                audio.removeEventListener('canplay', onReady);
                audio.removeEventListener('loadedmetadata', onReady);
                clearFlag();
              }, 8000);
            }
          } else {
            // No audio element yet — fall back to a short delay
            window.setTimeout(applyOnReady, 200);
          }
          return;
        }

        if (Math.abs(localPosition - remotePosition) > 0.9) {
          seek(remotePosition);
        }

        if (payload.isPlaying) play();
        else pause();
        clearFlag();
      } catch {
        clearFlag();
      }
    },
    [audioElement, currentSong?.audio_url, currentSong?.id, pause, play, playSong, seek],
  );

  const persistSessionState = useCallback(
    async (sessionId: string) => {
      const state = getPlaybackState();
      await supabase
        .from('listening_sessions')
        .update({
          current_song_data: state.song ?? {},
          is_playing: state.isPlaying,
          playback_position: state.playbackPosition,
        })
        .eq('id', sessionId);
    },
    [getPlaybackState],
  );

  const broadcastPlaybackState = useCallback(async () => {
    if (!channelRef.current) return;

    await channelRef.current.send({
      type: 'broadcast',
      event: 'playback-state',
      payload: getPlaybackState(),
    });
  }, [getPlaybackState]);

  const syncParticipants = useCallback((channel: any) => {
    const nextParticipants = Object.values(channel.presenceState())
      .flatMap((entries: any) => entries as any[])
      .map((entry: any) => ({
        userId: entry.userId,
        username: entry.username || 'Listener',
        avatarUrl: entry.avatarUrl,
        isHost: Boolean(entry.isHost),
      }))
      .filter((entry: MateParticipant) => Boolean(entry.userId))
      .sort((a: MateParticipant, b: MateParticipant) => Number(b.isHost) - Number(a.isHost) || a.username.localeCompare(b.username));

    setParticipants(nextParticipants);
  }, []);

  const subscribeToRoom = useCallback(
    (nextRoom: ActiveRoom) => {
      if (!user || !profile) return;

      clearRealtime();

      const channel = supabase
        .channel(`mate-room:${nextRoom.sessionId}`)
        .on('presence', { event: 'sync' }, () => syncParticipants(channel))
        .on('broadcast', { event: 'playback-state' }, ({ payload }) => {
          if (nextRoom.role === 'guest') {
            void applyRemoteState(payload as PlaybackStatePayload);
          }
        })
        .on('broadcast', { event: 'reaction' }, ({ payload }) => {
          const r = payload as MateReaction;
          if (!r?.emoji) return;
          setReactions((prev) => [...prev.slice(-19), r]);
          window.setTimeout(() => {
            setReactions((prev) => prev.filter((x) => x.id !== r.id));
          }, 3500);
        })
        .on('broadcast', { event: 'kick' }, ({ payload }) => {
          const targetId = (payload as { userId?: string })?.userId;
          if (targetId && targetId === user.id && nextRoom.role === 'guest') {
            toast.info('You were removed from the room');
            clearRealtime();
            clearRoomState();
          }
        })
        .on('broadcast', { event: 'suggestion' }, ({ payload }) => {
          const s = payload as MateSuggestion;
          if (!s?.title || !s?.artist) return;
          // Only host receives suggestions actively; guests can also see for context
          if (nextRoom.role === 'host' && s.userId !== user.id) {
            setSuggestions((prev) => {
              const next = [...prev.filter((x) => x.id !== s.id), s];
              return next.slice(-12);
            });
            toast.info(`💡 ${s.username} suggested "${s.title}"`);
            triggerHaptic('impactLight');
          }
        })
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'listening_sessions', filter: `id=eq.${nextRoom.sessionId}` },
          (payload) => {
            const updated = payload.new as Record<string, unknown>;
            if (!updated.is_active) {
              clearRealtime();
              clearRoomState();
              toast.info('Play with Mate room ended');
              return;
            }

            if (nextRoom.role === 'guest') {
              void applyRemoteState({
                song: parseSessionSong(updated.current_song_data),
                isPlaying: Boolean(updated.is_playing),
                playbackPosition: Number(updated.playback_position) || 0,
                syncedAt: Date.now(),
              });
            }
          },
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            channel.track({
              userId: user.id,
              username: profile.username,
              avatarUrl: profile.avatarUrl,
              isHost: nextRoom.role === 'host',
            });

            if (nextRoom.role === 'host') {
              void broadcastPlaybackState();
              void persistSessionState(nextRoom.sessionId);
            }
          }
        });

      channelRef.current = channel;
    },
    [applyRemoteState, broadcastPlaybackState, clearRealtime, clearRoomState, persistSessionState, profile, syncParticipants, user],
  );

  const restoreRoom = useCallback(
    async (storedRoom: ActiveRoom) => {
      if (!user) return;

      try {
        const { data: session } = await supabase
          .from('listening_sessions')
          .select('*')
          .eq('id', storedRoom.sessionId)
          .eq('is_active', true)
          .maybeSingle();

        if (!session || (storedRoom.role === 'host' && session.host_user_id !== user.id)) {
          clearRealtime();
          clearRoomState();
          return;
        }

        await supabase.from('listening_session_members').delete().eq('session_id', session.id).eq('user_id', user.id);
        await supabase.from('listening_session_members').insert({ session_id: session.id, user_id: user.id });

        const hydratedRoom: ActiveRoom = {
          sessionId: session.id,
          sessionCode: session.session_code,
          role: storedRoom.role,
          hostUserId: session.host_user_id,
        };

        setRoom(hydratedRoom);
        writeStoredRoom(hydratedRoom);
        subscribeToRoom(hydratedRoom);

        if (storedRoom.role === 'guest') {
          await applyRemoteState({
            song: parseSessionSong(session.current_song_data),
            isPlaying: Boolean(session.is_playing),
            playbackPosition: Number(session.playback_position) || 0,
            syncedAt: Date.now(),
          });
        }
      } catch {
        clearRealtime();
        clearRoomState();
      }
    },
    [applyRemoteState, clearRealtime, clearRoomState, subscribeToRoom, user],
  );

  useEffect(() => {
    if (!user || !profile || restoringRef.current || room) return;
    const storedRoom = readStoredRoom();
    if (!storedRoom) return;

    restoringRef.current = true;
    void restoreRoom(storedRoom).finally(() => {
      restoringRef.current = false;
    });
  }, [profile, restoreRoom, room, user]);

  useEffect(() => {
    if (room?.role !== 'host' || !room.sessionId || applyingRemoteStateRef.current) return;

    const syncTimer = window.setTimeout(() => {
      void broadcastPlaybackState();
      void persistSessionState(room.sessionId);
    }, 180);

    return () => window.clearTimeout(syncTimer);
  }, [broadcastPlaybackState, currentSong?.audio_url, currentSong?.id, isPlaying, persistSessionState, room?.role, room?.sessionId]);

  useEffect(() => {
    if (room?.role !== 'host' || !room.sessionId) return;

    broadcastIntervalRef.current = window.setInterval(() => {
      void broadcastPlaybackState();
    }, 2000);

    persistIntervalRef.current = window.setInterval(() => {
      void persistSessionState(room.sessionId);
    }, 10000);

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
  }, [broadcastPlaybackState, persistSessionState, room?.role, room?.sessionId]);

  useEffect(() => () => clearRealtime(), [clearRealtime]);

  const createSession = useCallback(async () => {
    if (!user) {
      toast.error('Sign in to start a room');
      return;
    }

    setLoading(true);
    try {
      // Make sure we have a profile (subscribeToRoom needs it). If not loaded yet,
      // build a minimal one from the auth user so the room can start immediately.
      if (!profile) {
        setProfile({
          username: user.email?.split('@')[0] || 'Listener',
        });
      }

      const sessionCode = generateCode();
      const state = getPlaybackState();

      const { data, error } = await supabase
        .from('listening_sessions')
        .insert({
          host_user_id: user.id,
          session_code: sessionCode,
          current_song_data: state.song ?? {},
          is_playing: state.isPlaying,
          playback_position: state.playbackPosition,
        })
        .select()
        .single();

      if (error) throw error;

      await supabase.from('listening_session_members').delete().eq('session_id', data.id).eq('user_id', user.id);
      await supabase.from('listening_session_members').insert({ session_id: data.id, user_id: user.id });

      const nextRoom: ActiveRoom = {
        sessionId: data.id,
        sessionCode: data.session_code,
        role: 'host',
        hostUserId: user.id,
      };

      setRoom(nextRoom);
      writeStoredRoom(nextRoom);
      // subscribe on next tick so the profile state has settled
      window.setTimeout(() => subscribeToRoom(nextRoom), 50);
      toast.success('Room is live — browse the app and keep everyone synced');
      triggerHaptic('success');
    } catch (e: any) {
      console.error('[PlayWithMate] createSession failed:', e);
      const msg = e?.message || e?.error_description || 'Could not start the room';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [getPlaybackState, profile, subscribeToRoom, user]);

  const joinSession = useCallback(
    async (code: string) => {
      if (!user) return;

      const sessionCode = code.trim().toUpperCase();
      if (sessionCode.length !== 6) return;

      setLoading(true);
      try {
        // Use SECURITY DEFINER RPC — bypasses RLS so guests (who aren't
        // members yet) can find & join the room by code in one shot.
        const { data: joinedId, error: joinErr } = await supabase
          .rpc('join_listening_session', { p_session_code: sessionCode });

        if (joinErr || !joinedId) {
          toast.error('That room code is not active');
          return;
        }

        // Now we're a member — RLS allows reading the session row.
        const { data: session, error } = await supabase
          .from('listening_sessions')
          .select('*')
          .eq('id', joinedId as string)
          .maybeSingle();

        if (error || !session) {
          toast.error('That room code is not active');
          return;
        }

        const nextRoom: ActiveRoom = {
          sessionId: session.id,
          sessionCode: session.session_code,
          role: 'guest',
          hostUserId: session.host_user_id,
        };

        setRoom(nextRoom);
        writeStoredRoom(nextRoom);
        subscribeToRoom(nextRoom);
        await applyRemoteState({
          song: parseSessionSong(session.current_song_data),
          isPlaying: Boolean(session.is_playing),
          playbackPosition: Number(session.playback_position) || 0,
          syncedAt: Date.now(),
        });
        toast.success('Joined the room — playback will stay synced automatically');
        triggerHaptic('success');
      } catch (e: any) {
        console.error('[PlayWithMate] joinSession failed:', e);
        const msg = e?.message || 'Could not join this room';
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    },
    [applyRemoteState, subscribeToRoom, user],
  );

  const leaveSession = useCallback(async () => {
    if (!room || !user) {
      clearRealtime();
      clearRoomState();
      return;
    }

    try {
      await supabase.from('listening_session_members').delete().eq('session_id', room.sessionId).eq('user_id', user.id);

      if (room.role === 'host') {
        await supabase.from('listening_sessions').update({ is_active: false }).eq('id', room.sessionId);
      }
    } finally {
      clearRealtime();
      clearRoomState();
      triggerHaptic('impactMedium');
    }
  }, [clearRealtime, clearRoomState, room, user]);

  const sendReaction = useCallback(async (emoji: string) => {
    if (!channelRef.current || !user || !profile || !emoji) return;
    const reaction: MateReaction = {
      id: `${user.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      userId: user.id,
      username: profile.username,
      emoji,
      createdAt: Date.now(),
    };
    try {
      await channelRef.current.send({ type: 'broadcast', event: 'reaction', payload: reaction });
      // Show locally too
      setReactions((prev) => [...prev.slice(-19), reaction]);
      window.setTimeout(() => setReactions((prev) => prev.filter((x) => x.id !== reaction.id)), 3500);
      triggerHaptic('impactLight');
    } catch {
      toast.error('Could not send reaction');
    }
  }, [profile, user]);

  const kickParticipant = useCallback(async (userId: string) => {
    if (!channelRef.current || !room || room.role !== 'host' || userId === user?.id) return;
    try {
      await channelRef.current.send({ type: 'broadcast', event: 'kick', payload: { userId } });
      await supabase.from('listening_session_members').delete().eq('session_id', room.sessionId).eq('user_id', userId);
      toast.success('Removed from room');
      triggerHaptic('warning');
    } catch {
      toast.error('Could not remove that listener');
    }
  }, [room, user?.id]);

  const suggestTrack = useCallback(
    async (track: { title: string; artist: string; cover_url?: string; audio_url?: string; source?: string }) => {
      if (!channelRef.current || !user || !profile || !room) {
        toast.error('Join a room first');
        return;
      }
      if (room.role === 'host') {
        toast.info('You are the host — just play it!');
        return;
      }
      if (!track.title || !track.artist) {
        toast.error('Pick a song first');
        return;
      }
      const suggestion: MateSuggestion = {
        id: `${user.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        userId: user.id,
        username: profile.username,
        title: track.title,
        artist: track.artist,
        cover_url: track.cover_url,
        audio_url: track.audio_url,
        source: track.source,
        createdAt: Date.now(),
      };
      try {
        await channelRef.current.send({ type: 'broadcast', event: 'suggestion', payload: suggestion });
        toast.success('Sent to host ✨');
        triggerHaptic('success');
      } catch {
        toast.error('Could not send suggestion');
      }
    },
    [profile, room, user],
  );

  const acceptSuggestion = useCallback(
    async (suggestionId: string) => {
      if (room?.role !== 'host') return;
      const s = suggestions.find((x) => x.id === suggestionId);
      if (!s) return;
      const song: Song = {
        id: s.audio_url ? `mate-sug-${suggestionId}` : `lfm-${s.artist}-${s.title}`.toLowerCase().replace(/\s+/g, '-'),
        title: s.title,
        artist: s.artist,
        cover_url: s.cover_url,
        audio_url: s.audio_url || '',
        source: (s.source as Song['source']) || 'indexed',
      };
      try {
        playSong(song, undefined, [song]);
        setSuggestions((prev) => prev.filter((x) => x.id !== suggestionId));
        toast.success(`Now playing ${s.username}'s pick`);
        triggerHaptic('success');
      } catch {
        toast.error('Could not play that suggestion');
      }
    },
    [playSong, room?.role, suggestions],
  );

  const dismissSuggestion = useCallback((suggestionId: string) => {
    setSuggestions((prev) => prev.filter((x) => x.id !== suggestionId));
  }, []);

  const setMinimized = useCallback((minimized: boolean) => setIsMinimized(minimized), []);

  // Quick-join deep link: ?join=CODE
  useEffect(() => {
    if (!user || !profile || room) return;
    try {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('join');
      if (code && code.length === 6) {
        params.delete('join');
        const newSearch = params.toString();
        const cleanUrl = `${window.location.pathname}${newSearch ? `?${newSearch}` : ''}${window.location.hash}`;
        window.history.replaceState({}, '', cleanUrl);
        void joinSession(code);
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile]);

  const inviteUrl = useMemo(() => {
    if (!room?.sessionCode) return null;
    try {
      // Always build invite links on the public domain so pasting elsewhere works.
      return `https://universflow.in/listen-together?join=${room.sessionCode}`;
    } catch {
      return null;
    }
  }, [room?.sessionCode]);

  const value = useMemo<PlayWithMateContextValue>(
    () => ({
      isConnected: Boolean(room),
      loading,
      room,
      participants,
      reactions,
      suggestions,
      isMinimized,
      setMinimized,
      createSession,
      joinSession,
      leaveSession,
      sendReaction,
      suggestTrack,
      acceptSuggestion,
      dismissSuggestion,
      kickParticipant,
      inviteUrl,
    }),
    [acceptSuggestion, createSession, dismissSuggestion, inviteUrl, isMinimized, joinSession, kickParticipant, leaveSession, loading, participants, reactions, room, sendReaction, setMinimized, suggestTrack, suggestions],
  );


  return <PlayWithMateContext.Provider value={value}>{children}</PlayWithMateContext.Provider>;
};

export const usePlayWithMate = () => {
  const context = useContext(PlayWithMateContext);
  if (!context) {
    throw new Error('usePlayWithMate must be used inside PlayWithMateProvider');
  }

  return context;
};