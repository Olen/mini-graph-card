import { interpolateRGB } from './color';
import {
  X, Y, V, BUCKET,
  ONE_HOUR,
  DEFAULT_BAR_SPACING,
  MIN_RANGE_HEIGHT,
} from './const';
import { log } from './utils';
import {
  getIntervalEndDate, getLog10, timeWeightedAverage, bucketCount,
} from './others';

export default class Graph {
  constructor({
    width,
    height,
    margin,
    hours_to_show = 24,
    points_per_hour = 1,
    aggregateFuncName = 'avg',
    groupBy = 'interval',
    smoothing = true,
    logarithmic = false,
    bar_spacing = DEFAULT_BAR_SPACING, // spacing between bars
    bar_spacing_group = DEFAULT_BAR_SPACING, // spacing between groups of bars
    total_bars_in_group = 1, // number of bars (i.e. number of entities with a shown bar graph)
    baseline,
    overallFuncName, // undefined: no overall value
    invert = false, // low values at the top
    barCentres = false, // a line's points at the centres of bars drawn beside it
    range, // a range bar's parts (see checkRange); undefined for other graphs
    statistics = false, // the history is statistics rows, which carry min & max
  }) {
    const aggregateFuncMap = {
      avg: this._average,
      median: this._median,
      max: this._maximum,
      min: this._minimum,
      first: this._first,
      last: this._last,
      sum: this._sum,
      delta: this._delta,
      diff: this._diff,
    };

    this._history = undefined;
    this.coords = [];
    this._margin = margin;
    this.setSize(width, height);
    this._max = 0;
    this._min = 0;
    this._points_per_hour = points_per_hour;
    this._hours_to_show = hours_to_show;
    this._aggregateFuncName = aggregateFuncName;
    this._aggregateFuncMap = aggregateFuncMap;
    this._calcPoint = aggregateFuncMap[aggregateFuncName] || this._average;
    this._smoothing = smoothing;
    this._logarithmic = logarithmic;
    this._bar_spacing = bar_spacing;
    this._bar_spacing_group = bar_spacing_group;
    this._total_bars_in_group = total_bars_in_group;
    this._groupBy = groupBy;
    this._endTime = 0;
    this._baseline = baseline;
    this._invert = invert;
    this._barCentres = barCentres;
    this._overallFuncName = overallFuncName;
    this.overall = undefined;
    this._range = range;
    this._statistics = statistics;
    this._rangeHistories = {};
    this.ranges = [];
  }

  get max() { return this._max; }

  set max(max) { this._max = max; }

  get min() { return this._min; }

  set min(min) { this._min = min; }

  set history(data) { this._history = data; }

  /**
   * The history of another entity a range bar reads.
   * @param {string} entityId The entity
   * @param {Array} data Its [{last_changed, state}] series
   */
  setRangeHistory(entityId, data) { this._rangeHistories[entityId] = data; }

  get calculatesOverall() { return this._overallFuncName !== undefined; }


  /**
   * Set a size a graph is drawn in, in pixels: a card follows a size of its
   * cell, and a viewBox matches an element 1:1 so nothing is scaled.
   * @param {number} width Width in pixels
   * @param {number} height Height in pixels
   */
  setSize(width, height) {
    this._width = width - this._margin[X] * 2;
    this._height = height - this._margin[Y] * 4;
  }

  /**
   * Y for a value, by the very transform the coordinates use - a grid line
   * drawn from its own copy of the maths would drift from the data it labels.
   * @param {number} value A value in the entity's own units
   * @returns {number} A Y coordinate
   */
  getY(value) {
    const max = this._logarithmic ? getLog10(this.max) : this.max;
    const min = this._logarithmic ? getLog10(this.min) : this.min;
    const val = this._logarithmic ? getLog10(value) : value;
    const yRatio = ((max - min) / this._height) || 1;
    const fromMin = (val - min) / yRatio;
    const fromTop = this._invert ? fromMin : this._height - fromMin;
    return fromTop + this._margin[Y] * 2;
  }

  get inverted() { return this._invert; }

  /**
   * X of a moment, on the scale the points are drawn on: the start of a bucket
   * lands on that bucket's point, so a grid line marks the value it belongs to.
   * The window ends at _endTime, which group_by rounds (see _updateEndTime).
   * @param {number} time Epoch ms
   * @returns {number} X coordinate
   */
  getX(time) {
    const bucket = ONE_HOUR / this._points_per_hour;
    const windowStart = this._endTime - this._hours_to_show * ONE_HOUR;
    return this._xAt((time - windowStart) / bucket);
  }

