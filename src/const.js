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
  STATISTICS_PERIODS,
  STATISTICS_TYPES,
  DEFAULT_STATISTICS_TYPES,
  STATISTICS_PERIOD_THRESHOLDS,
  STATISTICS_PERIOD_FALLBACK,
};
