/**
 * Tests for the grid-line position maths.
 *
 * The point of a grid line is that it means something: a vertical line sits on
 * a real midnight or a whole hour, a horizontal one on a round value. Lines
 * spaced evenly back from the right edge would answer "how long ago" instead of
 * "which day", which is not what anyone asked for (upstream #837).
 *
 * The suite runs with TZ=Europe/Moscow (see vitest.config.js), which is UTC+3
 * with no DST - so "local midnight" here is 21:00 UTC the day before.
 */

import { expect, describe, it } from 'vitest';
import {
  parseGrid, getGridInterval, getGridTimes, getGridValues, getLabelStride,
} from '../others';

const HOUR = 3600000;
// A fixed moment to measure from: 2026-08-12 14:30 local (Moscow)
const END = new Date('2026-08-12T14:30:00+03:00').getTime();
const local = (iso: string) => new Date(iso).getTime();

describe('parseGrid', () => {
  it('is off unless asked for', () => {
    expect(parseGrid(undefined, 'grid_x')).toBeUndefined();
    expect(parseGrid(false, 'grid_x')).toBeUndefined();
  });

  it('"true" means all defaults, as "statistics" does', () => {
    expect(parseGrid(true, 'grid_x')).toEqual({ interval: 'auto', minor: 0, labels: 'hover' });
    expect(parseGrid({}, 'grid_x')).toEqual({ interval: 'auto', minor: 0, labels: 'hover' });
  });

  it('reads the label mode on either grid, in either spelling', () => {
    expect(parseGrid({ labels: true }, 'grid_y').labels).toBe('always');
    expect(parseGrid({ labels: false }, 'grid_y').labels).toBe(false);
    expect(parseGrid(true, 'grid_y').labels).toBe('hover');
    expect(parseGrid({ labels: true }, 'grid_x').labels).toBe('always');
    expect(parseGrid({ labels: 'always' }, 'grid_x').labels).toBe('always');
    expect(parseGrid({ labels: 'hover' }, 'grid_x').labels).toBe('hover');
    expect(parseGrid({ labels: false }, 'grid_x').labels).toBe(false);
    expect(parseGrid({ labels: 'sometimes' }, 'grid_x').labels).toBe('hover');
  });

  it('keeps the options it is given', () => {
    expect(parseGrid({
      interval: 'day', color: 'red', width: 2, minor: 3, labels: 'always',
    }, 'grid_x')).toEqual({
      interval: 'day', color: 'red', width: 2, minor: 3, labels: 'always',
    });
  });

  it('takes step & axis for a value grid', () => {
    expect(parseGrid({ step: 10, axis: 'secondary' }, 'grid_y'))
      .toEqual({
        step: 10, axis: 'secondary', minor: 0, labels: 'hover',
      });
  });

  it('falls back for values it does not understand', () => {
    expect(parseGrid({ interval: 'fortnight' }, 'grid_x'))
      .toEqual({ interval: 'auto', minor: 0, labels: 'hover' });
    expect(parseGrid({ axis: 'sideways' }, 'grid_y'))
      .toEqual({ axis: 'primary', minor: 0, labels: 'hover' });
    expect(parseGrid({ minor: -1 }, 'grid_x'))
      .toEqual({ interval: 'auto', minor: 0, labels: 'hover' });
    expect(parseGrid({ step: 0 }, 'grid_y'))
      .toEqual({ axis: 'primary', minor: 0, labels: 'hover' });
  });
});

describe('getGridInterval', () => {
  it('picks something that yields a readable number of lines', () => {
    const cases: [number, string][] = [
      [1, '15minute'],
      [6, 'hour'],
      [24, '6hour'],
      [48, '6hour'],
      [168, 'day'],
      [336, 'day'],
      [24 * 90, 'week'],
      [24 * 365, 'month'],
    ];
    cases.forEach(([hours, expected]) => {
      expect(getGridInterval(hours), `${hours}h`).toBe(expected);
    });
  });

  it('never returns nothing, however short the window', () => {
    expect(getGridInterval(0.1)).toBe('5minute');
  });

  it('coarsens on a narrow graph, where the same lines would be a smudge', () => {
    // 14 days is a "day" interval, i.e. 14 lines - fine at 600px, absurd at 100
    expect(getGridInterval(336, 600)).toBe('day');
    expect(getGridInterval(336, 100)).toBe('week');
  });

  it('leaves a wide graph alone', () => {
    expect(getGridInterval(24, 800)).toBe(getGridInterval(24));
  });
});

