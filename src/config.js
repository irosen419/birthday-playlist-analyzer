import 'dotenv/config';

export const config = {
  spotify: {
    clientId: process.env.SPOTIFY_CLIENT_ID || '8336d0c3c1284270bfd698f96e43f1ed',
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    redirectUri: process.env.SPOTIFY_REDIRECT_URI || 'http://127.0.0.1:8888/callback',
    accessToken: process.env.SPOTIFY_ACCESS_TOKEN,
    refreshToken: process.env.SPOTIFY_REFRESH_TOKEN,
  },

  scopes: [
    'user-top-read',
    'user-read-recently-played',
    'playlist-modify-public',
    'playlist-modify-private',
    'playlist-read-private',
    'user-read-private',
    'streaming',
    'user-read-playback-state',
    'user-modify-playback-state',
  ],

  server: {
    port: 8888,
  },

  playlist: {
    targetSongCount: 125, // ~7 hours at 3.3 min average
    minEnergy: 0.35,
    minPopularity: 60, // For era hits and genre discoveries

    // New distribution: 30% favorites, 30% genre discovery, 40% era hits
    favoritesRatio: 0.3,      // 30% from user's top tracks (~27 songs)
    genreDiscoveryRatio: 0.3, // 30% genre discoveries (~27 songs)
    eraHitsRatio: 0.4,        // 40% era hits (~36 songs)

    birthYear: 1991, // Default birth year (configurable per generation)

    name: 'Birthday Party Playlist - April 19th',
    description: 'A personalized party playlist generated from your listening history',
    isPublic: true,

    // Nostalgic artists to always include in formative years (ages 10-12)
    // regardless of whether they're in user's top 50
    nostalgicArtists: {
      formative: [
        'NSYNC',
        'Backstreet Boys',
        'Smash Mouth',
        'Britney Spears',
        'Christina Aguilera',
      ],
    },
  },

  timeRanges: ['short_term', 'medium_term', 'long_term'],
};
