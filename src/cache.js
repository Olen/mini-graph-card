import { isNumeric } from './others';

/**
 * The history cache.
 *
 * One record per (entity, position in the card, hash of the card config). It
 * holds the rows the recorder returned, so the next load can ask only for what
 * has happened since `last_fetched` instead of the whole window again. On a
 * chatty entity that is the difference between 384ms and 6ms; on a quiet one it
 * saves almost nothing, which is why the cache is worth keeping but not worth
 * trusting indefinitely.
 *
 * Nothing is compressed. It was never actually switched on - the code read a
 * `useCompress` option that nothing ever assigned - and measuring it settled
 * the question: compressing a 16k-row payload costs ~110ms of the main thread
 * on every save, against ~8ms to hand the same payload to the purge uncompressed.
 * The metadata sits beside the payload so the purge can decide about a record
 * without reading it.
 */

// A cached window is refetched whole once it is this old, so nothing can be
// carried forward for ever. Bound by the window itself - a 1-hour graph
// revalidates hourly, on a window that is cheap by definition - but capped,
// because "once per 14 days" is not an invalidation.
const MAX_CACHE_AGE_HOURS = 24;

const hoursToMs = hours => hours * 3600000;

/**
 * Wrap an entry for storage.
 * @param {object} entry {version, hours_to_show, first_fetched, last_fetched, data}
 * @returns {object} The stored record
 */
const packEntry = entry => ({
  version: entry.version,
  hours_to_show: entry.hours_to_show,
  first_fetched: entry.first_fetched,
  last_fetched: entry.last_fetched,
  data: entry.data,
});

/**
 * Unwrap a stored record.
 * @param {object} record A record from storage
 * @returns {object|null} The entry, or null when there is nothing stored
 */
const unpackEntry = record => (record ? { ...record } : null);

/**
 * Is a record worth keeping? Written by another version of the card, or older
 * than the window it was fetched for, and it can go. Anything that does not
 * look like a record goes too - damaged, or written by a version that stored a
 * different shape.
 *
 * This is housekeeping, not a safety net: `last_fetched` moves on every save,
 * so a card being looked at never ages out here. Whether its contents can still
 * be trusted is `isUsable`'s question.
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

/**
 * May a cached entry be appended to, or must the window be fetched again?
 *
 * The cache is appended to and never re-read, so anything wrong in it stays
 * wrong: a recorder that was purged, restored or corrected, a row written
 * against a clock that has since moved. Rather than guess at the cause - the
 * reports upstream span a decade and several mechanisms - every entry is simply
 * refetched whole once it is old enough, and two impossibilities are checked
 * for on the way in.
 *
 * @param {object} entry An unpacked entry
 * @param {number} hoursToShow The window the card wants now
 * @param {Date} entityLastUpdated The entity's own last_updated, from hass
 * @param {Date} now Reference time, for tests
 * @returns {boolean} True when the cached rows may be used
 */
const isUsable = (entry, hoursToShow, entityLastUpdated, now = new Date()) => {
  if (!entry || !entry.data || entry.hours_to_show !== hoursToShow) return false;

  const firstFetched = new Date(entry.first_fetched || entry.last_fetched);
  const lastFetched = new Date(entry.last_fetched);
  if (Number.isNaN(firstFetched.getTime()) || Number.isNaN(lastFetched.getTime())) return false;

  // Written by a clock ahead of this one. Left alone it moves the next fetch's
  // start past its end, so nothing new is ever asked for & the graph freezes at
  // whatever it holds - the "flat line that a config change fixes".
  if (lastFetched > now) return false;

  // The whole window is due again.
  const maxAge = hoursToMs(Math.min(hoursToShow, MAX_CACHE_AGE_HOURS));
  if (now - firstFetched > maxAge) return false;

  // A row newer than the entity's own last update cannot have come from it.
  if (entityLastUpdated && entry.data.length) {
    const newest = entry.data[entry.data.length - 1];
    const newestTime = new Date(newest.last_changed || newest.last_updated);
    if (newestTime > new Date(entityLastUpdated)) return false;
  }

  return true;
};

export {
  packEntry, unpackEntry, isStale, isUsable, MAX_CACHE_AGE_HOURS,
};
