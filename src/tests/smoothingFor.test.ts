/**
 * Tests for smoothingFor().
 */

import { assert, describe, it } from 'vitest';
import buildConfig from '../buildConfig';
import { smoothingFor } from '../others';

// Resolve through buildConfig, as the card does, so a card-level default
// added there cannot silently override the per-entity one.
const smoothing = (entityConfig: any, cardConfig: any = {}) => {
  const { config } = buildConfig({ ...cardConfig, entities: [entityConfig] });
  return smoothingFor(config.entities[0], config);
};

describe('smoothingFor()', () => {
  it('smooths a sensor by default', () => {
    assert.isTrue(smoothing({ entity: 'sensor.temperature' }));
  });

  it('does not smooth a binary sensor by default', () => {
    assert.isFalse(smoothing({ entity: 'binary_sensor.door' }));
  });

  it('does not smooth a static value', () => {
    assert.isFalse(smoothing({ static_value: 20 }));
  });

  it('follows the card setting over the default', () => {
    assert.isTrue(smoothing({ entity: 'binary_sensor.door' }, { smoothing: true }));
    assert.isFalse(smoothing({ entity: 'sensor.temperature' }, { smoothing: false }));
  });

  it('follows the entity setting over the card', () => {
    assert.isTrue(smoothing(
      { entity: 'binary_sensor.door', smoothing: true },
      { smoothing: false },
    ));
    assert.isFalse(smoothing(
      { entity: 'sensor.temperature', smoothing: false },
      { smoothing: true },
    ));
  });
});
