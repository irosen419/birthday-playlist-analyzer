import express from 'express';
import { createSpotifyClient } from '../api/spotify-client.js';
import { TopItemsAnalyzer } from '../analysis/top-items-analyzer.js';
import { BirthdayPlaylistGenerator } from '../playlist/birthday-playlist-generator.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

let spotifyClient = null;

/**
 * Initializes the Spotify client if not already initialized.
 */
async function getClient() {
  if (!spotifyClient) {
    spotifyClient = await createSpotifyClient();
  }
  return spotifyClient;
}

/**
 * Resets the client (useful after re-authentication).
 */
export function resetClient() {
  spotifyClient = null;
}

/**
 * Middleware to ensure client is initialized.
 */
async function ensureClient(req, res, next) {
  try {
    req.spotify = await getClient();
    next();
  } catch (error) {
    logger.error('Failed to initialize Spotify client:', error.message);
    res.status(401).json({
      error: 'Not authenticated',
      message: error.message,
    });
  }
}

/**
 * GET /api/me - Get current user profile
 */
router.get('/me', ensureClient, async (req, res) => {
  try {
    const user = await req.spotify.getCurrentUser();
    res.json(user);
  } catch (error) {
    logger.error('Failed to get user:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/token - Get access token for Web Playback SDK
 */
router.get('/token', ensureClient, async (req, res) => {
  try {
    res.json({ access_token: req.spotify.tokens.accessToken });
  } catch (error) {
    logger.error('Failed to get token:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/analysis - Run full analysis and return results
 */
router.get('/analysis', ensureClient, async (req, res) => {
  try {
    logger.info('Starting music analysis...');
    const analyzer = new TopItemsAnalyzer(req.spotify);
    const data = await analyzer.analyze();

    res.json({
      artists: {
        topGenres: data.analysis.artists.topGenres,
        rankedArtists: data.analysis.artists.rankedArtists.slice(0, 50).map(simplifyArtist),
        consistentFavorites: data.analysis.artists.consistentFavorites.slice(0, 20).map(simplifyArtist),
        totalUniqueArtists: data.analysis.artists.totalUniqueArtists,
      },
      tracks: {
        rankedTracks: data.analysis.tracks.rankedTracks.slice(0, 50).map(simplifyTrack),
        consistentFavorites: data.analysis.tracks.consistentFavorites.slice(0, 20).map(simplifyTrack),
        totalUniqueTracks: data.analysis.tracks.totalUniqueTracks,
      },
    });
  } catch (error) {
    logger.error('Analysis failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/generate-playlist - Generate birthday party playlist
 * Body: {
 *   birthYear: number (optional),
 *   targetCount: number (optional - override default song count),
 *   excludeTrackIds: string[] (optional - track IDs to exclude from generation)
 * }
 */
router.post('/generate-playlist', ensureClient, async (req, res) => {
  try {
    const {
      birthYear = config.playlist.birthYear,
      targetCount,
      excludeTrackIds,
    } = req.body || {};

    logger.info(`Generating birthday party playlist (birth year: ${birthYear})...`);
    const analyzer = new TopItemsAnalyzer(req.spotify);
    const data = await analyzer.analyze();

    const generator = new BirthdayPlaylistGenerator(req.spotify);
    const result = await generator.generate(data, birthYear, {
      targetCount,
      excludeTrackIds,
    });

    res.json({
      tracks: result.tracks.map(simplifyTrack),
      stats: result.stats,
    });
  } catch (error) {
    logger.error('Playlist generation failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/search - Search Spotify catalog
 */
router.get('/search', ensureClient, async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;
    if (!q) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    const results = await req.spotify.search(q, ['track'], Math.min(limit, 50));
    res.json({
      tracks: results.tracks.items.map(simplifyTrack),
    });
  } catch (error) {
    logger.error('Search failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/playlists - Create a new playlist on Spotify
 */
router.post('/playlists', ensureClient, async (req, res) => {
  try {
    const { name, description, trackIds } = req.body;

    if (!name || !trackIds || !Array.isArray(trackIds)) {
      return res.status(400).json({ error: 'Name and trackIds array are required' });
    }

    const playlist = await req.spotify.createPlaylist(name, {
      description: description || config.playlist.description,
      public: config.playlist.isPublic,
    });

    const trackUris = trackIds.map(id => `spotify:track:${id}`);
    await req.spotify.addTracksToPlaylist(playlist.id, trackUris);

    logger.success(`Created playlist: ${name} with ${trackIds.length} tracks`);
    res.json({
      id: playlist.id,
      name: playlist.name,
      url: playlist.external_urls.spotify,
    });
  } catch (error) {
    logger.error('Playlist creation failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/playlists/:id - Update an existing playlist on Spotify
 */
router.put('/playlists/:id', ensureClient, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, trackIds } = req.body;

    if (!trackIds || !Array.isArray(trackIds)) {
      return res.status(400).json({ error: 'trackIds array is required' });
    }

    // Update playlist details if provided
    if (name || description) {
      await req.spotify.updatePlaylist(id, {
        name,
        description,
      });
    }

    // Replace all tracks in the playlist
    const trackUris = trackIds.map(trackId => `spotify:track:${trackId}`);
    await req.spotify.request(`/playlists/${id}/tracks`, {
      method: 'PUT',
      body: JSON.stringify({ uris: trackUris.slice(0, 100) }),
    });

    // If more than 100 tracks, add the rest
    if (trackUris.length > 100) {
      for (let i = 100; i < trackUris.length; i += 100) {
        await req.spotify.addTracksToPlaylist(id, trackUris.slice(i, i + 100));
      }
    }

    logger.success(`Updated playlist: ${id} with ${trackIds.length} tracks`);
    res.json({
      id,
      tracksUpdated: trackIds.length,
    });
  } catch (error) {
    logger.error('Playlist update failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/player/play - Start/resume playback
 */
router.post('/player/play', ensureClient, async (req, res) => {
  try {
    const { device_id, uris, context_uri, offset } = req.body;

    const body = {};
    if (uris) body.uris = uris;
    if (context_uri) body.context_uri = context_uri;
    if (offset !== undefined) body.offset = offset;

    const query = device_id ? `?device_id=${device_id}` : '';

    await req.spotify.request(`/me/player/play${query}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Play failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/player/pause - Pause playback
 */
router.post('/player/pause', ensureClient, async (req, res) => {
  try {
    const { device_id } = req.body;
    const query = device_id ? `?device_id=${device_id}` : '';

    await req.spotify.request(`/me/player/pause${query}`, {
      method: 'PUT',
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Pause failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/player/next - Skip to next track
 */
router.post('/player/next', ensureClient, async (req, res) => {
  try {
    const { device_id } = req.body;
    const query = device_id ? `?device_id=${device_id}` : '';

    await req.spotify.request(`/me/player/next${query}`, {
      method: 'POST',
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Next failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/player/previous - Skip to previous track
 */
router.post('/player/previous', ensureClient, async (req, res) => {
  try {
    const { device_id } = req.body;
    const query = device_id ? `?device_id=${device_id}` : '';

    await req.spotify.request(`/me/player/previous${query}`, {
      method: 'POST',
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Previous failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Helper functions

function simplifyTrack(track) {
  return {
    id: track.id,
    name: track.name,
    artists: track.artists.map(a => ({ id: a.id, name: a.name })),
    album: {
      id: track.album?.id,
      name: track.album?.name,
      images: track.album?.images || [],
    },
    duration_ms: track.duration_ms,
    uri: track.uri || `spotify:track:${track.id}`,
    preview_url: track.preview_url,
    popularity: track.popularity,
  };
}

function simplifyArtist(artist) {
  return {
    id: artist.id,
    name: artist.name,
    genres: artist.genres || [],
    images: artist.images || [],
    popularity: artist.popularity,
    totalWeight: artist.totalWeight,
    timeRanges: artist.timeRanges,
  };
}

// Helper functions removed - logic now in BirthdayPlaylistGenerator

export default router;
