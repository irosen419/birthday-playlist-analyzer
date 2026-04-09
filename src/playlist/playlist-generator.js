import { config } from '../config.js';
import { logger } from '../utils/logger.js';

/**
 * Generates a birthday party playlist based on user's listening history.
 */
export class PlaylistGenerator {
  constructor(spotifyClient) {
    this.client = spotifyClient;
  }

  /**
   * Generates a party playlist using the 60/40 strategy:
   * - 60% from user's top tracks/artists
   * - 40% from popular/related artists
   * Note: Audio features API is restricted for new apps, so we use popularity-based selection.
   */
  async generate(analysisData) {
    const { analysis } = analysisData;
    const targetCount = config.playlist.targetSongCount;
    const userTrackCount = Math.floor(targetCount * config.playlist.userTracksRatio);
    const discoveryTrackCount = targetCount - userTrackCount;

    logger.section('Generating Party Playlist');

    // Step 1: Select tracks from user's favorites (60%)
    logger.info(`Selecting ${userTrackCount} tracks from your favorites...`);
    const userTracks = this.selectUserTracks(
      analysis.tracks.rankedTracks,
      userTrackCount
    );

    // Step 2: Get discovery tracks from related/popular artists (40%)
    logger.info(`Finding ${discoveryTrackCount} discovery tracks...`);
    const discoveryTracks = await this.getDiscoveryTracks(
      analysis.artists.rankedArtists,
      discoveryTrackCount,
      new Set(userTracks.map((t) => t.id))
    );

    // Step 3: Combine and shuffle
    const allTracks = this.combineAndShuffle(userTracks, discoveryTracks);

    logger.success(`Selected ${allTracks.length} tracks for the playlist`);

    return {
      tracks: allTracks,
      userTracks,
      discoveryTracks,
      stats: {
        totalTracks: allTracks.length,
        fromFavorites: userTracks.length,
        fromDiscovery: discoveryTracks.length,
        estimatedDuration: this.estimateDuration(allTracks),
      },
    };
  }

  /**
   * Selects tracks from user's favorites based on their ranking and popularity.
   * Note: Without audio features API, we rely on user preference weight and popularity.
   */
  selectUserTracks(rankedTracks, targetCount) {
    // Score tracks based on user preference and popularity
    const scoredTracks = rankedTracks
      .map((track) => {
        // Combine user weight with track popularity (0-100 normalized to 0-1)
        const popularityScore = (track.popularity || 50) / 100;
        const userWeight = track.totalWeight;
        return {
          ...track,
          score: userWeight * 0.7 + popularityScore * 0.3,
        };
      })
      .sort((a, b) => b.score - a.score);

    // Select top tracks, ensuring variety
    const selected = [];
    const artistCounts = new Map();
    const maxTracksPerArtist = 3;

    for (const track of scoredTracks) {
      if (selected.length >= targetCount) break;

      // Limit tracks per artist to ensure variety
      const artistId = track.artists[0]?.id;
      const currentCount = artistCounts.get(artistId) || 0;

      if (currentCount < maxTracksPerArtist) {
        selected.push(track);
        artistCounts.set(artistId, currentCount + 1);
      }
    }

    return selected;
  }

  /**
   * Gets discovery tracks from related and popular artists.
   * Note: Without audio features API, we rely on popularity as a quality signal.
   */
  async getDiscoveryTracks(rankedArtists, targetCount, excludeIds) {
    const discoveryTracks = [];
    const seenTrackIds = new Set(excludeIds);
    const seenArtistIds = new Set();

    // Get top artists for seed discovery
    const topArtists = rankedArtists.slice(0, 20);

    // Strategy 1: Get related artists' top tracks
    logger.info('Finding related artists...');
    for (const artist of topArtists.slice(0, 10)) {
      if (discoveryTracks.length >= targetCount) break;

      try {
        const related = await this.client.getRelatedArtists(artist.id);
        const relatedArtists = related.artists.slice(0, 3);

        for (const relatedArtist of relatedArtists) {
          if (seenArtistIds.has(relatedArtist.id)) continue;
          seenArtistIds.add(relatedArtist.id);

          const topTracks = await this.client.getArtistTopTracks(relatedArtist.id);
          // Filter by popularity (good proxy for party-friendly tracks)
          const eligibleTracks = topTracks.tracks
            .filter((t) => !seenTrackIds.has(t.id) && t.popularity >= 50)
            .slice(0, 2);

          for (const track of eligibleTracks) {
            discoveryTracks.push({
              ...track,
              source: 'related_artist',
              relatedTo: artist.name,
            });
            seenTrackIds.add(track.id);

            if (discoveryTracks.length >= targetCount) break;
          }

          if (discoveryTracks.length >= targetCount) break;
        }
      } catch (error) {
        logger.warn(`Error getting related artists for ${artist.name}: ${error.message}`);
      }
    }

    // Strategy 2: Use Spotify recommendations if we need more tracks
    if (discoveryTracks.length < targetCount) {
      logger.info('Getting Spotify recommendations...');
      const remaining = targetCount - discoveryTracks.length;

      try {
        const seedArtists = topArtists.slice(0, 5).map((a) => a.id);
        const recommendations = await this.client.getRecommendations({
          seedArtists,
          min_popularity: 50,
          limit: Math.min(remaining + 10, 100), // Get extra in case some are duplicates
        });

        for (const track of recommendations.tracks) {
          if (discoveryTracks.length >= targetCount) break;
          if (seenTrackIds.has(track.id)) continue;

          discoveryTracks.push({
            ...track,
            source: 'recommendation',
          });
          seenTrackIds.add(track.id);
        }
      } catch (error) {
        logger.warn(`Error getting recommendations: ${error.message}`);
      }
    }

    return discoveryTracks;
  }

