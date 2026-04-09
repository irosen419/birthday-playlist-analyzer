#!/usr/bin/env node

import { createSpotifyClient } from './api/spotify-client.js';
import { TopItemsAnalyzer, formatTopItemsReport } from './analysis/top-items-analyzer.js';
import { logger } from './utils/logger.js';

/**
 * Main analysis script - analyzes user's listening history and music taste.
 * Note: Audio features API is restricted for new apps (Nov 2024+), so we focus on top items analysis.
 */
async function main() {
  try {
    logger.section('Birthday Playlist Analyzer');
    logger.info('Connecting to Spotify...');

    // Initialize Spotify client
    const client = await createSpotifyClient();

    // Get user info
    const user = await client.getCurrentUser();
    logger.success(`Connected as: ${user.display_name} (${user.email || user.id})`);

    // Analyze top items
    const topItemsAnalyzer = new TopItemsAnalyzer(client);
    const topItemsData = await topItemsAnalyzer.analyze();

    // Display reports
    logger.section('Your Music Profile');
    console.log(formatTopItemsReport(topItemsData.analysis));

    // Show genre breakdown from top artists
    console.log('');
    logger.section('Genre Breakdown');
    const genreCounts = new Map();
    for (const artist of topItemsData.analysis.artists.rankedArtists) {
      for (const genre of artist.genres || []) {
        genreCounts.set(genre, (genreCounts.get(genre) || 0) + artist.totalWeight);
      }
    }
    const topGenres = [...genreCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);

    if (topGenres.length > 0) {
      topGenres.forEach(([genre, weight], i) => {
        console.log(`  ${i + 1}. ${genre}`);
      });
    } else {
      console.log('  No genre data available');
    }

    console.log('');
    logger.success('Analysis complete!');
    logger.info('Run "npm run create-playlist" to generate your birthday party playlist.');

    // Return data for programmatic use
    return {
      user,
      topItems: topItemsData,
    };

  } catch (error) {
    logger.error('Analysis failed:', error.message);

    if (error.message.includes('No access token')) {
      logger.info('Run "npm run auth" to authenticate with Spotify first.');
    }

    process.exit(1);
  }
}

main();
