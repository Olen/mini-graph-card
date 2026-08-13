import {
  URL_DOCS,
  MAX_BARS,
  DEFAULT_FONT_SIZE,
  DEFAULT_FONT_SIZE_HEADER,
  ALIGN_STATE,
  DEFAULT_ALIGN_STATE,
  ALIGN_ICON,
  ALIGN_HEADER,
  HOVER_MODES,
  DEFAULT_HOVER_MODE,
  DENSITIES,
  DEFAULT_DENSITY,
  DEFAULT_BAR_SPACING,
  DEFAULT_MARGIN,
  DEFAULT_HOURS_TO_SHOW,
  DEFAULT_POINTS_PER_HOUR,
  DEFAULT_STATIC_VALUE_LABEL_OFFSET,
  DEFAULT_COLORS,
  DEFAULT_SHOW,
} from './const';
import { log } from './utils';
import {
  checkNumericOption,
  checkIntegerOption,
  checkBounds,
  checkColorThresholds,
  checkStatistics,
  checkStringOption,
} from './checkOption';
import { getFactor, parseGraphHeight, parseGrid } from './others';

/**
 * Starting from the given index, increment the index until an array element with a
 * "value" property is found
 *
 * @param {Array} stops
 * @param {number} startIndex
 * @returns {number}
 */
const findFirstValuedIndex = (stops, startIndex) => {
  for (let i = startIndex; i < stops.length; i += 1) {
    if (stops[i].value != null) {
      return i;
    }
  }
  throw new Error(
    'Error in threshold interpolation: could not find right-nearest valued stop. '
    + 'Do the first and last thresholds have a set "value"?',
  );
};

/**
 * Interpolates the "value" of each stop. Each stop can be a color string or an object of type
 * ```
 * {
 *   color: string
 *   value?: number | null
 * }
 * ```
 * And the values will be interpolated by the nearest valued stops.
 *
 * For example, given values `[ 0, null, null, 4, null, 3]`,
 * the interpolation will output `[ 0, 1.3333, 2.6667, 4, 3.5, 3 ]`
 *
 * Note that values will be interpolated ascending and descending.
 * All that's necessary is that the first and the last elements have values.
 *
 * @param {Array} stops
 * @returns {Array<{ color: string, value: number }>}
 */
const interpolateStops = (stops) => {
  if (!stops || !stops.length) {
    return stops;
  }
  if (stops[0].value == null || stops[stops.length - 1].value == null) {
    throw new Error(`The first and last thresholds must have a set "value".\n See ${URL_DOCS}`);
  }

  let leftValuedIndex = 0;
  let rightValuedIndex = null;

  return stops.map((stop, stopIndex) => {
    if (stop.value != null) {
      leftValuedIndex = stopIndex;
      return { ...stop };
    }

    if (rightValuedIndex == null || stopIndex > rightValuedIndex) {
      rightValuedIndex = findFirstValuedIndex(stops, stopIndex);
    }

    // y = mx + b
    // m = dY/dX
    // x = index in question
    // b = left value

    const leftValue = stops[leftValuedIndex].value;
    const rightValue = stops[rightValuedIndex].value;
    const m = (rightValue - leftValue) / (rightValuedIndex - leftValuedIndex);
    return {
      color: typeof stop === 'string' ? stop : stop.color,
      value: m * (stopIndex - leftValuedIndex) + leftValue,
    };
  });
};

/**
 * Process color_thresholds array: first reverse it,
 * then either return it "as is" (if type = smooth)
 * or augment it with additional stops to prevent an unneeded color transition (if type = hard)
 * @param {Array<{ color: string, value: number }>} stops Initial color_thresholds array
 * @param {string} type Type of color thresholds transition
 * @returns {Array<{ color: string, value: number }>} Processed color_thresholds array
 */
const computeThresholds = (stops, type) => {
  const valuedStops = interpolateStops(stops);
  valuedStops.sort((a, b) => b.value - a.value);

  if (type === 'smooth') {
    return valuedStops;
  } else {
    const rect = [].concat(...valuedStops.map((stop, i) => {
      const nextStop = valuedStops[i + 1];
      const delta = nextStop
        ? Math.abs(stop.value - nextStop.value) * 0.0001
        : Math.abs(stop.value) * 0.0001 || 0.0001;
      return [
        stop,
        {
          value: stop.value - delta,
          color: nextStop ? nextStop.color : stop.color,
        },
      ];
    }));
    return rect;
  }
};