  /**
   * Combines user tracks and discovery tracks with smart shuffling.
   */
  combineAndShuffle(userTracks, discoveryTracks) {
    // Interleave tracks: roughly 3 user tracks, then 2 discovery tracks
    const combined = [];
    let userIndex = 0;
    let discoveryIndex = 0;

    while (userIndex < userTracks.length || discoveryIndex < discoveryTracks.length) {
      // Add 2-3 user tracks
      const userBatch = Math.min(3, userTracks.length - userIndex);
      for (let i = 0; i < userBatch; i++) {
        if (userIndex < userTracks.length) {
          combined.push(userTracks[userIndex++]);
        }
      }

      // Add 1-2 discovery tracks
      const discoveryBatch = Math.min(2, discoveryTracks.length - discoveryIndex);
      for (let i = 0; i < discoveryBatch; i++) {
        if (discoveryIndex < discoveryTracks.length) {
          combined.push(discoveryTracks[discoveryIndex++]);
        }
      }
    }

    // Light shuffle within groups of 5 to maintain some structure
    return this.lightShuffle(combined, 5);
  }

  /**
   * Lightly shuffles tracks within groups to add variety while maintaining flow.
   */
  lightShuffle(tracks, groupSize) {
    const result = [];

    for (let i = 0; i < tracks.length; i += groupSize) {
      const group = tracks.slice(i, i + groupSize);
      // Fisher-Yates shuffle for the group
      for (let j = group.length - 1; j > 0; j--) {
        const k = Math.floor(Math.random() * (j + 1));
        [group[j], group[k]] = [group[k], group[j]];
      }
      result.push(...group);
    }

    return result;
  }

  /**
   * Estimates total playlist duration in minutes.
   */
  estimateDuration(tracks) {
    const totalMs = tracks.reduce((sum, t) => sum + (t.duration_ms || 210000), 0);
    return Math.round(totalMs / 60000);
  }

  /**
   * Creates the playlist on Spotify and adds tracks.
   */
  async createSpotifyPlaylist(playlistData, customName = null) {
    const { tracks, stats } = playlistData;

    const playlistName = customName || config.playlist.name;
    const description = `${config.playlist.description}. ${stats.fromFavorites} favorites + ${stats.fromDiscovery} discoveries. ~${stats.estimatedDuration} min.`;

    logger.info(`Creating playlist: "${playlistName}"...`);

    // Create the playlist
    const playlist = await this.client.createPlaylist(playlistName, {
      description,
      public: config.playlist.isPublic,
    });

    // Add tracks
    const trackUris = tracks.map((t) => `spotify:track:${t.id}`);
    logger.info(`Adding ${trackUris.length} tracks...`);
    await this.client.addTracksToPlaylist(playlist.id, trackUris);

    logger.success(`Playlist created successfully!`);
    logger.info(`Playlist URL: ${playlist.external_urls.spotify}`);

    return {
      playlist,
      url: playlist.external_urls.spotify,
    };
  }
}

/**
 * Formats playlist generation results for display.
 */
export function formatPlaylistReport(playlistData) {
  const { tracks, userTracks, discoveryTracks, stats } = playlistData;
  const lines = [];

  lines.push('PLAYLIST COMPOSITION');
  lines.push('─'.repeat(50));
  lines.push(`  Total tracks: ${stats.totalTracks}`);
  lines.push(`  From your favorites: ${stats.fromFavorites} (${Math.round(stats.fromFavorites / stats.totalTracks * 100)}%)`);
  lines.push(`  Discovery tracks: ${stats.fromDiscovery} (${Math.round(stats.fromDiscovery / stats.totalTracks * 100)}%)`);
  lines.push(`  Estimated duration: ${stats.estimatedDuration} minutes (~${(stats.estimatedDuration / 60).toFixed(1)} hours)`);

  lines.push('');
  lines.push('SAMPLE FROM YOUR FAVORITES');
  lines.push('─'.repeat(50));
  userTracks.slice(0, 10).forEach((t, i) => {
    const artists = t.artists.map((a) => a.name).join(', ');
    lines.push(`  ${i + 1}. "${t.name}" by ${artists}`);
  });

  lines.push('');
  lines.push('SAMPLE DISCOVERY TRACKS');
  lines.push('─'.repeat(50));
  discoveryTracks.slice(0, 10).forEach((t, i) => {
    const artists = t.artists.map((a) => a.name).join(', ');
    const source = t.relatedTo ? `(related to ${t.relatedTo})` : '(recommended)';
    lines.push(`  ${i + 1}. "${t.name}" by ${artists} ${source}`);
  });

  return lines.join('\n');
}
