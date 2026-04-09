import { useState } from 'react';
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
  spotifyPlaylistId?: string;
  justPublished: boolean;
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
  spotifyPlaylistId,
  justPublished,
}: PlaylistHeaderProps) {
  const navigate = useNavigate();
  const spotifyUrl = spotifyPlaylistId
    ? `https://open.spotify.com/playlist/${spotifyPlaylistId}`
    : null;

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

      {/* Publish success banner */}
      {justPublished && (
        <div className="mb-4 flex items-center gap-3 rounded-lg bg-[rgba(29,185,84,0.15)] px-4 py-3">
          <span className="text-[#1DB954]">&#10003;</span>
          <span className="text-sm text-white">
            Playlist published to Spotify!
          </span>
          {spotifyUrl && (
            <a
              href={spotifyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-sm font-semibold text-[#1DB954] hover:underline"
            >
              Open in Spotify &#8599;
            </a>
          )}
        </div>
      )}

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

        <div className="ml-auto flex items-center gap-3">
          {spotifyUrl && !justPublished && (
            <a
              href={spotifyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-[#1DB954] px-4 py-2 text-sm font-semibold text-[#1DB954] transition-colors hover:bg-[rgba(29,185,84,0.1)]"
            >
              Open in Spotify &#8599;
            </a>
          )}

          <button
            onClick={onPublish}
            disabled={isPublishing || !tracks.length}
            className="cursor-pointer rounded-full bg-[#1DB954] px-6 py-2 text-sm font-semibold text-black transition-colors hover:bg-[#1ed760] disabled:opacity-50"
          >
            {isPublishing
              ? 'Publishing...'
              : spotifyPlaylistId
                ? 'Update on Spotify'
                : 'Publish to Spotify'}
          </button>
        </div>
      </div>
    </div>
  );
}
