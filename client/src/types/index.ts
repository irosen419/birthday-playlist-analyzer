export interface User {
  id: number;
  spotifyId: string;
  displayName: string;
  email: string;
  birthYear: number;
}

export interface Artist {
  id: string;
  name: string;
}

export interface AlbumImage {
  url: string;
}

export interface Album {
  name: string;
  images: AlbumImage[];
}

export interface Track {
  id: string;
  name: string;
  artists: Artist[];
  album: Album;
  durationMs: number;
  uri: string;
  popularity: number;
  previewUrl?: string;
}

export type TrackSource = 'favorite' | 'genre_discovery' | 'era_hit' | 'manual';

export interface PlaylistTrack extends Track {
  position: number;
  locked: boolean;
  source: TrackSource;
}

export interface Playlist {
  id: number;
  name: string;
  description?: string;
  isPublic: boolean;
  spotifyPlaylistId?: string;
  publishedAt?: string;
  birthYear?: number;
  tracks: PlaylistTrack[];
  trackCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface NostalgicArtist {
  id: number;
  name: string;
  era: 'formative' | 'high_school' | 'college';
}

export interface GenreWeight {
  genre: string;
  weight: number;
}

export interface AnalysisData {
  artists: {
    topGenres: GenreWeight[];
    rankedArtists: RankedArtist[];
    consistentFavorites: RankedArtist[];
    totalUniqueArtists: number;
  };
  tracks: {
    rankedTracks: Track[];
    consistentFavorites: Track[];
    totalUniqueTracks: number;
  };
}

export interface RankedArtist {
  id: string;
  name: string;
  genres: string[];
  images: AlbumImage[];
  score?: number;
}

export interface PlayerTrack {
  id: string;
  name: string;
  artists: string;
  album: string;
  albumArt: string;
  uri: string;
}
