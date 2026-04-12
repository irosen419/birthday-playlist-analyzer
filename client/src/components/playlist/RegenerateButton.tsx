import type { PlaylistTrack } from '../../types';

interface RegenerateButtonProps {
  tracks: PlaylistTrack[];
  lockedTrackIds: Set<string>;
  isGenerating: boolean;
  ratiosValid: boolean;
  onRegenerate: () => void;
  onLockAll: () => void;
  onUnlockAll: () => void;
  onShuffle: () => void;
  onCancel?: () => void;
  onDelete?: () => void;
  isPublished?: boolean;
}

export default function RegenerateButton({
  tracks,
  lockedTrackIds,
  isGenerating,
  ratiosValid,
  onRegenerate,
  onLockAll,
  onUnlockAll,
  onShuffle,
  onCancel,
  onDelete,
  isPublished = false,
}: RegenerateButtonProps) {
  const isEmpty = tracks.length === 0;
  const allLocked = tracks.length > 0 && lockedTrackIds.size === tracks.length;
  const noneLocked = lockedTrackIds.size === 0;
  const someLockedCount = lockedTrackIds.size;

  function handleClick() {
    if (allLocked) {
      alert(
        'All tracks are locked. Unlock at least one track before regenerating.'
      );
      return;
    }

    if (someLockedCount > 0) {
      const confirmed = confirm(
        `${someLockedCount} track${someLockedCount > 1 ? 's are' : ' is'} locked and will stay in place. Regenerate the rest?`
      );
      if (!confirmed) return;
    }

    onRegenerate();
  }

  function handleDeleteClick() {
    if (!onDelete) return;
    const message = isPublished
      ? 'This playlist is published to Spotify. Delete the local copy? (The Spotify playlist will remain in your account.)'
      : 'Delete this playlist?';
    if (confirm(message)) {
      onDelete();
    }
  }

  return (
    <div className="contents sm:flex sm:flex-wrap sm:items-center sm:gap-2">
      <button
        onClick={handleClick}
        disabled={isGenerating || allLocked || !ratiosValid}
        title={
          !ratiosValid
            ? 'Ratios must sum to 100%'
            : allLocked
              ? 'Unlock at least one track to regenerate'
              : undefined
        }
        className="w-full cursor-pointer rounded-full border border-[#1DB954] bg-[#282828] px-6 py-2 text-sm font-semibold text-white transition-colors hover:border-[#1ed760] hover:bg-[#333333] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {isGenerating ? 'Generating...' : isEmpty ? 'Generate' : 'Regenerate'}
      </button>

      {isEmpty && onCancel && (
        <button
          onClick={onCancel}
          disabled={isGenerating}
          className="w-full cursor-pointer rounded-full border border-red-500 bg-[#282828] px-6 py-2 text-sm font-semibold text-white transition-colors hover:border-red-400 hover:bg-[#333333] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          Cancel
        </button>
      )}

      {!isEmpty && onDelete && (
        <button
          onClick={handleDeleteClick}
          className="w-full cursor-pointer rounded-full border border-red-500 bg-[#282828] px-6 py-2 text-sm font-semibold text-white transition-colors hover:border-red-400 hover:bg-[#333333] sm:w-auto"
        >
          Delete
        </button>
      )}

      {tracks.length > 1 && (
        <button
          onClick={onShuffle}
          disabled={allLocked}
          className="w-full cursor-pointer rounded-full border-0 bg-transparent px-4 py-2 text-sm font-semibold text-[#6a6a6a] transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          title={allLocked ? 'Unlock some tracks to shuffle' : 'Shuffle track order'}
        >
          Shuffle
        </button>
      )}

      {tracks.length > 0 && (
        <button
          onClick={allLocked ? onUnlockAll : onLockAll}
          className="w-full cursor-pointer rounded-full border-0 bg-transparent px-4 py-2 text-sm font-semibold text-[#6a6a6a] transition-colors hover:text-white sm:w-auto"
        >
          {allLocked ? '🔓 Unlock All' : noneLocked ? '🔒 Lock All' : `🔒 Lock All (${someLockedCount}/${tracks.length})`}
        </button>
      )}
    </div>
  );
}
