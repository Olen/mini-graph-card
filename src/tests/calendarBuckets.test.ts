/**
 * Tests for group_by date & week buckets across a change to or from summer
 * time: buckets are calendar days, so a reading at local midnight - where a
 * day's statistics row starts - belongs to that day, not to the one before.
 */

import {
  expect, describe, it, vi, beforeAll, afterAll,
} from 'vitest';
import Graph from '../graph';

const zone = process.env.TZ;

beforeAll(() => {
  process.env.TZ = 'Europe/Oslo';
  vi.useFakeTimers();
  // winter time; 26 weeks back is summer time
  vi.setSystemTime(new Date('2026-11-12T12:00:00+01:00'));
});

afterAll(() => {
  vi.useRealTimers();
  process.env.TZ = zone;
});

const makeGraph = (groupBy: string, pointsPerHour: number) => {
  const graph = new Graph({
    width: 1000,
    height: 100,
    margin: [0, 0],
    hours_to_show: 4368,
    points_per_hour: pointsPerHour,
    groupBy,
  });
  graph._updateEndTime();
  return graph;
};
const at = (time: string) => ({ last_changed: time, state: '1' });

describe('calendar buckets', () => {
  it('put a summer midnight in its own day', () => {
    const graph = makeGraph('date', 1 / 24);
    // 182 days, today the newest: 20 May is 176 days back
    expect(graph._bucketOf(at('2026-05-20T00:00:00+02:00'))).toBe(181 - 176);
    expect(graph._bucketOf(at('2026-05-19T23:59:00+02:00'))).toBe(181 - 177);
  });

  it('put a winter midnight in its own day as well', () => {
    const graph = makeGraph('date', 1 / 24);
    expect(graph._bucketOf(at('2026-11-12T00:00:00+01:00'))).toBe(181);
    expect(graph._bucketOf(at('2026-11-11T23:59:00+01:00'))).toBe(180);
  });

  it('count weeks from Monday', () => {
    const graph = makeGraph('week', 1 / 168);
    // 26 weeks, this one (from Monday 9 November) the newest
    expect(graph._bucketOf(at('2026-11-09T00:00:00+01:00'))).toBe(25);
    expect(graph._bucketOf(at('2026-11-08T23:00:00+01:00'))).toBe(24);
    expect(graph._bucketOf(at('2026-05-18T00:00:00+02:00'))).toBe(0);
  });

  it('leave a reading from before the window out of the buckets', () => {
    const graph = makeGraph('date', 1 / 24);
    expect(graph._bucketOf(at('2026-05-13T12:00:00+02:00'))).toBeUndefined();
  });
});
