/**
 * Tests for the aggregate functions of Graph (aggregate_func).
 *
 * The file is disabled (renamed to *.dis) & thus is not used during a build process;
 * remove the "dis" extension to use it locally in your VSCode devcontainer.
 */

import { expect, describe, it } from 'vitest';
import Graph from '../graph';

const graph = new Graph({ width: 500, height: 100, margin: [0, 0] });

// a history is a list of {state, last_changed}; a state is a string from the
// recorder & a number from the statistics API, so both are checked
const items = (...states: any[]) => states.map(state => ({ state, last_changed: 0 }));

describe('aggregate functions', () => {

  it('median: an odd number of unsorted items', () => {
    expect(graph._median(items('5', '1', '9', '3', '7'))).toBe(5);
  });

  it('median: an even number of unsorted items', () => {
    expect(graph._median(items('5', '1', '9', '3'))).toBe(4);
  });

  it('median: a single item', () => {
    expect(graph._median(items('42'))).toBe(42);
  });

  it('median: items are not reordered in place', () => {
    const list = items('5', '1', '9');
    graph._median(list);
    expect(list.map(item => item.state)).toEqual(['5', '1', '9']);
  });

  it('median: numeric states', () => {
    expect(graph._median(items(5, 1, 9, 3, 7))).toBe(5);
  });

  it('median: negative & decimal states', () => {
    expect(graph._median(items('-5', '2.5', '-1'))).toBe(-1);
  });

  it('median: a sorted list is unchanged by sorting', () => {
    expect(graph._median(items('1', '3', '5', '7', '9'))).toBe(5);
  });

  it('average', () => {
    expect(graph._average(items('1', '2', '3'))).toBe(2);
  });

  it('maximum & minimum', () => {
    expect(graph._maximum(items('5', '1', '9'))).toBe(9);
    expect(graph._minimum(items('5', '1', '9'))).toBe(1);
  });

  it('first & last keep the order of a history', () => {
    expect(graph._first(items('5', '1', '9'))).toBe(5);
    expect(graph._last(items('5', '1', '9'))).toBe(9);
  });

  it('sum', () => {
    expect(graph._sum(items('1', '2', '3'))).toBe(6);
  });

  it('delta & diff', () => {
    expect(graph._delta(items('5', '1', '9'))).toBe(8);
    expect(graph._diff(items('5', '1', '9'))).toBe(4);
  });
});
