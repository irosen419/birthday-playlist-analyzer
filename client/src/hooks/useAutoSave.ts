import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlaylistTrack } from '../types';
import { updatePlaylist } from '../api/playlists';

const DEBOUNCE_DELAY_MS = 500;
const SAVED_INDICATOR_DURATION_MS = 2000;

export interface GenerationConfig {
  favoritesRatio: number;
  discoveryRatio: number;
  eraHitsRatio: number;
  targetSongCount: number;
}

export function useAutoSave(
  playlistId: number | undefined,
  name: string,
  tracks: PlaylistTrack[],
  birthYear?: number,
  generationConfig?: GenerationConfig,
  excludedTrackIds?: string[]
) {
  const [isSaving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const isInitialRender = useRef(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const saveFnRef = useRef<((overrides?: Partial<GenerationConfig>) => Promise<void>) | null>(null);
  const inflightRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }

    if (!playlistId) return;

    clearTimeout(timerRef.current);

    const doSave = async (overrides?: Partial<GenerationConfig>) => {
      saveFnRef.current = null;
      setSaving(true);
      try {
        const mergedConfig = overrides
          ? { ...generationConfig, ...overrides }
          : generationConfig;
        const savePromise = updatePlaylist(playlistId, {
          name,
          tracks,
          birthYear,
          ...mergedConfig,
          excludedTrackIds,
        });
        inflightRef.current = savePromise.then(() => {}).catch(() => {});
        await savePromise;
        setJustSaved(true);
        clearTimeout(savedTimerRef.current);
        savedTimerRef.current = setTimeout(
          () => setJustSaved(false),
          SAVED_INDICATOR_DURATION_MS
        );
      } catch (error) {
        console.error('Auto-save failed:', error);
      } finally {
        inflightRef.current = null;
        setSaving(false);
      }
    };

    saveFnRef.current = doSave;

    timerRef.current = setTimeout(doSave, DEBOUNCE_DELAY_MS);

    return () => clearTimeout(timerRef.current);
  }, [playlistId, name, tracks, birthYear, generationConfig, excludedTrackIds]);

  const flushSave = useCallback(async (overrides?: Partial<GenerationConfig>) => {
    clearTimeout(timerRef.current);
    const pending = saveFnRef.current;
    if (pending) {
      await pending(overrides);
    } else if (inflightRef.current) {
      await inflightRef.current;
    }
  }, []);

  useEffect(() => {
    return () => clearTimeout(savedTimerRef.current);
  }, []);

  return { isSaving, justSaved, flushSave };
}