  /** X of the newest point; nothing is drawn past it. */
  get rightEdgeX() {
    // a lone bucket still draws its line edge to edge
    if (!this._barCentres) return this._margin[X] + this._width;
    return this._xAt(this._bucketCount() - 1);
  }

  _bucketCount() {
    return bucketCount(this._hours_to_show, this._points_per_hour);
  }

  /**
   * X of a bucket position (fractional between buckets). Points normally
   * spread edge to edge, the first and last on the edges; next to bars they
   * sit at the centre of their bucket's bar group, as getBars() lays it out.
   * @param {number} position Bucket index, 0 = oldest
   * @returns {number} X coordinate
   */
  _xAt(position) {
    if (this._barCentres) {
      const count = this._bucketCount();
      const groupWidth = (this._width - this._bar_spacing_group * (count - 1)) / count;
      return this._margin[X] + (groupWidth + this._bar_spacing_group) * position + groupWidth / 2;
    }
    return this._margin[X] + this._xRatio() * position;
  }

  /** Distance between two neighbouring points: the first and last sit on the edges. */
  _xRatio() {
    const ratio = this._width / (this._hours_to_show * this._points_per_hour - 1);
    return Number.isFinite(ratio) ? ratio : this._width;
  }

  update(history = undefined) {
    if (history) {
      this._history = history;
    }
    if (!this._history) return;
    // An entity can have no state change inside the shown window: its history
    // was purged, it went unavailable long ago, or its value simply has not
    // moved. There is nothing to plot & nothing to carry forward into the
    // empty buckets either - _calcPoints() would take a "last value" off an
    // undefined item. The history stays SET, so the card can tell this apart
    // from one which has not loaded yet.
    if (this._history.length === 0) {
      this.coords = [];
      this.overall = undefined;
      return;
    }
    this._updateEndTime();

    const readings = this._windowHistory(this._history);
    this.overall = this.calculatesOverall ? this._calcOverall(readings) : undefined;
    const histGroups = readings.reduce((res, item) => this._reducer(res, item), []);

    // extend length to fill missing history
    const requiredNumOfPoints = bucketCount(this._hours_to_show, this._points_per_hour);
    histGroups.length = requiredNumOfPoints;

    if (this._range) {
      this.ranges = this._calcRanges();
      this.coords = this.ranges.map(range => [
        this._xAt(range.index), 0, this._rangeValue(range), range.index,
      ]);
      const values = [];
      this.ranges.forEach((range) => {
        values.push(range.low, range.high);
        if (range.marker !== undefined) values.push(range.marker);
      });
      this.min = Math.min(...values);
      this.max = Math.max(...values);
      return;
    }

    this.coords = this._calcPoints(histGroups);
    this.min = Math.min(...this.coords.map(item => Number(item[V])));
    this.max = Math.max(...this.coords.map(item => Number(item[V])));
  }

  /** The one value a range bar stands for - its marker, else its high. */
  _rangeValue(range) {
    return range.marker !== undefined ? range.marker : range.high;
  }

  /**
   * The readings inside the window, preceded by the newest one from before it:
   * that is what the sensor read when the window opened. Older ones are left
   * out, so a quiet sensor's left edge does not average its whole past.
   * @param {Array} history State history, in any order
   * @returns {Array} The readings to sort into buckets
   */
  _windowHistory(history) {
    const windowStart = this._endTime - this._hours_to_show * ONE_HOUR;
    const inside = [];
    let opening;
    history.forEach((item) => {
      const time = new Date(item.last_changed).getTime();
      if (time > windowStart) {
        inside.push(item);
      } else if (!opening || time >= new Date(opening.last_changed).getTime()) {
        opening = item;
      }
    });
    return opening ? [opening, ...inside] : inside;
  }

  /**
   * One value for the whole window, from the same readings as the graph. The
   * average weighs each reading by how long it held, so a burst of reports
   * does not outweigh a quiet day.
   * @param {Array} readings The window's readings (see _windowHistory)
   * @returns {number|undefined} The value, or undefined with no numeric reading
   */
  _calcOverall(readings) {
    if (this._overallFuncName === 'avg') {
      const windowStart = this._endTime - this._hours_to_show * ONE_HOUR;
      return timeWeightedAverage(readings, windowStart, Date.now());
    }
    const numeric = readings.filter(item => !Number.isNaN(parseFloat(item.state)));
    if (numeric.length === 0) return undefined;
    return this._aggregateFuncMap[this._overallFuncName].call(this, numeric);
  }

