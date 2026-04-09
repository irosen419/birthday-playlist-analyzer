import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import {
  calculateEraRanges,
  distributeEraTrackCount,
  extractGenres,
  expandGenres,
} from './era-calculator.js';

/**
 * Birthday Playlist Generator
 * Generates a diverse party playlist with 30% favorites, 30% genre discoveries, 40% era hits
 */
export class BirthdayPlaylistGenerator {
  constructor(spotifyClient) {
    this.client = spotifyClient;
  }

  /**
   * Generates a birthday party playlist with the new distribution:
   * - 30% User favorites (from top tracks)
   * - 30% Genre discoveries (user's genres + related, exclude top 50 artists, popularity >= 60)
   * - 40% Era hits (flexible distribution across life eras)
   */
  async generate(analysisData, birthYear = config.playlist.birthYear, options = {}) {
    const { analysis } = analysisData;
    const targetCount = options.targetCount || config.playlist.targetSongCount;

    const favoritesCount = Math.floor(targetCount * config.playlist.favoritesRatio);
    const genreDiscoveryCount = Math.floor(targetCount * config.playlist.genreDiscoveryRatio);
    const eraHitsCount = targetCount - favoritesCount - genreDiscoveryCount;

    logger.section('Generating Birthday Party Playlist');
    logger.info(`Birth year: ${birthYear}`);
    logger.info(`Target: ${targetCount} tracks (${favoritesCount} favorites + ${genreDiscoveryCount} discoveries + ${eraHitsCount} era hits)`);

    const allTrackIds = new Set(options.excludeTrackIds || []);

    // Part 1: User Favorites (30%)
    logger.info(`\nSelecting ${favoritesCount} favorites from your top tracks...`);
    const favorites = this.selectFavorites(
      analysis.tracks.rankedTracks,
      favoritesCount
    );
    favorites.forEach(t => allTrackIds.add(t.id));

    // Part 2: Genre Discoveries (30%)
    logger.info(`\nFinding ${genreDiscoveryCount} genre discovery tracks...`);
    const genreDiscoveries = await this.getGenreDiscoveries(
      analysis.artists.rankedArtists,
      genreDiscoveryCount,
      allTrackIds
    );
    genreDiscoveries.forEach(t => allTrackIds.add(t.id));

    // Part 3: Era Hits (40%)
    logger.info(`\nFinding ${eraHitsCount} era hits...`);
    const eraHits = await this.getEraHits(
      birthYear,
      eraHitsCount,
      allTrackIds
    );
    eraHits.forEach(t => allTrackIds.add(t.id));

    // Combine and shuffle intelligently
    const allTracks = this.intelligentShuffle(favorites, genreDiscoveries, eraHits);

    logger.success(`\nGenerated ${allTracks.length} tracks for the playlist`);

    return {
      tracks: allTracks,
      favorites,
      genreDiscoveries,
      eraHits,
      stats: {
        totalTracks: allTracks.length,
        fromFavorites: favorites.length,
        fromGenreDiscovery: genreDiscoveries.length,
        fromEraHits: eraHits.length,
        estimatedDuration: this.estimateDuration(allTracks),
        birthYear,
      },
    };
  }

  /**
   * Selects user's favorite tracks based on their ranking.
   */
  selectFavorites(rankedTracks, targetCount) {
    const scoredTracks = rankedTracks.map(track => ({
      ...track,
      score: track.totalWeight * 0.8 + (track.popularity || 50) / 100 * 0.2,
    })).sort((a, b) => b.score - a.score);

    const selected = [];
    const artistCounts = new Map();
    const maxPerArtist = 3;

    for (const track of scoredTracks) {
      if (selected.length >= targetCount) break;

      const artistId = track.artists[0]?.id;
      const count = artistCounts.get(artistId) || 0;

      if (count < maxPerArtist) {
        selected.push({ ...track, source: 'favorite' });
        artistCounts.set(artistId, count + 1);
      }
    }

    return selected;
  }

  /**
   * Gets genre discovery tracks - user's genres + related genres,
   * excluding top 50 artists, with popularity >= 60.
   */
  async getGenreDiscoveries(rankedArtists, targetCount, excludeTrackIds) {
    const discoveries = [];
    const seenTrackIds = new Set(excludeTrackIds);
    const top50ArtistIds = new Set(rankedArtists.slice(0, 50).map(a => a.id));

    // Extract and expand user's genres
    const userGenres = extractGenres(rankedArtists, 50);
    const allGenres = expandGenres(userGenres);

    logger.info(`  User genres: ${userGenres.slice(0, 5).join(', ')}...`);

    // Strategy 1: Search by genre
    for (const genre of allGenres.slice(0, 10)) {
      if (discoveries.length >= targetCount) break;

      try {
        const searchResults = await this.client.search(
          `genre:"${genre}"`,
          ['track'],
          20
        );

        const eligibleTracks = searchResults.tracks.items
          .filter(t =>
            !seenTrackIds.has(t.id) &&
            t.popularity >= config.playlist.minPopularity &&
            !top50ArtistIds.has(t.artists[0]?.id)
          )
          .slice(0, 3);

        eligibleTracks.forEach(track => {
          if (discoveries.length < targetCount) {
            discoveries.push({ ...track, source: 'genre_discovery', discoveryGenre: genre });
            seenTrackIds.add(track.id);
          }
        });
      } catch (error) {
        logger.warn(`  Error searching genre ${genre}: ${error.message}`);
      }
    }

    // Strategy 2: Use recommendations with genre seeds
    if (discoveries.length < targetCount) {
      try {
        const seedGenres = allGenres.slice(0, 5);
        const recommendations = await this.client.getRecommendations({
          seedGenres,
          min_popularity: config.playlist.minPopularity,
          limit: Math.min(targetCount - discoveries.length + 10, 100),
        });

        const eligibleTracks = recommendations.tracks
          .filter(t =>
            !seenTrackIds.has(t.id) &&
            !top50ArtistIds.has(t.artists[0]?.id)
          );

        eligibleTracks.forEach(track => {
          if (discoveries.length < targetCount) {
            discoveries.push({ ...track, source: 'genre_recommendation' });
            seenTrackIds.add(track.id);
          }
        });
      } catch (error) {
        logger.warn(`  Error getting genre recommendations: ${error.message}`);
      }
    }

    return discoveries;
  }

