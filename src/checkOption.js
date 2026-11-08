import {
  URL_DOCS,
  GROUP_BY_HOURS,
  AGGREGATE_FUNCS,
  OVERALL_PREFIX,
  STATISTICS_PERIODS,
  STATISTICS_TYPES,
} from './const';
import { log } from './utils';
import {
  isNumeric,
  logStringWarning,
  getBound,
  isEntryAnimated,
} from './others';

/**
 * Check if an option is numeric (if not undefined);
 * fallback to a default value if not numeric or out of bounds.
 * @param {object} config Config object
 * @param {string} option Name of option to be checked
 * @param {number} defaultValue Default fallback value
 * @param {object} [params={}] Optional parameters
 * @param {number} [params.minBound] Minimum allowed value
 * @param {number} [params.maxBound] Maximum allowed value
 * @param {boolean} [params.allowString=false] Allow string representations
 * of numbers (like "123")
 * @param {string} [params.logOptionName] Name to use in log output, when the
 * option sits under a nested key and `option` alone would not identify it
 * @returns {number} Cleared value
 */
const checkNumericOption = (
  config,
  option,
  defaultValue,
  params = {},
) => {
  const value = config[option];

  if (value === undefined || value === null) {
    return undefined;
  }

  const {
    minBound = undefined,
    maxBound = undefined,
    allowString = false,
    logOptionName = undefined,
  } = params;
  const displayOption = logOptionName || option;

  if (isNumeric(value, allowString)) {
    // log a warning in case of a string presentation of a number
    logStringWarning(value, displayOption);

    const valueNumeric = Number(value);
    const isMinValid = minBound === undefined || valueNumeric >= minBound;
    const isMaxValid = maxBound === undefined || valueNumeric <= maxBound;
    if (isMinValid && isMaxValid) {
      return valueNumeric; // return type 'number'
    }
  }

  const clearedValue = defaultValue;
  const invalidValue = typeof value === 'object'
    ? JSON.stringify(value)
    : value;
  let errorDescr = 'not a numeric value';
  if (isNumeric(value, allowString)) {
    const valueNumeric = Number(value);
    if (minBound !== undefined && valueNumeric < minBound) {
      errorDescr = `out of bounds, minimum allowed: ${minBound}`;
    } else if (maxBound !== undefined && valueNumeric > maxBound) {
      errorDescr = `out of bounds, maximum allowed: ${maxBound}`;
    }
  }
  log(`Invalid option ${displayOption}: [${invalidValue}] (${errorDescr}); adjusting value to ${clearedValue}`);
  return clearedValue;
};

/**
 * Check if an option is integer;
 * fallback to a default value if not numeric or out of bounds;
 * round to an integer if needed.
 * @param {object} config Config object
 * @param {string} option Name of option to be checked
 * @param {number} defaultValue Default fallback value
 * @param {object} [params={}] Optional parameters, as for checkNumericOption
 * @returns {number} Cleared value
 */
const checkIntegerOption = (
  config,
  option,
  defaultValue,
  params = {},
) => {
  const value = checkNumericOption(config, option, defaultValue, params);
  if (value !== undefined && !Number.isInteger(value)) {
    const roundedValue = Math.round(value) + 0; // prevent "-0" value
    const displayOption = params.logOptionName || option;
    log(`Invalid integer option ${displayOption}: [${value}]; rounding value to ${roundedValue}`);
    return roundedValue;
  }
  return value;
};

/**
 * Check that an option is one of the allowed values;
 * fallback to a default value otherwise.
 * @param {object} config Config object
 * @param {string} option Name of option to be checked
 * @param {Array<string>} allowed Allowed values
 * @param {string} defaultValue Default fallback value
 * @returns {string} Cleared value
 */
