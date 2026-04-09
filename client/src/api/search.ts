import type { Track } from '../types';
import apiClient from './client';

const DEFAULT_SEARCH_LIMIT = 10;

export async function searchTracks(
  query: string,
  limit: number = DEFAULT_SEARCH_LIMIT
): Promise<Track[]> {
  const { data } = await apiClient.get('/api/search', {
    params: { q: query, limit },
  });

  return data.map((raw: Record<string, unknown>) => ({
    id: raw.id as string,
    name: raw.name as string,
    artists: raw.artists as { id: string; name: string }[],
    album: raw.album as { name: string; images: { url: string }[] },
    durationMs: (raw.duration_ms || raw.durationMs) as number,
    uri: raw.uri as string,
    popularity: (raw.popularity || 0) as number,
    previewUrl: (raw.preview_url || raw.previewUrl) as string | undefined,
  }));
}
