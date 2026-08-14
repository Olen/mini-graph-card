import { interpolateRGB } from './color';
import {
  X, Y, V,
  ONE_HOUR,
  DEFAULT_BAR_SPACING,
} from './const';
import { log } from './utils';

export default class Graph {
  constructor({
    width,
    height,
    margin,
    hours = 24,
    points = 1,
    aggregateFuncName = 'avg',
    groupBy = 'interval',
    smoothing = true,
    logarithmic = false,
    bar_spacing = DEFAULT_BAR_SPACING, // spacing between bars
    bar_spacing_group = DEFAULT_BAR_SPACING, // spacing between groups of bars
    total_bars_in_group = 1, // number of bars (i.e. number of entities with a shown bar graph)
    fill_baseline,
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
    this.margin = margin;
    this.setSize(width, height);
    this._max = 0;
    this._min = 0;
    this.points = points; // stands for "points_per_hour"
    this.hours = hours; // stands for "hours_to_show"
    this.aggregateFuncName = aggregateFuncName;
    this._calcPoint = aggregateFuncMap[aggregateFuncName] || this._average;
    this._smoothing = smoothing;
    this.logarithmic = logarithmic;
    this.bar_spacing = bar_spacing;
    this.bar_spacing_group = bar_spacing_group;
    this.total_bars_in_group = total_bars_in_group;
    this._groupBy = groupBy;
    this._endTime = 0;
    this.fill_baseline = fill_baseline;
  }

  get max() { return this._max; }

  set max(max) { this._max = max; }

  get min() { return this._min; }

  set min(min) { this._min = min; }

  set history(data) { this._history = data; }


  /**
   * Set a size a graph is drawn in, in pixels: a card follows a size of its
   * cell, and a viewBox matches an element 1:1 so nothing is scaled.
   * @param {number} width Width in pixels
   * @param {number} height Height in pixels
   */
  setSize(width, height) {
    this.width = width - this.margin[X] * 2;
    this.height = height - this.margin[Y] * 4;
  }

  /**
   * Y for a value, by the very transform the coordinates use - a grid line
   * drawn from its own copy of the maths would drift from the data it labels.
   * @param {number} value A value in the entity's own units
   * @returns {number} A Y coordinate
   */
  getY(value) {
    const max = this.logarithmic ? Math.log10(Math.max(1, this.max)) : this.max;
    const min = this.logarithmic ? Math.log10(Math.max(1, this.min)) : this.min;
    const val = this.logarithmic ? Math.log10(Math.max(1, value)) : value;
    const yRatio = ((max - min) / this.height) || 1;
    return this.height - ((val - min) / yRatio) + this.margin[Y] * 2;
  }

  /**
   * X for a moment inside the shown window. The window ends at _endTime, which
   * group_by rounds (see _updateEndTime), so this follows the axis the data was
   * binned against rather than the wall clock.
   * @param {number} time A timestamp in ms
   * @returns {number} An X coordinate
   */
  getX(time) {
    const span = this.hours * ONE_HOUR;
    return this.margin[X] + (this.width * (time - (this._endTime - span))) / span;
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
      return;
    }
    this._updateEndTime();

    const histGroups = this._history.reduce((res, item) => this._reducer(res, item), []);

    // extend length to fill missing history
    const requiredNumOfPoints = Math.ceil(this.hours * this.points);
    histGroups.length = requiredNumOfPoints;

    this.coords = this._calcPoints(histGroups);
    this.min = Math.min(...this.coords.map(item => Number(item[V])));
    this.max = Math.max(...this.coords.map(item => Number(item[V])));
  }

  _reducer(res, item) {
    const age = this._endTime - new Date(item.last_changed).getTime();
    const interval = (age / ONE_HOUR * this.points) - this.hours * this.points;
    if (interval < 0) {
      const key = Math.floor(Math.abs(interval));
      if (!res[key]) res[key] = [];
      res[key].push(item);
    } else {
      res[0] = [item];
    }
    return res;
  }

