import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { NostalgicArtist } from '../../types';
import {
  getNostalgicArtists,
  createNostalgicArtist,
  deleteNostalgicArtist,
} from '../../api/nostalgicArtists';
import { searchArtists, type SpotifyArtist } from '../../api/search';

type Era = NostalgicArtist['era'];

interface EraGroupConfig {
  era: Era;
  label: string;
  ageRange: string;
}

const ERA_GROUPS: EraGroupConfig[] = [
  { era: 'formative', label: 'Formative Years', ageRange: 'ages 10-12' },
  { era: 'high_school', label: 'High School', ageRange: 'ages 14-18' },
  { era: 'college', label: 'College', ageRange: 'ages 18-22' },
];

const NOSTALGIC_ARTISTS_QUERY_KEY = ['nostalgicArtists'] as const;

function ArtistTag({
  artist,
  onDelete,
}: {
  artist: NostalgicArtist;
  onDelete: (id: number) => void;
}) {
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-[#282828] px-3 py-1 text-sm text-white">
      {artist.name}
      <button
        onClick={() => onDelete(artist.id)}
        className="cursor-pointer border-none bg-transparent p-0 text-[#6a6a6a] transition-colors hover:text-red-400"
        aria-label={`Remove ${artist.name}`}
      >
        &#10005;
      </button>
    </span>
  );
}

function EraGroup({
  config,
  artists,
  onAdd,
  onDelete,
}: {
  config: EraGroupConfig;
  artists: NostalgicArtist[];
  onAdd: (name: string, era: Era, spotifyArtistId?: string) => void;
  onDelete: (id: number) => void;
}) {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<SpotifyArtist[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleInputChange(value: string) {
    setInputValue(value);
    clearTimeout(debounceRef.current);

    if (value.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const results = await searchArtists(value.trim(), 5);
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
      } catch {
        setSuggestions([]);
      }
    }, 300);
  }

  function selectArtist(artist: SpotifyArtist) {
    onAdd(artist.name, config.era, artist.id);
    setInputValue('');
    setSuggestions([]);
    setShowSuggestions(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    onAdd(trimmed, config.era);
    setInputValue('');
    setSuggestions([]);
    setShowSuggestions(false);
  }

  return (
    <div>
      <h4 className="mb-2 text-sm font-semibold text-white">
        {config.label}{' '}
        <span className="font-normal text-[#6a6a6a]">({config.ageRange})</span>
      </h4>

      {artists.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {artists.map((artist) => (
            <ArtistTag key={artist.id} artist={artist} onDelete={onDelete} />
          ))}
        </div>
      )}

      <div ref={wrapperRef} className="relative">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
            placeholder="Search for an artist"
            className="flex-1 rounded-lg bg-[#282828] px-3 py-1.5 text-sm text-white outline-none placeholder:text-[#6a6a6a] focus:ring-1 focus:ring-[#1DB954]"
          />
        </form>

        {showSuggestions && (
          <div className="absolute z-10 mt-1 w-full rounded-lg bg-[#282828] py-1 shadow-lg">
            {suggestions.map((artist) => (
              <button
                key={artist.id}
                onClick={() => selectArtist(artist)}
                className="flex w-full cursor-pointer items-center gap-3 border-none bg-transparent px-3 py-2 text-left transition-colors hover:bg-[#333]"
              >
                {artist.images[artist.images.length - 1]?.url ? (
                  <img
                    src={artist.images[artist.images.length - 1].url}
                    alt={artist.name}
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-[#404040]" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-white">{artist.name}</p>
                  {artist.genres.length > 0 && (
                    <p className="truncate text-xs text-[#6a6a6a]">
                      {artist.genres.join(', ')}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface NostalgicArtistsEditorProps {
  defaultExpanded?: boolean;
}

export interface NostalgicArtistsEditorHandle {
  collapse: () => void;
}

const NostalgicArtistsEditor = forwardRef<
  NostalgicArtistsEditorHandle,
  NostalgicArtistsEditorProps
>(function NostalgicArtistsEditor({ defaultExpanded = false }, ref) {
  const [isOpen, setIsOpen] = useState(defaultExpanded);
  useImperativeHandle(ref, () => ({
    collapse() {
      setIsOpen(false);
    },
  }));
  const queryClient = useQueryClient();

  const { data: artists = [] } = useQuery({
    queryKey: NOSTALGIC_ARTISTS_QUERY_KEY,
    queryFn: getNostalgicArtists,
  });

  const addMutation = useMutation({
    mutationFn: createNostalgicArtist,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOSTALGIC_ARTISTS_QUERY_KEY });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteNostalgicArtist,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOSTALGIC_ARTISTS_QUERY_KEY });
    },
  });

  function handleAdd(name: string, era: Era, spotifyArtistId?: string) {
    addMutation.mutate({ name, era, spotifyArtistId });
  }

  function handleDelete(id: number) {
    deleteMutation.mutate(id);
  }

  function artistsByEra(era: Era): NostalgicArtist[] {
    return artists.filter((a) => a.era === era);
  }

  return (
    <div className="mb-6 rounded-xl bg-[#181818]">
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full cursor-pointer items-center justify-between border-none bg-transparent px-6 py-4 text-left"
      >
        <span className="text-sm font-semibold text-[#b3b3b3]">
          Nostalgic Artists
        </span>
        <span
          className={`text-[#6a6a6a] transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        >
          &#9660;
        </span>
      </button>

      {isOpen && (
        <div className="space-y-6 px-6 pb-6">
          {ERA_GROUPS.map((config) => (
            <EraGroup
              key={config.era}
              config={config}
              artists={artistsByEra(config.era)}
              onAdd={handleAdd}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
});

export default NostalgicArtistsEditor;
