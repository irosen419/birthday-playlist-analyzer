import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlayerTrack } from '../types';
import { getToken, play } from '../api/player';

const PLAYER_NAME = 'EraPlay';
const SDK_LOAD_TIMEOUT_MS = 10_000;

export function useSpotifyPlayer() {
  const [isReady, setReady] = useState(false);
  const [isPaused, setPaused] = useState(true);
  const [currentTrack, setCurrentTrack] = useState<PlayerTrack | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  const playerRef = useRef<Spotify.Player | null>(null);
  const positionAnchorRef = useRef<{ position: number; timestamp: number } | null>(null);
  const pausedRef = useRef(true);
  const queueRef = useRef<string[]>([]);
  const currentUriRef = useRef<string | null>(null);
  const positionRef = useRef(0);
  const nextRef = useRef<() => void>(() => {});

  const RESTART_THRESHOLD_MS = 1000;

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
          currentUriRef.current = track.uri;
          setCurrentTrack({
            id: track.id,
            name: track.name,
            artists: track.artists.map((a) => a.name).join(', '),
            album: track.album.name,
            albumArt: track.album.images[0]?.url || '',
            uri: track.uri,
          });
          // Spotify SDK signals natural end-of-track by emitting a state with
          // position: 0, paused: true, and the same track still in current_track.
          // When the ended track is the last reference we have, advance the queue.
          const endedNaturally =
            state.paused &&
            state.position === 0 &&
            !pausedRef.current &&
            positionRef.current > 0;

          setPaused(state.paused);
          pausedRef.current = state.paused;
          setDuration(state.duration);
          setPosition(state.position);
          positionRef.current = state.position;
          positionAnchorRef.current = {
            position: state.position,
            timestamp: Date.now(),
          };

          if (endedNaturally) nextRef.current();
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
    async (uri: string, queueUris?: string[]) => {
      if (!deviceId) {
        console.warn('Player not ready — no device ID');
        return;
      }
      if (queueUris && queueUris.length > 0) {
        queueRef.current = queueUris;
      }
      try {
        await play({ device_id: deviceId, uris: [uri] });
        currentUriRef.current = uri;
      } catch (err) {
        console.error('Play failed:', err);
      }
    },
    [deviceId]
  );

  const togglePlayPause = useCallback(async () => {
    await playerRef.current?.togglePlay();
  }, []);

  const seekInternal = useCallback(async (ms: number) => {
    const player = playerRef.current;
    if (!player) return;
    await player.seek(Math.max(0, ms));
    setPosition(Math.max(0, ms));
    positionAnchorRef.current = { position: Math.max(0, ms), timestamp: Date.now() };
  }, []);

  const next = useCallback(async () => {
    if (!deviceId) return;
    const queue = queueRef.current;
    const currentUri = currentUriRef.current;
    if (queue.length === 0 || !currentUri) return;
    const idx = queue.indexOf(currentUri);
    if (idx < 0 || idx >= queue.length - 1) return;
    try {
      await play({ device_id: deviceId, uris: [queue[idx + 1]] });
      currentUriRef.current = queue[idx + 1];
    } catch (err) {
      console.error('Next failed:', err);
    }
  }, [deviceId]);

  useEffect(() => {
    nextRef.current = () => {
      void next();
    };
  }, [next]);

  const seek = useCallback(async (ms: number) => {
    const clamped = Math.max(0, Math.min(ms, duration || ms));
    await seekInternal(clamped);
  }, [duration, seekInternal]);

  const syncQueue = useCallback(async (uris: string[]) => {
    queueRef.current = uris;
    const currentUri = currentUriRef.current;
    if (currentUri && !uris.includes(currentUri)) {
      try {
        await playerRef.current?.pause();
      } catch (err) {
        console.error('Pause on queue sync failed:', err);
      }
      currentUriRef.current = null;
      setCurrentTrack(null);
      setPaused(true);
      pausedRef.current = true;
    }
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      if (pausedRef.current) return;
      const anchor = positionAnchorRef.current;
      if (!anchor) return;
      const next = anchor.position + (Date.now() - anchor.timestamp);
      positionRef.current = next;
      setPosition(next);
    }, 250);
    return () => clearInterval(id);
  }, []);

  const previous = useCallback(async () => {
    if (!deviceId) return;
    if (positionRef.current > RESTART_THRESHOLD_MS) {
      await seekInternal(0);
      return;
    }
    const queue = queueRef.current;
    const currentUri = currentUriRef.current;
    if (queue.length === 0 || !currentUri) {
      await seekInternal(0);
      return;
    }
    const idx = queue.indexOf(currentUri);
    if (idx <= 0) {
      await seekInternal(0);
      return;
    }
    try {
      await play({ device_id: deviceId, uris: [queue[idx - 1]] });
      currentUriRef.current = queue[idx - 1];
    } catch (err) {
      console.error('Previous failed:', err);
    }
  }, [deviceId, seekInternal]);

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
    position,
    duration,
    seek,
    syncQueue,
  };
}
