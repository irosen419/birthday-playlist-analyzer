import type { User } from '../types';
import apiClient from './client';

function deserializeUser(raw: Record<string, unknown>): User {
  return {
    id: raw.id as number,
    spotifyId: (raw.spotify_id || raw.spotifyId) as string,
    displayName: (raw.display_name || raw.displayName) as string,
    email: raw.email as string,
    birthYear: (raw.birth_year || raw.birthYear) as number,
    setupCompleted: (raw.setup_completed ?? raw.setupCompleted ?? false) as boolean,
  };
}

export async function getMe(): Promise<User> {
  const { data } = await apiClient.get('/api/me');
  return deserializeUser(data);
}

export async function updateMe(params: {
  birthYear?: number;
  displayName?: string;
  setupCompleted?: boolean;
}): Promise<User> {
  const { data } = await apiClient.patch('/api/me', {
    birth_year: params.birthYear,
    display_name: params.displayName,
    setup_completed: params.setupCompleted,
  });
  return deserializeUser(data);
}
