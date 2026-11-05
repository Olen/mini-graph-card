/**
 * Tests for getIntervalEndDate() - the end of the newest bucket, shared by the
 * graph and the tooltip so their times agree.
 */

import { expect, describe, it } from 'vitest';
import { getIntervalEndDate } from '../others';

// local time: vitest pins TZ, and group_by works in the user's local time
const NOW = new Date(2026, 10, 5, 14, 37, 12, 345);

describe('getIntervalEndDate', () => {
  it('ends an interval graph now', () => {
    expect(getIntervalEndDate('interval', NOW)).toEqual(NOW);
  });

  it('ends an hourly graph at the next full hour', () => {
    expect(getIntervalEndDate('hour', NOW)).toEqual(new Date(2026, 10, 5, 15, 0, 0, 0));
  });

  it('ends a daily graph at the next midnight', () => {
    expect(getIntervalEndDate('date', NOW)).toEqual(new Date(2026, 10, 6, 0, 0, 0, 0));
  });

  it('ends a monthly graph at midnight on the first of the next month', () => {
    expect(getIntervalEndDate('month', NOW)).toEqual(new Date(2026, 11, 1, 0, 0, 0, 0));
  });

  it('does not change the date it is given', () => {
    const now = new Date(NOW);
    getIntervalEndDate('date', now);
    expect(now).toEqual(NOW);
  });
});
