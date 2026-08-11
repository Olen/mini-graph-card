/* eslint-disable import/prefer-default-export */

/**
 * The file contains functions which should be exposed for tests
 * and do not belong to other modules like "locale.js"
 */

import { log } from './utils';
import {
  X,
  Y,
  STATISTICS_TYPES,
  DEFAULT_STATISTICS_TYPES,
  GRID_ROW_HEIGHT,
  GRID_ROW_GAP,
  MASONRY_SIZE_UNIT,
  HEADER_HEIGHT_EM,
  STATE_HEIGHT_EM,
  STATE_LINE_HEIGHT,
  LEGEND_HEIGHT_EM,
  INFO_HEIGHT_EM,
  CARD_PADDING,
  MIN_GRAPH_HEIGHT,
} from './const';

/**
  * Check if a value is a valid number
  * @param {any} value Value to be checked
  * @param {boolean} [allowString=false] Optional flag
  * to allow string representations of numbers (like "123")
  * @returns {boolean} True if value is a valid number, false - otherwise
  */
const isNumeric = (value, allowString = false) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return true;
  }
  if (allowString && typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') {
      // empty string
      return false;
    }
    // try to convert a string to a number
    const num = Number(trimmed);
    return Number.isFinite(num);
  }
  return false;
};

/**
 * Log a warning if a configuration numeric value is passed as a string.
 * @param {any} value Value to check
 * @param {string} option Name of the option for the log message
 */
const logStringWarning = (value, option) => {
  if (typeof value === 'string') {
    log(`Warning for option ${option}: [${value}] is configured as a string; please make it a number`);
  }
};

/**
  * Return a multiplying factor (exponental or scale) based on a "value_factor" option
  * @param {object} config Card config
  * @param {number} index Index of an entity in config.entities
  * @returns {number} Multiplying factor
  */
const getFactor = (config, index = undefined) => {
  if (!config) {
    // fallback to a default factor
    return 1;
  }

  let value_factor;
  const validIndex = typeof index === 'number'
    && index >= 0
    && Array.isArray(config.entities)
    && config.entities[index];

  if (validIndex && config.entities[index].value_factor !== undefined) {
    // provided a per-entity value_factor
    ({ value_factor } = config.entities[index]);
  } else if (validIndex && config.entities[index].y_axis === 'secondary') {
    // use value_factor_secondary for entities with 'y_axis: secondary'
    // if value_factor_secondary = undefined, then later it will fallback to 1
    value_factor = config.value_factor_secondary;
  } else if (index === -1) {
    // use value_factor_secondary for secondary Y-axis labels
    // if value_factor_secondary = undefined, then later it will fallback to 1
    value_factor = config.value_factor_secondary;
  } else {
    // use a global value_factor
    ({ value_factor } = config);
  }

  if (value_factor === undefined || value_factor === null) {
    // fallback to a default factor
    return 1;
  }

  const getExponent = factor => 10 ** factor;
  const logValueFactor = factor_obj => log(`invalid value_factor: [${JSON.stringify(factor_obj)}]`);

  if (typeof value_factor === 'object') {
    const { type, factor } = value_factor;
    if (type === undefined || factor === undefined
      || typeof type !== 'string' || !isNumeric(factor, true)) {
      // invalid options, fallback to a default factor
      logValueFactor(value_factor);
      return 1;
    }
    if (type === 'exponent' || type === 'scale') {
      // log a warning in case of a string presentation of a number
      logStringWarning(factor, 'factor');
      switch (type) {
        case 'exponent':
          return getExponent(Number(factor));
        default: // scale
          return Number(factor);
      }
    }
    // invalid 'type' option
    logValueFactor(value_factor);
    return 1;
  }

  if (isNumeric(value_factor, true)) {
    // log a warning in case of a string presentation of a number
    logStringWarning(value_factor, 'value_factor');
    // use a legacy "exponent" way
    return getExponent(Number(value_factor));
  }

  logValueFactor(value_factor);
  // fallback to a default factor
  return 1;
};

/**
  * Parse a bound value accounting for an optional "~" prefix.
  * @param {number|string} bound Bound with a possible "~" prefix
  * @returns {{value: number, soft: boolean}|undefined} Parsed value
  */
