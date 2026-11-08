/**
 * Tests for Graph.baselineY - where a fill under the line ends & bars grow
 * from - and for bars on either side of it.
 *
 * A baseline at or beyond the graph's min or max lands in the margin band, and
 * a fill ending there leaves a strip at the edge unfilled; it must reach the
 * edge of the graph instead.
 */

import { assert, describe, it } from 'vitest';
import Graph from '../graph';

const graphWithBaseline = (baseline?: number) => {
  const graph = new Graph({
    width: 100,
    height: 100,
    margin: [0, 5],
    baseline,
  });
  graph.min = 0;
  graph.max = 100;
  return graph;
};

describe('Graph.baselineY', () => {
  it('fills to the bottom edge without a baseline', () => {
    assert.equal(graphWithBaseline().baselineY, 100);
  });

  it('ends at a baseline inside the graph', () => {
    assert.closeTo(graphWithBaseline(50).baselineY, 50, 1e-9);
  });

  it('reaches the bottom edge from a baseline at or below the minimum', () => {
    assert.equal(graphWithBaseline(0).baselineY, 100);
    assert.equal(graphWithBaseline(-20).baselineY, 100);
  });

  it('reaches the top edge from a baseline at or above the maximum', () => {
    assert.equal(graphWithBaseline(100).baselineY, 0);
    assert.equal(graphWithBaseline(150).baselineY, 0);
  });
});

describe('Graph.getBars with a baseline', () => {
  // a 100px graph from -50 to 50, no margins: value v sits at y = 50 - v
  const barsFor = (values: number[], baseline?: number) => {
    const graph = new Graph({
      width: 100, height: 100, margin: [0, 0], hours_to_show: values.length, points_per_hour: 1, baseline,
    });
    graph.min = -50;
    graph.max = 50;
    graph.coords = values.map((value, index) => [index * 10, 0, value, index]);
    return graph.getBars(0);
  };

  it('grows bars up from the bottom edge without one', () => {
    const [bar] = barsFor([-20]);
    assert.equal(bar.y, 70);
    assert.equal(bar.height, 30);
    assert.equal(bar.base, 100);
  });

  it('grows a value above the baseline up from it', () => {
    const [bar] = barsFor([20], 0);
    assert.equal(bar.y, 30);
    assert.equal(bar.height, 20);
    assert.equal(bar.tip, 30);
  });

  it('grows a value below the baseline down from it', () => {
    const [bar] = barsFor([-20], 0);
    assert.equal(bar.y, 50);
    assert.equal(bar.height, 20);
    assert.equal(bar.tip, 70);
    assert.equal(bar.base, 50);
  });

  it('draws a value at the baseline as no bar', () => {
    assert.equal(barsFor([0], 0)[0].height, 0);
  });
});
