import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Edit2, Trash2, Music, Image, Upload, X, Check, Loader2, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { compressImage, formatBytes } from '@/lib/imageCompression';
import { getDatabaseError } from '@/lib/errorMessages';

interface Artist {
  id: string;
  name: string;
  bio: string | null;
  photo_url: string | null;
  genre: string | null;
  created_at: string;
  song_count?: number;
}

interface Song {
  id: string;
  title: string;
  artist: string;
  artist_id: string | null;
  cover_url: string | null;
}

const genres = ['Pop', 'Rock', 'Hip Hop', 'R&B', 'Electronic', 'Jazz', 'Classical', 'Country', 'Indie', 'Metal', 'Phonk', 'Lo-Fi', 'Bollywood', 'Punjabi', 'Haryanvi'];

const ManageArtists = () => {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [editingArtist, setEditingArtist] = useState<Artist | null>(null);
  const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    bio: '',
    genre: '',
    photo_url: '',
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  useEffect(() => {
    fetchArtists();
    fetchSongs();

    // Realtime subscriptions for admin
    const artistsChannel = supabase
      .channel('admin-artists-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'artists' }, fetchArtists)
      .subscribe();

    const songsChannel = supabase
      .channel('admin-songs-artists')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'songs' }, () => {
        fetchSongs();
        fetchArtists(); // Also refresh artist counts
      })
      .subscribe();

    return () => {
      supabase.removeChannel(artistsChannel);
      supabase.removeChannel(songsChannel);
    };
  }, []);

  const fetchArtists = async () => {
    try {
      // Use raw query since types aren't regenerated yet
      const { data: artistsData, error: artistsError } = await supabase
        .from('artists' as any)
        .select('*')
        .order('name');

      if (artistsError) throw artistsError;

      // Get song counts for each artist
      const { data: songsData, error: songsError } = await supabase
        .from('songs')
        .select('id, artist_id');

      if (songsError) throw songsError;

      const countMap: Record<string, number> = {};
      (songsData as any[] || []).forEach(song => {
        if (song.artist_id) {
          countMap[song.artist_id] = (countMap[song.artist_id] || 0) + 1;
        }
      });

      const artistsWithCounts = (artistsData || []).map((artist: any) => ({
        id: artist.id,
        name: artist.name,
        bio: artist.bio,
        photo_url: artist.photo_url,
        genre: artist.genre,
        created_at: artist.created_at,
        song_count: countMap[artist.id] || 0,
      }));

      setArtists(artistsWithCounts);
    } catch (error) {
      console.error('Error fetching artists:', error);
      toast.error('Failed to load artists');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSongs = async () => {
    try {
      const { data, error } = await supabase
        .from('songs')
        .select('id, title, artist, artist_id, cover_url')
        .order('title');

      if (error) throw error;
      
      // Map with artist_id field
      const songsWithArtistId = (data || []).map((song: any) => ({
        id: song.id,
        title: song.title,
        artist: song.artist,
        artist_id: song.artist_id || null,
        cover_url: song.cover_url,
      }));
      
      setSongs(songsWithArtistId);
    } catch (error) {
      console.error('Error fetching songs:', error);
    }
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImage(file);
      setPhotoFile(compressed);
      setPhotoPreview(URL.createObjectURL(compressed));
    } catch {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const uploadPhoto = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `artists/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('covers')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('covers').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const resetForm = () => {
    setFormData({ name: '', bio: '', genre: '', photo_url: '' });
    setPhotoFile(null);
    setPhotoPreview(null);
    setEditingArtist(null);
  };

  const openEditDialog = (artist: Artist) => {
    setEditingArtist(artist);
    setFormData({
      name: artist.name,
      bio: artist.bio || '',
      genre: artist.genre || '',
      photo_url: artist.photo_url || '',
    });
    setPhotoPreview(artist.photo_url);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Artist name is required');
      return;
    }

    setIsSaving(true);
    try {
      let photoUrl = formData.photo_url;

      if (photoFile) {
        setIsUploading(true);
        photoUrl = await uploadPhoto(photoFile);
        setIsUploading(false);
      }

      const artistData = {
        name: formData.name.trim(),
        bio: formData.bio.trim() || null,
        genre: formData.genre || null,
        photo_url: photoUrl || null,
      };

      if (editingArtist) {
        const { error } = await supabase
          .from('artists' as any)
          .update(artistData)
          .eq('id', editingArtist.id);

        if (error) throw error;
        toast.success('Artist updated!');
      } else {
        const { error } = await supabase
          .from('artists' as any)
          .insert(artistData);

        if (error) throw error;
        toast.success('Artist created!');
      }

      setIsDialogOpen(false);
      resetForm();
      fetchArtists();
    } catch (error: any) {
      toast.error(getDatabaseError(error));
    } finally {
      setIsSaving(false);
      setIsUploading(false);
    }
  };

  const handleDelete = async (artist: Artist) => {
    if (!confirm(`Delete "${artist.name}"? This will unlink all their songs.`)) return;

    try {
      const { error } = await supabase
        .from('artists' as any)
        .delete()
        .eq('id', artist.id);

      if (error) throw error;
      toast.success('Artist deleted');
      fetchArtists();
      fetchSongs();
    } catch (error: any) {
      toast.error(getDatabaseError(error));
    }
  };

  const openAssignDialog = (artist: Artist) => {
    setSelectedArtist(artist);
    setIsAssignDialogOpen(true);
  };

  const assignSongToArtist = async (songId: string, artistId: string | null) => {
    try {
      const artist = artists.find(a => a.id === artistId);
      
      const { error } = await supabase
        .from('songs')
        .update({ 
          artist_id: artistId,
          artist: artist?.name || songs.find(s => s.id === songId)?.artist || 'Unknown'
        })
        .eq('id', songId);

      if (error) throw error;
      
      toast.success(artistId ? 'Song assigned to artist' : 'Song unassigned');
      fetchSongs();
      fetchArtists();
    } catch (error: any) {
      console.error('Error assigning song:', error);
      toast.error('Failed to assign song');
    }
  };

  const getArtistSongs = (artistId: string) => {
    return songs.filter(song => song.artist_id === artistId);
  };

  const getUnassignedSongs = () => {
    return songs.filter(song => !song.artist_id);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Manage Artists</h1>
          <p className="text-muted-foreground">Create artists and assign songs to them</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Add Artist
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingArtist ? 'Edit Artist' : 'Add New Artist'}</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              {/* Photo Upload */}
              <div className="flex flex-col items-center gap-4">
                <div className="relative w-32 h-32 rounded-full overflow-hidden bg-muted border-2 border-dashed border-border">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User className="w-12 h-12 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoSelect}
                    />
                    <Button type="button" variant="outline" size="sm" asChild>
                      <span className="gap-2">
                        <Upload className="w-4 h-4" />
                        {photoPreview ? 'Change' : 'Upload'} Photo
                      </span>
                    </Button>
                  </label>
                  {photoPreview && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setPhotoFile(null);
                        setPhotoPreview(null);
                        setFormData(prev => ({ ...prev, photo_url: '' }));
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Artist Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter artist name"
                />
              </div>

              {/* Genre */}
              <div className="space-y-2">
                <Label>Genre</Label>
                <Select
                  value={formData.genre}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, genre: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select genre" />
                  </SelectTrigger>
                  <SelectContent>
                    {genres.map(genre => (
                      <SelectItem key={genre} value={genre}>{genre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Bio */}
              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={formData.bio}
                  onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                  placeholder="Short bio about the artist..."
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {isUploading ? 'Uploading...' : 'Saving...'}
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    {editingArtist ? 'Update' : 'Create'}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Artists Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence>
          {artists.map((artist) => (
            <motion.div
              key={artist.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-border rounded-xl p-4 hover:border-primary/50 transition-colors"
            >
              <div className="flex items-start gap-4">
                {/* Photo */}
                <div className="w-16 h-16 rounded-full overflow-hidden bg-muted flex-shrink-0">
                  {artist.photo_url ? (
                    <img src={artist.photo_url} alt={artist.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User className="w-8 h-8 text-muted-foreground" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground truncate">{artist.name}</h3>
                  {artist.genre && (
                    <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                      {artist.genre}
                    </span>
                  )}
                  <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                    <Music className="w-3 h-3" />
                    <span>{artist.song_count} songs</span>
                  </div>
                  {artist.bio && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{artist.bio}</p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-4 pt-4 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => openAssignDialog(artist)}
                >
                  <Music className="w-4 h-4 mr-1" />
                  Songs
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openEditDialog(artist)}
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDelete(artist)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {artists.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No artists yet. Add your first artist!</p>
          </div>
        )}
      </div>

      {/* Assign Songs Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedArtist?.photo_url ? (
                <img src={selectedArtist.photo_url} alt="" className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <User className="w-8 h-8 p-1 bg-muted rounded-full" />
              )}
              {selectedArtist?.name}'s Songs
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto space-y-4 py-4">
            {/* Assigned Songs */}
            <div>
              <h4 className="text-sm font-medium mb-2 text-foreground">Assigned Songs</h4>
              <div className="space-y-2">
                {selectedArtist && getArtistSongs(selectedArtist.id).map(song => (
                  <div
                    key={song.id}
                    className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg"
                  >
                    <div className="w-10 h-10 rounded bg-muted overflow-hidden">
                      {song.cover_url ? (
                        <img src={song.cover_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Music className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <span className="flex-1 text-sm truncate">{song.title}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => assignSongToArtist(song.id, null)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                {selectedArtist && getArtistSongs(selectedArtist.id).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No songs assigned</p>
                )}
              </div>
            </div>

            {/* Unassigned Songs */}
            <div>
              <h4 className="text-sm font-medium mb-2 text-foreground">Available Songs</h4>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {getUnassignedSongs().map(song => (
                  <div
                    key={song.id}
                    className="flex items-center gap-3 p-2 bg-card border border-border rounded-lg hover:border-primary/50 cursor-pointer transition-colors"
                    onClick={() => selectedArtist && assignSongToArtist(song.id, selectedArtist.id)}
                  >
                    <div className="w-10 h-10 rounded bg-muted overflow-hidden">
                      {song.cover_url ? (
                        <img src={song.cover_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Music className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{song.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
                    </div>
                    <Plus className="w-4 h-4 text-primary" />
                  </div>
                ))}
                {getUnassignedSongs().length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">All songs are assigned</p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManageArtists;
