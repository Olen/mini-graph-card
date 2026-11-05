/**
 * Tests for lastPlottedValue() - what "show: state: last" shows.
 */

import { assert, describe, it } from 'vitest';
import { lastPlottedValue } from '../others';

const bar = (value: number) => ({
  x: 0, y: 0, height: 0, width: 1, value, index: 0,
});
const point = (value: number) => [0, 0, value, 0];

describe('lastPlottedValue', () => {
  it('reads the newest bar of a bar graph', () => {
    assert.equal(lastPlottedValue(true, [bar(1), bar(7)], undefined), 7);
  });

  it('reads the newest point of a line graph', () => {
    assert.equal(lastPlottedValue(false, undefined, [point(2), point(8)]), 8);
  });

  it('has nothing to read when a bar graph has no bars yet', () => {
    assert.isUndefined(lastPlottedValue(true, undefined, undefined));
    assert.isUndefined(lastPlottedValue(true, [], [point(8)]));
  });

  it('has nothing to read when a line graph has no points', () => {
    assert.isUndefined(lastPlottedValue(false, [bar(7)], []));
  });
});