  /**
   * Gets era hits distributed across formative, high school, college, recent, and current years.
   */
  async getEraHits(birthYear, targetCount, excludeTrackIds) {
    const eraRanges = calculateEraRanges(birthYear);
    const distribution = distributeEraTrackCount(targetCount);
    const eraHits = [];
    const seenTrackIds = new Set(excludeTrackIds);

    logger.info(`  Era distribution: formative=${distribution.formative}, highSchool=${distribution.highSchool}, college=${distribution.college}, recent=${distribution.recent}, current=${distribution.current}`);

    for (const era of eraRanges) {
      const eraTarget = distribution[era.name];
      if (eraTarget === 0) continue;

      logger.info(`  Finding ${eraTarget} tracks from ${era.yearRange} (${era.ageRange})...`);

      const eraTracks = await this.searchEraHits(
        era,
        eraTarget,
        seenTrackIds,
        birthYear
      );

      eraTracks.forEach(track => {
        eraHits.push(track);
        seenTrackIds.add(track.id);
      });
    }

    return eraHits;
  }

  /**
   * Searches for hits from a specific era.
   */
  async searchEraHits(era, targetCount, seenTrackIds, birthYear) {
    const tracks = [];

    // For formative years, always include nostalgic artists
    if (era.name === 'formative') {
      const nostalgicArtists = config.playlist.nostalgicArtists.formative || [];

      for (const artistName of nostalgicArtists) {
        if (tracks.length >= targetCount) break;

        try {
          const searchResults = await this.client.search(artistName, ['artist'], 5);
          const artist = searchResults.artists?.items?.[0];

          if (artist) {
            const topTracks = await this.client.getArtistTopTracks(artist.id);
            const eligibleTracks = topTracks.tracks
              .filter(t =>
                !seenTrackIds.has(t.id) &&
                t.popularity >= config.playlist.minPopularity
              )
              .slice(0, 2);

            eligibleTracks.forEach(track => {
              if (tracks.length < targetCount) {
                tracks.push({
                  ...track,
                  source: 'era_hit',
                  era: era.name,
                  nostalgic: true,
                  nostalgicArtist: artistName,
                });
              }
            });
          }
        } catch (error) {
          logger.warn(`    Error getting tracks for ${artistName}: ${error.message}`);
        }
      }
    }

    // Search by year range and genre
    if (tracks.length < targetCount) {
      const genres = ['pop', 'rock', 'hip hop', 'r&b'];

      for (const genre of genres) {
        if (tracks.length >= targetCount) break;

        try {
          const query = `year:${era.yearRange} genre:${genre}`;
          const searchResults = await this.client.search(query, ['track'], 20);

          const eligibleTracks = searchResults.tracks.items
            .filter(t =>
              !seenTrackIds.has(t.id) &&
              t.popularity >= config.playlist.minPopularity
            )
            .slice(0, Math.ceil((targetCount - tracks.length) / genres.length));

          eligibleTracks.forEach(track => {
            if (tracks.length < targetCount) {
              tracks.push({
                ...track,
                source: 'era_hit',
                era: era.name,
              });
            }
          });
        } catch (error) {
          logger.warn(`    Error searching ${era.yearRange} ${genre}: ${error.message}`);
        }
      }
    }

    return tracks;
  }

  /**
   * Intelligently shuffles the three categories to create a varied playlist.
   */
  intelligentShuffle(favorites, genreDiscoveries, eraHits) {
    const combined = [];
    let favIdx = 0, genreIdx = 0, eraIdx = 0;

    // Interleave: 2 favorites, 2 genre discoveries, 2 era hits (repeat)
    while (favIdx < favorites.length || genreIdx < genreDiscoveries.length || eraIdx < eraHits.length) {
      // Add 2 favorites
      for (let i = 0; i < 2 && favIdx < favorites.length; i++) {
        combined.push(favorites[favIdx++]);
      }

      // Add 2 genre discoveries
      for (let i = 0; i < 2 && genreIdx < genreDiscoveries.length; i++) {
        combined.push(genreDiscoveries[genreIdx++]);
      }

      // Add 2 era hits
      for (let i = 0; i < 2 && eraIdx < eraHits.length; i++) {
        combined.push(eraHits[eraIdx++]);
      }
    }

    // Light shuffle within groups of 6
    return this.lightShuffle(combined, 6);
  }

  /**
   * Lightly shuffles tracks within groups.
   */
  lightShuffle(tracks, groupSize) {
    const result = [];

    for (let i = 0; i < tracks.length; i += groupSize) {
      const group = tracks.slice(i, i + groupSize);
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
}
