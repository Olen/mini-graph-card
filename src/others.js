/* eslint-disable import/prefer-default-export */

/**
 * The file contains functions which should be exposed for tests
 * and do not belong to other modules like "locale.js"
 */

import { log, getFirstDefinedItem } from './utils';
import {
  X,
  Y,
  V,
  ONE_HOUR,
  OVERALL_PREFIX,
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
  CARD_PADDING_COMPACT,
  MIN_GRAPH_HEIGHT,
  DEFAULT_GRAPH_HEIGHT,
  GRAPH_HEIGHT_AUTO,
  GRAPH_HEIGHT_PX,
  GRAPH_HEIGHT_PERCENT,
  GRID_INTERVALS,
  GRID_INTERVAL_THRESHOLDS,
  GRID_INTERVAL_FALLBACK,
  GRID_INTERVAL_HOURS,
  GRID_MIN_SPACING,
  GRID_LABEL_MODES,
  DEFAULT_GRID_LABEL_MODE,
  GRID_TARGET_LINES,
  GRID_FLAT_RELATIVE_RANGE,
  GRID_MAX_LINES,
  GRID_AXES,
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
  } else if ((validIndex && config.entities[index].y_axis === 'secondary')
    || index === -1) {
    // the secondary axis: its entities, and index -1 for its labels.
    // undefined falls back to 1 below
    value_factor = config.y_axis && config.y_axis.secondary
      && config.y_axis.secondary.value_factor;
  } else {
    value_factor = config.y_axis && config.y_axis.primary
      && config.y_axis.primary.value_factor;
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
 * Height of a card in pixels, for a given graph height. No default for that:
 * "config.height" is the height of the CARD, & taking it for a graph height
 * would count a whole card on top of the chrome.
 * @param {object} config A built config
 * @param {number} graphHeight A graph height to count with
 * @param {number} [padding] The padding a density spends between rows
 * @returns {number} Height in pixels
 */
const getCardHeight = (config, graphHeight, padding = CARD_PADDING) => {
  const show = config.show || {};
  // "ha-card" padding-top; each "ha-card > div" adds its own padding-bottom
  let height = padding;
  if (show.name || show.icon) {
    height += config.font_size_header * HEADER_HEIGHT_EM + padding;
  }
  if (show.state && !isStateInCorner(config.align_state)) {
    // a corner state is out of a flow & takes no height of its own
    height += (config.font_size_state !== undefined
      ? config.font_size_state * STATE_LINE_HEIGHT
      : config.font_size * STATE_HEIGHT_EM) + padding;
  }
  // Each row is as tall as its own font: the sizes are set per part of the
  // card, so a legend sized on its own must be counted on its own too.
  const legendFont = config.font_size_legend !== undefined
    ? config.font_size_legend : config.font_size;
  const extremaFont = config.font_size_extrema !== undefined
    ? config.font_size_extrema : config.font_size;

  if (show.graph) {
    // no CARD_PADDING here: unlike every other row, ".graph" has none
    // ("ha-card .graph { padding: 0 }"), & counting one made a card ask for
    // 16px more than it takes - so an "auto" graph, whose size is this height
    // minus the chrome, came out 16px short of the height that was asked for.
    height += graphHeight;
    if (show.legend && (config.entities || []).length > 1) {
      height += legendFont * LEGEND_HEIGHT_EM;
    }
  }
  if (show.extrema) {
    height += extremaFont * INFO_HEIGHT_EM + padding;
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
 * Parse "graph_height" into a mode & a number.
 * A graph is anchored to the bottom of a card, so the taller it is the more of
 * the card's own chrome it slides behind: "auto" stays below all of it, "100%"
 * covers everything.
 * @param {number|string|undefined} value As written in a config
 * @returns {{mode: string, value: (number|undefined)}} "auto"|"px"|"percent"
 */
const parseGraphHeight = (value) => {
  if (value === undefined || value === null || value === GRAPH_HEIGHT_AUTO)
    return { mode: GRAPH_HEIGHT_AUTO };
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0)
    return { mode: GRAPH_HEIGHT_PX, value };
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const percent = /^(\d+(?:\.\d+)?)\s*%$/.exec(trimmed);
    if (percent) return { mode: GRAPH_HEIGHT_PERCENT, value: Number(percent[1]) };
    if (isNumeric(trimmed, true) && Number(trimmed) >= 0)
      return { mode: GRAPH_HEIGHT_PX, value: Number(trimmed) };
  }
  const shown = typeof value === 'object' ? JSON.stringify(value) : value;
  log(`Invalid option graph_height: [${shown}] (expected a number, "<n>%" or "auto"); `
    + 'adjusting value to auto');
  return { mode: GRAPH_HEIGHT_AUTO };
};

/**
 * Height of a legend, which is drawn INSIDE the graph area rather than beside
 * it - so it counts towards what a card asks for, but not towards the space
 * left over for the graph.
 * @param {object} config A built config
 * @returns {number} Height in pixels
 */
const getLegendHeight = (config) => {
  const show = config.show || {};
  if (!show.graph || !show.legend || (config.entities || []).length <= 1) return 0;
  const font = config.font_size_legend !== undefined ? config.font_size_legend : config.font_size;
  return font * LEGEND_HEIGHT_EM;
};

/**
 * Height of everything a card draws apart from the graph.
 * @param {object} config A built config
 * @param {boolean} [compact] Count the compact padding instead
 * @returns {number} Height in pixels
 */
const getChromeHeight = (config, compact = false) => getCardHeight(
  config, 0, compact ? CARD_PADDING_COMPACT : CARD_PADDING,
) - getLegendHeight(config);

/**
 * The card height asked of HA. "height" is a desired CARD height; left unset,
 * a card asks for as much as it needs to show a default-sized graph.
 * @param {object} config A built config
 * @returns {number} Height in pixels
 */
const getDesiredCardHeight = config => (config.height !== undefined
  ? config.height
  : getCardHeight(config, DEFAULT_GRAPH_HEIGHT));

/**
 * "graph_height" resolved to pixels within a card of a given height.
 * @param {object} config A built config, with graph_height already parsed
 * @param {number} [cardHeight] Height of the card to resolve against
 * @returns {number} Height in pixels
 */
const getGraphHeightPx = (config, cardHeight = getDesiredCardHeight(config)) => {
  const { mode, value } = config.graph_height || { mode: GRAPH_HEIGHT_AUTO };
  if (mode === GRAPH_HEIGHT_PX) return value;
  if (mode === GRAPH_HEIGHT_PERCENT) return (cardHeight * value) / 100;
  // "auto": a graph is a row like any other & takes what the chrome leaves
  return cardHeight - getChromeHeight(config);
};

const logGrid = (option, field, value, fallback) => {
  const shown = typeof value === 'object' ? JSON.stringify(value) : value;
  log(`Invalid option ${option}.${field}: [${shown}]${fallback !== undefined ? `; using ${fallback}` : '; ignoring it'}`);
  return fallback;
};

/**
 * Parse "grid_x"/"grid_y". Like "statistics", "true" means "with all defaults".
 * @param {boolean|object|undefined} value As written in a config
 * @param {string} option "grid_x" or "grid_y", which decides the fields
 * @returns {object|undefined} Normalised options, or undefined when off
 */
const parseGrid = (value, option) => {
  if (!value) return undefined;
  const given = typeof value === 'object' ? value : {};
  const grid = {};

  if (option === 'grid_x') {
    grid.interval = given.interval === undefined || GRID_INTERVALS.includes(given.interval)
      ? (given.interval || 'auto')
      : logGrid(option, 'interval', given.interval, 'auto');
  } else {
    if (isNumeric(given.step, true) && Number(given.step) > 0) grid.step = Number(given.step);
    else if (given.step !== undefined) logGrid(option, 'step', given.step);
    grid.axis = given.axis === undefined || GRID_AXES.includes(given.axis)
      ? (given.axis || 'primary')
      : logGrid(option, 'axis', given.axis, 'primary');
  }

  // Both grids name their lines the same way: not at all, with the card, or
  // always. "show.labels: false" still switches the lot off.
  if (given.labels === false) grid.labels = false;
  else if (given.labels === true) grid.labels = 'always';
  else {
    grid.labels = given.labels === undefined || GRID_LABEL_MODES.includes(given.labels)
      ? (given.labels || DEFAULT_GRID_LABEL_MODE)
      : logGrid(option, 'labels', given.labels, DEFAULT_GRID_LABEL_MODE);
  }

  if (given.color !== undefined) grid.color = String(given.color);
  if (isNumeric(given.width, true) && Number(given.width) > 0) grid.width = Number(given.width);
  else if (given.width !== undefined) logGrid(option, 'width', given.width);
  // "minor: n" puts n lighter lines between each pair of full ones
  grid.minor = isNumeric(given.minor, true) && Number(given.minor) >= 0
    ? Math.floor(Number(given.minor))
    : (given.minor === undefined ? 0 : logGrid(option, 'minor', given.minor, 0));
  return grid;
};

/**
 * A default interval for a window, so a day of data is not covered in 288 of
 * them. Picked from a table rather than computed: every bound is a judgement.
 * A narrow graph then coarsens it further - thirteen lines are a grid on a wide
 * card & a smudge on a 100px one.
 * @param {number} hours An hours_to_show
 * @param {number} [width] Width the graph is drawn in, in pixels
 * @returns {string} An interval name
 */
const getGridInterval = (hours, width) => {
  const match = GRID_INTERVAL_THRESHOLDS.find(item => hours <= item.hours);
  let interval = match ? match.interval : GRID_INTERVAL_FALLBACK;
  if (!isNumeric(width) || width <= 0) return interval;

  const affordable = Math.max(1, Math.floor(width / GRID_MIN_SPACING));
  const coarser = GRID_INTERVALS.slice(GRID_INTERVALS.indexOf(interval));
  interval = coarser.find(name => hours / GRID_INTERVAL_HOURS[name] <= affordable)
    || GRID_INTERVALS[GRID_INTERVALS.length - 1];
  return interval;
};

/**
 * Round a timestamp DOWN to the start of its interval, in local time - which is
 * the point of the exercise: a "day" line belongs on midnight where the viewer
 * lives, not 24 hours before the right-hand edge. Date arithmetic rather than
 * fixed milliseconds, so a day is still a day across a DST change.
 */
const floorToInterval = (time, interval) => {
  const date = new Date(time);
  if (interval === 'month') {
    date.setDate(1); date.setHours(0, 0, 0, 0);
  } else if (interval === 'week') {
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - ((date.getDay() + 6) % 7)); // back to Monday
  } else if (interval === 'day') {
    date.setHours(0, 0, 0, 0);
  } else if (interval === '6hour') {
    date.setHours(date.getHours() - (date.getHours() % 6), 0, 0, 0);
  } else if (interval === 'hour') {
    date.setMinutes(0, 0, 0);
  } else {
    const step = interval === '15minute' ? 15 : 5;
    date.setMinutes(date.getMinutes() - (date.getMinutes() % step), 0, 0);
  }
  return date.getTime();
};

