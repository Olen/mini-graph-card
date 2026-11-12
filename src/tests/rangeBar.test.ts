/**
 * Tests for range bars (graph: range): each period drawn from a low to a high
 * value, with a marker between. Low, high & marker come from the entity's own
 * readings ("min", "max", ...) or from other entities - a heart rate's daily
 * min & max sensors, a blood pressure's diastolic & systolic.
 */

import {
  expect, describe, it, vi, beforeEach, afterEach,
} from 'vitest';
import Graph from '../graph';
import { checkRange } from '../checkOption';
import {
  isBarEntity, isRangeEntity, rangeEntityIds, statisticsSeries, fitsMeasurements,
} from '../others';
import buildConfig from '../buildConfig';
import { MIN_RANGE_HEIGHT } from '../const';

const NOW = new Date('2026-11-12T12:00:00Z');
// a reading `hours` before NOW; with 4 one-hour buckets, 3.5 lands in bucket 0
const at = (hours: number, state: number | string, extra = {}) => ({
  last_changed: new Date(NOW.getTime() - hours * 3600000).toISOString(),
  state: String(state),
  ...extra,
});

const mockLog = () => vi.spyOn(console, 'warn').mockImplementation(() => { });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// 4 one-hour buckets over 400 px, no margins, no spacing
const makeGraph = (range: any, over = {}) => new Graph({
  width: 400,
  height: 100,
  margin: [0, 0],
  hours_to_show: 4,
  points_per_hour: 1,
  bar_spacing: 0,
  bar_spacing_group: 0,
  range: checkRange(range, 'avg', 'range'),
  ...over,
});

const spans = (graph: Graph) => graph.ranges.map(({
  index, low, high, marker,
}) => ({
  index, low, high, marker,
}));

describe('checkRange()', () => {
  it('spans a bucket\'s min to max, marked at the aggregate, with gaps', () => {
    expect(checkRange(undefined, 'avg', 'range')).toEqual({
      low: { func: 'min' },
      high: { func: 'max' },
      marker: { func: 'avg' },
      gaps: true,
      colorBy: 'value',
    });
  });

  it('marks the value aggregate_func gives - or the average for one a range has not', () => {
    expect(checkRange({}, 'median', 'range').marker).toEqual({ func: 'median' });
    expect(checkRange({}, 'sum', 'range').marker).toEqual({ func: 'avg' });
  });

  it('reads another entity\'s last value for an entity id', () => {
    expect(checkRange({ low: 'sensor.diastolic' }, 'avg', 'range').low)
      .toEqual({ func: 'last', entity: 'sensor.diastolic' });
  });

  it('reads another entity with a chosen aggregate', () => {
    const range = checkRange({ high: { entity: 'sensor.hr', aggregate: 'max' } }, 'avg', 'range');
    expect(range.high).toEqual({ func: 'max', entity: 'sensor.hr' });
  });

  it('draws no marker with marker: false', () => {
    expect(checkRange({ marker: false }, 'avg', 'range').marker).toBe(false);
  });

  it('turns gaps off when asked', () => {
    expect(checkRange({ gaps: false }, 'avg', 'range').gaps).toBe(false);
  });

  it('reads the card\'s own entity as its own readings, however it is named', () => {
    const range = checkRange({
      low: 'sensor.sys',
      high: { entity: 'sensor.sys', aggregate: 'last' },
    }, 'avg', 'range', 'sensor.sys');
    expect(range.low).toEqual({ func: 'min' });
    expect(range.high).toEqual({ func: 'last' });
  });

  it('keeps a part\'s own colour thresholds, & its usual function without one', () => {
    const thresholds = [{ value: 80, color: 'red' }];
    const range = checkRange({
      low: { entity: 'sensor.dia', color_thresholds: thresholds },
      high: { color_thresholds: thresholds },
    }, 'avg', 'range', 'sensor.sys');
    expect(range.low).toEqual({ func: 'last', entity: 'sensor.dia', colorThresholds: thresholds });
    expect(range.high).toEqual({ func: 'max', colorThresholds: thresholds });
  });

  it('colours by a chosen part, or along the span', () => {
    expect(checkRange({ color_by: 'low' }, 'avg', 'range').colorBy).toBe('low');
    expect(checkRange({ color_by: 'span' }, 'avg', 'range').colorBy).toBe('span');
  });

  it('warns & falls back on a value it does not know', () => {
    const warn = mockLog();
    expect(checkRange({ low: 'lowest' }, 'avg', 'range').low).toEqual({ func: 'min' });
    expect(checkRange({ high: { entity: 'sensor.x', aggregate: 'sum' } }, 'avg', 'range').high)
      .toEqual({ func: 'last', entity: 'sensor.x' });
    expect(checkRange({ gaps: 'no' }, 'avg', 'range').gaps).toBe(true);
    expect(checkRange('min', 'avg', 'range').low).toEqual({ func: 'min' });
    expect(checkRange({ color_by: 'coldest' }, 'avg', 'range').colorBy).toBe('value');
    expect(warn).toHaveBeenCalledTimes(5);
  });
});

