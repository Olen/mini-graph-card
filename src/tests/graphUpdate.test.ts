/**
 * Tests for Graph.update() with a history holding nothing.
 *
 * An entity can legitimately have no state change inside the shown window: its
 * history was purged, it went unavailable long ago, or it simply has not moved
 * (a monthly peak, a helper left at a constant). The card must treat that as
 * "loaded, nothing to plot" - upstream #1326 has it stuck on a loading spinner
 * for ever, because a graph that was never given a history and one that was
 * given an empty one are indistinguishable.
 */

import { expect, describe, it } from 'vitest';
import Graph from '../graph';

const makeGraph = (over = {}) => new Graph({
  width: 500,
  height: 100,
  margin: [0, 0],
  hours: 24,
  points: 1,
  ...over,
});

// Recent enough to land inside a 24h window whenever the suite runs
const recently = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60000).toISOString();

describe('Graph.update', () => {
  it('leaves the history undefined until it is given one', () => {
    // This is what the card's loading indicator keys on
    expect(makeGraph()._history).toBeUndefined();
  });

  it('records an empty history as loaded rather than absent', () => {
    const graph = makeGraph();
    graph.update([]);
    expect(graph._history).toEqual([]);
    expect(graph._history).not.toBeUndefined();
  });

  it('plots nothing for an empty history', () => {
    const graph = makeGraph();
    graph.update([]);
    // The card skips a series with no coordinates, & an empty one must not
    // reach the aggregation: there is no "last value" to carry forward.
    expect(graph.coords).toEqual([]);
  });

  it('does not throw on an empty history', () => {
    expect(() => makeGraph().update([])).not.toThrow();
  });

  it('does not throw for any aggregate function', () => {
    const functions = ['avg', 'median', 'max', 'min', 'first', 'last', 'sum', 'delta', 'diff'];
    functions.forEach((aggregateFuncName) => {
      expect(() => makeGraph({ aggregateFuncName }).update([]), aggregateFuncName).not.toThrow();
    });
  });

  it('accepts an empty history through the setter as well', () => {
    const graph = makeGraph();
    graph.history = [];
    graph.update();
    expect(graph._history).toEqual([]);
    expect(graph.coords).toEqual([]);
  });

  it('still bins a history which does hold something', () => {
    const graph = makeGraph({ hours: 1, points: 2 });
    graph.update([
      { last_changed: recently(45), state: '10' },
      { last_changed: recently(5), state: '20' },
    ]);
    expect(graph.coords.length).toBeGreaterThan(0);
    expect(graph.coords.every(coord => Number.isFinite(Number(coord[2])))).toBe(true);
  });

  it('recovers once a history arrives after an empty one', () => {
    const graph = makeGraph({ hours: 1, points: 2 });
    graph.update([]);
    graph.update([{ last_changed: recently(5), state: '7' }]);
    expect(graph.coords.length).toBeGreaterThan(0);
  });
});
