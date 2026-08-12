const URL_DOCS = 'https://github.com/kalkih/mini-graph-card/blob/master/README.md';
const MAX_BARS = 96;
const DEFAULT_FONT_SIZE = 14;
const DEFAULT_FONT_SIZE_HEADER = 14;
// A state value is 2.4em with a 1.2em line height & its unit 1.4em, see style.js
const STATE_LINE_HEIGHT = 1.2;
const STATE_UOM_RATIO = 1.4 / 2.4;
// "top-*"/"bottom-*" take a state out of a flow & pin it to a corner of a card
const ALIGN_STATE = [
  'left', 'right', 'center',
  'top-left', 'top-right', 'bottom-left', 'bottom-right',
];
const DEFAULT_ALIGN_STATE = 'left';
// "state" moves the icon out of the header & next to the current state.
// Upstream documents "right" as the default but never implemented one, so an
// unconfigured icon matched no rule at all & sat against the name.
const ALIGN_ICON = ['left', 'right', 'state'];
const DEFAULT_ALIGN_ICON = 'right';
const DEFAULT_BAR_SPACING = 4;
const DEFAULT_GRAPH_HEIGHT = 100;
// A width a graph is drawn in until a card is measured
const DEFAULT_GRAPH_WIDTH = 500;
const DEFAULT_MARGIN = 5;
const DEFAULT_HOURS_TO_SHOW = 24;
const DEFAULT_POINTS_PER_HOUR = 0.5;
const DEFAULT_STATIC_VALUE_LABEL_OFFSET = 20; // in %
const NBSP = '\u00A0';
const ICONS = {
  humidity: 'hass:water-percent',
  illuminance: 'hass:brightness-5',
  temperature: 'hass:thermometer',
  battery: 'hass:battery',
  pressure: 'hass:gauge',
  power: 'hass:flash',
  signal_strength: 'hass:wifi',
  motion: 'hass:walk',
  door: 'hass:door-closed',
  window: 'hass:window-closed',
  presence: 'hass:account',
  light: 'hass:lightbulb',
};
const DEFAULT_COLORS = [
  'var(--accent-color)',
  '#3498db',
  '#e74c3c',
  '#9b59b6',
  '#f1c40f',
  '#2ecc71',
  '#1abc9c',
  '#34495e',
  '#e67e22',
  '#7f8c8d',
  '#27ae60',
  '#2980b9',
  '#8e44ad',
];
const UPDATE_PROPS = ['entity', 'line', 'length', 'fill', 'points', 'tooltip', 'abs', 'config'];
const DEFAULT_SHOW = {
  name: true,
  icon: true,
  state: true,
  graph: 'line',
  labels: 'hover',
  labels_secondary: 'hover',
  extrema: false,
  legend: true,
  fill: true,
  points: 'hover',
};

const X = 0;
const Y = 1;
const V = 2;
const ONE_HOUR = 1000 * 3600;

// Sections grid: a cell is 56px high with an 8px gap, so N rows take 64*N-8 px.
const GRID_ROW_HEIGHT = 56;
const GRID_ROW_GAP = 8;
// Masonry view: a card size unit is 50px.
const MASONRY_SIZE_UNIT = 50;
// A card's chrome, in "em" of a corresponding font size (see style.js):
// an icon is 1.7em, a state value is 2.4em with a 1.2em line height.
const HEADER_HEIGHT_EM = 1.7;
const STATE_HEIGHT_EM = 2.4 * STATE_LINE_HEIGHT;
const LEGEND_HEIGHT_EM = 1.2;
const INFO_HEIGHT_EM = 1.2;
// "ha-card" padding-top & a padding-bottom of each "ha-card > div".
const CARD_PADDING = 16;
// A graph is allowed to shrink to this height when a card is resized.
const MIN_GRAPH_HEIGHT = 32;

// Interaction
// How a point is selected on hover:
// "nearest" - the point nearest to the cursor anywhere in the graph,
// "point" - only when the cursor is over the point itself (the classic behaviour).
const HOVER_NEAREST = 'nearest';
const HOVER_POINT = 'point';
const HOVER_MODES = [HOVER_NEAREST, HOVER_POINT];
const DEFAULT_HOVER_MODE = HOVER_NEAREST;
// A press longer than this is a hold, if the pointer stayed within the
// tolerance. Matches the Home Assistant frontend's own action handler.
const HOLD_TIME = 500;
const HOLD_MOVE_TOLERANCE = 10;