describe('range bar entities', () => {
  const config = (graph: string) => ({ show: { graph } });

  it('are bars - they take a bar\'s place in a group', () => {
    expect(isBarEntity({ graph: 'range' }, config('line'))).toBe(true);
    expect(isBarEntity({}, config('range'))).toBe(true);
  });

  it('are told apart from plain bars', () => {
    expect(isRangeEntity({ graph: 'range' }, config('line'))).toBe(true);
    expect(isRangeEntity({ graph: 'bar' }, config('range'))).toBe(false);
    expect(isRangeEntity({}, config('bar'))).toBe(false);
  });

  it('read each other entity once', () => {
    const range = checkRange({
      low: 'sensor.min_hr', high: 'sensor.max_hr', marker: 'sensor.min_hr',
    }, 'avg', 'range');
    expect(rangeEntityIds(range)).toEqual(['sensor.min_hr', 'sensor.max_hr']);
    expect(rangeEntityIds(checkRange({}, 'avg', 'range'))).toEqual([]);
    expect(rangeEntityIds(undefined)).toEqual([]);
  });

  it('get a checked range option from buildConfig, also card-wide', () => {
    const { config: built } = buildConfig({
      entities: ['sensor.a', { entity: 'sensor.b', graph: 'line' }],
      show: { graph: 'range' },
    });
    expect(built.entities[0].range.low).toEqual({ func: 'min' });
    expect(built.entities[1].range).toBeUndefined();
  });

  it('get a part\'s colour thresholds prepared as an entity\'s are', () => {
    const { config: built } = buildConfig({
      entities: [{
        entity: 'sensor.sys',
        graph: 'range',
        range: {
          color_by: 'ends',
          low: {
            entity: 'sensor.dia',
            color_thresholds: [{ value: 0, color: 'green' }, { value: 80, color: 'red' }],
          },
        },
      }],
    });
    const { range } = built.entities[0];
    expect(range.colorBy).toBe('ends');
    // highest first, as computeColor() looks them up
    expect(range.low.colorThresholds.map(stop => stop.value)).toEqual([80, 0]);
    expect(range.high.colorThresholds).toBeUndefined();
  });

  it('accept graph: range on an entity', () => {
    const { config: built } = buildConfig({
      entities: [{ entity: 'sensor.bp', graph: 'range', range: { low: 'sensor.dia', marker: false } }],
    });
    expect(built.entities[0].graph).toBe('range');
    expect(built.entities[0].range.low).toEqual({ func: 'last', entity: 'sensor.dia' });
    expect(built.entities[0].range.marker).toBe(false);
  });
});

