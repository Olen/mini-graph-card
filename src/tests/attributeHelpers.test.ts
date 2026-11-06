/**
 * Tests for the small pure helpers: getLog10(), isObjectAttr(), getObjectAttr(),
 * isNumericEntity() and getLineWidthRange().
 */
import { describe, it, expect } from 'vitest';
import {
  getLog10, isObjectAttr, getObjectAttr, isNumericEntity, getLineWidthRange,
} from '../others';

describe('getLog10', () => {
  it('takes the base-10 logarithm', () => {
    expect(getLog10(1000)).toBe(3);
  });

  it('puts values below 1 at the bottom of the scale', () => {
    expect(getLog10(0.5)).toBe(0);
    expect(getLog10(-20)).toBe(0);
  });
});

describe('isObjectAttr', () => {
  it('is true for a dotted path', () => {
    expect(isObjectAttr('forecast.0.temperature')).toBe(true);
  });

  it('is false for a plain attribute', () => {
    expect(isObjectAttr('temperature')).toBe(false);
  });
});

describe('getObjectAttr', () => {
  const attributes = {
    temperature: 21.5,
    zero: 0,
    forecast: [{ temperature: 3 }, { temperature: 5 }],
    nested: { level: { value: 'x' } },
  };

  it('reads a plain attribute', () => {
    expect(getObjectAttr(attributes, 'temperature')).toBe(21.5);
  });

  it('reads through objects and array indexes', () => {
    expect(getObjectAttr(attributes, 'forecast.1.temperature')).toBe(5);
    expect(getObjectAttr(attributes, 'nested.level.value')).toBe('x');
  });

  it('returns a value of 0 as 0', () => {
    expect(getObjectAttr(attributes, 'zero')).toBe(0);
  });

  it('is undefined when a part of the path is missing', () => {
    expect(getObjectAttr(attributes, 'forecast.5.temperature')).toBeUndefined();
    expect(getObjectAttr(attributes, 'zero.below')).toBeUndefined();
    expect(getObjectAttr(attributes, 'missing')).toBeUndefined();
  });

  it('is undefined for missing attributes', () => {
    expect(getObjectAttr(undefined, 'temperature')).toBeUndefined();
    expect(getObjectAttr(null, 'temperature')).toBeUndefined();
  });
});

describe('isNumericEntity', () => {
  const hass = {
    states: {
      'sensor.plain': { attributes: {} },
      'sensor.with_unit': { attributes: { unit_of_measurement: '°C' } },
      'sensor.with_state_class': { attributes: { state_class: 'measurement' } },
    },
  };

  it('accepts the numeric domains without looking at the state', () => {
    expect(isNumericEntity(hass, 'counter.visits')).toBe(true);
    expect(isNumericEntity(hass, 'input_number.target')).toBe(true);
    expect(isNumericEntity(hass, 'number.offset')).toBe(true);
  });

  it('accepts a sensor with a unit or a state class', () => {
    expect(isNumericEntity(hass, 'sensor.with_unit')).toBe(true);
    expect(isNumericEntity(hass, 'sensor.with_state_class')).toBe(true);
  });

  it('rejects a sensor with neither, a missing sensor, and other domains', () => {
    expect(isNumericEntity(hass, 'sensor.plain')).toBe(false);
    expect(isNumericEntity(hass, 'sensor.missing')).toBe(false);
    expect(isNumericEntity(hass, 'sun.sun')).toBe(false);
  });
});

describe('getLineWidthRange', () => {
  it('uses each entity\'s line_width, else the card\'s', () => {
    const config = {
      line_width: 5,
      entities: [{ line_width: 2 }, {}, { line_width: 8 }],
    };
    expect(getLineWidthRange(config)).toEqual({ min: 2, max: 8 });
  });

  it('ignores entities that draw no graph', () => {
    const config = {
      line_width: 5,
      entities: [{ line_width: 20, show_graph: false }, { line_width: 3 }],
    };
    expect(getLineWidthRange(config)).toEqual({ min: 3, max: 3 });
  });

  it('uses the card\'s line_width when no entity draws a graph', () => {
    const config = { line_width: 5, entities: [{ show_graph: false }] };
    expect(getLineWidthRange(config)).toEqual({ min: 5, max: 5 });
  });
});
