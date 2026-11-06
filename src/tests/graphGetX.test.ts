/**
 * Tests for Graph.getX() - where grid lines and their labels are drawn.
 *
 * Points are spaced width / (buckets - 1) apart, with the first and the last on
 * the edges. getX() must use the same scale, or a grid line drifts away from
 * the point it belongs to - by up to a whole bucket at the right edge.
 */

import { assert, describe, it } from 'vitest';
import Graph from '../graph';

const HOUR = 3600000;
const DAY = 24 * HOUR;

const dailyGraph = () => {
  const graph = new Graph({
    width: 600, height: 100, margin: [0, 0],
    hours_to_show: 720, points_per_hour: 1 / 24,
    groupBy: 'date', aggregateFuncName: 'last', smoothing: false,
  });
  const end = new Date(); end.setHours(0, 0, 0, 0); end.setDate(end.getDate() + 1);
  const rows = [];
  for (let day = 40; day >= 1; day -= 1) {
    rows.push({ last_changed: new Date(end.getTime() - day * DAY + 12 * HOUR).toISOString(), state: String(day) });
  }
  graph.update(rows);
  return graph;
};

describe('Graph.getX', () => {
  it('puts the start of each bucket on that bucket\'s point', () => {
    const graph = dailyGraph();
    const bucket = HOUR / (1 / 24);
    const start = graph._endTime - 720 * HOUR;
    graph.getPoints().forEach((point) => {
      assert.closeTo(graph.getX(start + point[3] * bucket), point[0], 1e-6, `bucket ${point[3]}`);
    });
  });

  it('puts a midnight on that day\'s point when buckets are days', () => {
    const graph = dailyGraph();
    const points = graph.getPoints();
    const last = points[points.length - 1];
    const lastMidnight = new Date(graph._endTime - DAY);
    assert.closeTo(graph.getX(lastMidnight.getTime()), last[0], 1e-6);
  });

  it('starts the window on the left edge', () => {
    const graph = dailyGraph();
    assert.closeTo(graph.getX(graph._endTime - 720 * HOUR), 0, 1e-6);
  });
});
