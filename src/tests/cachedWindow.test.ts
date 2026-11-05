/**
 * Tests for cachedWindow() - the part of a cached history that belongs to the
 * shown window, before newer states are fetched and appended to it.
 *
 * A cache holds every state up to its last fetch. So the newest cached state
 * from before the window is what the entity read when the window opened - even
 * when no cached state lies inside the window at all.
 */

import { expect, describe, it } from 'vitest';
import { cachedWindow } from '../cache';

const at = (iso: string, state: string) => ({ last_changed: iso, state });
const WINDOW_START = new Date('2026-11-05T00:00:00Z');

describe('cachedWindow', () => {
  it('keeps the states inside the window, opened by the newest earlier one', () => {
    const rows = [
      at('2026-11-04T10:00:00Z', '1'),
      at('2026-11-04T20:00:00Z', '2'),
      at('2026-11-05T06:00:00Z', '3'),
    ];
    expect(cachedWindow(rows, WINDOW_START)).toEqual([
      { last_changed: WINDOW_START, state: '2' },
      at('2026-11-05T06:00:00Z', '3'),
    ]);
  });

  it('opens the window with the newest earlier state when none lies inside it', () => {
    // a quiet sensor: its last change was yesterday, so it still reads '2'
    const rows = [at('2026-11-04T10:00:00Z', '1'), at('2026-11-04T20:00:00Z', '2')];
    expect(cachedWindow(rows, WINDOW_START)).toEqual([
      { last_changed: WINDOW_START, state: '2' },
    ]);
  });

  it('keeps everything when the cache starts inside the window', () => {
    const rows = [at('2026-11-05T01:00:00Z', '5'), at('2026-11-05T02:00:00Z', '6')];
    expect(cachedWindow(rows, WINDOW_START)).toEqual(rows);
  });

  it('returns nothing for an empty cache', () => {
    expect(cachedWindow([], WINDOW_START)).toEqual([]);
  });

  it('does not change the cached rows', () => {
    const rows = [at('2026-11-04T20:00:00Z', '2'), at('2026-11-05T06:00:00Z', '3')];
    cachedWindow(rows, WINDOW_START);
    expect(rows[0].last_changed).toBe('2026-11-04T20:00:00Z');
  });
});
