import { useState, lazy, Suspense, forwardRef } from 'react';
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, NavigateProps } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { PlayerProvider, usePlayer } from "./contexts/PlayerContext";
import { DownloadProvider } from "./contexts/DownloadContext";
import SplashScreen from "./components/SplashScreen";
import Onboarding from "./components/Onboarding";
import MobileShell from "./components/MobileShell";
import { NavDirectionProvider } from "./components/PageTransition";
import SEOHead from "./components/SEOHead";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

// Ref-safe Navigate wrapper for AnimatePresence
const AnimatedNavigate = forwardRef<HTMLDivElement, NavigateProps>((props, ref) => (
  <div ref={ref} style={{ display: 'none' }}><Navigate {...props} /></div>
));
AnimatedNavigate.displayName = 'AnimatedNavigate';

// Lazy load all non-critical routes
const Home = lazy(() => import("./pages/Home"));
const Search = lazy(() => import("./pages/Search"));
const Library = lazy(() => import("./pages/Library"));
const PlaylistDetail = lazy(() => import("./pages/PlaylistDetail"));
const ArtistDetail = lazy(() => import("./pages/ArtistDetail"));
const Profile = lazy(() => import("./pages/Profile"));
const Settings = lazy(() => import("./pages/Settings"));
const Support = lazy(() => import("./pages/Support"));
import OfflinePlayerShell from "./components/OfflinePlayerShell";
const Offline = lazy(() => import("./pages/Offline"));
const WidgetPreview = lazy(() => import("./pages/WidgetPreview"));

const DownloadQueuePanel = lazy(() => import("./components/DownloadQueuePanel"));
const PrerollAd = lazy(() => import("./components/ads/PrerollAd"));
const PWAInstallBanner = lazy(() => import("./components/PWAInstallBanner"));
const ConnectionTroubleshoot = lazy(() => import("./components/ConnectionTroubleshoot"));
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
const DonationHistory = lazy(() => import("./pages/admin/DonationHistory"));
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
const APIManagement = lazy(() => import("./pages/admin/APIManagement"));
const PushNotifications = lazy(() => import("./pages/admin/PushNotifications"));
const RevenueAnalytics = lazy(() => import("./pages/admin/RevenueAnalytics"));
const UserEngagement = lazy(() => import("./pages/admin/UserEngagement"));
const ABTesting = lazy(() => import("./pages/admin/ABTesting"));
const SecurityCenter = lazy(() => import("./pages/admin/SecurityCenter"));
const JamendoBrowse = lazy(() => import("./pages/admin/JamendoBrowse"));
const DeezerImport = lazy(() => import("./pages/admin/DeezerImport"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const LazyFallback = () => <div className="min-h-screen bg-background" />;

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <LazyFallback />;
  if (!user) return <AnimatedNavigate to="/auth" replace />;
  return <>{children}</>;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isAdmin, isLoading } = useAuth();
  if (isLoading) return <LazyFallback />;
  if (!user) return <AnimatedNavigate to="/auth" replace />;
  if (!isAdmin) return <AnimatedNavigate to="/home" replace />;
  return <>{children}</>;
};

const AnimatedRoutes = forwardRef<HTMLDivElement>((_props, ref) => {
  const location = useLocation();
  const { user, isOffline } = useAuth();

  return (
    <NavDirectionProvider>
    <Suspense fallback={<LazyFallback />}>
      <AnimatePresence mode="wait" initial={false}>
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={
            user ? <AnimatedNavigate to="/home" replace /> : 
            <AnimatedNavigate to="/auth" replace />
          } />
          <Route path="/auth" element={
            user ? <AnimatedNavigate to="/home" replace /> : 
            <Auth />
          } />
          <Route path="/offline-player" element={<OfflinePlayerShell />} />
          <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/search" element={<ProtectedRoute><Search /></ProtectedRoute>} />
          <Route path="/library" element={<ProtectedRoute><Library /></ProtectedRoute>} />
          <Route path="/playlist/:id" element={<ProtectedRoute><PlaylistDetail /></ProtectedRoute>} />
          <Route path="/artist/:artistId" element={<ProtectedRoute><ArtistDetail /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/support" element={<ProtectedRoute><Support /></ProtectedRoute>} />
          <Route path="/offline" element={<ProtectedRoute><Offline /></ProtectedRoute>} />
          <Route path="/widgets" element={<ProtectedRoute><WidgetPreview /></ProtectedRoute>} />
          
          <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
            <Route index element={<AdminDashboard />} />
            <Route path="upload" element={<UploadMusic />} />
            <Route path="songs" element={<ManageSongs />} />
            <Route path="artists" element={<ManageArtists />} />
            <Route path="albums" element={<ManageAlbums />} />
            <Route path="playlists" element={<ManagePlaylists />} />
            <Route path="users" element={<ManageUsers />} />
            <Route path="subscriptions" element={<ManageSubscriptions />} />
            <Route path="donations" element={<DonationHistory />} />
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
            <Route path="settings" element={<AdminSettings />} />
            <Route path="api" element={<APIManagement />} />
            <Route path="notifications" element={<PushNotifications />} />
            <Route path="revenue" element={<RevenueAnalytics />} />
            <Route path="engagement" element={<UserEngagement />} />
            <Route path="ab-testing" element={<ABTesting />} />
            <Route path="security" element={<SecurityCenter />} />
            <Route path="jamendo" element={<JamendoBrowse />} />
            <Route path="deezer" element={<DeezerImport />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AnimatePresence>
    </Suspense>
    </NavDirectionProvider>
  );
});
AnimatedRoutes.displayName = 'AnimatedRoutes';

const PrerollAdWrapper = () => {
  try {
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
  } catch {
    return null;
  }
};

const AppContent = () => {
  const [showSplash, setShowSplash] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

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
      <SEOHead />
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
      <Suspense fallback={null}>
        <DownloadQueuePanel />
        <PWAInstallBanner />
        <ConnectionTroubleshoot />
      </Suspense>
    </MobileShell>
  );
};

const App = () => {
  return (
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
  );
};

export default App;