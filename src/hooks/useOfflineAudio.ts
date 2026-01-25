import { useCallback, useEffect, useState } from 'react';
import { Song } from '@/contexts/PlayerContext';

const DB_NAME = 'UniversFlowOfflineAudio';
const AUDIO_STORE = 'audio_files';
const METADATA_STORE = 'metadata';
const DB_VERSION = 1;

interface CachedAudioMeta {
  songId: string;
  title: string;
  artist: string;
  album?: string;
  coverUrl?: string;
  duration?: number;
  size: number;
  cachedAt: string;
}

// Initialize IndexedDB with multiple stores
const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Store for audio blob data
      if (!db.objectStoreNames.contains(AUDIO_STORE)) {
        db.createObjectStore(AUDIO_STORE, { keyPath: 'songId' });
      }
      
      // Store for metadata (for quick listing without loading blobs)
      if (!db.objectStoreNames.contains(METADATA_STORE)) {
        const metaStore = db.createObjectStore(METADATA_STORE, { keyPath: 'songId' });
        metaStore.createIndex('cachedAt', 'cachedAt', { unique: false });
        metaStore.createIndex('artist', 'artist', { unique: false });
      }
    };
  });
};

// Save audio to cache
export const cacheAudioFile = async (
  song: Song,
  audioBlob: Blob
): Promise<void> => {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([AUDIO_STORE, METADATA_STORE], 'readwrite');
    
    // Save audio blob
    const audioStore = transaction.objectStore(AUDIO_STORE);
    audioStore.put({
      songId: song.id,
      audioBlob,
    });
    
    // Save metadata
    const metaStore = transaction.objectStore(METADATA_STORE);
    const meta: CachedAudioMeta = {
      songId: song.id,
      title: song.title,
      artist: song.artist,
      album: song.album || undefined,
      coverUrl: song.cover_url || undefined,
      duration: song.duration || undefined,
      size: audioBlob.size,
      cachedAt: new Date().toISOString(),
    };
    metaStore.put(meta);
    
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

// Get cached audio
export const getCachedAudio = async (
  songId: string
): Promise<{ blob: Blob; meta: CachedAudioMeta } | null> => {
  try {
    const db = await initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([AUDIO_STORE, METADATA_STORE], 'readonly');
      
      const audioStore = transaction.objectStore(AUDIO_STORE);
      const metaStore = transaction.objectStore(METADATA_STORE);
      
      const audioRequest = audioStore.get(songId);
      const metaRequest = metaStore.get(songId);
      
      let audioData: { audioBlob: Blob } | undefined;
      let metaData: CachedAudioMeta | undefined;
      
      audioRequest.onsuccess = () => {
        audioData = audioRequest.result;
      };
      
      metaRequest.onsuccess = () => {
        metaData = metaRequest.result;
      };
      
      transaction.oncomplete = () => {
        if (audioData && metaData) {
          resolve({ blob: audioData.audioBlob, meta: metaData });
        } else {
          resolve(null);
        }
      };
      
      transaction.onerror = () => reject(transaction.error);
    });
  } catch {
    return null;
  }
};

// Get all cached metadata (without loading blobs)
export const getAllCachedMeta = async (): Promise<CachedAudioMeta[]> => {
  try {
    const db = await initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(METADATA_STORE, 'readonly');
      const store = transaction.objectStore(METADATA_STORE);
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return [];
  }
};

