/**
 * A YAML key with no value - `line_width:` while it is being typed - arrives
 * as null. It keeps the option's default rather than unsetting it.
 */

import {
  expect, describe, it, vi, afterEach,
} from 'vitest';
import buildConfig from '../buildConfig';
import { getLineWidthRange } from '../others';

afterEach(() => {
  vi.restoreAllMocks();
});

const built = (options: any) => buildConfig({ entities: ['sensor.a'], ...options }).config;
const defaults = built({});

describe('an option with no value', () => {
  ['line_width', 'hours_to_show', 'points_per_hour', 'bar_spacing', 'font_size_header', 'aggregate_func']
    .forEach((option) => {
      it(`keeps the default ${option}`, () => {
        expect(built({ [option]: null })[option]).toEqual(defaults[option]);
      });
    });

  it('keeps the line width range drawable', () => {
    const range = getLineWidthRange(built({ line_width: null }));
    expect(range).toEqual(getLineWidthRange(defaults));
    expect(Number.isFinite(range.min)).toBe(true);
  });

  it('keeps the default of a show option', () => {
    expect(built({ show: { state: null } }).show.state).toEqual(defaults.show.state);
  });

  it('still unsets an option without a default', () => {
    expect(built({ baseline: null }).baseline).toBeUndefined();
  });
});
