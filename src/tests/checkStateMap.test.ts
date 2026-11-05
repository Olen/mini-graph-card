/**
 * Tests for checkStateMap() - turning the configured state_map into a list of
 * { value, label } with string values, since states are strings.
 */

import { assert, describe, it } from 'vitest';
import { checkStateMap } from '../checkOption';

const checked = (stateMap: unknown) => {
  const config = { state_map: stateMap };
  checkStateMap(config);
  return config.state_map;
};

describe('checkStateMap', () => {
  it('keeps a valid list, filling in missing labels', () => {
    assert.deepEqual(
      checked([{ value: 'on', label: 'På' }, { value: 'off' }]),
      [{ value: 'on', label: 'På' }, { value: 'off', label: 'off' }],
    );
  });

  it('expands string and number shorthands', () => {
    assert.deepEqual(checked(['idle', 2]), [
      { value: 'idle', label: 'idle' },
      { value: '2', label: '2' },
    ]);
  });

  it('turns numeric values into strings, so they match states', () => {
    assert.deepEqual(checked([{ value: 1, label: 'One' }]), [{ value: '1', label: 'One' }]);
  });

  it('drops entries without a value', () => {
    assert.deepEqual(checked([{ label: 'nothing' }, null, { value: 'on' }]), [
      { value: 'on', label: 'on' },
    ]);
  });

  it('replaces a state_map that is not a list with an empty one', () => {
    assert.deepEqual(checked(null), []);
    assert.deepEqual(checked({ value: 'on' }), []);
    assert.deepEqual(checked('on'), []);
  });

  it('uses the value when a label is no string or number', () => {
    assert.deepEqual(checked([{ value: 'on', label: { text: 'x' } }]), [
      { value: 'on', label: 'on' },
    ]);
  });
});
