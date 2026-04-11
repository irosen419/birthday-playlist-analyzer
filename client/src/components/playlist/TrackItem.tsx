import { useEffect, useRef, useState } from 'react';
import type { DraggableProvided } from '@hello-pangea/dnd';
import type { PlaylistTrack } from '../../types';
import MoveTrackModal from './MoveTrackModal';

interface TrackItemProps {
  track: PlaylistTrack;
  index: number;
  totalTracks: number;
  provided: DraggableProvided;
  isPopoverOpen: boolean;
  onOpenPopover: (trackId: string | null) => void;
  onPlay: (uri: string) => void;
  onToggleLock: (trackId: string) => void;
  onRemove: (trackId: string) => void;
  onMove: (trackId: string, newPosition: number) => void;
}

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1_000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function spotifyTrackUrl(id: string, uri: string): string {
  if (id) return `https://open.spotify.com/track/${id}`;
  const parsed = uri.split(':').pop();
  return `https://open.spotify.com/track/${parsed ?? ''}`;
}

export default function TrackItem({
  track,
  index,
  totalTracks,
  provided,
  isPopoverOpen,
  onOpenPopover,
  onPlay,
  onToggleLock,
  onRemove,
  onMove,
}: TrackItemProps) {
  const albumArt = track.album.images[0]?.url;
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isPopoverOpen) return;

    function handleClickOutside(event: Event) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        onOpenPopover(null);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isPopoverOpen, onOpenPopover]);

  function handleRowClickDesktop() {
    onPlay(track.uri);
  }

  function handleRowClickMobile() {
    onOpenPopover(isPopoverOpen ? null : track.id);
  }

  return (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
        track.locked
          ? 'bg-[rgba(29,185,84,0.22)] hover:bg-[rgba(29,185,84,0.32)]'
          : 'hover:bg-[#2a2a2a]'
      }`}
    >
      {/* Drag handle (desktop only) */}
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

      {/* Clickable area: album art + track info + play button */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div
          className="hidden min-w-0 flex-1 cursor-pointer items-center gap-3 md:flex"
          onClick={handleRowClickDesktop}
        >
          {albumArt ? (
            <img
              src={albumArt}
              alt={track.album.name}
              className="h-10 w-10 shrink-0 rounded object-cover"
            />
          ) : (
            <div className="h-10 w-10 shrink-0 rounded bg-[#282828]" />
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{track.name}</p>
            <p className="truncate text-xs text-[#b3b3b3]">
              {track.artists.map((a) => a.name).join(', ')}
            </p>
          </div>

          <span className="shrink-0 text-base text-[#b3b3b3] opacity-0 transition-opacity group-hover:opacity-100">
            &#9654;
          </span>
        </div>

        <div
          className="relative flex min-w-0 flex-1 cursor-pointer items-center gap-3 md:hidden"
          onClick={handleRowClickMobile}
        >
          {albumArt ? (
            <img
              src={albumArt}
              alt={track.album.name}
              className="h-10 w-10 shrink-0 rounded object-cover"
            />
          ) : (
            <div className="h-10 w-10 shrink-0 rounded bg-[#282828]" />
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{track.name}</p>
            <p className="truncate text-xs text-[#b3b3b3]">
              {track.artists.map((a) => a.name).join(', ')}
            </p>
          </div>

          {isPopoverOpen && (
            <div
              ref={popoverRef}
              className="absolute left-12 top-full z-40 mt-1 rounded-lg border border-[#404040] bg-[#282828] px-3 py-2 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <a
                href={spotifyTrackUrl(track.id, track.uri)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => onOpenPopover(null)}
                className="whitespace-nowrap text-sm font-semibold text-[#1DB954] hover:underline"
              >
                Open in Spotify &#8599;
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Duration (desktop only) */}
      <span className="hidden text-sm text-[#b3b3b3] md:inline">
        {formatDuration(track.durationMs)}
      </span>

      {/* Move button (mobile only) */}
      <button
        onClick={() => setIsMoveModalOpen(true)}
        className="cursor-pointer border-none bg-transparent p-1.5 text-[#b3b3b3] md:hidden"
        aria-label="Move track"
      >
        &#8645;
      </button>

      {/* Lock button */}
      <button
        onClick={() => onToggleLock(track.id)}
        className={`cursor-pointer border-none bg-transparent p-1.5 transition-colors ${
          track.locked
            ? 'text-[#1DB954]'
            : 'text-[#b3b3b3] hover:text-white md:opacity-0 md:group-hover:opacity-100'
        }`}
        aria-label={track.locked ? 'Unlock track' : 'Lock track'}
      >
        {track.locked ? '🔒' : '🔓'}
      </button>

      {/* Remove button */}
      <button
        onClick={() => onRemove(track.id)}
        className="cursor-pointer border-none bg-transparent p-1.5 text-[#b3b3b3] transition-opacity hover:text-red-400 md:opacity-0 md:group-hover:opacity-100"
        aria-label="Remove track"
      >
        &#10005;
      </button>

      <MoveTrackModal
        isOpen={isMoveModalOpen}
        onClose={() => setIsMoveModalOpen(false)}
        currentPosition={index}
        totalTracks={totalTracks}
        trackName={track.name}
        onMove={(newPosition) => onMove(track.id, newPosition)}
      />
    </div>
  );
}
