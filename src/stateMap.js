/**
 * state_map: labels for states, set for the card or per entity.
 *
 * A checked map is { strict, map: [entry] }. A strict map (the default) draws
 * each state as its position in the map, so text states can be plotted. A
 * relaxed one (keep_values: true) keeps a numeric entity's values and only
 * relabels the ones an entry matches: its value within a tolerance, or a
 * [min, max) range.
 */

import { log } from './utils';

const isScalar = value => typeof value === 'string'
  || (typeof value === 'number' && Number.isFinite(value));

const isNumber = value => isScalar(value) && value !== '' && Number.isFinite(Number(value));

const RANGE_LABEL = '${min} .. ${max}'; // eslint-disable-line no-template-curly-in-string

const checkLabel = (label, where) => {
  if (label === undefined) return undefined;
  if (isScalar(label) && label !== '') return String(label);
  log(`Invalid option ${where}.label: expected a string; ignoring it`);
  return undefined;
};

const checkStrictEntry = (entry, where, label, hideUnit) => {
  if (!isScalar(entry.value)) {
    log(`Invalid option ${where}: "value" is missing; ignoring the entry`);
    return undefined;
  }
  if (['tolerance', 'min', 'max'].some(key => entry[key] !== undefined)) {
    log(`Option ${where}: tolerance, min and max need keep_values: true; ignoring them`);
  }
  const value = String(entry.value);
  return { value, label: label !== undefined ? label : value, hideUnit };
};

const checkRelaxedEntry = (entry, where, label, hideUnit) => {
  if (entry.min !== undefined || entry.max !== undefined) {
    if (!isNumber(entry.min) || !isNumber(entry.max) || Number(entry.min) >= Number(entry.max)) {
      log(`Invalid option ${where}: needs a numeric min below a numeric max; ignoring the entry`);
      return undefined;
    }
    const value = isScalar(entry.value) ? String(entry.value) : undefined;
    return {
      value,
      min: Number(entry.min),
      max: Number(entry.max),
      label: label !== undefined ? label : (value !== undefined ? value : RANGE_LABEL),
      hideUnit,
    };
  }
  if (!isNumber(entry.value)) {
    log(`Invalid option ${where}: needs a numeric value, or min and max; ignoring the entry`);
    return undefined;
  }
  let tolerance = 0;
  if (entry.tolerance !== undefined) {
    if (isNumber(entry.tolerance) && Number(entry.tolerance) >= 0) {
      tolerance = Number(entry.tolerance);
    } else {
      log(`Invalid option ${where}.tolerance: expected a number of 0 or more; using 0`);
    }
  }
  const value = String(entry.value);
  return {
    value, tolerance, label: label !== undefined ? label : value, hideUnit,
  };
};

/**
 * A configured state_map, checked: the list syntax, or an object with a "map"
 * list and keep_values, label & hide_unit for all of its entries. An entry
 * can be a bare value. Invalid entries are dropped with a warning.
 * @param {*} stateMap The state_map option
 * @param {string} where Option path for warnings, like "entities[1].state_map"
 * @returns {object|undefined} { strict, map }, or undefined for no usable map
 */
const checkStateMap = (stateMap, where) => {
  if (stateMap === undefined || stateMap === null) return undefined;

  let options;
  if (Array.isArray(stateMap)) {
    options = { map: stateMap };
  } else if (typeof stateMap === 'object' && Array.isArray(stateMap.map)) {
    options = stateMap;
  } else {
    log(`Invalid option ${where}: expected a list, or an object with a "map" list; ignoring it`);
    return undefined;
  }

  const strict = options.keep_values !== true;
  const commonLabel = checkLabel(options.label, where);
  const commonHideUnit = options.hide_unit === true;

  const map = [];
  options.map.forEach((item, index) => {
    const entryWhere = `${where}${Array.isArray(stateMap) ? '' : '.map'}[${index}]`;
    const entry = isScalar(item) ? { value: item } : item;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      log(`Invalid option ${entryWhere}: expected a value or an object; ignoring the entry`);
      return;
    }
    const ownLabel = checkLabel(entry.label, entryWhere);
    const label = ownLabel !== undefined ? ownLabel : commonLabel;
    const hideUnit = entry.hide_unit !== undefined ? entry.hide_unit === true : commonHideUnit;
    const checked = strict
      ? checkStrictEntry(entry, entryWhere, label, hideUnit)
      : checkRelaxedEntry(entry, entryWhere, label, hideUnit);
    if (checked) map.push(checked);
  });

  return map.length > 0 ? { strict, map } : undefined;
};

