/**
 * Tests for parseGraphHeight(), getGraphHeightPx() & getDesiredCardHeight().
 *
 * "height" is a desired CARD height & decides where HA puts the card;
 * "graph_height" only says how tall the graph is drawn inside it. A graph is
 * anchored to the bottom, so the taller it is the more of the card's own chrome
 * it slides behind - up to 100%, which puts it behind everything.
 */

import { expect, describe, it } from 'vitest';
import {
  parseGraphHeight, getGraphHeightPx, getDesiredCardHeight, getCardHeight,
} from '../others';
import { DEFAULT_GRAPH_HEIGHT } from '../const';

const makeConfig = (graphHeight: any = 'auto', rest: any = {}) => ({
  entities: [{ entity: 'sensor.test' }],
  font_size: 14,
  font_size_header: 14,
  graph_height: parseGraphHeight(graphHeight),
  show: {
    name: true, icon: true, state: true, graph: 'line', legend: false, extrema: false,
  },
  ...rest,
});

describe('parseGraphHeight', () => {
  it('defaults to auto', () => {
    expect(parseGraphHeight(undefined)).toEqual({ mode: 'auto' });
    expect(parseGraphHeight(null)).toEqual({ mode: 'auto' });
    expect(parseGraphHeight('auto')).toEqual({ mode: 'auto' });
  });

  it('reads pixels from a number or a numeric string', () => {
    expect(parseGraphHeight(120)).toEqual({ mode: 'px', value: 120 });
    expect(parseGraphHeight('120')).toEqual({ mode: 'px', value: 120 });
    expect(parseGraphHeight(0)).toEqual({ mode: 'px', value: 0 });
  });

  it('reads a percentage', () => {
    expect(parseGraphHeight('60%')).toEqual({ mode: 'percent', value: 60 });
    expect(parseGraphHeight('62.5%')).toEqual({ mode: 'percent', value: 62.5 });
    expect(parseGraphHeight(' 60 % ')).toEqual({ mode: 'percent', value: 60 });
    expect(parseGraphHeight('150%')).toEqual({ mode: 'percent', value: 150 });
  });

  it('falls back to auto for anything else', () => {
    ['', 'tall', '%', '50 px', '-10', -10, 'full', 'below_header', {}, []].forEach((value) => {
      expect(parseGraphHeight(value), JSON.stringify(value)).toEqual({ mode: 'auto' });
    });
  });
});

describe('getGraphHeightPx', () => {
  it('auto: whatever the chrome leaves', () => {
    const config = makeConfig('auto');
    const card = 300;
    expect(getGraphHeightPx(config, card)).toBe(card - getCardHeight(config, 0));
  });

  it('px: exactly what was asked for, whatever the card', () => {
    expect(getGraphHeightPx(makeConfig(120), 300)).toBe(120);
    expect(getGraphHeightPx(makeConfig(120), 900)).toBe(120);
  });

  it('percent: a share of the card, so it tracks the cell', () => {
    expect(getGraphHeightPx(makeConfig('50%'), 300)).toBe(150);
    expect(getGraphHeightPx(makeConfig('50%'), 400)).toBe(200);
    expect(getGraphHeightPx(makeConfig('100%'), 300)).toBe(300);
  });
});

describe('getDesiredCardHeight', () => {
  it('is the configured height, taken as the card height', () => {
    expect(getDesiredCardHeight(makeConfig('auto', { height: 250 }))).toBe(250);
  });

  it('unset, asks for the chrome plus a default-sized graph', () => {
    const config = makeConfig('auto', { height: undefined });
    expect(getDesiredCardHeight(config)).toBe(getCardHeight(config, DEFAULT_GRAPH_HEIGHT));
  });

  it('is not changed by graph_height - that only draws', () => {
    const base = { height: 250 };
    expect(getDesiredCardHeight(makeConfig('100%', base)))
      .toBe(getDesiredCardHeight(makeConfig('auto', base)));
  });
});
