// Native music controls bridge for Capacitor (Android lockscreen + notification).
// On web (or when plugin missing), gracefully no-ops — Web Media Session in
// useMediaSession.ts handles browser/PWA controls.
//
// Plugin: capacitor-music-controls-plugin
// Docs: https://github.com/ionic-team/capacitor-community → music-controls
//
// IMPORTANT: This must be initialized BEFORE the audio starts so Android can
// keep the WebView alive in background.

import { Capacitor } from '@capacitor/core';

interface MusicControlsCreateOptions {
  track: string;
  artist: string;
  cover?: string;
  album?: string;
  duration?: number;
  isPlaying: boolean;
  // Show/hide buttons in the notification
  hasPrev?: boolean;
  hasNext?: boolean;
  hasClose?: boolean;
  // Android-specific
  dismissable?: boolean;
  hasScrubbing?: boolean;
  ticker?: string;
  notificationIcon?: string;
}

type ControlEvent =
  | { message: 'music-controls-play' }
  | { message: 'music-controls-pause' }
  | { message: 'music-controls-next' }
  | { message: 'music-controls-previous' }
  | { message: 'music-controls-destroy' }
  | { message: 'music-controls-toggle-play-pause' }
  | { message: 'music-controls-headset-unplugged' }
  | { message: 'music-controls-media-button-play-pause' };

let plugin: any = null;
let pluginInitTried = false;

function isNative() {
  try {
    return Capacitor.isNativePlatform?.() === true;
  } catch {
    return false;
  }
}

async function getPlugin() {
  if (!isNative()) return null;
  if (plugin || pluginInitTried) return plugin;
  pluginInitTried = true;
  try {
    // Lazy import — bundle plugin only on native runtime
    const mod = await import('capacitor-music-controls-plugin');
    plugin = (mod as any).CapacitorMusicControls || (mod as any).default || mod;
    return plugin;
  } catch (e) {
    console.warn('[MusicControls] Plugin not available:', e);
    return null;
  }
}

export interface NativeTrack {
  title: string;
  artist: string;
  cover?: string;
  album?: string;
  duration?: number;
}

let listenerAttached = false;
let currentHandlers: {
  onPlay?: () => void;
  onPause?: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  onStop?: () => void;
} = {};

export function setNativeMusicHandlers(h: typeof currentHandlers) {
  currentHandlers = h;
  attachListenerOnce();
}

async function attachListenerOnce() {
  if (listenerAttached || !isNative()) return;
  const p = await getPlugin();
  if (!p) return;
  try {
    // The plugin emits a 'controlsNotification' event with a message string.
    p.addListener?.('controlsNotification', (e: ControlEvent) => {
      switch (e.message) {
        case 'music-controls-play':
          currentHandlers.onPlay?.();
          break;
        case 'music-controls-pause':
          currentHandlers.onPause?.();
          break;
        case 'music-controls-toggle-play-pause':
        case 'music-controls-media-button-play-pause':
          // Toggle handled by handlers (PlayerContext exposes togglePlay)
          if (currentHandlers.onPlay && currentHandlers.onPause) {
            // We don't know current state here — rely on togglePlay route via onPlay
            currentHandlers.onPlay();
          }
          break;
        case 'music-controls-next':
          currentHandlers.onNext?.();
          break;
        case 'music-controls-previous':
          currentHandlers.onPrev?.();
          break;
        case 'music-controls-destroy':
        case 'music-controls-headset-unplugged':
          currentHandlers.onStop?.();
          break;
      }
    });
    listenerAttached = true;
  } catch (e) {
    console.warn('[MusicControls] Failed to attach listener:', e);
  }
}

export async function showNativeMusicControls(track: NativeTrack, isPlaying: boolean) {
  if (!isNative()) return;
  const p = await getPlugin();
  if (!p) return;
  const opts: MusicControlsCreateOptions = {
    track: track.title || 'Unknown',
    artist: track.artist || 'Unknown Artist',
    cover: track.cover,
    album: track.album,
    duration: track.duration,
    isPlaying,
    hasPrev: true,
    hasNext: true,
    hasClose: true,
    dismissable: false,
    hasScrubbing: false,
    ticker: `Now playing: ${track.title}`,
    notificationIcon: 'notification',
  };
  try {
    // Plugin requires destroy before re-create on Android
    await p.destroy?.().catch(() => {});
    await p.create?.(opts);
    attachListenerOnce();
  } catch (e) {
    console.warn('[MusicControls] create failed:', e);
  }
}

export async function updateNativeMusicState(isPlaying: boolean, position?: number) {
  if (!isNative()) return;
  const p = await getPlugin();
  if (!p) return;
  try {
    await p.updateIsPlaying?.({ isPlaying });
    if (typeof position === 'number') {
      await p.updateElapsed?.({ elapsed: Math.floor(position), isPlaying });
    }
  } catch {
    // Ignore — older plugin versions may not support all updates
  }
}

export async function destroyNativeMusicControls() {
  if (!isNative()) return;
  const p = await getPlugin();
  if (!p) return;
  try {
    await p.destroy?.();
  } catch {
    // Ignore
  }
}
