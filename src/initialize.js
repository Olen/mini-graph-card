/* eslint-disable no-console */
import localForage from 'localforage/src/localforage';
import { isStale } from './cache';
import { version } from '../package.json';

localForage.config({
  name: 'mini-graph-card',
  version: 1.0,
  storeName: 'entity_history_cache',
  description: 'Mini graph card uses caching for the entity history',
});

/**
 * Drop records this version of the card cannot use.
 *
 * A record carries its metadata unencoded, so deciding costs a field read -
 * this used to decompress every payload to look at two numbers.
 */
const purge = () => localForage.iterate((record, key) => {
  if (isStale(record, version)) {
    localForage.removeItem(key);
  }
  // returning anything but undefined stops localForage's iteration
}).catch((err) => {
  console.warn('Purging has errored: ', err);
});

/**
 * This module runs on every dashboard, because the card is a global Lovelace
 * resource - including dashboards with no graph on them. Nothing is waiting on
 * the purge, so it waits for the browser to be idle rather than competing with
 * the first render. See upstream #1392.
 */
if (window.requestIdleCallback) {
  window.requestIdleCallback(purge, { timeout: 10000 });
} else {
  window.setTimeout(purge, 1000);
}

console.info(
  `%c MINI-GRAPH-CARD %c ${version} `,
  'color: white; background: coral; font-weight: 700;',
  'color: coral; background: white; font-weight: 700;',
);
