/**
 * Tests for getCardHeight(), getGridRows(), getCardSizeUnits(), getGridOptions().
 */

import { expect, describe, it } from 'vitest';
import {
  getCardHeight, getGridRows, getCardSizeUnits, getGridOptions, isStateInCorner,
  getChromeHeight, getLegendHeight,
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
    expect(getCardHeight(makeConfig(), 100)).toBe(CARD_PADDING);
  });

  [100, 250].forEach((graphHeight) => {
    it(`getCardHeight: a graph of [${graphHeight}] adds no padding of its own`, () => {
      // ".graph" is the one row with no padding, see the note in getCardHeight
      expect(getCardHeight(makeConfig({ graph: 'line' }), graphHeight))
        .toBe(CARD_PADDING + graphHeight);
    });
  });

  ['name', 'icon'].forEach((option) => {
    it(`getCardHeight: [${option}] adds a header`, () => {
      expect(getCardHeight(makeConfig({ [option]: true }), 100))
        .toBeGreaterThan(getCardHeight(makeConfig(), 100));
    });
  });

  it('getCardHeight: a header is counted once for a name & an icon', () => {
    expect(getCardHeight(makeConfig({ name: true, icon: true }), 100))
      .toBe(getCardHeight(makeConfig({ name: true }), 100));
  });

  it('getCardHeight: a header follows font_size_header', () => {
    const small = getCardHeight(makeConfig({ name: true }), 100);
    const large = getCardHeight(makeConfig({ name: true }, { font_size_header: 28 }), 100);
    expect(large).toBeGreaterThan(small);
  });

  it('getCardHeight: a state follows font_size', () => {
    const small = getCardHeight(makeConfig({ state: true }), 100);
    const large = getCardHeight(makeConfig({ state: true }, { font_size: 28 }), 100);
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
    expect(getCardHeight(two, 100)).toBeGreaterThan(getCardHeight(one, 100));
    expect(getCardHeight(noGraph, 100)).toBe(CARD_PADDING);
  });

  it('getCardHeight: a corner state takes no row', () => {
    const inFlow = makeConfig({ state: true }, { align_state: 'right' });
    const corner = makeConfig({ state: true }, { align_state: 'top-right' });
    expect(getCardHeight(corner, 100)).toBe(CARD_PADDING);
    expect(getCardHeight(inFlow, 100)).toBeGreaterThan(getCardHeight(corner, 100));
  });

  it('getCardHeight: extrema adds an info row', () => {
    expect(getCardHeight(makeConfig({ extrema: true }), 100))
      .toBeGreaterThan(getCardHeight(makeConfig(), 100));
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

  it('getGridOptions: an explicit height decides the rows on its own', () => {
    // "height" is a CARD height, so what the card puts inside cannot change it
    const inFlow = getGridOptions(makeConfig({ graph: 'line', state: true }, { height: 300 }));
    const corner = getGridOptions(makeConfig(
      { graph: 'line', state: true }, { height: 300, align_state: 'top-right' },
    ));
    expect(corner.rows).toBe(inFlow.rows);
  });

  it('getGridOptions: a corner state needs fewer rows when no height is set', () => {
    // ...but a derived height is chrome + a graph, & a corner state is no row
    const inFlow = getGridOptions(makeConfig({ graph: 'line', state: true }, { height: undefined }));
    const corner = getGridOptions(makeConfig(
      { graph: 'line', state: true }, { height: undefined, align_state: 'top-right' },
    ));
    expect(corner.rows).toBeLessThan(inFlow.rows);
  });

  it('getGridOptions: a graph-less card has no shrinking room', () => {
    const options = getGridOptions(makeConfig({ name: true, state: true }));
    expect(options.min_rows).toBe(options.rows);
  });
});

describe('density', () => {
  const withGraph = (rest: any = {}) => makeConfig({ name: true, state: true, graph: 'line' }, rest);

  it('getCardHeight: compact padding costs less chrome', () => {
    const config = withGraph();
    expect(getCardHeight(config, 100, 8)).toBeLessThan(getCardHeight(config, 100, CARD_PADDING));
  });

  it('getCardHeight: the saving is one padding per row shown', () => {
    // card top + header + state + graph = 3 paddings on this card
    const config = withGraph();
    expect(getCardHeight(config, 100, CARD_PADDING) - getCardHeight(config, 100, 8))
      .toBe((CARD_PADDING - 8) * 3);
  });

  it('getCardHeight: a card with nothing but a graph saves only its own padding', () => {
    const bare = makeConfig({ graph: 'line' });
    expect(getCardHeight(bare, 100, CARD_PADDING) - getCardHeight(bare, 100, 8))
      .toBe(CARD_PADDING - 8);
  });

  it('getGridOptions: min_rows counts the compact chrome, so a card can shrink further', () => {
    const options = getGridOptions(withGraph({ height: 400 }));
    expect(options.min_rows).toBeLessThan(options.rows);
  });
});

describe('chrome against a measured card', () => {
  // Numbers from a probe on a real dashboard: a 6-row cell, height 320,
  // corner state, extrema shown. See getChromeHeight & INFO_HEIGHT_EM.
  const measured = (rest: any = {}) => ({
    font_size: 14,
    font_size_header: 14,
    height: 320,
    align_state: 'top-right',
    entities: [{ entity: 'sensor.a' }],
    show: {
      name: true, icon: true, state: true, graph: 'line', legend: true, extrema: true,
    },
    ...rest,
  });

  it('a legend is not chrome: it is drawn inside the graph', () => {
    const one = measured();
    const two = measured({ entities: [{ entity: 'sensor.a' }, { entity: 'sensor.b' }] });
    // ...so it costs a card height, but leaves the space left for the graph alone
    expect(getCardHeight(two, 0)).toBeGreaterThan(getCardHeight(one, 0));
    expect(getChromeHeight(two)).toBeLessThan(getCardHeight(two, 0));
    expect(getLegendHeight(two)).toBeGreaterThan(0);
    expect(getLegendHeight(one)).toBe(0);
  });

  it('matches what the card really renders, within a pixel', () => {
    // measured: 121.0 with a legend, 122.7 without
    const withLegend = measured({
      font_size_header: 13, entities: [{ entity: 'a' }, { entity: 'b' }],
    });
    expect(Math.abs(getChromeHeight(withLegend) - 121.0)).toBeLessThan(1);
    expect(Math.abs(getChromeHeight(measured()) - 122.7)).toBeLessThan(1);
  });

  it('counts the extrema row as the three lines it stacks', () => {
    const withExtrema = measured();
    const without = measured({ show: { ...measured().show, extrema: false } });
    // type, value & time, one above the other - not a single line
    expect(getChromeHeight(withExtrema) - getChromeHeight(without)).toBeGreaterThan(14 * 3);
  });
});
