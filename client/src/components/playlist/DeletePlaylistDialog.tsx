import { useState, useEffect } from 'react';

interface DeletePlaylistDialogProps {
  isOpen: boolean;
  playlistName: string;
  isPublished: boolean;
  isDeleting?: boolean;
  errorMessage?: string | null;
  onCancel: () => void;
  onConfirm: (options: { removeFromSpotify: boolean }) => void;
}

export default function DeletePlaylistDialog({
  isOpen,
  playlistName,
  isPublished,
  isDeleting = false,
  errorMessage,
  onCancel,
  onConfirm,
}: DeletePlaylistDialogProps) {
  const [removeFromSpotify, setRemoveFromSpotify] = useState(false);

  useEffect(() => {
    if (isOpen) setRemoveFromSpotify(false);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-playlist-title"
    >
      <div className="w-full max-w-md rounded-xl bg-[#181818] p-6 shadow-2xl">
        <h2
          id="delete-playlist-title"
          className="mb-2 text-lg font-semibold text-white"
        >
          Delete playlist?
        </h2>
        <p className="mb-4 text-sm text-[#b3b3b3]">
          Are you sure you want to delete{' '}
          <span className="text-white">"{playlistName}"</span>? This can't be
          undone.
        </p>

        {isPublished && (
          <label className="mb-4 flex cursor-pointer items-start gap-2 rounded-lg bg-[#282828] p-3 text-sm text-white">
            <input
              type="checkbox"
              checked={removeFromSpotify}
              onChange={(e) => setRemoveFromSpotify(e.target.checked)}
              className="mt-0.5 h-4 w-4 cursor-pointer accent-[#1DB954]"
            />
            <span>
              Also remove from Spotify
              <span className="mt-0.5 block text-xs text-[#b3b3b3]">
                Unfollows the playlist in your Spotify account.
              </span>
            </span>
          </label>
        )}

        {errorMessage && (
          <p
            className="mb-3 rounded-md bg-red-900/30 p-2 text-sm text-red-300"
            role="alert"
          >
            {errorMessage}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="cursor-pointer rounded-full border-0 bg-transparent px-4 py-2 text-sm font-semibold text-[#b3b3b3] hover:text-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm({ removeFromSpotify })}
            disabled={isDeleting}
            className="cursor-pointer rounded-full border-0 bg-red-500 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
