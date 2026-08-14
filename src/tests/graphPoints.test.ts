/**
 * Tests for Graph.getPoints() & Graph.getPath().
 *
 * Smoothing used to replace every point with the midpoint of itself and the
 * one before - position AND value - and draw a curve through those midpoints.
 * On a dense graph that is invisible; on one point per day it means every dot,
 * every hover label and a "show: state: last" header read (today + yesterday)/2.
 */

import { expect, describe, it } from 'vitest';
import Graph from '../graph';

const V = 2;

const makeGraph = (values: number[], smoothing: boolean) => {
  const graph = new Graph({
    width: 500,
    height: 100,
    margin: [0, 0],
    hours: values.length,
    points: 1,
    smoothing,
  });
  // one point per hour, oldest first, landing mid-bucket
  graph.update(values.map((state, i) => ({
    state: String(state),
    last_changed: new Date(
      Date.now() - (values.length - 1 - i) * 3600000 - 1800000,
    ).toISOString(),
  })));
  return graph;
};

describe('Graph.getPoints', () => {
  it('reports the measured values, smoothed or not', () => {
    const values = [10, 20, 15];
    [true, false].forEach((smoothing) => {
      const points = makeGraph(values, smoothing).getPoints();
      expect(points.map(point => point[V])).toEqual(values);
      // the bucket index a tooltip labels its time range from
      expect(points.map(point => point[3])).toEqual([0, 1, 2]);
    });
  });
});

describe('Graph.getPath', () => {
  it('passes through every coordinate when smoothing', () => {
    const graph = makeGraph([10, 20, 15], true);
    const path = graph.getPath();
    graph.getPoints().forEach((point) => {
      expect(path).toContain(`${point[0]},${point[1]}`);
    });
  });

  it('draws straight segments without smoothing', () => {
    const path = makeGraph([10, 20, 15], false).getPath();
    expect(path).not.toContain('C');
    expect(path.match(/L/g)).toHaveLength(2);
  });

  it('does not bulge past a value that was never measured', () => {
    // A spike: a naive Catmull-Rom dips below the flat neighbours on the way in
    const graph = makeGraph([10, 10, 40, 10, 10], true);
    const ys = graph.getPath()
      .match(/-?\d+(\.\d+)?,(-?\d+(\.\d+)?)/g)!
      .map(pair => Number(pair.split(',')[1]));
    const coordYs = graph.getPoints().map(point => point[1]);
    // Y grows downwards, so the lowest value sits at the largest Y
    expect(Math.max(...ys)).toBeLessThanOrEqual(Math.max(...coordYs));
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(Math.min(...coordYs));
  });
});
