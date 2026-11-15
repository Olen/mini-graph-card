/**
 * Tests for an entity's trend (entities[].trend): a centred moving average
 * drawn behind its line, and the slope of the least-squares line through the
 * readings, shown under its state.
 */

import {
  expect, describe, it, vi, beforeEach, afterEach,
} from 'vitest';
import { movingAverage, slopePerDay } from '../others';
import { checkTrend } from '../checkOption';
import buildConfig from '../buildConfig';
import Graph from '../graph';

const DAY = 24 * 3600 * 1000;
const mockLog = () => vi.spyOn(console, 'warn').mockImplementation(() => { });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('movingAverage()', () => {
  // a reading a day: 10, 20, 30, 40, 50
  const readings = [10, 20, 30, 40, 50].map((value, day) => ({ time: day * DAY, value }));

  it('averages the readings either side of a time, so it does not lag', () => {
    // three days wide: the day before, the day itself & the day after
    expect(movingAverage(readings, [2 * DAY], 1.5 * DAY)).toEqual([30]);
  });

  it('averages fewer readings at the ends of the series', () => {
    expect(movingAverage(readings, [0, 4 * DAY], 1.5 * DAY)).toEqual([15, 45]);
  });

  it('has no value where no reading falls within the window', () => {
    expect(movingAverage(readings, [20 * DAY], 1.5 * DAY)).toEqual([undefined]);
  });
});

describe('slopePerDay()', () => {
  it('is the change per day along the best straight line', () => {
    const readings = [80, 79.5, 79, 78.5].map((value, day) => ({ time: day * DAY, value }));
    expect(slopePerDay(readings)).toBeCloseTo(-0.5);
  });

  it('weighs readings by when they were taken, not by their order', () => {
    // two readings a week apart: 1 kg over 7 days
    expect(slopePerDay([{ time: 0, value: 80 }, { time: 7 * DAY, value: 79 }]))
      .toBeCloseTo(-1 / 7);
  });

  it('is undefined for fewer than two readings or one moment', () => {
    expect(slopePerDay([{ time: 0, value: 80 }])).toBeUndefined();
    expect(slopePerDay([{ time: 0, value: 80 }, { time: 0, value: 79 }])).toBeUndefined();
  });
});

describe('checkTrend()', () => {
  it('takes true for a week-wide average with a slope per week', () => {
    expect(checkTrend(true, 'trend')).toEqual({ days: 7, slope: 'week' });
  });

  it('takes a window & a slope period, or no slope', () => {
    expect(checkTrend({ days: 14, slope: 'month' }, 'trend')).toEqual({ days: 14, slope: 'month' });
    expect(checkTrend({ slope: false }, 'trend')).toEqual({ days: 7, slope: false });
  });

  it('has none when not set', () => {
    expect(checkTrend(undefined, 'trend')).toBeUndefined();
    expect(checkTrend(false, 'trend')).toBeUndefined();
  });

  it('warns & keeps the default on a value it does not know', () => {
    const warn = mockLog();
    expect(checkTrend({ days: 0, slope: 'year' }, 'trend')).toEqual({ days: 7, slope: 'week' });
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('reaches an entity through buildConfig', () => {
    const { config } = buildConfig({ entities: [{ entity: 'sensor.weight', trend: true }, 'sensor.b'] });
    expect(config.entities[0].trend).toEqual({ days: 7, slope: 'week' });
    expect(config.entities[1].trend).toBeUndefined();
  });
});

describe('Graph trend', () => {
  const NOW = new Date('2026-11-12T12:00:00Z');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ten days, a bucket a day; a weigh-in each morning, losing 0.2 kg a day
  const weighIns = Array.from({ length: 10 }, (_, day) => ({
    last_changed: new Date(NOW.getTime() - (9.5 - day) * DAY).toISOString(),
    state: String(80 - 0.2 * day),
  }));
  const makeGraph = (trend: any) => {
    const graph = new Graph({
      width: 1000, height: 100, margin: [0, 0], hours_to_show: 240, points_per_hour: 1 / 24, trend,
    });
    graph.update(weighIns);
    return graph;
  };

  it('has a point of the moving average for each point of the line', () => {
    const graph = makeGraph({ days: 3, slope: 'week' });
    expect(graph.trend.map(point => point[0])).toEqual(graph.coords.map(coord => coord[0]));
    // a straight decline averages to itself away from the ends
    expect(graph.trend[5][2]).toBeCloseTo(graph.coords[5][2]);
  });

  it('knows the slope of the readings in the window', () => {
    expect(makeGraph({ days: 3, slope: 'week' }).slope).toBeCloseTo(-0.2);
  });

  it('has neither without a trend', () => {
    const graph = makeGraph(undefined);
    expect(graph.trend).toEqual([]);
    expect(graph.slope).toBeUndefined();
  });

  it('draws the trend as a path', () => {
    const graph = makeGraph({ days: 3, slope: 'week' });
    [graph.min, graph.max] = [78, 80];
    expect(graph.getTrendPath()).toMatch(/^M/);
  });
});
