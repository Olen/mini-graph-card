/**
 * Tests for computeBoundary() - the min/max a graph's axis is drawn between.
 */

import { assert, describe, it } from 'vitest';
import { computeBoundary } from '../others';

const series = (...pairs: [number, number][]) => pairs.map(([min, max]) => ({ min, max }));

describe('computeBoundary', () => {
  it('takes the extreme of every series when nothing is configured', () => {
    assert.equal(computeBoundary('min', series([3, 9], [1, 5]), undefined, 99), 1);
    assert.equal(computeBoundary('max', series([3, 9], [1, 5]), undefined, 99), 9);
  });

  it('keeps a real boundary of 0 instead of the fallback', () => {
    assert.equal(computeBoundary('min', series([0, 9], [2, 5]), undefined, 4), 0);
    assert.equal(computeBoundary('max', series([-5, 0], [-3, -1]), undefined, 4), 0);
  });

  it('falls back when there is no series', () => {
    assert.equal(computeBoundary('min', [], undefined, 4), 4);
  });

  it('falls back when the series hold no numbers', () => {
    assert.equal(computeBoundary('max', [{ min: NaN, max: NaN }], undefined, 4), 4);
  });

  it('uses a fixed boundary as configured', () => {
    assert.equal(computeBoundary('min', series([3, 9]), 2, 99), 2);
  });

  it('widens a soft boundary to values outside it', () => {
    assert.equal(computeBoundary('min', series([3, 9]), '~5', 99), 3);
    assert.equal(computeBoundary('min', series([6, 9]), '~5', 99), 5);
  });

  it('rejects a type Math does not have', () => {
    assert.throws(() => computeBoundary('median', series([1, 2]), undefined, 0));
  });
});
