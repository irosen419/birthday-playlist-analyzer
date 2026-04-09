#!/usr/bin/env node

/**
 * Birthday Playlist Analyzer - Main Entry Point
 *
 * This module provides a simple interactive menu for the application.
 * For most use cases, run the individual scripts directly:
 *   - npm run auth          - Authenticate with Spotify
 *   - npm run analyze       - Analyze your music history
 *   - npm run create-playlist - Generate and create the playlist
 */

import { createSpotifyClient } from './api/spotify-client.js';
import { loadTokens } from './utils/token-storage.js';
import { logger } from './utils/logger.js';
import { config } from './config.js';

async function showStatus() {
  logger.section('Birthday Playlist Analyzer');

  console.log('A tool for analyzing your Spotify listening history');
  console.log('and creating the perfect birthday party playlist.');
  console.log('');

  // Check authentication status
  const tokens = loadTokens();
  if (tokens?.accessToken) {
    try {
      const client = await createSpotifyClient();
      const user = await client.getCurrentUser();
      logger.success(`Authenticated as: ${user.display_name}`);
    } catch (error) {
      logger.warn('Token may be expired. Run "npm run auth" to re-authenticate.');
    }
  } else {
    logger.warn('Not authenticated. Run "npm run auth" first.');
  }

  console.log('');
  logger.section('Available Commands');
  console.log('  npm run auth            - Authenticate with Spotify OAuth');
  console.log('  npm run analyze         - Analyze your music history and taste');
  console.log('  npm run create-playlist - Generate and create the party playlist');
  console.log('');
  logger.section('Configuration');
  console.log(`  Target playlist size: ${config.playlist.targetSongCount} tracks`);
  console.log(`  Minimum energy: ${config.playlist.minEnergy}`);
  console.log(`  User tracks ratio: ${config.playlist.userTracksRatio * 100}%`);
  console.log(`  Discovery ratio: ${config.playlist.discoveryRatio * 100}%`);
  console.log('');
}

showStatus();
