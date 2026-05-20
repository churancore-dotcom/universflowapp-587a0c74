import { useState } from 'react';
import { searchSongs } from '../lib/jiosaavn';
import { usePlayer } from '../hooks/usePlayer';
import JiosaavnSongCard from '../components/JiosaavnSongCard';
import JiosaavnPlayer from '../components/JiosaavnPlayer';

export default function Music() {
  const [results, setResults] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const { current, isPlaying, loading, playSong, togglePlay, audioRef } = usePlayer();

  async function handleSearch(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && query.trim()) {
      const songs = await searchSongs(query, 50);
      setResults(songs);
    }
  }

  return (
    <div style={{ background: '#000', minHeight: '100vh', padding: '20px', paddingBottom: 120 }}>
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={handleSearch}
        placeholder="Search any song, artist, album..."
        style={{
          width: '100%', padding: '14px 20px', borderRadius: 30,
          border: 'none', background: '#222', color: '#fff',
          fontSize: 16, marginBottom: 24, boxSizing: 'border-box', outline: 'none',
        }}
      />

      {results.map((song, i) => (
        <JiosaavnSongCard
          key={song.id}
          song={song}
          index={i}
          onPlay={(id, index) => playSong(id, results, index)}
        />
      ))}

      <JiosaavnPlayer
        current={current}
        isPlaying={isPlaying}
        loading={loading}
        onToggle={togglePlay}
        audioRef={audioRef}
      />
    </div>
  );
}
