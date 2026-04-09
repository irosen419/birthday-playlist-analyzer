import type { User } from '../types';
import apiClient from './client';

export async function getMe(): Promise<User> {
  const { data } = await apiClient.get('/api/me');
  return data;
}

export async function logout(): Promise<void> {
  await apiClient.delete('/auth/logout');
}
