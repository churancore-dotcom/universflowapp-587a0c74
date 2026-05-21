import { useState, useEffect, lazy, Suspense } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { PlayerProvider, usePlayer } from "./contexts/PlayerContext";
import { DownloadProvider } from "./contexts/DownloadContext";
import { PlayWithMateProvider } from "./contexts/PlayWithMateContext";
import SplashScreen from "./components/SplashScreen";
import Onboarding from "./components/Onboarding";
import MobileShell from "./components/MobileShell";
import MateHeartButton from "./components/MateHeartButton";
import ArtistPicker from "./components/ArtistPicker";
import RateUsPopup from "./components/RateUsPopup";
import ReviewModal from "./components/ReviewModal";
import { NavDirectionProvider } from "./components/PageTransition";
import GlobalPlayerLayer from "./components/GlobalPlayerLayer";
import SEOHead from "./components/SEOHead";
import Auth from "./pages/Auth";
import VerifyEmail from "./pages/VerifyEmail";
import CheckEmail from "./pages/CheckEmail";
import NotFound from "./pages/NotFound";
import { usePushRegistration } from "./hooks/usePushRegistration";

// Eager load main tabs for INSTANT navigation (Spotify-like feel).
// Admin and rarely-visited pages stay lazy below.
import Home from "./pages/Home";
import Search from "./pages/Search";
import Library from "./pages/Library";
import Profile from "./pages/Profile";
import OfflinePlayerShell from "./components/OfflinePlayerShell";
import OfflineGate from "./components/OfflineGate";
import { SentryErrorBoundary } from "./components/SentryErrorBoundary";

// These are visited less often — keep lazy to keep initial bundle small.
const PlaylistDetail = lazy(() => import("./pages/PlaylistDetail"));
const ArtistDetail = lazy(() => import("./pages/ArtistDetail"));
const Settings = lazy(() => import("./pages/Settings"));
const Support = lazy(() => import("./pages/Support"));
const Offline = lazy(() => import("./pages/Offline"));
const PlayWithMate = lazy(() => import("./pages/PlayWithMate"));
const AllArtists = lazy(() => import("./pages/AllArtists"));
const ManageSubscription = lazy(() => import("./pages/ManageSubscription"));
const Premium = lazy(() => import("./pages/Premium"));
const Downloads = lazy(() => import("./pages/Downloads"));

const DownloadQueuePanel = lazy(() => import("./components/DownloadQueuePanel"));
const PrerollAd = lazy(() => import("./components/ads/PrerollAd"));
const PWAInstallBanner = lazy(() => import("./components/PWAInstallBanner"));

const StructuredData = lazy(() => import("./components/StructuredData"));

// Lazy load ALL admin routes
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const UploadMusic = lazy(() => import("./pages/admin/UploadMusic"));
const ManageSongs = lazy(() => import("./pages/admin/ManageSongs"));
const ManageArtists = lazy(() => import("./pages/admin/ManageArtists"));
const ManageAlbums = lazy(() => import("./pages/admin/ManageAlbums"));
const ManagePlaylists = lazy(() => import("./pages/admin/ManagePlaylists"));
const ManageUsers = lazy(() => import("./pages/admin/ManageUsers"));
const ManageSubscriptions = lazy(() => import("./pages/admin/ManageSubscriptions"));
const AppSettings = lazy(() => import("./pages/admin/AppSettings"));
const FeatureFlags = lazy(() => import("./pages/admin/FeatureFlags"));
const Announcements = lazy(() => import("./pages/admin/Announcements"));
const ContentModeration = lazy(() => import("./pages/admin/ContentModeration"));
const AdminSettings = lazy(() => import("./pages/admin/Settings"));
const Analytics = lazy(() => import("./pages/admin/Analytics"));
const ActivityLogs = lazy(() => import("./pages/admin/ActivityLogs"));
const BulkActions = lazy(() => import("./pages/admin/BulkActions"));
const SystemHealth = lazy(() => import("./pages/admin/SystemHealth"));
const ContentScheduler = lazy(() => import("./pages/admin/ContentScheduler"));
const BackupExport = lazy(() => import("./pages/admin/BackupExport"));
const PromoCodes = lazy(() => import("./pages/admin/PromoCodes"));
const PaymentRequests = lazy(() => import("./pages/admin/PaymentRequests"));
const APIManagement = lazy(() => import("./pages/admin/APIManagement"));
const PushNotifications = lazy(() => import("./pages/admin/PushNotifications"));
const RegisteredDevices = lazy(() => import("./pages/admin/RegisteredDevices"));
const UserEngagement = lazy(() => import("./pages/admin/UserEngagement"));
const ABTesting = lazy(() => import("./pages/admin/ABTesting"));
const SecurityCenter = lazy(() => import("./pages/admin/SecurityCenter"));

