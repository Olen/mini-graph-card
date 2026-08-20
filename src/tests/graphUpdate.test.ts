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
  hours_to_show: 24,
  points_per_hour: 1,
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
    const graph = makeGraph({ hours_to_show: 1, points_per_hour: 2 });
    graph.update([
      { last_changed: recently(45), state: '10' },
      { last_changed: recently(5), state: '20' },
    ]);
    expect(graph.coords.length).toBeGreaterThan(0);
    expect(graph.coords.every(coord => Number.isFinite(Number(coord[2])))).toBe(true);
  });

  it('recovers once a history arrives after an empty one', () => {
    const graph = makeGraph({ hours_to_show: 1, points_per_hour: 2 });
    graph.update([]);
    graph.update([{ last_changed: recently(5), state: '7' }]);
    expect(graph.coords.length).toBeGreaterThan(0);
  });
});

/**
 * Where a graph starts.
 *
 * A bucket with no reading carries the previous value forward, which is what
 * the state machine says really happened. Before the FIRST reading there is no
 * previous value to carry, and the card used to fill those buckets from the
 * first future one - drawing an entity's readings from before it had any
 * (upstream #414). Nothing is drawn there now.
 */
describe('Graph.update: the start of a graph', () => {
  const at = (minutesAgo: number, state: string) => ({
    last_changed: recently(minutesAgo), state,
  });

  it('starts where the data starts, not at the left edge', () => {
    const graph = makeGraph({ points_per_hour: 1 });        // 24 buckets of an hour
    graph.update([at(90, '20'), at(30, '22')]);    // nothing older than 90 min
    expect(graph.coords.length).toBeLessThan(24);
    expect(graph.coords.length).toBeGreaterThan(0);
  });

  it('draws no reading from before the entity had one', () => {
    const graph = makeGraph({ points_per_hour: 1 });
    graph.update([at(90, '20'), at(30, '22')]);
    // the left-most point is the first real reading, not a copy of it moved back
    const firstX = graph.coords[0][0];
    expect(firstX).toBeGreaterThan(0);
  });

  it('still carries a value forward across a later quiet spell', () => {
    const graph = makeGraph({ points_per_hour: 1 });
    graph.update([at(23 * 60, '20'), at(30, '22')]);
    // 23 hours with nothing reported between them: a flat line, not a hole
    expect(graph.coords.length).toBeGreaterThan(20);
    const values = graph.coords.map(c => c[2]);
    expect(values.filter(v => v === 20).length).toBeGreaterThan(15);
  });

  it('fills the whole window when the data does', () => {
    const graph = makeGraph({ points_per_hour: 1 });
    const full = Array.from({ length: 24 }, (_, i) => at(i * 60 + 1, `${20 + i}`));
    graph.update(full.reverse());
    expect(graph.coords.length).toBe(24);
    expect(graph.coords[0][0]).toBe(0);
  });

  it('plots nothing when every bucket is empty', () => {
    const graph = makeGraph();
    graph.update([]);
    expect(graph.coords).toEqual([]);
  });
});
