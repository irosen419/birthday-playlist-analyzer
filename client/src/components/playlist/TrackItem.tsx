import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
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

// Fallback height used for top/bottom placement before the popover is measured.
// Assumes a single-column menu ~4 items tall. If the popover content grows
// (e.g., wrapping text or extra items), the flip logic may misplace it —
// at that point, measure the actual rendered height via a ref instead.
const ESTIMATED_POPOVER_HEIGHT = 180;

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1_000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
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
  const [popoverPlacement, setPopoverPlacement] = useState<'bottom' | 'top'>(
    'bottom'
  );
  const [measuredPopoverHeight, setMeasuredPopoverHeight] = useState<
    number | null
  >(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const mobileRowRef = useRef<HTMLDivElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const wasPopoverOpenRef = useRef(false);

  // Attach outside-click/touch listeners only while the popover is open.
  // Safe because the synthetic click that opened the popover has already
  // fully dispatched by the time this effect runs (React effects fire
  // after paint), so it won't immediately self-close.
  useEffect(() => {
    if (!isPopoverOpen) return;

    function handleClickOutside(event: Event) {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (menuButtonRef.current?.contains(target)) return;
      onOpenPopover(null);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onOpenPopover(null);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPopoverOpen, onOpenPopover]);

  useLayoutEffect(() => {
    if (!isPopoverOpen || !mobileRowRef.current) {
      if (measuredPopoverHeight !== null) setMeasuredPopoverHeight(null);
      return;
    }

    const actualHeight = popoverRef.current?.offsetHeight ?? null;
    if (actualHeight !== null && actualHeight !== measuredPopoverHeight) {
      setMeasuredPopoverHeight(actualHeight);
    }

    const popoverHeight =
      measuredPopoverHeight ?? actualHeight ?? ESTIMATED_POPOVER_HEIGHT;

    const rect = mobileRowRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    if (spaceBelow < popoverHeight && spaceAbove > spaceBelow) {
      setPopoverPlacement('top');
    } else {
      setPopoverPlacement('bottom');
    }
  }, [isPopoverOpen, measuredPopoverHeight]);

  useEffect(() => {
    if (!isPopoverOpen || !popoverRef.current) return;
    const firstMenuItem = popoverRef.current.querySelector<HTMLElement>(
      '[role="menuitem"]'
    );
    firstMenuItem?.focus();
  }, [isPopoverOpen]);

  useEffect(() => {
    if (wasPopoverOpenRef.current && !isPopoverOpen) {
      menuButtonRef.current?.focus();
    }
    wasPopoverOpenRef.current = isPopoverOpen;
  }, [isPopoverOpen]);

  function handleRowClickDesktop() {
    onPlay(track.uri);
  }

  // @hello-pangea/dnd attaches an onClick to dragHandleProps at runtime to
  // suppress clicks that follow a drag, but it isn't on the public type.
  const { onClick: dragHandleOnClick, ...dragHandleRest } = (provided.dragHandleProps ??
    {}) as { onClick?: (event: ReactMouseEvent<HTMLDivElement>) => void } & Record<
    string,
    unknown
  >;

  // Compose with the library's onClick so drag-click suppression still runs.
  function handleDragHandleClick(event: ReactMouseEvent<HTMLDivElement>) {
    dragHandleOnClick?.(event);
    if (event.defaultPrevented) return;
    setIsMoveModalOpen(true);
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
        {...dragHandleRest}
        onClick={handleDragHandleClick}
        className="hidden cursor-grab text-sm text-[#6a6a6a] opacity-40 transition-opacity group-hover:opacity-100 md:block"
        title="Click or drag to move"
      >
        &#8645;
      </div>

      {/* Position number */}
      <span className="w-8 text-center text-sm tabular-nums text-[#6a6a6a]">
        {track.position + 1}
      </span>

      {/* Clickable area: album art + track info + play button */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div
          className="hidden min-w-0 flex-1 cursor-pointer items-center gap-3 md:flex"
          onClick={handleRowClickDesktop}
        >
          <div className="relative h-10 w-10 shrink-0">
            {albumArt ? (
              <img
                src={albumArt}
                alt={track.album.name}
                className="h-10 w-10 rounded object-cover transition-opacity group-hover:opacity-40"
              />
            ) : (
              <div className="h-10 w-10 rounded bg-[#282828]" />
            )}
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-lg text-white opacity-0 transition-opacity group-hover:opacity-100">
              &#9654;
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{track.name}</p>
            <p className="truncate text-xs text-[#b3b3b3]">
              {track.artists.map((a) => a.name).join(', ')}
            </p>
          </div>
        </div>

        <div
          ref={mobileRowRef}
          className="relative flex min-w-0 flex-1 items-center gap-3 md:hidden"
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
              role="menu"
              aria-label={`Actions for ${track.name}`}
              className={`absolute left-12 z-40 flex min-w-[160px] flex-col rounded-lg border border-[#404040] bg-[#282828] py-1 shadow-xl ${
                popoverPlacement === 'top'
                  ? 'bottom-full mb-1'
                  : 'top-full mt-1'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <a
                href={`https://open.spotify.com/track/${track.id}`}
                target="_blank"
                rel="noopener noreferrer"
                role="menuitem"
                onClick={() => onOpenPopover(null)}
                className="whitespace-nowrap px-4 py-2 text-left text-sm font-semibold text-[#1DB954] hover:bg-[#3a3a3a]"
              >
                Open in Spotify &#8599;
              </a>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsMoveModalOpen(true);
                  onOpenPopover(null);
                }}
                className="cursor-pointer whitespace-nowrap border-none bg-transparent px-4 py-2 text-left text-sm text-white hover:bg-[#3a3a3a]"
              >
                Move
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onToggleLock(track.id);
                  onOpenPopover(null);
                }}
                className="cursor-pointer whitespace-nowrap border-none bg-transparent px-4 py-2 text-left text-sm text-white hover:bg-[#3a3a3a]"
              >
                {track.locked ? 'Unlock' : 'Lock'}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onRemove(track.id);
                  onOpenPopover(null);
                }}
                className="cursor-pointer whitespace-nowrap border-none bg-transparent px-4 py-2 text-left text-sm text-red-400 hover:bg-[#3a3a3a]"
              >
                Remove
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Duration (desktop only) */}
      <span className="hidden text-sm text-[#b3b3b3] md:inline">
        {formatDuration(track.durationMs)}
      </span>

      {/* Lock + remove (desktop only) */}
      <div className="hidden items-center gap-1 pl-3 md:flex">
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

        <button
          onClick={() => onRemove(track.id)}
          className="cursor-pointer border-none bg-transparent p-1.5 text-[#b3b3b3] opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
          aria-label="Remove track"
        >
          &#10005;
        </button>
      </div>

      {/* Actions menu (mobile only) */}
      <button
        ref={menuButtonRef}
        type="button"
        onClick={() => onOpenPopover(isPopoverOpen ? null : track.id)}
        aria-label="Track actions"
        aria-haspopup="menu"
        aria-expanded={isPopoverOpen}
        className="cursor-pointer border-none bg-transparent p-1.5 text-lg leading-none text-[#b3b3b3] md:hidden"
      >
        &#8942;
      </button>

      <MoveTrackModal
        isOpen={isMoveModalOpen}
        onClose={() => setIsMoveModalOpen(false)}
        currentIndex={index}
        totalTracks={totalTracks}
        trackName={track.name}
        onMove={(newPosition) => onMove(track.id, newPosition)}
      />
    </div>
  );
}
