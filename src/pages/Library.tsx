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
import { LibrarySkeleton, LibraryArtistsSkeleton } from '@/components/PageSkeletons';

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

    // Re-fetch when tab becomes visible (catches like changes from other pages)
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && user) fetchLibrary();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
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
      <motion.div
        className="flex items-center gap-2.5 p-2.5 rounded-xl"
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.03 }}
        style={{
          background: isActive ? 'hsl(var(--primary) / 0.08)' : 'transparent',
        }}
      >
        <button className="flex-1 flex items-center gap-2.5 text-left min-w-0" onClick={() => handlePlaySong(song)}>
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '0.5px solid rgba(255,255,255,0.06)',
            }}
          >
            {song.cover_url ? (
              <img src={song.cover_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <Music className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`font-semibold text-sm truncate ${isActive ? 'text-primary' : 'text-foreground'}`}>{song.title}</p>
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
      </motion.div>
    );
  };

  const EmptyState = ({ icon: Icon, text }: { icon: any; text: string }) => (
    <div className="text-center py-10">
      <div
        className="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center"
        style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.06)' }}
      >
        <Icon className="w-7 h-7 text-muted-foreground/40" />
      </div>
      <p className="text-muted-foreground text-sm">{text}</p>
    </div>
  );

  return (
    <TabTransition>
      <div className="h-[100dvh] bg-background flex flex-col overflow-hidden relative">
        {/* Ambient background */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute inset-0"
            style={{
              background: `
                radial-gradient(ellipse 70% 40% at 20% 10%, hsl(350 100% 60% / 0.04), transparent),
                radial-gradient(ellipse 50% 30% at 80% 60%, hsl(260 100% 65% / 0.03), transparent)
              `,
            }}
          />
        </div>

        {/* Header — glassmorphism */}
        <header
          className="flex-shrink-0 z-30 px-4 pt-3 pb-2.5 safe-area-pt"
          style={{
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(40px) saturate(180%)',
            WebkitBackdropFilter: 'blur(40px) saturate(180%)',
            borderBottom: '0.5px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          <motion.h1
            className="text-2xl font-bold tracking-tight"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            Your Library
          </motion.h1>
        </header>

        <main className="flex-1 overflow-hidden px-3 pt-2.5 flex flex-col relative z-10">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            {/* Tabs — glassmorphism */}
            <TabsList
              className="w-full h-11 p-1 mb-3 rounded-xl grid grid-cols-4 flex-shrink-0"
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '0.5px solid rgba(255, 255, 255, 0.06)',
              }}
            >
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
                    className="h-full rounded-lg gap-1 text-[10px] font-semibold data-[state=active]:bg-primary/15 data-[state=active]:text-primary flex flex-col items-center justify-center py-0.5 transition-all"
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {/* Content — scrollable */}
            <div className="flex-1 overflow-y-auto pb-32" style={{ WebkitOverflowScrolling: 'touch' }}>
              <TabsContent value="liked" className="mt-0 h-full">
                {loading ? (
                  <LibrarySkeleton />
                ) : likedSongs.length === 0 ? (
                  <EmptyState icon={Heart} text="No liked songs yet" />
                ) : (
                  <div className="space-y-0.5">
                    {likedSongs.map((song, i) => <SongRow key={`${song.id}-${i}`} song={song} index={i} />)}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="artists" className="mt-0">
                {loading ? (
                  <LibraryArtistsSkeleton />
                ) : artists.length === 0 ? (
                  <EmptyState icon={User} text="No artists yet" />
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    {artists.map((artist, i) => (
                      <motion.button
                        key={artist.id}
                        className="flex flex-col items-center p-3 rounded-2xl active:scale-95 transition-transform"
                        onClick={() => artist.id && navigate(`/artist/${artist.id}`)}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.05 }}
                        style={{
                          background: 'rgba(255,255,255,0.03)',
                          border: '0.5px solid rgba(255,255,255,0.06)',
                        }}
                      >
                        <div
                          className="w-16 h-16 rounded-full flex items-center justify-center overflow-hidden mb-2"
                          style={{
                            background: 'linear-gradient(135deg, hsl(var(--primary) / 0.2), hsl(var(--accent) / 0.2))',
                            border: '1.5px solid rgba(255,255,255,0.08)',
                          }}
                        >
                          {artist.photoUrl ? (
                            <img src={artist.photoUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-6 h-6 text-muted-foreground" />
                          )}
                        </div>
                        <p className="text-xs font-medium text-center truncate w-full">{artist.name}</p>
                      </motion.button>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="downloads" className="mt-0">
                {downloads.length === 0 ? (
                  <EmptyState icon={CloudOff} text="No downloads yet" />
                ) : (
                  <div className="space-y-2.5">
                    <div
                      className="flex items-center justify-between p-3.5 rounded-xl"
                      style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '0.5px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      <div>
                        <p className="text-xs font-semibold">{downloads.length} songs</p>
                        <p className="text-[10px] text-muted-foreground">{formatBytes(totalStorageUsed)}</p>
                      </div>
                      <button
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-destructive"
                        style={{ background: 'hsl(var(--destructive) / 0.1)' }}
                        onClick={clearAllDownloads}
                      >
                        Clear All
                      </button>
                    </div>
                    <div className="space-y-0.5">
                      {downloads.map((song, i) => (
                        <motion.div
                          key={`dl-${song.id}-${i}`}
                          className="flex items-center gap-2.5 p-2.5 rounded-xl"
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.03 }}
                          style={{
                            background: currentSong?.id === song.id ? 'hsl(var(--primary) / 0.08)' : 'transparent',
                          }}
                        >
                          <button className="flex-1 flex items-center gap-2.5 text-left" onClick={() => handlePlaySong(song)}>
                            <div className="relative w-11 h-11 rounded-xl flex items-center justify-center overflow-hidden"
                              style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.06)' }}
                            >
                              {song.cover_url ? <img src={song.cover_url} alt="" className="w-full h-full object-cover" /> : <Music className="w-4 h-4 text-muted-foreground" />}
                              <div className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-primary flex items-center justify-center">
                                <CloudOff className="w-2 h-2 text-primary-foreground" />
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`font-semibold text-sm truncate ${currentSong?.id === song.id ? 'text-primary' : 'text-foreground'}`}>{song.title}</p>
                              <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
                            </div>
                          </button>
                          <button className="p-2 text-muted-foreground active:scale-90 transition-transform" onClick={() => removeSong(song.id)}>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="playlists" className="mt-0">
                <motion.button
                  className="w-full flex items-center gap-3 p-3.5 rounded-xl mb-3"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '0.5px solid rgba(255,255,255,0.06)',
                  }}
                  onClick={() => setShowCreatePlaylist(true)}
                  whileTap={{ scale: 0.97 }}
                >
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center"
                    style={{ background: 'hsl(var(--primary) / 0.15)' }}
                  >
                    <Plus className="w-5 h-5 text-primary" />
                  </div>
                  <span className="text-sm font-semibold">Create Playlist</span>
                </motion.button>
                {playlists.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-muted-foreground text-xs">No playlists yet</p>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {playlists.map((playlist, i) => (
                      <motion.button
                        key={playlist.id}
                        className="w-full flex items-center gap-2.5 p-2.5 rounded-xl text-left active:scale-[0.98] transition-transform"
                        onClick={() => navigate(`/playlist/${playlist.id}`)}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                      >
                        <div
                          className="w-11 h-11 rounded-xl flex items-center justify-center overflow-hidden"
                          style={{
                            background: 'rgba(255,255,255,0.04)',
                            border: '0.5px solid rgba(255,255,255,0.06)',
                          }}
                        >
                          {playlist.cover_url ? <img src={playlist.cover_url} alt="" className="w-full h-full object-cover" /> : <ListMusic className="w-4 h-4 text-muted-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{playlist.title}</p>
                          <p className="text-xs text-muted-foreground">Playlist</p>
                        </div>
                      </motion.button>
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
