/**
 * Tests for formatEntityName() - the entity name used when no `name` is configured.
 */
import { describe, it, expect } from 'vitest';
import { formatEntityName } from '../others';

const stateObj = {
  entity_id: 'sensor.living_room_temperature',
  attributes: { friendly_name: 'Old friendly name' },
};

describe('formatEntityName', () => {
  it('uses hass.formatEntityName when HA provides it', () => {
    const hass = { formatEntityName: s => `formatted ${s.entity_id}` };
    expect(formatEntityName(hass, stateObj)).toBe('formatted sensor.living_room_temperature');
  });

  it('falls back to friendly_name on HA without formatEntityName', () => {
    expect(formatEntityName({}, stateObj)).toBe('Old friendly name');
    expect(formatEntityName(undefined, stateObj)).toBe('Old friendly name');
  });

  it('falls back to the entity id when there is no friendly_name', () => {
    expect(formatEntityName({}, { entity_id: 'sensor.x', attributes: {} })).toBe('sensor.x');
  });
});