describe('Graph range bars from one entity', () => {
  it('span each bucket\'s readings & the value held when it opened', () => {
    const graph = makeGraph({});
    graph.update([at(5, 10), at(3.5, 14), at(3.2, 12), at(2.5, 20)]);
    expect(spans(graph)).toEqual([
      // 10 was held from before the window, so it is part of the first hour
      { index: 0, low: 10, high: 14, marker: 13 },
      { index: 1, low: 12, high: 20, marker: 20 },
    ]);
  });

  it('leave a bucket without readings empty', () => {
    const graph = makeGraph({});
    graph.update([at(3.5, 10), at(0.5, 30)]);
    expect(graph.ranges.map(range => range.index)).toEqual([0, 3]);
  });

  it('repeat the held value there with gaps off', () => {
    const graph = makeGraph({ gaps: false });
    graph.update([at(3.5, 10), at(0.5, 30)]);
    expect(spans(graph)).toEqual([
      { index: 0, low: 10, high: 10, marker: 10 },
      { index: 1, low: 10, high: 10, marker: 10 },
      { index: 2, low: 10, high: 10, marker: 10 },
      { index: 3, low: 10, high: 30, marker: 30 },
    ]);
  });

  it('take statistics rows\' own min & max, & not the held mean', () => {
    const graph = makeGraph({}, { statistics: true });
    graph.update([
      at(4, 50, { min: 40, max: 60 }),
      at(3, 20, { min: 15, max: 25 }),
      at(2.5, 22, { min: 18, max: 30 }),
    ]);
    expect(spans(graph)).toEqual([{
      index: 1, low: 15, high: 30, marker: 21,
    }]);
  });

  it('stand for their marker, else their high', () => {
    const marked = makeGraph({});
    marked.update([at(3.5, 10), at(3.2, 20)]);
    expect(marked.coords[0][2]).toBe(15);

    const unmarked = makeGraph({ marker: false });
    unmarked.update([at(3.5, 10), at(3.2, 20)]);
    expect(unmarked.ranges[0].marker).toBeUndefined();
    expect(unmarked.coords[0][2]).toBe(20);
  });

  it('size the axis to the lows & highs', () => {
    const graph = makeGraph({});
    graph.update([at(3.5, 10), at(3.2, 20), at(0.5, -5), at(0.2, 40)]);
    expect([graph.min, graph.max]).toEqual([-5, 40]);
  });
});

describe('Graph range bars from other entities', () => {
  // a blood pressure: systolic is the card's entity, diastolic another one
  const bloodPressure = (gaps = true) => {
    const graph = makeGraph({
      low: 'sensor.dia', high: 'last', marker: false, gaps,
    });
    graph.setRangeHistory('sensor.dia', [at(3.5, 80), at(1.5, 75)]);
    graph.update([at(3.5, 120), at(1.5, 118)]);
    return graph;
  };

  it('span from one entity to another', () => {
    expect(spans(bloodPressure())).toEqual([
      {
        index: 0, low: 80, high: 120, marker: undefined,
      },
      {
        index: 2, low: 75, high: 118, marker: undefined,
      },
    ]);
  });

  it('do not repeat a measurement in the periods after it', () => {
    expect(bloodPressure().ranges.map(range => range.index)).toEqual([0, 2]);
    expect(bloodPressure(false).ranges.map(range => range.index)).toEqual([0, 1, 2, 3]);
  });

  it('draw a period any of the entities reported in', () => {
    const graph = makeGraph({ low: 'sensor.min_hr', high: 'sensor.max_hr', marker: 'last' });
    graph.setRangeHistory('sensor.min_hr', [at(5, 50), at(2.5, 48)]);
    graph.setRangeHistory('sensor.max_hr', [at(5, 150)]);
    graph.update([at(5, 60)]);
    // only min_hr reported in the window; the others are held
    expect(spans(graph)).toEqual([{
      index: 1, low: 48, high: 150, marker: 60,
    }]);
  });

  it('put low below high whichever entity holds which', () => {
    const graph = makeGraph({ low: 'sensor.higher', high: 'last' });
    graph.setRangeHistory('sensor.higher', [at(3.5, 90)]);
    graph.update([at(3.5, 30)]);
    expect(graph.ranges[0]).toMatchObject({ low: 30, high: 90 });
  });

  it('draw nothing before another entity has a value', () => {
    const graph = makeGraph({ low: 'sensor.later' });
    graph.update([at(3.5, 30)]);
    expect(graph.ranges).toEqual([]);
  });
});

