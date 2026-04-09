import { logger } from '../utils/logger.js';

/**
 * Audio feature names with human-readable descriptions.
 */
const FEATURE_DESCRIPTIONS = {
  danceability: 'How suitable for dancing (0-1)',
  energy: 'Intensity and activity level (0-1)',
  valence: 'Musical positiveness/happiness (0-1)',
  tempo: 'Beats per minute (BPM)',
  acousticness: 'Acoustic vs electronic (0-1)',
  instrumentalness: 'Lack of vocals (0-1)',
  liveness: 'Presence of audience (0-1)',
  speechiness: 'Presence of spoken words (0-1)',
  loudness: 'Overall loudness (dB)',
};

/**
 * Analyzes audio features of tracks to understand musical preferences.
 */
export class AudioFeaturesAnalyzer {
  constructor(spotifyClient) {
    this.client = spotifyClient;
  }

  /**
   * Fetches audio features for a list of tracks.
   * Handles batching for large lists (max 100 per request).
   */
  async fetchAudioFeatures(tracks) {
    const trackIds = tracks.map((t) => t.id);
    const allFeatures = [];

    // Batch requests (max 100 per API call)
    for (let i = 0; i < trackIds.length; i += 100) {
      const batch = trackIds.slice(i, i + 100);
      logger.info(`Fetching audio features (batch ${Math.floor(i / 100) + 1})...`);
      const response = await this.client.getAudioFeatures(batch);
      allFeatures.push(...response.audio_features);
    }

    // Filter out null values (some tracks may not have audio features)
    return allFeatures.filter(Boolean);
  }

  /**
   * Calculates statistics for a numeric array.
   */
  calculateStats(values) {
    if (values.length === 0) {
      return { mean: 0, min: 0, max: 0, stdDev: 0 };
    }

    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
    const variance = squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;
    const stdDev = Math.sqrt(variance);

    return {
      mean: Math.round(mean * 1000) / 1000,
      min: Math.round(min * 1000) / 1000,
      max: Math.round(max * 1000) / 1000,
      stdDev: Math.round(stdDev * 1000) / 1000,
    };
  }

  /**
   * Analyzes audio features and returns statistics and insights.
   */
  analyzeFeatures(audioFeatures) {
    const features = [
      'danceability',
      'energy',
      'valence',
      'tempo',
      'acousticness',
      'instrumentalness',
      'liveness',
      'speechiness',
      'loudness',
    ];

    const stats = {};
    for (const feature of features) {
      const values = audioFeatures.map((af) => af[feature]).filter((v) => v !== undefined);
      stats[feature] = this.calculateStats(values);
    }

    // Derive insights
    const insights = this.deriveInsights(stats);

    // Find the most "extreme" tracks
    const extremeTracks = this.findExtremeTracks(audioFeatures);

    return {
      stats,
      insights,
      extremeTracks,
      totalTracksAnalyzed: audioFeatures.length,
    };
  }

  /**
   * Derives human-readable insights from the statistics.
   */
  deriveInsights(stats) {
    const insights = [];

    // Energy insights
    if (stats.energy.mean > 0.7) {
      insights.push('You prefer high-energy music - great for parties!');
    } else if (stats.energy.mean < 0.4) {
      insights.push('You tend toward calmer, more relaxed music.');
    } else {
      insights.push('You enjoy a balanced mix of energetic and calm tracks.');
    }

    // Danceability insights
    if (stats.danceability.mean > 0.7) {
      insights.push('Your music is highly danceable - perfect for getting people moving.');
    } else if (stats.danceability.mean > 0.5) {
      insights.push('Your tracks have moderate danceability - good for background or light dancing.');
    }

    // Valence insights
    if (stats.valence.mean > 0.6) {
      insights.push('You gravitate toward upbeat, happy-sounding music.');
    } else if (stats.valence.mean < 0.4) {
      insights.push('You prefer more melancholic or introspective music.');
    } else {
      insights.push('Your music spans a range of moods from upbeat to reflective.');
    }

    // Tempo insights
    if (stats.tempo.mean > 130) {
      insights.push(`Fast average tempo (${Math.round(stats.tempo.mean)} BPM) - upbeat and energetic.`);
    } else if (stats.tempo.mean < 100) {
      insights.push(`Slower average tempo (${Math.round(stats.tempo.mean)} BPM) - more laid back.`);
    } else {
      insights.push(`Moderate average tempo (${Math.round(stats.tempo.mean)} BPM) - versatile for various moods.`);
    }

    // Acousticness insights
    if (stats.acousticness.mean > 0.5) {
      insights.push('You lean toward acoustic/organic sounds.');
    } else if (stats.acousticness.mean < 0.2) {
      insights.push('You prefer electronic/produced sounds.');
    }

    // Variety insights (using standard deviation)
    if (stats.energy.stdDev > 0.25) {
      insights.push('You have eclectic taste - your energy levels vary widely across tracks.');
    }

    return insights;
  }

