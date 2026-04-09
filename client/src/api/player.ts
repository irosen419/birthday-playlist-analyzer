import apiClient from './client';

export async function getToken(): Promise<string> {
  const { data } = await apiClient.get('/api/token');
  return data.access_token;
}

export async function play(params: {
  device_id: string;
  uris?: string[];
  offset?: { position: number };
}): Promise<void> {
  await apiClient.post('/api/player/play', params);
}

export async function pause(params: { device_id: string }): Promise<void> {
  await apiClient.post('/api/player/pause', params);
}

export async function nextTrack(params: { device_id: string }): Promise<void> {
  await apiClient.post('/api/player/next', params);
}

export async function previousTrack(params: {
  device_id: string;
}): Promise<void> {
  await apiClient.post('/api/player/previous', params);
}
