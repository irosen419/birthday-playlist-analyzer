import { config } from '../config.js';
import { loadTokens, saveTokens } from '../utils/token-storage.js';
import { refreshAccessToken } from '../auth/oauth.js';
import { logger } from '../utils/logger.js';

const BASE_URL = 'https://api.spotify.com/v1';

/**
 * Spotify API client with automatic token refresh.
 */
class SpotifyClient {
  constructor() {
    this.tokens = null;
  }

  /**
   * Initializes the client by loading tokens from storage.
   */
  async initialize() {
    this.tokens = loadTokens();

    if (!this.tokens || !this.tokens.accessToken) {
      throw new Error(
        'No access token found. Please run "npm run auth" first to authenticate with Spotify.'
      );
    }

    // Verify the token works by fetching user profile
    try {
      await this.getCurrentUser();
      logger.success('Spotify client initialized');
    } catch (error) {
      if (error.message.includes('401')) {
        logger.info('Access token expired, refreshing...');
        await this.refreshToken();
      } else {
        throw error;
      }
    }

    return this;
  }

  /**
   * Refreshes the access token.
   */
  async refreshToken() {
    if (!this.tokens?.refreshToken) {
      throw new Error('No refresh token available. Please re-authenticate.');
    }

    const newTokens = await refreshAccessToken(this.tokens.refreshToken);
    this.tokens = {
      accessToken: newTokens.accessToken,
      refreshToken: newTokens.refreshToken,
    };
    saveTokens(newTokens);
    logger.success('Token refreshed successfully');
  }

  /**
   * Makes an authenticated request to the Spotify API.
   */
  async request(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.tokens.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (response.status === 401) {
      // Token expired, try to refresh
      await this.refreshToken();
      return this.request(endpoint, options);
    }

    if (response.status === 429) {
      // Rate limited - wait and retry
      const retryAfter = parseInt(response.headers.get('Retry-After') || '1', 10);
      logger.warn(`Rate limited. Waiting ${retryAfter} seconds...`);
      await this.sleep(retryAfter * 1000);
      return this.request(endpoint, options);
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        `Spotify API error (${response.status}): ${error.error?.message || response.statusText}`
      );
    }

    // Some endpoints return no content
    if (response.status === 204) {
      return null;
    }

    return response.json();
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ==================== User Endpoints ====================

  /**
   * Gets the current user's profile.
   */
  async getCurrentUser() {
    return this.request('/me');
  }

  // ==================== Top Items Endpoints ====================

  /**
   * Gets the user's top artists.
   * @param {string} timeRange - 'short_term', 'medium_term', or 'long_term'
   * @param {number} limit - Number of items to return (max 50)
   */
  async getTopArtists(timeRange = 'medium_term', limit = 50) {
    return this.request(`/me/top/artists?time_range=${timeRange}&limit=${limit}`);
  }

  /**
   * Gets the user's top tracks.
   * @param {string} timeRange - 'short_term', 'medium_term', or 'long_term'
   * @param {number} limit - Number of items to return (max 50)
   */
  async getTopTracks(timeRange = 'medium_term', limit = 50) {
    return this.request(`/me/top/tracks?time_range=${timeRange}&limit=${limit}`);
  }

  /**
   * Gets the user's recently played tracks.
   * @param {number} limit - Number of items to return (max 50)
   */
  async getRecentlyPlayed(limit = 50) {
    return this.request(`/me/player/recently-played?limit=${limit}`);
  }

  // ==================== Track/Audio Features Endpoints ====================

  /**
   * Gets audio features for multiple tracks.
   * @param {string[]} trackIds - Array of track IDs (max 100)
   */
  async getAudioFeatures(trackIds) {
    if (trackIds.length === 0) return { audio_features: [] };
    if (trackIds.length > 100) {
      throw new Error('Cannot fetch audio features for more than 100 tracks at once');
    }
    return this.request(`/audio-features?ids=${trackIds.join(',')}`);
  }

  /**
   * Gets detailed information for multiple tracks.
   * @param {string[]} trackIds - Array of track IDs (max 50)
   */
  async getTracks(trackIds) {
    if (trackIds.length === 0) return { tracks: [] };
    if (trackIds.length > 50) {
      throw new Error('Cannot fetch more than 50 tracks at once');
    }
    return this.request(`/tracks?ids=${trackIds.join(',')}`);
  }

  // ==================== Artist Endpoints ====================