describe('Graph range bar gaps', () => {
  const pressure = (over = {}) => makeGraph({
    low: 'sensor.dia', high: 'last', marker: false,
  }, over);

  it('are not filled by a restart writing the same value again', () => {
    const graph = pressure();
    graph.setRangeHistory('sensor.dia', [at(3.5, 80), at(1.5, 80)]);
    graph.update([at(3.5, 120), at(1.5, 120)]);
    expect(graph.ranges.map(range => range.index)).toEqual([0]);
  });

  it('are filled by a change in either entity', () => {
    const graph = pressure();
    graph.setRangeHistory('sensor.dia', [at(3.5, 80), at(1.5, 79)]);
    graph.update([at(3.5, 120), at(1.5, 120)]);
    expect(spans(graph)).toEqual([
      {
        index: 0, low: 80, high: 120, marker: undefined,
      },
      {
        index: 2, low: 79, high: 120, marker: undefined,
      },
    ]);
  });

  it('come from statistics rows whose min equals their max', () => {
    // hourly rows: the value went 121 -> 115 in the second hour
    const rows = (value: number) => [
      at(4, 121, { min: 121, max: 121 }),
      at(3, value === 115 ? 116.8 : value, { min: 115, max: 121 }),
      at(2, 115, { min: 115, max: 115 }),
      at(1, 115, { min: 115, max: 115 }),
    ];
    const graph = pressure({ statistics: true });
    graph.setRangeHistory('sensor.dia', [
      at(4, 80, { min: 80, max: 80 }),
      at(3, 75, { min: 75, max: 75 }),
      at(2, 75, { min: 75, max: 75 }),
      at(1, 75, { min: 75, max: 75 }),
    ]);
    graph.update(rows(115));
    // the hour the value changed in, read at the value it changed to
    expect(spans(graph)).toEqual([{
      index: 1, low: 75, high: 115, marker: undefined,
    }]);
  });

  it('see a change a sensor was unavailable over, with no statistics rows for it', () => {
    const graph = makeGraph({ high: 'last', low: 'last' }, { statistics: true });
    graph.update([at(4, 118, { min: 118, max: 118 }), at(1.5, 111, { min: 111, max: 111 })]);
    expect(spans(graph)).toEqual([{
      index: 2, low: 111, high: 111, marker: 111,
    }]);
  });

  it('do not take the first statistics row for a measurement', () => {
    // nothing before the window to compare it with: it holds an older one
    const graph = makeGraph({ high: 'last', low: 'last' }, { statistics: true });
    graph.update([at(3.5, 120, { min: 120, max: 120 }), at(1.5, 109, { min: 109, max: 109 })]);
    expect(graph.ranges.map(range => range.index)).toEqual([2]);
  });

  it('read a statistics row the value changed twice in from the steady row after it', () => {
    // 121 -> 110 -> 115 within the second hour: its span is 110-121, the end 115
    const graph = makeGraph({ high: 'last', low: 'last' }, { statistics: true });
    graph.update([
      at(4, 121, { min: 121, max: 121 }),
      at(3, 114, { min: 110, max: 121 }),
      at(2, 115, { min: 115, max: 115 }),
    ]);
    expect(graph.ranges[0]).toMatchObject({ index: 1, low: 115, high: 115 });
  });

  it('read the newest statistics row at the end its span did not start from', () => {
    const graph = makeGraph({ high: 'last', low: 'last' }, { statistics: true });
    graph.update([at(4, 121, { min: 121, max: 121 }), at(0.5, 117, { min: 115, max: 121 })]);
    expect(graph.ranges[0]).toMatchObject({ index: 3, low: 115, high: 115 });
  });
});