const getBound = (bound) => {
  if (bound === undefined || bound === null || typeof bound === 'object') {
    return undefined;
  }

  const strBound = String(bound).trim();
  if (strBound.startsWith('~')) {
    // soft bound
    const value = strBound.slice(1);
    if (isNumeric(value, true)) {
      return {
        value: Number(value),
        soft: true,
      };
    }
    return undefined;
  }

  // fixed bound
  if (isNumeric(strBound, true)) {
    return {
      value: Number(strBound),
      soft: false,
    };
  }
  return undefined;
};

/**
 * Pick a statistics type which is really present in buckets: available types
 * depend on a state_class, and an absent one is missing or null in every bucket.
 * A requested type is returned only if it is available; compare a result with
 * a requested type to see whether it was replaced.
 * @param {Array} stats Statistics buckets
 * @param {string} [requested] A type from a config
 * @returns {string|undefined} A type to use, or undefined if there are none
 */
const getStatisticsType = (stats, requested) => {
  const hasType = (item, type) => item && item[type] !== undefined && item[type] !== null;
  const available = Array.isArray(stats)
    ? STATISTICS_TYPES.filter(type => stats.some(item => hasType(item, type)))
    : [];
  if (requested !== undefined && available.includes(requested)) {
    return requested;
  }
  return DEFAULT_STATISTICS_TYPES.find(type => available.includes(type)) || available[0];
};

/**
 * Is a state pinned to a corner of a card (& thus out of a flow)?
 * @param {string} [alignState] An align_state option
 * @returns {boolean} True if a state takes no row of its own
 */
const isStateInCorner = alignState => typeof alignState === 'string'
  && (alignState.startsWith('top-') || alignState.startsWith('bottom-'));

/**
 * Height of the extrema row in pixels.
 * @param {object} config A built config
 * @returns {number} Height in pixels
 */
const getInfoHeight = config => config.font_size * INFO_HEIGHT_EM + CARD_PADDING;

/**
 * Height of a card in pixels, for a given graph height.
 * Used to tell HA which size a card would like to take.
 * @param {object} config A built config
 * @param {number} [graphHeight] A graph height to count with
 * @returns {number} Height in pixels
 */
const getCardHeight = (config, graphHeight = config.height) => {
  const show = config.show || {};
  // "ha-card" padding-top; each "ha-card > div" adds its own padding-bottom
  let height = CARD_PADDING;
  if (show.name || show.icon) {
    height += config.font_size_header * HEADER_HEIGHT_EM + CARD_PADDING;
  }
  if (show.state && !isStateInCorner(config.align_state)) {
    // a corner state is out of a flow & takes no height of its own
    height += (config.font_size_state !== undefined
      ? config.font_size_state * STATE_LINE_HEIGHT
      : config.font_size * STATE_HEIGHT_EM) + CARD_PADDING;
  }
  if (show.graph) {
    height += graphHeight + CARD_PADDING;
    if (show.legend && (config.entities || []).length > 1) {
      height += config.font_size * LEGEND_HEIGHT_EM;
    }
  }
  if (show.extrema) {
    height += getInfoHeight(config);
  }
  return height;
};

/**
 * Number of grid rows a height takes in a Sections view.
 * @param {number} height Height in pixels
 * @returns {number} Number of rows, at least 1
 */
const getGridRows = height => Math.max(
  1,
  Math.round((height + GRID_ROW_GAP) / (GRID_ROW_HEIGHT + GRID_ROW_GAP)),
);

/**
 * Number of masonry card size units a height takes.
 * @param {number} height Height in pixels
 * @returns {number} Number of units, at least 1
 */
const getCardSizeUnits = height => Math.max(1, Math.ceil(height / MASONRY_SIZE_UNIT));

/**
 * Grid options telling HA a desired & a minimal size of a card,
 * see https://developers.home-assistant.io/docs/frontend/custom-ui/custom-card/
 * @param {object} config A built config
 * @returns {object} Grid options
 */
const getGridOptions = (config) => {
  const rows = getGridRows(getCardHeight(config));
  const minRows = getGridRows(getCardHeight(config, config.show.graph ? MIN_GRAPH_HEIGHT : 0));
  return {
    rows,
    min_rows: Math.min(minRows, rows),
    columns: 12,
  };
};

/**
 * Index of the point lying closest to a given X, by a binary search.
 * Points are ordered by X (they are a time series), so a scan is not needed.
 * A tie is resolved towards the earlier point.
 * @param {Array} points Points of one entity, each being [x, y, value, bucket]
 * @param {number} x A coordinate to look up
 * @returns {number} Index in "points"
 */
