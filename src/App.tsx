import { useState, useEffect } from 'react';
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { PlayerProvider, usePlayer } from "./contexts/PlayerContext";
import { DownloadProvider } from "./contexts/DownloadContext";
import SplashScreen from "./components/SplashScreen";
import DownloadQueuePanel from "./components/DownloadQueuePanel";
import PrerollAd from "./components/ads/PrerollAd";
import Auth from "./pages/Auth";
import Home from "./pages/Home";
import Search from "./pages/Search";
import Library from "./pages/Library";
import PlaylistDetail from "./pages/PlaylistDetail";
import ArtistDetail from "./pages/ArtistDetail";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Support from "./pages/Support";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import UploadMusic from "./pages/admin/UploadMusic";
import ManageSongs from "./pages/admin/ManageSongs";
import ManageArtists from "./pages/admin/ManageArtists";
import ManageAlbums from "./pages/admin/ManageAlbums";
import ManagePlaylists from "./pages/admin/ManagePlaylists";
import ManageUsers from "./pages/admin/ManageUsers";
import ManageSubscriptions from "./pages/admin/ManageSubscriptions";
import DonationHistory from "./pages/admin/DonationHistory";
import AppSettings from "./pages/admin/AppSettings";
import FeatureFlags from "./pages/admin/FeatureFlags";
import Announcements from "./pages/admin/Announcements";
import ContentModeration from "./pages/admin/ContentModeration";
import AdminSettings from "./pages/admin/Settings";
import Analytics from "./pages/admin/Analytics";
import ActivityLogs from "./pages/admin/ActivityLogs";
import BulkActions from "./pages/admin/BulkActions";
import SystemHealth from "./pages/admin/SystemHealth";
import ContentScheduler from "./pages/admin/ContentScheduler";
import BackupExport from "./pages/admin/BackupExport";
import AddFriend from "./pages/AddFriend";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="min-h-screen bg-background" />;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isAdmin, isLoading } = useAuth();
  if (isLoading) return <div className="min-h-screen bg-background" />;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/home" replace />;
  return <>{children}</>;
};

const AnimatedRoutes = () => {
  const location = useLocation();
  const { user } = useAuth();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={user ? <Navigate to="/home" replace /> : <Navigate to="/auth" replace />} />
        <Route path="/auth" element={user ? <Navigate to="/home" replace /> : <Auth />} />
        <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="/search" element={<ProtectedRoute><Search /></ProtectedRoute>} />
        <Route path="/library" element={<ProtectedRoute><Library /></ProtectedRoute>} />
        <Route path="/playlist/:id" element={<ProtectedRoute><PlaylistDetail /></ProtectedRoute>} />
        <Route path="/artist/:artistId" element={<ProtectedRoute><ArtistDetail /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/support" element={<ProtectedRoute><Support /></ProtectedRoute>} />
        <Route path="/add-friend/:shareCode" element={<AddFriend />} />
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
          <Route path="settings" element={<AdminSettings />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AnimatePresence>
  );
};

const PrerollAdWrapper = () => {
  const { showPrerollAd, onPrerollAdComplete } = usePlayer();
  return (
    <PrerollAd 
      isOpen={showPrerollAd} 
      onComplete={onPrerollAdComplete}
      onSkip={onPrerollAdComplete}
    />
  );
};

const AppRoutes = () => {
  const [showSplash, setShowSplash] = useState(true);

  return (
    <>
      <AnimatePresence mode="wait">
        {showSplash ? (
          <SplashScreen key="splash" onComplete={() => setShowSplash(false)} />
        ) : (
          <AnimatedRoutes key="routes" />
        )}
      </AnimatePresence>
      <PrerollAdWrapper />
    </>
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
                <Toaster />
                <AppRoutes />
                <DownloadQueuePanel />
              </TooltipProvider>
            </DownloadProvider>
          </PlayerProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
