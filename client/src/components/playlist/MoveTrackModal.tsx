import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface MoveTrackModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentIndex: number;
  totalTracks: number;
  trackName: string;
  onMove: (newPosition: number) => void;
}

function clampPosition(value: number, totalTracks: number): number {
  if (value < 1) return 1;
  if (value > totalTracks) return totalTracks;
  return value;
}

export default function MoveTrackModal({
  isOpen,
  onClose,
  currentIndex,
  totalTracks,
  trackName,
  onMove,
}: MoveTrackModalProps) {
  const [positionInput, setPositionInput] = useState<string>(
    String(currentIndex + 1)
  );

  useEffect(() => {
    if (isOpen) {
      setPositionInput(String(currentIndex + 1));
    }
  }, [isOpen, currentIndex]);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const parsedPosition = parseInt(positionInput, 10);
  const isInputValid =
    Number.isInteger(parsedPosition) &&
    parsedPosition >= 1 &&
    parsedPosition <= totalTracks;

  function commitMove(rawOneIndexed: number) {
    const clamped = clampPosition(rawOneIndexed, totalTracks);
    onMove(clamped - 1);
    onClose();
  }

  function handleConfirm() {
    if (!isInputValid) return;
    commitMove(parsedPosition);
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-[#181818] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-white">Move track</h2>
          <p className="mt-1 truncate text-sm text-[#b3b3b3]">{trackName}</p>
        </div>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => commitMove(1)}
            className="cursor-pointer rounded-full border border-[#404040] bg-transparent px-4 py-2 text-sm font-semibold text-white transition-colors hover:border-white sm:flex-1"
          >
            Move to top
          </button>
          <button
            type="button"
            onClick={() => commitMove(totalTracks)}
            className="cursor-pointer rounded-full border border-[#404040] bg-transparent px-4 py-2 text-sm font-semibold text-white transition-colors hover:border-white sm:flex-1"
          >
            Move to bottom
          </button>
        </div>

        <div className="my-4 border-t border-[#282828]" />

        <label className="mb-4 block">
          <span className="mb-2 block text-sm text-[#b3b3b3]">
            Move to position (1&ndash;{totalTracks})
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={totalTracks}
            value={positionInput}
            onChange={(e) => setPositionInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && isInputValid) handleConfirm();
            }}
            className="w-full rounded-lg bg-[#282828] px-3 py-2 text-white outline-none focus:ring-1 focus:ring-[#1DB954]"
          />
        </label>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-full border border-[#404040] bg-transparent px-4 py-2 text-sm font-semibold text-white transition-colors hover:border-white sm:flex-1"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!isInputValid}
            className="cursor-pointer rounded-full bg-[#1DB954] px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-[#1ed760] disabled:cursor-not-allowed disabled:opacity-50 sm:flex-1"
          >
            Move
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
