/**
 * Tests for checkGroupBy() and checkPointsPerHour() - a group_by must fit a
 * whole number of its buckets into hours_to_show, and sets one point per bucket.
 */

import { assert, describe, it } from 'vitest';
import { checkGroupBy, checkPointsPerHour } from '../checkOption';

describe('checkGroupBy', () => {
  it('defaults to interval', () => {
    assert.equal(checkGroupBy({ hours_to_show: 24 }), 'interval');
    assert.equal(checkGroupBy({ group_by: null, hours_to_show: 24 }), 'interval');
    assert.equal(checkGroupBy({ group_by: 'interval', hours_to_show: 5 }), 'interval');
  });

  it('keeps a grouping that fits the window', () => {
    assert.equal(checkGroupBy({ group_by: 'week', hours_to_show: 336 }), 'week');
    assert.equal(checkGroupBy({ group_by: 'date', hours_to_show: 720 }), 'date');
    assert.equal(checkGroupBy({ group_by: '12h', hours_to_show: 36 }), '12h');
    assert.equal(checkGroupBy({ group_by: 'hour', hours_to_show: 24 }), 'hour');
    assert.equal(checkGroupBy({ group_by: '30min', hours_to_show: 1.5 }), '30min');
    assert.equal(checkGroupBy({ group_by: '15min', hours_to_show: 0.75 }), '15min');
  });

  it('falls back to interval when the window is not whole buckets', () => {
    assert.equal(checkGroupBy({ group_by: 'week', hours_to_show: 720 }), 'interval');
    assert.equal(checkGroupBy({ group_by: 'date', hours_to_show: 36 }), 'interval');
    assert.equal(checkGroupBy({ group_by: '12h', hours_to_show: 18 }), 'interval');
    assert.equal(checkGroupBy({ group_by: 'hour', hours_to_show: 1.5 }), 'interval');
    assert.equal(checkGroupBy({ group_by: '15min', hours_to_show: 0.1 }), 'interval');
  });

  it('falls back to interval when the window is shorter than one bucket', () => {
    assert.equal(checkGroupBy({ group_by: 'date', hours_to_show: 12 }), 'interval');
  });

  it('falls back to interval for an unknown grouping', () => {
    assert.equal(checkGroupBy({ group_by: 'fortnight', hours_to_show: 336 }), 'interval');
  });
});

describe('checkPointsPerHour', () => {
  it('sets one point per bucket for a fixed grouping', () => {
    assert.equal(checkPointsPerHour({ group_by: 'week', points_per_hour: 0.5 }), 1 / 168);
    assert.equal(checkPointsPerHour({ group_by: 'date', points_per_hour: 0.5 }), 1 / 24);
    assert.equal(checkPointsPerHour({ group_by: '12h', points_per_hour: 0.5 }), 1 / 12);
    assert.equal(checkPointsPerHour({ group_by: 'hour', points_per_hour: 0.5 }), 1);
    assert.equal(checkPointsPerHour({ group_by: '30min', points_per_hour: 0.5 }), 2);
    assert.equal(checkPointsPerHour({ group_by: '15min', points_per_hour: 0.5 }), 4);
  });

  it('keeps the configured value for interval', () => {
    assert.equal(checkPointsPerHour({ group_by: 'interval', points_per_hour: 3 }), 3);
  });
});