const checkStringOption = (config, option, allowed, defaultValue) => {
  const value = config[option];

  if (value === undefined || value === null) {
    return defaultValue;
  }
  if (allowed.includes(value)) {
    return value;
  }

  const invalidValue = typeof value === 'object' ? JSON.stringify(value) : value;
  log(`Invalid option ${option}: [${invalidValue}] (expected one of ${allowed.join(', ')}); adjusting value to ${defaultValue}`);
  return defaultValue;
};

/**
 * Check if a bound option is valid (accounting for an optional "~" prefix).
 * @param {object} config Config object
 * @param {string} option Name of the option to be checked
 * @returns {number|string|undefined} Cleared value in its original format, or undefined
 */
const checkBoundOption = (config, option, logOptionName) => {
  const value = config[option];

  if (value === undefined || value === null) {
    return undefined;
  }

  const displayOption = logOptionName || option;

  if (typeof value === 'number' || typeof value === 'string') {
    const parsed = getBound(value);
    if (parsed !== undefined && isNumeric(parsed.value)) {
      if (!parsed.soft && typeof value === 'string') {
        // check for a "string number" since this will not be cleared below
        // log a warning in case of a string presentation of a number
        logStringWarning(value, displayOption);
      }

      const cfg = { [option]: parsed.value };
      if (checkNumericOption(cfg, option, undefined, { logOptionName }) !== undefined) {
        return parsed.soft ? value : parsed.value;
      }
    }
  }

  // invalid type or value of the option
  const invalidValue = typeof value === 'object' ? JSON.stringify(value) : value;
  log(`Invalid option ${displayOption}: [${invalidValue}] (not a numeric value); adjusting value to undefined`);
  return undefined;
};

/**
 * Check both upper/lower bounds for valid values.
 * @param {object} config Config object
 * @param {string} [yAxis] Axis name, for log output
 * @returns {{
 *   lowerBound: string|number|undefined,
 *   upperBound: string|number|undefined
 * }} Cleared bounds
 */
const checkBounds = (config, yAxis) => {
  const prefix = yAxis ? `${yAxis}.` : '';
  const lowerBound = checkBoundOption(config, 'lower_bound', `${prefix}lower_bound`);
  // Both bounds accept a soft "~50" form, so both have to be parsed the same
  // way - comparing a raw "~50" against a cleaned number never fired.
  let upperBound = checkBoundOption(config, 'upper_bound', `${prefix}upper_bound`);

  if (lowerBound !== undefined && upperBound !== undefined) {
    const cleanLowerBound = getBound(lowerBound).value;
    const cleanUpperBound = getBound(upperBound).value;
    if (cleanUpperBound <= cleanLowerBound) {
      log(`Invalid ${prefix}lower & upper bounds: [${lowerBound}, ${upperBound}]; unsetting value of ${prefix}upper_bound to undefined`);
      upperBound = undefined;
    }
  }

  return { lowerBound, upperBound };
};

/* eslint-disable no-param-reassign */
/**
 * Check color_thresholds array.
 * @param {object} config Config object containing color_thresholds
 * @param {string} configName Name of a config object
 */
const checkColorThresholds = (config, configName) => {
  const thresholds = config.color_thresholds;

  if (thresholds === undefined || thresholds === null) {
    // color_thresholds not defined
    return;
  }

  if (!Array.isArray(thresholds)) {
    // color_thresholds not a list
    log(`Invalid option ${configName}.color_thresholds: expected a list; unsetting to []`);
    config.color_thresholds = [];
    return;
  }

  config.color_thresholds = thresholds
    .map((threshold, idx) => {
      if (typeof threshold === 'string') {
        return { color: threshold };
      }

      if (threshold && typeof threshold === 'object' && !Array.isArray(threshold)) {
        let { color, value } = threshold;

        if (color === undefined || typeof color !== 'string') {
          log(`Invalid option ${configName}.color_thresholds[${idx}]: "color" is missing or not a string; adjusting to "var(--primary-text-color)"`);
          color = 'var(--primary-text-color)';
        }

        if (value !== undefined && value !== null) {
          if (!isNumeric(value, true)) {
            log(`Invalid option ${configName}.color_thresholds[${idx}]: "value" is not a numeric value; unsetting to undefined`);
            value = undefined;
          } else {
            // log a warning in case of a string presentation of a number
            logStringWarning(value, `${configName}.color_thresholds[${idx}].value`);
            value = Number(value);
          }
        } else if (value === null) {
          log(`Invalid option ${configName}.color_thresholds[${idx}]: "value" is null, unsetting to undefined`);
          value = undefined;
        }

        const result = { color };
        if (value !== undefined) {
          result.value = value;
        }
        return result;
      }

      // other invalid content: a made-up colour band would be worse than none
      log(`Invalid option ${configName}.color_thresholds[${idx}]: expected an object or color string; ignoring the entry`);
      return null;
    })
    .filter(threshold => threshold !== null);
};
/* eslint-enable no-param-reassign */


