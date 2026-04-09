import { usePlayer } from '../../context/PlayerContext';

export default function PlayerBar() {
  const { isReady, isPaused, currentTrack, togglePlayPause, next, previous } =
    usePlayer();

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

        {/* Controls */}
        <div className="flex shrink-0 items-center justify-center gap-4">
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
