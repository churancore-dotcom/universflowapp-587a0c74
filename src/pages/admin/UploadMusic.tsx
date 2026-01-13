import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Music, Image, X, Check, Loader2, AlertCircle, FileAudio } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const genres = ['Pop', 'Rock', 'Hip Hop', 'R&B', 'Electronic', 'Jazz', 'Classical', 'Country', 'Indie', 'Metal'];
const moods = ['Happy', 'Sad', 'Energetic', 'Calm', 'Romantic', 'Dark', 'Uplifting', 'Chill'];

// File validation constants
const MAX_AUDIO_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_COVER_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/aac', 'audio/ogg', 'audio/mp4', 'audio/x-m4a'];
const ALLOWED_COVER_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

interface ValidationError {
  type: 'audio' | 'cover';
  message: string;
}

const UploadMusic = () => {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isDraggingAudio, setIsDraggingAudio] = useState(false);
  const [isDraggingCover, setIsDraggingCover] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  
  const [metadata, setMetadata] = useState({
    title: '',
    artist: '',
    album: '',
    genre: '',
    mood: '',
    bpm: '',
  });

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const validateAudioFile = (file: File): string | null => {
    if (!ALLOWED_AUDIO_TYPES.includes(file.type) && !file.name.match(/\.(mp3|wav|flac|aac|ogg|m4a)$/i)) {
      return 'Invalid audio format. Supported: MP3, WAV, FLAC, AAC, OGG, M4A';
    }
    if (file.size > MAX_AUDIO_SIZE) {
      return `Audio file too large. Maximum size: ${formatFileSize(MAX_AUDIO_SIZE)}`;
    }
    return null;
  };

  const validateCoverFile = (file: File): string | null => {
    if (!ALLOWED_COVER_TYPES.includes(file.type)) {
      return 'Invalid image format. Supported: JPG, PNG, WebP, GIF';
    }
    if (file.size > MAX_COVER_SIZE) {
      return `Cover image too large. Maximum size: ${formatFileSize(MAX_COVER_SIZE)}`;
    }
    return null;
  };

  const getAudioDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const audio = new Audio();
      audio.onloadedmetadata = () => {
        resolve(Math.round(audio.duration));
      };
      audio.onerror = () => resolve(0);
      audio.src = URL.createObjectURL(file);
    });
  };

  const handleAudioDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingAudio(false);
    const file = e.dataTransfer.files[0];
    
    if (file) {
      const error = validateAudioFile(file);
      if (error) {
        setValidationErrors(prev => [...prev.filter(e => e.type !== 'audio'), { type: 'audio', message: error }]);
        toast.error(error);
        return;
      }
      
      setValidationErrors(prev => prev.filter(e => e.type !== 'audio'));
      setAudioFile(file);
      
      // Get audio duration
      const duration = await getAudioDuration(file);
      setAudioDuration(duration);
      
      // Auto-fill title from filename
      const name = file.name.replace(/\.[^/.]+$/, '');
      setMetadata(prev => ({ ...prev, title: prev.title || name }));
    }
  }, []);

  const handleCoverDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingCover(false);
    const file = e.dataTransfer.files[0];
    
    if (file) {
      const error = validateCoverFile(file);
      if (error) {
        setValidationErrors(prev => [...prev.filter(e => e.type !== 'cover'), { type: 'cover', message: error }]);
        toast.error(error);
        return;
      }
      
      setValidationErrors(prev => prev.filter(e => e.type !== 'cover'));
      setCoverFile(file);
      setCoverPreview(URL.createObjectURL(file));
    }
  }, []);

  const handleAudioSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const error = validateAudioFile(file);
      if (error) {
        setValidationErrors(prev => [...prev.filter(e => e.type !== 'audio'), { type: 'audio', message: error }]);
        toast.error(error);
        return;
      }
      
      setValidationErrors(prev => prev.filter(e => e.type !== 'audio'));
      setAudioFile(file);
      
      const duration = await getAudioDuration(file);
      setAudioDuration(duration);
      
      const name = file.name.replace(/\.[^/.]+$/, '');
      setMetadata(prev => ({ ...prev, title: prev.title || name }));
    }
  };

  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const error = validateCoverFile(file);
      if (error) {
        setValidationErrors(prev => [...prev.filter(e => e.type !== 'cover'), { type: 'cover', message: error }]);
        toast.error(error);
        return;
      }
      
      setValidationErrors(prev => prev.filter(e => e.type !== 'cover'));
      setCoverFile(file);
      setCoverPreview(URL.createObjectURL(file));
    }
  };

  const handleUpload = async () => {
    if (!audioFile || !metadata.title || !metadata.artist) {
      toast.error('Please fill in required fields');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Upload audio file
      const audioExt = audioFile.name.split('.').pop();
      const audioPath = `${Date.now()}-${Math.random().toString(36).substring(7)}.${audioExt}`;
      
      setUploadProgress(20);
      const { error: audioError } = await supabase.storage
        .from('music')
        .upload(audioPath, audioFile);

      if (audioError) throw audioError;

      const { data: audioUrl } = supabase.storage.from('music').getPublicUrl(audioPath);
      setUploadProgress(50);

      // Upload cover if exists
      let coverUrl = null;
      let coverSize = 0;
      if (coverFile) {
        const coverExt = coverFile.name.split('.').pop();
        const coverPath = `${Date.now()}-${Math.random().toString(36).substring(7)}.${coverExt}`;
        
        const { error: coverError } = await supabase.storage
          .from('covers')
          .upload(coverPath, coverFile);

        if (!coverError) {
          const { data } = supabase.storage.from('covers').getPublicUrl(coverPath);
          coverUrl = data.publicUrl;
          coverSize = coverFile.size;
        }
      }
      setUploadProgress(75);

      // Insert song record with file metadata
      const { error: dbError } = await supabase.from('songs').insert({
        title: metadata.title,
        artist: metadata.artist,
        album: metadata.album || null,
        genre: metadata.genre || null,
        mood: metadata.mood || null,
        bpm: metadata.bpm ? parseInt(metadata.bpm) : null,
        audio_url: audioUrl.publicUrl,
        cover_url: coverUrl,
        is_visible: true,
        file_size: audioFile.size,
        duration: audioDuration,
        cover_size: coverSize,
      });

      if (dbError) throw dbError;

      setUploadProgress(100);
      toast.success('Song uploaded successfully!');

      // Reset form
      setTimeout(() => {
        setAudioFile(null);
        setCoverFile(null);
        setCoverPreview(null);
        setAudioDuration(0);
        setMetadata({ title: '', artist: '', album: '', genre: '', mood: '', bpm: '' });
        setUploadProgress(0);
        setIsUploading(false);
      }, 1000);

    } catch (error: any) {
      toast.error(error.message || 'Upload failed');
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-display font-bold">Upload Music</h1>
        <p className="text-muted-foreground mt-1">Add new tracks to your music library</p>
        <div className="flex flex-wrap gap-4 mt-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <FileAudio className="w-3 h-3" />
            Max audio: {formatFileSize(MAX_AUDIO_SIZE)}
          </span>
          <span className="flex items-center gap-1">
            <Image className="w-3 h-3" />
            Max cover: {formatFileSize(MAX_COVER_SIZE)}
          </span>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* File Upload Section */}
        <motion.div
          className="space-y-6"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          {/* Audio Upload */}
          <div>
            <Label className="mb-2 block">Audio File *</Label>
            <motion.div
              className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
                isDraggingAudio
                  ? 'border-primary bg-primary/10'
                  : audioFile
                  ? 'border-green-500/50 bg-green-500/5'
                  : validationErrors.some(e => e.type === 'audio')
                  ? 'border-destructive/50 bg-destructive/5'
                  : 'border-white/10 hover:border-white/20'
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDraggingAudio(true); }}
              onDragLeave={() => setIsDraggingAudio(false)}
              onDrop={handleAudioDrop}
              whileHover={{ scale: 1.01 }}
            >
              <input
                type="file"
                accept="audio/*"
                onChange={handleAudioSelect}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <AnimatePresence mode="wait">
                {audioFile ? (
                  <motion.div
                    key="file"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="flex items-center justify-center gap-3"
                  >
                    <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                      <Check className="w-6 h-6 text-green-500" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium truncate max-w-[200px]">{audioFile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatFileSize(audioFile.size)} • {audioDuration > 0 ? formatDuration(audioDuration) : 'Loading...'}
                      </p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setAudioFile(null); setAudioDuration(0); }}
                      className="p-2 hover:bg-white/10 rounded-full"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <Music className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                    <p className="font-medium">Drop audio file here</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      MP3, WAV, FLAC, AAC, OGG, M4A (max {formatFileSize(MAX_AUDIO_SIZE)})
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
            {validationErrors.find(e => e.type === 'audio') && (
              <motion.p 
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-2 text-sm text-destructive flex items-center gap-1"
              >
                <AlertCircle className="w-4 h-4" />
                {validationErrors.find(e => e.type === 'audio')?.message}
              </motion.p>
            )}
          </div>

          {/* Cover Upload */}
          <div>
            <Label className="mb-2 block">Cover Art</Label>
            <motion.div
              className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
                isDraggingCover
                  ? 'border-primary bg-primary/10'
                  : coverFile
                  ? 'border-accent/50 bg-accent/5'
                  : validationErrors.some(e => e.type === 'cover')
                  ? 'border-destructive/50 bg-destructive/5'
                  : 'border-white/10 hover:border-white/20'
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDraggingCover(true); }}
              onDragLeave={() => setIsDraggingCover(false)}
              onDrop={handleCoverDrop}
              whileHover={{ scale: 1.01 }}
            >
              <input
                type="file"
                accept="image/*"
                onChange={handleCoverSelect}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <AnimatePresence mode="wait">
                {coverPreview ? (
                  <motion.div
                    key="preview"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="relative inline-block"
                  >
                    <img
                      src={coverPreview}
                      alt="Cover preview"
                      className="w-32 h-32 rounded-xl object-cover mx-auto"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      {coverFile && formatFileSize(coverFile.size)}
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setCoverFile(null);
                        setCoverPreview(null);
                      }}
                      className="absolute -top-2 -right-2 p-1 bg-destructive rounded-full"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <Image className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                    <p className="font-medium">Drop cover image here</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      JPG, PNG, WebP (max {formatFileSize(MAX_COVER_SIZE)})
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
            {validationErrors.find(e => e.type === 'cover') && (
              <motion.p 
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-2 text-sm text-destructive flex items-center gap-1"
              >
                <AlertCircle className="w-4 h-4" />
                {validationErrors.find(e => e.type === 'cover')?.message}
              </motion.p>
            )}
          </div>
        </motion.div>

        {/* Metadata Section */}
        <motion.div
          className="glass rounded-2xl p-6 space-y-4"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="text-lg font-display font-bold mb-4">Song Details</h2>
          
          <div>
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={metadata.title}
              onChange={(e) => setMetadata(prev => ({ ...prev, title: e.target.value }))}
              className="mt-1.5 bg-muted/50 border-white/10"
              placeholder="Song title"
            />
          </div>

          <div>
            <Label htmlFor="artist">Artist *</Label>
            <Input
              id="artist"
              value={metadata.artist}
              onChange={(e) => setMetadata(prev => ({ ...prev, artist: e.target.value }))}
              className="mt-1.5 bg-muted/50 border-white/10"
              placeholder="Artist name"
            />
          </div>

          <div>
            <Label htmlFor="album">Album</Label>
            <Input
              id="album"
              value={metadata.album}
              onChange={(e) => setMetadata(prev => ({ ...prev, album: e.target.value }))}
              className="mt-1.5 bg-muted/50 border-white/10"
              placeholder="Album name"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Genre</Label>
              <Select
                value={metadata.genre}
                onValueChange={(value) => setMetadata(prev => ({ ...prev, genre: value }))}
              >
                <SelectTrigger className="mt-1.5 bg-muted/50 border-white/10">
                  <SelectValue placeholder="Select genre" />
                </SelectTrigger>
                <SelectContent>
                  {genres.map((genre) => (
                    <SelectItem key={genre} value={genre}>{genre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Mood</Label>
              <Select
                value={metadata.mood}
                onValueChange={(value) => setMetadata(prev => ({ ...prev, mood: value }))}
              >
                <SelectTrigger className="mt-1.5 bg-muted/50 border-white/10">
                  <SelectValue placeholder="Select mood" />
                </SelectTrigger>
                <SelectContent>
                  {moods.map((mood) => (
                    <SelectItem key={mood} value={mood}>{mood}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="bpm">BPM</Label>
            <Input
              id="bpm"
              type="number"
              value={metadata.bpm}
              onChange={(e) => setMetadata(prev => ({ ...prev, bpm: e.target.value }))}
              className="mt-1.5 bg-muted/50 border-white/10"
              placeholder="120"
            />
          </div>

          {/* Progress Bar */}
          <AnimatePresence>
            {isUploading && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="pt-4"
              >
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-primary to-accent"
                    initial={{ width: 0 }}
                    animate={{ width: `${uploadProgress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                <p className="text-sm text-muted-foreground text-center mt-2">
                  Uploading... {uploadProgress}%
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <Button
            onClick={handleUpload}
            disabled={isUploading || !audioFile || !metadata.title || !metadata.artist}
            className="w-full h-12 btn-premium mt-4"
          >
            {isUploading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Upload className="w-5 h-5 mr-2" />
                Upload Song
              </>
            )}
          </Button>
        </motion.div>
      </div>
    </div>
  );
};

export default UploadMusic;