// Delete cached audio
export const deleteCachedAudio = async (songId: string): Promise<void> => {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([AUDIO_STORE, METADATA_STORE], 'readwrite');
    
    transaction.objectStore(AUDIO_STORE).delete(songId);
    transaction.objectStore(METADATA_STORE).delete(songId);
    
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

// Get total cache size
export const getCacheSize = async (): Promise<number> => {
  const meta = await getAllCachedMeta();
  return meta.reduce((total, item) => total + item.size, 0);
};

// Clear entire cache
export const clearAudioCache = async (): Promise<void> => {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([AUDIO_STORE, METADATA_STORE], 'readwrite');
    
    transaction.objectStore(AUDIO_STORE).clear();
    transaction.objectStore(METADATA_STORE).clear();
    
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

// Hook for managing offline audio
export const useOfflineAudio = () => {
  const [cachedSongs, setCachedSongs] = useState<CachedAudioMeta[]>([]);
  const [totalSize, setTotalSize] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [blobUrls, setBlobUrls] = useState<Record<string, string>>({});

  // Load cached songs metadata on mount
  useEffect(() => {
    const loadCache = async () => {
      setIsLoading(true);
      try {
        const meta = await getAllCachedMeta();
        setCachedSongs(meta);
        
        const size = meta.reduce((total, item) => total + item.size, 0);
        setTotalSize(size);
      } catch (error) {
        console.warn('Failed to load offline cache:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadCache();
    
    // Cleanup blob URLs on unmount
    return () => {
      Object.values(blobUrls).forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // Ignore
        }
      });
    };
  }, []);

  // Check if a song is cached
  const isCached = useCallback(
    (songId: string) => cachedSongs.some((s) => s.songId === songId),
    [cachedSongs]
  );

  // Get playable URL for a cached song
  const getPlayableUrl = useCallback(
    async (songId: string): Promise<string | null> => {
      // Return existing blob URL if available
      if (blobUrls[songId]) {
        return blobUrls[songId];
      }

      const cached = await getCachedAudio(songId);
      if (!cached) return null;

      const url = URL.createObjectURL(cached.blob);
      setBlobUrls((prev) => ({ ...prev, [songId]: url }));
      return url;
    },
    [blobUrls]
  );

  // Cache a song for offline playback
  const cacheSong = useCallback(
    async (song: Song, onProgress?: (progress: number) => void) => {
      try {
        onProgress?.(5);
        
        const response = await fetch(song.audio_url, {
          mode: 'cors',
          credentials: 'omit',
        });

        if (!response.ok) throw new Error('Failed to fetch audio');

        const contentLength = response.headers.get('content-length');
        const total = contentLength ? parseInt(contentLength, 10) : 0;
        
        const reader = response.body?.getReader();
        if (!reader) throw new Error('No reader available');

        const chunks: ArrayBuffer[] = [];
        let received = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          // Copy to regular ArrayBuffer
          chunks.push(value.buffer.slice(0) as ArrayBuffer);
          received += value.length;
          
          if (total > 0) {
            const progress = Math.round((received / total) * 90) + 5;
            onProgress?.(Math.min(progress, 95));
          }
        }

        const blob = new Blob(chunks, { type: 'audio/mpeg' });
        await cacheAudioFile(song, blob);
        
        onProgress?.(100);

        // Update state
        const newMeta: CachedAudioMeta = {
          songId: song.id,
          title: song.title,
          artist: song.artist,
          album: song.album || undefined,
          coverUrl: song.cover_url || undefined,
          duration: song.duration || undefined,
          size: blob.size,
          cachedAt: new Date().toISOString(),
        };
        
        setCachedSongs((prev) => [...prev.filter((s) => s.songId !== song.id), newMeta]);
        setTotalSize((prev) => prev + blob.size);
        
        return true;
      } catch (error) {
        console.error('Failed to cache song:', error);
        return false;
      }
    },
    []
  );

  // Remove a song from cache
  const removeCached = useCallback(
    async (songId: string) => {
      try {
        const meta = cachedSongs.find((s) => s.songId === songId);
        
        await deleteCachedAudio(songId);
        
        // Revoke blob URL if exists
        if (blobUrls[songId]) {
          URL.revokeObjectURL(blobUrls[songId]);
          setBlobUrls((prev) => {
            const updated = { ...prev };
            delete updated[songId];
            return updated;
          });
        }
        
        setCachedSongs((prev) => prev.filter((s) => s.songId !== songId));
        if (meta) {
          setTotalSize((prev) => Math.max(0, prev - meta.size));
        }
      } catch (error) {
        console.error('Failed to remove cached song:', error);
      }
    },
    [cachedSongs, blobUrls]
  );

  // Clear all cached audio
  const clearAll = useCallback(async () => {
    try {
      await clearAudioCache();
      
      Object.values(blobUrls).forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // Ignore
        }
      });
      
      setCachedSongs([]);
      setBlobUrls({});
      setTotalSize(0);
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }, [blobUrls]);

  // Format size for display
  const formatSize = useCallback((bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }, []);

  return {
    cachedSongs,
    totalSize,
    formattedSize: formatSize(totalSize),
    isLoading,
    isCached,
    getPlayableUrl,
    cacheSong,
    removeCached,
    clearAll,
  };
};

export default useOfflineAudio;