// Grid lines
const GRID_INTERVALS = ['5minute', '15minute', 'hour', '6hour', 'day', 'week', 'month'];
// A default interval, by hours_to_show. Chosen so a window draws a handful of
// lines rather than hundreds - each bound is a judgement, not a formula, the
// same way STATISTICS_PERIOD_THRESHOLDS is.
const GRID_INTERVAL_THRESHOLDS = [
  { hours: 0.5, interval: '5minute' },
  { hours: 3, interval: '15minute' },
  { hours: 12, interval: 'hour' },
  { hours: 72, interval: '6hour' },
  { hours: 24 * 14, interval: 'day' },
  { hours: 24 * 120, interval: 'week' },
];
const GRID_INTERVAL_FALLBACK = 'month';
// How long each interval is, for working out how many lines it would draw
const GRID_INTERVAL_HOURS = {
  '5minute': 1 / 12, '15minute': 1 / 4, hour: 1, '6hour': 6, day: 24, week: 24 * 7, month: 24 * 30,
};
// Closer than this & lines read as a smudge rather than a grid, so an automatic
// interval or step coarsens until they are at least this far apart. Only
// automatic ones: an interval or step written in a config is always obeyed.
const GRID_MIN_SPACING = 32;
// Labels are smaller than the gap a grid needs, so they may sit closer
// Clear space between a bar & the marker above it, so the marker cannot be
// mistaken for part of the bar
const BAR_MARKER_GAP = 3;
const GRID_LABEL_MIN_SPACING = 16;
// A time label only earns its place when it names a date. "13:00" on an hourly
// grid is a dozen labels saying little; "Tue" or "Aug" is worth the ink.
const GRID_LABEL_INTERVALS = ['day', 'week', 'month'];
// "hover" reveals labels with the card, as show.labels does; "always" keeps them
const GRID_LABEL_MODES = ['hover', 'always'];
const DEFAULT_GRID_LABEL_MODE = 'hover';
// A value grid aims for about this many lines between the bounds
const GRID_TARGET_LINES = 5;
const GRID_AXES = ['primary', 'secondary'];

// How tall a graph is drawn inside its card, as parsed by parseGraphHeight():
// "auto" is a row in the flow, the others are anchored to the card's bottom.
const GRAPH_HEIGHT_AUTO = 'auto';
const GRAPH_HEIGHT_PX = 'px';
const GRAPH_HEIGHT_PERCENT = 'percent';

// Statistics
const STATISTICS_PERIODS = ['5minute', 'hour', 'day', 'week', 'month', 'year'];
// "mean" statistics hold mean/min/max, "sum" ones - sum/state/change
const STATISTICS_TYPES = ['mean', 'min', 'max', 'sum', 'state', 'change'];
// A preferred type, in order of preference
const DEFAULT_STATISTICS_TYPES = ['mean', 'state'];
// A default period, by hours_to_show; HA keeps 5-minute statistics ~10 days only.
const STATISTICS_PERIOD_THRESHOLDS = [
  { hours: 24, period: '5minute' },
  { hours: 24 * 90, period: 'hour' },
  { hours: 24 * 730, period: 'day' },
];
const STATISTICS_PERIOD_FALLBACK = 'month';

export {
  URL_DOCS,
  GRID_ROW_HEIGHT,
  GRID_ROW_GAP,
  MASONRY_SIZE_UNIT,
  HEADER_HEIGHT_EM,
  STATE_HEIGHT_EM,
  LEGEND_HEIGHT_EM,
  INFO_HEIGHT_EM,
  CARD_PADDING,
  MIN_GRAPH_HEIGHT,
  MAX_BARS,
  DEFAULT_FONT_SIZE,
  DEFAULT_FONT_SIZE_HEADER,
  STATE_UOM_RATIO,
  STATE_LINE_HEIGHT,
  ALIGN_STATE,
  DEFAULT_ALIGN_STATE,
  ALIGN_ICON,
  DEFAULT_ALIGN_ICON,
  DEFAULT_BAR_SPACING,
  DEFAULT_GRAPH_HEIGHT,
  DEFAULT_GRAPH_WIDTH,
  DEFAULT_MARGIN,
  DEFAULT_HOURS_TO_SHOW,
  DEFAULT_POINTS_PER_HOUR,
  DEFAULT_STATIC_VALUE_LABEL_OFFSET,
  NBSP,
  ICONS,
  DEFAULT_COLORS,
  DEFAULT_SHOW,
  UPDATE_PROPS,
  X,
  Y,
  V,
  ONE_HOUR,
  HOVER_NEAREST,
  HOVER_POINT,
  HOVER_MODES,
  DEFAULT_HOVER_MODE,
  HOLD_TIME,
  HOLD_MOVE_TOLERANCE,
  GRAPH_HEIGHT_AUTO,
  GRAPH_HEIGHT_PX,
  GRAPH_HEIGHT_PERCENT,
  GRID_INTERVALS,
  GRID_INTERVAL_THRESHOLDS,
  GRID_INTERVAL_FALLBACK,
  GRID_INTERVAL_HOURS,
  GRID_MIN_SPACING,
  BAR_MARKER_GAP,
  GRID_LABEL_MIN_SPACING,
  GRID_LABEL_INTERVALS,
  GRID_LABEL_MODES,
  DEFAULT_GRID_LABEL_MODE,
  GRID_TARGET_LINES,
  GRID_AXES,
  STATISTICS_PERIODS,
  STATISTICS_TYPES,
  DEFAULT_STATISTICS_TYPES,
  STATISTICS_PERIOD_THRESHOLDS,
  STATISTICS_PERIOD_FALLBACK,
};
