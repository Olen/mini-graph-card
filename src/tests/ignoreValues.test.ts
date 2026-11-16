/**
 * Tests for entities[].ignore_values: readings a sensor reports instead of
 * no value - say -1 for "nothing measured yet today" - left out of the graph.
 */

import {
  expect, describe, it, vi, afterEach,
} from 'vitest';
import { withoutIgnored } from '../others';
import { checkIgnoreValues } from '../checkOption';
import buildConfig from '../buildConfig';

afterEach(() => {
  vi.restoreAllMocks();
});

const reading = (state: any, extra = {}) => ({ last_changed: '2026-11-15T02:52:00Z', state, ...extra });

describe('withoutIgnored()', () => {
  it('leaves out readings of an ignored value', () => {
    const series = [reading('29'), reading('-1'), reading('30')];
    expect(withoutIgnored(series, [-1]).map(item => item.state)).toEqual(['29', '30']);
  });

  it('compares numbers, not text', () => {
    expect(withoutIgnored([reading('-1.0'), reading(-1)], [-1])).toEqual([]);
  });

  it('leaves out a statistics row made of an ignored value in part', () => {
    // the hour the day changed in: from 29 to -1
    const series = [
      reading(29, { min: 29, max: 29 }),
      reading(14, { min: -1, max: 29 }),
      reading(-1, { min: -1, max: -1 }),
      reading(30, { min: 30, max: 30 }),
    ];
    expect(withoutIgnored(series, [-1]).map(item => item.state)).toEqual([29, 30]);
  });

  it('keeps everything without ignored values', () => {
    const series = [reading('-1')];
    expect(withoutIgnored(series, undefined)).toBe(series);
    expect(withoutIgnored(series, [])).toBe(series);
  });
});

describe('checkIgnoreValues()', () => {
  it('takes a number or a list of them', () => {
    expect(checkIgnoreValues(-1, 'ignore_values')).toEqual([-1]);
    expect(checkIgnoreValues([-1, '-2'], 'ignore_values')).toEqual([-1, -2]);
  });

  it('has none when not set', () => {
    expect(checkIgnoreValues(undefined, 'ignore_values')).toBeUndefined();
  });

  it('warns & drops what is not a number', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => { });
    expect(checkIgnoreValues([-1, 'none'], 'ignore_values')).toEqual([-1]);
    expect(checkIgnoreValues('none', 'ignore_values')).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('reaches an entity through buildConfig', () => {
    const { config } = buildConfig({
      entities: [{ entity: 'sensor.stress', ignore_values: -1 }, 'sensor.b'],
    });
    expect(config.entities[0].ignore_values).toEqual([-1]);
    expect(config.entities[1].ignore_values).toBeUndefined();
  });
});
