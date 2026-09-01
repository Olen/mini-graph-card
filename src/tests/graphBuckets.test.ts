/**
 * Tests for how Graph sorts history into buckets.
 *
 * Two defects lived here. A reading taken right now computed a bucket one past
 * the last, so the length trim discarded it and the newest value never reached
 * the graph. And readings from before the window were assigned rather than
 * collected, so only whichever was reduced last survived - and it wiped any
 * in-window readings that had already landed in the same bucket.
 *
 * The graph still starts where its data does when nothing precedes the window;
 * older readings are what make a left-edge start truthful.
 */

import { assert, describe, it } from 'vitest';
import Graph from '../graph';

const HOUR = 3600000;
const X = 0;
const V = 2;
const HOURS = 24;
const WIDTH = 240;

const reading = (hoursAgo: number, state: number) => ({
  state: String(state),
  last_changed: new Date(Date.now() - hoursAgo * HOUR).toISOString(),
});

const plot = (history: any[], aggregateFuncName = 'avg') => {
  const graph = new Graph({
    width: WIDTH,
    height: 100,
    margin: [0, 0],
    hours_to_show: HOURS,
    points_per_hour: 1,
    aggregateFuncName,
    smoothing: false,
  });
  graph.update(history);
  return graph.coords;
};

describe('Graph bucketing', () => {
  it('plots a reading taken right now', () => {
    const coords = plot([reading(30, 10), reading(0, 99)]);
    assert.equal(coords[coords.length - 1][V], 99);
  });

  it('does not lose the newest reading at other resolutions', () => {
    [0.5, 1, 4].forEach((pointsPerHour) => {
      const graph = new Graph({
        width: WIDTH,
        height: 100,
        margin: [0, 0],
        hours_to_show: HOURS,
        points_per_hour: pointsPerHour,
        aggregateFuncName: 'avg',
        smoothing: false,
      });
      graph.update([reading(30, 10), reading(0, 99)]);
      const values = graph.coords.map(point => point[V]);
      assert.include(values, 99, `points_per_hour: ${pointsPerHour}`);
    });
  });

  it('aggregates every reading from before the window, not just one', () => {
    // 10, 20, 30, 40 all predate the window; their average is 25
    const coords = plot([
      reading(30, 10), reading(29, 20), reading(28, 30), reading(27, 40),
      reading(1, 99),
    ]);
    assert.equal(coords[0][V], 25);
  });

  it('starts at the left edge when older readings exist', () => {
    const coords = plot([reading(30, 10), reading(1, 20)]);
    assert.equal(coords[0][X], 0);
    assert.equal(coords.length, HOURS);
  });

  it('starts where the data does when nothing precedes the window', () => {
    // sensor created two hours ago: no flat line invented to its left
    const coords = plot([reading(2, 50), reading(1, 60), reading(0, 70)]);
    assert.isAbove(coords[0][X], 0);
    assert.isBelow(coords.length, HOURS);
    assert.equal(coords[0][V], 50);
  });

  it('returns nothing when there is no history at all', () => {
    assert.deepEqual(plot([]), []);
  });
});
