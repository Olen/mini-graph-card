/**
 * Tests for an inverted axis (y_axis.<axis>.invert) and a fixed zero line
 * (y_axis.zero_position) - together they draw two series against each other,
 * one up and one down from a shared zero.
 */

import {
  assert, describe, it, expect,
} from 'vitest';
import Graph from '../graph';
import { boundsForZeroPosition, baselineFor, isOpposingBars } from '../others';
import buildConfig from '../buildConfig';

// a 100px graph from 0 to 100, no margins
const makeGraph = (invert: boolean, baseline?: number) => {
  const graph = new Graph({
    width: 100, height: 100, margin: [0, 0], hours_to_show: 1, points_per_hour: 1, invert, baseline,
  });
  graph.min = 0;
  graph.max = 100;
  return graph;
};

describe('Graph with an inverted axis', () => {
  it('draws low values at the top', () => {
    assert.equal(makeGraph(true).getY(0), 0);
    assert.equal(makeGraph(true).getY(100), 100);
    assert.equal(makeGraph(true).getY(25), 25);
  });

  it('draws them at the bottom when not inverted', () => {
    assert.equal(makeGraph(false).getY(0), 100);
    assert.equal(makeGraph(false).getY(25), 75);
  });

  it('places points with the same scale as getY', () => {
    const graph = makeGraph(true);
    graph.coords = [[0, 0, 25, 0]];
    assert.equal(graph._calcY(graph.coords)[0][1], 25);
  });

  it('hangs bars from the top edge without a baseline', () => {
    const graph = makeGraph(true);
    graph.coords = [[0, 0, 30, 0]];
    const [bar] = graph.getBars(0);
    assert.equal(bar.base, 0);
    assert.equal(bar.y, 0);
    assert.equal(bar.height, 30);
  });

  it('orders colour stops top to bottom', () => {
    const graph = makeGraph(true);
    const stops = graph.computeGradient([
      { value: 80, color: '#ff0000' },
      { value: 20, color: '#0000ff' },
    ]);
    assert.deepEqual(stops.map(stop => stop.color), ['#0000ff', '#ff0000']);
    assert.isBelow(stops[0].offset, stops[1].offset);
  });
});

describe('boundsForZeroPosition()', () => {
  // where 0 lands, as a share of the height from the top
  const zeroAt = ([min, max]: number[], inverted = false) => (inverted ? -min : max) / (max - min);

  it('puts 0 at the asked position by giving the short side more room', () => {
    const bound = boundsForZeroPosition([-10, 90], 0.5, false);
    assert.deepEqual(bound, [-90, 90]);
    assert.closeTo(zeroAt(bound), 0.5, 1e-9);
  });

  it('never cuts a value off', () => {
    const bound = boundsForZeroPosition([-80, 20], 0.75, false);
    assert.isAtMost(bound[0], -80);
    assert.isAtLeast(bound[1], 20);
    assert.closeTo(zeroAt(bound), 0.75, 1e-9);
  });

  it('adds room below 0 for an axis that never goes negative', () => {
    const bound = boundsForZeroPosition([0, 30], 0.75, false);
    assert.deepEqual(bound, [-10, 30]);
  });

  it('measures from the top of an inverted axis, where min is', () => {
    // inverted: 0.75 from the top means 3/4 of the height is for negative values
    const bound = boundsForZeroPosition([0, 30], 0.75, true);
    assert.closeTo(zeroAt(bound, true), 0.75, 1e-9);
    assert.isAtLeast(bound[1], 30);
  });

  it('leaves an all-zero axis alone', () => {
    assert.deepEqual(boundsForZeroPosition([0, 0], 0.5, false), [0, 0]);
  });

  it('keeps 0 just inside the graph for positions 0 and 1', () => {
    const top = boundsForZeroPosition([-10, 10], 0, false);
    const bottom = boundsForZeroPosition([-10, 10], 1, false);
    assert.closeTo(zeroAt(top), 0.01, 1e-9);
    assert.closeTo(zeroAt(bottom), 0.99, 1e-9);
    assert.isTrue(Number.isFinite(top[0]) && Number.isFinite(bottom[1]));
  });
});

describe('baselineFor()', () => {
  it('starts bars & fill at 0 when the zero line is fixed', () => {
    expect(baselineFor({}, { y_axis: { zero_position: 0.6 } })).toBe(0);
  });

  it('keeps a baseline that is set, on the entity or the card', () => {
    expect(baselineFor({ baseline: 5 }, { y_axis: { zero_position: 0.6 } })).toBe(5);
    expect(baselineFor({}, { baseline: 3, y_axis: { zero_position: 0.6 } })).toBe(3);
  });

  it('uses the graph\'s edge without either', () => {
    expect(baselineFor({}, {})).toBeUndefined();
    expect(baselineFor({}, { y_axis: { primary: {} } })).toBeUndefined();
  });
});

describe('opposing bars', () => {
  const opposing = (over: any = {}) => ({
    entities: [{ entity: 'sensor.download' }, { entity: 'sensor.upload', y_axis: 'secondary' }],
    show: { graph: 'bar' },
    y_axis: { zero_position: 0.6, secondary: { invert: true } },
    ...over,
  });

  it('are bars on both axes, one inverted, around a fixed zero line', () => {
    expect(isOpposingBars(opposing())).toBe(true);
  });

  it('are not lines', () => {
    expect(isOpposingBars(opposing({ show: { graph: 'line' } }))).toBe(false);
  });

  it('need a fixed zero line', () => {
    expect(isOpposingBars(opposing({ y_axis: { secondary: { invert: true } } }))).toBe(false);
  });

  it('need exactly one inverted axis', () => {
    expect(isOpposingBars(opposing({ y_axis: { zero_position: 0.6 } }))).toBe(false);
    const both = { zero_position: 0.6, primary: { invert: true }, secondary: { invert: true } };
    expect(isOpposingBars(opposing({ y_axis: both }))).toBe(false);
  });

  it('need bars drawn on both axes', () => {
    const entities = [{ entity: 'sensor.download' }, { entity: 'sensor.upload', y_axis: 'secondary', show_graph: false }];
    expect(isOpposingBars(opposing({ entities }))).toBe(false);
  });

  it('share a column by default', () => {
    expect(buildConfig(opposing()).config.bar_spacing).toBe(-1);
  });

  it('keep a bar_spacing that is set', () => {
    expect(buildConfig(opposing({ bar_spacing: 4 })).config.bar_spacing).toBe(4);
  });
});
