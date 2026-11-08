// The list editor would drop an object state_map's keep_values, label & hide_unit
const READ_ONLY_STATE_MAP = { name: 'state_map', type: 'constant', value: 'set in YAML (object syntax)' };

const cache = new WeakMap();

const replaceStateMap = schema => schema.map((field) => {
  if (field.name === 'state_map' && field.type === 'mgc-list') return READ_ONLY_STATE_MAP;
  return field.schema ? { ...field, schema: replaceStateMap(field.schema) } : field;
});

/**
 * The editor schema to use for a configured state_map: unchanged for the list
 * syntax, with a read-only field for the object syntax
 * @param {object[]} schema ha-form schema containing a `state_map` list field
 * @param {*} stateMap Configured state_map
 * @returns {object[]} Schema for ha-form
 */
const withStateMapField = (schema, stateMap) => {
  const isObject = typeof stateMap === 'object' && stateMap !== null && !Array.isArray(stateMap);
  if (!isObject) return schema;
  if (!cache.has(schema)) cache.set(schema, replaceStateMap(schema));
  return cache.get(schema);
};

export { withStateMapField }; // eslint-disable-line import/prefer-default-export
