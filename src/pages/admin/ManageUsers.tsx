import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  Search, 
  Shield, 
  ShieldOff, 
  MoreVertical, 
  Mail, 
  Calendar,
  Music,
  Heart,
  Clock,
  UserX,
  Crown
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
  library_count?: number;
  playlist_count?: number;
}

const ManageUsers = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({
    total: 0,
    admins: 0,
    thisMonth: 0,
  });

  useEffect(() => {
    fetchUsers();

    // Realtime for profiles
    const channel = supabase
      .channel('admin-users-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, fetchUsers)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_subscriptions' }, fetchUsers)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchUsers = async () => {
    try {
      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch admin roles
      const { data: adminRoles } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .eq('role', 'admin');

      const adminUserIds = new Set((adminRoles || []).map(r => r.user_id));

      // Fetch library counts
      const { data: libraryCounts } = await supabase
        .from('user_library')
        .select('user_id');

      // Fetch playlist counts
      const { data: playlistCounts } = await supabase
        .from('playlists')
        .select('user_id');

      // Map counts to users
      const libraryMap: Record<string, number> = {};
      const playlistMap: Record<string, number> = {};

      (libraryCounts || []).forEach(item => {
        libraryMap[item.user_id] = (libraryMap[item.user_id] || 0) + 1;
      });

      (playlistCounts || []).forEach(item => {
        if (item.user_id) {
          playlistMap[item.user_id] = (playlistMap[item.user_id] || 0) + 1;
        }
      });

      const usersWithCounts = (profiles || []).map(profile => ({
        ...profile,
        is_admin: adminUserIds.has(profile.user_id),
        library_count: libraryMap[profile.user_id] || 0,
        playlist_count: playlistMap[profile.user_id] || 0,
      }));

      setUsers(usersWithCounts);

      // Calculate stats
      const now = new Date();
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      setStats({
        total: usersWithCounts.length,
        admins: usersWithCounts.filter(u => u.is_admin).length,
        thisMonth: usersWithCounts.filter(u => new Date(u.created_at) >= thisMonth).length,
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
    const action = newStatus ? 'grant admin privileges to' : 'revoke admin privileges from';
    
    if (!confirm(`Are you sure you want to ${action} ${user.email || user.username || 'this user'}?`)) {
      return;
    }

    try {
      if (newStatus) {
        // Grant admin role
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: user.user_id, role: 'admin' });
        if (error) throw error;
      } else {
        // Revoke admin role
        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', user.user_id)
          .eq('role', 'admin');
        if (error) throw error;
      }

      toast.success(newStatus ? 'Admin privileges granted' : 'Admin privileges revoked');
      fetchUsers();
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Failed to update user');
    }
  };

  const filteredUsers = users.filter(user =>
    (user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
     user.username?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getInitials = (email: string | null, username: string | null) => {
    if (username) return username.slice(0, 2).toUpperCase();
    if (email) return email.slice(0, 2).toUpperCase();
    return 'U';
  };

  return (
    <div className="p-4 md:p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-2xl md:text-3xl font-display font-bold">Manage Users</h1>
        <p className="text-muted-foreground mt-1">View and manage user accounts</p>
      </motion.div>

      {/* Stats Cards */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="glass rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total Users</p>
          </div>
        </div>
        <div className="glass rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
            <Crown className="w-5 h-5 text-accent" />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.admins}</p>
            <p className="text-xs text-muted-foreground">Admins</p>
          </div>
        </div>
        <div className="glass rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-green-500" />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.thisMonth}</p>
            <p className="text-xs text-muted-foreground">New This Month</p>
          </div>
        </div>
      </motion.div>

      {/* Search */}
      <motion.div
        className="mb-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search users by email or username..."
            className="pl-10 bg-muted/50 border-white/10"
          />
        </div>
      </motion.div>

      {/* Users Grid */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        {loading ? (
          <div className="col-span-full p-12 text-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="col-span-full p-12 text-center text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>{searchQuery ? 'No users match your search' : 'No users found'}</p>
          </div>
        ) : (
          <AnimatePresence>
            {filteredUsers.map((user, index) => (
              <motion.div
                key={user.id}
                className="glass rounded-2xl p-4 hover:ring-1 hover:ring-primary/30 transition-all"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: index * 0.03 }}
              >
                <div className="flex items-start gap-4">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={user.avatar_url || undefined} />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground">
                      {getInitials(user.email, user.username)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{user.username || user.email || 'Anonymous'}</p>
                      {user.is_admin && (
                        <Badge variant="secondary" className="bg-accent/20 text-accent text-xs">
                          <Crown className="w-3 h-3 mr-1" />
                          Admin
                        </Badge>
                      )}
                    </div>
                    {user.email && user.username && (
                      <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Heart className="w-3 h-3" />
                        {user.library_count} liked
                      </span>
                      <span className="flex items-center gap-1">
                        <Music className="w-3 h-3" />
                        {user.playlist_count} playlists
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Joined {formatDate(user.created_at)}
                    </p>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="glass border-white/10">
                      <DropdownMenuItem onClick={() => user.email && window.open(`mailto:${user.email}`)}>
                        <Mail className="w-4 h-4 mr-2" /> Send Email
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => toggleAdminStatus(user)}>
                        {user.is_admin ? (
                          <><ShieldOff className="w-4 h-4 mr-2" /> Remove Admin</>
                        ) : (
                          <><Shield className="w-4 h-4 mr-2" /> Make Admin</>
                        )}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </motion.div>
    </div>
  );
};

export default ManageUsers;
