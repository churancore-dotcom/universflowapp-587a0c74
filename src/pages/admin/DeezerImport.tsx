import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Music, Download, Loader2, TrendingUp, Globe, Play, CheckCircle2, AlertCircle, Disc, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface DeezerTrack {
  deezer_id: number;
  title: string;
  artist: string;
  artist_id: number;
  album: string | null;
  album_id: number | null;
  duration: number | null;
  cover_url: string | null;
  preview_url: string | null;
  rank: number;
  source?: 'deezer' | 'jamendo';
  jamendo_audio_url?: string;
  jamendo_license?: string;
  genre?: string | null;
}

type ImportStatus = 'idle' | 'extracting' | 'importing' | 'done' | 'error';

interface TrackImportState {
  status: ImportStatus;
  error?: string;
}

const QUICK_SEARCHES = [
  { label: '🇮🇳 Bollywood Hits', query: 'bollywood hits 2024' },
  { label: '🎵 Punjabi Viral', query: 'punjabi viral songs' },
  { label: '🔥 Phonk', query: 'phonk viral' },
  { label: '🎤 Hip Hop', query: 'hip hop trending 2024' },
  { label: '🌍 English Pop', query: 'english pop hits 2024' },
  { label: '🎸 Funk', query: 'funk music viral' },
  { label: '💜 Haryanvi', query: 'haryanvi songs trending' },
  { label: '🎧 Lo-Fi', query: 'lofi chill beats' },
  { label: '⚡ EDM', query: 'edm dance hits' },
  { label: '🎶 Arijit Singh', query: 'Arijit Singh' },
  { label: '🔊 AP Dhillon', query: 'AP Dhillon' },
  { label: '🌟 Diljit Dosanjh', query: 'Diljit Dosanjh' },
  { label: '🎵 BTS', query: 'BTS songs' },
  { label: '🔥 Travis Scott', query: 'Travis Scott' },
  { label: '💎 Drake', query: 'Drake hits' },
  { label: '🎤 Eminem', query: 'Eminem' },
];

