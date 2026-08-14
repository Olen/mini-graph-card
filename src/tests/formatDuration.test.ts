/**
 * Tests for formatDuration().
 */

import { assert, describe, it } from 'vitest';
import { formatDuration, DURATION_UNITS } from '../locale';

describe('formatDuration', () => {
  it('drops the hours group when there are none', () => {
    assert.equal(formatDuration(547), '9:07');
    assert.equal(formatDuration(59), '0:59');
    assert.equal(formatDuration(0), '0:00');
  });

  it('shows hours once there are any', () => {
    assert.equal(formatDuration(3600), '1:00:00');
    assert.equal(formatDuration(3723), '1:02:03');
    assert.equal(formatDuration(86400), '24:00:00');
  });

  it('rounds before splitting, so seconds never reach 60', () => {
    assert.equal(formatDuration(59.6), '1:00');
    assert.equal(formatDuration(3599.6), '1:00:00');
    assert.equal(formatDuration(59.94, 1), '0:59.9');
  });

  it('sizes the seconds group with the requested decimals', () => {
    assert.equal(formatDuration(128.5, 1), '2:08.5');
    assert.equal(formatDuration(128.5, 2), '2:08.50');
    assert.equal(formatDuration(128.5), '2:09');
  });

  it('clamps decimals to a sane range', () => {
    assert.equal(formatDuration(128.5, -2), '2:09');
    assert.equal(formatDuration(128.5, 9), '2:08.500');
  });

  it('keeps the sign in front', () => {
    assert.equal(formatDuration(-547), '-9:07');
    assert.equal(formatDuration(-3723), '-1:02:03');
  });

  it('follows the locale decimal separator', () => {
    assert.equal(formatDuration(128.5, 1, { language: 'nb' } as never), '2:08,5');
  });

  it('knows the units a duration can be reported in', () => {
    assert.equal(DURATION_UNITS.min, 60);
    assert.equal(DURATION_UNITS.h, 3600);
    assert.equal(DURATION_UNITS.km, undefined);
  });
});
