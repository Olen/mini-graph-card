/**
 * Tests for cards that draw some entities as lines and others as bars
 * (entities[].graph): which entity is which, where a line's points sit next
 * to bars, and which one hovering picks.
 */

import { expect, describe, it } from 'vitest';
import Graph from '../graph';
import { isBarEntity, pickPointOrBar } from '../others';

describe('isBarEntity()', () => {
  it('follows the card\'s show.graph', () => {
    expect(isBarEntity({}, { show: { graph: 'bar' } })).toBe(true);
    expect(isBarEntity({}, { show: { graph: 'line' } })).toBe(false);
  });

  it('lets an entity choose for itself', () => {
    expect(isBarEntity({ graph: 'line' }, { show: { graph: 'bar' } })).toBe(false);
    expect(isBarEntity({ graph: 'bar' }, { show: { graph: 'line' } })).toBe(true);
  });
});

// 4 buckets over 200 px, no margins, 10 px between bar groups
const makeGraph = (barCentres: boolean) => {
  const graph = new Graph({
    width: 200,
    height: 100,
    margin: [0, 0],
    hours_to_show: 4,
    points_per_hour: 1,
    bar_spacing_group: 10,
    barCentres,
  });
  graph.min = 0;
  graph.max = 10;
  return graph;
};

describe('Graph points next to bars', () => {
  it('spread edge to edge without bars', () => {
    const graph = makeGraph(false);
    expect([0, 1, 2, 3].map(i => graph._xAt(i))).toEqual([0, 200 / 3, 400 / 3, 200]);
    expect(graph.rightEdgeX).toBe(200);
  });

  it('sit at the centres of the bar groups next to bars', () => {
    const graph = makeGraph(true);
    // groups are (200 - 3 * 10) / 4 = 42.5 wide: centres at 21.25, 73.75, ...
    expect([0, 1, 2, 3].map(i => graph._xAt(i))).toEqual([21.25, 73.75, 126.25, 178.75]);
    expect(graph.rightEdgeX).toBe(178.75);
  });

  it('match where getBars() puts the bars', () => {
    const bars = makeGraph(true);
    bars.coords = [0, 1, 2, 3].map(i => [0, 0, 5, i]);
    const centres = bars.getBars(0).map(bar => bar.x + bar.width / 2);
    const line = makeGraph(true);
    expect([0, 1, 2, 3].map(i => line._xAt(i))).toEqual(centres);
  });

  it('keep a lone bucket\'s line from edge to edge', () => {
    const graph = new Graph({
      width: 200, height: 100, margin: [0, 0], hours_to_show: 1, points_per_hour: 1,
    });
    expect(graph.rightEdgeX).toBe(200);
  });
});

describe('pickPointOrBar()', () => {
  const bar = { x: 40, width: 20, tip: 30 };
  const barHit = { entity: 0, index: 1, bar };
  const pointAt = (y: number) => ({ entity: 1, point: [50, y, 7, 1] });

  it('picks the bar when its tip is closer to the cursor', () => {
    expect(pickPointOrBar(pointAt(80), barHit, 50, 35)).toBe('bar');
  });

  it('picks the line\'s point when it is closer', () => {
    expect(pickPointOrBar(pointAt(80), barHit, 50, 75)).toBe('point');
  });

  it('picks the line between bars', () => {
    expect(pickPointOrBar(pointAt(80), barHit, 65, 30)).toBe('point');
  });

  it('picks what there is when only one kind is drawn', () => {
    expect(pickPointOrBar(undefined, barHit, 0, 0)).toBe('bar');
    expect(pickPointOrBar(pointAt(10), undefined, 0, 0)).toBe('point');
    expect(pickPointOrBar(undefined, undefined, 0, 0)).toBeUndefined();
  });
});
