import type { Track } from '../../types';

interface SearchResultsProps {
  results: Track[];
  onAdd: (track: Track) => void;
}

export default function SearchResults({ results, onAdd }: SearchResultsProps) {
  return (
    <div className="absolute left-0 right-0 top-full z-40 mt-2 max-h-96 overflow-y-auto rounded-xl bg-[#282828] shadow-xl">
      {results.map((track) => {
        const albumArt = track.album.images[0]?.url;

        return (
          <div
            key={track.id}
            className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[#2a2a2a]"
          >
            {albumArt ? (
              <img
                src={albumArt}
                alt={track.album.name}
                className="h-10 w-10 rounded object-cover"
              />
            ) : (
              <div className="h-10 w-10 rounded bg-[#181818]" />
            )}

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">
                {track.name}
              </p>
              <p className="truncate text-xs text-[#b3b3b3]">
                {track.artists.map((a) => a.name).join(', ')}
              </p>
            </div>

            <button
              onClick={() => onAdd(track)}
              className="cursor-pointer rounded-full border border-[#404040] bg-transparent px-3 py-1 text-sm font-semibold text-white transition-colors hover:border-white"
            >
              +
            </button>
          </div>
        );
      })}
    </div>
  );
}
