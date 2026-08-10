/**
 * Tests for getCardHeight(), getGridRows(), getCardSizeUnits(), getGridOptions().
 *
 * The file is disabled (renamed to *.dis) & thus is not used during a build process;
 * remove the "dis" extension to use it locally in your VSCode devcontainer.
 */

import { expect, describe, it } from 'vitest';
import {
  getCardHeight, getGridRows, getCardSizeUnits, getGridOptions, isStateInCorner,
} from '../others';
import { GRID_ROW_HEIGHT, GRID_ROW_GAP, CARD_PADDING } from '../const';

const SHOW_NOTHING = {
  name: false, icon: false, state: false, graph: false, legend: false, extrema: false,
};

// a built config, as buildConfig() leaves it
const makeConfig = (show: any = {}, rest: any = {}) => ({
  entities: [{ entity: 'sensor.test' }],
  font_size: 14,
  font_size_header: 14,
  height: 100,
  show: { ...SHOW_NOTHING, ...show },
  ...rest,
});

describe('getGridRows', () => {

  it('getGridRows: a single row', () => {
    expect(getGridRows(GRID_ROW_HEIGHT)).toBe(1);
  });

  it('getGridRows: two rows include a gap', () => {
    expect(getGridRows(GRID_ROW_HEIGHT * 2 + GRID_ROW_GAP)).toBe(2);
  });

  [1, 2, 3, 5, 10].forEach((rows) => {
    it(`getGridRows: an exact height of [${rows}] rows`, () => {
      const height = rows * GRID_ROW_HEIGHT + (rows - 1) * GRID_ROW_GAP;
      expect(getGridRows(height)).toBe(rows);
    });
  });

  [0, -100].forEach((height) => {
    it(`getGridRows: [${height}] is still a row`, () => {
      expect(getGridRows(height)).toBe(1);
    });
  });
});

describe('isStateInCorner', () => {

  ['top-left', 'top-right', 'bottom-left', 'bottom-right'].forEach((align) => {
    it(`isStateInCorner: [${align}] is out of a flow`, () => {
      expect(isStateInCorner(align)).toBe(true);
    });
  });

  ['left', 'right', 'center', undefined, null, 123].forEach((align) => {
    it(`isStateInCorner: [${JSON.stringify(align)}] takes a row`, () => {
      expect(isStateInCorner(align)).toBe(false);
    });
  });
});

describe('getCardSizeUnits', () => {

  it('getCardSizeUnits: rounds up to a 50px unit', () => {
    expect(getCardSizeUnits(50)).toBe(1);
    expect(getCardSizeUnits(51)).toBe(2);
    expect(getCardSizeUnits(228)).toBe(5);
  });

  it('getCardSizeUnits: at least one unit', () => {
    expect(getCardSizeUnits(0)).toBe(1);
  });
});

describe('getCardHeight', () => {

  it('getCardHeight: nothing shown -> a card padding only', () => {
    expect(getCardHeight(makeConfig())).toBe(CARD_PADDING);
  });

  it('getCardHeight: a graph adds its height & a padding', () => {
    expect(getCardHeight(makeConfig({ graph: 'line' })))
      .toBe(CARD_PADDING + 100 + CARD_PADDING);
  });

  it('getCardHeight: a graph height can be overridden', () => {
    expect(getCardHeight(makeConfig({ graph: 'line' }), 250))
      .toBe(CARD_PADDING + 250 + CARD_PADDING);
  });

  ['name', 'icon'].forEach((option) => {
    it(`getCardHeight: [${option}] adds a header`, () => {
      expect(getCardHeight(makeConfig({ [option]: true })))
        .toBeGreaterThan(getCardHeight(makeConfig()));
    });
  });

  it('getCardHeight: a header is counted once for a name & an icon', () => {
    expect(getCardHeight(makeConfig({ name: true, icon: true })))
      .toBe(getCardHeight(makeConfig({ name: true })));
  });

  it('getCardHeight: a header follows font_size_header', () => {
    const small = getCardHeight(makeConfig({ name: true }));
    const large = getCardHeight(makeConfig({ name: true }, { font_size_header: 28 }));
    expect(large).toBeGreaterThan(small);
  });

  it('getCardHeight: a state follows font_size', () => {
    const small = getCardHeight(makeConfig({ state: true }));
    const large = getCardHeight(makeConfig({ state: true }, { font_size: 28 }));
    expect(large).toBeGreaterThan(small);
  });

  it('getCardHeight: a legend needs a graph & more than one entity', () => {
    const one = makeConfig({ graph: 'line', legend: true });
    const two = makeConfig({ graph: 'line', legend: true }, {
      entities: [{ entity: 'sensor.a' }, { entity: 'sensor.b' }],
    });
    const noGraph = makeConfig({ legend: true }, {
      entities: [{ entity: 'sensor.a' }, { entity: 'sensor.b' }],
    });
    expect(getCardHeight(two)).toBeGreaterThan(getCardHeight(one));
    expect(getCardHeight(noGraph)).toBe(CARD_PADDING);
  });

  it('getCardHeight: a corner state takes no row', () => {
    const inFlow = makeConfig({ state: true }, { align_state: 'right' });
    const corner = makeConfig({ state: true }, { align_state: 'top-right' });
    expect(getCardHeight(corner)).toBe(CARD_PADDING);
    expect(getCardHeight(inFlow)).toBeGreaterThan(getCardHeight(corner));
  });

  it('getCardHeight: extrema adds an info row', () => {
    expect(getCardHeight(makeConfig({ extrema: true })))
      .toBeGreaterThan(getCardHeight(makeConfig()));
  });
});

describe('getGridOptions', () => {

  it('getGridOptions: full width by default', () => {
    expect(getGridOptions(makeConfig({ graph: 'line' })).columns).toBe(12);
  });

  it('getGridOptions: rows follow a graph height', () => {
    const small = getGridOptions(makeConfig({ graph: 'line' })).rows;
    const large = getGridOptions(makeConfig({ graph: 'line' }, { height: 400 })).rows;
    expect(large).toBeGreaterThan(small);
  });

  it('getGridOptions: min_rows allows a graph to shrink', () => {
    const options = getGridOptions(makeConfig({ graph: 'line' }, { height: 400 }));
    expect(options.min_rows).toBeLessThan(options.rows);
  });

  it('getGridOptions: min_rows never exceeds rows', () => {
    const options = getGridOptions(makeConfig({ graph: 'line' }, { height: 1 }));
    expect(options.min_rows).toBeLessThanOrEqual(options.rows);
  });

  it('getGridOptions: a corner state needs fewer rows', () => {
    // a height where a state row crosses a row boundary; rounding can
    // otherwise land both on the same number of rows
    const inFlow = getGridOptions(makeConfig({ graph: 'line', state: true }, { height: 300 }));
    const corner = getGridOptions(makeConfig(
      { graph: 'line', state: true }, { height: 300, align_state: 'top-right' },
    ));
    expect(corner.rows).toBeLessThan(inFlow.rows);
  });

  it('getGridOptions: a graph-less card has no shrinking room', () => {
    const options = getGridOptions(makeConfig({ name: true, state: true }));
    expect(options.min_rows).toBe(options.rows);
  });
});
