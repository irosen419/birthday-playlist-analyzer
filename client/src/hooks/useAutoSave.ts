import { useEffect, useRef, useState } from 'react';
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
  generationConfig?: GenerationConfig
) {
  const [isSaving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const isInitialRender = useRef(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }

    if (!playlistId) return;

    clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      setSaving(true);
      try {
        await updatePlaylist(playlistId, {
          name,
          tracks,
          birthYear,
          ...generationConfig,
        });
        setJustSaved(true);
        clearTimeout(savedTimerRef.current);
        savedTimerRef.current = setTimeout(
          () => setJustSaved(false),
          SAVED_INDICATOR_DURATION_MS
        );
      } catch (error) {
        console.error('Auto-save failed:', error);
      } finally {
        setSaving(false);
      }
    }, DEBOUNCE_DELAY_MS);

    return () => clearTimeout(timerRef.current);
  }, [playlistId, name, tracks, birthYear, generationConfig]);

  useEffect(() => {
    return () => clearTimeout(savedTimerRef.current);
  }, []);

  return { isSaving, justSaved };
}
