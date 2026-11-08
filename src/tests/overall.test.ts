/**
 * Tests for the overall value: one value for the whole period, shown instead of
 * the current state with "show: state: overall" or "overall_<func>".
 */

import {
  expect, describe, it, beforeEach, afterEach, vi,
} from 'vitest';
import Graph from '../graph';
import { isOverallState, overallFuncName, timeWeightedAverage } from '../others';
import { checkShowState } from '../checkOption';

const HOUR = 3600000;
const NOW = new Date('2026-11-08T12:00:00Z').getTime();

// A reading `hoursAgo` before NOW
const at = (hoursAgo: number, state: any) => ({
  last_changed: new Date(NOW - hoursAgo * HOUR).toISOString(),
  state,
});

describe('isOverallState()', () => {
  it('is on for "overall" and "overall_<func>"', () => {
    expect(isOverallState('overall')).toBe(true);
    expect(isOverallState('overall_max')).toBe(true);
  });

  it('is off for the other show.state values', () => {
    expect(isOverallState(true)).toBe(false);
    expect(isOverallState(false)).toBe(false);
    expect(isOverallState('last')).toBe(false);
  });
});

describe('overallFuncName()', () => {
  it('takes the graph\'s aggregate function for "overall"', () => {
    expect(overallFuncName('overall', 'median')).toBe('median');
  });

  it('takes the named function for "overall_<func>"', () => {
    expect(overallFuncName('overall_diff', 'avg')).toBe('diff');
  });

  it('is undefined when no overall value is shown', () => {
    expect(overallFuncName(true, 'avg')).toBeUndefined();
    expect(overallFuncName('last', 'avg')).toBeUndefined();
  });
});

describe('checkShowState()', () => {
  it('keeps the valid values', () => {
    ['overall', 'overall_sum', 'last', true, false].forEach((state) => {
      expect(checkShowState(state)).toBe(state);
    });
  });

  it('shows the current state for an unknown aggregate function', () => {
    expect(checkShowState('overall_mean')).toBe(true);
  });

  it('shows the current state for an unknown value', () => {
    expect(checkShowState('average')).toBe(true);
  });
});

describe('timeWeightedAverage()', () => {
  const start = NOW - 24 * HOUR;

  it('weighs a quiet day over a burst of reports', () => {
    const readings = [
      at(24, '20'),
      at(1, '25'), at(0.8, '25'), at(0.6, '25'), at(0.4, '25'), at(0.2, '25'),
    ];
    expect(timeWeightedAverage(readings, start, NOW)).toBeCloseTo((23 * 20 + 25) / 24);
  });

  it('counts a reading from before the span from the span\'s start', () => {
    const readings = [at(48, '10'), at(12, '20')];
    expect(timeWeightedAverage(readings, start, NOW)).toBe(15);
  });

  it('leaves out the time a sensor was unavailable', () => {
    const readings = [at(24, '10'), at(12, 'unavailable'), at(6, '30')];
    // 12 hours at 10, 6 hours at 30
    expect(timeWeightedAverage(readings, start, NOW)).toBeCloseTo((12 * 10 + 6 * 30) / 18);
  });

  it('takes the readings in any order', () => {
    const readings = [at(12, '20'), at(24, '10')];
    expect(timeWeightedAverage(readings, start, NOW)).toBe(15);
  });

  it('is undefined when no value held for any time', () => {
    expect(timeWeightedAverage([at(6, 'unavailable')], start, NOW)).toBeUndefined();
    expect(timeWeightedAverage([], start, NOW)).toBeUndefined();
  });
});

describe('Graph overall value', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const makeGraph = (overallFuncName?: string) => new Graph({
    width: 500,
    height: 100,
    margin: [0, 0],
    hours_to_show: 24,
    points_per_hour: 1,
    overallFuncName,
  });

  // An energy meter: 100 when the day started, read three times since
  const meter = [at(30, '100'), at(20, '104'), at(10, '110'), at(2, '112')];

  it('uses the reading current when the period started', () => {
    const graph = makeGraph('diff');
    graph.update(meter);
    expect(graph.overall).toBe(12);
  });

  it('ignores readings from before that one', () => {
    const graph = makeGraph('min');
    graph.update([at(40, '50'), ...meter]);
    expect(graph.overall).toBe(100);
  });

  it('averages over time', () => {
    const graph = makeGraph('avg');
    graph.update([at(24, '20'), at(1, '25')]);
    expect(graph.overall).toBeCloseTo((23 * 20 + 25) / 24);
  });

  it('skips non-numeric readings for the other functions', () => {
    const graph = makeGraph('max');
    graph.update([at(20, '5'), at(10, 'unavailable'), at(5, '8')]);
    expect(graph.overall).toBe(8);
  });

  it('is undefined with no numeric reading', () => {
    const graph = makeGraph('max');
    graph.update([at(5, 'unavailable')]);
    expect(graph.overall).toBeUndefined();
  });

  it('is cleared when the history becomes empty', () => {
    const graph = makeGraph('max');
    graph.update(meter);
    graph.update([]);
    expect(graph.overall).toBeUndefined();
  });

  it('is not calculated unless asked for', () => {
    const graph = makeGraph();
    graph.update(meter);
    expect(graph.calculatesOverall).toBe(false);
    expect(graph.overall).toBeUndefined();
  });
});
