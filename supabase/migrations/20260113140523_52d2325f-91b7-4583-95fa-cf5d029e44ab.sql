-- Add file metadata columns to songs table for production tracking
ALTER TABLE public.songs 
ADD COLUMN IF NOT EXISTS file_size BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS duration INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS bitrate INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS download_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS cover_size BIGINT DEFAULT 0;

-- Add index for analytics queries
CREATE INDEX IF NOT EXISTS idx_songs_download_count ON public.songs(download_count DESC);
CREATE INDEX IF NOT EXISTS idx_songs_file_size ON public.songs(file_size DESC);