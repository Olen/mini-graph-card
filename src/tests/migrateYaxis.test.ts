/**
 * Tests for migrateYaxisConfig().
 *
 * The flat axis options are still what most existing YAML uses, so they have
 * to keep working; the migration is what makes the y_axis structure additive
 * rather than a breaking change.
 */

import { assert, describe, it } from 'vitest';
import { migrateYaxisConfig } from '../migrate';

const LEGACY_TO_NEW: Array<[string, 'primary' | 'secondary', string]> = [
  ['lower_bound', 'primary', 'lower_bound'],
  ['upper_bound', 'primary', 'upper_bound'],
  ['min_bound_range', 'primary', 'min_bound_range'],
  ['decimals_primary_labels', 'primary', 'decimals'],
  ['value_factor', 'primary', 'value_factor'],
  ['lower_bound_secondary', 'secondary', 'lower_bound'],
  ['upper_bound_secondary', 'secondary', 'upper_bound'],
  ['min_bound_range_secondary', 'secondary', 'min_bound_range'],
  ['decimals_secondary_labels', 'secondary', 'decimals'],
  ['value_factor_secondary', 'secondary', 'value_factor'],
];

describe('migrateYaxisConfig', () => {
  LEGACY_TO_NEW.forEach(([legacy, axis, option]) => {
    it(`moves ${legacy} to y_axis.${axis}.${option}`, () => {
      const result: any = migrateYaxisConfig({ [legacy]: 42 });
      assert.equal(result.y_axis[axis][option], 42);
      assert.isUndefined(result[legacy], 'the legacy key is removed');
    });
  });

  it('leaves a config with no axis options alone', () => {
    const result: any = migrateYaxisConfig({ entities: ['sensor.x'] });
    assert.isUndefined(result.y_axis);
  });

  it('prefers an explicit y_axis value over the legacy one', () => {
    const result: any = migrateYaxisConfig({
      lower_bound: 999,
      y_axis: { primary: { lower_bound: 10 } },
    });
    assert.equal(result.y_axis.primary.lower_bound, 10);
    assert.isUndefined(result.lower_bound);
  });

  it('does not mutate the config it is given', () => {
    const original: any = { lower_bound: 5 };
    migrateYaxisConfig(original);
    assert.equal(original.lower_bound, 5);
    assert.isUndefined(original.y_axis);
  });

  it('keeps a falsy value, which is a real bound', () => {
    const result: any = migrateYaxisConfig({ lower_bound: 0 });
    assert.equal(result.y_axis.primary.lower_bound, 0);
  });
});
