import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, Search, Shield, ShieldOff, MoreVertical, Mail, Calendar,
  Music, Heart, Clock, Crown, Ban, PlayCircle, UserCheck
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface UserProfile {
  id: string;
  user_id: string;
  email: string | null;
  username: string | null;
  avatar_url: string | null;
  is_admin: boolean;
  created_at: string;
  status: string;
  library_count?: number;
  playlist_count?: number;
  play_count?: number;
}

const ManageUsers = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'banned' | 'suspended'>('all');
  const [stats, setStats] = useState({ total: 0, admins: 0, thisMonth: 0, banned: 0, active: 0 });

  useEffect(() => {
    fetchUsers();
    const channel = supabase
      .channel('admin-users-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, fetchUsers)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchUsers = async () => {
    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;

      const { data: adminRoles } = await supabase.from('user_roles').select('user_id, role').eq('role', 'admin');
      const adminUserIds = new Set((adminRoles || []).map(r => r.user_id));

      const { data: libraryCounts } = await supabase.from('user_library').select('user_id');
      const { data: playlistCounts } = await supabase.from('playlists').select('user_id');
      const { data: playCounts } = await supabase.from('recently_played').select('user_id');

      const libraryMap: Record<string, number> = {};
      const playlistMap: Record<string, number> = {};
      const playMap: Record<string, number> = {};

      (libraryCounts || []).forEach(i => { libraryMap[i.user_id] = (libraryMap[i.user_id] || 0) + 1; });
      (playlistCounts || []).forEach(i => { if (i.user_id) playlistMap[i.user_id] = (playlistMap[i.user_id] || 0) + 1; });
      (playCounts || []).forEach(i => { playMap[i.user_id] = (playMap[i.user_id] || 0) + 1; });

      const usersWithCounts = (profiles || []).map(profile => ({
        ...profile,
        status: (profile as any).status || 'active',
        is_admin: adminUserIds.has(profile.user_id),
        library_count: libraryMap[profile.user_id] || 0,
        playlist_count: playlistMap[profile.user_id] || 0,
        play_count: playMap[profile.user_id] || 0,
      }));

      setUsers(usersWithCounts);

      const now = new Date();
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      setStats({
        total: usersWithCounts.length,
        admins: usersWithCounts.filter(u => u.is_admin).length,
        thisMonth: usersWithCounts.filter(u => new Date(u.created_at) >= thisMonth).length,
        banned: usersWithCounts.filter(u => u.status === 'banned').length,
        active: usersWithCounts.filter(u => u.status === 'active').length,
      });
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const toggleAdminStatus = async (user: UserProfile) => {
    const newStatus = !user.is_admin;
    if (!confirm(`${newStatus ? 'Grant admin to' : 'Revoke admin from'} ${user.email || user.username}?`)) return;
    try {
      if (newStatus) {
        await supabase.from('user_roles').insert({ user_id: user.user_id, role: 'admin' });
      } else {
        await supabase.from('user_roles').delete().eq('user_id', user.user_id).eq('role', 'admin');
      }
      toast.success(newStatus ? 'Admin granted' : 'Admin revoked');
      fetchUsers();
    } catch { toast.error('Failed to update'); }
  };

  const updateUserStatus = async (user: UserProfile, newStatus: 'active' | 'banned' | 'suspended') => {
    const action = newStatus === 'banned' ? 'ban' : newStatus === 'suspended' ? 'suspend' : 'activate';
    if (!confirm(`${action} ${user.email || user.username}?`)) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: newStatus })
        .eq('user_id', user.user_id);
      if (error) throw error;
      toast.success(`User ${action === 'ban' ? 'banned' : action === 'suspend' ? 'suspended' : 'activated'} successfully`);
      fetchUsers();
    } catch (err) {
      console.error('Status update error:', err);
      toast.error('Failed to update user status');
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.username?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterStatus === 'all' || user.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  const getInitials = (email: string | null, username: string | null) => {
    if (username) return username.slice(0, 2).toUpperCase();
    if (email) return email.slice(0, 2).toUpperCase();
    return 'U';
  };

  return (
    <div className="p-4 md:p-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-2xl md:text-3xl font-display font-bold">Manage Users</h1>
        <p className="text-muted-foreground mt-1">View, manage, ban or suspend user accounts</p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Total', value: stats.total, icon: Users, color: 'primary' },
          { label: 'Active', value: stats.active, icon: UserCheck, color: 'green-500' },
          { label: 'Admins', value: stats.admins, icon: Crown, color: 'accent' },
          { label: 'Banned', value: stats.banned, icon: Ban, color: 'red-500' },
          { label: 'New This Month', value: stats.thisMonth, icon: Calendar, color: 'blue-500' },
        ].map(s => (
          <div key={s.label} className="glass rounded-xl p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg bg-${s.color}/20 flex items-center justify-center`}>
              <s.icon className={`w-5 h-5 text-${s.color}`} />
            </div>
            <div>
              <p className="text-xl font-bold">{s.value}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter + Search */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex gap-2">
          {(['all', 'active', 'banned', 'suspended'] as const).map(f => (
            <Button key={f} variant={filterStatus === f ? 'default' : 'outline'} size="sm" onClick={() => setFilterStatus(f)} className="capitalize text-xs">
              {f}
            </Button>
          ))}
        </div>
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search users..." className="pl-10 bg-muted/50 border-white/10" />
        </div>
      </div>

      {/* Users Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full p-12 text-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="col-span-full p-12 text-center text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No users found</p>
          </div>
        ) : (
          <AnimatePresence>
            {filteredUsers.map((u, i) => (
              <motion.div
                key={u.id}
                className={`glass rounded-2xl p-4 hover:ring-1 hover:ring-primary/30 transition-all ${u.status === 'banned' ? 'opacity-60 border-red-500/20' : u.status === 'suspended' ? 'opacity-75 border-yellow-500/20' : ''}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
              >
                <div className="flex items-start gap-4">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={u.avatar_url || undefined} />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground">
                      {getInitials(u.email, u.username)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">{u.username || u.email || 'Anonymous'}</p>
                      {u.is_admin && (
                        <Badge variant="secondary" className="bg-accent/20 text-accent text-[10px]">
                          <Crown className="w-2.5 h-2.5 mr-0.5" /> Admin
                        </Badge>
                      )}
                      {u.status === 'banned' && (
                        <Badge variant="destructive" className="text-[10px]">Banned</Badge>
                      )}
                      {u.status === 'suspended' && (
                        <Badge className="bg-yellow-500/20 text-yellow-400 text-[10px]">Suspended</Badge>
                      )}
                    </div>
                    {u.email && u.username && (
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{u.library_count}</span>
                      <span className="flex items-center gap-1"><Music className="w-3 h-3" />{u.playlist_count}</span>
                      <span className="flex items-center gap-1"><PlayCircle className="w-3 h-3" />{u.play_count} plays</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Joined {formatDate(u.created_at)}
                    </p>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="glass border-white/10">
                      <DropdownMenuItem onClick={() => u.email && window.open(`mailto:${u.email}`)}>
                        <Mail className="w-4 h-4 mr-2" /> Send Email
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => toggleAdminStatus(u)}>
                        {u.is_admin ? <><ShieldOff className="w-4 h-4 mr-2" /> Remove Admin</> : <><Shield className="w-4 h-4 mr-2" /> Make Admin</>}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {u.status !== 'banned' && (
                        <DropdownMenuItem onClick={() => updateUserStatus(u, 'banned')} className="text-red-400">
                          <Ban className="w-4 h-4 mr-2" /> Ban User
                        </DropdownMenuItem>
                      )}
                      {u.status !== 'suspended' && u.status !== 'banned' && (
                        <DropdownMenuItem onClick={() => updateUserStatus(u, 'suspended')} className="text-yellow-400">
                          <Clock className="w-4 h-4 mr-2" /> Suspend User
                        </DropdownMenuItem>
                      )}
                      {(u.status === 'banned' || u.status === 'suspended') && (
                        <DropdownMenuItem onClick={() => updateUserStatus(u, 'active')} className="text-green-400">
                          <UserCheck className="w-4 h-4 mr-2" /> Activate User
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};

export default ManageUsers;
