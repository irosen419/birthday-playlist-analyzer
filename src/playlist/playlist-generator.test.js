import { calculateEraRanges, distributeEraTrackCount } from './era-calculator.js';

describe('Playlist Generator', () => {
  describe('calculateEraRanges', () => {
    it('should calculate correct era ranges for birth year 1991', () => {
      const ranges = calculateEraRanges(1991);

      expect(ranges).toEqual([
        { name: 'formative', yearRange: '2001-2003', ageRange: '10-12' },
        { name: 'highSchool', yearRange: '2005-2009', ageRange: '14-18' },
        { name: 'college', yearRange: '2009-2013', ageRange: '18-22' },
        { name: 'recent', yearRange: '2023-2025', ageRange: 'recent' },
        { name: 'current', yearRange: '2026', ageRange: 'current' },
      ]);
    });

    it('should calculate correct era ranges for birth year 1985', () => {
      const ranges = calculateEraRanges(1985);

      expect(ranges).toEqual([
        { name: 'formative', yearRange: '1995-1997', ageRange: '10-12' },
        { name: 'highSchool', yearRange: '1999-2003', ageRange: '14-18' },
        { name: 'college', yearRange: '2003-2007', ageRange: '18-22' },
        { name: 'recent', yearRange: '2023-2025', ageRange: 'recent' },
        { name: 'current', yearRange: '2026', ageRange: 'current' },
      ]);
    });
  });

  describe('distributeEraTrackCount', () => {
    it('should distribute 36 tracks across eras with formative priority', () => {
      const distribution = distributeEraTrackCount(36);

      expect(distribution.formative).toBeGreaterThanOrEqual(10);
      expect(distribution.highSchool).toBeGreaterThanOrEqual(6);
      expect(distribution.college).toBeGreaterThanOrEqual(6);
      expect(distribution.recent).toBeGreaterThanOrEqual(6);
      expect(distribution.current).toBeGreaterThanOrEqual(4);

      const total = Object.values(distribution).reduce((sum, val) => sum + val, 0);
      expect(total).toBe(36);
    });

    it('should handle smaller track counts', () => {
      const distribution = distributeEraTrackCount(15);

      const total = Object.values(distribution).reduce((sum, val) => sum + val, 0);
      expect(total).toBe(15);
      expect(distribution.formative).toBeGreaterThan(0);
    });
  });
});
