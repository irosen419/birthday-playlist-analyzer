import { config } from '../config.js';
import { logger } from '../utils/logger.js';

/**
 * Fetches and analyzes the user's top artists and tracks across all time ranges.
 */
export class TopItemsAnalyzer {
  constructor(spotifyClient) {
    this.client = spotifyClient;
  }

  /**
   * Fetches top artists for all time ranges.
   */
  async fetchTopArtists() {
    const results = {};

    for (const timeRange of config.timeRanges) {
      logger.info(`Fetching top artists (${timeRange})...`);
      const data = await this.client.getTopArtists(timeRange, 50);
      results[timeRange] = data.items;
    }

    return results;
  }

  /**
   * Fetches top tracks for all time ranges.
   */
  async fetchTopTracks() {
    const results = {};

    for (const timeRange of config.timeRanges) {
      logger.info(`Fetching top tracks (${timeRange})...`);
      const data = await this.client.getTopTracks(timeRange, 50);
      results[timeRange] = data.items;
    }

    return results;
  }

  /**
   * Analyzes top artists to find common genres and artist patterns.
   */
  analyzeArtists(artistsByTimeRange) {
    const genreCounts = {};
    const allArtists = new Map();

    for (const [timeRange, artists] of Object.entries(artistsByTimeRange)) {
      for (let i = 0; i < artists.length; i++) {
        const artist = artists[i];
        const weight = this.calculateWeight(i, artists.length);

        // Track artist appearances across time ranges
        if (!allArtists.has(artist.id)) {
          allArtists.set(artist.id, {
            ...artist,
            timeRanges: [],
            totalWeight: 0,
          });
        }
        const tracked = allArtists.get(artist.id);
        tracked.timeRanges.push(timeRange);
        tracked.totalWeight += weight;

        // Count genres
        for (const genre of artist.genres || []) {
          genreCounts[genre] = (genreCounts[genre] || 0) + weight;
        }
      }
    }

    // Sort genres by weight
    const topGenres = Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([genre, weight]) => ({ genre, weight: Math.round(weight * 100) / 100 }));

    // Sort artists by total weight
    const rankedArtists = Array.from(allArtists.values())
      .sort((a, b) => b.totalWeight - a.totalWeight);

    // Find artists that appear in all time ranges (consistent favorites)
    const consistentFavorites = rankedArtists.filter(
      (a) => a.timeRanges.length === config.timeRanges.length
    );

    return {
      topGenres,
      rankedArtists,
      consistentFavorites,
      totalUniqueArtists: allArtists.size,
    };
  }

  /**
   * Analyzes top tracks to find patterns.
   */
  analyzeTracks(tracksByTimeRange) {
    const allTracks = new Map();
    const artistTrackCounts = {};

    for (const [timeRange, tracks] of Object.entries(tracksByTimeRange)) {
      for (let i = 0; i < tracks.length; i++) {
        const track = tracks[i];
        const weight = this.calculateWeight(i, tracks.length);

        // Track appearances
        if (!allTracks.has(track.id)) {
          allTracks.set(track.id, {
            ...track,
            timeRanges: [],
            totalWeight: 0,
          });
        }
        const tracked = allTracks.get(track.id);
        tracked.timeRanges.push(timeRange);
        tracked.totalWeight += weight;

        // Count tracks per artist
        for (const artist of track.artists) {
          artistTrackCounts[artist.id] = (artistTrackCounts[artist.id] || 0) + 1;
        }
      }
    }

    // Sort tracks by total weight
    const rankedTracks = Array.from(allTracks.values())
      .sort((a, b) => b.totalWeight - a.totalWeight);

    // Find tracks that appear in all time ranges
    const consistentFavorites = rankedTracks.filter(
      (t) => t.timeRanges.length === config.timeRanges.length
    );

    return {
      rankedTracks,
      consistentFavorites,
      totalUniqueTracks: allTracks.size,
      artistTrackCounts,
    };
  }

  /**
   * Calculates weight based on position (higher position = more weight).
   */
  calculateWeight(position, total) {
    // Position 0 gets weight 1.0, last position gets weight 0.1
    return 1 - (position / total) * 0.9;
  }

  /**
   * Runs the full analysis and returns a comprehensive report.
   */
  async analyze() {
    logger.section('Fetching Top Items');

    const [topArtists, topTracks] = await Promise.all([
      this.fetchTopArtists(),
      this.fetchTopTracks(),
    ]);

    logger.section('Analyzing Patterns');

    const artistAnalysis = this.analyzeArtists(topArtists);
    const trackAnalysis = this.analyzeTracks(topTracks);

    return {
      raw: {
        topArtists,
        topTracks,
      },
      analysis: {
        artists: artistAnalysis,
        tracks: trackAnalysis,
      },
    };
  }
}

/**
 * Formats the analysis results for display.
 */
export function formatTopItemsReport(analysis) {
  const { artists, tracks } = analysis;
  const lines = [];

  lines.push('TOP GENRES');
  lines.push('─'.repeat(40));
  artists.topGenres.slice(0, 10).forEach((g, i) => {
    lines.push(`  ${i + 1}. ${g.genre} (score: ${g.weight})`);
  });

  lines.push('');
  lines.push('CONSISTENT FAVORITE ARTISTS (appear in all time ranges)');
  lines.push('─'.repeat(40));
  artists.consistentFavorites.slice(0, 10).forEach((a, i) => {
    lines.push(`  ${i + 1}. ${a.name} (score: ${a.totalWeight.toFixed(2)})`);
  });

  lines.push('');
  lines.push('TOP RANKED ARTISTS (weighted by position)');
  lines.push('─'.repeat(40));
  artists.rankedArtists.slice(0, 15).forEach((a, i) => {
    const ranges = a.timeRanges.map((r) => r.replace('_term', '')).join(', ');
    lines.push(`  ${i + 1}. ${a.name} [${ranges}]`);
  });

  lines.push('');
  lines.push('CONSISTENT FAVORITE TRACKS');
  lines.push('─'.repeat(40));
  tracks.consistentFavorites.slice(0, 10).forEach((t, i) => {
    const artistNames = t.artists.map((a) => a.name).join(', ');
    lines.push(`  ${i + 1}. "${t.name}" by ${artistNames}`);
  });

  lines.push('');
  lines.push('TOP RANKED TRACKS');
  lines.push('─'.repeat(40));
  tracks.rankedTracks.slice(0, 15).forEach((t, i) => {
    const artistNames = t.artists.map((a) => a.name).join(', ');
    const ranges = t.timeRanges.map((r) => r.replace('_term', '')).join(', ');
    lines.push(`  ${i + 1}. "${t.name}" by ${artistNames} [${ranges}]`);
  });

  lines.push('');
  lines.push('SUMMARY');
  lines.push('─'.repeat(40));
  lines.push(`  Total unique artists: ${artists.totalUniqueArtists}`);
  lines.push(`  Total unique tracks: ${tracks.totalUniqueTracks}`);
  lines.push(`  Consistent favorite artists: ${artists.consistentFavorites.length}`);
  lines.push(`  Consistent favorite tracks: ${tracks.consistentFavorites.length}`);

  return lines.join('\n');
}