  /**
   * Gets an artist's top tracks.
   * @param {string} artistId - The artist's Spotify ID
   * @param {string} market - An ISO 3166-1 alpha-2 country code
   */
  async getArtistTopTracks(artistId, market = 'US') {
    return this.request(`/artists/${artistId}/top-tracks?market=${market}`);
  }

  /**
   * Gets artists related to a given artist.
   * @param {string} artistId - The artist's Spotify ID
   */
  async getRelatedArtists(artistId) {
    return this.request(`/artists/${artistId}/related-artists`);
  }

  /**
   * Gets multiple artists.
   * @param {string[]} artistIds - Array of artist IDs (max 50)
   */
  async getArtists(artistIds) {
    if (artistIds.length === 0) return { artists: [] };
    if (artistIds.length > 50) {
      throw new Error('Cannot fetch more than 50 artists at once');
    }
    return this.request(`/artists?ids=${artistIds.join(',')}`);
  }

  // ==================== Recommendations Endpoints ====================

  /**
   * Gets track recommendations based on seeds.
   * @param {Object} params - Recommendation parameters
   */
  async getRecommendations(params) {
    const queryParams = new URLSearchParams();

    if (params.seedArtists?.length) {
      queryParams.set('seed_artists', params.seedArtists.slice(0, 5).join(','));
    }
    if (params.seedTracks?.length) {
      queryParams.set('seed_tracks', params.seedTracks.slice(0, 5).join(','));
    }
    if (params.seedGenres?.length) {
      queryParams.set('seed_genres', params.seedGenres.slice(0, 5).join(','));
    }

    // Add target/min/max parameters
    const audioParams = ['energy', 'danceability', 'valence', 'tempo', 'popularity'];
    for (const param of audioParams) {
      if (params[`min_${param}`] !== undefined) {
        queryParams.set(`min_${param}`, params[`min_${param}`]);
      }
      if (params[`max_${param}`] !== undefined) {
        queryParams.set(`max_${param}`, params[`max_${param}`]);
      }
      if (params[`target_${param}`] !== undefined) {
        queryParams.set(`target_${param}`, params[`target_${param}`]);
      }
    }

    queryParams.set('limit', params.limit || 20);

    return this.request(`/recommendations?${queryParams.toString()}`);
  }

  // ==================== Search Endpoints ====================

  /**
   * Searches for items on Spotify.
   * @param {string} query - Search query
   * @param {string[]} types - Types to search for (album, artist, playlist, track, etc.)
   * @param {number} limit - Number of results per type (max 50)
   */
  async search(query, types = ['track'], limit = 20) {
    const params = new URLSearchParams({
      q: query,
      type: types.join(','),
      limit,
    });
    return this.request(`/search?${params.toString()}`);
  }

  // ==================== Playlist Endpoints ====================

  /**
   * Creates a new playlist for the current user.
   * @param {string} name - Playlist name
   * @param {Object} options - Playlist options
   */
  async createPlaylist(name, options = {}) {
    const user = await this.getCurrentUser();

    return this.request(`/users/${user.id}/playlists`, {
      method: 'POST',
      body: JSON.stringify({
        name,
        description: options.description || '',
        public: options.public ?? true,
      }),
    });
  }

  /**
   * Adds tracks to a playlist.
   * @param {string} playlistId - The playlist ID
   * @param {string[]} trackUris - Array of track URIs (max 100)
   */
  async addTracksToPlaylist(playlistId, trackUris) {
    if (trackUris.length === 0) return;

    // Spotify allows max 100 tracks per request
    const chunks = [];
    for (let i = 0; i < trackUris.length; i += 100) {
      chunks.push(trackUris.slice(i, i + 100));
    }

    for (const chunk of chunks) {
      await this.request(`/playlists/${playlistId}/tracks`, {
        method: 'POST',
        body: JSON.stringify({ uris: chunk }),
      });
    }
  }

  /**
   * Updates a playlist's details.
   * @param {string} playlistId - The playlist ID
   * @param {Object} details - New playlist details
   */
  async updatePlaylist(playlistId, details) {
    return this.request(`/playlists/${playlistId}`, {
      method: 'PUT',
      body: JSON.stringify(details),
    });
  }
}

/**
 * Creates and initializes a Spotify client.
 */
export async function createSpotifyClient() {
  const client = new SpotifyClient();
  await client.initialize();
  return client;
}

export { SpotifyClient };
