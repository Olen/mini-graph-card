/**
 * Tests for withSmoothingDefault() - the editor's smoothing switch shows what
 * the entity gets when smoothing is not set.
 */
import { describe, it, expect } from 'vitest';
import { withSmoothingDefault } from '../editor/smoothingField';

const SCHEMA = [
  {
    name: '',
    type: 'grid',
    schema: [
      { name: 'entity', selector: { entity: {} } },
      { name: 'smoothing', default: true, selector: { boolean: {} } },
    ],
  },
];

const smoothingField = (schema: any[]) => schema[0].schema[1];

describe('withSmoothingDefault', () => {
  it('shows smoothing on for a sensor', () => {
    expect(smoothingField(withSmoothingDefault(SCHEMA, 'sensor.temperature')).default).toBe(true);
  });

  it('shows smoothing off for a binary sensor', () => {
    expect(smoothingField(withSmoothingDefault(SCHEMA, 'binary_sensor.door')).default).toBe(false);
  });

  it('leaves the other fields alone', () => {
    const schema = withSmoothingDefault(SCHEMA, 'binary_sensor.door');
    expect(schema[0].schema[0]).toBe(SCHEMA[0].schema[0]);
    expect(smoothingField(SCHEMA).default).toBe(true);
  });
});
