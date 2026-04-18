import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayer, type Song } from '@/contexts/PlayerContext';
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
  isMinimized: boolean;
  setMinimized: (minimized: boolean) => void;
  createSession: () => Promise<void>;
  joinSession: (code: string) => Promise<void>;
  leaveSession: () => Promise<void>;
  sendReaction: (emoji: string) => Promise<void>;
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
  const { currentSong, isPlaying, progress, audioElement, playSong, play, pause, seek } = usePlayer();

  const [room, setRoom] = useState<ActiveRoom | null>(readStoredRoom());
  const [participants, setParticipants] = useState<MateParticipant[]>([]);
  const [reactions, setReactions] = useState<MateReaction[]>([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<{ username: string; avatarUrl?: string } | null>(null);

  const channelRef = useRef<any>(null);
  const broadcastIntervalRef = useRef<number | null>(null);
  const persistIntervalRef = useRef<number | null>(null);
  const restoringRef = useRef(false);
  const applyingRemoteStateRef = useRef(false);

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
    };
  }, []);

  const getPlaybackState = useCallback(
    (): PlaybackStatePayload => ({
      song: buildSongPayload(currentSong),
      isPlaying,
      playbackPosition: Math.max(audioElement?.currentTime ?? 0, progress),
      syncedAt: Date.now(),
    }),
    [audioElement, buildSongPayload, currentSong, isPlaying, progress],
  );

  const applyRemoteState = useCallback(
    async (payload: PlaybackStatePayload | null | undefined) => {
      if (!payload?.song?.audio_url) return;

      const remoteSong: Song = {
        id: payload.song.id,
        title: payload.song.title,
        artist: payload.song.artist,
        cover_url: payload.song.cover_url,
        audio_url: payload.song.audio_url,
        duration: payload.song.duration,
        source: 'indexed',
      };

      const sameSong = currentSong?.id === remoteSong.id && currentSong?.audio_url === remoteSong.audio_url;
      const remotePosition = Number(payload.playbackPosition) || 0;
      const localPosition = audioElement?.currentTime ?? progress;

      applyingRemoteStateRef.current = true;

      try {
        if (!sameSong) {
          playSong(remoteSong, undefined, [remoteSong]);
          window.setTimeout(() => {
            if (remotePosition > 0) seek(remotePosition);
            if (payload.isPlaying) play();
            else pause();
          }, 180);
          return;
        }

        if (Math.abs(localPosition - remotePosition) > 0.9) {
          seek(remotePosition);
        }

        if (payload.isPlaying) play();
        else pause();
      } finally {
        window.setTimeout(() => {
          applyingRemoteStateRef.current = false;
        }, 250);
      }
    },
    [audioElement, currentSong?.audio_url, currentSong?.id, pause, play, playSong, progress, seek],
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
    }, 120);

    return () => window.clearTimeout(syncTimer);
  }, [broadcastPlaybackState, currentSong?.audio_url, currentSong?.id, isPlaying, persistSessionState, progress, room?.role, room?.sessionId]);

  useEffect(() => {
    if (room?.role !== 'host' || !room.sessionId) return;

    broadcastIntervalRef.current = window.setInterval(() => {
      void broadcastPlaybackState();
    }, 800);

    persistIntervalRef.current = window.setInterval(() => {
      void persistSessionState(room.sessionId);
    }, 2200);

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
    if (!user) return;

    setLoading(true);
    try {
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
      subscribeToRoom(nextRoom);
      toast.success('Room is live — browse the app and keep everyone synced');
      triggerHaptic('success');
    } catch {
      toast.error('Could not start the room');
    } finally {
      setLoading(false);
    }
  }, [getPlaybackState, subscribeToRoom, user]);

  const joinSession = useCallback(
    async (code: string) => {
      if (!user) return;

      const sessionCode = code.trim().toUpperCase();
      if (sessionCode.length !== 6) return;

      setLoading(true);
      try {
        const { data: session, error } = await supabase
          .from('listening_sessions')
          .select('*')
          .eq('session_code', sessionCode)
          .eq('is_active', true)
          .maybeSingle();

        if (error || !session) {
          toast.error('That room code is not active');
          return;
        }

        await supabase.from('listening_session_members').delete().eq('session_id', session.id).eq('user_id', user.id);
        await supabase.from('listening_session_members').insert({ session_id: session.id, user_id: user.id });

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
      } catch {
        toast.error('Could not join this room');
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
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://universflow.in';
      return `${origin}/listen-together?join=${room.sessionCode}`;
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
      isMinimized,
      setMinimized,
      createSession,
      joinSession,
      leaveSession,
      sendReaction,
      kickParticipant,
      inviteUrl,
    }),
    [createSession, inviteUrl, isMinimized, joinSession, kickParticipant, leaveSession, loading, participants, reactions, room, sendReaction, setMinimized],
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