describe('getGridTimes', () => {
  it('puts a day line on local midnight, not 24h before the end', () => {
    const times = getGridTimes(END, 48, { interval: 'day' }).map(g => g.time);
    expect(times).toEqual([
      local('2026-08-11T00:00:00+03:00'),
      local('2026-08-12T00:00:00+03:00'),
    ]);
  });

  it('puts hour lines on whole hours', () => {
    const times = getGridTimes(END, 3, { interval: 'hour' }).map(g => g.time);
    expect(times).toEqual([
      local('2026-08-12T12:00:00+03:00'),
      local('2026-08-12T13:00:00+03:00'),
      local('2026-08-12T14:00:00+03:00'),
    ]);
  });

  it('puts 6-hour lines on 00/06/12/18, not on the end time', () => {
    const times = getGridTimes(END, 14, { interval: '6hour' }).map(g => g.time);
    expect(times).toEqual([
      local('2026-08-12T06:00:00+03:00'),
      local('2026-08-12T12:00:00+03:00'),
    ]);
  });

  it('stays inside the window', () => {
    const start = END - 48 * HOUR;
    getGridTimes(END, 48, { interval: 'day' }).forEach(({ time }) => {
      expect(time).toBeGreaterThanOrEqual(start);
      expect(time).toBeLessThanOrEqual(END);
    });
  });

  it('starts a week on a Monday', () => {
    const times = getGridTimes(END, 24 * 21, { interval: 'week' }).map(g => g.time);
    times.forEach(t => expect(new Date(t).getDay(), new Date(t).toISOString()).toBe(1));
    expect(times.length).toBeGreaterThan(1);
  });

  it('starts a month on the 1st', () => {
    const times = getGridTimes(END, 24 * 120, { interval: 'month' }).map(g => g.time);
    times.forEach((t) => {
      const d = new Date(t);
      expect(d.getDate()).toBe(1);
      expect(d.getHours()).toBe(0);
    });
  });

  it('marks every line major when there are no minor ones', () => {
    expect(getGridTimes(END, 6, { interval: 'hour' }).every(g => g.major)).toBe(true);
  });

  it('divides each interval when minor lines are asked for', () => {
    const lines = getGridTimes(END, 3, { interval: 'hour', minor: 1 });   // one minor per hour = every 30 min
    const majors = lines.filter(g => g.major);
    const minors = lines.filter(g => !g.major);
    expect(majors.length).toBe(3);
    expect(minors.length).toBeGreaterThanOrEqual(3);
    minors.forEach(g => expect(new Date(g.time).getMinutes()).toBe(30));
  });
});

describe('getGridValues', () => {
  it('lands on round numbers rather than dividing the range', () => {
    expect(getGridValues(17.3, 31.8).map(g => g.value))
      .toEqual([20, 25, 30]);
  });

  it('keeps every line inside the bounds', () => {
    getGridValues(3, 97).forEach(({ value }) => {
      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThanOrEqual(97);
    });
  });

  it('scales the step with the range', () => {
    const step = (min: number, max: number) => {
      const v = getGridValues(min, max).map(g => g.value);
      return v[1] - v[0];
    };
    expect(step(0, 1)).toBeCloseTo(0.2);
    expect(step(0, 100)).toBe(20);
    expect(step(0, 10000)).toBe(2000);
  });

  it('honours an explicit step', () => {
    expect(getGridValues(0, 25, { step: 10 }).map(g => g.value)).toEqual([0, 10, 20]);
  });

  it('draws decades on a logarithmic scale', () => {
    expect(getGridValues(1, 1000, { logarithmic: true }).map(g => g.value))
      .toEqual([1, 10, 100, 1000]);
  });

  it('divides the step when minor lines are asked for', () => {
    const lines = getGridValues(0, 20, { step: 10, minor: 1 });
    expect(lines.filter(g => g.major).map(g => g.value)).toEqual([0, 10, 20]);
    expect(lines.filter(g => !g.major).map(g => g.value)).toEqual([5, 15]);
  });

  it('draws fewer lines on a short graph', () => {
    const tall = getGridValues(0, 100, { height: 400 }).length;
    const short = getGridValues(0, 100, { height: 60 }).length;
    expect(short).toBeLessThan(tall);
    expect(short).toBeGreaterThan(0);
  });

  it('obeys an explicit step however short the graph', () => {
    // an interval or step written in a config is the author's call, not ours
    expect(getGridValues(0, 100, { step: 10, height: 40 }).length).toBe(11);
  });

  it('gives nothing for a flat or invalid range', () => {
    expect(getGridValues(5, 5)).toEqual([]);
    expect(getGridValues(NaN, 10)).toEqual([]);
  });
});

describe('getLabelStride', () => {
  it('shows every label when they fit', () => {
    expect(getLabelStride(14, 600, 30)).toBe(1);
  });

  it('skips some when they do not', () => {
    // 14 labels across 150px is 10.7px each, & a label wants 30
    expect(getLabelStride(14, 150, 30)).toBe(3);
  });

  it('shows every second when they are just too close', () => {
    expect(getLabelStride(10, 200, 30)).toBe(2);
  });

  it('never skips what it does not have to', () => {
    [[1, 100, 30], [0, 100, 30], [14, 0, 30], [14, 600, 0]].forEach(([c, w, l]) => {
      expect(getLabelStride(c, w, l), `${c}/${w}/${l}`).toBe(1);
    });
  });
});