/** The start of the interval after the one holding "time". */
const nextInterval = (time, interval) => {
  const date = new Date(floorToInterval(time, interval));
  if (interval === 'month') date.setMonth(date.getMonth() + 1);
  else if (interval === 'week') date.setDate(date.getDate() + 7);
  else if (interval === 'day') date.setDate(date.getDate() + 1);
  else if (interval === '6hour') date.setHours(date.getHours() + 6);
  else if (interval === 'hour') date.setHours(date.getHours() + 1);
  else date.setMinutes(date.getMinutes() + (interval === '15minute' ? 15 : 5));
  return date.getTime();
};

/**
 * The moments a time grid draws a line at, oldest first.
 * @param {number} endTime Right-hand edge of the graph, in ms
 * @param {number} hours Width of the window
 * @param {object} [options] interval ("auto" unless given), minor, width in px
 * @returns {Array<{time: number, major: boolean}>} Lines within the window
 */
const getGridTimes = (endTime, hours, { interval, minor = 0, width } = {}) => {
  const name = !interval || interval === 'auto' ? getGridInterval(hours, width) : interval;
  const start = endTime - hours * ONE_HOUR;
  const lines = [];
  let time = floorToInterval(start, name);
  if (time < start) time = nextInterval(time, name);

  while (time <= endTime) {
    lines.push({ time, major: true });
    const next = nextInterval(time, name);
    for (let i = 1; i <= minor; i += 1) {
      // evenly through the interval, which is why this is not date arithmetic
      const between = time + ((next - time) * i) / (minor + 1);
      if (between > start && between <= endTime) lines.push({ time: between, major: false });
    }
    time = next;
  }
  return lines.sort((a, b) => a.time - b.time);
};

