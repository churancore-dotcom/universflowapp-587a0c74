# UniversFlow - Complete Technical Specification for Full App Rebuild

**Version:** 3.0 - Comprehensive Edition  
**Last Updated:** February 2026  
**By:** SHASHANK YADAV  

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Complete Database Schema](#3-complete-database-schema)
4. [Authentication System](#4-authentication-system)
5. [Player Engine Architecture](#5-player-engine-architecture)
6. [Core Contexts & Providers](#6-core-contexts--providers)
7. [Component Specifications](#7-component-specifications)
8. [All Pages & Routes](#8-all-pages--routes)
9. [Admin Panel (29 Modules)](#9-admin-panel-29-modules)
10. [Custom Hooks](#10-custom-hooks)
11. [Edge Functions](#11-edge-functions)
12. [CSS Design System](#12-css-design-system)
13. [Animation System](#13-animation-system)
14. [Performance Optimizations](#14-performance-optimizations)
15. [Caching Strategy](#15-caching-strategy)
16. [Error Handling](#16-error-handling)
17. [Offline Architecture](#17-offline-architecture)
18. [PWA Configuration](#18-pwa-configuration)
19. [Capacitor Mobile Build](#19-capacitor-mobile-build)
20. [Android Widgets](#20-android-widgets)
21. [SEO & Meta Tags](#21-seo--meta-tags)
22. [File Structure](#22-file-structure)

---

## 1. Project Overview

**UniversFlow** is a premium mobile-first music streaming application with:
- Apple Music-inspired dark theme UI (pure black background, rose/red accent)
- Offline playback via IndexedDB with blob URL management
- Social features (dedications, friend referrals via share codes)
- Premium subscription via promo codes (lifetime premium grant)
- Admin panel with 29 modules for full content management
- YouTube audio extraction for admin uploads (Piped + Invidious proxies)
- Capacitor Android build with GitHub Actions CI/CD
- Android home screen widgets (Now Playing, Favorites, Recently Played, Quick Actions, Music Search)
- Lovable Cloud (Supabase) backend — permanently integrated, cannot be swapped

### Key Features
- Music streaming with crossfade transitions (configurable 1-12s)
- Smart shuffle (avoids repeating until all songs in queue exhausted)
- Download queue with progress tracking and batch operations
- Real-time song notifications via Supabase Realtime
- Haptic feedback (Median bridge for native, Web Vibration API fallback)
- Pre-roll audio ads for free users (every 3 songs, skippable after countdown)
- MediaSession API for lock screen controls (play/pause/next/prev/seek)
- Scroll-responsive navigation (BottomNav + MiniPlayer hide on scroll down, show on scroll up)
- Background audio resilience (visibilitychange + focus listeners to resume interrupted playback)
- Browser cache-busting meta tags to prevent stale deployments
- No React.StrictMode (prevents duplicate effects/race conditions)
- No PWA service worker (prevents auth fetch interception) — legacy SW unregistration in main.tsx
- WebView compatibility with polyfills and CSS fallbacks for older Android WebViews

---

## 2. Technology Stack

### Frontend
```json
{
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "react-router-dom": "^6.30.1",
  "typescript": "^5.x",
  "vite": "^5.x",
  "tailwindcss": "^3.x",
  "framer-motion": "^12.26.1",
  "@tanstack/react-query": "^5.83.0",
  "lucide-react": "^0.462.0",
  "sonner": "^1.7.4",
  "recharts": "^2.15.4",
  "vaul": "^0.9.9",
  "date-fns": "^3.6.0",
  "zod": "^3.25.76"
}
```

### Backend (Lovable Cloud / Supabase)
```json
{
  "@supabase/supabase-js": "^2.90.1",
  "supabase-edge-functions": "Deno runtime"
}
```

### Mobile
```json
{
  "@capacitor/core": "^8.0.1",
  "@capacitor/android": "^8.0.1",
  "@capacitor/cli": "^8.0.1",
  "median-js-bridge": "^2.12.0"
}
```

### UI Components (shadcn/ui + Radix)
```json
{
  "@radix-ui/react-dialog": "^1.1.14",
  "@radix-ui/react-slider": "^1.3.5",
  "@radix-ui/react-tabs": "^1.1.12",
  "@radix-ui/react-scroll-area": "^1.2.9",
  "@radix-ui/react-select": "^2.2.5",
  "@radix-ui/react-switch": "^1.2.5",
  "@radix-ui/react-dropdown-menu": "^2.1.15",
  "@radix-ui/react-accordion": "^1.2.11",
  "@radix-ui/react-alert-dialog": "^1.1.14",
  "@radix-ui/react-avatar": "^1.1.10",
  "@radix-ui/react-checkbox": "^1.3.2",
  "@radix-ui/react-popover": "^1.1.14",
  "@radix-ui/react-progress": "^1.1.7",
  "@radix-ui/react-toast": "^1.2.14",
  "@radix-ui/react-toggle": "^1.1.9",
  "@radix-ui/react-tooltip": "^1.2.7",
  "class-variance-authority": "^0.7.1",
  "tailwind-merge": "^2.6.0",
  "tailwindcss-animate": "^1.0.7"
}
```

---

## 3. Complete Database Schema

### Enums
```sql
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
CREATE TYPE public.subscription_platform AS ENUM ('android', 'ios', 'web', 'donation');
CREATE TYPE public.subscription_status AS ENUM ('active', 'expired', 'cancelled', 'pending');
CREATE TYPE public.subscription_type AS ENUM ('free', 'premium_monthly', 'premium_yearly');
```

### Core Tables

#### profiles
```sql
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  email TEXT,
  username TEXT,
  avatar_url TEXT,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  share_code TEXT UNIQUE,
  username_changed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view basic profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
```

#### songs
```sql
CREATE TABLE public.songs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  artist_id UUID REFERENCES public.artists(id),
  album TEXT,
  audio_url TEXT NOT NULL,
  cover_url TEXT,
  duration INTEGER DEFAULT 0,
  genre TEXT,
  mood TEXT,
  bpm INTEGER,
  bitrate INTEGER DEFAULT 0,
  file_size BIGINT DEFAULT 0,
  cover_size BIGINT DEFAULT 0,
  play_count INTEGER NOT NULL DEFAULT 0,
  download_count INTEGER DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  is_premium_only BOOLEAN NOT NULL DEFAULT false,
  show_in_new_releases BOOLEAN NOT NULL DEFAULT false,
  show_in_trending BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view visible songs" ON public.songs FOR SELECT USING (is_visible = true);
CREATE POLICY "Admins can do everything with songs" ON public.songs FOR ALL USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
```

#### artists
```sql
CREATE TABLE public.artists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  bio TEXT,
  photo_url TEXT,
  genre TEXT,
  is_premium_only BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### albums
```sql
CREATE TABLE public.albums (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  cover_url TEXT,
  release_year INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### user_subscriptions
```sql
CREATE TABLE public.user_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subscription_type subscription_type NOT NULL DEFAULT 'free',
  status subscription_status NOT NULL DEFAULT 'active',
  platform subscription_platform NOT NULL DEFAULT 'web',
  expires_at TIMESTAMPTZ,
  transaction_id TEXT,
  purchase_token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### user_roles
```sql
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
```

#### promo_codes & code_redemptions
```sql
CREATE TABLE public.promo_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  max_uses INTEGER DEFAULT 1,
  current_uses INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.code_redemptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  promo_code_id UUID NOT NULL REFERENCES public.promo_codes(id),
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### playlists & playlist_songs
```sql
CREATE TABLE public.playlists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  is_public BOOLEAN NOT NULL DEFAULT true,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.playlist_songs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  playlist_id UUID NOT NULL REFERENCES public.playlists(id),
  song_id UUID NOT NULL REFERENCES public.songs(id),
  position INTEGER NOT NULL DEFAULT 0,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### user_library (liked songs)
```sql
CREATE TABLE public.user_library (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  song_id UUID NOT NULL REFERENCES public.songs(id),
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, song_id)
);
```

#### recently_played
```sql
CREATE TABLE public.recently_played (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  song_id UUID NOT NULL REFERENCES public.songs(id),
  played_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### friends
```sql
CREATE TABLE public.friends (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  friend_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### song_dedications
```sql
CREATE TABLE public.song_dedications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL,
  recipient_id UUID NOT NULL,
  song_id UUID NOT NULL,
  message TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### song_reactions
```sql
CREATE TABLE public.song_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  song_id UUID NOT NULL REFERENCES public.songs(id),
  user_id UUID NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(song_id, user_id, emoji)
);
```

#### song_comments
```sql
CREATE TABLE public.song_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  song_id UUID NOT NULL REFERENCES public.songs(id),
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### content_reports
```sql
CREATE TABLE public.content_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID NOT NULL,
  content_id TEXT NOT NULL,
  content_type TEXT NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  action_taken TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### donations
```sql
CREATE TABLE public.donations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  email TEXT,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  platform TEXT NOT NULL,
  message TEXT,
  is_anonymous BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### announcements
```sql
CREATE TABLE public.announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  target_audience TEXT NOT NULL DEFAULT 'all',
  is_active BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### app_settings
```sql
CREATE TABLE public.app_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Database Functions

```sql
-- Auto-create profile + admin role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, is_admin)
  VALUES (NEW.id, NEW.email, false);
  
  IF NEW.email = 'shashankyadavk12@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Check admin role via user_roles table (not profiles.is_admin)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Atomic promo code redemption with premium grant
CREATE OR REPLACE FUNCTION public.redeem_promo_code(p_code text, p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_promo_id UUID; v_existing_sub UUID;
BEGIN
  UPDATE promo_codes SET current_uses = current_uses + 1
  WHERE code = UPPER(TRIM(p_code)) AND is_active = true
    AND (expires_at IS NULL OR expires_at > NOW())
    AND current_uses < max_uses
    AND NOT EXISTS (SELECT 1 FROM code_redemptions WHERE user_id = p_user_id AND promo_code_id = promo_codes.id)
  RETURNING id INTO v_promo_id;
  
  IF v_promo_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid, expired, or already redeemed code');
  END IF;
  
  INSERT INTO code_redemptions (user_id, promo_code_id) VALUES (p_user_id, v_promo_id);
  
  SELECT id INTO v_existing_sub FROM user_subscriptions WHERE user_id = p_user_id LIMIT 1;
  
  IF v_existing_sub IS NOT NULL THEN
    UPDATE user_subscriptions SET subscription_type = 'premium_yearly', status = 'active',
      expires_at = '2099-12-31T23:59:59Z', platform = 'web', updated_at = NOW()
    WHERE user_id = p_user_id;
  ELSE
    INSERT INTO user_subscriptions (user_id, subscription_type, status, expires_at, platform)
    VALUES (p_user_id, 'premium_yearly', 'active', '2099-12-31T23:59:59Z', 'web');
  END IF;
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Find profile by share code (friend referrals)
CREATE OR REPLACE FUNCTION public.find_profile_by_share_code(p_share_code text)
RETURNS TABLE(user_id uuid, username text, avatar_url text) LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY SELECT p.user_id, p.username, p.avatar_url FROM profiles p WHERE p.share_code = p_share_code LIMIT 1;
END;
$$;

-- Prevent admin field changes via direct update
CREATE OR REPLACE FUNCTION public.prevent_admin_field_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN NEW.is_admin := OLD.is_admin; END IF;
  RETURN NEW;
END;
$$;

-- Auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
```

### Storage Buckets
```sql
-- Music files (public, audio/*)
INSERT INTO storage.buckets (id, name, public) VALUES ('music', 'music', true);
-- Cover images (public, image/*)
INSERT INTO storage.buckets (id, name, public) VALUES ('covers', 'covers', true);
```

### Realtime
```sql
-- Songs table has realtime enabled for live updates on Home page
ALTER PUBLICATION supabase_realtime ADD TABLE public.songs;
```

---

## 4. Authentication System

### Architecture
- Email/password signup and login (auto-confirm enabled)
- Admin role detection via `has_role()` RPC function (uses `user_roles` table)
- Profile auto-creation on signup via database trigger + client-side `ensureUserProfile()` fallback
- Error normalization via `getAuthError()` from `lib/errorMessages.ts`
- Session listener set up BEFORE `getSession()` to avoid race conditions
- `isOffline` state exposed from `navigator.onLine`

### AuthContext.tsx (Current Implementation)
```typescript
interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  isLoading: boolean;
  isOffline: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; isAdmin?: boolean }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

// Key behaviors:
// 1. ensureUserProfile() - creates profile if missing (handles trigger failures)
// 2. checkAdminRole() - uses supabase.rpc('has_role', { _user_id, _role: 'admin' })
// 3. signIn - calls ensureUserProfile + checkAdminRole after success
// 4. signUp - uses emailRedirectTo: window.location.origin
// 5. signOut - wraps in try/finally to always clear state
```

### Auth Page Flow
- Toggle between Sign In and Sign Up modes
- Admin users → redirect to `/admin`
- Regular users → redirect to `/home`
- Offline users → redirect to `/offline-player`

---

## 5. Player Engine Architecture

### Song Interface
```typescript
export interface Song {
  id: string;
  title: string;
  artist: string;
  album?: string;
  cover_url?: string;
  audio_url: string;
  duration?: number;
  artist_id?: string;
  artist_photo_url?: string;
  play_count?: number;
}
```

### PlayerContext Key Features

1. **Dual Audio Element System**
   - Primary `audioRef` for current playback
   - Secondary `nextAudioRef` for crossfade transitions
   - Audio elements swapped after crossfade completes
   - Both elements: `crossOrigin='anonymous'`, `playsinline`, `webkit-playsinline`

2. **Smart Shuffle**
   - Uses `shuffleHistoryRef` (Set<number>) to track played indices
   - Avoids repeating songs until entire queue exhausted
   - History cleared when toggling shuffle on

3. **Queue Management**
   - Dynamic queue from section songs (pass `songsQueue` to `playSong`)
   - `addToQueue()` appends single song
   - `setQueue()` replaces entire queue
   - Queue reorderable via drag-and-drop in QueueDrawer

4. **Crossfade Implementation**
   - Configurable 1-12 seconds via `setCrossfadeDuration()`
   - 30-step volume interpolation
   - Triggers when `timeLeft <= crossfadeDuration`
   - Audio refs swapped at completion
   - `isCrossfading` ref prevents state interference

5. **Pre-roll Ads (Free Users)**
   - `AD_FREQUENCY = 3` (show ad every 3 songs)
   - `songsPlayedSinceAd` counter
   - Premium status checked from `user_subscriptions` table
   - `pendingSong` stored while ad plays
   - Supports both 'start' and 'end' ad types

6. **Progress Tracking**
   - `requestAnimationFrame` loop for smooth progress updates (not `setInterval`)
   - Only updates when playing and not crossfading

7. **Background Audio Resilience**
   - `visibilitychange` event listener
   - `focus` event listener to resume interrupted playback
   - Auto-plays if audio was interrupted (src exists, paused, currentTime > 0)

8. **MediaSession Integration**
   - Stable callbacks via `React.useMemo`
   - Updates metadata (title, artist, album, artwork)
   - Registers: play, pause, nexttrack, previoustrack, seekto, seekbackward, seekforward
   - Position state updated with throttling + periodic interval

9. **Recently Played Tracking**
   - Fire-and-forget insert to `recently_played` table after playing a song

### Core Player Methods
```typescript
interface PlayerContextType {
  currentSong: Song | null;
  isPlaying: boolean;
  progress: number;
  duration: number;
  volume: number;
  queue: Song[];
  shuffle: boolean;
  repeat: 'off' | 'all' | 'one';
  isExpanded: boolean;
  crossfade: boolean;
  crossfadeDuration: number;
  audioElement: HTMLAudioElement | null;
  showPrerollAd: boolean;
  adType: 'start' | 'end';
  
  playSong: (song: Song, offlineUrl?: string | null, songsQueue?: Song[]) => void;
  togglePlay: () => void;
  pause: () => void;
  play: () => void;
  stopSong: () => void;
  nextSong: () => void;
  prevSong: () => void;
  seek: (time: number) => void;
  setVolume: (vol: number) => void;
  setQueue: (songs: Song[]) => void;
  addToQueue: (song: Song) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  setExpanded: (expanded: boolean) => void;
  toggleCrossfade: () => void;
  setCrossfadeDuration: (seconds: number) => void;
  onPrerollAdComplete: () => void;
}
```

---

## 6. Core Contexts & Providers

### Provider Hierarchy (App.tsx)
```tsx
<QueryClientProvider client={queryClient}>
  <BrowserRouter>
    <AuthProvider>
      <PlayerProvider>
        <DownloadProvider>
          <TooltipProvider>
            <AppContent />
          </TooltipProvider>
        </DownloadProvider>
      </PlayerProvider>
    </AuthProvider>
  </BrowserRouter>
</QueryClientProvider>
```

### QueryClient Configuration
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,   // 2 minutes
      gcTime: 10 * 60 * 1000,     // 10 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
```

### DownloadContext Features
- IndexedDB storage for offline audio blobs
- Download progress tracking with callbacks
- Queue management for batch downloads
- Blob URL creation/revocation
- Storage size calculation via `navigator.storage.estimate()`
- `isDownloaded(songId)`, `getDownloadedUrl(songId)`, `clearAllDownloads()`

---

## 7. Component Specifications

### App Flow
1. `SplashScreen` → 1.2s shortened timeout for WebView compatibility
2. `Onboarding` → shown once (stored in `localStorage: uf_onboarding_done`)
3. `AnimatedRoutes` → main app with `AnimatePresence`

### MobileShell.tsx
- Full-screen fixed container (`100dvh`)
- Touch manipulation, no scrollbars
- Renders all global overlays (Toaster, PrerollAd, DownloadQueuePanel, PWAInstallBanner)

### BottomNav.tsx
- 4 tabs: Listen Now (`/home`), Search (`/search`), Library (`/library`), Profile (`/profile`)
- Scroll-responsive: hides on scroll down, shows on scroll up
- Glassmorphism background: `rgba(18, 18, 18, 0.85)`, `backdrop-filter: blur(50px) saturate(180%)`
- Rose accent for active tab
- Spring animation: stiffness 400, damping 30

### MiniPlayer.tsx
- Fixed above BottomNav, scroll-synced visibility
- Materialization entrance: scale 0.95, blur 10px, y 60px → clear (spring: stiffness 300, damping 25)
- Swipe gestures: up → expand, left → next, right → previous
- Play/Pause, Next, Close buttons
- Progress bar at top (linear gradient)
- Song info with crossfade animation on track change

### FullscreenPlayer.tsx
- Full-screen fixed overlay with drag-to-collapse
- Blurred album art background (blur: 60px, saturate: 1.3)
- Album art: 85vw, max 340px with shadow
- Controls: Shuffle, Prev, Play/Pause (60px), Next, Repeat
- Volume slider (0-100 mapped to 0-1)
- Progress scrubber with time display (M:SS format)
- Action buttons: Share (SocialShareModal), Add to Playlist
- SongReactions emoji component
- Artist name links to `/artist/:id`

### LockScreenPlayer.tsx
- Full-screen overlay with live clock
- Wake lock to prevent screen dim
- Swipe-up-to-dismiss (threshold: -120px)
- Volume and progress sliders
- Shuffle/Repeat toggles
- Blurred album art background

### SongCard.tsx
- Fixed width: 150px, aspect-square album art
- Tap to play/toggle, OptimizedImage with lazy loading
- Like button, Add to Playlist button
- Download indicator (green checkmark)
- Active state: audio wave indicator, primary ring

### AllSongsSection.tsx
- Dual view mode: 3-column grid / detailed list (toggle button)
- Default shows 12 (grid) or 8 (list) songs, expandable
- **No per-item animation delays** (removed for performance)
- **No backdrop-filter blur** on container (removed for mobile GPU perf)
- Each item calls `usePlayer()` and `useDownloads()` for state

### FeaturedArtistsSection.tsx
- Horizontal scroll with snap, 82px wide items
- Circular artist photos with gradient ring (conic-gradient)
- Song count per artist (computed from songs table)
- **No backdrop-filter blur** on container

### HorizontalSection.tsx
- Generic horizontal scroll container with title/subtitle
- Used for New Releases and other sections

### QueueDrawer.tsx
- Swipe-to-delete individual songs
- Drag-and-drop reorder via `Reorder.Group`
- Clear all button
- Empty state message

### SleepTimerModal.tsx
- Preset durations + custom input
- Countdown timer that pauses playback

### EqualizerModal.tsx
- Audio equalizer controls (visual, no Web Audio API)

### LyricsDisplay.tsx
- Synchronized lyrics with current line highlight
- Auto-scroll to active line
- Sample lyrics database

---

## 8. All Pages & Routes

### Public Routes
- `/auth` - Login/Signup page (redirects to `/home` if authenticated)
- `/offline-player` - Offline player shell (no auth required)

### Protected Routes (require authentication)
- `/` → redirects to `/home` or `/auth`
- `/home` - Main music feed (songs fetched with `.limit(1000)`)
- `/search` - Search songs, artists, genres
- `/library` - Liked songs, playlists, artists, downloads (tabbed)
- `/profile` - User profile, premium status, share code
- `/settings` - App settings
- `/support` - Help and donation links
- `/offline` - Offline-only playback page
- `/playlist/:id` - Playlist detail with songs
- `/artist/:artistId` - Artist detail with songs

### Admin Routes (require admin role via `has_role` RPC)
- `/admin` - Dashboard with real-time analytics
- `/admin/upload` - Upload music (YouTube URL + direct)
- `/admin/songs` - Manage songs (CRUD, flags, section placement)
- `/admin/artists` - Manage artists
- `/admin/albums` - Manage albums
- `/admin/playlists` - Manage playlists
- `/admin/users` - Manage users
- `/admin/subscriptions` - Manage subscriptions
- `/admin/donations` - Donation history
- `/admin/app-settings` - App configuration (JSONB key/value)
- `/admin/features` - Feature flags
- `/admin/announcements` - System announcements
- `/admin/moderation` - Content reports
- `/admin/analytics` - Usage analytics
- `/admin/logs` - Activity logs
- `/admin/bulk` - Bulk actions
- `/admin/health` - System health monitoring
- `/admin/scheduler` - Content scheduler
- `/admin/backup` - Backup & export
- `/admin/promo-codes` - Promo code management
- `/admin/settings` - Admin settings
- `/admin/api` - API key management
- `/admin/notifications` - Push notifications
- `/admin/revenue` - Revenue analytics (Recharts)
- `/admin/engagement` - User engagement (DAU/WAU)
- `/admin/ab-testing` - A/B testing experiments
- `/admin/security` - Security center
- `/admin/jamendo` - Jamendo music browse

### Route Guards
```typescript
const ProtectedRoute = ({ children }) => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <LazyFallback />;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
};

const AdminRoute = ({ children }) => {
  const { user, isAdmin, isLoading } = useAuth();
  if (isLoading) return <LazyFallback />;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/home" replace />;
  return <>{children}</>;
};
```

---

## 9. Admin Panel (29 Modules)

### AdminLayout.tsx
- Sidebar navigation with icons and nested routes (React Router `<Outlet />`)
- Mobile hamburger menu
- Real-time data subscriptions for dashboard metrics

### Key Admin Features
1. **UploadMusic** - YouTube URL extraction via `extract-audio` edge function, direct file upload to `music` bucket, AI metadata via `ai-metadata` edge function
2. **ManageSongs** - Full CRUD, premium flags, visibility toggle, section placement (new releases, trending)
3. **ManageArtists** - Artist profiles with photos, bios, genre tags
4. **ManageAlbums** - Album management with cover art
5. **ManagePlaylists** - Featured/public playlist management
6. **ManageUsers** - User list, role assignment, subscription management
7. **ManageSubscriptions** - Manual premium assignment, expiration management
8. **DonationHistory** - Donation records with platform tracking
9. **PromoCodes** - Generate codes for lifetime premium, track usage/redemptions
10. **AppSettings** - JSONB key/value app configuration
11. **FeatureFlags** - Feature toggles
12. **Announcements** - System messages with target audience and scheduling
13. **ContentModeration** - Content reports review and action
14. **Analytics** - Usage analytics with charts
15. **ActivityLogs** - Audit trail
16. **BulkActions** - Batch operations on songs/users
17. **SystemHealth** - Database, storage, function health monitoring
18. **ContentScheduler** - Scheduled content publication
19. **BackupExport** - Data export functionality
20. **AdminSettings** - Admin-specific settings
21. **APIManagement** - API key generation and usage tracking
22. **PushNotifications** - Targeted messaging with CTR analytics
23. **RevenueAnalytics** - Recharts-based financial tracking
24. **UserEngagement** - DAU/WAU metrics, feature usage tracking
25. **ABTesting** - Experiment management with statistical significance
26. **SecurityCenter** - Security event logs, hardening settings
27. **JamendoBrowse** - Browse Jamendo Creative Commons music library
28. **AdminDashboard** - Real-time metrics: storage utilization, 7-day playback chart, top songs, active users

---

## 10. Custom Hooks

### useMediaSession
- Lock screen / notification controls via MediaSession API
- Updates metadata (title, artist, album, artwork) when song changes
- Registers action handlers: play, pause, nexttrack, previoustrack, seekto, seekbackward, seekforward
- Throttled position state updates + periodic interval while playing

### useOfflineAudio
- IndexedDB-based offline storage (`uf-audio-cache` database)
- `cacheAudioFile(song, blob)` - stores audio blob + metadata
- `getCachedAudio(songId)` - retrieves blob for playback
- `getPlayableUrl(songId)` - creates temporary blob URL
- `cacheSong(song, onProgress?)` - downloads and caches with progress callback
- `removeCached(songId)` - removes + revokes blob URL
- `getCacheSize()` - total bytes used
- `clearAudioCache()` - wipe all

### useHaptics
- Cross-platform haptic feedback
- Median bridge for native Capacitor apps
- Web Vibration API fallback
- `triggerHaptic(style)` standalone function: `impactLight`, `impactMedium`, `impactHeavy`, `selection`, `notificationSuccess`, `notificationWarning`, `notificationError`

### usePremium
- Checks `user_subscriptions` table
- Premium = `subscription_type !== 'free' && status === 'active' && !expired`
- Returns `{ isPremium, isLoading, subscription, refetch }`

### useLike
- Global like status batch query (single query for all visible songs)
- Toggle like/unlike with optimistic UI update
- Updates `user_library` table

### useSongCache
- localStorage-based song metadata caching
- 5-minute expiry (`CACHE_EXPIRY`)
- `getCachedSongs()`, `cacheSongs()`, `clearSongCache()`
- React hook: `useSongCache()` returns `{ cachedSongs, updateCache, clearCache }`

### useWidgetSync
- Syncs player state to Android home screen widgets via Capacitor bridge
- Updates Now Playing, Favorites, Recently Played widgets

### usePullToRefresh
- Touch gesture detection for pull-to-refresh
- Configurable threshold (default 80px) and max pull (120px)
- Returns `{ pullDistance, isRefreshing, progress, handlers }`

### useNewSongNotification
- Supabase Realtime listener for INSERT on songs table
- Shows toast + browser notification
- `requestPermission()` for notification API

### useImageCache
- IndexedDB image caching for album art
- Reduces network requests for frequently viewed covers

### useAudioVisualizer
- Web Audio API integration
- AnalyserNode for frequency data visualization

---

## 11. Edge Functions

### extract-audio/index.ts
**Purpose:** Extract audio streams from YouTube URLs using proxy networks.

**Flow:**
1. Extract video ID from URL (supports youtube.com, youtu.be, music.youtube.com, shorts)
2. Try Piped instances in parallel (race)
3. Fallback to Invidious instances if Piped fails
4. Select best audio stream (prefer M4A, highest bitrate)
5. Return audio URL, title, artist, thumbnail, duration

**Piped Instances (12):**
```
pipedapi.kavin.rocks, api.piped.private.coffee, pipedapi.tokhmi.xyz,
pipedapi.moomoo.me, pipedapi.syncpundit.io, api-piped.mha.fi,
pipedapi.leptons.xyz, piped-api.lunar.icu, pipedapi.r4fo.com,
pipedapi.adminforge.de, api.piped.yt, pipedapi.drgns.space
```

**Invidious Instances (10):**
```
inv.nadeko.net, invidious.private.coffee, invidious.nerdvpn.de,
yt.artemislena.eu, invidious.fdn.fr, invidious.perennialte.ch,
invidious.slipfox.xyz, invidious.jing.rocks, iv.nboez.cc,
invidious.protokolla.fi
```

### ai-metadata/index.ts
**Purpose:** Extract metadata from audio files using AI (Gemini model via Lovable AI).

### jamendo-search/index.ts
**Purpose:** Search Jamendo Creative Commons music library.

---

## 12. CSS Design System

### Color Palette (HSL Variables)
```css
:root {
  --background: 0 0% 0%;           /* Pure black */
  --foreground: 0 0% 98%;          /* Near white */
  --card: 0 0% 7%;
  --card-foreground: 0 0% 98%;
  --primary: 350 100% 60%;         /* Rose/Red - Apple Music signature */
  --primary-foreground: 0 0% 100%;
  --secondary: 0 0% 12%;
  --muted: 0 0% 15%;
  --muted-foreground: 0 0% 55%;
  --accent: 330 100% 65%;          /* Pink/Magenta */
  --accent-foreground: 0 0% 100%;
  --destructive: 0 85% 60%;
  --border: 0 0% 15%;
  --input: 0 0% 12%;
  --ring: 350 100% 60%;
  --radius: 0.75rem;
  
  /* Gradient Colors */
  --gradient-start: 350 100% 60%;
  --gradient-mid: 330 100% 65%;
  --gradient-end: 280 100% 65%;
  
  /* Glow Colors */
  --glow-primary: 350 100% 60%;
  --glow-accent: 330 100% 65%;
  --glow-purple: 280 100% 65%;
  --glow-cyan: 185 100% 55%;
  --glow-green: 145 100% 50%;
  --glow-orange: 25 100% 55%;
  
  /* Glass Effect */
  --glass-bg: 0 0% 8% / 0.85;
  --glass-border: 0 0% 100% / 0.08;
  --glass-blur: 40px;
  
  /* Surface Colors */
  --surface-elevated: 0 0% 10%;
  --surface-overlay: 0 0% 6%;
  
  /* Semantic Colors */
  --success: 145 80% 50%;
  --warning: 40 100% 55%;
  --info: 200 100% 55%;
}
```

### Key CSS Classes
- `.glass` - backdrop-blur-xl, rgba(18,18,18,0.75) background
- `.glass-strong` - backdrop-blur-2xl, rgba(28,28,30,0.85)
- `.glass-ultra` - backdrop-blur-3xl, rgba(38,38,40,0.9)
- `.btn-premium` - Multi-color gradient with glow shadow
- `.btn-glass` - Glass button with border
- `.btn-glow` - Primary color with glow box-shadow
- `.ios-card` - Rounded 2xl, glass background
- `.gradient-text` - Gradient clip text (blue → purple → pink)
- `.glow-primary` / `.glow-accent` / `.glow-multi` - Box-shadow glows
- `.progress-glow` - Gradient progress bar with glow
- `.animate-audio-wave` - ScaleY animation for audio bars
- `.skeleton-shimmer` - Loading shimmer effect
- `.ios-input` - iOS-style input field
- `.ios-tab-bar` - Bottom tab bar styling
- `.haptic-press` - Scale(0.95) on active

### Mobile-Only Constraints
```css
html { overflow: hidden; height: 100%; touch-action: manipulation; }
body { position: fixed; inset: 0; user-select: none; overscroll-behavior: none; }
img { pointer-events: none; user-drag: none; }
```

### Font Stack
```css
font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Inter', system-ui, sans-serif;
```

### WebView Compatibility
```css
@supports not (backdrop-filter: blur(10px)) {
  .glass, .ios-card { backdrop-filter: none !important; background: rgba(28,28,30,0.95) !important; }
}
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

---

## 13. Animation System

### Framer Motion Springs
```typescript
export const iosSpring = { type: "spring", stiffness: 500, damping: 30, mass: 0.5 };
export const iosBounce = { type: "spring", stiffness: 600, damping: 25, mass: 0.3 };
export const originOS6Spring = { type: "spring", stiffness: 350, damping: 28, mass: 0.8, restDelta: 0.001 };
```

### Page Transitions
```typescript
export const pageVariants = {
  initial: { opacity: 0, scale: 0.96, y: 20 },
  animate: { opacity: 1, scale: 1, y: 0, transition: iosSpring },
  exit: { opacity: 0, scale: 0.98, y: -10, transition: { duration: 0.2 } },
};
```

### CSS Keyframes
- `audio-wave` - ScaleY 0.3 → 1 (0.8s, infinite)
- `shimmer` - TranslateX -100% → 100% (1.5s, infinite)
- `ios-bounce` - Scale/translate entrance
- `float-gentle` - TranslateY 0 → -5px (gentle float)
- `pulse-glow` - Box-shadow pulse
- `spin-slow` - Rotate 0 → 360deg
- `scale-pulse` - Scale 1 → 1.05

### Performance Rules
- **No staggered per-item animation delays** in large lists (causes jank with 100+ items)
- **No backdrop-filter blur** on frequently re-rendered containers
- Heavy blur restricted to static backgrounds only
- `will-change: transform` on animated elements
- `transform: translateZ(0)` for GPU acceleration

---

## 14. Performance Optimizations

### Rendering
- `React.memo()` on all song cards, list items, and sections
- Lazy loading via `React.lazy()` for all routes and heavy modals
- `Suspense` fallback: empty div with `bg-background`
- No `React.StrictMode` in production (prevents double effects)

### Network
- Song query limit: 1000 (from Supabase, `is_visible = true`)
- Songs cached in localStorage via `useSongCache` (5-minute TTL)
- React Query: 2-minute stale time, 10-minute GC time, no refetch on window focus
- Global like status batched into single query per render
- Supabase Realtime debounced by 2 seconds for song updates

### Images
- `OptimizedImage` component with Intersection Observer lazy loading
- IndexedDB image caching via `useImageCache`
- `loading="lazy"` on all non-critical images

### Database Indexes (recommended)
```sql
CREATE INDEX idx_songs_is_visible ON songs(is_visible);
CREATE INDEX idx_songs_artist_id ON songs(artist_id);
CREATE INDEX idx_songs_created_at ON songs(created_at DESC);
CREATE INDEX idx_user_library_user_id ON user_library(user_id);
CREATE INDEX idx_user_library_song_id ON user_library(song_id);
CREATE INDEX idx_recently_played_user_id ON recently_played(user_id);
CREATE INDEX idx_recently_played_played_at ON recently_played(played_at DESC);
CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_playlist_songs_playlist_id ON playlist_songs(playlist_id);
CREATE INDEX idx_user_subscriptions_user_id ON user_subscriptions(user_id);
```

---

## 15. Caching Strategy

| Layer | Storage | TTL | Content |
|-------|---------|-----|---------|
| Song metadata | localStorage | 5 min | Song list from Home page |
| React Query | In-memory | 2 min stale, 10 min GC | All Supabase queries |
| Offline audio | IndexedDB | Permanent | Audio blobs + metadata |
| Image cache | IndexedDB | Permanent | Album art blobs |
| Onboarding flag | localStorage | Permanent | `uf_onboarding_done` |
| Browser HTML | HTTP headers | No-cache | `Cache-Control: no-cache, no-store, must-revalidate` |

---

## 16. Error Handling

### Error Message System (`lib/errorMessages.ts`)
- Maps PostgreSQL error codes to user-friendly messages (23505, 23503, 23514, 23502, 42501, 22P02, 22001)
- Auth error pattern matching (invalid credentials, email registered, weak password, rate limit)
- Network error detection (failed to fetch, timeout, abort)
- Specialized handlers: `getAuthError()`, `getUploadError()`, `getDatabaseError()`
- Full error logged to console, safe message returned to user

### Regional Considerations
- Supabase backend domain blocked by ISPs in some regions (e.g., India)
- `Failed to fetch` errors may be infrastructure-level, not code bugs
- App should degrade gracefully with offline player shell

---

## 17. Offline Architecture

### IndexedDB Storage (`uf-audio-cache`)
- Object stores: `audio-blobs` (keyed by songId → Blob), `audio-meta` (keyed by songId → metadata)
- `useOfflineAudio` hook manages all cache operations
- Blob URLs created on demand, revoked on removal

### DownloadContext
- Wraps `useOfflineAudio` with queue management
- Download progress callbacks
- `DownloadQueuePanel` shows active/completed downloads
- `SaveToDeviceButton` per-song download trigger
- `DownloadAllButton` for batch operations

### Offline Pages
- `/offline` - Protected route showing downloaded songs
- `/offline-player` - Unprotected shell for offline-only access (no auth required)
- `OfflinePlayerShell` - Standalone player using cached songs
- Online/offline detection via `navigator.onLine` + event listeners

---

## 18. PWA Configuration

**Note:** The app does NOT use a PWA service worker (`vite-plugin-pwa` is NOT installed). A startup script in `main.tsx` unregisters any legacy service workers to prevent auth fetch interception.

### manifest.json (static file only)
```json
{
  "name": "UniversFlow",
  "short_name": "UniversFlow",
  "description": "Premium Music Experience",
  "theme_color": "#000000",
  "background_color": "#000000",
  "display": "standalone",
  "orientation": "portrait",
  "scope": "/",
  "start_url": "/",
  "icons": [
    { "src": "/pwa-192x192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/pwa-512x512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/pwa-maskable-192x192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
    { "src": "/pwa-maskable-512x512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

---

## 19. Capacitor Mobile Build

### Configuration
```typescript
// capacitor.config.ts (development - hot reload)
const config: CapacitorConfig = {
  appId: 'app.lovable.universflow',
  appName: 'UniversFlow',
  webDir: 'dist',
  server: {
    url: 'https://5acaae55-bbc8-47a7-bd32-f3924d8ef986.lovableproject.com?forceHideBadge=true',
    cleartext: true
  }
};

// capacitor.config.prod.ts (production - bundled)
const config: CapacitorConfig = {
  appId: 'app.lovable.universflow',
  appName: 'UniversFlow',
  webDir: 'dist',
  // No server.url — uses local bundled files
};
```

### GitHub Actions Workflow (`.github/workflows/build-android.yml`)
- Triggers: `workflow_dispatch` (manual)
- Node.js 22, Java 21 (Temurin)
- `npm install --legacy-peer-deps`
- Build web app with Supabase env vars from GitHub Secrets
- `npx cap add android && npx cap sync android`
- `./gradlew assembleDebug`
- Upload `app-debug.apk` as artifact

### Required GitHub Secrets
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

---

## 20. Android Widgets

### Widget Types (in `android-widgets/`)
1. **NowPlayingWidget** - Current track, play/pause, prev/next, progress
2. **FavoritesWidget** - Top 6 liked songs grid
3. **RecentlyPlayedWidget** - Last 4 played songs list
4. **QuickActionsWidget** - Shuffle, search, library, history buttons
5. **MusicSearchWidget** - Search bar widget

### Widget Bridge (`src/lib/widgetBridge.ts`)
- Detects Capacitor Android + `WidgetBridge` plugin
- `updateNowPlayingWidget(data)` - sync playback state
- `updateFavoritesWidget(favorites)` - sync liked songs (max 6)
- `updateRecentlyPlayedWidget(songs)` - sync history (max 4)
- `refreshAllWidgets()` - force refresh all
- `checkWidgetLaunchIntent()` - handle widget tap actions
- `setupWidgetEventListeners(handlers)` - register play/pause/next/prev/shuffle callbacks

### Widget Resources
- Custom XML layouts for each widget type
- Drawable resources: backgrounds, icons, overlays
- Widget info XML with preview images and sizing

---

## 21. SEO & Meta Tags

### index.html
```html
<!-- Cache busting -->
<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
<meta http-equiv="Pragma" content="no-cache" />
<meta http-equiv="Expires" content="0" />

<!-- Primary Meta -->
<title>Univers Flow - Free Music Streaming & Download | Listen Offline</title>
<meta name="description" content="Stream and download unlimited music for free...">
<meta name="keywords" content="free music streaming, music download, offline music...">
<meta name="author" content="SHASHANK YADAV" />
<meta name="robots" content="index, follow, max-image-preview:large" />

<!-- Open Graph -->
<meta property="og:type" content="website" />
<meta property="og:url" content="https://universflow.in/" />
<meta property="og:title" content="Univers Flow - Free Music Streaming & Download" />
<meta property="og:image" content="..." />

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image" />

<!-- Canonical -->
<link rel="canonical" href="https://universflow.in/" />
```

### SEOHead Component
- Dynamic page title and meta tags per route
- Structured data (JSON-LD) via StructuredData component

---

## 22. File Structure

```
src/
├── App.tsx                          # Providers, routes, guards, lazy loading
├── main.tsx                         # Entry point (no StrictMode, no SW)
├── index.css                        # Design tokens, glassmorphism, animations
├── App.css                          # Additional styles
├── vite-env.d.ts
│
├── assets/
│   └── app-logo.png                 # App logo
│
├── components/
│   ├── MobileShell.tsx              # Full-screen mobile container
│   ├── BottomNav.tsx                # Bottom navigation (4 tabs)
│   ├── MiniPlayer.tsx               # Collapsed player with swipe gestures
│   ├── FullscreenPlayer.tsx         # Expanded player with drag-to-close
│   ├── LockScreenPlayer.tsx         # Lock screen overlay with wake lock
│   ├── SongCard.tsx                 # Song display card
│   ├── AllSongsSection.tsx          # Grid/list toggle song section
│   ├── FeaturedArtistsSection.tsx   # Horizontal artist scroller
│   ├── HorizontalSection.tsx        # Generic horizontal section
│   ├── TopChartsSection.tsx         # Top charts by play count
│   ├── RecentlyPlayedSection.tsx    # Recently played songs
│   ├── GenreSection.tsx             # Genre browser
│   ├── MoodSection.tsx              # Mood-based music
│   ├── SplashScreen.tsx             # App loading screen (1.2s)
│   ├── Onboarding.tsx               # First-time user onboarding
│   ├── OfflineIndicator.tsx         # Offline status badge
│   ├── OfflineSection.tsx           # Offline content section
│   ├── OfflinePlayerShell.tsx       # Standalone offline player
│   ├── QueueDrawer.tsx              # Playback queue (drag reorder)
│   ├── EqualizerModal.tsx           # Audio equalizer
│   ├── SleepTimerModal.tsx          # Sleep timer
│   ├── LyricsDisplay.tsx            # Lyrics view
│   ├── AudioVisualizer.tsx          # Audio visualization
│   ├── AudioFrequencyVisualizer.tsx # Frequency visualizer
│   ├── SongReactions.tsx            # Emoji reactions
│   ├── LikeButton.tsx               # Heart button
│   ├── DownloadButton.tsx           # Download button
│   ├── DownloadAllButton.tsx        # Batch download
│   ├── DownloadQueuePanel.tsx       # Download progress panel
│   ├── SaveToDeviceButton.tsx       # Save offline button
│   ├── ShareSongModal.tsx           # Share options
│   ├── SocialShareModal.tsx         # Social sharing
│   ├── AddToPlaylistModal.tsx       # Add to playlist
│   ├── CreatePlaylistModal.tsx      # New playlist
│   ├── AddSongsToPlaylistModal.tsx  # Bulk add songs
│   ├── RedeemCodeModal.tsx          # Promo code entry
│   ├── PremiumGate.tsx              # Premium content block
│   ├── AIPlaylistGenerator.tsx      # AI playlist creation
│   ├── ListeningStats.tsx           # User listening stats
│   ├── AnimatedIcon.tsx             # Animated icon component
│   ├── AnimatedList.tsx             # Animated list wrapper
│   ├── BlurTransition.tsx           # Blur transition effect
│   ├── Crossfade.tsx                # Crossfade controls
│   ├── AdvancedAudioSettings.tsx    # Audio settings panel
│   ├── OptimizedImage.tsx           # Lazy-loaded image
│   ├── PageTransition.tsx           # Page animation wrapper
│   ├── PageSkeletons.tsx            # Loading skeletons
│   ├── PullToRefresh.tsx            # Pull-to-refresh indicator
│   ├── NavLink.tsx                  # Navigation link
│   ├── SEOHead.tsx                  # Dynamic SEO meta
│   ├── StructuredData.tsx           # JSON-LD structured data
│   ├── Footer.tsx                   # App footer
│   ├── PWAInstallBanner.tsx         # PWA install prompt
│   ├── WebViewFallback.tsx          # WebView error handler
│   │
│   ├── player/
│   │   └── AlbumArtAnimations.tsx   # Album art animation variants
│   │
│   ├── ui/                          # shadcn/ui components (40+)
│   │   ├── button.tsx, dialog.tsx, drawer.tsx, input.tsx, slider.tsx,
│   │   │   tabs.tsx, card.tsx, badge.tsx, avatar.tsx, select.tsx,
│   │   │   switch.tsx, checkbox.tsx, progress.tsx, skeleton.tsx,
│   │   │   toast.tsx, toaster.tsx, sonner.tsx, popover.tsx,
│   │   │   dropdown-menu.tsx, context-menu.tsx, scroll-area.tsx,
│   │   │   separator.tsx, accordion.tsx, alert-dialog.tsx, alert.tsx,
│   │   │   aspect-ratio.tsx, breadcrumb.tsx, calendar.tsx, carousel.tsx,
│   │   │   chart.tsx, collapsible.tsx, command.tsx, form.tsx,
│   │   │   haptic-button.tsx, hover-card.tsx, input-otp.tsx, label.tsx,
│   │   │   menubar.tsx, navigation-menu.tsx, pagination.tsx, radio-group.tsx,
│   │   │   resizable.tsx, sheet.tsx, sidebar.tsx, table.tsx, textarea.tsx,
│   │   │   toggle.tsx, toggle-group.tsx, tooltip.tsx, use-toast.ts
│   │
│   └── ads/
│       ├── BannerAd.tsx             # Banner ad placeholder
│       ├── InterstitialAd.tsx       # Full-screen ad
│       └── PrerollAd.tsx            # Pre-song audio ad (skippable)
│
├── contexts/
│   ├── AuthContext.tsx              # Auth state + ensureUserProfile + checkAdminRole
│   ├── PlayerContext.tsx            # Audio engine (dual audio, crossfade, ads)
│   └── DownloadContext.tsx          # Download manager (IndexedDB)
│
├── hooks/
│   ├── use-mobile.tsx               # Mobile detection
│   ├── use-toast.ts                 # Toast notifications
│   ├── useAppSettings.ts            # App settings from DB
│   ├── useAudioSettings.ts          # Audio preferences
│   ├── useAudioVisualizer.ts        # Web Audio API visualizer
│   ├── useHaptics.ts                # Haptic feedback (Median + Vibration API)
│   ├── useImageCache.ts             # IndexedDB image caching
│   ├── useLike.ts                   # Batched like status queries
│   ├── useMedian.ts                 # Median.co bridge detection
│   ├── useMediaSession.ts           # MediaSession API lock screen controls
│   ├── useNewSongNotification.ts    # Realtime new song notifications
│   ├── useOfflineAudio.ts           # IndexedDB audio cache
│   ├── usePremium.ts                # Premium subscription status
│   ├── usePullToRefresh.ts          # Pull-to-refresh gesture
│   ├── useSongCache.ts              # localStorage song metadata cache
│   └── useWidgetSync.ts             # Android widget sync
│
├── pages/
│   ├── Auth.tsx                     # Login/Signup
│   ├── Home.tsx                     # Main feed (limit 1000 songs)
│   ├── Search.tsx                   # Search page
│   ├── Library.tsx                  # User library (tabbed)
│   ├── Profile.tsx                  # User profile
│   ├── Settings.tsx                 # App settings
│   ├── Support.tsx                  # Help/Donations
│   ├── Offline.tsx                  # Offline mode
│   ├── PlaylistDetail.tsx           # Playlist view
│   ├── ArtistDetail.tsx             # Artist view
│   ├── Index.tsx                    # Root redirect
│   ├── NotFound.tsx                 # 404 page
│   │
│   └── admin/ (29 modules)
│       ├── AdminLayout.tsx, AdminDashboard.tsx, UploadMusic.tsx,
│       │   ManageSongs.tsx, ManageArtists.tsx, ManageAlbums.tsx,
│       │   ManagePlaylists.tsx, ManageUsers.tsx, ManageSubscriptions.tsx,
│       │   DonationHistory.tsx, PromoCodes.tsx, AppSettings.tsx,
│       │   FeatureFlags.tsx, Announcements.tsx, ContentModeration.tsx,
│       │   Analytics.tsx, ActivityLogs.tsx, BulkActions.tsx,
│       │   SystemHealth.tsx, ContentScheduler.tsx, BackupExport.tsx,
│       │   Settings.tsx, APIManagement.tsx, PushNotifications.tsx,
│       │   RevenueAnalytics.tsx, UserEngagement.tsx, ABTesting.tsx,
│       │   SecurityCenter.tsx, JamendoBrowse.tsx
│
├── lib/
│   ├── utils.ts                     # cn() utility (clsx + tailwind-merge)
│   ├── animations.ts                # Framer Motion spring configs + variants
│   ├── errorMessages.ts             # Error code → user-friendly message mapping
│   ├── imageCompression.ts          # Image processing utilities
│   ├── mockData.ts                  # Mock data for development
│   ├── median.ts                    # Median.co SDK loader
│   └── widgetBridge.ts              # Android widget Capacitor bridge
│
├── integrations/
│   ├── lovable/
│   │   └── index.ts                 # Lovable integration
│   └── supabase/
│       ├── client.ts                # Auto-generated Supabase client
│       └── types.ts                 # Auto-generated database types
│
└── test/
    ├── setup.ts                     # Test configuration
    └── example.test.ts              # Example test

supabase/
├── config.toml                      # Supabase configuration (auto-managed)
└── functions/
    ├── extract-audio/index.ts       # YouTube audio extraction
    ├── ai-metadata/index.ts         # AI metadata extraction
    └── jamendo-search/index.ts      # Jamendo music search

android-widgets/                     # Native Android widget code
├── java/                            # Widget Java classes
├── res/                             # Layouts, drawables, XML configs
└── README.md

public/
├── favicon.ico
├── manifest.json
├── robots.txt, sitemap.xml
├── placeholder.svg
├── pwa-*.png                        # PWA icons (4 sizes)
└── .well-known/                     # Domain verification

.github/workflows/
└── build-android.yml                # CI/CD for Android APK build
```

---

## Summary

This document provides a **complete technical specification** for rebuilding the **UniversFlow v3.0** music streaming application. It includes:

- ✅ Complete database schema with 18+ tables, RLS policies, and 6 database functions
- ✅ Authentication with profile auto-creation, admin roles via `user_roles` table, and error normalization
- ✅ Dual-audio player engine with crossfade, smart shuffle, and background audio resilience
- ✅ 29 admin panel modules with real-time analytics dashboard
- ✅ Offline playback via IndexedDB with download queue management
- ✅ Social features (dedications, friend referrals via share codes)
- ✅ Premium subscription via promo codes (atomic redemption)
- ✅ YouTube audio extraction edge function (Piped + Invidious proxies)
- ✅ Apple Music-inspired dark theme with HSL design tokens
- ✅ iOS-style animations with Framer Motion (springs, no stagger in lists)
- ✅ Capacitor Android build with GitHub Actions CI/CD
- ✅ Android home screen widgets (5 types) with Capacitor bridge
- ✅ Performance optimizations (memo, lazy loading, batch queries, no per-item animations)
- ✅ Browser cache-busting meta tags for consistent deployments
- ✅ Error handling with PostgreSQL code mapping
- ✅ Regional ISP blocking awareness
- ✅ WebView compatibility with CSS/JS fallbacks

**Use this document to:**
1. Rebuild the entire app from scratch
2. Hand off to developers
3. Document for maintenance
4. Reference for feature implementation

---

*Created by SHASHANK YADAV • UniversFlow v3.0 • February 2026*