/**
 * The map an entity's values go through: its own, else the card's.
 * @param {object} entityConfig The entity's entry in config.entities
 * @param {object} config Card config, with state maps checked
 * @returns {object|undefined} A checked map, or undefined for none
 */
const stateMapFor = (entityConfig, config) => entityConfig.state_map || config.state_map;

/**
 * The map an axis's labels go through. Only a strict map turns them into
 * text: the one entity on the axis's own, or the card's when no entity on the
 * axis has its own.
 * @param {object|undefined} cardMap The card's checked state_map
 * @param {object[]} axisEntities Configs of the entities drawn on the axis
 * @returns {object|undefined} A checked strict map, or undefined for numbers
 */
const axisStateMap = (cardMap, axisEntities) => {
  const ownMaps = axisEntities.filter(entity => entity.state_map);
  if (axisEntities.length === 1 && ownMaps.length === 1) {
    return ownMaps[0].state_map.strict ? ownMaps[0].state_map : undefined;
  }
  if (ownMaps.length === 0 && cardMap && cardMap.strict) return cardMap;
  return undefined;
};

/**
 * A recorded state as the graph draws it: under a strict map, its position in
 * the map; otherwise, or when the map does not have it, unchanged.
 * @param {object|undefined} stateMap A checked map
 * @param {*} state The recorded state
 * @returns {*} The state to draw
 */
const drawnState = (stateMap, state) => {
  if (!stateMap || !stateMap.strict) return state;
  const index = stateMap.map.findIndex(entry => entry.value === String(state));
  return index === -1 ? state : index;
};

const matchesRelaxed = (entry, value) => {
  if (entry.min !== undefined) return value >= entry.min && value < entry.max;
  // rounded, so 3.137 is within 0.005 of 3.142 despite the float error
  const distance = Math.round(Math.abs(value - Number(entry.value)) * 1e12) / 1e12;
  return distance <= entry.tolerance;
};

/**
 * The map entry a value matches. Under a strict map a number is a drawn
 * position (see drawnState()) and anything else is a state, matched by its
 * text - so a sensor whose states are "0" and "1" is labelled by what it
 * reads, not by where its entry sits in the map.
 * @param {object} stateMap A checked map
 * @param {*} value A state, or a value drawn on the graph
 * @returns {object|undefined} The matching entry, or undefined for none
 */
const findMapping = (stateMap, value) => {
  if (stateMap.strict) {
    if (typeof value === 'number') {
      return Number.isInteger(value) ? stateMap.map[value] : undefined;
    }
    return stateMap.map.find(entry => entry.value === String(value));
  }
  if (!isNumber(value)) return undefined;
  return stateMap.map.find(entry => matchesRelaxed(entry, Number(value)));
};

/**
 * An entry's label, with ${raw}, ${value}, ${tolerance}, ${min} and ${max}
 * filled in. A token the entry has no value for, or an unknown one, is empty.
 * @param {object} entry A matched map entry
 * @param {string} [raw] The matched value as it would otherwise be shown
 * @returns {string} The label
 */
const renderLabel = (entry, raw) => {
  const tokens = {
    raw,
    value: entry.value,
    tolerance: entry.tolerance,
    min: entry.min,
    max: entry.max,
  };
  return entry.label.replace(/\$\{(\w+)\}/g, (match, token) => (
    tokens[token] === undefined ? '' : String(tokens[token])
  ));
};

export {
  checkStateMap,
  stateMapFor,
  axisStateMap,
  drawnState,
  findMapping,
  renderLabel,
};
