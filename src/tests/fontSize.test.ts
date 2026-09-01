/**
 * Tests for font_size, which is a percentage of the default size.
 *
 * The validated percentage has to be the one that gets converted: reading the
 * raw config back afterwards let an out-of-bounds value through and produced a
 * negative font size, even though the validator had logged that it rejected it.
 */

import { assert, describe, it } from 'vitest';
import buildConfig from '../buildConfig';

const DEFAULT_FONT_SIZE = 14;

const fontSizeOf = (fontSize?: number | string): number => {
  const config: Record<string, any> = { entities: ['sensor.test'] };
  if (fontSize !== undefined) config.font_size = fontSize;
  return buildConfig(config).config.font_size;
};

describe('font_size', () => {
  it('defaults to the default size when unset', () => {
    assert.equal(fontSizeOf(), DEFAULT_FONT_SIZE);
  });

  it('scales the default size by the given percentage', () => {
    assert.equal(fontSizeOf(150), 21);
    assert.equal(fontSizeOf(50), 7);
    assert.equal(fontSizeOf(100), DEFAULT_FONT_SIZE);
  });

  it('accepts a percentage written as a string', () => {
    assert.equal(fontSizeOf('150'), 21);
  });

  it('falls back to the default size for an out-of-bounds percentage', () => {
    assert.equal(fontSizeOf(-5), DEFAULT_FONT_SIZE);
    assert.equal(fontSizeOf(0), DEFAULT_FONT_SIZE);
  });

  it('falls back to the default size for a non-numeric value', () => {
    assert.equal(fontSizeOf('abc'), DEFAULT_FONT_SIZE);
  });
});
