import { useState, useEffect, useRef } from 'react';
import type { Track } from '../../types';
import { searchTracks } from '../../api/search';
import SearchResults from './SearchResults';

const DEBOUNCE_DELAY_MS = 300;

interface SearchBarProps {
  onAddTrack: (track: Track) => void;
}

export default function SearchBar({ onAddTrack }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Track[]>([]);
  const [isSearching, setSearching] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const tracks = await searchTracks(query);
        setResults(tracks);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, DEBOUNCE_DELAY_MS);

    return () => clearTimeout(timerRef.current);
  }, [query]);

  function handleAdd(track: Track) {
    onAddTrack(track);
    setQuery('');
    setResults([]);
  }

  return (
    <div className="relative mb-4">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search for tracks to add..."
        className="w-full rounded-full bg-[#282828] px-5 py-3 text-sm text-white outline-none placeholder:text-[#6a6a6a] focus:ring-1 focus:ring-[#1DB954]"
      />
      {isSearching && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#282828] border-t-[#1DB954]" />
        </div>
      )}
      {results.length > 0 && (
        <SearchResults results={results} onAdd={handleAdd} />
      )}
    </div>
  );
}
