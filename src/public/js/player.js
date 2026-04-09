/**
 * Spotify Web Playback SDK Integration
 * Manages the Spotify player instance and playback controls.
 */

import API from './api.js';

const PLAYER_NAME = 'Birthday Playlist Analyzer';

/**
 * Player state manager.
 */
class SpotifyPlayer {
  constructor() {
    this.player = null;
    this.deviceId = null;
    this.isPaused = true;
    this.currentTrack = null;
    this.listeners = new Set();
  }

  /**
   * Initializes the Spotify Web Playback SDK.
   */
  async initialize() {
    return new Promise((resolve, reject) => {
      // Timeout after 10 seconds
      const timeout = setTimeout(() => {
        reject(new Error('Spotify SDK failed to load. Make sure you have a Premium account.'));
      }, 10000);

      const initPlayer = async () => {
        try {
          clearTimeout(timeout);
          const token = await API.getAccessToken();

          this.player = new window.Spotify.Player({
            name: PLAYER_NAME,
            getOAuthToken: async (cb) => {
              const token = await API.getAccessToken();
              cb(token);
            },
            volume: 0.5,
          });

          this.attachEventListeners();

          const connected = await this.player.connect();
          if (!connected) {
            throw new Error('Failed to connect to Spotify player. Make sure you have a Premium account.');
          }

          resolve();
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      };

      // Check if SDK is already loaded
      if (window.Spotify) {
        initPlayer();
      } else {
        // Wait for SDK to be ready
        window.onSpotifyWebPlaybackSDKReady = initPlayer;
      }
    });
  }

  /**
   * Attaches event listeners to the player.
   */
  attachEventListeners() {
    // Ready event
    this.player.addListener('ready', ({ device_id }) => {
      console.log('Player ready with device ID:', device_id);
      this.deviceId = device_id;
      this.notifyListeners('ready', { deviceId: device_id });
    });

    // Not Ready event
    this.player.addListener('not_ready', ({ device_id }) => {
      console.log('Device has gone offline:', device_id);
      this.notifyListeners('not_ready', { deviceId: device_id });
    });

    // Player state changed
    this.player.addListener('player_state_changed', (state) => {
      if (!state) {
        this.currentTrack = null;
        this.isPaused = true;
        this.notifyListeners('state_changed', null);
        return;
      }

      const track = state.track_window.current_track;
      this.currentTrack = {
        id: track.id,
        name: track.name,
        artists: track.artists.map(a => a.name).join(', '),
        album: track.album.name,
        albumArt: track.album.images[0]?.url || '',
        uri: track.uri,
      };

      this.isPaused = state.paused;

      this.notifyListeners('state_changed', {
        track: this.currentTrack,
        paused: state.paused,
        position: state.position,
        duration: state.duration,
      });
    });

    // Errors
    this.player.addListener('initialization_error', ({ message }) => {
      console.error('Initialization error:', message);
      this.notifyListeners('error', { message });
    });

    this.player.addListener('authentication_error', ({ message }) => {
      console.error('Authentication error:', message);
      this.notifyListeners('error', { message });
    });

    this.player.addListener('account_error', ({ message }) => {
      console.error('Account error:', message);
      this.notifyListeners('error', { message });
    });

    this.player.addListener('playback_error', ({ message }) => {
      console.error('Playback error:', message);
      this.notifyListeners('error', { message });
    });
  }

  /**
   * Registers a listener for player events.
   */
  on(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notifies all listeners of an event.
   */
  notifyListeners(event, data) {
    this.listeners.forEach(listener => {
      try {
        listener(event, data);
      } catch (error) {
        console.error('Listener error:', error);
      }
    });
  }

  /**
   * Plays a track or list of tracks.
   */
  async playTracks(trackUris, offset = 0) {
    if (!this.deviceId) {
      throw new Error('Player not ready');
    }

    await API.play(this.deviceId, trackUris, null, { position: offset });
  }

  /**
   * Plays a single track by URI.
   */
  async playTrack(trackUri) {
    return this.playTracks([trackUri], 0);
  }

  /**
   * Toggles play/pause.
   */
  async togglePlayPause() {
    if (!this.player) {
      throw new Error('Player not initialized');
    }

    await this.player.togglePlay();
  }

  /**
   * Resumes playback.
   */
  async resume() {
    if (!this.deviceId) {
      throw new Error('Player not ready');
    }

    await API.play(this.deviceId);
  }

  /**
   * Pauses playback.
   */
  async pause() {
    if (!this.deviceId) {
      throw new Error('Player not ready');
    }

    await API.pause(this.deviceId);
  }

  /**
   * Skips to the next track.
   */
  async next() {
    if (!this.deviceId) {
      throw new Error('Player not ready');
    }

    await API.next(this.deviceId);
  }

  /**
   * Skips to the previous track.
   */
  async previous() {
    if (!this.deviceId) {
      throw new Error('Player not ready');
    }

    await API.previous(this.deviceId);
  }

  /**
   * Gets the current playback state.
   */
  async getCurrentState() {
    if (!this.player) {
      return null;
    }

    return await this.player.getCurrentState();
  }

  /**
   * Disconnects the player.
   */
  disconnect() {
    if (this.player) {
      this.player.disconnect();
    }
  }
}

// Export singleton instance
export const player = new SpotifyPlayer();
export default player;
