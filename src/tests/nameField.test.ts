/**
 * Tests for withNameField() - the editor shows a list-valued `name` read-only, so
 * a text field never turns the list into "[object Object]".
 */
import { describe, it, expect } from 'vitest';
import { withNameField } from '../editor/nameField';

const SCHEMA = [
  {
    name: '',
    type: 'grid',
    schema: [
      { name: 'entity', selector: { entity: {} } },
      { name: 'name', selector: { text: {} } },
      { name: 'unit', selector: { text: {} } },
    ],
  },
];

describe('withNameField', () => {
  it('keeps the schema as is for a string name or no name', () => {
    expect(withNameField(SCHEMA, 'Temperatur')).toBe(SCHEMA);
    expect(withNameField(SCHEMA, undefined)).toBe(SCHEMA);
  });

  it('replaces the name text field with a read-only one for name items', () => {
    const schema = withNameField(SCHEMA, [{ type: 'area' }, { type: 'device' }]);
    const fields = schema[0].schema;
    expect(fields.map(f => f.name)).toEqual(['entity', 'name', 'unit']);
    expect(fields[1].type).toBe('constant');
    expect(fields[1].selector).toBeUndefined();
    expect(fields[0]).toBe(SCHEMA[0].schema[0]);
  });

  it('does not modify the schema it was given', () => {
    withNameField(SCHEMA, [{ type: 'area' }]);
    expect(SCHEMA[0].schema[1]).toEqual({ name: 'name', selector: { text: {} } });
  });

  it('returns the same object on repeated calls, so ha-form does not re-render', () => {
    const items = [{ type: 'area' }];
    expect(withNameField(SCHEMA, items)).toBe(withNameField(SCHEMA, [{ type: 'device' }]));
  });
});
