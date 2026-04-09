import { useNavigate } from 'react-router-dom';
import type { PlaylistTrack } from '../../types';

interface PlaylistHeaderProps {
  name: string;
  onNameChange: (name: string) => void;
  tracks: PlaylistTrack[];
  isSaving: boolean;
  justSaved: boolean;
  onPublish: () => void;
  isPublishing: boolean;
}

function formatTotalDuration(tracks: PlaylistTrack[]): string {
  const totalMs = tracks.reduce((sum, t) => sum + t.durationMs, 0);
  const hours = Math.floor(totalMs / 3_600_000);
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export default function PlaylistHeader({
  name,
  onNameChange,
  tracks,
  isSaving,
  justSaved,
  onPublish,
  isPublishing,
}: PlaylistHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="mb-6">
      <div className="mb-4 flex items-center gap-4">
        <button
          onClick={() => navigate('/playlists')}
          className="cursor-pointer rounded-full border border-[#404040] bg-transparent px-4 py-2 text-sm font-semibold text-white transition-colors hover:border-white"
        >
          Back
        </button>

        {isSaving && (
          <span className="text-xs text-[#6a6a6a]">Saving...</span>
        )}
        {justSaved && !isSaving && (
          <span className="animate-fade-in-out text-xs text-[#1DB954]">
            Saved
          </span>
        )}
      </div>

      <input
        type="text"
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        className="mb-4 w-full border-b border-transparent bg-transparent text-3xl font-bold text-white outline-none transition-colors focus:border-[#1DB954]"
        placeholder="Playlist name"
      />

      <div className="flex items-center gap-6">
        <span className="text-sm text-[#b3b3b3]">{tracks.length} tracks</span>
        <span className="text-sm text-[#b3b3b3]">
          {formatTotalDuration(tracks)}
        </span>

        <button
          onClick={onPublish}
          disabled={isPublishing || !tracks.length}
          className="ml-auto cursor-pointer rounded-full bg-[#1DB954] px-6 py-2 text-sm font-semibold text-black transition-colors hover:bg-[#1ed760] disabled:opacity-50"
        >
          {isPublishing ? 'Publishing...' : 'Publish to Spotify'}
        </button>
      </div>
    </div>
  );
}
