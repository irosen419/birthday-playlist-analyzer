# Birthday Playlist Analyzer

A Spotify API integration for analyzing your music history and generating the perfect birthday party playlist.

## Features

- **OAuth Authentication** - Secure Spotify OAuth 2.0 flow with PKCE
- **Music History Analysis** - Analyzes your top artists and tracks across all time ranges
- **Audio Features Analysis** - Deep dive into tempo, energy, danceability, valence, and more
- **Smart Playlist Generation** - Creates a party playlist using a 60/40 strategy:
  - 60% from your personal favorites
  - 40% discovery tracks from related/popular artists

## Prerequisites

- Node.js 18+ (for built-in fetch)
- A Spotify Developer account
- Spotify Client ID and Client Secret

## Setup

1. **Clone and install dependencies:**
   ```bash
   cd birthday-playlist-analyzer
   npm install
   ```

2. **Create your `.env` file:**
   ```bash
   cp .env.example .env
   ```

3. **Add your Spotify Client Secret:**
   - Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   - Select your application (or create one)
   - Copy your Client Secret
   - Paste it into `.env`:
     ```
     SPOTIFY_CLIENT_SECRET=your_secret_here
     ```

4. **Ensure your Redirect URI is configured:**
   - In the Spotify Dashboard, add `http://127.0.0.1:8888/callback` to your app's Redirect URIs

## Usage

### Step 1: Authenticate with Spotify

```bash
npm run auth
```

This opens a browser window for Spotify authentication. After authorizing, tokens are automatically saved to your `.env` file.

### Step 2: Analyze Your Music

```bash
npm run analyze
```

This analyzes your listening history and displays:
- Your top genres
- Consistent favorite artists and tracks
- Audio feature statistics (energy, danceability, valence, etc.)
- Insights about your music taste

### Step 3: Create Your Party Playlist

```bash
npm run create-playlist
```

Options:
- `--name "Custom Name"` - Set a custom playlist name
- `--dry-run` - Preview without creating on Spotify

Example:
```bash
npm run create-playlist --name "My 30th Birthday Bash"
```

## Configuration

Edit `src/config.js` to customize:

```javascript
playlist: {
  targetSongCount: 70,      // ~4 hours at 3.5 min average
  minEnergy: 0.35,          // Minimum energy threshold
  userTracksRatio: 0.6,     // 60% from your favorites
  discoveryRatio: 0.4,      // 40% new discoveries
  name: 'Birthday Party Playlist - April 19th',
  isPublic: true,
}
```

## Project Structure

```
birthday-playlist-analyzer/
├── src/
│   ├── auth/
│   │   ├── oauth.js           # OAuth utilities (PKCE, token exchange)
│   │   └── server.js          # Express server for OAuth callback
│   ├── api/
│   │   └── spotify-client.js  # Spotify API client wrapper
│   ├── analysis/
│   │   ├── top-items-analyzer.js     # Analyzes top artists/tracks
│   │   └── audio-features-analyzer.js # Analyzes audio characteristics
│   ├── playlist/
│   │   └── playlist-generator.js     # Generates and creates playlists
│   ├── utils/
│   │   ├── token-storage.js   # Token persistence
│   │   └── logger.js          # Colored console logging
│   ├── config.js              # Central configuration
│   ├── index.js               # Main entry point
│   ├── analyze.js             # Analysis script
│   └── create-playlist.js     # Playlist creation script
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## API Scopes Used

- `user-top-read` - Access to top artists and tracks
- `user-read-recently-played` - Access to recently played tracks
- `playlist-modify-public` - Create public playlists
- `playlist-modify-private` - Create private playlists
- `user-read-private` - Access to user profile

## Troubleshooting

**"No access token found"**
- Run `npm run auth` to authenticate first

**"Token expired"**
- The app automatically refreshes tokens, but if issues persist, run `npm run auth` again

**"Rate limited"**
- The app handles rate limiting automatically with retry logic

**Playlist is shorter than expected**
- Some tracks may be filtered out due to the minimum energy threshold
- Related artists may not have enough party-suitable tracks

## License

MIT