const SupportInbox = lazy(() => import("./pages/admin/SupportInbox"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
    },
  },
});

const LazyFallback = () => <div className="min-h-screen bg-background" />;

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <LazyFallback />;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isAdmin, isLoading } = useAuth();
  // Server-side re-verification on every admin mount. Cached `isAdmin` from
  // context is not trusted on its own — we hit the SECURITY DEFINER RPC
  // (`has_role`) which queries the `user_roles` table directly. If the role
  // was revoked mid-session, this catches it immediately.
  const [verified, setVerified] = useState<null | boolean>(null);

  useEffect(() => {
    let cancelled = false;
    if (!user) { setVerified(false); return; }
    (async () => {
      try {
        const { data, error } = await supabase.rpc('has_role', {
          _user_id: user.id,
          _role: 'admin',
        });
        if (!cancelled) setVerified(!error && !!data);
      } catch {
        if (!cancelled) setVerified(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  if (isLoading || verified === null) return <LazyFallback />;
  if (!user) return <Navigate to="/auth" replace />;
  // Cloak: if not admin (cached OR re-verified), render 404 instead of
  // redirecting. URL guessing reveals nothing about /admin existence.
  if (!isAdmin || !verified) return <NotFound />;
  return <>{children}</>;
};

const AnimatedRoutes = () => {
  const location = useLocation();
  const { user, isOffline } = useAuth();

  return (
    <NavDirectionProvider>
    <OfflineGate />
    <Suspense fallback={<LazyFallback />}>
        <Routes location={location}>
          <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/auth" element={
            user ? <Navigate to="/home" replace /> : 
            <Auth />
          } />
          <Route path="/verify" element={<VerifyEmail />} />
          <Route path="/check-email" element={<CheckEmail />} />
          <Route path="/offline-player" element={<OfflinePlayerShell />} />
          <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/search" element={<ProtectedRoute><Search /></ProtectedRoute>} />
          <Route path="/library" element={<ProtectedRoute><Library /></ProtectedRoute>} />
          <Route path="/playlist/:id" element={<ProtectedRoute><PlaylistDetail /></ProtectedRoute>} />
          <Route path="/artist/:artistId" element={<ProtectedRoute><ArtistDetail /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/support" element={<Support />} />
          <Route path="/offline" element={<ProtectedRoute><Offline /></ProtectedRoute>} />
          <Route path="/listen-together" element={<ProtectedRoute><PlayWithMate /></ProtectedRoute>} />
          <Route path="/artists" element={<AllArtists />} />
          <Route path="/subscription" element={<ProtectedRoute><ManageSubscription /></ProtectedRoute>} />
          <Route path="/premium" element={<Premium />} />
          <Route path="/downloads" element={<ProtectedRoute><Downloads /></ProtectedRoute>} />
          <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
            <Route index element={<AdminDashboard />} />
            <Route path="upload" element={<UploadMusic />} />
            <Route path="songs" element={<ManageSongs />} />
            <Route path="artists" element={<ManageArtists />} />
            <Route path="albums" element={<ManageAlbums />} />
            <Route path="playlists" element={<ManagePlaylists />} />
            <Route path="users" element={<ManageUsers />} />
            <Route path="subscriptions" element={<ManageSubscriptions />} />
            <Route path="app-settings" element={<AppSettings />} />
            <Route path="features" element={<FeatureFlags />} />
            <Route path="announcements" element={<Announcements />} />
            <Route path="moderation" element={<ContentModeration />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="logs" element={<ActivityLogs />} />
            <Route path="bulk" element={<BulkActions />} />
            <Route path="health" element={<SystemHealth />} />
            <Route path="scheduler" element={<ContentScheduler />} />
            <Route path="backup" element={<BackupExport />} />
            <Route path="promo-codes" element={<PromoCodes />} />
            <Route path="payments" element={<PaymentRequests />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="api" element={<APIManagement />} />
            <Route path="notifications" element={<PushNotifications />} />
            <Route path="devices" element={<RegisteredDevices />} />
            <Route path="engagement" element={<UserEngagement />} />
            <Route path="ab-testing" element={<ABTesting />} />
            <Route path="security" element={<SecurityCenter />} />
            <Route path="support" element={<SupportInbox />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
    </Suspense>
    </NavDirectionProvider>
  );
};

const PrerollAdWrapper = () => {
  const { showPrerollAd, onPrerollAdComplete, adType } = usePlayer();
  return (
    <Suspense fallback={null}>
      <PrerollAd 
        isOpen={showPrerollAd} 
        onComplete={onPrerollAdComplete}
        onSkip={onPrerollAdComplete}
        adType={adType}
      />
    </Suspense>
  );
};

const PostAuthGate = () => {
  const { user } = useAuth();
  const [showPicker, setShowPicker] = useState(false);
  const [showReview, setShowReview] = useState(false);

  // Open artist picker ONLY immediately after signup (not on every login)
  useEffect(() => {
    if (!user) return;
    const justSignedUp = localStorage.getItem('uf_just_signed_up');
    if (!justSignedUp) return;

    const key = `uf_artists_picked_${user.id}`;
    if (localStorage.getItem(key)) {
      localStorage.removeItem('uf_just_signed_up');
      return;
    }

    // Double-check DB to avoid showing twice across devices
    supabase.from('user_artist_preferences').select('id').eq('user_id', user.id).limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) {
          localStorage.setItem(key, '1');
          localStorage.removeItem('uf_just_signed_up');
        } else {
          setTimeout(() => setShowPicker(true), 600);
        }
      });
  }, [user]);

  const handlePickerComplete = () => {
    localStorage.removeItem('uf_just_signed_up');
    setShowPicker(false);
  };

  if (!user) return null;
  return (
    <>
      <AnimatePresence>
        {showPicker && <ArtistPicker key="picker" onComplete={handlePickerComplete} />}
      </AnimatePresence>
      {!showPicker && <RateUsPopup onOpenReview={() => setShowReview(true)} />}
      <ReviewModal isOpen={showReview} onClose={() => setShowReview(false)} />
    </>
  );
};

const AppContent = () => {
  const [showSplash, setShowSplash] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  usePushRegistration();

  const handleSplashComplete = () => {
    const hasSeenOnboarding = localStorage.getItem('uf_onboarding_done');
    if (hasSeenOnboarding) {
      setShowSplash(false);
    } else {
      setShowSplash(false);
      setShowOnboarding(true);
    }
  };

  const handleOnboardingComplete = () => {
    localStorage.setItem('uf_onboarding_done', '1');
    setShowOnboarding(false);
  };

  return (
    <MobileShell>
      {/* SEOHead removed from App.tsx — it was overwriting per-page titles
          and Open Graph tags on every route. Each page (Home, Premium,
          PlaylistDetail, etc.) now owns its own SEOHead, and index.html
          provides the sitewide fallback for non-JS crawlers. */}
      <Suspense fallback={null}>
        <StructuredData />
      </Suspense>
      <Toaster />
      <AnimatePresence mode="wait">
        {showSplash ? (
          <SplashScreen key="splash" onComplete={handleSplashComplete} />
        ) : showOnboarding ? (
          <Onboarding key="onboarding" onComplete={handleOnboardingComplete} />
        ) : (
          <AnimatedRoutes key="routes" />
        )}
      </AnimatePresence>
      <PrerollAdWrapper />
      <GlobalPlayerLayer />
      <MateHeartButton />
      <PostAuthGate />
      <Suspense fallback={null}>
        <DownloadQueuePanel />
        <PWAInstallBanner />
      </Suspense>
    </MobileShell>
  );
};

const App = () => {
  return (
    <SentryErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <PlayerProvider>
              <PlayWithMateProvider>
                <DownloadProvider>
                  <TooltipProvider>
                    <AppContent />
                  </TooltipProvider>
                </DownloadProvider>
              </PlayWithMateProvider>
            </PlayerProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </SentryErrorBoundary>
  );
};

export default App;