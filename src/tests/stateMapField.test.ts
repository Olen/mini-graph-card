/**
 * Tests for withStateMapField() - the editor shows an object state_map
 * read-only, so its list editor never drops keep_values, label or hide_unit.
 */
import { describe, it, expect } from 'vitest';
import { withStateMapField } from '../editor/stateMapField';

const SCHEMA = [
  {
    name: 'state_map',
    type: 'expandable',
    schema: [
      { name: 'state_map', type: 'mgc-list', schema: [] },
    ],
  },
  { name: 'unit', selector: { text: {} } },
];

describe('withStateMapField', () => {
  it('keeps the list editor for the list syntax or no state_map', () => {
    expect(withStateMapField(SCHEMA, [{ value: 'on' }])).toBe(SCHEMA);
    expect(withStateMapField(SCHEMA, undefined)).toBe(SCHEMA);
  });

  it('shows the object syntax read-only', () => {
    const schema = withStateMapField(SCHEMA, { keep_values: true, map: [] });
    expect(schema[0].schema[0].type).toBe('constant');
    expect(schema[1]).toBe(SCHEMA[1]);
  });
});
