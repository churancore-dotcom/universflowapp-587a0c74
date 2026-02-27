import { useState, memo, forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { 
  LayoutDashboard, 
  Upload, 
  Music, 
  Disc, 
  ListMusic, 
  Users, 
  Settings, 
  BarChart3, 
  LogOut,
  ChevronLeft,
  Menu,
  X,
  Crown,
  Heart,
  Palette,
  ToggleLeft,
  Bell,
  Shield,
  Gift,
  Key,
  DollarSign,
  Zap,
  FlaskConical,
  Lock,
  Globe
} from 'lucide-react';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/admin' },
  { icon: Upload, label: 'Upload Music', path: '/admin/upload' },
  { icon: Music, label: 'Manage Songs', path: '/admin/songs' },
  { icon: Users, label: 'Manage Artists', path: '/admin/artists' },
  { icon: Disc, label: 'Manage Albums', path: '/admin/albums' },
  { icon: ListMusic, label: 'Playlists', path: '/admin/playlists' },
  { icon: Users, label: 'Users', path: '/admin/users' },
  { icon: Crown, label: 'Subscriptions', path: '/admin/subscriptions' },
  { icon: Heart, label: 'Donations', path: '/admin/donations' },
  { icon: Gift, label: 'Promo Codes', path: '/admin/promo-codes' },
  { icon: DollarSign, label: 'Revenue', path: '/admin/revenue' },
  { icon: Zap, label: 'Engagement', path: '/admin/engagement' },
  { icon: Bell, label: 'Push Notifications', path: '/admin/notifications' },
  { icon: FlaskConical, label: 'A/B Testing', path: '/admin/ab-testing' },
  { icon: Key, label: 'API Management', path: '/admin/api' },
  { icon: Lock, label: 'Security', path: '/admin/security' },
  { icon: Palette, label: 'App Settings', path: '/admin/app-settings' },
  { icon: ToggleLeft, label: 'Feature Flags', path: '/admin/features' },
  { icon: Bell, label: 'Announcements', path: '/admin/announcements' },
  { icon: Shield, label: 'Moderation', path: '/admin/moderation' },
  { icon: BarChart3, label: 'Analytics', path: '/admin/analytics' },
  { icon: BarChart3, label: 'Bulk Actions', path: '/admin/bulk' },
  { icon: BarChart3, label: 'Activity Logs', path: '/admin/logs' },
  { icon: BarChart3, label: 'System Health', path: '/admin/health' },
  { icon: BarChart3, label: 'Scheduler', path: '/admin/scheduler' },
  { icon: BarChart3, label: 'Backup', path: '/admin/backup' },
  { icon: Settings, label: 'Settings', path: '/admin/settings' },
  { icon: Globe, label: 'Jamendo Library', path: '/admin/jamendo' },
];

const AdminLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    setSidebarOpen(false);
  };

  const SidebarContent = forwardRef<HTMLDivElement>((_, ref) => (
    <div ref={ref} className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 md:p-6 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Music className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display font-bold text-lg">Univers Flow</h1>
              <p className="text-xs text-muted-foreground">Admin Panel</p>
            </div>
          </div>
          <button
            className="md:hidden p-2 rounded-lg hover:bg-white/10 transition-colors"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 md:p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-white/5 hover:text-foreground active:scale-[0.98]'
              }`}
              onClick={() => handleNavigation(item.path)}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="truncate">{item.label}</span>
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 md:p-4 border-t border-white/5 space-y-2">
        <button
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:bg-white/5 hover:text-foreground transition-all active:scale-[0.98]"
          onClick={() => handleNavigation('/home')}
        >
          <ChevronLeft className="w-5 h-5 flex-shrink-0" />
          <span>Back to App</span>
        </button>
        <button
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-all active:scale-[0.98]"
          onClick={handleLogout}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  ));

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center justify-between safe-area-pt">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Music className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-display font-bold">Admin</span>
        </div>
        <button
          className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          onClick={() => setSidebarOpen(true)}
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              className="md:hidden fixed inset-0 bg-black/60 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              className="md:hidden fixed left-0 top-0 bottom-0 w-72 bg-background border-r border-white/5 z-50 flex flex-col safe-area-pt safe-area-pb"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            >
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 glass-strong border-r border-white/5 flex-col flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto pt-14 md:pt-0">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