  /**
   * The bucket a reading belongs in, or undefined for the one from before the
   * window (see _windowHistory).
   * @param {object} item A reading
   * @returns {number|undefined} Bucket index, 0 = oldest
   */
  _bucketOf(item) {
    const age = this._endTime - new Date(item.last_changed).getTime();
    const interval = (age / ONE_HOUR * this._points_per_hour)
      - this._hours_to_show * this._points_per_hour;
    if (interval >= 0) return undefined;
    // A reading taken right now lands one bucket past the last, and the
    // length trim below then discarded it - so the newest value never
    // reached the graph. Hold it in the final bucket instead.
    const maxKey = bucketCount(this._hours_to_show, this._points_per_hour) - 1;
    return Math.min(Math.floor(Math.abs(interval)), maxKey);
  }

  _reducer(res, item) {
    // The reading that opened the window goes in the first bucket. Pushed, not
    // assigned, so in-window readings already in that bucket are kept.
    const bucket = this._bucketOf(item);
    const key = bucket === undefined ? 0 : bucket;
    if (!res[key]) res[key] = [];
    res[key].push(item);
    return res;
  }

  /**
   * A history split into buckets: the readings taken in each, the one that
   * was held when it opened - Home Assistant keeps a state until the next, so
   * that value was there too - and whether the value changed in it.
   *
   * A reading is not a measurement: a restart or a sensor back from
   * unavailable writes the same value again. A change is what tells that
   * something was measured - in a statistics row, a min that differs from
   * its max. A measurement repeating the last value cannot be told apart.
   * @param {Array} history A [{last_changed, state}] series
   * @returns {Array<{fresh: Array, held: (object|undefined), changed: boolean}>}
   * One per bucket
   */
  _bucketed(history) {
    const time = item => new Date(item.last_changed).getTime();
    const readings = this._windowHistory(history)
      .filter(item => !Number.isNaN(parseFloat(item.state)))
      .sort((a, b) => time(a) - time(b));
    if (this._statistics) this._markEndValues(readings);
    const buckets = Array.from({ length: this._bucketCount() }, () => ({
      fresh: [], changed: false,
    }));
    let previous;
    readings.forEach((item) => {
      const bucket = this._bucketOf(item);
      if (bucket !== undefined) {
        buckets[bucket].fresh.push(item);
        if (this._changedSince(item, previous)) buckets[bucket].changed = true;
      }
      previous = item;
    });
    let held = readings.length > 0 && this._bucketOf(readings[0]) === undefined
      ? readings[0] : undefined;
    buckets.forEach((bucket) => {
      // eslint-disable-next-line no-param-reassign
      bucket.held = held;
      if (bucket.fresh.length > 0) held = bucket.fresh[bucket.fresh.length - 1];
    });
    return buckets;
  }

  /**
   * Whether a reading is a new value: a statistics row whose min & max differ,
   * or a value unlike the reading before it - which is how a change shows when
   * a sensor was unavailable over it, and statistics have no rows for that.
   * @param {object} item A reading
   * @param {object} [previous] The reading before it
   * @returns {boolean} True for a change
   */
  _changedSince(item, previous) {
    const hasRange = item.min !== undefined && item.max !== undefined;
    if (this._statistics && hasRange && parseFloat(item.min) !== parseFloat(item.max)) return true;
    if (previous === undefined) return true;
    return parseFloat(this._endValue(item)) !== parseFloat(this._endValue(previous));
  }

  /**
   * Give each statistics row the value it ended at, which "first" & "last"
   * read: a row the value changed in has a mean mixing the old & the new one.
   * The next row tells, if nothing changed in it; else the end of the row's
   * span that is not the value held before it.
   * @param {Array} rows Statistics rows in time order; changed in place
   */
  _markEndValues(rows) {
    let before;
    rows.forEach((row, i) => {
      const steady = item => item && item.min !== undefined && item.max !== undefined
        && parseFloat(item.min) === parseFloat(item.max);
      const next = rows[i + 1];
      let end = parseFloat(row.state);
      if (row.min !== undefined && row.max !== undefined && !steady(row)) {
        if (steady(next)) end = parseFloat(next.state);
        else if (before === parseFloat(row.min)) end = parseFloat(row.max);
        else if (before === parseFloat(row.max)) end = parseFloat(row.min);
      }
      // eslint-disable-next-line no-param-reassign
      row.end = end;
      before = end;
    });
  }

