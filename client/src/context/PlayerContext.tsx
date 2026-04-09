import { createContext, useContext, type ReactNode } from 'react';
import { useSpotifyPlayer } from '../hooks/useSpotifyPlayer';
import type { PlayerTrack } from '../types';

interface PlayerContextType {
  isReady: boolean;
  isPaused: boolean;
  currentTrack: PlayerTrack | null;
  deviceId: string | null;
  error: string | null;
  playTrack: (uri: string) => Promise<void>;
  togglePlayPause: () => Promise<void>;
  next: () => Promise<void>;
  previous: () => Promise<void>;
}

const PlayerContext = createContext<PlayerContextType | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const player = useSpotifyPlayer();

  return (
    <PlayerContext.Provider value={player}>{children}</PlayerContext.Provider>
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
    };
  }
  return ctx;
}