/**
 * A step which lands on round numbers - 1, 2 or 5 times a power of ten - so a
 * grid reads 20/25/30 rather than 17.3/21.6/25.9.
 */
const getNiceStep = (range, height) => {
  // A short graph has room for fewer lines than a tall one
  const target = isNumeric(height) && height > 0
    ? Math.max(2, Math.min(GRID_TARGET_LINES, Math.floor(height / GRID_MIN_SPACING)))
    : GRID_TARGET_LINES;
  const rough = range / target;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  return ([1, 2, 5, 10].find(factor => factor * magnitude >= rough) || 10) * magnitude;
};

/**
 * The values a value grid draws a line at.
 * @param {number} min Lower bound of the graph
 * @param {number} max Upper bound
 * @param {object} [options] step (a round one is chosen without it), minor,
 * logarithmic, height in px
 * @returns {Array<{value: number, major: boolean}>} Lines within the bounds
 */
const getGridValues = (min, max, {
  step, minor = 0, logarithmic = false, height,
} = {}) => {
  if (!isNumeric(min) || !isNumeric(max) || max <= min) return [];
  // A value that never changed can differ from itself by rounding noise
  // (2.8 vs 2.8000000000000003); a step that small cannot be added to the
  // values at all, so the loop below would never advance
  const magnitude = Math.max(Math.abs(min), Math.abs(max));
  if (max - min <= magnitude * GRID_FLAT_RELATIVE_RANGE) return [];
  const lines = [];

  if (logarithmic && step === undefined) {
    // A decade is the round number of a log scale
    for (let e = Math.ceil(Math.log10(Math.max(min, Number.MIN_VALUE)));
      10 ** e <= max; e += 1) {
      if (10 ** e >= min) lines.push({ value: 10 ** e, major: true });
    }
    return lines;
  }

  const size = step !== undefined ? step : getNiceStep(max - min, height);
  if (!(size > 0) || (max - min) / size > GRID_MAX_LINES) {
    log(`grid_y: a step of ${size} would draw more than ${GRID_MAX_LINES} lines between ${min} and ${max}; drawing none`);
    return [];
  }
  const first = Math.ceil(min / size) * size;
  for (let value = first; value <= max + size / 1e6; value += size) {
    // floating point: 0.1+0.2 must not become a line at 0.30000000000000004
    const rounded = Number(value.toPrecision(12));
    lines.push({ value: rounded, major: true });
    for (let i = 1; i <= minor; i += 1) {
      const between = Number((value + (size * i) / (minor + 1)).toPrecision(12));
      if (between > min && between < max) lines.push({ value: between, major: false });
    }
  }
  return lines.filter(line => line.value >= min && line.value <= max)
    .sort((a, b) => a.value - b.value);
};

