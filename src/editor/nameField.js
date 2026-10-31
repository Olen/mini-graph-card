import { isNameItems } from '../others';

// A text field would show name items as "[object Object]" and overwrite them on edit
const READ_ONLY_NAME = { name: 'name', type: 'constant', value: 'set in YAML (name items)' };

const cache = new WeakMap();

const replaceName = schema => schema.map((field) => {
  if (field.name === 'name' && field.selector && field.selector.text) return READ_ONLY_NAME;
  return field.schema ? { ...field, schema: replaceName(field.schema) } : field;
});

/**
 * The editor schema to use for a configured name: unchanged for a plain or
 * templated name, with a read-only name field for name items
 * @param {object[]} schema ha-form schema containing a `name` text field
 * @param {*} name Configured name
 * @returns {object[]} Schema for ha-form
 */
const withNameField = (schema, name) => {
  if (!isNameItems(name)) return schema;
  if (!cache.has(schema)) cache.set(schema, replaceName(schema));
  return cache.get(schema);
};

export { withNameField }; // eslint-disable-line import/prefer-default-export
