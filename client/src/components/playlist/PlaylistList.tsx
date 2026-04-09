import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPlaylists, createPlaylist, deletePlaylist } from '../../api/playlists';
import LoadingSpinner from '../common/LoadingSpinner';

const DEFAULT_PLAYLIST_NAME = 'Birthday Party Playlist';

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function PlaylistList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: playlists, isLoading } = useQuery({
    queryKey: ['playlists'],
    queryFn: getPlaylists,
  });

  const createMutation = useMutation({
    mutationFn: () => createPlaylist({ name: DEFAULT_PLAYLIST_NAME }),
    onSuccess: (newPlaylist) => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
      navigate(`/playlists/${newPlaylist.id}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deletePlaylist(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
    },
  });

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Your Playlists</h1>
        <button
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending}
          className="cursor-pointer rounded-full bg-[#1DB954] px-6 py-3 text-sm font-semibold text-black transition-colors hover:bg-[#1ed760] disabled:opacity-50"
        >
          {createMutation.isPending ? 'Creating...' : 'Create New Playlist'}
        </button>
      </div>

      {!playlists?.length ? (
        <div className="rounded-xl bg-[#181818] p-12 text-center">
          <p className="mb-2 text-lg text-white">No playlists yet</p>
          <p className="text-[#b3b3b3]">
            Create your first birthday playlist to get started.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {playlists.map((playlist) => (
            <div
              key={playlist.id}
              className="relative rounded-xl bg-[#181818] p-6 transition-colors hover:bg-[#2a2a2a]"
            >
              <button
                onClick={() => navigate(`/playlists/${playlist.id}`)}
                className="w-full cursor-pointer border-none bg-transparent text-left"
              >
                <div className="mb-3 flex items-start justify-between">
                  <h2 className="text-lg font-semibold text-white">
                    {playlist.name}
                  </h2>
                  {playlist.spotifyPlaylistId && (
                    <span className="rounded-full bg-[rgba(29,185,84,0.2)] px-2 py-0.5 text-xs text-[#1DB954]">
                      Published
                    </span>
                  )}
                </div>

                <p className="mb-1 text-sm text-[#b3b3b3]">
                  {playlist.trackCount ?? playlist.tracks.length} tracks
                </p>

                <p className="text-xs text-[#6a6a6a]">
                  Updated {formatDate(playlist.updatedAt)}
                </p>
              </button>

              {!playlist.spotifyPlaylistId && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete "${playlist.name}"?`)) {
                      deleteMutation.mutate(playlist.id);
                    }
                  }}
                  className="absolute top-3 right-3 cursor-pointer rounded-full border-none bg-transparent p-1.5 text-[#6a6a6a] transition-colors hover:bg-[#404040] hover:text-red-400"
                  title="Delete playlist"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
