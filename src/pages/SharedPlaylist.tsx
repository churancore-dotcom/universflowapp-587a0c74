import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Music, Loader2, Crown, Play, Download, ChevronLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePremium } from '@/hooks/usePremium';
import { toast } from 'sonner';
import SEOHead from '@/components/SEOHead';

interface PlaylistRow {
  id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  user_id: string | null;
}

interface PlaylistSongRow {
  song_id: string;
  position: number;
  track_source: string;
}

interface SongRow {
  id: string;
  title: string;
  artist: string;
  cover_url: string | null;
}

const SharedPlaylist = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isPremium } = usePremium();
  const [loading, setLoading] = useState(true);
  const [playlist, setPlaylist] = useState<PlaylistRow | null>(null);
  const [songs, setSongs] = useState<SongRow[]>([]);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      const { data: pl } = await supabase
        .from('playlists')
        .select('id, title, description, cover_url, user_id')
        .eq('share_token', token)
        .maybeSingle();
      if (cancelled) return;
      if (!pl) { setLoading(false); return; }
      setPlaylist(pl as PlaylistRow);

      const { data: rows } = await supabase
        .from('playlist_songs')
        .select('song_id, position, track_source')
        .eq('playlist_id', pl.id)
        .order('position');
      const ids = (rows as PlaylistSongRow[] | null)?.filter(r => r.track_source === 'library').map(r => r.song_id) || [];
      if (ids.length) {
        const { data: songRows } = await supabase
          .from('songs')
          .select('id, title, artist, cover_url')
          .in('id', ids);
        if (!cancelled) setSongs((songRows || []) as SongRow[]);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [token]);

  const handleImport = async () => {
    if (!user) { navigate(`/auth?redirect=/p/${token}`); return; }
    if (!isPremium) {
      toast.error('Importing shared playlists is a Premium feature.');
      navigate('/premium');
      return;
    }
    if (!token) return;
    setImporting(true);
    const { data, error } = await supabase.rpc('import_shared_playlist', { p_share_token: token });
    setImporting(false);
    if (error) { toast.error(error.message || 'Import failed'); return; }
    toast.success('Playlist saved to your library');
    navigate(`/playlist/${data}`);
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center text-center px-6">
        <Music className="w-12 h-12 text-muted-foreground/40 mb-3" />
        <p className="font-semibold">Shared playlist not found</p>
        <p className="text-xs text-muted-foreground mt-1">The link may have expired.</p>
        <Link to="/home" className="mt-6 px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-semibold">Go home</Link>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background pb-32">
      <SEOHead title={`${playlist.title} • Shared playlist`} description={playlist.description || `Listen to ${playlist.title} on Universflow`} />

      <header className="sticky top-0 z-30 px-4 py-3 safe-area-pt flex items-center gap-3 bg-background/85 backdrop-blur-xl border-b border-white/5">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-white/10">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <p className="font-semibold truncate flex-1">Shared playlist</p>
      </header>

      <div className="px-6 py-6 text-center">
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="w-44 h-44 mx-auto rounded-2xl shadow-2xl overflow-hidden"
          style={{ background: 'linear-gradient(135deg, hsl(var(--primary) / 0.4), hsl(var(--accent) / 0.4))' }}
        >
          {playlist.cover_url ? (
            <img src={playlist.cover_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center"><Music className="w-16 h-16 text-white/40" /></div>
          )}
        </motion.div>
        <h1 className="mt-5 text-2xl font-bold tracking-tight">{playlist.title}</h1>
        {playlist.description && <p className="mt-1 text-sm text-muted-foreground">{playlist.description}</p>}
        <p className="mt-2 text-xs text-muted-foreground">{songs.length} songs</p>

        <button
          onClick={handleImport}
          disabled={importing}
          className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-full font-bold text-[15px]"
          style={{
            background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))',
            color: 'hsl(var(--primary-foreground))',
            boxShadow: '0 14px 40px -10px hsl(var(--primary) / 0.6)',
          }}
        >
          {importing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
          Save to my library
        </button>
        {!isPremium && (
          <p className="mt-3 text-[11px] text-muted-foreground inline-flex items-center gap-1.5 justify-center">
            <Crown className="w-3 h-3 text-primary" /> Premium feature
          </p>
        )}
      </div>

      <div className="px-4 space-y-1">
        {songs.map((s, i) => (
          <div key={s.id} className="flex items-center gap-3 p-2.5 rounded-xl">
            <div className="w-11 h-11 rounded-xl overflow-hidden bg-white/5 flex items-center justify-center">
              {s.cover_url ? <img src={s.cover_url} alt="" className="w-full h-full object-cover" /> : <Music className="w-4 h-4 text-muted-foreground" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{s.title}</p>
              <p className="text-xs text-muted-foreground truncate">{s.artist}</p>
            </div>
            <span className="text-[11px] text-muted-foreground tabular-nums">{i + 1}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SharedPlaylist;