/**
 * Check the `statistics` option (may be set per entity or card-wide);
 * `true` is a shorthand for the defaults.
 * @param {object} config Config object
 * @param {number} index Index of an entity
 */
/* eslint-disable no-param-reassign */
const checkStatistics = (config, index) => {
  const entity = config.entities[index];
  const stats = entity.statistics !== undefined ? entity.statistics : config.statistics;

  if (stats === undefined || stats === false) {
    delete entity.statistics;
    return;
  }

  // Statistics are numeric aggregates of a state: no attribute to read,
  // no non-numeric state to map. Fall back to a raw history.
  const incompatible = (entity.attribute !== undefined && 'attribute')
    || (Array.isArray(config.state_map) && config.state_map.length > 0 && 'state_map');
  if (incompatible) {
    log(`Option statistics of entities[${index}] is not compatible with ${incompatible}; ignoring statistics and reading raw history instead`);
    delete entity.statistics;
    return;
  }

  const opts = stats === true ? {} : stats;
  if (typeof opts !== 'object' || Array.isArray(opts))
    throw new Error(`"statistics" must be a boolean or an object.\n See ${URL_DOCS}`);

  // A typo warns & falls back, as every other option does. Throwing would
  // replace the whole card with a config error over one wrong letter, and the
  // fallbacks are both "work it out from the data" - see getStatisticsType().
  entity.statistics = { ...opts };
  if (opts.period !== undefined)
    entity.statistics.period = checkStringOption(opts, 'period', STATISTICS_PERIODS, undefined);
  if (opts.type !== undefined)
    entity.statistics.type = checkStringOption(opts, 'type', STATISTICS_TYPES, undefined);
  if (entity.statistics.period === undefined) delete entity.statistics.period;
  if (entity.statistics.type === undefined) delete entity.statistics.type;
};
/* eslint-enable no-param-reassign */

/**
 * Warn if line_style is defined along with animate=true.
 * @param {object} config Config object
 */
const checkLineStyle = (config) => {
  config.entities.forEach((entity, index) => {
    if (isEntryAnimated(config, index)) {
      const hasLineStyle = (entity.line_style !== undefined && entity.line_style !== null)
        || (config.line_style !== undefined && config.line_style !== null);
      if (hasLineStyle) {
        log(`Option 'line_style' will be ignored for entity[${index}] because animation is enabled for it`);
      }
    }
  });
};

const isNonEmptyString = value => typeof value === 'string' && value.trim() !== '';

/**
 * Checks that config.entities is a list whose every entry names an entity or a
 * numeric static_value; throws an error naming the first entry that does not.
 * @param {*} configEntities The entities option
 */
const checkEntities = (configEntities) => {
  if (!Array.isArray(configEntities)) {
    throw new Error(`Please provide the "entities" option as a list.\n See ${URL_DOCS}`);
  }
  configEntities.forEach((entityConfig, index) => {
    const isEntityId = isNonEmptyString(entityConfig);
    const hasEntity = entityConfig && isNonEmptyString(entityConfig.entity);
    // a number, not a numeric string: the card only draws a static_value that is one
    const hasStaticValue = entityConfig && isNumeric(entityConfig.static_value);
    if (!isEntityId && !hasEntity && !hasStaticValue) {
      throw new Error(`Invalid entities entry at index ${index}: `
        + `either "entity" or a numeric "static_value" must be specified.\n See ${URL_DOCS}`);
    }
  });
};

