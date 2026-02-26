import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Mail, Settings, LogOut, Shield, Music, Heart, Clock, ChevronRight, BarChart3, Crown, Edit2, Check, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePremium } from '@/hooks/usePremium';
import BottomNav from '@/components/BottomNav';
import MiniPlayer from '@/components/MiniPlayer';
import FullscreenPlayer from '@/components/FullscreenPlayer';
import ListeningStats from '@/components/ListeningStats';
import RedeemCodeModal from '@/components/RedeemCodeModal';
import { TabTransition } from '@/components/PageTransition';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface ProfileData {
  username: string | null;
  username_changed: boolean;
}

const Profile = () => {
  const { user, isAdmin, signOut } = useAuth();
  const { isPremium } = usePremium();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ likedSongs: 0, recentPlays: 0, playlists: 0 });
  const [showStats, setShowStats] = useState(false);
  const [showRedeemCode, setShowRedeemCode] = useState(false);
  const [profileData, setProfileData] = useState<ProfileData>({ username: null, username_changed: false });
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user) {
      fetchStats();
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('username, username_changed')
      .eq('user_id', user.id)
      .single();
    
    if (data) {
      setProfileData({
        username: data.username,
        username_changed: (data as any).username_changed || false,
      });
      setNewUsername(data.username || '');
    }
  };

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

  const handleSaveUsername = async () => {
    if (!user || !newUsername.trim()) return;
    
    if (newUsername.trim().length < 3) {
      toast.error('Username must be at least 3 characters');
      return;
    }
    
    if (newUsername.trim().length > 20) {
      toast.error('Username must be less than 20 characters');
      return;
    }
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          username: newUsername.trim(),
          username_changed: true,
        })
        .eq('user_id', user.id);
      
      if (error) throw error;
      
      setProfileData(prev => ({ ...prev, username: newUsername.trim(), username_changed: true }));
      setIsEditingUsername(false);
      toast.success('Username updated!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update username');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  const displayName = profileData.username || user?.email?.split('@')[0] || 'User';
  const canChangeUsername = !profileData.username_changed;

  return (
    <TabTransition>
      <div className="h-[100dvh] bg-background flex flex-col overflow-hidden">
        {/* Header */}
        <header
          className="flex-shrink-0 z-30 px-4 pt-3 pb-2 safe-area-pt"
          style={{
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(40px)',
            WebkitBackdropFilter: 'blur(40px)',
          }}
        >
          <h1 className="text-xl font-bold">Profile</h1>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto px-4 pt-3 pb-32" style={{ WebkitOverflowScrolling: 'touch' }}>
          {/* Profile Card */}
          <div
            className="rounded-2xl p-4 mb-4"
            style={{
              background: 'rgba(28, 28, 30, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <div className="flex items-center gap-4">
              <div
                className="relative w-14 h-14 rounded-full flex items-center justify-center"
                style={{
                  background: isPremium
                    ? 'linear-gradient(135deg, #fbbf24, #f59e0b)'
                    : 'linear-gradient(135deg, hsl(211 100% 50%), hsl(328 100% 54%))',
                }}
              >
                <User className="w-7 h-7 text-white" />
                {isPremium && (
                  <div
                    className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', border: '2px solid rgba(28, 28, 30, 0.9)' }}
                  >
                    <Crown className="w-2.5 h-2.5 text-white" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {isEditingUsername ? (
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        className="h-8 text-sm bg-white/10 border-white/20"
                        placeholder="Enter username"
                        maxLength={20}
                        autoFocus
                      />
                      <button
                        onClick={handleSaveUsername}
                        disabled={isSaving}
                        className="w-7 h-7 rounded-full bg-green-500/20 flex items-center justify-center"
                      >
                        <Check className="w-4 h-4 text-green-400" />
                      </button>
                      <button
                        onClick={() => {
                          setIsEditingUsername(false);
                          setNewUsername(profileData.username || '');
                        }}
                        className="w-7 h-7 rounded-full bg-red-500/20 flex items-center justify-center"
                      >
                        <X className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <h2 className="text-base font-bold truncate">{displayName}</h2>
                      {canChangeUsername && (
                        <button
                          onClick={() => setIsEditingUsername(true)}
                          className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center"
                        >
                          <Edit2 className="w-3 h-3 text-muted-foreground" />
                        </button>
                      )}
                      {isPremium && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-bold" style={{ background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', color: '#000' }}>
                          PREMIUM
                        </span>
                      )}
                    </>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate flex items-center gap-1.5 mt-0.5">
                  <Mail className="w-3 h-3" />
                  {user?.email}
                </p>
                {!canChangeUsername && !isEditingUsername && (
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">Username can only be changed once</p>
                )}
                {isAdmin && (
                  <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: 'hsl(211 100% 50% / 0.2)', color: 'hsl(211 100% 60%)' }}>
                    <Shield className="w-2.5 h-2.5" /> Admin
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { icon: Heart, label: 'Liked', value: stats.likedSongs, color: 'from-pink-500 to-rose-500' },
              { icon: Clock, label: 'Plays', value: stats.recentPlays, color: 'from-cyan-500 to-blue-500' },
              { icon: Music, label: 'Playlists', value: stats.playlists, color: 'from-purple-500 to-violet-500' },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="rounded-xl p-3 text-center" style={{ background: 'rgba(28, 28, 30, 0.8)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <div className={`w-8 h-8 rounded-lg mx-auto mb-1.5 flex items-center justify-center bg-gradient-to-br ${stat.color}`}>
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <p className="text-lg font-bold">{stat.value}</p>
                  <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                </div>
              );
            })}
          </div>

          {/* Menu Items */}
          <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(28, 28, 30, 0.8)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
            {isAdmin && (
              <button onClick={() => navigate('/admin')} className="w-full flex items-center gap-3 px-4 py-3 text-left border-b border-white/[0.06] active:bg-white/5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/20"><Shield className="w-4 h-4 text-primary" /></div>
                <span className="flex-1 text-sm font-medium">Admin Panel</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
            <button onClick={() => setShowStats(true)} className="w-full flex items-center gap-3 px-4 py-3 text-left border-b border-white/[0.06] active:bg-white/5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-purple-500/20"><BarChart3 className="w-4 h-4 text-purple-400" /></div>
              <span className="flex-1 text-sm font-medium">Your Stats</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
            <button onClick={() => navigate('/settings')} className="w-full flex items-center gap-3 px-4 py-3 text-left border-b border-white/[0.06] active:bg-white/5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/10"><Settings className="w-4 h-4 text-foreground" /></div>
              <span className="flex-1 text-sm font-medium">Settings</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
            <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-white/5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-destructive/20"><LogOut className="w-4 h-4 text-destructive" /></div>
              <span className="flex-1 text-sm font-medium text-destructive">Sign Out</span>
            </button>
          </div>

          {/* Premium Section */}
          {!isPremium && (
            <button
              onClick={() => setShowRedeemCode(true)}
              className="w-full mt-4 rounded-xl p-4 text-left"
              style={{ background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(168, 85, 247, 0.1))', border: '1px solid rgba(139, 92, 246, 0.2)' }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #8b5cf6, #a855f7)' }}>
                  <Crown className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <span className="font-semibold text-sm block">Upgrade to Premium</span>
                  <span className="text-[10px] text-muted-foreground">Ad-free · Offline · HQ Audio</span>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>
            </button>
          )}
        </main>

        <BottomNav />
        <MiniPlayer />
        <FullscreenPlayer />
        {showStats && <ListeningStats isOpen={showStats} onClose={() => setShowStats(false)} />}
        {showRedeemCode && <RedeemCodeModal isOpen={showRedeemCode} onClose={() => setShowRedeemCode(false)} />}
      </div>
    </TabTransition>
  );
};

export default Profile;