describe('Graph.getRanges()', () => {
  it('lays range bars out where getBars() puts bars without gaps', () => {
    const graph = makeGraph({ gaps: false });
    graph.update([at(3.5, 0), at(3.2, 100), at(0.5, 50)]);
    [graph.min, graph.max] = [0, 100];
    const bars = graph.getBars(0);
    const ranges = graph.getRanges(0);
    expect(ranges.map(range => [range.x, range.width]))
      .toEqual(bars.map(bar => [bar.x, bar.width]));
  });

  it('spans from the high\'s Y to the low\'s, the marker in between', () => {
    const graph = makeGraph({});
    graph.update([at(3.5, 20), at(3.2, 80)]);
    [graph.min, graph.max] = [0, 100];
    const [range] = graph.getRanges(0);
    expect(range).toMatchObject({
      y: 20, height: 60, markerY: 50, tip: 20, base: 80,
    });
  });

  it('keeps a range with no height visible', () => {
    const graph = makeGraph({});
    graph.update([at(3.5, 50)]);
    [graph.min, graph.max] = [0, 100];
    const [range] = graph.getRanges(0);
    expect(range.height).toBe(MIN_RANGE_HEIGHT);
    expect(range.y + range.height / 2).toBe(50);
  });
});

describe('Graph.getRanges() colour', () => {
  // a span from 2 to 8 with its marker at 5
  const colourOf = (colorBy: string, marker: any = undefined) => {
    const graph = makeGraph({ color_by: colorBy, marker });
    graph.update([at(3.5, 2), at(3.4, 8), at(3.3, 5)]);
    [graph.min, graph.max] = [0, 10];
    return graph.getRanges(0)[0].colorValue;
  };

  it('comes from the value the bar stands for by default', () => {
    expect(colourOf('value')).toBe(5);
    expect(colourOf('value', false)).toBe(8);
  });

  it('comes from the low, the high or the marker when asked', () => {
    expect(colourOf('low')).toBe(2);
    expect(colourOf('high')).toBe(8);
    expect(colourOf('marker')).toBe(5);
    expect(colourOf('marker', false)).toBe(8);
  });

  it('comes from no one value along the span, or from its ends', () => {
    expect(colourOf('span')).toBeUndefined();
    expect(colourOf('ends')).toBeUndefined();
  });

  it('knows where the ends are drawn', () => {
    const graph = makeGraph({ color_by: 'ends' });
    graph.update([at(3.5, 2), at(3.4, 8)]);
    [graph.min, graph.max] = [0, 10];
    expect(graph.getRanges(0)[0]).toMatchObject({ lowY: 80, highY: 20 });
  });
});