const isScalar = value => typeof value === 'string'
  || (typeof value === 'number' && Number.isFinite(value));

/* eslint-disable no-param-reassign */
/**
 * Normalizes config.state_map to a list of { value, label } with string values:
 * states are strings, so a numeric value would never match one.
 * @param {object} config Config object holding state_map; changed in place
 */
const checkStateMap = (config) => {
  const stateMap = config.state_map;
  if (!Array.isArray(stateMap)) {
    log('Invalid option state_map: expected a list; unsetting to []');
    config.state_map = [];
    return;
  }

  const entries = [];
  stateMap.forEach((entry, index) => {
    if (isScalar(entry)) {
      entries.push({ value: String(entry), label: String(entry) });
      return;
    }
    if (!entry || !isScalar(entry.value)) {
      log(`Invalid option state_map[${index}]: "value" is missing; ignoring the entry`);
      return;
    }
    const value = String(entry.value);
    let label = value;
    if (isScalar(entry.label) && entry.label !== '') {
      label = String(entry.label);
    } else if (entry.label !== undefined) {
      log(`Invalid option state_map[${index}]: "label" is not a string; using the value`);
    }
    entries.push({ value, label });
  });
  config.state_map = entries;
};
/* eslint-enable no-param-reassign */

/**
 * A group_by that fits hours_to_show: a fixed grouping needs a whole number of
 * its buckets in the window, or the graph falls back to "interval".
 * @param {object} config Config object
 * @returns {string} The group_by to use
 */
const checkGroupBy = (config) => {
  const { group_by: groupBy, hours_to_show: hoursToShow } = config;
  if (groupBy === undefined || groupBy === null || groupBy === 'interval') {
    return 'interval';
  }
  const bucketHours = GROUP_BY_HOURS[groupBy];
  if (bucketHours === undefined) {
    log(`Invalid group_by "${groupBy}", using "interval"; see ${URL_DOCS}`);
    return 'interval';
  }
  if (hoursToShow < bucketHours || hoursToShow % bucketHours !== 0) {
    log(`group_by "${groupBy}" needs hours_to_show to be a multiple of ${bucketHours}`
      + ` (it is ${hoursToShow}), using "interval"`);
    return 'interval';
  }
  return groupBy;
};

/**
 * show.state: true, false, "last", "overall" or "overall_<aggregate func>".
 * Anything else shows the current state, with a warning.
 * @param {*} state The show.state option
 * @returns {boolean|string} The value to use
 */
const checkShowState = (state) => {
  if ([true, false, 'last', 'overall'].includes(state)) return state;
  if (typeof state === 'string' && state.startsWith(OVERALL_PREFIX)
    && AGGREGATE_FUNCS.includes(state.slice(OVERALL_PREFIX.length))) {
    return state;
  }
  log(`Invalid show.state "${state}", showing the current state; see ${URL_DOCS}`);
  return true;
};

/**
 * The points_per_hour a group_by implies: one point per bucket. "interval"
 * keeps the configured value.
 * @param {object} config Config object, with group_by already checked
 * @returns {number} The points_per_hour to use
 */
const checkPointsPerHour = (config) => {
  const bucketHours = GROUP_BY_HOURS[config.group_by];
  if (bucketHours === undefined) return config.points_per_hour;
  return 1 / bucketHours;
};

export {
  checkShowState,
  checkEntities,
  checkGroupBy,
  checkPointsPerHour,
  checkStateMap,
  checkStatistics,
  checkStringOption,
  checkNumericOption,
  checkIntegerOption,
  checkBoundOption,
  checkBounds,
  checkColorThresholds,
  checkLineStyle,
};
