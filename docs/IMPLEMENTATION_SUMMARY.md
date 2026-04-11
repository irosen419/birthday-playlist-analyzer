# Birthday Party Playlist Generator - Implementation Summary

## Overview
Built a diverse birthday party playlist generator that creates a 90-song (~5 hour) playlist with intelligent distribution across user favorites, genre discoveries, and era-specific hits.

## Features Implemented

### 1. Three-Part Playlist Distribution
- **30% User Favorites (~27 songs)**: Selected from user's top tracks
- **30% Genre Discoveries (~27 songs)**: User's genres + related genres, excludes top 50 artists, popularity >= 60
- **40% Era Hits (~36 songs)**: Flexible distribution across life eras based on birth year

### 2. Era-Based Hit Selection
Dynamic era calculation based on birth year (default: 1991):
- **Formative Years (ages 10-12)**: 2001-2003 for birth year 1991
  - Always includes nostalgic artists: NSYNC, Backstreet Boys, Smash Mouth, Britney Spears, Christina Aguilera
  - These artists included regardless of top 50 status
- **High School (ages 14-18)**: 2005-2009
- **College (ages 18-22)**: 2009-2013
- **Recent (2023-2025)**: Recent hits
- **Current (2026)**: Current year hits

Era distribution priority: formative (30%) > high school/college/recent (15% each) > current (10%)

### 3. Genre Discovery Logic
- Extracts genres from user's top 50 artists
- Expands to related genres (e.g., indie rock → alternative rock, indie pop)
- Uses both Spotify search by genre AND recommendation API
- Filters out user's top 50 artists for true discovery
- Enforces popularity >= 60 for party-friendly tracks

### 4. User Interface
- Birth year input field on playlist editor page (default: 1991)
- Configurable on generation, affects era calculations dynamically
- Shows playlist stats including track counts and duration

## Files Created/Modified

### Created Files
1. `/src/playlist/era-calculator.js`
   - `calculateEraRanges(birthYear)`: Calculates era ranges based on birth year
   - `distributeEraTrackCount(targetCount)`: Distributes tracks across eras with formative priority
   - `extractGenres(rankedArtists)`: Extracts unique genres from top artists
   - `expandGenres(userGenres)`: Maps genres to related genres for broader discovery

2. `/src/playlist/birthday-playlist-generator.js`
   - `BirthdayPlaylistGenerator`: Main class implementing the three-part distribution
   - `selectFavorites()`: Selects user favorites with variety (max 3 per artist)
   - `getGenreDiscoveries()`: Finds genre-based discoveries excluding top 50 artists
   - `getEraHits()`: Searches for era-specific hits with nostalgic artist priority
   - `intelligentShuffle()`: Interleaves tracks (2 fav, 2 genre, 2 era, repeat)

3. `/src/playlist/test-runner.js`
   - Minimal test runner for era calculation logic
   - 4 tests covering era ranges and track distribution

### Modified Files
1. `/src/config.js`
   - Updated `targetSongCount` from 70 to 90
   - Added `minPopularity: 60`
   - New ratios: `favoritesRatio: 0.3`, `genreDiscoveryRatio: 0.3`, `eraHitsRatio: 0.4`
   - Added `birthYear: 1991` (default)
   - Added `nostalgicArtists.formative` array

2. `/src/server/api-routes.js`
   - Imported `BirthdayPlaylistGenerator`
   - Updated `/api/generate-playlist` endpoint to accept `birthYear` in request body
   - Replaced old helper functions with new generator class
   - Removed deprecated 60/40 logic

3. `/src/public/index.html`
   - Added birth year input field to playlist editor
   - Min: 1950, Max: 2015, Default: 1991
   - Added helpful description text

4. `/src/public/js/api.js`
   - Updated `generatePlaylist()` to accept optional `birthYear` parameter
   - Sends birth year in POST request body

5. `/src/public/js/app.js`
   - Updated `PlaylistEditor.generatePlaylist()` to read birth year from input
   - Passes birth year to API call

## Technical Highlights

### Clean Code Principles Applied
1. **Single Responsibility**: Each function has one clear purpose
   - Era calculation separate from playlist generation
   - Genre extraction separate from expansion

2. **DRY (Don't Repeat Yourself)**
   - Reusable `lightShuffle()` function
   - Extracted genre mapping to configuration
   - Shared track filtering logic

3. **Composition Over Inheritance**
   - Era calculator as standalone module
   - Generator uses calculator functions
   - Clear separation of concerns

### Test-Driven Development
- RED: Created tests first (expected to fail)
- GREEN: Implemented era calculator to pass tests
- REFACTOR: Clean, maintainable code structure

### Quality Patterns
- Named constants for magic numbers (CURRENT_YEAR, minPopularity)
- Clear variable names (formativeCount, genreDiscoveries, eraHits)
- Error handling with graceful degradation
- Logging for debugging and monitoring

## Spotify API Usage

### Search Strategies
1. **Era Hits**: Uses `year:2001-2003 genre:pop` filters
2. **Genre Discovery**: Uses `genre:"indie rock"` searches
3. **Recommendations**: Seed genres/artists with min_popularity filter
4. **Nostalgic Artists**: Direct artist search + top tracks

### Popularity Filtering
- Era hits + genre discoveries: popularity >= 60
- Ensures party-friendly, recognizable tracks
- Balances discovery with familiarity

## Configuration

Default settings in `/src/config.js`:
```javascript
playlist: {
  targetSongCount: 90,
  minPopularity: 60,
  favoritesRatio: 0.3,
  genreDiscoveryRatio: 0.3,
  eraHitsRatio: 0.4,
  birthYear: 1991,
  nostalgicArtists: {
    formative: ['NSYNC', 'Backstreet Boys', 'Smash Mouth', ...]
  }
}
```

## Testing

Run tests:
```bash
node src/playlist/test-runner.js
```

All 4 tests passing:
- Era ranges for birth year 1991 ✓
- Era ranges for birth year 1985 ✓
- Distribution of 36 tracks ✓
- Distribution of 15 tracks ✓

## Next Steps (Future Enhancements)

1. Add more nostalgic artists per era (high school, college)
2. Make era distribution weights configurable in UI
3. Add genre preference weighting
4. Export playlist composition report
5. Add preview/regenerate specific sections
6. Save birth year in user preferences

## API Endpoints

### POST /api/generate-playlist
**Request:**
```json
{
  "birthYear": 1991
}
```

**Response:**
```json
{
  "tracks": [...],
  "stats": {
    "totalTracks": 90,
    "fromFavorites": 27,
    "fromGenreDiscovery": 27,
    "fromEraHits": 36,
    "estimatedDuration": 300,
    "birthYear": 1991
  }
}
```
