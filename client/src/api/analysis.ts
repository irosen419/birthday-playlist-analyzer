import type { AnalysisData } from '../types';
import apiClient from './client';

export async function getAnalysis(): Promise<AnalysisData> {
  const { data } = await apiClient.get('/api/analysis');
  return data;
}
