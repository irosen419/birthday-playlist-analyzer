import { useState, useEffect, useMemo, useRef } from 'react';
import type { Track } from '../../types';
import { searchTracks } from '../../api/search';
import SearchResults from './SearchResults';

const DEBOUNCE_DELAY_MS = 300;

interface SearchBarProps {
  onAddTrack: (track: Track) => void;
  excludeTrackIds?: string[];
}

export default function SearchBar({ onAddTrack, excludeTrackIds }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Track[]>([]);
  const [isSearching, setSearching] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const excludedIds = useMemo(() => new Set(excludeTrackIds ?? []), [excludeTrackIds]);
  const visibleResults = useMemo(
    () => results.filter((t) => !excludedIds.has(t.id)),
    [results, excludedIds],
  );

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
      } catch (err) {
        console.error('Track search failed', err);
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, DEBOUNCE_DELAY_MS);

    return () => clearTimeout(timerRef.current);
  }, [query]);

  function handleAdd(track: Track) {
    onAddTrack(track);
  }

  function handleClose() {
    clearTimeout(timerRef.current);
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
        className="w-full rounded-full bg-[#282828] px-5 py-3 pr-10 text-sm text-white outline-none placeholder:text-[#6a6a6a] focus:ring-1 focus:ring-[#1DB954]"
      />
      {isSearching ? (
        <div className="absolute right-4 top-1/2 -translate-y-1/2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#282828] border-t-[#1DB954]" />
        </div>
      ) : (
        query && (
          <button
            type="button"
            onClick={handleClose}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-[#b3b3b3] transition-colors hover:bg-[#3a3a3a] hover:text-white"
          >
            ✕
          </button>
        )
      )}
      {visibleResults.length > 0 && (
        <SearchResults results={visibleResults} onAdd={handleAdd} />
      )}
    </div>
  );
}