const formatDuration = (seconds: number | null) => {
  if (!seconds) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const DeezerImport = () => {
  const [query, setQuery] = useState('');
  const [tracks, setTracks] = useState<DeezerTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [importStates, setImportStates] = useState<Record<number, TrackImportState>>({});
  const [totalResults, setTotalResults] = useState(0);
  const [searchIndex, setSearchIndex] = useState(0);
  const [lastQuery, setLastQuery] = useState('');
  const [bulkImporting, setBulkImporting] = useState(false);

  const searchDeezer = useCallback(async (searchQuery: string, append = false) => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    const idx = append ? searchIndex : 0;

    try {
      const { data, error } = await supabase.functions.invoke('deezer-search', {
        body: { action: 'search', query: searchQuery, limit: 25, index: idx },
      });

      if (error) throw error;

      let newTracks: DeezerTrack[] = (data?.tracks || []).map((track: DeezerTrack) => ({
        ...track,
        source: 'deezer',
      }));
      let nextTotal = data?.total || 0;

      // Reliable fallback: if Deezer returns empty, use Jamendo full-song search
      if (newTracks.length === 0) {
        const { data: jamendoData, error: jamendoError } = await supabase.functions.invoke('jamendo-search', {
          body: {
            action: 'search',
            query: searchQuery,
            limit: 25,
            offset: idx,
            order: 'popularity_total',
          },
        });

        if (!jamendoError && Array.isArray(jamendoData?.tracks) && jamendoData.tracks.length > 0) {
          newTracks = jamendoData.tracks.map((track: any) => ({
            deezer_id: -Number(track.jamendo_id),
            title: track.title,
            artist: track.artist,
            artist_id: Number(track.artist_id || 0),
            album: track.album || null,
            album_id: null,
            duration: track.duration || null,
            cover_url: track.cover_url || null,
            preview_url: null,
            rank: 0,
            source: 'jamendo',
            jamendo_audio_url: track.audio_url,
            jamendo_license: track.license,
            genre: track.genre || null,
          }));
          nextTotal = jamendoData.total || newTracks.length;
          toast.info('Switched to reliable full-song source.');
        }
      }

      setTracks(prev => append ? [...prev, ...newTracks] : newTracks);
      setTotalResults(nextTotal);
      setSearchIndex(idx + 25);
      setLastQuery(searchQuery);
    } catch (err: any) {
      toast.error('Search failed: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [searchIndex]);

  const fetchCharts = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('deezer-search', {
        body: { action: 'chart', limit: 50 },
      });
      if (error) throw error;
      const deezerTracks: DeezerTrack[] = (data?.tracks || []).map((track: DeezerTrack) => ({
        ...track,
        source: 'deezer',
      }));

      if (deezerTracks.length > 0) {
        setTracks(deezerTracks);
        setTotalResults(data.total || deezerTracks.length);
      } else {
        const { data: jamendoData, error: jamendoError } = await supabase.functions.invoke('jamendo-search', {
          body: { action: 'popular', limit: 50, offset: 0, order: 'popularity_total' },
        });

        if (jamendoError) throw jamendoError;

        const fallbackTracks: DeezerTrack[] = (jamendoData?.tracks || []).map((track: any) => ({
          deezer_id: -Number(track.jamendo_id),
          title: track.title,
          artist: track.artist,
          artist_id: Number(track.artist_id || 0),
          album: track.album || null,
          album_id: null,
          duration: track.duration || null,
          cover_url: track.cover_url || null,
          preview_url: null,
          rank: 0,
          source: 'jamendo',
          jamendo_audio_url: track.audio_url,
          jamendo_license: track.license,
          genre: track.genre || null,
        }));

        setTracks(fallbackTracks);
        setTotalResults(jamendoData?.total || fallbackTracks.length);
        toast.info('Global charts fallback loaded from reliable full-song source.');
      }
      setLastQuery('🔥 Top Charts');
    } catch (err: any) {
      toast.error('Failed to load charts');
    } finally {
      setLoading(false);
    }
  }, []);

  const importTrack = useCallback(async (track: DeezerTrack): Promise<boolean> => {
    setImportStates(prev => ({ ...prev, [track.deezer_id]: { status: 'extracting' } }));

    try {
      // Direct full-song import path (reliable source)
      if (track.source === 'jamendo' && track.jamendo_audio_url) {
        setImportStates(prev => ({ ...prev, [track.deezer_id]: { status: 'importing' } }));

        const { data: existing } = await supabase
          .from('songs')
          .select('id')
          .ilike('title', track.title)
          .ilike('artist', track.artist)
          .limit(1);

        if (existing && existing.length > 0) {
          setImportStates(prev => ({ ...prev, [track.deezer_id]: { status: 'done' } }));
          toast.info(`"${track.title}" already exists`);
          return true;
        }

        const { error: insertError } = await supabase.from('songs').insert({
          title: track.title,
          artist: track.artist,
          album: track.album || undefined,
          audio_url: track.jamendo_audio_url,
          cover_url: track.cover_url,
          duration: track.duration || 0,
          genre: track.genre || guessGenre(track, lastQuery),
          is_visible: true,
          show_in_new_releases: true,
        });

        if (insertError) throw insertError;

        setImportStates(prev => ({ ...prev, [track.deezer_id]: { status: 'done' } }));
        toast.success(`Imported "${track.title}" (full song)`);
        return true;
      }

      // Step 1: Resolve a YouTube video (server-side first, client fallback)
      const ytQuery = `${track.title} ${track.artist} official audio`;
      let videoId = '';
      let audioUrl = '';
      let thumbnail = '';

      const { data: ytData, error: ytError } = await supabase.functions.invoke('deezer-search', {
        body: { action: 'youtube_search', query: ytQuery },
      });

      if (!ytError && ytData?.videoId) {
        videoId = ytData.videoId;
        thumbnail = ytData.thumbnail || '';
      }

      if (!videoId) {
        const invidiousInstances = [
          'https://inv.nadeko.net',
          'https://invidious.privacyredirect.com',
          'https://invidious.perennialte.ch',
        ];

        for (const instance of invidiousInstances) {
          try {
            const searchResponse = await fetch(`${instance}/api/v1/search?q=${encodeURIComponent(ytQuery)}&type=video`);
            if (!searchResponse.ok) continue;

            const searchResults = await searchResponse.json();
            if (searchResults && searchResults.length > 0) {
              videoId = searchResults[0].videoId;
              thumbnail = searchResults[0].videoThumbnails?.find((t: any) => t.quality === 'maxresdefault')?.url
                || searchResults[0].videoThumbnails?.[0]?.url || '';
              break;
            }
          } catch {
            // try next instance
          }
        }
      }

      if (!videoId) {
        throw new Error('Could not find song on YouTube right now. Try again in a moment.');
      }

      setImportStates(prev => ({ ...prev, [track.deezer_id]: { status: 'importing' } }));

      // Step 2: Extract audio using existing edge function
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw new Error('Could not verify session. Please sign in again.');
      }

      if (!session?.access_token) {
        throw new Error('Please sign in again to import songs.');
      }

      const { data: extractData, error: extractError } = await supabase.functions.invoke('extract-audio', {
        body: { url: `https://www.youtube.com/watch?v=${videoId}` },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (extractError || !extractData?.success) {
        const rawError = extractData?.error || extractError?.message || 'Audio extraction failed';
        if (/authentication required|invalid authentication|401/i.test(rawError)) {
          throw new Error('Session expired. Please log in again and retry.');
        }
        throw new Error(rawError);
      }

      audioUrl = extractData.audioUrl;
      if (!audioUrl) throw new Error('No audio URL returned');

      // Step 3: Fetch real genre from Deezer album metadata
      let detectedGenre = 'Pop';
      if (track.album_id) {
        try {
          const { data: genreData } = await supabase.functions.invoke('deezer-search', {
            body: { action: 'track_genre', query: String(track.album_id) },
          });
          if (genreData?.genre) {
            detectedGenre = genreData.genre;
          }
        } catch {
          // fallback to query-based guess
          detectedGenre = guessGenre(track, lastQuery);
        }
      } else {
        detectedGenre = guessGenre(track, lastQuery);
      }

      // Step 4: Insert into database
      const coverUrl = track.cover_url || extractData.thumbnail || thumbnail || null;
      
      // Check for duplicates
      const { data: existing } = await supabase
        .from('songs')
        .select('id')
        .ilike('title', track.title)
        .ilike('artist', track.artist)
        .limit(1);

      if (existing && existing.length > 0) {
        setImportStates(prev => ({ ...prev, [track.deezer_id]: { status: 'done' } }));
        toast.info(`"${track.title}" already exists`);
        return true;
      }

      const { error: insertError } = await supabase.from('songs').insert({
        title: track.title,
        artist: track.artist,
        album: track.album || undefined,
        audio_url: audioUrl,
        cover_url: coverUrl,
        duration: track.duration || extractData.duration || 0,
        genre: detectedGenre,
        is_visible: true,
        show_in_new_releases: true,
      });

      if (insertError) throw insertError;

      setImportStates(prev => ({ ...prev, [track.deezer_id]: { status: 'done' } }));
      toast.success(`Imported "${track.title}" by ${track.artist}`);
      return true;

    } catch (err: any) {
      console.error('Import error:', err);
      setImportStates(prev => ({
        ...prev,
        [track.deezer_id]: { status: 'error', error: err.message || 'Import failed' },
      }));
      toast.error(`Failed: ${track.title} — ${err.message}`);
      return false;
    }
  }, [lastQuery]);

  const importAll = useCallback(async () => {
    const unimported = tracks.filter(t => {
      const state = importStates[t.deezer_id];
      return !state || state.status === 'idle' || state.status === 'error';
    });

    if (unimported.length === 0) {
      toast.info('All tracks already imported');
      return;
    }

    setBulkImporting(true);
    let success = 0;
    let failed = 0;

    for (const track of unimported) {
      const ok = await importTrack(track);
      if (ok) {
        success++;
      } else {
        failed++;
      }
      // Small delay to avoid rate limits
      await new Promise(r => setTimeout(r, 1500));
    }

    setBulkImporting(false);
    toast.success(`Bulk import done: ${success} imported, ${failed} failed`);
  }, [tracks, importStates, importTrack]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchDeezer(query);
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-2"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Deezer Discovery</h1>
            <p className="text-sm text-muted-foreground">Auto-fallback to a reliable full-song source when extraction providers fail</p>
          </div>
        </div>
      </motion.div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search any song, artist, or genre..."
            className="pl-10 bg-card border-border"
          />
        </div>
        <Button type="submit" disabled={loading || !query.trim()}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
        </Button>
      </form>

      {/* Quick Search Chips */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={fetchCharts}
          disabled={loading}
          className="text-xs border-primary/30 hover:bg-primary/10"
        >
          <TrendingUp className="w-3 h-3 mr-1" /> Global Charts
        </Button>
        {QUICK_SEARCHES.map(qs => (
          <Button
            key={qs.query}
            variant="outline"
            size="sm"
            onClick={() => { setQuery(qs.query); searchDeezer(qs.query); }}
            disabled={loading}
            className="text-xs"
          >
            {qs.label}
          </Button>
        ))}
      </div>

      {/* Results Header */}
      {tracks.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {lastQuery && <span className="font-medium text-foreground">{lastQuery}</span>}
            {' · '}{tracks.length} of {totalResults} results
          </p>
          <Button
            onClick={importAll}
            disabled={bulkImporting || loading}
            size="sm"
            className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
          >
            {bulkImporting ? (
              <><Loader2 className="w-3 h-3 animate-spin mr-1" /> Importing...</>
            ) : (
              <><Download className="w-3 h-3 mr-1" /> Import All</>
            )}
          </Button>
        </div>
      )}

      {/* Track List */}
      <div className="space-y-2">
        <AnimatePresence>
          {tracks.map((track, i) => {
            const state = importStates[track.deezer_id] || { status: 'idle' };
            return (
              <motion.div
                key={track.deezer_id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-primary/30 transition-all group"
              >
                {/* Cover */}
                <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                  {track.cover_url ? (
                    <img src={track.cover_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Music className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                  {track.preview_url && (
                    <button
                      onClick={() => {
                        const audio = new Audio(track.preview_url!);
                        audio.play();
                        setTimeout(() => audio.pause(), 15000);
                      }}
                      className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Play className="w-5 h-5 text-white" fill="white" />
                    </button>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-foreground truncate">{track.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{track.artist} {track.album ? `· ${track.album}` : ''}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {track.source === 'jamendo' ? 'Reliable full-song source' : 'Deezer + YouTube extraction'}
                  </p>
                </div>

                {/* Duration */}
                <span className="text-xs text-muted-foreground hidden sm:block">
                  {formatDuration(track.duration)}
                </span>

                {/* Import Button */}
                <div className="flex-shrink-0">
                  {state.status === 'idle' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => importTrack(track)}
                      className="text-primary hover:bg-primary/10"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  )}
                  {(state.status === 'extracting' || state.status === 'importing') && (
                    <div className="flex items-center gap-1.5 text-xs text-amber-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{state.status === 'extracting' ? 'Finding...' : 'Importing...'}</span>
                    </div>
                  )}
                  {state.status === 'done' && (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  )}
                  {state.status === 'error' && (
                    <button onClick={() => importTrack(track)} title={state.error}>
                      <AlertCircle className="w-5 h-5 text-destructive hover:text-destructive/80" />
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Load More */}
      {tracks.length > 0 && tracks.length < totalResults && (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            onClick={() => searchDeezer(lastQuery, true)}
            disabled={loading}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Load More
          </Button>
        </div>
      )}

      {/* Empty State */}
      {!loading && tracks.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-16 space-y-3"
        >
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Globe className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">Search Any Song</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Search for any song using Deezer's catalog. Click import to automatically find and extract the full song from YouTube.
          </p>
        </motion.div>
      )}
    </div>
  );
};

function guessGenre(track: DeezerTrack, searchQuery: string): string {
  const q = searchQuery.toLowerCase();
  if (q.includes('bollywood') || q.includes('hindi')) return 'Bollywood';
  if (q.includes('punjabi')) return 'Punjabi';
  if (q.includes('haryanvi')) return 'Haryanvi';
  if (q.includes('phonk')) return 'Phonk';
  if (q.includes('hip hop') || q.includes('hiphop') || q.includes('rap')) return 'Hip Hop';
  if (q.includes('funk')) return 'Funk';
  if (q.includes('edm') || q.includes('electronic')) return 'Electronic';
  if (q.includes('lofi') || q.includes('lo-fi')) return 'Lo-Fi';
  if (q.includes('pop')) return 'Pop';
  if (q.includes('rock')) return 'Rock';
  if (q.includes('r&b') || q.includes('rnb')) return 'R&B';
  if (q.includes('jazz')) return 'Jazz';
  if (q.includes('classical')) return 'Classical';
  if (q.includes('country')) return 'Country';
  if (q.includes('metal')) return 'Metal';
  if (q.includes('indie')) return 'Indie';
  return 'Pop';
}

export default DeezerImport;
