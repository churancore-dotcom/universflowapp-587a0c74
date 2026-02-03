import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Music, Heart, ListMusic, Download, CloudOff, Trash2, User, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayer, Song } from '@/contexts/PlayerContext';
import { useDownloads } from '@/contexts/DownloadContext';
import BottomNav from '@/components/BottomNav';
import MiniPlayer from '@/components/MiniPlayer';
import FullscreenPlayer from '@/components/FullscreenPlayer';
import CreatePlaylistModal from '@/components/CreatePlaylistModal';
import LikeButton from '@/components/LikeButton';
import DownloadButton from '@/components/DownloadButton';
import { TabTransition } from '@/components/PageTransition';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const Library = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { playSong, currentSong } = usePlayer();
  const { downloads, removeSong, getDownloadedUrl, totalStorageUsed, clearAllDownloads } = useDownloads();
  const [likedSongs, setLikedSongs] = useState<Song[]>([]);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [artists, setArtists] = useState<{ id?: string; name: string; songCount: number; photoUrl: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('liked');
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);

  useEffect(() => {
    if (user) fetchLibrary();
  }, [user]);

  const fetchLibrary = async () => {
    if (!user) return;

    const [liked, userPlaylists, artistsData] = await Promise.all([
      supabase
        .from('user_library')
        .select('*, songs(*, artists(id, name, photo_url))')
        .eq('user_id', user.id)
        .order('added_at', { ascending: false })
        .limit(20),
      supabase
        .from('playlists')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('artists')
        .select('id, name, photo_url')
        .order('name')
        .limit(10),
    ]);

    if (liked.data) {
      setLikedSongs(liked.data.map(l => ({
        id: l.songs.id,
        title: l.songs.title,
        artist: l.songs.artist,
        album: l.songs.album || undefined,
        cover_url: l.songs.cover_url || undefined,
        audio_url: l.songs.audio_url,
        artist_id: (l.songs as any)?.artists?.id || l.songs.artist_id || undefined,
        artist_photo_url: (l.songs as any)?.artists?.photo_url || undefined,
      })));
    }

    if (userPlaylists.data) setPlaylists(userPlaylists.data);
    if (artistsData.data) setArtists(artistsData.data.map(a => ({ id: a.id, name: a.name, songCount: 0, photoUrl: a.photo_url })));

    setLoading(false);
  };

  const handlePlaySong = (song: Song) => {
    const offlineUrl = getDownloadedUrl(song.id);
    playSong(song, offlineUrl);
  };

  const SongRow = ({ song, index }: { song: Song; index: number }) => {
    const isActive = currentSong?.id === song.id;
    return (
      <div className={`flex items-center gap-2.5 p-2 rounded-xl ${isActive ? 'bg-primary/10' : 'active:bg-white/5'}`}>
        <button className="flex-1 flex items-center gap-2.5 text-left min-w-0" onClick={() => handlePlaySong(song)}>
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center overflow-hidden flex-shrink-0">
            {song.cover_url ? (
              <img src={song.cover_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <Music className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`font-medium text-sm truncate ${isActive ? 'text-primary' : ''}`}>{song.title}</p>
            <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
          </div>
        </button>
        <div className="flex items-center gap-0.5">
          {isActive ? (
            <div className="flex items-end gap-[2px] h-3 mr-1.5">
              {[0, 1, 2].map((i) => (
                <motion.div key={i} className="w-[2px] bg-primary rounded-full" animate={{ height: [4, 10, 4] }} transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.12 }} />
              ))}
            </div>
          ) : (
            <>
              <LikeButton songId={song.id} size="sm" />
              <DownloadButton song={song} size="sm" />
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <TabTransition>
      <div className="h-[100dvh] bg-black flex flex-col overflow-hidden">
        {/* Header */}
        <header
          className="flex-shrink-0 z-30 px-4 pt-3 pb-2 safe-area-pt"
          style={{
            background: 'rgba(0, 0, 0, 0.9)',
            backdropFilter: 'blur(40px)',
            WebkitBackdropFilter: 'blur(40px)',
            borderBottom: '0.5px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <h1 className="text-xl font-bold">Your Library</h1>
        </header>

        <main className="flex-1 overflow-hidden px-3 pt-2 flex flex-col">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            {/* Tabs */}
            <TabsList className="w-full h-10 p-1 mb-2 rounded-xl grid grid-cols-4 flex-shrink-0" style={{ background: 'rgba(118, 118, 128, 0.12)' }}>
              {[
                { value: 'liked', icon: Heart, label: 'Liked' },
                { value: 'artists', icon: User, label: 'Artists' },
                { value: 'downloads', icon: Download, label: 'Saved' },
                { value: 'playlists', icon: ListMusic, label: 'Lists' },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="h-full rounded-lg gap-1 text-[10px] font-semibold data-[state=active]:bg-white/15 flex flex-col items-center justify-center py-0.5"
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {/* Content - scrollable */}
            <div className="flex-1 overflow-y-auto pb-32" style={{ WebkitOverflowScrolling: 'touch' }}>
              <TabsContent value="liked" className="mt-0 h-full">
                {loading ? (
                  <div className="flex justify-center py-8">
                    <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  </div>
                ) : likedSongs.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: 'rgba(118, 118, 128, 0.12)' }}>
                      <Heart className="w-7 h-7 text-muted-foreground/50" />
                    </div>
                    <p className="text-muted-foreground text-sm">No liked songs yet</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {likedSongs.map((song, i) => <SongRow key={`${song.id}-${i}`} song={song} index={i} />)}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="artists" className="mt-0">
                {loading ? (
                  <div className="flex justify-center py-8">
                    <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  </div>
                ) : artists.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: 'rgba(118, 118, 128, 0.12)' }}>
                      <User className="w-7 h-7 text-muted-foreground/50" />
                    </div>
                    <p className="text-muted-foreground text-sm">No artists yet</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    {artists.map((artist) => (
                      <button
                        key={artist.id}
                        className="flex flex-col items-center p-2 rounded-xl active:bg-white/5"
                        onClick={() => artist.id && navigate(`/artist/${artist.id}`)}
                      >
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center overflow-hidden mb-2">
                          {artist.photoUrl ? (
                            <img src={artist.photoUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-6 h-6 text-muted-foreground" />
                          )}
                        </div>
                        <p className="text-xs font-medium text-center truncate w-full">{artist.name}</p>
                      </button>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="downloads" className="mt-0">
                {downloads.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: 'rgba(118, 118, 128, 0.12)' }}>
                      <CloudOff className="w-7 h-7 text-muted-foreground/50" />
                    </div>
                    <p className="text-muted-foreground text-sm">No downloads yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(118, 118, 128, 0.12)' }}>
                      <div>
                        <p className="text-xs font-medium">{downloads.length} songs</p>
                        <p className="text-[10px] text-muted-foreground">{formatBytes(totalStorageUsed)}</p>
                      </div>
                      <button className="px-3 py-1.5 rounded-lg text-xs font-medium text-destructive bg-destructive/10" onClick={clearAllDownloads}>
                        Clear
                      </button>
                    </div>
                    <div className="space-y-1">
                      {downloads.map((song, i) => (
                        <div key={`dl-${song.id}-${i}`} className={`flex items-center gap-2.5 p-2 rounded-xl ${currentSong?.id === song.id ? 'bg-primary/10' : 'active:bg-white/5'}`}>
                          <button className="flex-1 flex items-center gap-2.5 text-left" onClick={() => handlePlaySong(song)}>
                            <div className="relative w-10 h-10 rounded-lg bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center overflow-hidden">
                              {song.cover_url ? <img src={song.cover_url} alt="" className="w-full h-full object-cover" /> : <Music className="w-4 h-4 text-muted-foreground" />}
                              <div className="absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full bg-primary flex items-center justify-center">
                                <CloudOff className="w-2 h-2 text-primary-foreground" />
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`font-medium text-sm truncate ${currentSong?.id === song.id ? 'text-primary' : ''}`}>{song.title}</p>
                              <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
                            </div>
                          </button>
                          <button className="p-1.5 text-muted-foreground" onClick={() => removeSong(song.id)}>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="playlists" className="mt-0">
                <button
                  className="w-full flex items-center gap-3 p-3 rounded-xl mb-2"
                  style={{ background: 'rgba(118, 118, 128, 0.12)' }}
                  onClick={() => setShowCreatePlaylist(true)}
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                    <Plus className="w-5 h-5 text-primary" />
                  </div>
                  <span className="text-sm font-medium">Create Playlist</span>
                </button>
                {playlists.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-muted-foreground text-xs">No playlists yet</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {playlists.map((playlist) => (
                      <button
                        key={playlist.id}
                        className="w-full flex items-center gap-2.5 p-2 rounded-xl active:bg-white/5 text-left"
                        onClick={() => navigate(`/playlist/${playlist.id}`)}
                      >
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center overflow-hidden">
                          {playlist.cover_url ? <img src={playlist.cover_url} alt="" className="w-full h-full object-cover" /> : <ListMusic className="w-4 h-4 text-muted-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{playlist.title}</p>
                          <p className="text-xs text-muted-foreground">Playlist</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </TabsContent>
            </div>
          </Tabs>
        </main>

        <BottomNav />
        <MiniPlayer />
        <FullscreenPlayer />
        {showCreatePlaylist && <CreatePlaylistModal isOpen={showCreatePlaylist} onClose={() => setShowCreatePlaylist(false)} onCreated={fetchLibrary} />}
      </div>
    </TabTransition>
  );
};

export default Library;