/* eslint-disable import/prefer-default-export */

/**
 * The file contains functions which should be exposed for tests
 * and do not belong to other modules like "locale.js"
 */

import { log } from './utils';
import {
  X,
  Y,
  ONE_HOUR,
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

export {
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
};