const nearestPointIndex = (points, x) => {
  let low = 0;
  let high = points.length - 1;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (points[mid][X] < x) low = mid + 1;
    else high = mid;
  }
  const previous = low > 0 ? low - 1 : low;
  return Math.abs(points[previous][X] - x) <= Math.abs(points[low][X] - x) ? previous : low;
};

/**
 * Half of the gap to the neighbouring point on the side the cursor is on -
 * i.e. how far a point's "column" reaches towards the cursor. An edge point
 * borrows the gap from its only neighbour; a lone point owns the whole graph.
 * @param {Array} points Points of one entity
 * @param {number} index Index of the point in question
 * @param {number} x A cursor coordinate
 * @returns {number} A distance in the graph's coordinates
 */
const halfColumnWidth = (points, index, x) => {
  const before = index > 0 ? points[index][X] - points[index - 1][X] : undefined;
  const after = index < points.length - 1 ? points[index + 1][X] - points[index][X] : undefined;
  const towardsCursor = x < points[index][X] ? before : after;
  const gap = towardsCursor !== undefined ? towardsCursor : (before !== undefined ? before : after);
  return gap !== undefined ? gap / 2 : Infinity;
};

/**
 * The point a cursor is pointing at, across all entities.
 *
 * X selects the bucket & Y selects the entity: an entity is only considered if
 * the cursor is within the column of one of its points, so a series which does
 * not cover this part of the graph cannot win on Y alone. Should no series
 * cover the cursor (it is past the end of the data), the X-nearest point wins.
 * @param {Array<Array>} pointsPerEntity "points" of the card, indexed by entity
 * @param {number} x A cursor coordinate in the graph's coordinates
 * @param {number} y A cursor coordinate in the graph's coordinates
 * @returns {{entity: number, point: Array}|undefined} The selection, if any
 */
const findNearestPoint = (pointsPerEntity, x, y) => {
  const candidates = [];
  pointsPerEntity.forEach((points, entity) => {
    if (!points || points.length === 0) return;
    const index = nearestPointIndex(points, x);
    const point = points[index];
    candidates.push({
      entity,
      point,
      dx: Math.abs(point[X] - x),
      covers: Math.abs(point[X] - x) <= halfColumnWidth(points, index, x),
    });
  });
  if (candidates.length === 0) return undefined;

  const covering = candidates.filter(candidate => candidate.covers);
  const eligible = covering.length > 0 ? covering : candidates;
  return eligible.reduce((best, candidate) => {
    const distance = Math.abs(candidate.point[Y] - y);
    const bestDistance = Math.abs(best.point[Y] - y);
    if (distance !== bestDistance) return distance < bestDistance ? candidate : best;
    return candidate.dx < best.dx ? candidate : best;
  });
};

/**
 * The bar a cursor is pointing at, across all entities.
 *
 * Bars own a width, so X alone identifies one whenever they are drawn side by
 * side. Y only matters when they overlap ("bar_spacing: -1"), where the bar
 * whose top edge - its value - is nearest the cursor wins.
 * @param {Array<Array>} barsPerEntity "bar" of the card, indexed by entity
 * @param {number} x A cursor coordinate in the graph's coordinates
 * @param {number} y A cursor coordinate in the graph's coordinates
 * @returns {{entity: number, index: number, bar: object}|undefined} The selection, if any
 */
const findNearestBar = (barsPerEntity, x, y) => {
  const candidates = [];
  barsPerEntity.forEach((bars, entity) => {
    if (!bars) return;
    bars.forEach((bar, index) => {
      // 0 while the cursor is within the bar's width
      const dx = Math.max(bar.x - x, x - (bar.x + bar.width), 0);
      candidates.push({
        entity, index, bar, dx,
      });
    });
  });
  if (candidates.length === 0) return undefined;

  const nearest = Math.min(...candidates.map(candidate => candidate.dx));
  return candidates
    .filter(candidate => candidate.dx === nearest)
    .reduce((best, candidate) => (Math.abs(candidate.bar.y - y) < Math.abs(best.bar.y - y)
      ? candidate
      : best));
};

export {
  isNumeric,
  findNearestPoint,
  findNearestBar,
  getStatisticsType,
  isStateInCorner,
  getInfoHeight,
  getCardHeight,
  getGridRows,
  getCardSizeUnits,
  getGridOptions,
  logStringWarning,
  getFactor,
  getBound,
};
