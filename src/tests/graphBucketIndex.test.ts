/**
 * Tests that points and bars keep the bucket they belong to.
 *
 * A graph starts where its data does, so the coords of an entity whose first
 * reading lies inside the window begin part-way along it. Their position in
 * the coords array is then not their bucket: bars and hover must use the
 * bucket itself.
 */

import { assert, describe, it } from 'vitest';
import Graph from '../graph';

const HOUR = 3600000;
const X = 0;
const BUCKET = 3;
const HOURS = 24;

const reading = (hoursAgo: number, state: number) => ({
  state: String(state),
  last_changed: new Date(Date.now() - hoursAgo * HOUR).toISOString(),
});

const graphOf = (history: any[]) => {
  const graph = new Graph({
    width: 240,
    height: 100,
    margin: [0, 0],
    hours_to_show: HOURS,
    points_per_hour: 1,
    aggregateFuncName: 'avg',
    smoothing: false,
  });
  graph.update(history);
  return graph;
};

// readings 2h, 1h & 0h ago fill the last three buckets of 24
const LATE_START = [reading(2, 50), reading(1, 60), reading(0, 70)];
const FULL_WINDOW = [reading(30, 10), ...LATE_START];

describe('Graph bucket index', () => {
  it('numbers each point with its bucket, not its position', () => {
    const points = graphOf(LATE_START).getPoints();
    assert.deepEqual(points.map(point => point[BUCKET]), [21, 22, 23]);
  });

  it('places a late-starting bar in its own bucket', () => {
    const late = graphOf(LATE_START).getBars(0);
    const full = graphOf(FULL_WINDOW).getBars(0);
    assert.equal(late.length, 3);
    late.forEach((bar) => {
      const sameBucket = full.find(other => other.index === bar.index);
      assert.equal(bar.x, sameBucket.x, `bucket ${bar.index}`);
    });
  });

  it('gives every bar its bucket index', () => {
    const bars = graphOf(LATE_START).getBars(0);
    assert.deepEqual(bars.map(bar => bar.index), [21, 22, 23]);
  });

  it("keeps a late-starting point at its bucket's x", () => {
    const late = graphOf(LATE_START).getPoints();
    const full = graphOf(FULL_WINDOW).getPoints();
    late.forEach((point) => {
      const sameBucket = full.find(other => other[BUCKET] === point[BUCKET]);
      assert.equal(point[X], sameBucket[X]);
    });
  });
});