/**
 * How many labels to skip between the ones shown, so they do not collide.
 * A label is wider than the line it names, so a grid which is comfortable can
 * still have labels which are not - especially on a narrow card.
 * @param {number} count How many labels there would be
 * @param {number} width Space they share, in pixels
 * @param {number} labelWidth Room one label needs, in pixels
 * @returns {number} Show every Nth label; 1 shows them all
 */
const getLabelStride = (count, width, labelWidth) => {
  if (!isNumeric(count) || count < 2 || !isNumeric(width) || width <= 0) return 1;
  const spacing = width / count;
  if (!isNumeric(labelWidth) || labelWidth <= 0 || spacing <= 0) return 1;
  return Math.max(1, Math.ceil(labelWidth / spacing));
};

/**
 * Grid options telling HA a desired & a minimal size of a card,
 * see https://developers.home-assistant.io/docs/frontend/custom-ui/custom-card/
 * @param {object} config A built config
 * @returns {object} Grid options
 */
const getGridOptions = (config) => {
  const rows = getGridRows(getDesiredCardHeight(config));
  const minRows = getGridRows(getCardHeight(
    config, config.show.graph ? MIN_GRAPH_HEIGHT : 0, CARD_PADDING_COMPACT,
  ));
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
 * In a card with both lines and bars: whether the hovered value is the
 * nearest point or the nearest bar. Over a bar, whichever value end is closer
 * to the cursor wins - the line's point or the bar's tip; between bars, the
 * line does.
 * @param {object|undefined} pointHit From findNearestPoint()
 * @param {object|undefined} barHit From findNearestBar()
 * @param {number} x A cursor coordinate in the graph's coordinates
 * @param {number} y A cursor coordinate in the graph's coordinates
 * @returns {string|undefined} "point", "bar", or undefined for neither
 */
const pickPointOrBar = (pointHit, barHit, x, y) => {
  if (!barHit) return pointHit ? 'point' : undefined;
  if (!pointHit) return 'bar';
  const { bar } = barHit;
  const overBar = x >= bar.x && x <= bar.x + bar.width;
  if (!overBar) return 'point';
  return Math.abs(bar.tip - y) < Math.abs(pointHit.point[Y] - y) ? 'bar' : 'point';
};

/**
 * The bar a cursor is pointing at, across all entities.
 *
 * Bars own a width, so X alone identifies one whenever they are drawn side by
 * side. Y only matters when they overlap ("bar_spacing: -1"), where the bar
 * whose value end (its tip: the top of a bar going up, the bottom of one
 * going down) is nearest the cursor wins.
 * @param {Array<Array>} barsPerEntity "bar" of the card, indexed by entity
 * @param {number} x A cursor coordinate in the graph's coordinates
 * @param {number} y A cursor coordinate in the graph's coordinates
 * @returns {{entity: number, index: number, bar: object}|undefined} The selection, if any
 */
const findNearestBar = (barsPerEntity, x, y) => {
  const candidates = [];
  barsPerEntity.forEach((bars, entity) => {
    if (!bars) return;
    bars.forEach((bar) => {
      // 0 while the cursor is within the bar's width
      const dx = Math.max(bar.x - x, x - (bar.x + bar.width), 0);
      candidates.push({
        entity, index: bar.index, bar, dx,
      });
    });
  });
  if (candidates.length === 0) return undefined;

  const nearest = Math.min(...candidates.map(candidate => candidate.dx));
  return candidates
    .filter(candidate => candidate.dx === nearest)
    .reduce((best, candidate) => (Math.abs(candidate.bar.tip - y) < Math.abs(best.bar.tip - y)
      ? candidate
      : best));
};

/**
 * Checks if animation is enabled for a specific entry in config.entities.
 * @param {object} config Config object
 * @param {number} index Index of an entry in config.entities
 * @returns {boolean} True if animated, false - otherwise
 */
const isEntryAnimated = (config, index) => {
  const entryConf = config.entities && config.entities[index];
  if (entryConf && entryConf.animate !== undefined && entryConf.animate !== null) {
    return entryConf.animate === true;
  }
  return config.animate === true;
};

/**
 * True for a name given as name items, e.g. [{type: 'area'}, {type: 'device'}]
 * @param {*} name Configured name
 * @returns {boolean} True for a list of name items or a single one
 */
const isNameItems = name => Array.isArray(name)
  || (name !== null && typeof name === 'object' && 'type' in name);

/**
 * The name HA's own cards show for an entity: hass.formatEntityName (HA 2025.10+),
 * else the friendly_name, else the entity id
 * @param {object} hass Home Assistant object
 * @param {object} stateObj State object of the entity
 * @param {string|object|object[]} [name] A plain name, or name items
 * @returns {string} Name to display
 */
const formatEntityName = (hass, stateObj, name) => {
  if (typeof name === 'string') return name;
  if (hass && typeof hass.formatEntityName === 'function') {
    return hass.formatEntityName(stateObj, isNameItems(name) ? name : undefined);
  }
  return stateObj.attributes.friendly_name || stateObj.entity_id;
};

// The parts of hass that formatEntityName composes a name from; a rename
// replaces one of them without touching any state.
const NAME_SOURCES = ['formatEntityName', 'entities', 'devices', 'areas', 'floors'];

/**
 * Whether a rename happened between two hass objects, so names need redrawing.
 * @param {object|undefined} oldHass The previous hass, undefined on the first set
 * @param {object} newHass The current hass
 * @returns {boolean} true when names may have changed
 */
const entityNamesChanged = (oldHass, newHass) => {
  if (!oldHass || !newHass) return false;
  return NAME_SOURCES.some(key => oldHass[key] !== newHass[key]);
};

/**
 * The min or max an axis is drawn to, from the series on it and the configured bound.
 * @param {string} type 'min' or 'max'
 * @param {Array} series Graphs on the axis, each with min & max
 * @param {number|string|undefined} configVal A fixed bound, '~n' for a soft one, or undefined
 * @param {number} fallback Used when the series give no number
 * @returns {number} The boundary
 */
const computeBoundary = (type, series, configVal, fallback) => {
  if (!(type in Math)) {
    throw new Error(`The type "${type}" is not present on the Math object`);
  }
  if (configVal === undefined) {
    // Math.min() of nothing is Infinity, so no series at all is handled first
    if (series.length === 0) return fallback;
    const computed = Math[type](...series.map(ele => ele[type]));
    // 0 is a real boundary; only a result that is no number falls back
    return isNumeric(computed) ? computed : fallback;
  }
  if (configVal[0] !== '~') {
    return configVal;
  }
  // soft boundary: widened by values outside it
  return Math[type](Number(configVal.substr(1)), ...series.map(ele => ele[type]));
};

/**
 * Whether an entity is drawn as bars rather than a line: its own `graph`,
 * else the card's show.graph.
 * @param {object} entityConfig The entity's entry in config.entities
 * @param {object} config Card config
 * @returns {boolean} True for bars
 */
const isBarEntity = (entityConfig, config) => (entityConfig.graph !== undefined
  ? entityConfig.graph === 'bar'
  : config.show.graph === 'bar');

/**
 * Whether a card draws opposing bars: one series per axis, one axis inverted,
 * and a fixed zero line, so one goes up and the other down. Such bars belong
 * in one column per period - side by side, half of each column would be
 * empty. With more series on an axis, they would cover each other there.
 * @param {object} config Card config, after buildConfig()'s checks
 * @returns {boolean} True for opposing bars
 */
const isOpposingBars = (config) => {
  const yAxis = config.y_axis || {};
  if (yAxis.zero_position === undefined) return false;
  const drawn = config.entities.filter(entity => entity.show_graph !== false);
  if (!drawn.every(entity => isBarEntity(entity, config))) return false;
  const onSecondary = drawn.filter(entity => entity.y_axis === 'secondary').length;
  if (drawn.length !== 2 || onSecondary !== 1) return false;
  const inverted = axis => !!yAxis[axis] && yAxis[axis].invert === true;
  return inverted('primary') !== inverted('secondary');
};

/**
 * An axis range widened to min_bound_range. A bound the user set stays put
 * and the range grows on the other side - so `lower_bound: ~0` alone keeps 0
 * at the bottom; a soft bound only moves when the other bound is set and
 * fixed. With no bounds, or both pinned alike, it grows equally both ways.
 * @param {number[]} boundary The axis's [min, max]
 * @param {number|string|undefined} lowerBound lower_bound as configured ("~" = soft)
 * @param {number|string|undefined} upperBound upper_bound as configured
 * @param {number|string|undefined} minRange min_bound_range
 * @returns {number[]} The [min, max] to draw
 */
const widenToMinRange = (boundary, lowerBound, upperBound, minRange) => {
  // NaN for a missing or invalid min_bound_range, which leaves the range alone
  const missing = parseFloat(minRange) - Math.abs(boundary[0] - boundary[1]);
  if (!(missing > 0)) return boundary;

  const isFixed = bound => bound !== undefined && String(bound)[0] !== '~';
  const lowerStays = isFixed(lowerBound) || upperBound === undefined;
  const upperStays = isFixed(upperBound) || lowerBound === undefined;
  if (lowerStays === upperStays) {
    return [boundary[0] - missing / 2, boundary[1] + missing / 2];
  }
  return lowerStays
    ? [boundary[0], boundary[1] + missing]
    : [boundary[0] - missing, boundary[1]];
};

/**
 * Whether both axes share one scale: y_axis.same_scale says so, or, unset,
 * for opposing graphs (a fixed zero line, one axis inverted) whose drawn
 * entities all have the same unit - one download/upload pair then compares
 * truthfully instead of each filling its own half.
 * @param {object} config Card config
 * @param {Array<string|undefined>} units Each entity's unit, indexed like config.entities
 * @returns {boolean} True when the axes share a scale
 */
const sharesScale = (config, units) => {
  const yAxis = config.y_axis || {};
  if (yAxis.same_scale !== undefined) return yAxis.same_scale === true;
  if (yAxis.zero_position === undefined) return false;
  const inverted = axis => !!yAxis[axis] && yAxis[axis].invert === true;
  if (inverted('primary') === inverted('secondary')) return false;
  const drawn = config.entities
    .map((entity, index) => ({ entity, unit: units[index] }))
    .filter(({ entity }) => entity.show_graph !== false);
  const onSecondary = drawn.filter(({ entity }) => entity.y_axis === 'secondary').length;
  if (onSecondary === 0 || onSecondary === drawn.length) return false;
  return drawn.every(({ unit }) => unit !== undefined && unit === drawn[0].unit);
};

/**
 * The range of two axes sharing one scale: wide enough for both.
 * @param {number[]} primary The primary axis's [min, max]
 * @param {number[]} secondary The secondary axis's [min, max]
 * @returns {number[]} The shared [min, max]
 */
const sharedBounds = (primary, secondary) => [
  Math.min(primary[0], secondary[0]),
  Math.max(primary[1], secondary[1]),
];

/**
 * An axis range widened so that 0 sits at `zeroPosition` of the graph's
 * height from the top. It only ever grows - every value still fits - by
 * moving the bound on the side that has too little room.
 * @param {number[]} bound The axis's [min, max]
 * @param {number} zeroPosition 0 (top) to 1 (bottom)
 * @param {boolean} inverted Whether the axis has its low values at the top
 * @returns {number[]} The new [min, max]
 */
const boundsForZeroPosition = (bound, zeroPosition, inverted) => {
  // 0 or 1 would need an infinite range on the other side
  const position = Math.min(Math.max(zeroPosition, 0.01), 0.99);
  // the share of the height above 0 belongs to max, or to min when inverted
  const maxShare = inverted ? 1 - position : position;
  const min = Math.min(bound[0], 0);
  const max = Math.max(bound[1], 0);
  if (min === 0 && max === 0) return bound;

  // keep max, and find the min that puts 0 in place; else keep min instead
  const minForMax = -max * (1 - maxShare) / maxShare;
  if (minForMax <= min) return [minForMax, max];
  return [min, -min * maxShare / (1 - maxShare)];
};

/**
 * Whether an axis shows one of its bound labels.
 * @param {string[]|undefined} labels The axis's checked y_axis.<axis>.labels; unset = max & min
 * @param {string} label "max", "min" or "zero"
 * @returns {boolean} True when it is shown
 */
const axisLabelShown = (labels, label) => {
  const shown = labels === undefined ? ['max', 'min'] : labels;
  return shown.includes(label) || shown.includes('all');
};

/**
 * Whether an axis gets a "0" label: when asked for, when 0 is inside its
 * range, and when it is not right next to a bound label that is shown -
 * that label then already sits at, or almost at, the zero line.
 * @param {string[]|undefined} labels The axis's checked y_axis.<axis>.labels
 * @param {number[]} bound The axis's [min, max]
 * @param {function} getY Pixel Y of a value on the axis
 * @param {number} minSpacing Pixels two labels need between them
 * @returns {boolean} True when the zero label is drawn
 */
const showsZeroLabel = (labels, bound, getY, minSpacing) => {
  const [min, max] = bound;
  if (!axisLabelShown(labels, 'zero') || min > 0 || max < 0) return false;
  const zeroY = getY(0);
  const tooClose = (value, label) => axisLabelShown(labels, label)
    && Math.abs(getY(value) - zeroY) < minSpacing;
  return !tooClose(min, 'min') && !tooClose(max, 'max');
};

/**
 * Whether a value is text rather than a number, like a motion sensor's "on".
 * A decimal comma still makes a number.
 * @param {*} value A state or value
 * @returns {boolean} True for a string that holds no number
 */
const isTextState = value => typeof value === 'string'
  && Number.isNaN(parseFloat(value.replace(/,/g, '.')));

/**
 * Whether show.state asks for one value for the whole period.
 * @param {*} showState The show.state option
 * @returns {boolean} True for "overall" and "overall_<func>"
 */
const isOverallState = showState => showState === 'overall'
  || (typeof showState === 'string' && showState.startsWith(OVERALL_PREFIX));

/**
 * The aggregate function an "overall" state uses: "overall" takes the graph's
 * own, "overall_<func>" names one.
 * @param {*} showState The show.state option, already checked
 * @param {string} aggregateFuncName The entity's aggregate_func
 * @returns {string|undefined} The function, or undefined when no overall value is shown
 */
const overallFuncName = (showState, aggregateFuncName) => {
  if (!isOverallState(showState)) return undefined;
  if (showState === 'overall') return aggregateFuncName;
  return showState.slice(OVERALL_PREFIX.length);
};

/**
 * The mean of a series over a time span, each reading weighted by how long it
 * held: until the next reading, or the span's end. A reading from before the
 * span counts from its start. A non-numeric reading (unavailable) holds no
 * value, so its time is left out.
 * @param {Array} readings [{last_changed, state}], in any order
 * @param {number} start Span start, in ms
 * @param {number} end Span end, in ms
 * @returns {number|undefined} The mean, or undefined when no value held for any time
 */
const timeWeightedAverage = (readings, start, end) => {
  const sorted = readings
    .map(item => ({ time: new Date(item.last_changed).getTime(), value: parseFloat(item.state) }))
    .sort((a, b) => a.time - b.time);
  let weighted = 0;
  let held = 0;
  sorted.forEach((reading, i) => {
    const from = Math.max(reading.time, start);
    const to = i + 1 < sorted.length ? Math.min(sorted[i + 1].time, end) : end;
    if (Number.isNaN(reading.value) || !(to > from)) return;
    weighted += reading.value * (to - from);
    held += to - from;
  });
  return held > 0 ? weighted / held : undefined;
};

/**
 * The value of the newest plotted bar or point, for "show: state: last".
 * @param {boolean} isBarGraph Whether the graph draws bars
 * @param {Array|undefined} bars The entity's bars
 * @param {Array|undefined} points The entity's points
 * @returns {number|undefined} The value, or undefined while nothing is plotted
 */
const lastPlottedValue = (isBarGraph, bars, points) => {
  if (isBarGraph) {
    return bars && bars.length ? bars[bars.length - 1].value : undefined;
  }
  return points && points.length ? points[points.length - 1][V] : undefined;
};

/**
 * The end of a graph's newest bucket: now, or the end of the bucket holding now.
 * The graph and the tooltip both use it, so their times agree.
 * @param {string} groupBy The group_by option
 * @param {Date} now The current time; not changed
 * @returns {Date} The end of the newest bucket
 */
const getIntervalEndDate = (groupBy, now) => {
  const end = new Date(now);
  switch (groupBy) {
    case 'month':
      end.setMonth(end.getMonth() + 1, 1);
      end.setHours(0, 0, 0, 0);
      break;
    case 'week':
      // weeks start on Monday; getDay() is 0 on Sunday
      end.setDate(end.getDate() + (end.getDay() === 0 ? 1 : 8 - end.getDay()));
      end.setHours(0, 0, 0, 0);
      break;
    case 'date':
      end.setDate(end.getDate() + 1);
      end.setHours(0, 0, 0, 0);
      break;
    case '12h':
      if (end.getHours() < 12) {
        end.setHours(12, 0, 0, 0);
      } else {
        end.setDate(end.getDate() + 1);
        end.setHours(0, 0, 0, 0);
      }
      break;
    case 'hour':
      end.setHours(end.getHours() + 1, 0, 0, 0);
      break;
    case '30min':
      end.setMinutes(Math.floor(end.getMinutes() / 30) * 30 + 30, 0, 0);
      break;
    case '15min':
      end.setMinutes(Math.floor(end.getMinutes() / 15) * 15 + 15, 0, 0);
      break;
    default:
      break;
  }
  return end;
};

// A static value has no entity for Home Assistant to take an icon from
const STATIC_VALUE_ICON = 'mdi:thermometer';

/**
 * The icon to hand to <ha-state-icon>: the configured one, else none for an
 * entity - Home Assistant resolves its own (device class, icon translations).
 * @param {string|undefined} configIcon The icon option
 * @param {object|undefined} stateObj The entity's state, undefined for a static value
 * @returns {string|undefined} An icon, or undefined to let Home Assistant choose
 */
const iconFor = (configIcon, stateObj) => {
  if (configIcon) return configIcon;
  if (stateObj) return undefined;
  return STATIC_VALUE_ICON;
};


/**
 * A value on a logarithmic scale; values below 1 sit at the bottom, as 0.
 * @param {number} value A value
 * @returns {number} Its base-10 logarithm, at least 0
 */
const getLog10 = value => Math.log10(Math.max(1, value));

/**
 * Whether an attribute option is a path into a nested object ("a.b.0").
 * @param {string} path An attribute name or a dotted path
 * @returns {boolean} true for a path
 */
const isObjectAttr = path => path.includes('.');

/**
 * A value from an object by a dotted path; array indexes are path parts too.
 * @param {object|undefined|null} obj An entity's attributes
 * @param {string} path An attribute name or a dotted path
 * @returns {any} The value, or undefined when any part of the path is missing
 */
const getObjectAttr = (obj, path) => path.split('.').reduce(
  (value, key) => (value === undefined || value === null ? undefined : value[key]),
  obj,
);

const NUMERIC_DOMAINS = ['counter', 'input_number', 'number'];

/**
 * Whether the card picker should suggest this card for an entity: a numeric
 * domain, or a sensor with a unit or a state class.
 * @param {object} hass Home Assistant object
 * @param {string} entityId An entity id
 * @returns {boolean} true when the entity has numbers to graph
 */
const isNumericEntity = (hass, entityId) => {
  const domain = entityId.split('.')[0];
  if (NUMERIC_DOMAINS.includes(domain)) return true;
  if (domain !== 'sensor') return false;
  const stateObj = hass.states[entityId];
  if (!stateObj) return false;
  return !!stateObj.attributes.unit_of_measurement || !!stateObj.attributes.state_class;
};

/**
 * Whether an entity's line is smoothed: its own setting, else the card's, else
 * on for everything but binary sensors and static values.
 * @param {object} entityConfig The entity's entry in config.entities
 * @param {object} config Card config
 * @returns {boolean} True if the line is smoothed
 */
const smoothingFor = (entityConfig, config) => {
  const { entity } = entityConfig;
  // A binary sensor's line is a staircase; curving its edges says nothing true.
  const byDomain = !!entity && !entity.startsWith('binary_sensor.');
  return getFirstDefinedItem(entityConfig.smoothing, config.smoothing, byDomain);
};

/**
 * Where an entity's bars & fill start: its own baseline, else the card's,
 * else 0 when y_axis.zero_position fixes where the zero line is.
 * @param {object} entityConfig The entity's entry in config.entities
 * @param {object} config Card config
 * @returns {number|undefined} The baseline, or undefined for the graph's edge
 */
const baselineFor = (entityConfig, config) => {
  const zeroIsFixed = !!config.y_axis && config.y_axis.zero_position !== undefined;
  return getFirstDefinedItem(entityConfig.baseline, config.baseline, zeroIsFixed ? 0 : undefined);
};

/**
 * The thinnest and thickest line drawn: each shown entity's line_width, else
 * the card's.
 * @param {object} config Card config
 * @returns {{min: number, max: number}} The range of line widths
 */
const getLineWidthRange = (config) => {
  const widths = config.entities
    .filter(entityConfig => entityConfig.show_graph !== false)
    .map(entityConfig => (isNumeric(entityConfig.line_width)
      ? entityConfig.line_width : config.line_width));
  if (widths.length === 0) {
    return { min: config.line_width, max: config.line_width };
  }
  return { min: Math.min(...widths), max: Math.max(...widths) };
};

export {
  widenToMinRange,
  sharesScale,
  sharedBounds,
  isBarEntity,
  pickPointOrBar,
  isOpposingBars,
  boundsForZeroPosition,
  axisLabelShown,
  showsZeroLabel,
  isTextState,
  isOverallState,
  overallFuncName,
  timeWeightedAverage,
  getLog10,
  isObjectAttr,
  getObjectAttr,
  isNumericEntity,
  smoothingFor,
  baselineFor,
  getLineWidthRange,
  STATIC_VALUE_ICON,
  iconFor,
  getIntervalEndDate,
  computeBoundary,
  lastPlottedValue,
  isNumeric,
  findNearestPoint,
  findNearestBar,
  getStatisticsType,
  isStateInCorner,
  getInfoHeight,
  getCardHeight,
  getChromeHeight,
  getLegendHeight,
  parseGraphHeight,
  getDesiredCardHeight,
  getGraphHeightPx,
  parseGrid,
  getGridInterval,
  getGridTimes,
  getGridValues,
  getLabelStride,
  getGridRows,
  getCardSizeUnits,
  getGridOptions,
  logStringWarning,
  getFactor,
  getBound,
  isEntryAnimated,
  formatEntityName,
  entityNamesChanged,
  isNameItems,
};
