/**
 * Tests for migrateBaselineConfig() - fill_baseline is now baseline, on the
 * card and on each entity.
 */

import {
  expect, describe, it, vi, afterEach,
} from 'vitest';
import { migrateBaselineConfig } from '../migrate';

// log() -> console.warn
const mockWarn = () => vi.spyOn(console, 'warn').mockImplementation(() => { });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('migrateBaselineConfig', () => {
  it('renames the card\'s fill_baseline, with a warning', () => {
    const warn = mockWarn();
    const config = migrateBaselineConfig({ fill_baseline: 0, entities: ['sensor.a'] });
    expect(config.baseline).toBe(0);
    expect(config.fill_baseline).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('renames an entity\'s fill_baseline', () => {
    mockWarn();
    const config = migrateBaselineConfig({ entities: ['sensor.a', { entity: 'sensor.b', fill_baseline: 800 }] });
    expect(config.entities[1]).toEqual({ entity: 'sensor.b', baseline: 800 });
    expect(config.entities[0]).toBe('sensor.a');
  });

  it('keeps baseline when both are set, and warns', () => {
    const warn = mockWarn();
    const config = migrateBaselineConfig({ fill_baseline: 5, baseline: 0, entities: [] });
    expect(config.baseline).toBe(0);
    expect(config.fill_baseline).toBeUndefined();
    expect(warn.mock.calls[0].join(' ')).toContain('ignored');
  });

  it('leaves a config without fill_baseline alone', () => {
    const warn = mockWarn();
    const input = { baseline: 0, entities: [{ entity: 'sensor.a' }] };
    expect(migrateBaselineConfig(input)).toEqual(input);
    expect(warn).not.toHaveBeenCalled();
  });

  it('does not change the config it is given', () => {
    mockWarn();
    const input = { fill_baseline: 0, entities: [] };
    migrateBaselineConfig(input);
    expect(input).toEqual({ fill_baseline: 0, entities: [] });
  });
});
