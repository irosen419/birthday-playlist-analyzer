/**
 * Era Calculator
 * Calculates era ranges based on birth year and provides distribution logic.
 */

const CURRENT_YEAR = 2026;

/**
 * Calculates era ranges based on birth year.
 * @param {number} birthYear - The user's birth year
 * @returns {Array<Object>} Array of era definitions with year ranges
 */
export function calculateEraRanges(birthYear) {
  const formativeStart = birthYear + 10;
  const formativeEnd = birthYear + 12;

  const highSchoolStart = birthYear + 14;
  const highSchoolEnd = birthYear + 18;

  const collegeStart = birthYear + 18;
  const collegeEnd = birthYear + 22;

  return [
    {
      name: 'formative',
      yearRange: `${formativeStart}-${formativeEnd}`,
      ageRange: '10-12',
      years: [formativeStart, formativeEnd],
    },
    {
      name: 'highSchool',
      yearRange: `${highSchoolStart}-${highSchoolEnd}`,
      ageRange: '14-18',
      years: [highSchoolStart, highSchoolEnd],
    },
    {
      name: 'college',
      yearRange: `${collegeStart}-${collegeEnd}`,
      ageRange: '18-22',
      years: [collegeStart, collegeEnd],
    },
    {
      name: 'recent',
      yearRange: '2023-2025',
      ageRange: 'recent',
      years: [2023, 2025],
    },
    {
      name: 'current',
      yearRange: `${CURRENT_YEAR}`,
      ageRange: 'current',
      years: [CURRENT_YEAR, CURRENT_YEAR],
    },
  ];
}

/**
 * Distributes target track count across eras with formative priority.
 * @param {number} targetCount - Total number of era tracks to distribute
 * @returns {Object} Track count per era
 */
export function distributeEraTrackCount(targetCount) {
  // Priority: formative > highSchool = college = recent > current
  // Minimum allocation: formative (30%), others (15%), current (10%)

  const formativeCount = Math.floor(targetCount * 0.30);
  const currentCount = Math.max(Math.floor(targetCount * 0.10), 3);

  const remaining = targetCount - formativeCount - currentCount;
  const perMiddleEra = Math.floor(remaining / 3);

  // Distribute remainder to formative (priority)
  const remainder = remaining - (perMiddleEra * 3);

  return {
    formative: formativeCount + remainder,
    highSchool: perMiddleEra,
    college: perMiddleEra,
    recent: perMiddleEra,
    current: currentCount,
  };
}

/**
 * Extracts unique genres from top artists.
 * @param {Array} rankedArtists - User's ranked artists
 * @param {number} limit - Number of top artists to consider
 * @returns {Array<string>} Unique genres
 */
export function extractGenres(rankedArtists, limit = 50) {
  const genreSet = new Set();

  rankedArtists.slice(0, limit).forEach(artist => {
    if (artist.genres && Array.isArray(artist.genres)) {
      artist.genres.forEach(genre => genreSet.add(genre));
    }
  });

  return Array.from(genreSet);
}

/**
 * Maps user genres to related genres for broader discovery.
 * @param {Array<string>} userGenres - User's primary genres
 * @returns {Array<string>} User genres + related genres
 */
export function expandGenres(userGenres) {
  const genreMap = {
    'indie rock': ['alternative rock', 'indie pop', 'modern rock'],
    'indie pop': ['indie rock', 'alternative pop', 'dream pop'],
    'alternative rock': ['indie rock', 'modern rock', 'rock'],
    'pop': ['dance pop', 'electropop', 'alternative pop'],
    'hip hop': ['rap', 'trap', 'underground hip hop'],
    'electronic': ['electro', 'edm', 'house'],
    'r&b': ['neo soul', 'alternative r&b', 'soul'],
  };

  const expanded = new Set(userGenres);

  userGenres.forEach(genre => {
    const related = genreMap[genre.toLowerCase()];
    if (related) {
      related.forEach(g => expanded.add(g));
    }
  });

  return Array.from(expanded);
}