describe('Graph.getRanges() by measurements', () => {
  // 10 one-hour buckets over 1000 px: bucket i is centred on 100 * i + 50
  const measured = (hoursAgo: number[], over = {}) => {
    const graph = new Graph({
      width: 1000,
      height: 100,
      margin: [0, 0],
      hours_to_show: 10,
      points_per_hour: 1,
      range: checkRange({}, 'avg', 'range'),
      fitsMeasurements: true,
      ...over,
    });
    graph.update(hoursAgo.map(hours => at(hours, hours)));
    [graph.min, graph.max] = [0, 10];
    return graph.getRanges(0).map(({ x, width }) => [x, width]);
  };

  it('keeps 1 px between measurements in neighbouring periods', () => {
    // buckets 3, 4 & 5
    expect(measured([6.5, 5.5, 4.5])).toEqual([[300.5, 99], [400.5, 99], [500.5, 99]]);
  });

  it('shows a missed measurement as a wider gap, the bars as wide as usual', () => {
    // buckets 1, 2, 3 & 7: the usual distance is 100 px
    expect(measured([8.5, 7.5, 6.5, 2.5])).toEqual([
      [100.5, 99], [200.5, 99], [300.5, 99], [700.5, 99],
    ]);
  });

  it('makes every bar as wide as the closest two allow, centred on its time', () => {
    // mostly 400 px apart, but two of them in neighbouring periods
    expect(measured([9.5, 5.5, 4.5, 0.5])).toEqual([
      [0.5, 99], [400.5, 99], [500.5, 99], [900.5, 99],
    ]);
  });

  it('keeps a bar at an end of the graph inside it', () => {
    // buckets 0 & 9: 900 px apart, but only 50 px to each edge
    expect(measured([9.5, 0.5])).toEqual([[0, 499.5], [500.5, 499.5]]);
  });

  it('draws a bar at least 2 px wide', () => {
    const graph = new Graph({
      width: 100,
      height: 100,
      margin: [0, 0],
      hours_to_show: 200,
      points_per_hour: 1,
      range: checkRange({}, 'avg', 'range'),
      fitsMeasurements: true,
    });
    graph.update([at(10.5, 1), at(9.5, 2)]);
    [graph.min, graph.max] = [0, 10];
    expect(graph.getRanges(0).map(bar => bar.width)).toEqual([2, 2]);
  });

  it('keeps the slots when the card says so', () => {
    expect(measured([6.5, 2.5], { fitsMeasurements: false, total_bars_in_group: 2 })[0][1])
      .toBeLessThan(99);
    // a slot per period from the first reading on, measured or not
    expect(measured([6.5, 2.5], { range: checkRange({ gaps: false }, 'avg', 'range') }))
      .toHaveLength(7);
  });
});

describe('fitsMeasurements()', () => {
  const card = (entities: any[]) => buildConfig({ entities }).config;
  const pressure = { entity: 'sensor.sys', graph: 'range' };

  it('lays range bars with gaps out by their measurements', () => {
    expect(fitsMeasurements(card([pressure]), 0)).toBe(true);
  });

  it('does so beside static values, which are flat', () => {
    expect(fitsMeasurements(card([pressure, { static_value: 80 }, { static_value: 120 }]), 0))
      .toBe(true);
  });

  it('keeps the slots beside another graph', () => {
    expect(fitsMeasurements(card([pressure, 'sensor.pulse']), 0)).toBe(false);
    expect(fitsMeasurements(card([pressure, { entity: 'sensor.pulse', show_graph: false }]), 0))
      .toBe(true);
  });

  it('keeps the slots without gaps, and for other graphs', () => {
    expect(fitsMeasurements(card([{ ...pressure, range: { gaps: false } }]), 0)).toBe(false);
    expect(fitsMeasurements(card(['sensor.sys']), 0)).toBe(false);
  });
});

describe('range bars and the bar limit', () => {
  it('do not count against it with gaps: only measured periods are drawn', () => {
    const { config: built } = buildConfig({
      entities: [{ entity: 'sensor.bp', graph: 'range' }],
      hours_to_show: 4368,
      group_by: 'date',
    });
    expect(built.points_per_hour).toBe(1 / 24);
  });

  it('do without gaps', () => {
    mockLog();
    const { config: built } = buildConfig({
      entities: [{ entity: 'sensor.bp', graph: 'range', range: { gaps: false } }],
      hours_to_show: 4368,
      group_by: 'date',
    });
    expect(built.points_per_hour).toBeLessThan(1 / 24);
  });
});

describe('statisticsSeries()', () => {
  it('keeps a row\'s min & max beside the chosen type', () => {
    const series = statisticsSeries([
      {
        start: NOW.getTime(), mean: 20, min: 15, max: 25,
      },
      {
        start: NOW.getTime(), mean: 21, min: null, max: null,
      },
      { start: NOW.getTime(), mean: null },
    ], 'mean');
    expect(series).toEqual([
      {
        last_changed: NOW.toISOString(), state: 20, min: 15, max: 25,
      },
      { last_changed: NOW.toISOString(), state: 21 },
    ]);
  });
});
