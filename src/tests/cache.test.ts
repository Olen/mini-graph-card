/**
 * Tests for the history cache records.
 *
 * The bugs these pin down all had the same cause: the metadata needed to decide
 * about a record was locked inside the payload, or encoded in the key rather
 * than in the record. So the startup purge had to decompress everything to read
 * two numbers (upstream #1392), tested a "-raw" suffix against keys written
 * with "_raw", and read `version` off a value that was a string once the
 * payload was compressed - which would have deleted every compressed record on
 * every load. None of it bit, because the option that turns compression on was
 * never wired up, so nothing was ever compressed.
 */

import { expect, describe, it } from 'vitest';
import { packEntry, unpackEntry, isStale } from '../cache';

const VERSION = '2026.8.12';
const NOW = new Date('2026-08-12T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600000);

const entry = (rest: any = {}) => ({
  version: VERSION,
  hours_to_show: 24,
  last_fetched: hoursAgo(1),
  data: [
    { last_changed: hoursAgo(2).toISOString(), state: '21.5' },
    { last_changed: hoursAgo(1).toISOString(), state: '22.0' },
  ],
  ...rest,
});

describe('packEntry / unpackEntry', () => {

  [false, true].forEach((compressed) => {
    it(`survives a round trip ${compressed ? 'compressed' : 'as it is'}`, () => {
      const original = entry();
      expect(unpackEntry(packEntry(original, compressed))).toEqual(original);
    });
  });

  it('compresses only the payload, never the metadata', () => {
    const record: any = packEntry(entry(), true);
    expect(typeof record.data).toBe('string');
    // ...the fields the purge reads stay readable without touching the payload
    expect(record.version).toBe(VERSION);
    expect(record.hours_to_show).toBe(24);
    expect(record.last_fetched).toEqual(entry().last_fetched);
  });

  it('records whether it compressed, so no caller has to remember', () => {
    expect(packEntry(entry(), true).compressed).toBe(true);
    expect(packEntry(entry(), false).compressed).toBe(false);
    expect(packEntry(entry(), undefined as any).compressed).toBe(false);
  });

  it('a compressed payload is smaller than the rows it holds', () => {
    const big = entry({
      data: Array.from({ length: 500 }, (_, i) => ({
        last_changed: hoursAgo(i / 20).toISOString(), state: `${20 + (i % 10)}`,
      })),
    });
    const packed: any = packEntry(big, true);
    expect(packed.data.length).toBeLessThan(JSON.stringify(big.data).length / 2);
  });

  it('nothing stored means nothing to unpack', () => {
    expect(unpackEntry(null)).toBeNull();
    expect(unpackEntry(undefined as any)).toBeNull();
  });
});

describe('isStale', () => {

  it('keeps a fresh record', () => {
    expect(isStale(packEntry(entry(), false), VERSION, NOW)).toBe(false);
  });

  it('keeps a fresh record that happens to be compressed', () => {
    // the one that used to be deleted on every load: a compressed payload made
    // the stored value a string, whose .version is undefined
    expect(isStale(packEntry(entry(), true), VERSION, NOW)).toBe(false);
  });

  it('drops a record from another version of the card', () => {
    expect(isStale(packEntry(entry({ version: '2026.7.0' }), true), VERSION, NOW)).toBe(true);
  });

  it('drops a record older than the window it was fetched for', () => {
    const old = entry({ hours_to_show: 24, last_fetched: hoursAgo(25) });
    expect(isStale(packEntry(old, false), VERSION, NOW)).toBe(true);
  });

  it('keeps one fetched just inside its window', () => {
    const recent = entry({ hours_to_show: 24, last_fetched: hoursAgo(23) });
    expect(isStale(packEntry(recent, false), VERSION, NOW)).toBe(false);
  });

  it('a longer window keeps a record longer', () => {
    const long = entry({ hours_to_show: 336, last_fetched: hoursAgo(100) });
    const short = entry({ hours_to_show: 24, last_fetched: hoursAgo(100) });
    expect(isStale(packEntry(long, false), VERSION, NOW)).toBe(false);
    expect(isStale(packEntry(short, false), VERSION, NOW)).toBe(true);
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