  _calcPoints(history) {
    let xRatio = this.width / (this.hours * this.points - 1);
    xRatio = Number.isFinite(xRatio) ? xRatio : this.width;

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
      x = xRatio * i + this.margin[X];
      if (history[i]) {
        last = history[i];
        coords.push([x, 0, this._calcPoint(last)]);
      } else {
        coords.push([x, 0, this._lastValue(last)]);
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
    // account for logarithmic graph
    const max = this.logarithmic ? Math.log10(Math.max(1, this.max)) : this.max;
    const min = this.logarithmic ? Math.log10(Math.max(1, this.min)) : this.min;

    const yRatio = ((max - min) / this.height) || 1;
    const coords2 = coords.map((coord) => {
      const val = this.logarithmic ? Math.log10(Math.max(1, coord[V])) : coord[V];
      const coordY = this.height - ((val - min) / yRatio) + this.margin[Y] * 2;
      return [coord[X], coordY, coord[V]];
    });

    return coords2;
  }

  getPoints() {
    let { coords } = this;
    if (coords.length === 1) {
      coords[1] = [this.width + this.margin[X], 0, coords[0][V]];
    }
    coords = this._calcY(this.coords);
    return coords.map((point, i) => [point[X], point[Y], point[V], i]);
  }


  getPath() {
    let { coords } = this;
    if (coords.length === 1) {
      coords[1] = [this.width + this.margin[X], 0, coords[0][V]];
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
    const scale = this.logarithmic
      ? Math.log10(Math.max(1, this._max)) - Math.log10(Math.max(1, this._min))
      : this._max - this._min;

    return thresholds.map((stop, index, arr) => {
      let color;
      if (stop.value > this._max && arr[index + 1]) {
        const factor = (this._max - arr[index + 1].value) / (stop.value - arr[index + 1].value);
        color = interpolateRGB(arr[index + 1].color, stop.color, factor);
      } else if (stop.value < this._min && arr[index - 1]) {
        const factor = (arr[index - 1].value - this._min) / (arr[index - 1].value - stop.value);
        color = interpolateRGB(arr[index - 1].color, stop.color, factor);
      }
      let offset;
      if (scale <= 0) {
        offset = 0;
      } else if (this.logarithmic) {
        offset = (Math.log10(Math.max(1, this._max))
          - Math.log10(Math.max(1, stop.value)))
          * (100 / scale);
      } else {
        offset = (this._max - stop.value) * (100 / scale);
      }
      return {
        color: color || stop.color,
        offset,
      };
    });
  }

  /**
   * Get an SVG path for a fill
   * @param path SVG path for a line
   * @returns SVG path for a fill
   */
  getFill(path) {
    let height = this.height + this.margin[Y] * 4;
    if (this.fill_baseline !== undefined) {
      const [baselineCoord] = this._calcY([[0, 0, this.fill_baseline]]);
      [, height] = baselineCoord;
    }
    let fill = path;
    // note that currently this.margin[X] = 0 when fill is defined
    fill += ` L ${this.width + this.margin[X]}, ${height}`;
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
    const spacing = this.bar_spacing;
    const spacing_group = this.bar_spacing_group;
    const total = this.total_bars_in_group;

    const coords = this._calcY(this.coords);

    // number of measures
    const total_groups = Math.ceil(this.hours * this.points);

    // width of a group of bars
    const group_width = (this.width - spacing_group * (total_groups - 1))
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

    return coords.map((coord, i) => ({
      x: this.margin[X]
        + (group_width + spacing_group) * i
        + (spacing === -1 ? 0 : (bar_width + spacing) * position),
      y: coord[Y],
      height: this.height - coord[Y] + this.margin[Y] * 4,
      width: bar_width,
      value: coord[V],
    }));
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
    if (['delta', 'diff'].includes(this.aggregateFuncName)) {
      return 0;
    } else {
      return parseFloat(items[items.length - 1].state) || 0;
    }
  }

  _updateEndTime() {
    this._endTime = new Date();
    switch (this._groupBy) {
      case 'month':
        this._endTime.setMonth(this._endTime.getMonth() + 1);
        this._endTime.setDate(1);
        break;
      case 'date':
        this._endTime.setDate(this._endTime.getDate() + 1);
        this._endTime.setHours(0, 0, 0, 0);
        break;
      case 'hour':
        this._endTime.setHours(this._endTime.getHours() + 1);
        this._endTime.setMinutes(0, 0, 0);
        break;
      default:
        break;
    }
  }
}
