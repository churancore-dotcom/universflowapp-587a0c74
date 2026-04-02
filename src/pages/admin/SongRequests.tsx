import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Clock, Music, Play, Pause, Loader2, Search, User, Mail, Calendar, Tag, Headphones } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface SongRequest {
  id: string;
  title: string;
  artist: string;
  audio_url: string;
  cover_url: string | null;
  genre: string | null;
  mood: string | null;
  status: string;
  created_at: string;
  user_id: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

interface UserProfile {
  user_id: string;
  username: string | null;
  email: string | null;
  avatar_url: string | null;
}

const SongRequests = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<SongRequest[]>([]);
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('pending');
  const [search, setSearch] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioEl] = useState(() => new Audio());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('song_requests').select('*').order('created_at', { ascending: false });
    if (filter !== 'all') query = query.eq('status', filter);
    const { data } = await query;
    const reqs = data || [];
    setRequests(reqs);

    // Fetch user profiles for all unique user_ids
    const userIds = [...new Set(reqs.map(r => r.user_id))];
    if (userIds.length > 0) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('user_id, username, email, avatar_url')
        .in('user_id', userIds);
      
      const profileMap: Record<string, UserProfile> = {};
      (profileData || []).forEach(p => { profileMap[p.user_id] = p; });
      setProfiles(profileMap);
    }

    setLoading(false);
  }, [filter]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  useEffect(() => {
    return () => { audioEl.pause(); audioEl.src = ''; };
  }, [audioEl]);

  const togglePreview = (req: SongRequest) => {
    if (playingId === req.id) {
      audioEl.pause();
      setPlayingId(null);
    } else {
      audioEl.src = req.audio_url;
      audioEl.play();
      setPlayingId(req.id);
    }
  };

  const handleAccept = async (req: SongRequest) => {
    setProcessing(req.id);
    try {
      const { error: songErr } = await supabase.from('songs').insert({
        title: req.title,
        artist: req.artist,
        audio_url: req.audio_url,
        cover_url: req.cover_url,
        genre: req.genre,
        mood: req.mood,
        is_visible: true,
        show_in_new_releases: true,
      });
      if (songErr) throw songErr;

      const { error } = await supabase.from('song_requests').update({
        status: 'accepted',
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      }).eq('id', req.id);
      if (error) throw error;

      toast.success(`"${req.title}" has been added to the library!`);
      fetchRequests();
    } catch (err: any) {
      toast.error(err.message || 'Failed to accept request');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (req: SongRequest) => {
    setProcessing(req.id);
    try {
      const { error } = await supabase.from('song_requests').update({
        status: 'rejected',
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      }).eq('id', req.id);
      if (error) throw error;

      toast.success(`"${req.title}" has been rejected`);
      fetchRequests();
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject request');
    } finally {
      setProcessing(null);
    }
  };

  const handleDelete = async (req: SongRequest) => {
    if (!confirm('Delete this request permanently?')) return;
    setProcessing(req.id);
    try {
      const { error } = await supabase.from('song_requests').delete().eq('id', req.id);
      if (error) throw error;
      toast.success('Request deleted');
      fetchRequests();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete');
    } finally {
      setProcessing(null);
    }
  };

  const filtered = requests.filter(r =>
    r.title.toLowerCase().includes(search.toLowerCase()) ||
    r.artist.toLowerCase().includes(search.toLowerCase()) ||
    profiles[r.user_id]?.email?.toLowerCase().includes(search.toLowerCase()) ||
    profiles[r.user_id]?.username?.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    accepted: requests.filter(r => r.status === 'accepted').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Song Requests</h1>
        <p className="text-muted-foreground text-sm">Review and manage user song submissions</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-blue-500/10 border-blue-500/20">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-400">{stats.total}</p>
            <p className="text-xs text-blue-400/70">Total</p>
          </CardContent>
        </Card>
        <Card className="bg-yellow-500/10 border-yellow-500/20">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-yellow-400">{stats.pending}</p>
            <p className="text-xs text-yellow-400/70">Pending</p>
          </CardContent>
        </Card>
        <Card className="bg-green-500/10 border-green-500/20">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-400">{stats.accepted}</p>
            <p className="text-xs text-green-400/70">Accepted</p>
          </CardContent>
        </Card>
        <Card className="bg-red-500/10 border-red-500/20">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-400">{stats.rejected}</p>
            <p className="text-xs text-red-400/70">Rejected</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'pending', 'accepted', 'rejected'] as const).map(f => (
          <Button key={f} variant={filter === f ? 'default' : 'outline'} size="sm" onClick={() => setFilter(f)} className="capitalize">
            {f}
          </Button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search by title, artist, email, username..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* Requests List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Music className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p>No requests found</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {filtered.map(req => {
              const profile = profiles[req.user_id];
              const isExpanded = expandedId === req.id;

              return (
                <motion.div
                  key={req.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <Card className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        {/* Cover / Preview */}
                        <button
                          className="relative w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-muted"
                          onClick={() => togglePreview(req)}
                        >
                          {req.cover_url ? (
                            <img src={req.cover_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Music className="w-5 h-5 text-muted-foreground" />
                            </div>
                          )}
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                            {playingId === req.id ? (
                              <Pause className="w-5 h-5 text-white" fill="white" />
                            ) : (
                              <Play className="w-5 h-5 text-white ml-0.5" fill="white" />
                            )}
                          </div>
                        </button>

                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{req.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{req.artist}</p>
                          
                          {/* Requester info */}
                          <div className="flex items-center gap-2 mt-1.5">
                            <Avatar className="w-4 h-4">
                              <AvatarFallback className="text-[8px] bg-primary/20 text-primary">
                                {profile?.username?.charAt(0)?.toUpperCase() || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-[10px] text-muted-foreground truncate">
                              {profile?.username || profile?.email || 'Unknown user'}
                            </span>
                          </div>

                          <div className="flex gap-1.5 mt-1 flex-wrap">
                            {req.genre && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">{req.genre}</span>}
                            {req.mood && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent-foreground">{req.mood}</span>}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-1.5 flex-shrink-0 items-end">
                          {req.status === 'pending' ? (
                            <div className="flex gap-1.5">
                              <Button size="sm" variant="outline" className="h-8 w-8 p-0 border-green-500/30 hover:bg-green-500/20" onClick={() => handleAccept(req)} disabled={processing === req.id}>
                                {processing === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4 text-green-400" />}
                              </Button>
                              <Button size="sm" variant="outline" className="h-8 w-8 p-0 border-red-500/30 hover:bg-red-500/20" onClick={() => handleReject(req)} disabled={processing === req.id}>
                                <XCircle className="w-4 h-4 text-red-400" />
                              </Button>
                            </div>
                          ) : (
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                              req.status === 'accepted' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                            }`}>
                              {req.status}
                            </span>
                          )}
                          <button onClick={() => setExpandedId(isExpanded ? null : req.id)} className="text-[10px] text-primary">
                            {isExpanded ? 'Less' : 'Details'}
                          </button>
                        </div>
                      </div>

                      {/* Expanded details */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                  <User className="w-3 h-3" />
                                  <span>Username: <span className="text-foreground">{profile?.username || 'Not set'}</span></span>
                                </div>
                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                  <Mail className="w-3 h-3" />
                                  <span className="truncate">Email: <span className="text-foreground">{profile?.email || 'N/A'}</span></span>
                                </div>
                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                  <Calendar className="w-3 h-3" />
                                  <span>Submitted: <span className="text-foreground">{formatDate(req.created_at)}</span></span>
                                </div>
                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                  <Tag className="w-3 h-3" />
                                  <span>Genre: <span className="text-foreground">{req.genre || 'N/A'}</span></span>
                                </div>
                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                  <Headphones className="w-3 h-3" />
                                  <span>Mood: <span className="text-foreground">{req.mood || 'N/A'}</span></span>
                                </div>
                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                  <Clock className="w-3 h-3" />
                                  <span>Status: <span className="text-foreground capitalize">{req.status}</span></span>
                                </div>
                              </div>
                              {req.reviewed_at && (
                                <p className="text-[10px] text-muted-foreground/60">
                                  Reviewed on {formatDate(req.reviewed_at)}
                                </p>
                              )}
                              {req.status !== 'pending' && (
                                <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => handleDelete(req)}>
                                  Delete Request
                                </Button>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default SongRequests;