  /** The value a reading ends at: a statistics row's end, else its state. */
  _endValue(item) {
    return item.end !== undefined ? item.end : parseFloat(item.state);
  }

  /**
   * One part of a range bar for one bucket. "min" & "max" take a statistics
   * row's own min & max, and from a raw history the held value as well; the
   * rest look at the bucket's readings. A bucket without readings keeps the
   * held value.
   * @param {string} func One of RANGE_FUNCS
   * @param {{fresh: Array, held: object}} bucket From _bucketed()
   * @returns {number|undefined} The value, or undefined before any reading
   */
  _rangePart(func, bucket) {
    const { fresh, held } = bucket;
    const number = (item, key) => parseFloat(
      this._statistics && item[key] !== undefined && item[key] !== null ? item[key] : item.state,
    );
    if (fresh.length === 0) return held === undefined ? undefined : this._endValue(held);
    if (func === 'min' || func === 'max') {
      const values = fresh.map(item => number(item, func));
      if (!this._statistics && held !== undefined) values.push(parseFloat(held.state));
      return func === 'min' ? Math.min(...values) : Math.max(...values);
    }
    if (func === 'first') return this._endValue(fresh[0]);
    if (func === 'last') return this._endValue(fresh[fresh.length - 1]);
    const calc = { avg: this._average, median: this._median }[func];
    return calc.call(this, fresh);
  }

  /**
   * Low, high & marker of every bucket a range bar is drawn in. With gaps, a
   * bucket none of its entities changed in is left out rather than repeating
   * the last value.
   * @returns {Array<{index, low, high, marker}>} Ascending by bucket
   */
  _calcRanges() {
    const SELF = '';
    const parts = ['low', 'high', 'marker'].filter(name => this._range[name]);
    const sources = {};
    parts.forEach((name) => {
      const key = this._range[name].entity || SELF;
      if (sources[key]) return;
      const history = key === SELF ? this._history : this._rangeHistories[key];
      sources[key] = this._bucketed(history || []);
    });

    const ranges = [];
    for (let index = 0; index < this._bucketCount(); index += 1) {
      const measured = Object.values(sources).some(buckets => buckets[index].changed);
      if (this._range.gaps && !measured) continue; // eslint-disable-line no-continue
      const value = {};
      parts.forEach((name) => {
        const part = this._range[name];
        value[name] = this._rangePart(part.func, sources[part.entity || SELF][index]);
      });
      if (value.low !== undefined && value.high !== undefined
        && !Number.isNaN(value.low) && !Number.isNaN(value.high)) {
        const marker = value.marker !== undefined && !Number.isNaN(value.marker)
          ? value.marker : undefined;
        ranges.push({
          index,
          low: Math.min(value.low, value.high),
          high: Math.max(value.low, value.high),
          marker,
        });
      }
    }
    return ranges;
  }

  _calcPoints(history) {
    const coords = [];

    // A bucket that reported nothing carries the previous value forward: Home
    // Assistant holds a state until the next one arrives, so a flat line is
    // what really happened, not a guess.
    //
    // There is nothing to carry into the buckets BEFORE the first reading,
    // though. Those used to be filled from the first FUTURE value - drawing a
    // sensor's readings from before it had any, so an entity created two hours
    // ago filled a 24-hour graph with a flat line at a value that did not exist
    // yet. The graph now starts where its data does. See upstream #414.
    const first = history.findIndex(Boolean);
    if (first === -1) return coords;

    let last = history[first];
    let x;
    for (let i = first; i < history.length; i += 1) {
      x = this._xAt(i);
      if (history[i]) {
        last = history[i];
        coords.push([x, 0, this._calcPoint(last), i]);
      } else {
        coords.push([x, 0, this._lastValue(last), i]);
      }
    }
    return coords;
  }

  /**
   * Recalculates a point's coords based on min & max thresholds
   * @param coords Array of X, Y, Value
   * @returns Array of X, Y, Value, where Y - recalculated based on min/max thresholds
   */
  _calcY(coords) {
    return coords.map(coord => [coord[X], this.getY(coord[V]), coord[V], coord[BUCKET]]);
  }

  getPoints() {
    let { coords } = this;
    if (coords.length === 1) {
      coords[1] = [this.rightEdgeX, 0, coords[0][V], coords[0][BUCKET]];
    }
    coords = this._calcY(this.coords);
    return coords.map(point => [point[X], point[Y], point[V], point[BUCKET]]);
  }


