interface SpotifyPlayerState {
  paused: boolean;
  position: number;
  duration: number;
  track_window: {
    current_track: SpotifyTrack;
    previous_tracks: SpotifyTrack[];
    next_tracks: SpotifyTrack[];
  };
}

interface SpotifyTrack {
  id: string;
  name: string;
  uri: string;
  artists: { name: string; uri: string }[];
  album: {
    name: string;
    uri: string;
    images: { url: string; height: number; width: number }[];
  };
  duration_ms: number;
}

interface SpotifyPlayerError {
  message: string;
}

interface SpotifyPlayerDevice {
  device_id: string;
}

declare namespace Spotify {
  class Player {
    constructor(options: {
      name: string;
      getOAuthToken: (cb: (token: string) => void) => void;
      volume?: number;
    });

    connect(): Promise<boolean>;
    disconnect(): void;
    togglePlay(): Promise<void>;
    pause(): Promise<void>;
    resume(): Promise<void>;
    seek(positionMs: number): Promise<void>;
    getCurrentState(): Promise<SpotifyPlayerState | null>;

    addListener(
      event: 'ready' | 'not_ready',
      callback: (device: SpotifyPlayerDevice) => void
    ): void;
    addListener(
      event: 'player_state_changed',
      callback: (state: SpotifyPlayerState | null) => void
    ): void;
    addListener(
      event:
        | 'initialization_error'
        | 'authentication_error'
        | 'account_error'
        | 'playback_error',
      callback: (error: SpotifyPlayerError) => void
    ): void;

    removeListener(event: string): void;
  }
}

interface Window {
  Spotify: typeof Spotify;
  onSpotifyWebPlaybackSDKReady: (() => void) | undefined;
}
