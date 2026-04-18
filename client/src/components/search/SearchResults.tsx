import type { Track } from '../../types';

interface SearchResultsProps {
  results: Track[];
  onAdd: (track: Track) => void;
  addedTrackIds?: Set<string>;
}

export default function SearchResults({ results, onAdd, addedTrackIds }: SearchResultsProps) {
  return (
    <div className="absolute left-0 right-0 top-full z-40 mt-2 max-h-96 overflow-y-auto rounded-xl bg-[#282828] shadow-xl">
      {results.map((track) => {
        const albumArt = track.album.images[0]?.url;
        const alreadyAdded = addedTrackIds?.has(track.id) ?? false;

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
              <a
                href={`https://open.spotify.com/track/${track.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block truncate text-sm font-medium text-white hover:text-[#1DB954] hover:underline"
              >
                {track.name}
              </a>
              <p className="truncate text-xs text-[#b3b3b3]">
                {track.artists.map((a) => a.name).join(', ')}
              </p>
            </div>

            {alreadyAdded ? (
              <span
                aria-label="Already in playlist"
                title="Already in playlist"
                className="flex h-7 w-7 items-center justify-center rounded-full text-[#1DB954]"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-5 w-5"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.704 5.29a1 1 0 010 1.42l-7.99 7.99a1 1 0 01-1.42 0l-3.99-3.99a1 1 0 111.42-1.42l3.28 3.28 7.28-7.28a1 1 0 011.42 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </span>
            ) : (
              <button
                onClick={() => onAdd(track)}
                className="cursor-pointer rounded-full border border-[#404040] bg-transparent px-3 py-1 text-sm font-semibold text-white transition-colors hover:border-white"
              >
                +
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