  getPath() {
    let { coords } = this;
    if (coords.length === 1) {
      coords[1] = [this.rightEdgeX, 0, coords[0][V], coords[0][BUCKET]];
    }
    coords = this._calcY(this.coords);
    if (this._smoothing && coords.length > 2) {
      return this._smoothPath(coords);
    }
    return coords.reduce(
      (path, point, i) => `${path}${i ? ' L' : 'M'}${point[X]},${point[Y]}`,
      '',
    );
  }

  /**
   * A smooth path THROUGH the coordinates rather than one that merely aims at
   * them. The tangents are a Catmull-Rom spline's, damped wherever the data
   * turns (Fritsch-Carlson) so the curve never bulges past a value that was
   * never measured - a rounded line still has to be a truthful one.
   * @param {Array} coords Screen coordinates, ascending in X
   * @returns {string} SVG path
   */
  _smoothPath(coords) {
    const n = coords.length;
    const dx = [];
    const slope = [];
    for (let i = 0; i < n - 1; i += 1) {
      dx[i] = coords[i + 1][X] - coords[i][X];
      slope[i] = dx[i] ? (coords[i + 1][Y] - coords[i][Y]) / dx[i] : 0;
    }

    // tangent at each point: the average of the slopes either side, flat at a turn
    const m = [slope[0]];
    for (let i = 1; i < n - 1; i += 1) {
      m[i] = slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2;
    }
    m[n - 1] = slope[n - 2];

    // damp the tangents that would overshoot their segment
    for (let i = 0; i < n - 1; i += 1) {
      if (slope[i] === 0) {
        m[i] = 0;
        m[i + 1] = 0;
      } else {
        const a = m[i] / slope[i];
        const b = m[i + 1] / slope[i];
        const sum = a * a + b * b;
        if (sum > 9) {
          const t = 3 / Math.sqrt(sum);
          m[i] = t * a * slope[i];
          m[i + 1] = t * b * slope[i];
        }
      }
    }

    let path = `M${coords[0][X]},${coords[0][Y]}`;
    for (let i = 0; i < n - 1; i += 1) {
      const h = dx[i] / 3;
      path += ` C ${coords[i][X] + h},${coords[i][Y] + m[i] * h}`
        + ` ${coords[i + 1][X] - h},${coords[i + 1][Y] - m[i + 1] * h}`
        + ` ${coords[i + 1][X]},${coords[i + 1][Y]}`;
    }
    return path;
  }

  computeGradient(thresholds) {
    const scale = this._logarithmic
      ? getLog10(this._max) - getLog10(this._min)
      : this._max - this._min;

    const stops = thresholds.map((stop, index, arr) => {
      let color;
      if (stop.value > this._max && arr[index + 1]) {
        const factor = (this._max - arr[index + 1].value) / (stop.value - arr[index + 1].value);
        color = interpolateRGB(arr[index + 1].color, stop.color, factor);
      } else if (stop.value < this._min && arr[index - 1]) {
        const factor = (arr[index - 1].value - this._min) / (arr[index - 1].value - stop.value);
        color = interpolateRGB(arr[index - 1].color, stop.color, factor);
      }
      // The gradient paints a rect over the whole graph, margins included, so
      // a stop sits where its value is drawn in that frame
      const totalHeight = this._height + this._margin[Y] * 4;
      const offset = scale > 0 ? (this.getY(stop.value) / totalHeight) * 100 : 0;
      return {
        color: color || stop.color,
        offset,
      };
    });
    // SVG stops must rise in offset; an inverted axis reverses their order
    return stops.sort((a, b) => a.offset - b.offset);
  }

  /**
   * Get an SVG path for a fill
   * @param path SVG path for a line
   * @returns SVG path for a fill
   */
  /**
   * Y where a fill under the line ends and bars grow from: the bottom edge, or
   * the baseline. A baseline in the margin band (at or beyond min/max) snaps
   * to that edge, or a strip along it would stay unfilled.
   * @returns {number} Y-coord of the baseline
   */
  get baselineY() {
    const absoluteTop = 0;
    const absoluteBottom = this._height + this._margin[Y] * 4;
    // without one, bars & fill start from the edge the low values are on
    if (this._baseline === undefined) return this._invert ? absoluteTop : absoluteBottom;

    const baselineY = this.getY(this._baseline);
    if (baselineY <= this._margin[Y] * 2) return absoluteTop;
    if (baselineY >= this._height + this._margin[Y] * 2) return absoluteBottom;
    return baselineY;
  }

