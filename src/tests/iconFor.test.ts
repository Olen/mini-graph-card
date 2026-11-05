/**
 * Tests for iconFor() - the icon handed to <ha-state-icon>, which resolves an
 * entity's own icon (device class, icon translations) when it gets none.
 */

import { assert, describe, it } from 'vitest';
import { iconFor, STATIC_VALUE_ICON } from '../others';

const sensor = { entity_id: 'sensor.temp', state: '21', attributes: {} };

describe('iconFor', () => {
  it('uses the configured icon first', () => {
    assert.equal(iconFor('mdi:fire', sensor), 'mdi:fire');
    assert.equal(iconFor('mdi:fire', undefined), 'mdi:fire');
  });

  it('leaves an entity’s icon to Home Assistant', () => {
    assert.isUndefined(iconFor(undefined, sensor));
  });

  it('gives a static value without an icon the default icon', () => {
    assert.equal(iconFor(undefined, undefined), STATIC_VALUE_ICON);
  });
});
