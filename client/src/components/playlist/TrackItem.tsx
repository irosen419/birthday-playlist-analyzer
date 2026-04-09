import type { DraggableProvided } from '@hello-pangea/dnd';
import type { PlaylistTrack } from '../../types';

interface TrackItemProps {
  track: PlaylistTrack;
  provided: DraggableProvided;
  onPlay: (uri: string) => void;
  onToggleLock: (trackId: string) => void;
  onRemove: (trackId: string) => void;
}

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1_000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export default function TrackItem({
  track,
  provided,
  onPlay,
  onToggleLock,
  onRemove,
}: TrackItemProps) {
  const albumArt = track.album.images[0]?.url;

  return (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      className={`group flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
        track.locked
          ? 'bg-[rgba(29,185,84,0.22)] hover:bg-[rgba(29,185,84,0.32)]'
          : 'hover:bg-[#2a2a2a]'
      }`}
    >
      {/* Drag handle */}
      <div
        {...provided.dragHandleProps}
        className="hidden cursor-grab text-[#6a6a6a] opacity-0 transition-opacity group-hover:opacity-100 md:block"
      >
        &#x2807;
      </div>

      {/* Position number */}
      <span className="w-6 text-right text-sm text-[#6a6a6a]">
        {track.position + 1}
      </span>

      {/* Clickable area: album art + track info + play button — clicking plays the track */}
      <div
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3"
        onClick={() => onPlay(track.uri)}
      >
        {/* Album art */}
        {albumArt ? (
          <img
            src={albumArt}
            alt={track.album.name}
            className="h-10 w-10 shrink-0 rounded object-cover"
          />
        ) : (
          <div className="h-10 w-10 shrink-0 rounded bg-[#282828]" />
        )}

        {/* Track info */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">{track.name}</p>
          <p className="truncate text-xs text-[#b3b3b3]">
            {track.artists.map((a) => a.name).join(', ')}
          </p>
        </div>

        {/* Play icon - centered vertically in the row */}
        <span className="shrink-0 text-base text-[#b3b3b3] opacity-0 transition-opacity group-hover:opacity-100">
          &#9654;
        </span>
      </div>

      {/* Duration */}
      <span className="hidden text-sm text-[#b3b3b3] md:inline">
        {formatDuration(track.durationMs)}
      </span>

      {/* Lock button - always visible when locked */}
      <button
        onClick={() => onToggleLock(track.id)}
        className={`cursor-pointer border-none bg-transparent p-1.5 transition-colors ${
          track.locked
            ? 'text-[#1DB954]'
            : 'text-[#b3b3b3] opacity-0 hover:text-white group-hover:opacity-100'
        }`}
        aria-label={track.locked ? 'Unlock track' : 'Lock track'}
      >
        {track.locked ? '🔒' : '🔓'}
      </button>

      {/* Remove button - visible on hover */}
      <button
        onClick={() => onRemove(track.id)}
        className="cursor-pointer border-none bg-transparent p-1.5 text-[#b3b3b3] opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
        aria-label="Remove track"
      >
        &#10005;
      </button>
    </div>
  );
}
