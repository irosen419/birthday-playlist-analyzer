import type { Playlist, PlaylistTrack } from '../types';
import apiClient from './client';

interface TrackPayload {
  spotify_id: string;
  position: number;
  locked: boolean;
  source: string;
  name: string;
  artists: { id: string; name: string }[];
  album: { name: string; images: { url: string }[] };
  duration_ms: number;
  popularity: number;
  preview_url?: string;
  uri: string;
}

function serializeTrack(track: PlaylistTrack): TrackPayload {
  return {
    spotify_id: track.id,
    position: track.position,
    locked: track.locked,
    source: track.source,
    name: track.name,
    artists: track.artists,
    album: track.album,
    duration_ms: track.durationMs,
    popularity: track.popularity,
    preview_url: track.previewUrl,
    uri: track.uri,
  };
}

function deserializeTrack(raw: Record<string, unknown>): PlaylistTrack {
  return {
    id: (raw.spotify_id || raw.id) as string,
    name: raw.name as string,
    artists: raw.artists as { id: string; name: string }[],
    album: raw.album as { name: string; images: { url: string }[] },
    durationMs: (raw.duration_ms || raw.durationMs) as number,
    uri: raw.uri as string,
    popularity: (raw.popularity || 0) as number,
    previewUrl: (raw.preview_url || raw.previewUrl) as string | undefined,
    position: (raw.position || 0) as number,
    locked: (raw.locked || false) as boolean,
    source: (raw.source || 'manual') as PlaylistTrack['source'],
  };
}

function deserializePlaylist(raw: Record<string, unknown>): Playlist {
  const tracks = Array.isArray(raw.tracks)
    ? raw.tracks.map(deserializeTrack)
    : [];

  return {
    id: raw.id as number,
    name: raw.name as string,
    description: raw.description as string | undefined,
    isPublic: (raw.is_public || raw.isPublic || false) as boolean,
    spotifyPlaylistId: (raw.spotify_playlist_id || raw.spotifyPlaylistId) as
      | string
      | undefined,
    publishedAt: (raw.published_at || raw.publishedAt) as string | undefined,
    birthYear: (raw.birth_year || raw.birthYear) as number | undefined,
    favoritesRatio: (raw.favorites_ratio ?? raw.favoritesRatio ?? 0.3) as number,
    discoveryRatio: (raw.discovery_ratio ?? raw.discoveryRatio ?? 0.3) as number,
    eraHitsRatio: (raw.era_hits_ratio ?? raw.eraHitsRatio ?? 0.4) as number,
    targetSongCount: (raw.target_song_count ?? raw.targetSongCount ?? 125) as number,
    tracks,
    trackCount: (raw.track_count || raw.trackCount || tracks.length) as number,
    createdAt: (raw.created_at || raw.createdAt) as string,
    updatedAt: (raw.updated_at || raw.updatedAt) as string,
  };
}

export async function getPlaylists(): Promise<Playlist[]> {
  const { data } = await apiClient.get('/api/playlists');
  return data.map(deserializePlaylist);
}

export async function getPlaylist(id: number): Promise<Playlist> {
  const { data } = await apiClient.get(`/api/playlists/${id}`);
  return deserializePlaylist(data);
}

export async function createPlaylist(params: {
  name: string;
  birthYear?: number;
  favoritesRatio?: number;
  discoveryRatio?: number;
  eraHitsRatio?: number;
  targetSongCount?: number;
}): Promise<Playlist> {
  const { data } = await apiClient.post('/api/playlists', {
    playlist: {
      name: params.name,
      birth_year: params.birthYear,
      favorites_ratio: params.favoritesRatio,
      discovery_ratio: params.discoveryRatio,
      era_hits_ratio: params.eraHitsRatio,
      target_song_count: params.targetSongCount,
    },
  });
  return deserializePlaylist(data);
}

export async function updatePlaylist(
  id: number,
  params: {
    name: string;
    tracks: PlaylistTrack[];
    birthYear?: number;
    favoritesRatio?: number;
    discoveryRatio?: number;
    eraHitsRatio?: number;
    targetSongCount?: number;
  }
): Promise<Playlist> {
  const { data } = await apiClient.patch(`/api/playlists/${id}`, {
    playlist: {
      name: params.name,
      birth_year: params.birthYear,
      favorites_ratio: params.favoritesRatio,
      discovery_ratio: params.discoveryRatio,
      era_hits_ratio: params.eraHitsRatio,
      target_song_count: params.targetSongCount,
      tracks: params.tracks.map(serializeTrack),
    },
  });
  return deserializePlaylist(data);
}

export async function deletePlaylist(id: number): Promise<void> {
  await apiClient.delete(`/api/playlists/${id}`);
}

export async function generatePlaylist(
  id: number,
  params: { birthYear: number; lockedTrackIds?: string[] }
): Promise<Playlist> {
  const { data } = await apiClient.post(`/api/playlists/${id}/generate`, {
    birth_year: params.birthYear,
    locked_track_ids: params.lockedTrackIds,
  });
  return deserializePlaylist(data);
}

export async function publishPlaylist(id: number): Promise<Playlist> {
  const { data } = await apiClient.post(`/api/playlists/${id}/publish`);
  return deserializePlaylist(data);
}
