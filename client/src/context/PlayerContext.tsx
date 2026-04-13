import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useSpotifyPlayer } from '../hooks/useSpotifyPlayer';
import type { PlayerTrack } from '../types';

interface PlayerContextType {
  isReady: boolean;
  isPaused: boolean;
  currentTrack: PlayerTrack | null;
  deviceId: string | null;
  error: string | null;
  playTrack: (uri: string, queueUris?: string[]) => Promise<void>;
  togglePlayPause: () => Promise<void>;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  seek: (ms: number) => Promise<void>;
}

interface PlayerProgressContextType {
  position: number;
  duration: number;
}

const PlayerContext = createContext<PlayerContextType | null>(null);
const PlayerProgressContext = createContext<PlayerProgressContextType>({
  position: 0,
  duration: 0,
});

export function PlayerProvider({ children }: { children: ReactNode }) {
  const player = useSpotifyPlayer();

  const stableValue = useMemo<PlayerContextType>(
    () => ({
      isReady: player.isReady,
      isPaused: player.isPaused,
      currentTrack: player.currentTrack,
      deviceId: player.deviceId,
      error: player.error,
      playTrack: player.playTrack,
      togglePlayPause: player.togglePlayPause,
      next: player.next,
      previous: player.previous,
      seek: player.seek,
    }),
    [
      player.isReady,
      player.isPaused,
      player.currentTrack,
      player.deviceId,
      player.error,
      player.playTrack,
      player.togglePlayPause,
      player.next,
      player.previous,
      player.seek,
    ]
  );

  const progressValue = useMemo<PlayerProgressContextType>(
    () => ({ position: player.position, duration: player.duration }),
    [player.position, player.duration]
  );

  return (
    <PlayerContext.Provider value={stableValue}>
      <PlayerProgressContext.Provider value={progressValue}>
        {children}
      </PlayerProgressContext.Provider>
    </PlayerContext.Provider>
  );
}

export function usePlayer(): PlayerContextType {
  const ctx = useContext(PlayerContext);
  if (!ctx) {
    return {
      isReady: false,
      isPaused: true,
      currentTrack: null,
      deviceId: null,
      error: null,
      playTrack: async () => {},
      togglePlayPause: async () => {},
      next: async () => {},
      previous: async () => {},
      seek: async () => {},
    };
  }
  return ctx;
}

export function usePlayerProgress(): PlayerProgressContextType {
  return useContext(PlayerProgressContext);
}
