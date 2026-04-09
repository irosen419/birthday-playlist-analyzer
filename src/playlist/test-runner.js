#!/usr/bin/env node

/**
 * Minimal test runner for playlist generation logic
 */

import { calculateEraRanges, distributeEraTrackCount } from './era-calculator.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);

  if (actualStr !== expectedStr) {
    throw new Error(`${message}\n  Expected: ${expectedStr}\n  Actual: ${actualStr}`);
  }
}

function assertGreaterThanOrEqual(actual, expected, message) {
  if (actual < expected) {
    throw new Error(`${message}\n  Expected >= ${expected}\n  Actual: ${actual}`);
  }
}

console.log('Running Playlist Generator Tests...\n');

let passed = 0;
let failed = 0;

// Test 1: Era ranges for birth year 1991
try {
  console.log('Test 1: Calculate era ranges for birth year 1991');
  const ranges = calculateEraRanges(1991);

  assertEqual(ranges[0].yearRange, '2001-2003', 'Formative year range');
  assertEqual(ranges[1].yearRange, '2005-2009', 'High school year range');
  assertEqual(ranges[2].yearRange, '2009-2013', 'College year range');
  assertEqual(ranges[3].yearRange, '2023-2025', 'Recent year range');
  assertEqual(ranges[4].yearRange, '2026', 'Current year range');

  console.log('  ✓ PASSED\n');
  passed++;
} catch (error) {
  console.log(`  ✗ FAILED: ${error.message}\n`);
  failed++;
}

// Test 2: Era ranges for birth year 1985
try {
  console.log('Test 2: Calculate era ranges for birth year 1985');
  const ranges = calculateEraRanges(1985);

  assertEqual(ranges[0].yearRange, '1995-1997', 'Formative year range');
  assertEqual(ranges[1].yearRange, '1999-2003', 'High school year range');
  assertEqual(ranges[2].yearRange, '2003-2007', 'College year range');

  console.log('  ✓ PASSED\n');
  passed++;
} catch (error) {
  console.log(`  ✗ FAILED: ${error.message}\n`);
  failed++;
}

// Test 3: Distribution of 36 tracks
try {
  console.log('Test 3: Distribute 36 tracks across eras');
  const distribution = distributeEraTrackCount(36);

  assertGreaterThanOrEqual(distribution.formative, 10, 'Formative should have >= 10');
  assertGreaterThanOrEqual(distribution.highSchool, 5, 'High school should have >= 5');
  assertGreaterThanOrEqual(distribution.college, 5, 'College should have >= 5');
  assertGreaterThanOrEqual(distribution.recent, 5, 'Recent should have >= 5');
  assertGreaterThanOrEqual(distribution.current, 3, 'Current should have >= 3');

  const total = Object.values(distribution).reduce((sum, val) => sum + val, 0);
  assertEqual(total, 36, 'Total should equal 36');

  console.log(`  Distribution: formative=${distribution.formative}, highSchool=${distribution.highSchool}, college=${distribution.college}, recent=${distribution.recent}, current=${distribution.current}`);
  console.log('  ✓ PASSED\n');
  passed++;
} catch (error) {
  console.log(`  ✗ FAILED: ${error.message}\n`);
  failed++;
}

// Test 4: Distribution of smaller count
try {
  console.log('Test 4: Distribute 15 tracks across eras');
  const distribution = distributeEraTrackCount(15);

  const total = Object.values(distribution).reduce((sum, val) => sum + val, 0);
  assertEqual(total, 15, 'Total should equal 15');
  assertGreaterThanOrEqual(distribution.formative, 1, 'Formative should have at least 1');

  console.log(`  Distribution: formative=${distribution.formative}, highSchool=${distribution.highSchool}, college=${distribution.college}, recent=${distribution.recent}, current=${distribution.current}`);
  console.log('  ✓ PASSED\n');
  passed++;
} catch (error) {
  console.log(`  ✗ FAILED: ${error.message}\n`);
  failed++;
}

// Test 5: Distribution of 50 tracks (era hits portion for 125 total songs)
try {
  console.log('Test 5: Distribute 50 tracks across eras (125 total * 0.4 era ratio)');
  const distribution = distributeEraTrackCount(50);

  const total = Object.values(distribution).reduce((sum, val) => sum + val, 0);
  assertEqual(total, 50, 'Total should equal 50');
  assertGreaterThanOrEqual(distribution.formative, 10, 'Formative should have >= 10');
  assertGreaterThanOrEqual(distribution.highSchool, 5, 'High school should have >= 5');
  assertGreaterThanOrEqual(distribution.college, 5, 'College should have >= 5');
  assertGreaterThanOrEqual(distribution.recent, 5, 'Recent should have >= 5');
  assertGreaterThanOrEqual(distribution.current, 3, 'Current should have >= 3');

  console.log(`  Distribution: formative=${distribution.formative}, highSchool=${distribution.highSchool}, college=${distribution.college}, recent=${distribution.recent}, current=${distribution.current}`);
  console.log('  ✓ PASSED\n');
  passed++;
} catch (error) {
  console.log(`  ✗ FAILED: ${error.message}\n`);
  failed++;
}

// Test 6: 125 song count maintains 30/30/40 ratio
try {
  console.log('Test 6: 125 songs maintain 30/30/40 ratio');
  const targetCount = 125;
  const favoritesRatio = 0.3;
  const genreDiscoveryRatio = 0.3;

  const favoritesCount = Math.floor(targetCount * favoritesRatio);
  const genreDiscoveryCount = Math.floor(targetCount * genreDiscoveryRatio);
  const eraHitsCount = targetCount - favoritesCount - genreDiscoveryCount;

  assertEqual(favoritesCount, 37, 'Favorites count should be 37');
  assertEqual(genreDiscoveryCount, 37, 'Genre discovery count should be 37');
  assertEqual(eraHitsCount, 51, 'Era hits count should be 51');
  assertEqual(favoritesCount + genreDiscoveryCount + eraHitsCount, 125, 'All parts should sum to 125');

  console.log(`  Favorites: ${favoritesCount}, Genre Discovery: ${genreDiscoveryCount}, Era Hits: ${eraHitsCount}`);
  console.log('  ✓ PASSED\n');
  passed++;
} catch (error) {
  console.log(`  ✗ FAILED: ${error.message}\n`);
  failed++;
}

// Test 7: Distribution of 51 era hit tracks (from 125 total)
try {
  console.log('Test 7: Distribute 51 era hit tracks (from 125 total)');
  const distribution = distributeEraTrackCount(51);

  const total = Object.values(distribution).reduce((sum, val) => sum + val, 0);
  assertEqual(total, 51, 'Total should equal 51');
  assertGreaterThanOrEqual(distribution.formative, 10, 'Formative should have >= 10');

  console.log(`  Distribution: formative=${distribution.formative}, highSchool=${distribution.highSchool}, college=${distribution.college}, recent=${distribution.recent}, current=${distribution.current}`);
  console.log('  ✓ PASSED\n');
  passed++;
} catch (error) {
  console.log(`  ✗ FAILED: ${error.message}\n`);
  failed++;
}

console.log('─'.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
