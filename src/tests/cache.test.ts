/**
 * Tests for the history cache records.
 *
 * The cache is appended to and never re-read, so anything wrong in it stays
 * wrong: a recorder that was purged, restored or corrected, a row written by a
 * clock that has since moved. Upstream has a decade of reports with that shape
 * (#933, #944, #992, #1135) and no single mechanism behind them, so rather than
 * guess, every entry is refetched whole once it is old enough, and the two
 * states a record cannot honestly be in are rejected on the way in.
 */

import { expect, describe, it } from 'vitest';
import {
  packEntry, unpackEntry, isStale, isUsable, MAX_CACHE_AGE_HOURS,
} from '../cache';

const VERSION = '2026.8.15';
const NOW = new Date('2026-08-13T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600000);

const entry = (rest: any = {}) => ({
  version: VERSION,
  hours_to_show: 24,
  first_fetched: hoursAgo(1),
  last_fetched: hoursAgo(1),
  data: [
    { last_changed: hoursAgo(2).toISOString(), state: '21.5' },
    { last_changed: hoursAgo(1).toISOString(), state: '22.0' },
  ],
  ...rest,
});

// the entity has reported since the newest cached row, as it normally would
const ENTITY_UPDATED = hoursAgo(0.5);

describe('packEntry / unpackEntry', () => {

  it('survives a round trip', () => {
    expect(unpackEntry(packEntry(entry()))).toEqual(entry());
  });

  it('keeps the metadata readable without touching the payload', () => {
    const record: any = packEntry(entry());
    expect(record.version).toBe(VERSION);
    expect(record.hours_to_show).toBe(24);
    expect(record.first_fetched).toEqual(entry().first_fetched);
  });

  it('nothing stored means nothing to unpack', () => {
    expect(unpackEntry(null)).toBeNull();
    expect(unpackEntry(undefined as any)).toBeNull();
  });
});

describe('isStale: housekeeping, for records no card will ask for again', () => {

  it('keeps a fresh record', () => {
    expect(isStale(packEntry(entry()), VERSION, NOW)).toBe(false);
  });

  it('drops a record from another version of the card', () => {
    expect(isStale(packEntry(entry({ version: '2026.7.0' })), VERSION, NOW)).toBe(true);
  });

  it('drops one last written longer ago than its own window', () => {
    expect(isStale(packEntry(entry({ last_fetched: hoursAgo(25) })), VERSION, NOW)).toBe(true);
  });

  [
    ['nothing at all', null],
    ['a record with no metadata', { data: [] }],
    ['a bare string, as an older card stored it', 'N4IgLghgxg'],
    ['a record with no window', { version: VERSION, last_fetched: NOW }],
    ['a record with no fetch time', { version: VERSION, hours_to_show: 24 }],
  ].forEach(([what, record]) => {
    it(`drops ${what}`, () => {
      expect(isStale(record as any, VERSION, NOW)).toBe(true);
    });
  });
});

describe('isUsable: may these rows be appended to?', () => {

  it('yes, for a recent entry of the right window', () => {
    expect(isUsable(entry(), 24, ENTITY_UPDATED, NOW)).toBe(true);
  });

  it('no, when the card now wants a different window', () => {
    expect(isUsable(entry(), 6, ENTITY_UPDATED, NOW)).toBe(false);
  });

  it('no, once the window itself is due again', () => {
    const old = entry({ first_fetched: hoursAgo(25), last_fetched: hoursAgo(0.1) });
    // last_fetched is recent - appending kept it alive, which is exactly the
    // case ageing-out cannot catch
    expect(isStale(packEntry(old), VERSION, NOW)).toBe(false);
    expect(isUsable(old, 24, ENTITY_UPDATED, NOW)).toBe(false);
  });

  it('caps the age at a day, so a long window still revalidates', () => {
    const twoWeeks = 24 * 14;
    const old = entry({
      hours_to_show: twoWeeks, first_fetched: hoursAgo(MAX_CACHE_AGE_HOURS + 1),
    });
    expect(isUsable(old, twoWeeks, ENTITY_UPDATED, NOW)).toBe(false);
    // ...but a day-old entry of a two-week window is still fine
    const fresh = entry({ hours_to_show: twoWeeks, first_fetched: hoursAgo(2) });
    expect(isUsable(fresh, twoWeeks, ENTITY_UPDATED, NOW)).toBe(true);
  });

  it('bounds a short window by the window, not by the cap', () => {
    const anHour = entry({ hours_to_show: 1, first_fetched: hoursAgo(2) });
    expect(isUsable(anHour, 1, ENTITY_UPDATED, NOW)).toBe(false);
  });

  it('no, when it was written by a clock ahead of this one', () => {
    // left alone this pushes the next fetch's start past its end, so nothing
    // new is ever asked for & the graph freezes - the flat line a config
    // change appears to "fix", because that mints a different key
    const skewed = entry({ last_fetched: new Date(NOW.getTime() + 60000) });
    expect(isUsable(skewed, 24, ENTITY_UPDATED, NOW)).toBe(false);
  });

  it('no, when it holds a row the entity itself has never had', () => {
    // a recorder that was purged, restored or rolled back
    const ahead = entry({
      data: [{ last_changed: hoursAgo(0.1).toISOString(), state: '99' }],
    });
    expect(isUsable(ahead, 24, hoursAgo(3), NOW)).toBe(false);
  });

  it('does not need the entity to have reported at all', () => {
    expect(isUsable(entry(), 24, undefined as any, NOW)).toBe(true);
  });

  [
    ['nothing', null],
    ['an entry with no rows', { hours_to_show: 24, last_fetched: NOW }],
    ['an unparseable time', { hours_to_show: 24, data: [], last_fetched: 'yesterday' }],
  ].forEach(([what, e]) => {
    it(`no, for ${what}`, () => {
      expect(isUsable(e as any, 24, ENTITY_UPDATED, NOW)).toBe(false);
    });
  });
});