  getFill(path) {
    const height = this.baselineY;
    let fill = path;
    // note that currently this._margin[X] = 0 when fill is defined
    fill += ` L ${this.rightEdgeX}, ${height}`;
    fill += ` L ${this.coords[0][X]}, ${height} z`;
    return fill;
  }

  /**
   * Get bars for an entity
   * @param {number} position Index of a bar (0,1,..)
   * (i.e. index of an entity with a shown bar graph)
   * @returns Bars for an entity to be shown at a `position` index
   */
  getBars(position) {
    const coords = this._calcY(this.coords);
    const { width, x } = this._barLayout(position);

    // A bar spans from the baseline to its value: up for a value above it,
    // down for one below - so a negative value reads as negative.
    const base = this.baselineY;
    return coords.map(coord => ({
      x: x(coord[BUCKET]),
      y: Math.min(coord[Y], base),
      height: Math.abs(base - coord[Y]),
      width,
      value: coord[V],
      index: coord[BUCKET],
      base,
      tip: coord[Y],
    }));
  }

  /**
   * Range bars for an entity, in the places its bars would take: each spans
   * from its low to its high, with the marker's Y where it has one. A range
   * with no height is still drawn a little tall, or it would not show.
   * @param {number} position Index of a bar (see getBars)
   * @returns {Array<object>} Bars, with low, high, marker & markerY added
   */
  getRanges(position) {
    const { width, x } = this._barLayout(position);
    return this.ranges.map((range) => {
      const lowY = this.getY(range.low);
      const highY = this.getY(range.high);
      const centre = (lowY + highY) / 2;
      const height = Math.max(Math.abs(lowY - highY), MIN_RANGE_HEIGHT);
      const y = centre - height / 2;
      return {
        x: x(range.index),
        y,
        height,
        width,
        value: this._rangeValue(range),
        index: range.index,
        base: y + height,
        tip: y,
        low: range.low,
        high: range.high,
        marker: range.marker,
        markerY: range.marker === undefined ? undefined : this.getY(range.marker),
      };
    });
  }

  /**
   * Where the bars at a position go: their width, and the X of each bucket's.
   * @param {number} position Index of a bar in its group
   * @returns {{width: number, x: function(number): number}} The layout
   */
  _barLayout(position) {
    const spacing = this._bar_spacing;
    const spacing_group = this._bar_spacing_group;
    const total = this._total_bars_in_group;

    // number of measures
    const total_groups = bucketCount(this._hours_to_show, this._points_per_hour);

    // width of a group of bars
    const group_width = (this._width - spacing_group * (total_groups - 1))
      / total_groups;

    // width of a bar
    let bar_width;
    if (spacing === -1) {
      bar_width = group_width;
    } else {
      bar_width = (group_width - spacing * (total - 1)) / total;
      if (bar_width <= 0) {
        bar_width = 1;
        log(`Invalid bar_width, adjusted to 1 (bar_spacing ${spacing}, bar_spacing_group ${spacing_group})`);
      }
    }
    return {
      width: bar_width,
      x: bucket => this._margin[X]
        + (group_width + spacing_group) * bucket
        + (spacing === -1 ? 0 : (bar_width + spacing) * position),
    };
  }

  _average(items) {
    return items.reduce((sum, entry) => (sum + parseFloat(entry.state)), 0) / items.length;
  }

  _median(items) {
    const itemsDup = [...items].sort((a, b) => parseFloat(a.state) - parseFloat(b.state));
    const mid = Math.floor((itemsDup.length - 1) / 2);
    if (itemsDup.length % 2 === 1)
      return parseFloat(itemsDup[mid].state);
    return (parseFloat(itemsDup[mid].state) + parseFloat(itemsDup[mid + 1].state)) / 2;
  }

  _maximum(items) {
    return Math.max(...items.map(item => item.state));
  }

  _minimum(items) {
    return Math.min(...items.map(item => item.state));
  }

  _first(items) {
    return parseFloat(items[0].state);
  }

  _last(items) {
    return parseFloat(items[items.length - 1].state);
  }

  _sum(items) {
    return items.reduce((sum, entry) => sum + parseFloat(entry.state), 0);
  }

  _delta(items) {
    return this._maximum(items) - this._minimum(items);
  }

  _diff(items) {
    return this._last(items) - this._first(items);
  }

  _lastValue(items) {
    if (['delta', 'diff'].includes(this._aggregateFuncName)) {
      return 0;
    } else {
      return parseFloat(items[items.length - 1].state) || 0;
    }
  }

  _updateEndTime() {
    this._endTime = getIntervalEndDate(this._groupBy, new Date());
  }
}
