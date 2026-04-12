import type { GenerationConfig } from '../hooks/useAutoSave';

const TARGET_RATIO_SUM = 100;

export function areRatiosValid(config: GenerationConfig): boolean {
  const sum =
    Math.round(config.favoritesRatio * 100) +
    Math.round(config.discoveryRatio * 100) +
    Math.round(config.eraHitsRatio * 100);
  return sum === TARGET_RATIO_SUM;
}
