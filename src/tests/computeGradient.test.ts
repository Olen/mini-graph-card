/**
 * Tests for Graph.computeGradient() - where the color_thresholds stops sit.
 *
 * The gradient paints a rect covering the whole graph, margins included, so a
 * stop must sit where its value is drawn in that frame - not as a fraction of
 * the value range, which ignores the margins.
 */

import { assert, describe, it } from 'vitest';
import Graph from '../graph';

const THRESHOLDS = [
  { value: 100, color: '#ff0000' },
  { value: 50, color: '#00ff00' },
  { value: 0, color: '#0000ff' },
];

const graphWith = (margin: number, logarithmic = false) => {
  const graph = new Graph({
    width: 100,
    height: 100,
    margin: [0, margin],
    logarithmic,
  });
  graph.min = 0;
  graph.max = 100;
  return graph;
};

const offsets = (graph: any) => graph.computeGradient(THRESHOLDS).map(stop => stop.offset);

describe('Graph.computeGradient', () => {
  it('places stops where their values are drawn, margins included', () => {
    const [top, middle, bottom] = offsets(graphWith(5));
    assert.closeTo(top, 10, 1e-9);
    assert.closeTo(middle, 50, 1e-9);
    assert.closeTo(bottom, 90, 1e-9);
  });

  it('spans the whole height when there is no margin', () => {
    const [top, middle, bottom] = offsets(graphWith(0));
    assert.closeTo(top, 0, 1e-9);
    assert.closeTo(middle, 50, 1e-9);
    assert.closeTo(bottom, 100, 1e-9);
  });

  it('follows a logarithmic scale', () => {
    const graph = graphWith(5, true);
    const [top, , bottom] = offsets(graph);
    assert.closeTo(top, 10, 1e-9);
    assert.closeTo(bottom, 90, 1e-9);
  });

  it('keeps the colours of the stops', () => {
    const colours = graphWith(5).computeGradient(THRESHOLDS).map(stop => stop.color);
    assert.deepEqual(colours, ['#ff0000', '#00ff00', '#0000ff']);
  });
});
