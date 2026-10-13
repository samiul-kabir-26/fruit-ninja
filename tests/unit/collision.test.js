import { describe, it, expect } from 'vitest';
import { checkSegmentCircleIntersection, calculateSegmentSpeed } from '../../public/game/js/engine/collision.js';

describe('Collision Detection', () => {
  it('detects direct segment-circle intersection', () => {
    // Circle at (100, 100) with radius 40
    // Segment from (0, 100) to (200, 100) passes through center
    expect(checkSegmentCircleIntersection(0, 100, 200, 100, 100, 100, 40)).toBe(true);
  });

  it('detects tangent touch intersection', () => {
    // Circle at (100, 100), radius 20
    // Segment from (0, 120) to (200, 120) touches at (100, 120)
    expect(checkSegmentCircleIntersection(0, 120, 200, 120, 100, 100, 20)).toBe(true);
  });

  it('detects miss when segment is outside radius', () => {
    expect(checkSegmentCircleIntersection(0, 150, 200, 150, 100, 100, 40)).toBe(false);
  });

  it('detects miss when segment projection is before start or after end', () => {
    // Circle at (300, 100), radius 40
    // Segment from (0, 100) to (200, 100)
    expect(checkSegmentCircleIntersection(0, 100, 200, 100, 300, 100, 40)).toBe(false);
  });

  it('handles zero-length segments (points)', () => {
    expect(checkSegmentCircleIntersection(100, 100, 100, 100, 100, 100, 10)).toBe(true);
    expect(checkSegmentCircleIntersection(200, 200, 200, 200, 100, 100, 10)).toBe(false);
  });

  it('calculates cutting speed accurately', () => {
    // 500 px over 0.5s = 1000 px/s
    const speed = calculateSegmentSpeed(0, 0, 1000, 500, 0, 1500);
    expect(speed).toBeCloseTo(1000, 1);
  });
});
