/**
 * Tests for Graph.fillBaselineY - where a fill under the line ends.
 *
 * A baseline at or beyond the graph's min or max lands in the margin band, and
 * a fill ending there leaves a strip at the edge unfilled; it must reach the
 * edge of the graph instead.
 */

import { assert, describe, it } from 'vitest';
import Graph from '../graph';

const graphWithBaseline = (fillBaseline?: number) => {
  const graph = new Graph({
    width: 100,
    height: 100,
    margin: [0, 5],
    fill_baseline: fillBaseline,
  });
  graph.min = 0;
  graph.max = 100;
  return graph;
};

describe('Graph.fillBaselineY', () => {
  it('fills to the bottom edge without a baseline', () => {
    assert.equal(graphWithBaseline().fillBaselineY, 100);
  });

  it('ends at a baseline inside the graph', () => {
    assert.closeTo(graphWithBaseline(50).fillBaselineY, 50, 1e-9);
  });

  it('reaches the bottom edge from a baseline at or below the minimum', () => {
    assert.equal(graphWithBaseline(0).fillBaselineY, 100);
    assert.equal(graphWithBaseline(-20).fillBaselineY, 100);
  });

  it('reaches the top edge from a baseline at or above the maximum', () => {
    assert.equal(graphWithBaseline(100).fillBaselineY, 0);
    assert.equal(graphWithBaseline(150).fillBaselineY, 0);
  });
});
