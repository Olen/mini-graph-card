/**
 * Tests for formatEntityName() - the entity name used when no `name` is configured,
 * or when `name` is a list of name items such as [{type: 'area'}, {type: 'device'}].
 */
import { describe, it, expect } from 'vitest';
import { formatEntityName, isNameItems } from '../others';

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

  it('passes name items through to hass.formatEntityName unchanged', () => {
    const items = [{ type: 'area' }, { type: 'device' }];
    const seen = [];
    const hass = {
      formatEntityName: (s, name) => {
        seen.push(name);
        return 'Badet Taklampe';
      },
    };
    expect(formatEntityName(hass, stateObj, items)).toBe('Badet Taklampe');
    expect(seen).toEqual([items]);
  });

  it('falls back to friendly_name for name items on HA without formatEntityName', () => {
    expect(formatEntityName({}, stateObj, [{ type: 'area' }])).toBe('Old friendly name');
  });
});

describe('isNameItems', () => {
  it('recognises a list or a single name item', () => {
    expect(isNameItems([{ type: 'area' }, { type: 'device' }])).toBe(true);
    expect(isNameItems({ type: 'entity' })).toBe(true);
  });

  it('rejects plain and templated strings, and nothing', () => {
    expect(isNameItems('Temperatur')).toBe(false);
    expect(isNameItems("{{ area_name('sensor.x') }}")).toBe(false);
    expect(isNameItems(undefined)).toBe(false);
    expect(isNameItems(null)).toBe(false);
  });
});
