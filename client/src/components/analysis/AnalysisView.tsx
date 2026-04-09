import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAnalysis } from '../../api/analysis';
import LoadingSpinner from '../common/LoadingSpinner';

type TabKey = 'artists' | 'tracks' | 'favorites';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'artists', label: 'Top Artists' },
  { key: 'tracks', label: 'Top Tracks' },
  { key: 'favorites', label: 'Favorites' },
];

export default function AnalysisView() {
  const [activeTab, setActiveTab] = useState<TabKey>('artists');

  const { data, isLoading } = useQuery({
    queryKey: ['analysis'],
    queryFn: getAnalysis,
  });

  if (isLoading) return <LoadingSpinner />;
  if (!data) return <p className="text-center text-[#b3b3b3]">No analysis data available.</p>;

  return (
    <div>
      <h1 className="mb-8 text-2xl font-bold text-white">Your Music Analysis</h1>

      {/* Stats cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl bg-[#181818] p-6">
          <p className="mb-1 text-sm text-[#b3b3b3]">Total Unique Artists</p>
          <p className="text-4xl font-bold text-[#1DB954]">
            {data.artists.totalUniqueArtists}
          </p>
        </div>
        <div className="rounded-xl bg-[#181818] p-6">
          <p className="mb-1 text-sm text-[#b3b3b3]">Total Unique Tracks</p>
          <p className="text-4xl font-bold text-[#1DB954]">
            {data.tracks.totalUniqueTracks}
          </p>
        </div>
      </div>

      {/* Top Genres */}
      <div className="mb-8 rounded-xl bg-[#181818] p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">Top Genres</h2>
        <div className="flex flex-wrap gap-2">
          {data.artists.topGenres.map((g) => (
            <span
              key={g.genre}
              className="rounded-full bg-[#282828] px-3 py-1 text-sm text-[#b3b3b3]"
            >
              {g.genre}
            </span>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-2 border-b border-[#404040]">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`cursor-pointer border-b-2 bg-transparent px-4 py-2 text-sm font-semibold transition-colors ${
              activeTab === tab.key
                ? 'border-[#1DB954] text-white'
                : 'border-transparent text-[#b3b3b3] hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="rounded-xl bg-[#181818] p-6">
        {activeTab === 'artists' && (
          <div className="space-y-3">
            {data.artists.rankedArtists.map((artist) => (
              <div key={artist.id} className="flex items-center gap-3">
                {artist.images?.[0]?.url ? (
                  <img
                    src={artist.images[0].url}
                    alt={artist.name}
                    className="h-12 w-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-[#282828]" />
                )}
                <div>
                  <p className="text-sm font-medium text-white">
                    {artist.name}
                  </p>
                  <p className="text-xs text-[#6a6a6a]">
                    {artist.genres?.join(', ')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'tracks' && (
          <div className="space-y-3">
            {data.tracks.rankedTracks.map((track) => (
              <div key={track.id} className="flex items-center gap-3">
                {track.album.images[0]?.url ? (
                  <img
                    src={track.album.images[0].url}
                    alt={track.album.name}
                    className="h-10 w-10 rounded object-cover"
                  />
                ) : (
                  <div className="h-10 w-10 rounded bg-[#282828]" />
                )}
                <div>
                  <p className="text-sm font-medium text-white">{track.name}</p>
                  <p className="text-xs text-[#b3b3b3]">
                    {track.artists.map((a) => a.name).join(', ')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'favorites' && (
          <div className="space-y-3">
            {data.artists.consistentFavorites.length > 0 && (
              <>
                <h3 className="mb-2 text-sm font-semibold text-[#b3b3b3]">
                  Favorite Artists
                </h3>
                {data.artists.consistentFavorites.map((artist) => (
                  <div key={artist.id} className="flex items-center gap-3">
                    {artist.images?.[0]?.url ? (
                      <img
                        src={artist.images[0].url}
                        alt={artist.name}
                        className="h-12 w-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-full bg-[#282828]" />
                    )}
                    <p className="text-sm font-medium text-white">
                      {artist.name}
                    </p>
                  </div>
                ))}
              </>
            )}

            {data.tracks.consistentFavorites.length > 0 && (
              <>
                <h3 className="mb-2 mt-4 text-sm font-semibold text-[#b3b3b3]">
                  Favorite Tracks
                </h3>
                {data.tracks.consistentFavorites.map((track) => (
                  <div key={track.id} className="flex items-center gap-3">
                    {track.album.images[0]?.url ? (
                      <img
                        src={track.album.images[0].url}
                        alt={track.album.name}
                        className="h-10 w-10 rounded object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded bg-[#282828]" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-white">
                        {track.name}
                      </p>
                      <p className="text-xs text-[#b3b3b3]">
                        {track.artists.map((a) => a.name).join(', ')}
                      </p>
                    </div>
                  </div>
                ))}
              </>
            )}

            {!data.artists.consistentFavorites.length &&
              !data.tracks.consistentFavorites.length && (
                <p className="text-[#6a6a6a]">No consistent favorites found yet.</p>
              )}
          </div>
        )}
      </div>
    </div>
  );
}
