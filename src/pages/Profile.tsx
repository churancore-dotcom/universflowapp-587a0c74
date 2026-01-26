import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Mail, Settings, LogOut, Shield, Music, Heart, Clock, ChevronRight, BarChart3, Users, Zap, Gift, Crown, Coffee, Sparkles, Headphones, MessageCircle, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePremium } from '@/hooks/usePremium';
import BottomNav from '@/components/BottomNav';
import MiniPlayer from '@/components/MiniPlayer';
import FullscreenPlayer from '@/components/FullscreenPlayer';
import ListeningStats from '@/components/ListeningStats';
import FriendActivity from '@/components/FriendActivity';
import FriendsManager from '@/components/FriendsManager';
import DedicationsInbox from '@/components/DedicationsInbox';
import Crossfade from '@/components/Crossfade';
import AdvancedAudioSettings from '@/components/AdvancedAudioSettings';
import RedeemCodeModal from '@/components/RedeemCodeModal';
import { SheetTransition } from '@/components/PageTransition';
import Footer from '@/components/Footer';
import { iosSpring, iosBounce } from '@/lib/animations';

const Profile = () => {
  const { user, isAdmin, signOut } = useAuth();
  const { isPremium } = usePremium();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ likedSongs: 0, recentPlays: 0, playlists: 0 });
  const [showStats, setShowStats] = useState(false);
  const [showFriendActivity, setShowFriendActivity] = useState(false);
  const [showFriendsManager, setShowFriendsManager] = useState(false);
  const [showDedications, setShowDedications] = useState(false);
  const [showCrossfade, setShowCrossfade] = useState(false);
  const [showAudioSettings, setShowAudioSettings] = useState(false);
  const [showRedeemCode, setShowRedeemCode] = useState(false);

  useEffect(() => {
    if (user) fetchStats();
  }, [user]);

  const fetchStats = async () => {
    if (!user) return;

    const [liked, recent, playlists] = await Promise.all([
      supabase.from('user_library').select('id').eq('user_id', user.id),
      supabase.from('recently_played').select('id').eq('user_id', user.id),
      supabase.from('playlists').select('id').eq('user_id', user.id),
    ]);

    setStats({
      likedSongs: liked.data?.length || 0,
      recentPlays: recent.data?.length || 0,
      playlists: playlists.data?.length || 0,
    });
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  const menuItems = [
    ...(isAdmin ? [{ icon: Shield, label: 'Admin Panel', action: () => navigate('/admin'), color: 'text-primary' }] : []),
    { icon: BarChart3, label: 'Your Stats', action: () => setShowStats(true), color: 'text-purple-400' },
    { icon: Users, label: 'Friends', action: () => setShowFriendsManager(true), color: 'text-blue-400' },
    { icon: Gift, label: 'Song Dedications', action: () => setShowDedications(true), color: 'text-pink-400' },
    { icon: Users, label: 'Friend Activity', action: () => setShowFriendActivity(true), color: 'text-green-400' },
    { icon: Zap, label: 'Playback Settings', action: () => setShowCrossfade(true), color: 'text-cyan-400' },
    { icon: Settings, label: 'Settings', action: () => navigate('/settings'), color: 'text-foreground' },
    { icon: LogOut, label: 'Sign Out', action: handleLogout, color: 'text-destructive', destructive: true },
  ];

  return (
    <SheetTransition>
      <motion.div 
        className="min-h-screen bg-background pb-40 overflow-y-auto overflow-x-hidden"
        style={{ WebkitOverflowScrolling: 'touch' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
      {/* iOS-style header */}
      <motion.header
        className="sticky top-0 z-30 px-5 pt-4 pb-3 safe-area-pt"
        style={{
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
        }}
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={iosSpring}
      >
        <motion.h1 
          className="text-[28px] font-bold"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ ...iosSpring, delay: 0.1 }}
        >
          Profile
        </motion.h1>
      </motion.header>

      <main className="px-5 pt-6">
        {/* Profile Card - iOS style */}
        <motion.div
          className="rounded-3xl p-6 mb-6"
          style={{
            background: 'rgba(28, 28, 30, 0.8)',
            backdropFilter: 'blur(40px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={iosSpring}
        >
          <div className="flex items-center gap-5">
            <motion.div 
              className="relative w-20 h-20 rounded-full flex items-center justify-center"
              style={{
                background: isPremium 
                  ? 'linear-gradient(135deg, #fbbf24, #f59e0b)'
                  : 'linear-gradient(135deg, hsl(211 100% 50%), hsl(328 100% 54%))',
                boxShadow: isPremium 
                  ? '0 8px 30px -5px rgba(251, 191, 36, 0.5)'
                  : '0 8px 30px -5px hsl(211 100% 50% / 0.4)',
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={iosBounce}
            >
              <User className="w-10 h-10 text-white" />
              {isPremium && (
                <motion.div 
                  className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                    border: '2px solid rgba(28, 28, 30, 0.9)',
                  }}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={iosBounce}
                >
                  <Crown className="w-3.5 h-3.5 text-white" />
                </motion.div>
              )}
            </motion.div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <motion.h2 
                  className="text-xl font-bold truncate"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ ...iosSpring, delay: 0.15 }}
                >
                  {user?.email?.split('@')[0] || 'User'}
                </motion.h2>
                {isPremium && (
                  <motion.span 
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                    style={{
                      background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                      color: '#000',
                    }}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ ...iosBounce, delay: 0.2 }}
                  >
                    <Star className="w-2.5 h-2.5" /> PREMIUM
                  </motion.span>
                )}
              </div>
              <motion.p 
                className="text-sm text-muted-foreground truncate flex items-center gap-2 mt-1"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <Mail className="w-4 h-4" />
                {user?.email}
              </motion.p>
              {isAdmin && (
                <motion.span 
                  className="inline-flex items-center gap-1 mt-2 px-3 py-1 rounded-full text-xs font-semibold"
                  style={{
                    background: 'hsl(211 100% 50% / 0.2)',
                    color: 'hsl(211 100% 60%)',
                  }}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ ...iosBounce, delay: 0.25 }}
                >
                  <Shield className="w-3 h-3" /> Admin
                </motion.span>
              )}
            </div>
          </div>
        </motion.div>

        {/* Stats - iOS style cards */}
        <motion.div
          className="grid grid-cols-3 gap-3 mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...iosSpring, delay: 0.15 }}
        >
          {[
            { icon: Heart, label: 'Liked', value: stats.likedSongs, color: 'from-pink-500 to-rose-500' },
            { icon: Clock, label: 'Plays', value: stats.recentPlays, color: 'from-cyan-500 to-blue-500' },
            { icon: Music, label: 'Playlists', value: stats.playlists, color: 'from-purple-500 to-violet-500' },
          ].map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.label}
                className="rounded-2xl p-4 text-center"
                style={{
                  background: 'rgba(28, 28, 30, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                }}
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ ...iosBounce, delay: 0.2 + index * 0.08 }}
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.97 }}
              >
                <motion.div 
                  className={`w-10 h-10 rounded-xl mx-auto mb-2 flex items-center justify-center bg-gradient-to-br ${stat.color}`}
                  whileHover={{ rotate: [0, -10, 10, 0] }}
                  transition={{ duration: 0.4 }}
                >
                  <Icon className="w-5 h-5 text-white" />
                </motion.div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Premium & Support Section */}
        <motion.div
          className="rounded-2xl overflow-hidden mb-6"
          style={{
            background: isPremium 
              ? 'linear-gradient(135deg, rgba(251, 191, 36, 0.15), rgba(245, 158, 11, 0.1))'
              : 'linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(168, 85, 247, 0.1))',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...iosSpring, delay: 0.25 }}
        >
          <motion.button
            className="w-full flex items-center gap-4 px-5 py-4 text-left border-b border-white/[0.06]"
            onClick={() => isPremium ? navigate('/support') : setShowRedeemCode(true)}
            whileTap={{ scale: 0.98, backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
          >
            <motion.div 
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: isPremium 
                  ? 'linear-gradient(135deg, #fbbf24, #f59e0b)'
                  : 'linear-gradient(135deg, #8b5cf6, #a855f7)',
              }}
              whileHover={{ scale: 1.1, rotate: [0, -5, 5, 0] }}
              transition={iosBounce}
            >
              <Crown className="w-5 h-5 text-white" />
            </motion.div>
            <div className="flex-1 min-w-0">
              <span className="font-semibold block">
                {isPremium ? 'Premium Member' : 'Upgrade to Premium'}
              </span>
              {isPremium ? (
                <span className="text-xs text-muted-foreground">Manage your subscription</span>
              ) : (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-500/20 text-purple-300">
                    Ad-free
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/20 text-blue-300">
                    Offline
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/20 text-emerald-300">
                    HQ Audio
                  </span>
                </div>
              )}
            </div>
            {isPremium && (
              <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400 shrink-0">
                Active
              </span>
            )}
            <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
          </motion.button>

          {/* Get Code via Telegram */}
          {!isPremium && (
            <motion.a
              href="https://t.me/ERRORMATRIXx"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center gap-4 px-5 py-4 text-left border-b border-white/[0.06]"
              whileTap={{ scale: 0.98, backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
            >
              <motion.div 
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: 'linear-gradient(135deg, #0088cc, #229ED9)',
                }}
                whileHover={{ scale: 1.1, rotate: [0, -5, 5, 0] }}
                transition={iosBounce}
              >
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
                </svg>
              </motion.div>
              <div className="flex-1">
                <span className="font-semibold block">Get Premium Code</span>
                <span className="text-xs text-muted-foreground">Message @ERRORMATRIXx on Telegram</span>
              </div>
              <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 shrink-0">
                Free
              </span>
              <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
            </motion.a>
          )}

          <motion.button
            className="w-full flex items-center gap-4 px-5 py-4 text-left"
            onClick={() => navigate('/support')}
            whileTap={{ scale: 0.98, backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
          >
            <motion.div 
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #ec4899, #f43f5e)',
              }}
              whileHover={{ scale: 1.1, rotate: [0, -5, 5, 0] }}
              transition={iosBounce}
            >
              <Coffee className="w-5 h-5 text-white" />
            </motion.div>
            <div className="flex-1">
              <span className="font-semibold block">Buy me a Coffee</span>
              <span className="text-xs text-muted-foreground">Support the app development</span>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </motion.button>
        </motion.div>

        {/* Premium Exclusive Section - Only visible for premium users */}
        {isPremium && (
          <motion.div
            className="rounded-2xl overflow-hidden mb-6"
            style={{
              background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.1), rgba(245, 158, 11, 0.05))',
              border: '1px solid rgba(251, 191, 36, 0.2)',
            }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...iosSpring, delay: 0.3 }}
          >
            <div className="px-5 py-3 border-b border-amber-500/10">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-semibold text-amber-400">Premium Exclusives</span>
              </div>
            </div>

            <motion.button
              className="w-full flex items-center gap-4 px-5 py-4 text-left border-b border-white/[0.06]"
              onClick={() => navigate('/library?filter=exclusive')}
              whileTap={{ scale: 0.98, backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
            >
              <motion.div 
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)' }}
                whileHover={{ scale: 1.1 }}
                transition={iosBounce}
              >
                <Music className="w-5 h-5 text-white" />
              </motion.div>
              <div className="flex-1">
                <span className="font-semibold block">Exclusive Content</span>
                <span className="text-xs text-muted-foreground">Premium-only songs & early releases</span>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
            </motion.button>

            <motion.button
              className="w-full flex items-center gap-4 px-5 py-4 text-left border-b border-white/[0.06]"
              onClick={() => setShowAudioSettings(true)}
              whileTap={{ scale: 0.98, backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
            >
              <motion.div 
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'linear-gradient(135deg, #06b6d4, #0891b2)' }}
                whileHover={{ scale: 1.1 }}
                transition={iosBounce}
              >
                <Headphones className="w-5 h-5 text-white" />
              </motion.div>
              <div className="flex-1">
                <span className="font-semibold block">Advanced Audio</span>
                <span className="text-xs text-muted-foreground">HQ audio, equalizer & spatial sound</span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-cyan-500/20 text-cyan-400 shrink-0">
                Lossless
              </span>
              <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
            </motion.button>

            <motion.button
              className="w-full flex items-center gap-4 px-5 py-4 text-left"
              onClick={() => navigate('/support?tab=priority')}
              whileTap={{ scale: 0.98, backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
            >
              <motion.div 
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
                whileHover={{ scale: 1.1 }}
                transition={iosBounce}
              >
                <MessageCircle className="w-5 h-5 text-white" />
              </motion.div>
              <div className="flex-1">
                <span className="font-semibold block">Priority Support</span>
                <span className="text-xs text-muted-foreground">Direct chat & faster responses</span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/20 text-emerald-400 shrink-0">
                24/7
              </span>
              <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
            </motion.button>
          </motion.div>
        )}

        {/* Menu Items - iOS style list */}
        <motion.div
          className="rounded-2xl overflow-hidden"
          style={{
            background: 'rgba(28, 28, 30, 0.8)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
          }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...iosSpring, delay: 0.35 }}
        >
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.button
                key={item.label}
                className={`w-full flex items-center gap-4 px-5 py-4 text-left transition-all ${
                  index !== menuItems.length - 1 ? 'border-b border-white/[0.06]' : ''
                }`}
                onClick={item.action}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ ...iosSpring, delay: 0.4 + index * 0.08 }}
                whileTap={{ 
                  scale: 0.98, 
                  backgroundColor: item.destructive ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255, 255, 255, 0.05)' 
                }}
              >
                <motion.div 
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${item.color}`}
                  style={{
                    background: item.destructive 
                      ? 'rgba(239, 68, 68, 0.15)' 
                      : item.color === 'text-primary' 
                        ? 'rgba(59, 130, 246, 0.15)' 
                        : 'rgba(118, 118, 128, 0.12)',
                  }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  transition={iosBounce}
                >
                  <Icon className={`w-4 h-4 ${item.color}`} />
                </motion.div>
                <span className={`font-medium flex-1 ${item.color}`}>{item.label}</span>
                {!item.destructive && <ChevronRight className="w-5 h-5 text-muted-foreground" />}
              </motion.button>
            );
          })}
        </motion.div>
        
        <Footer />
      </main>

      <BottomNav />
      <MiniPlayer />
      <FullscreenPlayer />
      <ListeningStats isOpen={showStats} onClose={() => setShowStats(false)} />
      <FriendActivity isOpen={showFriendActivity} onClose={() => setShowFriendActivity(false)} />
      <FriendsManager isOpen={showFriendsManager} onClose={() => setShowFriendsManager(false)} />
      <DedicationsInbox isOpen={showDedications} onClose={() => setShowDedications(false)} />
      <Crossfade isOpen={showCrossfade} onClose={() => setShowCrossfade(false)} />
      <AdvancedAudioSettings isOpen={showAudioSettings} onClose={() => setShowAudioSettings(false)} />
      <RedeemCodeModal isOpen={showRedeemCode} onClose={() => setShowRedeemCode(false)} />
      </motion.div>
    </SheetTransition>
  );
};

export default Profile;
