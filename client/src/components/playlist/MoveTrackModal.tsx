import { useEffect, useState } from 'react';

interface MoveTrackModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPosition: number;
  totalTracks: number;
  trackName: string;
  onMove: (newPosition: number) => void;
}

function clampPosition(value: number, totalTracks: number): number {
  if (Number.isNaN(value)) return 1;
  if (value < 1) return 1;
  if (value > totalTracks) return totalTracks;
  return value;
}

export default function MoveTrackModal({
  isOpen,
  onClose,
  currentPosition,
  totalTracks,
  trackName,
  onMove,
}: MoveTrackModalProps) {
  const [positionInput, setPositionInput] = useState<string>(
    String(currentPosition + 1)
  );

  useEffect(() => {
    if (isOpen) {
      setPositionInput(String(currentPosition + 1));
    }
  }, [isOpen, currentPosition]);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  function commitMove(rawOneIndexed: number) {
    const clamped = clampPosition(rawOneIndexed, totalTracks);
    onMove(clamped - 1);
    onClose();
  }

  function handleConfirm() {
    const parsed = parseInt(positionInput, 10);
    commitMove(parsed);
  }

  return (
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

        <div className="mb-4 flex gap-3">
          <button
            type="button"
            onClick={() => commitMove(1)}
            className="flex-1 cursor-pointer rounded-full border border-[#404040] bg-transparent px-4 py-2 text-sm font-semibold text-white transition-colors hover:border-white"
          >
            Move to top
          </button>
          <button
            type="button"
            onClick={() => commitMove(totalTracks)}
            className="flex-1 cursor-pointer rounded-full border border-[#404040] bg-transparent px-4 py-2 text-sm font-semibold text-white transition-colors hover:border-white"
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
              if (e.key === 'Enter') handleConfirm();
            }}
            className="w-full rounded-lg bg-[#282828] px-3 py-2 text-white outline-none focus:ring-1 focus:ring-[#1DB954]"
          />
        </label>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 cursor-pointer rounded-full border border-[#404040] bg-transparent px-4 py-2 text-sm font-semibold text-white transition-colors hover:border-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 cursor-pointer rounded-full bg-[#1DB954] px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-[#1ed760]"
          >
            Move
          </button>
        </div>
      </div>
    </div>
  );
}
