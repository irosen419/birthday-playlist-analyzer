#!/usr/bin/env node

import { createSpotifyClient } from './api/spotify-client.js';
import { TopItemsAnalyzer } from './analysis/top-items-analyzer.js';
import { PlaylistGenerator, formatPlaylistReport } from './playlist/playlist-generator.js';
import { config } from './config.js';
import { logger } from './utils/logger.js';

/**
 * Parses command line arguments.
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    name: null,
    dryRun: false,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name' && args[i + 1]) {
      options.name = args[i + 1];
      i++;
    } else if (args[i] === '--dry-run') {
      options.dryRun = true;
    } else if (args[i] === '--help') {
      console.log(`
Birthday Playlist Creator

Usage: npm run create-playlist [options]

Options:
  --name "Name"    Custom playlist name (default: "${config.playlist.name}")
  --dry-run        Preview playlist without creating it on Spotify
  --help           Show this help message

Example:
  npm run create-playlist --name "My Birthday Bash 2026"
  npm run create-playlist --dry-run
`);
      process.exit(0);
    }
  }

  return options;
}

/**
 * Main playlist creation script.
 * Note: Audio features API is restricted for new apps (Nov 2024+), so we use
 * popularity-based selection instead of energy/danceability filtering.
 */
async function main() {
  const options = parseArgs();

  try {
    logger.section('Birthday Party Playlist Generator');
    logger.info('Connecting to Spotify...');

    // Initialize Spotify client
    const client = await createSpotifyClient();

    // Get user info
    const user = await client.getCurrentUser();
    logger.success(`Connected as: ${user.display_name}`);

    // Step 1: Analyze top items
    logger.section('Step 1: Analyzing Your Music History');
    const topItemsAnalyzer = new TopItemsAnalyzer(client);
    const topItemsData = await topItemsAnalyzer.analyze();

    // Display genre summary
    console.log('');
    logger.info('Your top genres:');
    const genreCounts = new Map();
    for (const artist of topItemsData.analysis.artists.rankedArtists) {
      for (const genre of artist.genres || []) {
        genreCounts.set(genre, (genreCounts.get(genre) || 0) + artist.totalWeight);
      }
    }
    const topGenres = [...genreCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    topGenres.forEach(([genre]) => {
      console.log(`  * ${genre}`);
    });

    // Step 2: Generate playlist
    logger.section('Step 2: Generating Party Playlist');
    const generator = new PlaylistGenerator(client);
    const playlistData = await generator.generate({
      analysis: topItemsData.analysis,
    });

    // Display playlist composition
    console.log('');
    console.log(formatPlaylistReport(playlistData));

    // Step 3: Create on Spotify (unless dry run)
    if (options.dryRun) {
      console.log('');
      logger.info('DRY RUN - Playlist not created on Spotify');
      logger.info('Run without --dry-run to create the playlist');
    } else {
      logger.section('Step 3: Creating Playlist on Spotify');

      const result = await generator.createSpotifyPlaylist(
        playlistData,
        options.name
      );

      console.log('');
      logger.section('Success!');
      console.log(`  Playlist: ${result.playlist.name}`);
      console.log(`  Tracks: ${playlistData.stats.totalTracks}`);
      console.log(`  Duration: ~${playlistData.stats.estimatedDuration} minutes`);
      console.log(`  URL: ${result.url}`);
      console.log('');
      logger.info('Open Spotify and enjoy your birthday party playlist!');
    }

    return playlistData;

  } catch (error) {
    logger.error('Playlist creation failed:', error.message);

    if (error.message.includes('No access token')) {
      logger.info('Run "npm run auth" to authenticate with Spotify first.');
    }

    process.exit(1);
  }
}

main();
