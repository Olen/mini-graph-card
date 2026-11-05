/**
 * Tests for checkEntities() - the entities list must say what to draw, and say
 * so clearly when it does not.
 */

import { expect, describe, it } from 'vitest';
import { checkEntities } from '../checkOption';

describe('checkEntities', () => {
  it('accepts entity ids, entity objects and static values', () => {
    expect(() => checkEntities([
      'sensor.a',
      { entity: 'sensor.b' },
      { static_value: 5 },
      { static_value: 7.5 },
    ])).not.toThrow();
  });

  it('requires a list', () => {
    expect(() => checkEntities(undefined)).toThrow(/as a list/);
    expect(() => checkEntities({ entity: 'sensor.a' })).toThrow(/as a list/);
  });

  it('names the entry with neither an entity nor a static value', () => {
    expect(() => checkEntities(['sensor.a', { name: 'x' }])).toThrow(/index 1/);
  });

  it('rejects empty and non-numeric entries', () => {
    expect(() => checkEntities([''])).toThrow(/index 0/);
    expect(() => checkEntities([{ entity: '  ' }])).toThrow(/index 0/);
    expect(() => checkEntities([{ static_value: 'abc' }])).toThrow(/index 0/);
    // a numeric string is not drawn as a static value, so it is not accepted as one
    expect(() => checkEntities([{ static_value: '7.5' }])).toThrow(/index 0/);
    expect(() => checkEntities([null])).toThrow(/index 0/);
  });
});
