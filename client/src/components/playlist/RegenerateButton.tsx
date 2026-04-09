import type { PlaylistTrack } from '../../types';

interface RegenerateButtonProps {
  tracks: PlaylistTrack[];
  lockedTrackIds: Set<string>;
  isGenerating: boolean;
  onRegenerate: () => void;
}

export default function RegenerateButton({
  tracks,
  lockedTrackIds,
  isGenerating,
  onRegenerate,
}: RegenerateButtonProps) {
  const allLocked = tracks.length > 0 && lockedTrackIds.size === tracks.length;
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

  return (
    <button
      onClick={handleClick}
      disabled={isGenerating || allLocked}
      title={allLocked ? 'Unlock at least one track to regenerate' : undefined}
      className="cursor-pointer rounded-full border border-[#404040] bg-transparent px-6 py-2 text-sm font-semibold text-white transition-colors hover:border-white disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isGenerating ? 'Generating...' : 'Regenerate'}
    </button>
  );
}
