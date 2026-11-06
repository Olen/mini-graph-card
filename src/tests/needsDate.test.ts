/**
 * Tests for needsDate() - when a time in a tooltip gets its date in front.
 */
import { describe, it, expect } from 'vitest';
import { needsDate } from '../locale';

const NOW = new Date(2026, 10, 6, 0, 30);

describe('needsDate', () => {
  it('always dates a time in a window longer than a day', () => {
    expect(needsDate(new Date(2026, 10, 6, 0, 10), 48, NOW)).toBe(true);
    expect(needsDate(new Date(2026, 10, 6, 0, 10), 48, undefined)).toBe(true);
  });

  it('dates a time from yesterday in a day-long window', () => {
    expect(needsDate(new Date(2026, 10, 5, 23, 0), 24, NOW)).toBe(true);
  });

  it('leaves a time from today undated in a day-long window', () => {
    expect(needsDate(new Date(2026, 10, 6, 0, 10), 24, NOW)).toBe(false);
  });

  it('leaves a short window undated when no current time is given', () => {
    expect(needsDate(new Date(2026, 10, 5, 23, 0), 24, undefined)).toBe(false);
  });
});
