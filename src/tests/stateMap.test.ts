/**
 * Tests for state_map: checking a configured map, choosing the one for an
 * entity or an axis, and matching & labelling values.
 */

import {
  expect, describe, it, vi, afterEach,
} from 'vitest';
import {
  checkStateMap, stateMapFor, axisStateMap, drawnState, findMapping, renderLabel,
} from '../stateMap';

// log() -> console.warn
const mockWarn = () => vi.spyOn(console, 'warn').mockImplementation(() => { });

afterEach(() => {
  vi.restoreAllMocks();
});

const checked = (stateMap: unknown) => checkStateMap(stateMap, 'state_map');

describe('checkStateMap() - the list syntax', () => {
  it('is a strict map, filling in missing labels', () => {
    expect(checked([{ value: 'on', label: 'På' }, { value: 'off' }])).toEqual({
      strict: true,
      map: [
        { value: 'on', label: 'På', hideUnit: false },
        { value: 'off', label: 'off', hideUnit: false },
      ],
    });
  });

  it('expands string and number shorthands', () => {
    expect(checked(['idle', 2]).map).toEqual([
      { value: 'idle', label: 'idle', hideUnit: false },
      { value: '2', label: '2', hideUnit: false },
    ]);
  });

  it('turns numeric values and labels into strings, so they match states', () => {
    expect(checked([{ value: 1, label: 1 }]).map).toEqual([
      { value: '1', label: '1', hideUnit: false },
    ]);
  });

  it('drops entries without a value', () => {
    mockWarn();
    expect(checked([{ label: 'nothing' }, null, { value: 'on' }]).map).toEqual([
      { value: 'on', label: 'on', hideUnit: false },
    ]);
  });

  it('uses the value when a label is no string or number', () => {
    mockWarn();
    expect(checked([{ value: 'on', label: { text: 'x' } }]).map[0].label).toBe('on');
  });

  it('is no map when nothing is left', () => {
    mockWarn();
    expect(checked([])).toBeUndefined();
    expect(checked([{ label: 'nothing' }])).toBeUndefined();
  });

  it('ignores a state_map that is neither a list nor an object with a map', () => {
    const warn = mockWarn();
    expect(checked('on')).toBeUndefined();
    expect(checked({ value: 'on' })).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('is no map when unset', () => {
    expect(checked(undefined)).toBeUndefined();
    expect(checked(null)).toBeUndefined();
  });
});

describe('checkStateMap() - the object syntax', () => {
  it('is strict unless keep_values is set', () => {
    expect(checked({ map: ['off', 'on'] }).strict).toBe(true);
    expect(checked({ keep_values: true, map: [{ value: 5 }] }).strict).toBe(false);
  });

  it('gives entries the common label & hide_unit unless they set their own', () => {
    const { map } = checked({
      label: 'Alarm',
      hide_unit: true,
      map: ['on', { value: 'off', label: 'Clear', hide_unit: false }],
    });
    expect(map).toEqual([
      { value: 'on', label: 'Alarm', hideUnit: true },
      { value: 'off', label: 'Clear', hideUnit: false },
    ]);
  });

  it('warns about tolerance, min & max in a strict map', () => {
    const warn = mockWarn();
    expect(checked({ map: [{ value: 'on', tolerance: 1 }] }).map[0]).toEqual(
      { value: 'on', label: 'on', hideUnit: false },
    );
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe('checkStateMap() - relaxed entries', () => {
  const relaxed = (...map: unknown[]) => checked({ keep_values: true, map }).map;

  it('matches a value within a tolerance, 0 by default', () => {
    expect(relaxed({ value: 3.142, tolerance: 0.005 }, { value: 7 })).toEqual([
      { value: '3.142', tolerance: 0.005, label: '3.142', hideUnit: false },
      { value: '7', tolerance: 0, label: '7', hideUnit: false },
    ]);
  });

  it('labels a range with its bounds by default', () => {
    expect(relaxed({ min: 650, max: 750 })).toEqual([
      {
        value: undefined, min: 650, max: 750, label: '${min} .. ${max}', hideUnit: false,
      },
    ]);
  });

  it('drops a range whose min is not below its max', () => {
    mockWarn();
    expect(checked({ keep_values: true, map: [{ min: 750, max: 650 }] })).toBeUndefined();
  });

  it('drops a non-numeric value', () => {
    mockWarn();
    expect(checked({ keep_values: true, map: ['on'] })).toBeUndefined();
  });

  it('uses 0 for an invalid tolerance', () => {
    mockWarn();
    expect(relaxed({ value: 5, tolerance: -1 })[0].tolerance).toBe(0);
  });
});

describe('stateMapFor()', () => {
  const cardMap = checked(['off', 'on']);
  const ownMap = checked(['closed', 'open']);

  it('uses the entity\'s own map', () => {
    expect(stateMapFor({ state_map: ownMap }, { state_map: cardMap })).toBe(ownMap);
  });

  it('falls back to the card\'s', () => {
    expect(stateMapFor({}, { state_map: cardMap })).toBe(cardMap);
  });

  it('is none when neither has one', () => {
    expect(stateMapFor({}, {})).toBeUndefined();
  });
});

describe('axisStateMap()', () => {
  const cardMap = checked(['off', 'on']);
  const ownMap = checked(['closed', 'open']);
  const relaxedMap = checked({ keep_values: true, map: [{ value: 5 }] });

  it('uses the only entity\'s own strict map', () => {
    expect(axisStateMap(cardMap, [{ state_map: ownMap }])).toBe(ownMap);
  });

  it('uses the card\'s strict map when no entity has its own', () => {
    expect(axisStateMap(cardMap, [{}, {}])).toBe(cardMap);
  });

  it('keeps numbers for an entity with its own map among others', () => {
    expect(axisStateMap(cardMap, [{ state_map: ownMap }, {}])).toBeUndefined();
  });

  it('keeps numbers for a relaxed map', () => {
    expect(axisStateMap(undefined, [{ state_map: relaxedMap }])).toBeUndefined();
    expect(axisStateMap(relaxedMap, [{}])).toBeUndefined();
  });
});

describe('drawnState()', () => {
  const strict = checked(['off', 'on']);

  it('draws a mapped state at its position', () => {
    expect(drawnState(strict, 'on')).toBe(1);
  });

  it('leaves a state the map does not have', () => {
    expect(drawnState(strict, 'unavailable')).toBe('unavailable');
  });

  it('leaves states alone without a strict map', () => {
    expect(drawnState(undefined, 'on')).toBe('on');
    expect(drawnState(checked({ keep_values: true, map: [{ value: 5 }] }), '5')).toBe('5');
  });
});

describe('findMapping()', () => {
  it('finds a drawn position in a strict map', () => {
    const strict = checked(['off', 'on']);
    expect(findMapping(strict, 1).label).toBe('on');
    expect(findMapping(strict, 0.5)).toBeUndefined();
  });

  it('matches a state by its text, whatever its position', () => {
    // the states of this sensor are "1" and "0", listed the other way round
    const strict = checked([{ value: '1', label: 'On' }, { value: '0', label: 'Off' }]);
    expect(findMapping(strict, '1').label).toBe('On');
    expect(findMapping(strict, '0').label).toBe('Off');
  });

  it('matches a value within its tolerance, both bounds included', () => {
    const relaxed = checked({ keep_values: true, map: [{ value: 3.142, tolerance: 0.005 }] });
    expect(findMapping(relaxed, '3.137')).toBeDefined();
    expect(findMapping(relaxed, 3.147)).toBeDefined();
    expect(findMapping(relaxed, '3.148')).toBeUndefined();
  });

  it('matches a range with its min included and its max left out', () => {
    const relaxed = checked({ keep_values: true, map: [{ min: 650, max: 750 }] });
    expect(findMapping(relaxed, '650')).toBeDefined();
    expect(findMapping(relaxed, 749.9)).toBeDefined();
    expect(findMapping(relaxed, '750')).toBeUndefined();
  });

  it('matches nothing non-numeric in a relaxed map', () => {
    const relaxed = checked({ keep_values: true, map: [{ min: 0, max: 10 }] });
    expect(findMapping(relaxed, 'unavailable')).toBeUndefined();
  });

  it('takes the first entry that matches', () => {
    const relaxed = checked({
      keep_values: true,
      map: [{ min: 0, max: 100, label: 'Low' }, { value: 50, label: 'Fifty' }],
    });
    expect(findMapping(relaxed, 50).label).toBe('Low');
  });
});

describe('renderLabel()', () => {
  it('fills in the tokens', () => {
    const entry = { min: 650, max: 750, label: 'Warning - ${raw} (${min}..${max})' };
    expect(renderLabel(entry, '700')).toBe('Warning - 700 (650..750)');
  });

  it('leaves a token the entry has no value for empty', () => {
    expect(renderLabel({ value: 'on', label: '${value}${tolerance}${raw}' })).toBe('on');
  });

  it('leaves an unknown token empty', () => {
    expect(renderLabel({ value: 'on', label: 'x${foo}y' })).toBe('xy');
  });

  it('leaves a label without tokens as it is', () => {
    expect(renderLabel({ value: 'on', label: 'Detected' })).toBe('Detected');
  });
});
