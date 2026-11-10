/**
 * Tests for widenToMinRange() - which way an axis grows to reach
 * min_bound_range. A bound the user set stays put, a soft one too when it is
 * the only one, so `lower_bound: ~0` keeps 0 at the bottom.
 */

import { expect, describe, it } from 'vitest';
import { widenToMinRange } from '../others';

// data from 0 to 2, and a range of at least 10 asked for
const DATA = [0, 2];

describe('widenToMinRange()', () => {
  it('grows equally both ways without bounds', () => {
    expect(widenToMinRange(DATA, undefined, undefined, 10)).toEqual([-4, 6]);
  });

  it('grows upwards from a lower bound, fixed or soft', () => {
    expect(widenToMinRange(DATA, 0, undefined, 10)).toEqual([0, 10]);
    expect(widenToMinRange(DATA, '~0', undefined, 10)).toEqual([0, 10]);
  });

  it('grows downwards from an upper bound, fixed or soft', () => {
    expect(widenToMinRange(DATA, undefined, 2, 10)).toEqual([-8, 2]);
    expect(widenToMinRange(DATA, undefined, '~2', 10)).toEqual([-8, 2]);
  });

  it('grows equally both ways when both are pinned alike', () => {
    expect(widenToMinRange(DATA, 0, 2, 10)).toEqual([-4, 6]);
    expect(widenToMinRange(DATA, '~0', '~2', 10)).toEqual([-4, 6]);
  });

  it('grows on the soft side when the other is fixed', () => {
    expect(widenToMinRange(DATA, '~0', 2, 10)).toEqual([-8, 2]);
    expect(widenToMinRange(DATA, 0, '~2', 10)).toEqual([0, 10]);
  });

  it('leaves a range that is wide enough alone', () => {
    expect(widenToMinRange([0, 20], undefined, undefined, 10)).toEqual([0, 20]);
  });

  it('leaves the range alone without a valid min_bound_range', () => {
    expect(widenToMinRange(DATA, undefined, undefined, undefined)).toEqual(DATA);
    expect(widenToMinRange(DATA, undefined, undefined, 'abc')).toEqual(DATA);
  });
});
