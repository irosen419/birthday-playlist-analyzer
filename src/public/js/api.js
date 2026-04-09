/**
 * API Client for Spotify Backend
 * Provides a clean interface to interact with the backend API routes.
 */

const API_BASE = '/api';

/**
 * Base request handler with error handling.
 */
async function request(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || error.message || `Request failed with status ${response.status}`);
    }

    if (response.status === 204) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`API Error (${endpoint}):`, error);
    throw error;
  }
}

/**
 * API Client singleton.
 */
export const API = {
  /**
   * Gets the current user's profile.
   */
  async getCurrentUser() {
    return request('/me');
  },

  /**
   * Gets access token for Web Playback SDK.
   */
  async getAccessToken() {
    const data = await request('/token');
    return data.access_token;
  },

  /**
   * Gets full music analysis (top tracks, artists, genres).
   */
  async getAnalysis() {
    return request('/analysis');
  },

  /**
   * Generates birthday party playlist with optional birth year.
   * @param {number|null} birthYear - Override birth year
   * @param {Object} options - Additional generation options
   * @param {string[]} options.excludeTrackIds - Track IDs to exclude from generation
   * @param {number} options.targetCount - Override target song count
   */
  async generatePlaylist(birthYear = null, { excludeTrackIds, targetCount } = {}) {
    return request('/generate-playlist', {
      method: 'POST',
      body: JSON.stringify({ birthYear, excludeTrackIds, targetCount }),
    });
  },

  /**
   * Searches for tracks.
   */
  async searchTracks(query, limit = 20) {
    const params = new URLSearchParams({ q: query, limit });
    return request(`/search?${params}`);
  },

  /**
   * Creates a new playlist on Spotify.
   */
  async createPlaylist(name, description, trackIds) {
    return request('/playlists', {
      method: 'POST',
      body: JSON.stringify({ name, description, trackIds }),
    });
  },

  /**
   * Updates an existing playlist on Spotify.
   */
  async updatePlaylist(playlistId, name, description, trackIds) {
    return request(`/playlists/${playlistId}`, {
      method: 'PUT',
      body: JSON.stringify({ name, description, trackIds }),
    });
  },

  /**
   * Player control: Start/resume playback.
   */
  async play(deviceId, uris, contextUri, offset) {
    return request('/player/play', {
      method: 'POST',
      body: JSON.stringify({
        device_id: deviceId,
        uris,
        context_uri: contextUri,
        offset,
      }),
    });
  },

  /**
   * Player control: Pause playback.
   */
  async pause(deviceId) {
    return request('/player/pause', {
      method: 'POST',
      body: JSON.stringify({ device_id: deviceId }),
    });
  },

  /**
   * Player control: Skip to next track.
   */
  async next(deviceId) {
    return request('/player/next', {
      method: 'POST',
      body: JSON.stringify({ device_id: deviceId }),
    });
  },

  /**
   * Player control: Skip to previous track.
   */
  async previous(deviceId) {
    return request('/player/previous', {
      method: 'POST',
      body: JSON.stringify({ device_id: deviceId }),
    });
  },
};

export default API;
