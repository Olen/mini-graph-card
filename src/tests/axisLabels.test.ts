/**
 * Tests for y_axis.<axis>.labels: which bound labels an axis shows, and when
 * it gets a "0" label at the zero line.
 */

import {
  expect, describe, it, vi, afterEach,
} from 'vitest';
import { axisLabelShown, showsZeroLabel } from '../others';
import { checkAxisLabels } from '../checkOption';

// log() -> console.warn
const mockWarn = () => vi.spyOn(console, 'warn').mockImplementation(() => { });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('checkAxisLabels()', () => {
  it('keeps a valid list', () => {
    const axis = { labels: ['max', 'zero'] };
    checkAxisLabels(axis, 'primary');
    expect(axis.labels).toEqual(['max', 'zero']);
  });

  it('drops unknown names with a warning', () => {
    const warn = mockWarn();
    const axis = { labels: ['max', 'middle'] };
    checkAxisLabels(axis, 'primary');
    expect(axis.labels).toEqual(['max']);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('removes anything but a list, so the axis shows max and min', () => {
    const warn = mockWarn();
    const axis: any = { labels: 'max' };
    checkAxisLabels(axis, 'secondary');
    expect(axis.labels).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('leaves an unset option unset', () => {
    const axis: any = {};
    checkAxisLabels(axis, 'primary');
    expect(axis).toEqual({});
  });
});

describe('axisLabelShown()', () => {
  it('shows max and min when unset', () => {
    expect(axisLabelShown(undefined, 'max')).toBe(true);
    expect(axisLabelShown(undefined, 'min')).toBe(true);
    expect(axisLabelShown(undefined, 'zero')).toBe(false);
  });

  it('shows what the list names', () => {
    expect(axisLabelShown(['max', 'zero'], 'min')).toBe(false);
    expect(axisLabelShown(['max', 'zero'], 'zero')).toBe(true);
  });

  it('shows everything for "all"', () => {
    expect(axisLabelShown(['all'], 'zero')).toBe(true);
    expect(axisLabelShown(['all'], 'min')).toBe(true);
  });

  it('shows nothing for an empty list', () => {
    expect(axisLabelShown([], 'max')).toBe(false);
  });
});

describe('showsZeroLabel()', () => {
  // a 100px tall axis from -10 at the bottom to 30 at the top
  const axis = (min: number, max: number) => (value: number) => 100 - ((value - min) / (max - min)) * 100;
  const SPACING = 16;

  it('is drawn when 0 is inside the range', () => {
    expect(showsZeroLabel(['all'], [-10, 30], axis(-10, 30), SPACING)).toBe(true);
  });

  it('is not drawn unless asked for', () => {
    expect(showsZeroLabel(undefined, [-10, 30], axis(-10, 30), SPACING)).toBe(false);
  });

  it('is not drawn when 0 is outside the range', () => {
    expect(showsZeroLabel(['all'], [5, 30], axis(5, 30), SPACING)).toBe(false);
    expect(showsZeroLabel(['all'], [-30, -5], axis(-30, -5), SPACING)).toBe(false);
  });

  it('is not drawn on top of a shown bound label', () => {
    // 0 is the minimum: the min label already says it
    expect(showsZeroLabel(['all'], [0, 30], axis(0, 30), SPACING)).toBe(false);
    // 0 is 5px above the min label
    expect(showsZeroLabel(['all'], [-2, 38], axis(-2, 38), SPACING)).toBe(false);
  });

  it('takes the place of a hidden bound label at 0', () => {
    expect(showsZeroLabel(['max', 'zero'], [0, 30], axis(0, 30), SPACING)).toBe(true);
  });
});