  /**
   * Finds tracks with extreme audio feature values.
   */
  findExtremeTracks(audioFeatures) {
    const extremes = {
      mostDanceable: null,
      mostEnergetic: null,
      happiest: null,
      fastest: null,
      calmest: null,
    };

    let maxDance = -1, maxEnergy = -1, maxValence = -1, maxTempo = -1, minEnergy = 2;

    for (const af of audioFeatures) {
      if (af.danceability > maxDance) {
        maxDance = af.danceability;
        extremes.mostDanceable = af;
      }
      if (af.energy > maxEnergy) {
        maxEnergy = af.energy;
        extremes.mostEnergetic = af;
      }
      if (af.valence > maxValence) {
        maxValence = af.valence;
        extremes.happiest = af;
      }
      if (af.tempo > maxTempo) {
        maxTempo = af.tempo;
        extremes.fastest = af;
      }
      if (af.energy < minEnergy) {
        minEnergy = af.energy;
        extremes.calmest = af;
      }
    }

    return extremes;
  }

  /**
   * Creates a taste profile that can be used for recommendations.
   */
  createTasteProfile(stats) {
    return {
      target_energy: stats.energy.mean,
      target_danceability: stats.danceability.mean,
      target_valence: stats.valence.mean,
      target_tempo: stats.tempo.mean,
      // Set reasonable ranges based on user's actual preferences plus some flexibility
      min_energy: Math.max(0, stats.energy.mean - stats.energy.stdDev * 1.5),
      max_energy: Math.min(1, stats.energy.mean + stats.energy.stdDev * 1.5),
      min_danceability: Math.max(0, stats.danceability.mean - stats.danceability.stdDev * 1.5),
      max_danceability: Math.min(1, stats.danceability.mean + stats.danceability.stdDev * 1.5),
    };
  }

  /**
   * Runs the full audio features analysis.
   */
  async analyze(tracks) {
    logger.section('Analyzing Audio Features');

    const audioFeatures = await this.fetchAudioFeatures(tracks);
    const analysis = this.analyzeFeatures(audioFeatures);
    const tasteProfile = this.createTasteProfile(analysis.stats);

    return {
      audioFeatures,
      analysis,
      tasteProfile,
    };
  }
}

/**
 * Formats audio feature analysis for display.
 */
export function formatAudioFeaturesReport(analysis) {
  const { stats, insights, totalTracksAnalyzed } = analysis;
  const lines = [];

  lines.push(`AUDIO FEATURES ANALYSIS (${totalTracksAnalyzed} tracks)`);
  lines.push('─'.repeat(50));

  // Format stats table
  lines.push('');
  lines.push('Feature           Mean    Min     Max     Std Dev');
  lines.push('─'.repeat(50));

  const formatRow = (name, s) => {
    const paddedName = name.padEnd(16);
    const mean = s.mean.toFixed(3).padStart(7);
    const min = s.min.toFixed(3).padStart(7);
    const max = s.max.toFixed(3).padStart(7);
    const std = s.stdDev.toFixed(3).padStart(8);
    return `${paddedName} ${mean} ${min} ${max} ${std}`;
  };

  for (const [feature, s] of Object.entries(stats)) {
    lines.push(formatRow(feature, s));
  }

  lines.push('');
  lines.push('INSIGHTS');
  lines.push('─'.repeat(50));
  insights.forEach((insight) => {
    lines.push(`  * ${insight}`);
  });

  return lines.join('\n');
}

export { FEATURE_DESCRIPTIONS };
