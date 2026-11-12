/**
 * Tests for bucketCount(): points_per_hour is often derived from
 * hours_to_show (group_by, the bar limit), and floating point must not add a
 * bucket the graph does not have - the tooltip then dated every bar one
 * bucket too early.
 */

import { expect, describe, it } from 'vitest';
import { bucketCount } from '../others';
import Graph from '../graph';

describe('bucketCount()', () => {
  it('counts a whole number of buckets', () => {
    expect(bucketCount(24, 1)).toBe(24);
    expect(bucketCount(168, 1 / 24)).toBe(7);
  });

  it('does not round a floating point hair up to another bucket', () => {
    // the bar limit: 96 bars over 26 weeks
    expect(4368 * (96 / 4368)).toBeGreaterThan(96);
    expect(bucketCount(4368, 96 / 4368)).toBe(96);
  });

  it('still counts a part bucket', () => {
    expect(bucketCount(5, 0.5)).toBe(3);
  });

  it('is what the graph lays its buckets out by', () => {
    const graph = new Graph({
      width: 960, height: 100, margin: [0, 0], hours_to_show: 4368, points_per_hour: 96 / 4368,
    });
    expect(graph._bucketCount()).toBe(96);
  });
});
