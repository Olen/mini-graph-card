/**
 * Tests for entityNamesChanged() - a rename replaces hass.entities/devices/areas/
 * floors without changing any state, and the card must redraw its names then.
 */
import { describe, it, expect } from 'vitest';
import { entityNamesChanged } from '../others';

const hass = () => ({
  formatEntityName: () => 'name',
  entities: {},
  devices: {},
  areas: {},
  floors: {},
  states: {},
});

describe('entityNamesChanged', () => {
  it('is false on the first hass', () => {
    expect(entityNamesChanged(undefined, hass())).toBe(false);
  });

  it('is false when only states changed', () => {
    const old = hass();
    expect(entityNamesChanged(old, { ...old, states: { 'sensor.a': {} } })).toBe(false);
  });

  it('is true when a device, area, floor or entity entry changed', () => {
    const old = hass();
    for (const key of ['entities', 'devices', 'areas', 'floors']) {
      expect(entityNamesChanged(old, { ...old, [key]: {} })).toBe(true);
    }
  });

  it('is true when the formatter itself changed', () => {
    const old = hass();
    expect(entityNamesChanged(old, { ...old, formatEntityName: () => 'other' })).toBe(true);
  });
});
