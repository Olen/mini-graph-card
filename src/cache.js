import { compress, decompress } from './utils';
import { isNumeric } from './others';

/**
 * The history cache.
 *
 * One record per (entity, position in the card, hash of the card config). It
 * holds the rows the recorder returned, so the next load can ask only for what
 * has happened since `last_fetched` instead of the whole window again.
 *
 * The metadata is stored unencoded, next to the payload rather than inside it,
 * so that the purge on startup can decide about a record without decompressing
 * it. That is the whole point of the shape: the purge runs on every dashboard,
 * for every record, whether or not a card is on screen.
 */

/**
 * Wrap an entry for storage.
 * @param {object} entry {version, hours_to_show, last_fetched, data}
 * @param {boolean} compressed Compress the payload
 * @returns {object} The stored record
 */
const packEntry = (entry, compressed) => ({
  version: entry.version,
  hours_to_show: entry.hours_to_show,
  last_fetched: entry.last_fetched,
  compressed: !!compressed,
  data: compressed ? compress(entry.data) : entry.data,
});

/**
 * Unwrap a stored record. Whether the payload was compressed is recorded in the
 * record itself - it used to be a suffix on the key, which meant two ways of
 * saying the same thing and two places to get it wrong.
 * @param {object} record A record from storage
 * @returns {object|null} {version, hours_to_show, last_fetched, data}
 */
const unpackEntry = (record) => {
  if (!record) return null;
  return {
    version: record.version,
    hours_to_show: record.hours_to_show,
    last_fetched: record.last_fetched,
    data: record.compressed ? decompress(record.data) : record.data,
  };
};

/**
 * Is a record worth keeping? Written from another version of the card, or older
 * than the window it was fetched for, and it can go. Anything that does not
 * look like a record at all goes too: it is either damaged or was written by a
 * version that stored a different shape.
 * @param {object} record A record from storage
 * @param {string} version The running version of the card
 * @param {Date} now Reference time, for tests
 * @returns {boolean} True when the record should be removed
 */
const isStale = (record, version, now = new Date()) => {
  if (!record || record.version !== version) return true;
  if (!isNumeric(record.hours_to_show) || !record.last_fetched) return true;

  const start = new Date(now);
  start.setHours(start.getHours() - Number(record.hours_to_show));
  return new Date(record.last_fetched) < start;
};

export { packEntry, unpackEntry, isStale };
