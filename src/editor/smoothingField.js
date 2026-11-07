import { smoothingFor } from '../others';

const cache = new WeakMap();

const setSmoothingDefault = (schema, value) => schema.map((field) => {
  if (field.name === 'smoothing') return { ...field, default: value };
  return field.schema ? { ...field, schema: setSmoothingDefault(field.schema, value) } : field;
});

/**
 * The editor schema with the smoothing switch showing what an entity gets
 * when smoothing is not set: off for a binary sensor, on otherwise
 * @param {object[]} schema ha-form schema containing a `smoothing` field
 * @param {string} entity Entity id
 * @returns {object[]} Schema for ha-form
 */
const withSmoothingDefault = (schema, entity) => {
  const value = smoothingFor({ entity }, {});
  if (!cache.has(schema)) {
    cache.set(schema, {
      true: setSmoothingDefault(schema, true),
      false: setSmoothingDefault(schema, false),
    });
  }
  return cache.get(schema)[value];
};

export { withSmoothingDefault }; // eslint-disable-line import/prefer-default-export
