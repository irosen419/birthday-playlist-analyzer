import type { NostalgicArtist } from '../types';
import apiClient from './client';

export async function getNostalgicArtists(): Promise<NostalgicArtist[]> {
  const { data } = await apiClient.get('/api/nostalgic_artists');
  return data;
}

export async function createNostalgicArtist(params: {
  name: string;
  era: NostalgicArtist['era'];
  spotifyArtistId?: string;
}): Promise<NostalgicArtist> {
  const { data } = await apiClient.post('/api/nostalgic_artists', {
    nostalgic_artist: {
      name: params.name,
      era: params.era,
      spotify_artist_id: params.spotifyArtistId,
    },
  });
  return data;
}

export async function deleteNostalgicArtist(id: number): Promise<void> {
  await apiClient.delete(`/api/nostalgic_artists/${id}`);
}
