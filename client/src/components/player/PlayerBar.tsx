import { useEffect, useRef, useState } from 'react';
import { usePlayer, usePlayerProgress } from '../../context/PlayerContext';

function formatTime(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '0:00';
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function PlayerBar() {
  const {
    isReady,
    isPaused,
    currentTrack,
    togglePlayPause,
    next,
    previous,
    seek,
  } = usePlayer();
  const { position, duration } = usePlayerProgress();

  const [dragValue, setDragValue] = useState<number | null>(null);
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  const displayPosition = dragValue ?? position;
  const progressPct = duration > 0 ? Math.min(100, (displayPosition / duration) * 100) : 0;
  const hoverPct =
    hoverValue != null && duration > 0
      ? Math.min(100, (hoverValue / duration) * 100)
      : null;
  const previewPct =
    hoverPct != null && hoverPct > progressPct ? hoverPct - progressPct : 0;

  useEffect(() => {
    function handleMove(e: MouseEvent) {
      if (!isDraggingRef.current || !barRef.current || duration <= 0) return;
      const rect = barRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      setDragValue(pct * duration);
    }
    function handleUp() {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      setDragValue((current) => {
        if (current != null) seek(current);
        return null;
      });
    }
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [duration, seek]);

  function pctFromEvent(clientX: number): number | null {
    if (!barRef.current || duration <= 0) return null;
    const rect = barRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }

  function handleBarMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    const pct = pctFromEvent(e.clientX);
    if (pct == null) return;
    isDraggingRef.current = true;
    setDragValue(pct * duration);
  }

  function handleBarMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const pct = pctFromEvent(e.clientX);
    if (pct == null) return;
    setHoverValue(pct * duration);
  }

  function handleBarKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (duration <= 0) return;
    const SMALL_STEP_MS = 5_000;
    const LARGE_STEP_MS = 10_000;
    const step = e.shiftKey ? LARGE_STEP_MS : SMALL_STEP_MS;

    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        seek(position + step);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        seek(position - step);
        break;
      case 'Home':
        e.preventDefault();
        seek(0);
        break;
      case 'End':
        e.preventDefault();
        seek(duration);
        break;
    }
  }

  if (!isReady) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#404040] bg-[#181818] px-4 py-2 md:px-6 md:py-3">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 md:grid md:grid-cols-3">
        {/* Track info */}
        <div className="flex min-w-0 items-center gap-3">
          {currentTrack ? (
            <>
              {currentTrack.albumArt && (
                <img
                  src={currentTrack.albumArt}
                  alt={currentTrack.album}
                  className="h-10 w-10 shrink-0 rounded"
                />
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">
                  {currentTrack.name}
                </p>
                <p className="truncate text-xs text-[#b3b3b3]">
                  {currentTrack.artists}
                </p>
              </div>
            </>
          ) : (
            <p className="text-sm text-[#6a6a6a]">No track playing</p>
          )}
        </div>

        {/* Controls + progress */}
        <div className="flex shrink-0 flex-col items-stretch justify-center gap-1">
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={previous}
            className="hidden cursor-pointer border-none bg-transparent p-2 text-[#b3b3b3] transition-colors hover:text-white md:block"
            aria-label="Previous track"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M3.3 1a.7.7 0 0 1 .7.7v5.15l9.95-5.744a.7.7 0 0 1 1.05.606v12.575a.7.7 0 0 1-1.05.607L4 9.149V14.3a.7.7 0 0 1-.7.7H2.7a.7.7 0 0 1-.7-.7V1.7a.7.7 0 0 1 .7-.7h.6z" />
            </svg>
          </button>

          <button
            onClick={togglePlayPause}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-none bg-white text-black transition-transform hover:scale-105"
            aria-label={isPaused ? 'Play' : 'Pause'}
          >
            {isPaused ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M3 1.713a.7.7 0 0 1 1.05-.607l10.89 6.288a.7.7 0 0 1 0 1.212L4.05 14.894A.7.7 0 0 1 3 14.288V1.713z" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M2.7 1a.7.7 0 0 0-.7.7v12.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7H2.7zm8 0a.7.7 0 0 0-.7.7v12.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7h-2.6z" />
              </svg>
            )}
          </button>

          <button
            onClick={next}
            className="hidden cursor-pointer border-none bg-transparent p-2 text-[#b3b3b3] transition-colors hover:text-white md:block"
            aria-label="Next track"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M12.7 1a.7.7 0 0 0-.7.7v5.15L2.05 1.107A.7.7 0 0 0 1 1.712v12.575a.7.7 0 0 0 1.05.607L12 9.149V14.3a.7.7 0 0 0 .7.7h.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7h-.6z" />
            </svg>
          </button>
        </div>

          {/* Progress */}
          <div className="flex items-center gap-2">
            <span className="w-10 text-right text-[11px] tabular-nums text-[#b3b3b3]">
              {formatTime(displayPosition)}
            </span>
            <div
              ref={barRef}
              onMouseDown={handleBarMouseDown}
              onMouseMove={handleBarMouseMove}
              onMouseLeave={() => setHoverValue(null)}
              onKeyDown={handleBarKeyDown}
              tabIndex={0}
              className="group relative h-1 flex-1 cursor-pointer rounded-full bg-[#4d4d4d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1db954]"
              role="slider"
              aria-label="Seek"
              aria-valuemin={0}
              aria-valuemax={duration}
              aria-valuenow={Math.floor(displayPosition)}
            >
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-white group-hover:bg-[#1db954]"
                style={{ width: `${progressPct}%` }}
              />
              {previewPct > 0 && (
                <div
                  className="absolute inset-y-0 rounded-full bg-white/40"
                  style={{ left: `${progressPct}%`, width: `${previewPct}%` }}
                />
              )}
              <div
                className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white opacity-0 transition-opacity group-hover:opacity-100"
                style={{ left: `${progressPct}%` }}
              />
              {hoverPct != null && hoverValue != null && (
                <div
                  className="pointer-events-none absolute bottom-full mb-2 -translate-x-1/2 rounded bg-[#282828] px-2 py-1 text-[11px] tabular-nums text-white shadow-lg"
                  style={{ left: `${hoverPct}%` }}
                >
                  {formatTime(hoverValue)}
                </div>
              )}
            </div>
            <span className="w-10 text-[11px] tabular-nums text-[#b3b3b3]">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* Status */}
        <div className="hidden justify-end md:flex">
          <span className="text-xs text-[#6a6a6a]">
            {currentTrack ? (isPaused ? 'Paused' : 'Playing') : 'Ready'}
          </span>
        </div>
      </div>
    </div>
  );
}
