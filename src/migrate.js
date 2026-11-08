// Functions to migrate a legacy config to the latest config

import { log } from './utils';

/**
 * Migrate legacy options to the new y_axis structure.
 * @param {object} config Config object
 * @returns {object} Updated config object with y_axis
 */
const migrateYaxisConfig = (config) => {
  const conf = JSON.parse(JSON.stringify(config));

  // [ 'legacy_old_key', 'axis', 'new_key' ]
  const migrations = [
    // primary
    ['lower_bound', 'primary', 'lower_bound'],
    ['upper_bound', 'primary', 'upper_bound'],
    ['min_bound_range', 'primary', 'min_bound_range'],
    ['decimals_primary_labels', 'primary', 'decimals'],
    ['value_factor', 'primary', 'value_factor'],
    // secondary
    ['lower_bound_secondary', 'secondary', 'lower_bound'],
    ['upper_bound_secondary', 'secondary', 'upper_bound'],
    ['min_bound_range_secondary', 'secondary', 'min_bound_range'],
    ['decimals_secondary_labels', 'secondary', 'decimals'],
    ['value_factor_secondary', 'secondary', 'value_factor'],
  ];

  migrations.forEach(([oldKey, axis, newKey]) => {
    const oldValue = conf[oldKey];

    // a legacy option set to null holds nothing to migrate, so it is just dropped
    if (oldValue === null) {
      delete conf[oldKey];
      return;
    }

    // check if the legacy option is present in config
    if (oldValue !== undefined) {
      // check if the option is already defined in the new y_axis object
      const hasNewValue = conf.y_axis
        && conf.y_axis[axis]
        && conf.y_axis[axis][newKey] !== undefined
        && conf.y_axis[axis][newKey] !== null;

      if (!hasNewValue) {
        // new option is missing

        // create empty object if it was not created yet
        if (!conf.y_axis) {
          conf.y_axis = {};
        }
        if (!conf.y_axis[axis]) {
          conf.y_axis[axis] = {};
        }
        // copy a value
        conf.y_axis[axis][newKey] = oldValue;

        log(`option "${oldKey}" is deprecated and has been automatically migrated. `
          + `Please update your YAML configuration to "y_axis.${axis}.${newKey}"`);
      } else {
        // new option is also present
        // legacy option is ignored in favor of the new option
        log(`option "${oldKey}" is ignored `
          + `because you have already configured "y_axis.${axis}.${newKey}". Please remove "${oldKey}" from your YAML`);
      }

      // remove old option
      delete conf[oldKey];
    }
  });

  return conf;
};

/**
 * Rename fill_baseline to baseline, on the card and on each entity: it now
 * sets where bars grow from too, not just where a fill ends. When both are
 * set, baseline wins.
 * @param {object} config Config object
 * @returns {object} A copy with baseline instead of fill_baseline
 */
/* eslint-disable no-param-reassign */
const migrateBaselineConfig = (config) => {
  const conf = JSON.parse(JSON.stringify(config));

  const migrate = (holder, where) => {
    if (holder.fill_baseline === undefined) return;
    if (holder.baseline === undefined || holder.baseline === null) {
      holder.baseline = holder.fill_baseline;
      log(`option "${where}fill_baseline" is deprecated and has been automatically migrated. `
        + `Please update your YAML configuration to "${where}baseline"`);
    } else {
      log(`option "${where}fill_baseline" is ignored `
        + `because you have already configured "${where}baseline". Please remove "${where}fill_baseline" from your YAML`);
    }
    delete holder.fill_baseline;
  };

  migrate(conf, '');
  (conf.entities || []).forEach((entity, index) => {
    if (entity && typeof entity === 'object') migrate(entity, `entities[${index}].`);
  });
  return conf;
};
/* eslint-enable no-param-reassign */

export {
  migrateYaxisConfig,
  migrateBaselineConfig,
};
