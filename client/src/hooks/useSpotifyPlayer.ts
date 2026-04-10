import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlayerTrack } from '../types';
import { getToken, play } from '../api/player';

const PLAYER_NAME = 'Birthday Playlist Analyzer';
const SDK_LOAD_TIMEOUT_MS = 10_000;

export function useSpotifyPlayer() {
  const [isReady, setReady] = useState(false);
  const [isPaused, setPaused] = useState(true);
  const [currentTrack, setCurrentTrack] = useState<PlayerTrack | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const playerRef = useRef<Spotify.Player | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function initPlayer() {
      try {
        await getToken();

        const player = new window.Spotify.Player({
          name: PLAYER_NAME,
          getOAuthToken: async (cb) => {
            const freshToken = await getToken();
            cb(freshToken);
          },
          volume: 0.5,
        });

        playerRef.current = player;

        player.addListener('ready', ({ device_id }) => {
          if (cancelled) return;
          setDeviceId(device_id);
          setReady(true);
        });

        player.addListener('not_ready', () => {
          if (cancelled) return;
          setReady(false);
        });

        player.addListener('player_state_changed', (state) => {
          if (cancelled) return;
          if (!state) {
            setCurrentTrack(null);
            setPaused(true);
            return;
          }

          const track = state.track_window.current_track;
          setCurrentTrack({
            id: track.id,
            name: track.name,
            artists: track.artists.map((a) => a.name).join(', '),
            album: track.album.name,
            albumArt: track.album.images[0]?.url || '',
            uri: track.uri,
          });
          setPaused(state.paused);
        });

        const errorEvents = [
          'initialization_error',
          'authentication_error',
          'account_error',
          'playback_error',
        ] as const;

        for (const event of errorEvents) {
          player.addListener(event, ({ message }) => {
            if (!cancelled) setError(message);
          });
        }

        const connected = await player.connect();
        if (!connected && !cancelled) {
          setError('Failed to connect. Spotify Premium is required.');
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to initialize player'
          );
        }
      }
    }

    function waitForSdk() {
      if (window.Spotify) {
        initPlayer();
        return;
      }

      const timeout = setTimeout(() => {
        if (!cancelled) setError('Spotify SDK failed to load.');
      }, SDK_LOAD_TIMEOUT_MS);

      window.onSpotifyWebPlaybackSDKReady = () => {
        clearTimeout(timeout);
        if (!cancelled) initPlayer();
      };
    }

    waitForSdk();

    return () => {
      cancelled = true;
      playerRef.current?.disconnect();
    };
  }, []);

  const playTrack = useCallback(
    async (uri: string) => {
      if (!deviceId) {
        console.warn('Player not ready — no device ID');
        return;
      }
      try {
        await play({ device_id: deviceId, uris: [uri] });
      } catch (err) {
        console.error('Play failed:', err);
      }
    },
    [deviceId]
  );

  const togglePlayPause = useCallback(async () => {
    await playerRef.current?.togglePlay();
  }, []);

  const next = useCallback(async () => {
    if (!deviceId) return;
    const { nextTrack } = await import('../api/player');
    await nextTrack({ device_id: deviceId });
  }, [deviceId]);

  const previous = useCallback(async () => {
    if (!deviceId) return;
    const { previousTrack } = await import('../api/player');
    await previousTrack({ device_id: deviceId });
  }, [deviceId]);

  return {
    isReady,
    isPaused,
    currentTrack,
    deviceId,
    error,
    playTrack,
    togglePlayPause,
    next,
    previous,
  };
}
