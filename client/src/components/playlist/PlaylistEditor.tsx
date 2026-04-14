import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { PlaylistTrack, Track } from '../../types';
import {
  getPlaylist,
  generatePlaylist,
  publishPlaylist,
  deletePlaylist,
} from '../../api/playlists';
import { useAutoSave } from '../../hooks/useAutoSave';
import type { GenerationConfig } from '../../hooks/useAutoSave';
import { areRatiosValid } from '../../lib/ratioValidation';
import { usePlayer } from '../../context/PlayerContext';
import { useAuth } from '../../context/AuthContext';
import DeletePlaylistDialog from './DeletePlaylistDialog';
import PlaylistHeader from './PlaylistHeader';
import PlaylistTrackList from './PlaylistTrackList';
import RegenerateButton from './RegenerateButton';
import NostalgicArtistsEditor from './NostalgicArtistsEditor';
import type { NostalgicArtistsEditorHandle } from './NostalgicArtistsEditor';
import PlaylistConfig from './PlaylistConfig';
import type { PlaylistConfigHandle } from './PlaylistConfig';
import SearchBar from '../search/SearchBar';
import ScrollFab from './ScrollFab';
import LoadingSpinner from '../common/LoadingSpinner';

function recalculatePositions(tracks: PlaylistTrack[]): PlaylistTrack[] {
  return tracks.map((track, index) => ({ ...track, position: index }));
}