export default (config) => {
  if (!Array.isArray(config.entities))
    throw new Error(`Please provide the "entities" option as a list.\n See ${URL_DOCS}`);
  if (config.line_color_above || config.line_color_below)
    throw new Error(
      `"line_color_above/line_color_below" was removed, please use "color_thresholds".\n See ${URL_DOCS}`,
    );

  const conf = {
    animate: false,
    font_size: DEFAULT_FONT_SIZE,
    font_size_header: DEFAULT_FONT_SIZE_HEADER,
    hours_to_show: DEFAULT_HOURS_TO_SHOW,
    points_per_hour: DEFAULT_POINTS_PER_HOUR,
    aggregate_func: 'avg',
    group_by: 'interval',
    line_color: [...DEFAULT_COLORS],
    color_thresholds: [],
    color_thresholds_transition: 'smooth',
    line_width: DEFAULT_MARGIN,
    bar_spacing: DEFAULT_BAR_SPACING,
    compress: true,
    smoothing: true,
    state_map: [],
    cache: true,
    tap_action: {
      action: 'more-info',
    },
    // A touch screen has no hover, so a tap on the graph reads a value there
    // rather than acting - which leaves hold as the way to act. See README.
    hold_action: {
      action: 'more-info',
    },
    ...JSON.parse(JSON.stringify(config)),
    show: { ...DEFAULT_SHOW, ...config.show },
  };

  // check numeric options for validity
  conf.font_size = checkNumericOption(conf, 'font_size', 100, 0.1, undefined, true);
  conf.font_size_header = checkNumericOption(conf, 'font_size_header', DEFAULT_FONT_SIZE_HEADER, 0.1, undefined, true);
  conf.font_size_state = checkNumericOption(conf, 'font_size_state', undefined, 0.1, undefined, true);

  conf.align_state = checkStringOption(conf, 'align_state', ALIGN_STATE, DEFAULT_ALIGN_STATE);
  // Without a default the icon rendered with loc="undefined", matching neither
  // .icon[loc="left"] nor .icon[loc="right"] - so it was never pushed anywhere.
  // Left undefined on purpose: renderHeader() then places the icon opposite
  // the name instead of always on the right. A default here would make that
  // branch unreachable & the option would silently do nothing.
  conf.align_icon = checkStringOption(conf, 'align_icon', ALIGN_ICON, undefined);
  conf.align_header = checkStringOption(conf, 'align_header', ALIGN_HEADER, undefined);

  conf.hover_mode = checkStringOption(conf, 'hover_mode', HOVER_MODES, DEFAULT_HOVER_MODE);
  conf.density = checkStringOption(conf, 'density', DENSITIES, DEFAULT_DENSITY);

  // Each part of a card can be sized on its own; unset, it keeps the size it
  // has always had relative to font_size.
  ['font_size_secondary', 'font_size_legend', 'font_size_extrema', 'font_size_labels']
    .forEach((option) => {
      conf[option] = checkNumericOption(conf, option, undefined, 0.1, undefined, true);
    });

  // "tap_action: more-info" is the natural thing to write & handleClick reads
  // actionConfig.action, so a bare string silently did nothing at all.
  ['tap_action', 'hold_action'].forEach((option) => {
    if (typeof conf[option] === 'string') conf[option] = { action: conf[option] };
  });

  conf.bar_spacing = checkNumericOption(conf, 'bar_spacing', DEFAULT_BAR_SPACING, -1, undefined, true);
  conf.bar_spacing_group = checkNumericOption(conf, 'bar_spacing_group', undefined, 0, undefined, true);

  // A desired CARD height. Left unset, getDesiredCardHeight() asks for as much
  // as the chrome needs plus a default-sized graph - i.e. what a card took before.
  conf.height = checkNumericOption(conf, 'height', undefined, 0, undefined, true);
  conf.graph_height = parseGraphHeight(conf.graph_height);
  conf.grid_x = parseGrid(conf.grid_x, 'grid_x');
  conf.grid_y = parseGrid(conf.grid_y, 'grid_y');

  conf.line_width = checkNumericOption(conf, 'line_width', DEFAULT_MARGIN, 0, undefined, true);

  conf.hours_to_show = checkNumericOption(conf, 'hours_to_show', DEFAULT_HOURS_TO_SHOW, 0.01, undefined, true);
  conf.points_per_hour = checkNumericOption(conf, 'points_per_hour', DEFAULT_POINTS_PER_HOUR, 0.001, undefined, true);
  conf.update_interval = checkNumericOption(conf, 'update_interval', undefined, 0, undefined, true);

  ({ lowerBound: conf.lower_bound, upperBound: conf.upper_bound } = checkBounds(conf));

  conf.min_bound_range = checkNumericOption(conf, 'min_bound_range', undefined, 0, undefined, true);
  conf.min_bound_range_secondary = checkNumericOption(conf, 'min_bound_range_secondary', undefined, 0, undefined, true);

  conf.decimals_primary_labels = checkIntegerOption(conf, 'decimals_primary_labels', undefined, 0, undefined, true);
  conf.decimals_secondary_labels = checkIntegerOption(conf, 'decimals_secondary_labels', undefined, 0, undefined, true);
  conf.decimals = checkIntegerOption(conf, 'decimals', undefined, 0, undefined, true);

  conf.static_value_label_offset = checkNumericOption(
    conf,
    'static_value_label_offset',
    DEFAULT_STATIC_VALUE_LABEL_OFFSET,
    0,
    100,
    true,
  );
  if (conf.static_value_label_offset === undefined
    || conf.static_value_label_offset === null) {
    conf.static_value_label_offset = DEFAULT_STATIC_VALUE_LABEL_OFFSET;
  }

  conf.fill_baseline = checkNumericOption(conf, 'fill_baseline', undefined, undefined, undefined, true);

  // process per-entity configs
  /* eslint-disable no-param-reassign */
  conf.entities.forEach((entity, i) => {
    if (typeof entity === 'string') {
      conf.entities[i] = { entity };
    } else {
      // check numeric per-entity options for validity
      entity.line_width = checkNumericOption(entity, 'line_width', conf.line_width, 0, undefined, true);
      entity.decimals = checkIntegerOption(entity, 'decimals', conf.decimals, 0, undefined, true);
      entity.fill_baseline = checkNumericOption(entity, 'fill_baseline', undefined, undefined, undefined, true);

      if (entity.color_thresholds) {
        // check color_thresholds
        checkColorThresholds(entity, `entities[${i}]`);
        // eslint-disable-next-line no-param-reassign
        entity.color_thresholds = computeThresholds(
          entity.color_thresholds,
          entity.color_thresholds_transition || conf.color_thresholds_transition,
        );
      }
    }
    // `statistics` may be set per entity or card-wide, and accepts a bare
    // `true` as shorthand for the defaults.
    checkStatistics(conf, i);
  });
  /* eslint-enable no-param-reassign */

  // prepare predefined factors
  const entityFactors = conf.entities.map((_, index) => getFactor(conf, index));
  const axisFactors = {
    primary: getFactor(conf),
    secondary: getFactor(conf, -1),
  };

  conf.state_map.forEach((state, i) => {
    // convert string values to objects
    if (typeof state === 'string') conf.state_map[i] = { value: state, label: state };
    // make sure label is set
    conf.state_map[i].label = conf.state_map[i].label || conf.state_map[i].value;
  });

  if (typeof config.line_color === 'string')
    conf.line_color = [config.line_color, ...DEFAULT_COLORS];

  conf.font_size = (config.font_size / 100) * DEFAULT_FONT_SIZE || DEFAULT_FONT_SIZE;

  // check color_thresholds
  checkColorThresholds(conf, 'config');
  conf.color_thresholds = computeThresholds(
    conf.color_thresholds,
    conf.color_thresholds_transition,
  );

  // set valid values for bar_spacing options
  conf.bar_spacing = conf.bar_spacing < 0
    ? -1 : conf.bar_spacing; // "-1" stands for stacked bars
  conf.bar_spacing_group = conf.bar_spacing_group !== undefined
    ? conf.bar_spacing_group
    : conf.bar_spacing < 0
      ? DEFAULT_BAR_SPACING : conf.bar_spacing;

  // override points per hour to mach group_by function
  switch (conf.group_by) {
    case 'date':
      conf.points_per_hour = 1 / 24;
      break;
    case 'hour':
      conf.points_per_hour = 1;
      break;
    default:
      break;
  }

  if (conf.show.graph === 'bar') {
    const entities = conf.entities.length;
    if (conf.hours_to_show * conf.points_per_hour * entities > MAX_BARS) {
      conf.points_per_hour = MAX_BARS / (conf.hours_to_show * entities);
      log(`Not enough space, adjusting points_per_hour to ${conf.points_per_hour}`);
    }
  }

  return {
    config: conf,
    entityFactors,
    axisFactors,
  };
};