export default function PlaylistEditor() {
  const { id } = useParams<{ id: string }>();
  const playlistId = id ? Number(id) : undefined;
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { playTrack, syncQueue } = usePlayer();
  const { user } = useAuth();
  const configRef = useRef<PlaylistConfigHandle>(null);
  const nostalgicRef = useRef<NostalgicArtistsEditorHandle>(null);

  const { data: playlist, isLoading } = useQuery({
    queryKey: ['playlist', playlistId],
    queryFn: () => getPlaylist(playlistId!),
    enabled: !!playlistId,
  });

  const [name, setName] = useState('');
  const [tracks, setTracks] = useState<PlaylistTrack[]>([]);
  const [lockedTrackIds, setLockedTrackIds] = useState<Set<string>>(new Set());

  const [generationConfig, setGenerationConfig] = useState<GenerationConfig>({
    favoritesRatio: 0.3,
    discoveryRatio: 0.3,
    eraHitsRatio: 0.4,
    targetSongCount: 125,
  });

  // Hydrate local state only when navigating to a different playlist (keyed on
  // playlist?.id), NOT on every refetch. Re-hydrating on refetch would clobber
  // unsaved edits because the 500ms auto-save debounce may not have flushed yet.
  // This means local state is the source of truth after any mutation (generate,
  // reorder, lock, etc.) until auto-save persists it. This is safe as long as:
  //   (a) auto-save always flushes before navigation (currently guaranteed by
  //       the 500ms debounce + single-user flow), and
  //   (b) the server never mutates playlist fields the client cares about
  //       out-of-band (no multi-device editing today).
  // If either assumption breaks, revisit this — e.g., add a beforeunload guard
  // or optimistic-update reconciliation.
  useEffect(() => {
    if (!playlist) return;
    setName(playlist.name);
    setTracks(playlist.tracks);
    setLockedTrackIds(
      new Set(playlist.tracks.filter((t) => t.locked).map((t) => t.id))
    );
    setGenerationConfig({
      favoritesRatio: playlist.favoritesRatio,
      discoveryRatio: playlist.discoveryRatio,
      eraHitsRatio: playlist.eraHitsRatio,
      targetSongCount: playlist.targetSongCount,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playlist?.id]);


  const [birthYearInput, setBirthYearInput] = useState<string>(
    String(playlist?.birthYear ?? user?.birthYear ?? 1991)
  );
  const birthYear = parseInt(birthYearInput, 10) || 0;

  useEffect(() => {
    if (playlist?.birthYear) setBirthYearInput(String(playlist.birthYear));
  }, [playlist?.birthYear]);

  const stableConfig = useMemo(() => generationConfig, [
    generationConfig.favoritesRatio,
    generationConfig.discoveryRatio,
    generationConfig.eraHitsRatio,
    generationConfig.targetSongCount,
  ]);

  const { isSaving, justSaved, flushSave } = useAutoSave(playlistId, name, tracks, birthYear, stableConfig);

  const ratiosValid = areRatiosValid(generationConfig);

  // Keep the player's queue in sync with live playlist edits so prev/next
  // reflect the current track order. If the currently playing track is
  // removed, syncQueue will pause playback.
  const trackUris = useMemo(() => tracks.map((t) => t.uri), [tracks]);
  useEffect(() => {
    syncQueue(trackUris);
  }, [trackUris, syncQueue]);

  // Track latest track count and cancel/delete state via ref so the unmount
  // cleanup sees fresh values without re-subscribing the effect on every render.
  const tracksRef = useRef<PlaylistTrack[]>([]);
  const deletedRef = useRef(false);
  const pendingDeleteRef = useRef<number | null>(null);
  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  const generateMutation = useMutation({
    mutationFn: () =>
      generatePlaylist(playlistId!, {
        birthYear,
        lockedTrackIds: [...lockedTrackIds],
      }),
    onMutate: () => {
      // Prevent the unmount cleanup from deleting the playlist while a
      // server-side generate is in flight. Without this, navigating away
      // mid-generate deletes the playlist before the server inserts tracks,
      // causing a foreign-key violation when persistence completes.
      deletedRef.current = true;
    },
    onSuccess: (result) => {
      setTracks(recalculatePositions(result.tracks));
    },
  });

  // Best-effort: if the user leaves the editor while the playlist is still
  // empty, delete it so we don't leave orphaned empty records in the DB.
  // We defer the delete via setTimeout so React StrictMode's dev double-mount
  // (mount → unmount → remount) doesn't destroy the playlist: the remount
  // cancels the pending delete before it fires.
  useEffect(() => {
    if (!playlistId) return;
    if (pendingDeleteRef.current !== null) {
      clearTimeout(pendingDeleteRef.current);
      pendingDeleteRef.current = null;
    }
    return () => {
      if (deletedRef.current) return;
      if (tracksRef.current.length === 0) {
        pendingDeleteRef.current = window.setTimeout(() => {
          pendingDeleteRef.current = null;
          deletePlaylist(playlistId).catch(() => {
            // best-effort; the index filter hides empty playlists anyway
          });
        }, 100);
      }
    };
  }, [playlistId]);

  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const removePlaylist = useCallback(
    async ({
      surfaceErrors,
      removeFromSpotify = false,
    }: { surfaceErrors: boolean; removeFromSpotify?: boolean }) => {
      if (!playlistId) return;
      deletedRef.current = true;
      setDeleteError(null);
      try {
        await deletePlaylist(playlistId, { removeFromSpotify });
      } catch (err) {
        if (surfaceErrors) {
          setDeleteError(
            err instanceof Error ? err.message : 'Failed to delete playlist.'
          );
          deletedRef.current = false;
          return false;
        }
      }
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
      navigate('/playlists');
      return true;
    },
    [playlistId, navigate, queryClient]
  );

  const handleCancel = useCallback(
    () => removePlaylist({ surfaceErrors: false }),
    [removePlaylist]
  );

  const handleDelete = useCallback(() => {
    setDeleteError(null);
    setDeleteDialogOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(
    async ({ removeFromSpotify }: { removeFromSpotify: boolean }) => {
      setIsDeleting(true);
      const succeeded = await removePlaylist({
        surfaceErrors: true,
        removeFromSpotify,
      });
      setIsDeleting(false);
      if (succeeded) setDeleteDialogOpen(false);
    },
    [removePlaylist]
  );

  const [justPublished, setJustPublished] = useState(false);

  const publishMutation = useMutation({
    mutationFn: () => publishPlaylist(playlistId!),
    onSuccess: () => {
      setJustPublished(true);
      queryClient.invalidateQueries({ queryKey: ['playlist', playlistId] });
      setTimeout(() => setJustPublished(false), 10000);
    },
  });

  const handleReorder = useCallback(
    (startIndex: number, endIndex: number) => {
      setTracks((prev) => {
        const updated = [...prev];
        const [moved] = updated.splice(startIndex, 1);
        updated.splice(endIndex, 0, moved);
        return recalculatePositions(updated);
      });
    },
    []
  );

  const handleMove = useCallback(
    (trackId: string, newPosition: number) => {
      setTracks((prev) => {
        const currentIndex = prev.findIndex((t) => t.id === trackId);
        if (currentIndex === -1) return prev;
        const clampedTarget = Math.max(
          0,
          Math.min(newPosition, prev.length - 1)
        );
        if (clampedTarget === currentIndex) return prev;

        const updated = [...prev];
        const [moved] = updated.splice(currentIndex, 1);
        updated.splice(clampedTarget, 0, moved);
        return recalculatePositions(updated);
      });
    },
    []
  );

  const handleToggleLock = useCallback((trackId: string) => {
    setLockedTrackIds((prev) => {
      const next = new Set(prev);
      if (next.has(trackId)) {
        next.delete(trackId);
      } else {
        next.add(trackId);
      }
      return next;
    });

    setTracks((prev) =>
      prev.map((t) =>
        t.id === trackId ? { ...t, locked: !t.locked } : t
      )
    );
  }, []);

  const handleLockAll = useCallback(() => {
    setLockedTrackIds(new Set(tracks.map((t) => t.id)));
    setTracks((prev) => prev.map((t) => ({ ...t, locked: true })));
  }, [tracks]);

  const handleUnlockAll = useCallback(() => {
    setLockedTrackIds(new Set());
    setTracks((prev) => prev.map((t) => ({ ...t, locked: false })));
  }, []);

  const handleShuffle = useCallback(() => {
    setTracks((prev) => {
      const locked = prev.filter((t) => lockedTrackIds.has(t.id));
      const unlocked = prev.filter((t) => !lockedTrackIds.has(t.id));

      // Fisher-Yates shuffle on unlocked tracks
      for (let i = unlocked.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [unlocked[i], unlocked[j]] = [unlocked[j], unlocked[i]];
      }

      // Merge: locked stay at their positions, unlocked fill the rest
      const result: PlaylistTrack[] = new Array(prev.length);
      locked.forEach((t) => { result[t.position] = t; });

      let unlockIdx = 0;
      for (let i = 0; i < result.length; i++) {
        if (!result[i]) {
          result[i] = unlocked[unlockIdx++];
        }
      }

      return recalculatePositions(result);
    });
  }, [lockedTrackIds]);

  const handleRemove = useCallback((trackId: string) => {
    setTracks((prev) =>
      recalculatePositions(prev.filter((t) => t.id !== trackId))
    );
    setLockedTrackIds((prev) => {
      const next = new Set(prev);
      next.delete(trackId);
      return next;
    });
  }, []);

  const handleAddTrack = useCallback((track: Track) => {
    setTracks((prev) => {
      const newTrack: PlaylistTrack = {
        ...track,
        position: prev.length,
        locked: false,
        source: 'manual',
      };
      return [...prev, newTrack];
    });
  }, []);

  if (isLoading) return <LoadingSpinner />;

  const isEmpty = tracks.length === 0;

  return (
    <div className="pb-24">
      <PlaylistHeader
        name={name}
        onNameChange={setName}
        tracks={tracks}
        isSaving={isSaving}
        justSaved={justSaved}
        onPublish={() => publishMutation.mutate()}
        isPublishing={publishMutation.isPending}
        spotifyPlaylistId={playlist?.spotifyPlaylistId}
        justPublished={justPublished}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-center sm:gap-4">
        <label className="flex items-center justify-center gap-2 rounded-full border border-[#404040] px-4 py-2 text-sm text-[#b3b3b3] sm:justify-start sm:rounded-none sm:border-0 sm:px-0 sm:py-0">
          Birth Year
          <input
            type="text"
            inputMode="numeric"
            value={birthYearInput}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, '').slice(0, 4);
              setBirthYearInput(val);
            }}
            className="w-12 bg-transparent text-center text-sm text-white outline-none sm:w-20 sm:rounded-lg sm:bg-[#282828] sm:px-3 sm:py-2 sm:text-left sm:focus:ring-1 sm:focus:ring-[#1DB954]"
          />
        </label>

        <RegenerateButton
          tracks={tracks}
          lockedTrackIds={lockedTrackIds}
          isGenerating={generateMutation.isPending}
          ratiosValid={ratiosValid}
          onRegenerate={async () => {
            const overrides = configRef.current?.commitPendingValues();
            configRef.current?.collapse();
            nostalgicRef.current?.collapse();
            await flushSave(overrides);
            generateMutation.mutate();
          }}
          onLockAll={handleLockAll}
          onUnlockAll={handleUnlockAll}
          onShuffle={handleShuffle}
          onCancel={handleCancel}
          onDelete={handleDelete}
        />
      </div>

      <PlaylistConfig
        ref={configRef}
        config={generationConfig}
        onChange={setGenerationConfig}
        defaultExpanded={isEmpty}
        highlight={isEmpty}
      />

      <NostalgicArtistsEditor ref={nostalgicRef} defaultExpanded={isEmpty} />

      <SearchBar onAddTrack={handleAddTrack} />

      <PlaylistTrackList
        tracks={tracks}
        onReorder={handleReorder}
        onPlay={(uri) => playTrack(uri, tracks.map((t) => t.uri))}
        onToggleLock={handleToggleLock}
        onRemove={handleRemove}
        onMove={handleMove}
        isGenerating={generateMutation.isPending}
      />

      <ScrollFab />

      <DeletePlaylistDialog
        isOpen={deleteDialogOpen}
        playlistName={name || playlist?.name || 'this playlist'}
        isPublished={!!playlist?.spotifyPlaylistId}
        isDeleting={isDeleting}
        errorMessage={deleteError}
        onCancel={() => {
          if (isDeleting) return;
          setDeleteDialogOpen(false);
          setDeleteError(null);
        }}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
