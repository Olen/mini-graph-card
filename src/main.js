import { LitElement, html, svg } from 'lit-element';
import localForage from 'localforage/src/localforage';
import { stateIcon } from 'custom-card-helpers';
import SparkMD5 from 'spark-md5';
import { interpolateRGB } from './color';
import Graph from './graph';
import style from './style';
import handleClick from './handleClick';
import buildConfig from './buildConfig';
import { packEntry, unpackEntry, isUsable } from './cache';
import './editor/editor';
import {
  blankBeforePercent,
  formatNumber,
  formatDuration,
  DURATION_UNITS,
  formatDateTime,
  parseDateTimeFormatFromCfg,
  getDateFormat, getTimeFormat,
  getDateTimeFormat,
} from './locale';
import './initialize';
import { version } from '../package.json';
import {
  ICONS,
  UPDATE_PROPS,
  X, Y, V,
  ONE_HOUR,
  DEFAULT_GRAPH_HEIGHT,
  DEFAULT_GRAPH_WIDTH,
  STATE_UOM_RATIO,
  CARD_PADDING,
  MIN_GRAPH_HEIGHT,
  VALUE_FORMAT_DURATION,
  DEFAULT_MARGIN,
  HOLD_TIME,
  HOLD_MOVE_TOLERANCE,
  HOVER_NEAREST,
  HOVER_POINT,
  GRAPH_HEIGHT_AUTO,
  GRAPH_HEIGHT_PX,
  GRAPH_HEIGHT_PERCENT,
  GRID_LABEL_MIN_SPACING,
  GRID_LABEL_INTERVALS,
  BAR_MARKER_GAP,
  NBSP,
  STATISTICS_PERIOD_THRESHOLDS,
  STATISTICS_PERIOD_FALLBACK,
} from './const';
import {
  isNumeric, getStatisticsType, getCardSizeUnits, getGridOptions,
  getInfoHeight, isStateInCorner, findNearestPoint, findNearestBar,
  getDesiredCardHeight, getGraphHeightPx, getGridTimes, getGridValues, getGridInterval,
  getLabelStride, getChromeHeight,
} from './others';

import {
  getMin, getAvg, getMax,
  getMilli,
  getFirstDefinedItem,
  compareArray,
  log,
} from './utils';

const isUnavailableState = value => ['unavailable', 'unknown'].includes(value);

class MiniGraphCard extends LitElement {
  constructor() {
    super();
    this.id = Math.random()
      .toString(36)
      .substring(2, 11);
    this.config = {};
    this.bound = [0, 0];
    this.boundSecondary = [0, 0];
    this.length = []; // length of a line (used for animation)
    this.entity = []; // stateObj for each entity in config.entities
    this.line = [];
    this.bar = [];
    this.abs = [];
    this.fill = [];
    this.points = [];
    this.gradient = [];
    this.tooltip = {};
    // Pointer state, with three different lifetimes:
    // _pointerType & _pointerOrigin describe the last press & must survive
    // until the NEXT one, because the click ending a tap arrives after
    // pointerup; _holdArmed & _holdTimer live only while a press is held;
    // _holdFired is read by the click which follows a hold, then cleared.
    this._pointerType = undefined;
    this._pointerOrigin = undefined;
    this._holdArmed = false;
    this._holdFired = false;
    this._holdTimer = undefined;
    this.updateQueue = [];
    this.updating = false;
    // set once to "true" when a history is set for a particular entry[index] with static_value
    this.staticValueUpdated = [];
    this.stateChanged = false;
    this.initial = true;
    this._md5Config = undefined;
    this.loggedMessages = new Set();
    // A size a graph is actually drawn in: "height" from a config & a default
    // width until a card is measured, see observeGraphSize().
    this._graphHeight = undefined;
    this._graphWidth = undefined;

    // update datetime settings periodically
    this.updateHour24 = true;
    this.updateDateTimeFormat = true;

    // Keeps a native unit/order for an entity: used for historical data
    // for a currently unavailable entity
    this.preserved_uom = [];
    this.preserved_order = [];
  }

  static getConfigElement() {
    return document.createElement('mini-graph-card-editor');
  }

  static get styles() {
    return style;
  }

  set hass(hass) {
    this._hass = hass;
    let updated = false;
    const queue = [];

    this.config.entities.forEach((entity, index) => {
      this.config.entities[index].index = index; // Required for filtered views
      // entityState stands for "stateObj"
      const entityState = hass && entity.entity && hass.states[entity.entity] || undefined;
      // initiate an update if stateObj changed
      if (entityState && this.entity[index] !== entityState) {
        this.entity[index] = entityState;
        queue.push(`${entityState.entity_id}-${index}`);
        updated = true;
      } else if (!entity.entity
          && this.isStaticValue(index) && !this.staticValueUpdated[index]) {
        this.entity[index] = undefined;
        queue.push(`static_value-${index}`);
        this.staticValueUpdated[index] = true; // updated only once
        updated = true;
      }
    });
    if (updated) {
      this.stateChanged = true;
      this.entity = [...this.entity];
      if (!this.config.update_interval && !this.updating) {
        setTimeout(() => {
          this.updateQueue = [...queue, ...this.updateQueue];
          this.updateData();
        }, this.initial ? 0 : 1000);
      } else {
        this.updateQueue = [...queue, ...this.updateQueue];
      }
    }
  }

  static get properties() {
    return {
      id: String, // do not remove (unless a "this.id" property is renamed)
      _hass: {},
      config: {},
      entity: [],
      Graph: [],
      line: [],
      shadow: [],
      length: Number,
      bound: [],
      boundSecondary: [],
      abs: [],
      tooltip: {},
      updateQueue: [],
      color: String,
    };
  }

  /**
  * Returns min & max "line_width" values defined globally for a card
  * & for all entities individually
  * @returns {object} min & max "line_width" values
  */
  getMinMaxLineWidth() {
    const arr = this.config.entities
      .filter(entityConfig => entityConfig.show_graph !== false)
      .map((entityConfig) => {
        const value = entityConfig.line_width;
        return isNumeric(value)
          ? value : this.config.line_width;
      });
    if (arr.length === 0) {
      return ({
        min: this.config.line_width,
        max: this.config.line_width,
      });
    }
    return ({
      min: Math.min(...arr),
      max: Math.max(...arr),
    });
  }

  setConfig(config) {
    ({
      config: this.config,
      entityFactors: this.entityFactors, // predefined factors
      axisFactors: this.axisFactors, // predefined factors
    } = buildConfig(config));

    this._md5Config = SparkMD5.hash(JSON.stringify(this.config));
    const entitiesChanged = !compareArray(this.config.entities || [], config.entities);

    // initialize memoized data
    this._datetimeFormatFromCfgParsedCache = null;
    this._visibleEntitiesCache = null;
    this._primaryYaxisEntitiesCache = null;
    this._secondaryYaxisEntitiesCache = null;
    this._visibleLegendsCache = null;

    // update datetime settings periodically
    this.updateHour24 = config.hour24 === undefined;
    this.updateDateTimeFormat = config.datetime_format === undefined;

    if (!this.Graph || entitiesChanged) {
      if (this._hass) this.hass = this._hass;
      const {
        min: min_line_width,
        max: max_line_width,
      } = this.getMinMaxLineWidth();
      const margin = this.config.show.graph === 'bar'
        ? [DEFAULT_MARGIN, DEFAULT_MARGIN]
        : this.config.show.fill
          ? [0, max_line_width]
          : [min_line_width, max_line_width];
      this.Graph = this.config.entities.map(
        (entity, index) => new Graph({
          // The measured size, when there is one: the viewBox is drawn from it,
          // and a Graph built for another size would plot outside that box.
          width: this.graphWidth,
          height: this.graphHeight,
          margin,
          hours: this.config.hours_to_show,
          points: this.config.points_per_hour,
          aggregateFuncName: entity.aggregate_func || this.config.aggregate_func,
          groupBy: this.config.group_by,
          smoothing: getFirstDefinedItem(
            entity.smoothing,
            this.config.smoothing,
            this.getDefaultSmoothing(index),
          ),
          logarithmic: getFirstDefinedItem(
            entity.logarithmic,
            this.config.logarithmic,
            false,
          ),
          bar_spacing: this.config.bar_spacing,
          bar_spacing_group: this.config.bar_spacing_group,
          total_bars_in_group: this.visibleEntities.length,
          fill_baseline: getFirstDefinedItem(
            entity.fill_baseline,
            this.config.fill_baseline,
          ),
        }),
      );
    }
  }

  /**
   * Check if smoothing can be defaulted to `true` for an entity
   * @param {number} index Index of an entry in config.entities
   * @returns {boolean} True if smoothing is applicable for an entity, false - otherwise
   */
  getDefaultSmoothing(index) {
    const { entity } = this.config.entities[index];
    if (entity) {
      // Turn off default smoothing for binary_sensor entities.
      // Can be also refactored for other non-numerical domains if needed.
      // Smoothing should be manually turned on in config
      // in case of addressing a numerical attribute.
      return !entity.startsWith('binary_sensor.');
    }
    // processing a possible `static_value` entry
    return false;
  }

  get datetimeFormatFromCfgParsed() {
    if (!this._datetimeFormatFromCfgParsedCache) {
      // parse a possibly defined "datetime_format" option from config
      this._datetimeFormatFromCfgParsedCache = parseDateTimeFormatFromCfg(
        this.config.datetime_format,
      );
    }
    return this._datetimeFormatFromCfgParsedCache;
  }

  /**
  * Automatically update datetime formatting options (when they are not explicitly set by a user)
  * on every render
  * @param {boolean|undefined} forced True to forcibly update a format
  */
  updateFormatFromLocale(forced) {
    if (this.updateDateTimeFormat || forced) {
      this.datetimeFormatDateOptions = getDateFormat(
        this.config,
        this.datetimeFormatFromCfgParsed,
        this._hass,
      );
    }
    if (this.updateHour24 || this.updateDateTimeFormat || forced) {
      this.datetimeFormatTimeOptions = getTimeFormat(
        this.config,
        this.datetimeFormatFromCfgParsed,
        this._hass,
      );
    }
  }

  connectedCallback() {
    super.connectedCallback();
    if (this.config.update_interval) {
      window.requestAnimationFrame(() => {
        this.updateOnInterval();
      });
      this.interval = setInterval(
        () => this.updateOnInterval(),
        this.config.update_interval * 1000,
      );
    }
  }

  disconnectedCallback() {
    if (this.interval) {
      clearInterval(this.interval);
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = undefined;
      // The element survives in the shadow root, so without forgetting it here
      // updateGraphSizeObserver() would take it for "already observed" and a
      // reconnected card would never learn its size again.
      this.observedElement = undefined;
      this.observingCard = false;
    }
    this.cancelHold();
    super.disconnectedCallback();
  }

  /**
   * Watch a size of a graph area & redraw a graph for the height it really got:
   * in a Sections view a card follows its cell, not a configured "height".
   */
  observeGraphSize() {
    if (this.resizeObserver || typeof ResizeObserver === 'undefined') return;
    this.resizeObserver = new ResizeObserver((entries) => {
      // Exact, not rounded: a viewBox matching an element to a fraction of a
      // pixel keeps preserveAspectRatio a no-op. Rounding it up makes a
      // drawing be scaled down to fit & letterboxed by a pixel or two.
      entries.forEach((entry) => {
        if (entry.target !== this.observedElement) {
          // The host, for "density: auto". Its height is set from outside in a
          // Sections cell, so compacting cannot change it & set off a loop.
          const cardHeight = entry.contentRect.height;
          if (Math.abs(cardHeight - (this._cardHeight || 0)) < 0.5) return;
          this._cardHeight = cardHeight;
          this.requestUpdate();
          return;
        }
        // Exact, not rounded: a viewBox matching an element to a fraction of a
        // pixel keeps preserveAspectRatio a no-op. Rounding it up makes a
        // drawing be scaled down to fit & letterboxed by a pixel or two.
        const { width, height } = entry.contentRect;
        // A sub-pixel jitter must not start a resize/redraw loop
        if (width <= 0 || height <= 0
          || (Math.abs(height - this.graphHeight) < 0.5
            && Math.abs(width - this.graphWidth) < 0.5)) return;
        [this._graphWidth, this._graphHeight] = [width, height];
        this.redrawForSize(width, height);
        this.requestUpdate();
      });
    });
  }

  /**
   * How tall a graph is drawn, from "graph_height".
   * "auto" leaves it a row like any other, taking what the chrome leaves.
   * Anything else takes it OUT of the flow & anchors it to the bottom of the
   * card, so a taller graph slides behind more of the chrome. A percentage is
   * handed to CSS as-is, so it tracks the height the card really got rather
   * than the one it asked for.
   * @returns {string} Style string
   */
  /**
   * A card only carries a height of its own while the graph is a row in it.
   * Any other "graph_height" takes the graph out of the flow, so it stops
   * contributing any height & a Masonry card would collapse onto its header:
   * the card has to hold the height itself. Not applied for "auto", where the
   * graph is what absorbs a card being shrunk into a smaller cell.
   * @returns {string} Style string
   */
  /**
   * Whether to spend the smaller padding. "auto" does so when a card is too
   * short to give a graph room after its chrome - which only happens where
   * something outside fixes the height, a Sections cell. A Masonry card grows
   * to fit its content, so there is nothing there to adapt to.
   * @returns {boolean} True if the card should be compact
   */
  get isCompact() {
    const { density } = this.config;
    if (density === 'compact') return true;
    if (density !== 'auto' || !this._cardHeight) return false;
    return this._cardHeight < getChromeHeight(this.config) + MIN_GRAPH_HEIGHT;
  }

  /**
   * Sizes for the parts of a card which can be sized on their own. Each is a
   * custom property the stylesheet falls back from, so an unset one keeps the
   * size it always had.
   * @returns {string} Style string
   */
  getFontStyle() {
    const { font_size_secondary: secondary } = this.config;
    return [
      ['--mcg-secondary-value-size', secondary],
      // a unit keeps its proportion to the value it follows, as it does for
      // the primary state
      ['--mcg-secondary-uom-size', secondary === undefined
        ? undefined
        : Math.round(secondary * STATE_UOM_RATIO * 100) / 100],
      ['--mcg-legend-size', this.config.font_size_legend],
      ['--mcg-extrema-size', this.config.font_size_extrema],
      ['--mcg-label-size', this.config.font_size_labels],
    ].reduce((css, [name, size]) => (size === undefined
      ? css
      : `${css} ${name}: ${size}px;`), '');
  }

  getCardStyle() {
    return this.config.graph_height.mode === GRAPH_HEIGHT_AUTO
      ? ''
      : `min-height: ${getDesiredCardHeight(this.config)}px;`;
  }

  getGraphStyle() {
    const { mode, value } = this.config.graph_height;
    if (mode === GRAPH_HEIGHT_PX) return `height: ${value}px;`;
    if (mode === GRAPH_HEIGHT_PERCENT) return `height: ${value}%;`;
    // "height: 0" is the documented way to show a card without a graph, and a
    // growing box would fill a stretched card instead
    if (this.config.height === 0) return 'flex-basis: 0px; flex-grow: 0;';
    // "auto" still needs a size of its own: a Masonry card has no height to
    // grow into, so a basis of 0 would collapse the graph to nothing. This is
    // what makes "height" a card height - the graph takes the card's leftover.
    return `flex-basis: ${getGraphHeightPx(this.config)}px;`;
  }

  /**
   * Redraw the graphs for a new size. X coordinates come from Graph.update(),
   * which bins the history against Graph.width, so setting the size and
   * recomputing the paths alone would leave the points at the old width while
   * the viewBox describes the new one.
   * @param {number} width Width in pixels
   * @param {number} height Height in pixels
   */
  redrawForSize(width, height) {
    this.Graph.forEach((graph) => {
      graph.setSize(width, height);
      graph.update();
    });
    this.updateBounds();
    this.updateGraphPaths();
  }

  /** (Re)attach a size observer to a currently rendered graph area. */
  updateGraphSizeObserver() {
    this.observeGraphSize();
    // "density: auto" needs the height the card was GIVEN, which is the host's:
    // its own content height would change as the padding does & oscillate.
    if (this.resizeObserver && !this.observingCard) {
      this.resizeObserver.observe(this);
      this.observingCard = true;
    }
    if (!this.config.show.graph) return;
    const element = this.shadowRoot && this.shadowRoot.querySelector('.graph__container__svg');
    if (!this.resizeObserver || !element || element === this.observedElement) return;
    if (this.observedElement) this.resizeObserver.unobserve(this.observedElement);
    this.resizeObserver.observe(element);
    this.observedElement = element;
  }

  shouldUpdate(changedProps) {
    if (UPDATE_PROPS.some(prop => changedProps.has(prop))) {
      this.color = this.computeColor(
        this.tooltip.value !== undefined
          ? this.tooltip.value : this.getEntityState(0),
        this.tooltip.entity || 0,
      );
      return true;
    }
  }

  firstUpdated() {
    this.initial = false;
    this.updateFormatFromLocale(true);
    this.updateGraphSizeObserver();
  }

  updated(changedProperties) {
    super.updated(changedProperties);
    this.updateGraphSizeObserver();

    if (this.config.animate && changedProperties.has('line')) {
      if (this.length.length < this.entity.length) {
        this.shadowRoot.querySelectorAll('svg path.line').forEach((ele) => {
          this.length[ele.id] = ele.getTotalLength();
        });
        this.length = [...this.length];
      } else {
        this.length = Array(this.entity.length).fill('none');
      }
    }
  }

  render({ config } = this) {
    if (!config || !this.entity || !this._hass) {
      return html``;
    }
    if (this.config.entities.some(
      (_, index) => this.entity[index] === undefined && !this.isStaticValue(index),
    )) {
      return this.renderWarnings();
    }
    this.updateFormatFromLocale();
    return html`
      <ha-card
        class="flex"
        ?group=${config.group}
        ?fill=${config.show.graph && config.show.fill}
        ?points=${config.show.points === 'hover'}
        ?nearest=${config.hover_mode === HOVER_NEAREST}
        ?labels=${config.show.labels === 'hover'}
        ?labels-secondary=${config.show.labels_secondary === 'hover'}
        ?hover=${config.tap_action.action !== 'none'}
        ?compact=${this.isCompact}
        style="font-size: ${config.font_size}px; ${this.getCardStyle()}${this.getFontStyle()}"
        @mousemove=${e => this.handleCardHover(e)}
        @mouseleave=${() => (this.tooltip = {})}
        @pointerdown=${e => this.handlePointerDown(e)}
        @pointermove=${e => this.handlePointerMove(e)}
        @pointerup=${() => this.cancelHold()}
        @pointercancel=${() => this.cancelHold()}
        @pointerleave=${() => this.cancelHold()}
        @click=${e => this.handlePopup(e, this.actionEntity(config.tap_action))}
      >
        ${this.renderHeader()} ${this.renderStates()} ${this.renderGraph()} ${this.renderInfo()}
      </ha-card>
    `;
  }

  renderWarnings() {
    /* eslint-disable indent */
    return html`
      <hui-warning>
        <div>mini-graph-card</div>
        ${this.config.entities.map((_, index) => (!this.entity[index] && !this.isStaticValue(index)
          ? html`<div>Entity not available: ${this.config.entities[index].entity}</div>`
          : html``))}
      </hui-warning>
    `;
    /* eslint-enable indent */
  }

  /**
  * Renders a header containing a name and an icon
  * @returns {TemplateResult} Lit template result
  */
  renderHeader() {
    const {
      show, align_icon, align_header, font_size_header,
    } = this.config;
    const showIcon = show.icon && align_icon !== 'state';

    // Where each part sits is decided here rather than in the config, so the
    // icon can follow the name: a right-aligned name pushes the icon left,
    // which is the only arrangement that reads as a header. That means
    // align_icon MUST be able to be undefined - buildConfig deliberately does
    // not give it a default. See upstream #1413.
    let iconLoc;
    if (align_icon === undefined) {
      iconLoc = align_header === 'right' && show.name
        ? 'left'
        : 'right';
    } else {
      iconLoc = align_icon;
    }
    const nameLoc = align_header === 'center'
      ? 'center'
      : iconLoc === 'left'
        ? 'right'
        : 'left';

    return show.name || showIcon
      ? html`
          <div
            class="header"
            style="font-size: ${font_size_header}px;"
          >
            ${show.name ? this.renderName(nameLoc) : html``}${showIcon ? this.renderIcon(iconLoc) : html``}
          </div>
        `
      : html``;
  }

  /**
  * Renders an icon
  * @param {string} iconLoc Where the icon sits: left, right or state
  * @returns {TemplateResult} Lit template result
  */
  renderIcon(iconLoc) {
    if (this.config.icon_image !== undefined) {
      return html`
        <div class="icon" loc="${iconLoc}">
          <img src="${this.config.icon_image}" height="25"/>
        </div>
      `;
    }

    const { icon, icon_adaptive_color } = this.config.show;

    if (!icon
      || !this.entity
      || (!this.entity[0] && !this.isStaticValue(0))) {
      return html``;
    }

    const { icon_color } = this.config;
    const iconColor = icon_color || (icon_adaptive_color ? this.color : undefined);

    return html`
      <div
        class="icon"
        loc="${iconLoc}"
        style="${iconColor !== undefined ? `color: ${iconColor};` : ''}"
      >
        <ha-icon .icon=${this.computeIcon(this.entity[0])}></ha-icon>
      </div>
    `;
  }

  /**
  * Renders a name
  * @param {string} nameLoc Where the name sits: left, right or center
  * @returns {TemplateResult} Lit template result
  */
  renderName(nameLoc) {
    if (!this.config.show.name) {
      return html``;
    }

    const name = this.tooltip.entity !== undefined
      ? this.computeName(this.tooltip.entity)
      : this.config.name || this.computeName(0);
    const color = this.config.show.name_adaptive_color
      ? `opacity: 1; color: ${this.color};`
      : '';
    return html`
      <div class="name" loc="${nameLoc}">
        <span
          class="ellipsis"
          style="${color}"
        >${name}</span>
      </div>
    `;
  }

  /**
  * Renders states
  * @returns {TemplateResult} Lit template result
  */
  /**
   * Is there a secondary state to show at all? More than one entity is not
   * enough: an entity past the first only shows a state when asked to. The
   * wrapper reserves 1.4em to its left, so rendering an empty one shifts the
   * primary state - invisibly, until the state is pinned to a right corner.
   * ":empty" cannot guard it: lit keeps a template's whitespace, so the
   * element always holds a text node.
   * @returns {boolean} True if the secondary wrapper has something to hold
   */
  get hasSecondaryStates() {
    return this.config.entities.some((entity, index) => index > 0 && entity.show_state);
  }

  renderStates() {
    if (!this.config.show.state) {
      return html``;
    }
    return html`
      <div
        class="states flex"
        loc="${this.config.align_state}"
        style="${this.getStateStyle()}"
      >
        ${this.renderState(0)}
        ${this.hasSecondaryStates ? html`
          <div class="states--secondary">
            ${this.config.entities.slice(1).map((entityConfig, i) => this.renderState(i + 1))}
          </div>` : ''}
        ${this.config.align_icon === 'state' ? this.renderIcon('state') : html``}
      </div>
    `;
  }

  /**
   * An inline font size for a state value & its unit, if font_size_state is set.
   * @returns {string} Style string, empty if the option is not set
   */
  getStateStyle() {
    const { font_size_state: size, align_state: align, show } = this.config;
    let css = '';
    if (size !== undefined) {
      const uom = Math.round(size * STATE_UOM_RATIO * 100) / 100;
      css += `--mcg-state-value-size: ${size}px; --mcg-state-uom-size: ${uom}px;`;
    }
    // A state in a bottom corner is out of the flow & would otherwise be drawn
    // on top of the extrema row, which sits at the bottom of the card.
    if (show.extrema && isStateInCorner(align) && align.startsWith('bottom-')) {
      css += ` --mcg-state-bottom: ${Math.round(CARD_PADDING + getInfoHeight(this.config))}px;`;
    }
    return css;
  }

  /**
   * Check if an entity config contains a valid `static_value` option
   * @param {number} index Index of an entry in config.entities
   * @returns {boolean} True if a valid `static_value` option defined, false - otherwise
   */
  isStaticValue(index) {
    const entity = this.config.entities[index];
    return entity && typeof entity === 'object' && isNumeric(entity.static_value);
  }

  /**
  * Check if an entry represents a static_value with `show_static_inactive: true`
  * @param {number} index Index of an entry in config.entities
  * @returns {boolean} True if an entry represents a static value with `show_static_inactive: true`,
  * false - otherwise
  */
  isShowStaticInactive(index) {
    return this.isStaticValue(index) && this.config.entities[index].show_static_inactive === true;
  }

  /**
  * Returns an object attribute value
  * @returns {any} Value of an attribute/subattribute
  * @param obj stateObj.attributes
  * @param path Attribute defined as either a singular attribute or a tree-like path
  */
  getObjectAttr(obj, path) {
    if (!obj) {
      return;
    }
    return path.split('.').reduce((res, key) => res && res[key], obj);
  }

  /**
  * Check if an attribute path represents a nested object path (contains a dot separator)
  * @returns {boolean} True if a path contains a dot separator, false - otherwise
  * @param {string} path Attribute defined as either a singular attribute or a tree-like path
  */
  isObjectAttr(path) {
    return path.includes('.');
  }

  /** Returns a state/attribute value or a static_value
  * @returns {any} value of a state/attribute or a static_value
  * @param {number} index Index of an entry in config.entities
  */
  getEntityState(index) {
    const entityConfig = this.config.entities[index];
    if (this.config.show.state === 'last' && this.config.show.graph === 'bar') {
      // last "bar" value
      return this.bar[index][this.bar[index].length - 1].value;
    } else if (this.config.show.state === 'last' && this.points[index] && this.points[index].length) {
      // last "point" value; the coordinates now exist regardless of
      // "show.points", so this no longer silently falls through to a current
      // state when the points are not drawn
      return this.points[index][this.points[index].length - 1][V];
    } else if (this.isStaticValue(index)) {
      return this.config.entities[index].static_value;
    } else if (entityConfig.attribute) {
      // current attribute value
      return this.getObjectAttr(this.entity[index].attributes, entityConfig.attribute);
    } else {
      // current state value
      return this.entity[index].state;
    }
  }

  /**
  * Renders a state/attribute value or a static_value (if "show_state: true")
  * @returns {TemplateResult} Lit template result
  * @param {number} index Index of an entry in config.entities
  */
  renderState(index) {
    const isPrimary = index === 0; // rendering main entry state element?
    if (isPrimary || this.config.entities[index].show_state) {
      // get a state/attribute value or a static_value
      const state = this.getEntityState(index);
      // use tooltip data for main entry state element, if tooltip is active
      // "tooltip" - a selected point/bar
      const { entity: tooltipEntityIndex, value: tooltipValue } = this.tooltip;
      const isTooltip = isPrimary && tooltipEntityIndex !== undefined;
      // either a state/attr/static_value for a selected point/bar
      // - or a "native" state/attr/static_value
      const value = isTooltip ? tooltipValue : state;
      const entityIndex = isTooltip ? tooltipEntityIndex : index;
      const entityConfig = this.config.entities[entityIndex];
      // check if a unit should precend a value
      const { directOrder } = this.computeStateOrder(entityIndex, value);
      return html`
        <div
          reversed=${!directOrder}
          class="state ${!isPrimary ? 'state--small' : ''}"
          @click=${e => this.handlePopup(e, this.entity[index])}
          style=${entityConfig.state_adaptive_color ? `color: ${this.computeColor(value, entityIndex)}` : ''}
        >
          ${entityConfig.show_indicator ? this.renderIndicator(value, entityIndex) : ''}
          <span class="state__value ellipsis">
            ${this.computeState(value, entityIndex)}
          </span>
          <span class="state__uom ellipsis">
            ${this.computeUom(entityIndex, value)}
          </span>
          ${isPrimary && this.renderStateTime() || ''}
        </div>
      `;
    }
    return html``;
  }

  /**
  * Renders a "time interval" element for a selected point/bar
  * @returns {TemplateResult} Lit template result
  */
  renderStateTime() {
    // "tooltip" - a selected point/bar
    if (this.tooltip.value === undefined) {
      return html``;
    }
    return html`
      <div class="state__time">
        ${this.tooltip.label ? html`
          <span class="tooltip--label">${this.tooltip.label}</span>
        ` : html`
          <span>${this.tooltip.time[0]}</span> -
          <span>${this.tooltip.time[1]}</span>
        `}
      </div>
    `;
  }

  /**
  * Renders a Graph element (along with a legend)
  * @returns {TemplateResult} Lit template result
  */
  renderGraph() {
    const hasInitialData = this.entity
      && (this.entity[0] || this.isStaticValue(0));
    const ready = (hasInitialData
      && !this.Graph.some(
        (element, index) => element._history === undefined
          && this.config.entities[index].show_graph !== false,
      ))
    || this.config.show.loading_indicator === false;

    /* eslint-disable indent */
    return this.config.show.graph
      ? html`
          <div class="graph" ?anchored=${this.config.graph_height.mode !== GRAPH_HEIGHT_AUTO}
            style="${this.getGraphStyle()}">
            ${ready
              ? html`
                  <div class="graph__container">
                    <div class="graph__container__svg">
                      ${this.renderSvg()}
                      ${this.renderStaticLabels()}
                    </div>
                    ${this.renderLabels()}
                    ${this.renderLabelsSecondary()}
                    ${this.renderGridLabelsX()}
                  </div>
                  ${this.renderLegend()}
                `
              : html`<ha-spinner aria-label="Loading" size="small"></ha-spinner>`}
          </div>`
      : html``;
    /* eslint-enable indent */
  }

  /**
  * Renders a legend text entry for an entity/static value
  * @returns {string} Legend text string
  * @param {number} index Index of an entry in config.entities
  */
  computeLegend(index) {
    let legend = this.computeName(index);
    const state = this.getEntityState(index);
    const entityConfig = this.config.entities[index];
    const showLegendState = entityConfig && typeof entityConfig === 'object'
      ? entityConfig.show_legend_state === true
      : false;
    if (showLegendState) {
      legend += ` (${this.computeStateWithUom(state, index)})`;
    }
    return legend;
  }

  /**
  * Renders a whole legend for all entities
  * @returns {TemplateResult} Lit template result
  */
  renderLegend() {
    // do not show a legend for only 1 entry or when a legend is globally disabled
    if (this.visibleLegends.length <= 1 || !this.config.show.legend) {
      return html``;
    }
    const location = this.config.show.legend === 'below' ? 'below' : 'above';
    /* eslint-disable indent */
    return html`
      <div class="graph__legend" loc=${location}>
        ${this.visibleLegends.map((entity) => {
          const legend = this.computeLegend(entity.index);
          return html`
            <div class="graph__legend__item"
              data-entity-index=${entity.index}
              @click=${e => this.handlePopup(e, this.entity[entity.index])}
              @mouseenter=${() => this.setTooltip(entity.index, -1, this.getEntityState(entity.index), 'Current')}
              @mouseleave=${() => (this.tooltip = {})}>
              ${this.renderIndicator(this.getEntityState(entity.index), entity.index)}
              <span class="ellipsis">${legend}</span>
            </div>
          `;
        })}
      </div>
    `;
    /* eslint-enable indent */
  }

  /**
  * Renders an indicator for an entity/static value
  * @returns {SVGTemplateResult} SVG element
  * @param {string | number} state Value of a state/attribute or a static_value
  * @param {number} index Index of an entry in config.entities
  */
  renderIndicator(state, index) {
    return svg`
      <svg width="10" height="10">
        <rect width="10" height="10" fill="${this.computeColor(state, index)}" />
      </svg>
    `;
  }

  /**
  * Renders labels for static lines
  * @returns {TemplateResult} Lit template result
  */
  renderStaticLabels() {
    if (!this.config.show.static_value_labels) {
      return html``;
    }

    const graphHeight = this.graphHeight !== undefined
      ? this.graphHeight : DEFAULT_GRAPH_HEIGHT;
    if (!isNumeric(graphHeight) || graphHeight <= 0) {
      return html``;
    }

    const isLeft = this.config.show.static_value_labels === 'left';

    /* eslint-disable indent */
    return html`
      <div
        class="graph__static_value_labels"
        loc="${this.config.show.static_value_labels}"
      >
        ${this.config.entities.map((_, index) => {
          if (!this.isStaticValue(index)
            || this.config.entities[index].show_static_value_label === false) {
            return html``;
          }
          const staticValue = this.config.entities[index].static_value;
          // get Y coord in SVG space
          const [staticLineCoord] = this.Graph[index]._calcY([[0, 0, staticValue]]);
          const [, topSVG] = staticLineCoord; // top in SVG coords

          const topPercent = (topSVG / graphHeight) * 100; // top in %
          if (!isNumeric(topPercent)) {
            return html``;
          }

          const offset = this.config.static_value_label_offset; // offset in %

          const color = this.config.entities[index].state_adaptive_color
            ? this.computeColor(staticValue, index)
            : 'var(--primary-text-color)';

          return html`<span
            id="static-label-${index}"
            ?inactive=${this.tooltip.entity !== undefined && this.tooltip.entity !== index
              && !this.isShowStaticInactive(index)}
            style="
              color: ${color};
              top: ${topPercent}%;
              left: ${isLeft ? `${offset}%` : `calc(100% - ${offset}%)`};
            "
          >
            ${this.computeStateWithUom(staticValue, index)}
          </span>`;
        })}
      </div>
    `;
    /* eslint-enable indent */
  }

  /**
  * Renders a fill mask for a particular entity/static value
  * @returns {SVGTemplateResult} SVG element
  * @param {Array} fill Array of fill for a particular entity/static value
  * @param {number} index Index of an entry in config.entities
  */
  renderSvgFill(fill, index) {
    if (!fill) return;
    const fade = this.config.show.fill === 'fade';
    const init = this.length[index] || this.config.entities[index].show_line === false;
    return svg`
      <defs>
        <linearGradient id=${`fill-grad-${this.id}-${index}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop stop-color='white' offset='0%' stop-opacity='1'/>
          <stop stop-color='white' offset='100%' stop-opacity='.15'/>
        </linearGradient>
        <mask id=${`fill-grad-mask-${this.id}-${index}`}>
          <rect width="100%" height="100%" fill=${`url(#fill-grad-${this.id}-${index})`} />
        </mask>
      </defs>
      <mask id=${`fill-${this.id}-${index}`}>
        <path class='fill'
          type=${this.config.show.fill}
          .id=${index} anim=${this.config.animate} ?init=${init}
          style="animation-delay: ${this.config.animate ? `${index * 0.5}s` : '0s'}"
          fill='white'
          mask=${fade ? `url(#fill-grad-mask-${this.id}-${index})` : ''}
          d=${this.fill[index]}
        />
      </mask>`;
  }

  /**
  * Renders a line for a particular entity/static value
  * @returns {SVGTemplateResult} SVG element
  * @param {Array} line Array of lines for a particular entity/static value
  * @param {number} index Index of an entry in config.entities
  */
  renderSvgLine(line, index) {
    if (!line) return;
    const strokeDashArray = (this.config.animate
      ? this.length[index]
      : this.config.entities[index].line_style || this.config.line_style)
      || 'none';
    const lineWidth = getFirstDefinedItem(
      this.config.entities[index].line_width,
      this.config.line_width,
    );
    const path = svg`
      <path
        class='line'
        .id=${index}
        anim=${this.config.animate} ?init=${this.length[index]}
        style="animation-delay: ${this.config.animate ? `${index * 0.5}s` : '0s'}"
        fill='none'
        stroke-dasharray=${strokeDashArray} stroke-dashoffset=${this.length[index] || 'none'}
        stroke=${'white'}
        stroke-width=${lineWidth}
        d=${this.line[index]}
      />`;
    return svg`
      <mask id=${`line-${this.id}-${index}`}>
        ${path}
      </mask>
    `;
  }

  /**
  * Renders a line point for a particular entity/static value
  * @returns {SVGTemplateResult} SVG element
  * @param {Array} point Point for a particular entity/static value
  * @param {number} index Index of an entry in config.entities
  * @param {number} radius Previously calculated radius of a point
  * @param {boolean} hoverable Whether the point selects itself on hover
  * ("hover_mode: point"); with "nearest" the overlay does the selecting
  */
  renderSvgPoint(point, index, radius, hoverable) {
    const color = this.gradient[index]
      ? this.computeColor(point[V], index)
      : 'inherit';
    return svg`
      <circle
        class='line--point'
        ?inactive=${this.tooltip.index !== point[3]}
        style=${`--mcg-hover: ${color};`}
        stroke=${color}
        fill=${color}
        cx=${point[X]} cy=${point[Y]} r=${radius}
        @mouseover=${hoverable ? () => this.setTooltip(index, point[3], point[V]) : undefined}
        @mouseout=${hoverable ? () => (this.tooltip = {}) : undefined}
      />
    `;
  }

  /**
  * Renders a marker for a point selected by "hover_mode: nearest".
  * The point itself may be hidden ("show.points: false") or, being as small as
  * a line is wide, hard to tell from its neighbours.
  * @returns {SVGTemplateResult|undefined} SVG element
  */
  renderSvgHoverMarker() {
    const { entity, index } = this.tooltip;
    if (this.config.hover_mode !== HOVER_NEAREST || entity === undefined) return;
    const radius = getFirstDefinedItem(
      this.config.entities[entity].line_width,
      this.config.line_width,
    ) * 1.5;

    if (this.config.show.graph === 'bar') {
      // Bars have no point to mark, so mark the bar - ABOVE it, clear of its
      // top edge. Centred on the edge, half the marker reads as extra height
      // and the bar appears to grow when it is hovered. Nothing else says which
      // bar is being read: the overlay which reads it sits above them, so their
      // own :hover never fires.
      const bar = (this.bar[entity] || [])[index];
      if (!bar) return;
      // no wider than the bar, or a marker spans the ones beside it
      const size = Math.max(2, Math.min(radius, bar.width / 2));
      return this.renderHoverMarker(
        bar.x + bar.width / 2,
        Math.max(size, bar.y - size - BAR_MARKER_GAP),
        size,
        this.computeColor(bar.value, entity),
      );
    }

    const points = this.points[entity];
    const point = points && points.find(item => item[3] === index);
    if (!point) return;
    return this.renderHoverMarker(point[X], point[Y], radius, this.computeColor(point[V], entity));
  }

  /**
   * Renders the marker showing which point or bar is being read.
   * @returns {SVGTemplateResult} SVG element
   */
  renderHoverMarker(cx, cy, radius, color) {
    return svg`
      <circle class='hover--marker' cx=${cx} cy=${cy} r=${radius}
        stroke=${color} fill=${color} />`;
  }

  /**
  * Renders a transparent overlay covering the whole graph, which captures
  * pointer moves for "hover_mode: nearest". It has to be the LAST child of the
  * svg: SVG has no z-index, stacking follows the document order.
  * @returns {SVGTemplateResult|undefined} SVG element
  */
  renderSvgHoverArea() {
    if (this.config.hover_mode !== HOVER_NEAREST) return;
    return svg`
      <rect class='hover-area'
        x='0' y='0' width=${this.graphWidth} height=${this.graphHeight}
        @touchstart=${e => this.handleTouchScrub(e)}
        @touchmove=${e => this.handleTouchScrub(e)}
        @touchend=${() => (this.tooltip = {})} />`;
  }

  /**
  * Read the graph while a finger is dragged across it. Hovering is answered on
  * the card itself (see handleCardHover), which a touch screen never fires.
  * @param {TouchEvent} event A touch on the overlay
  */
  handleTouchScrub(event) {
    const touch = event.touches && event.touches[0];
    if (!touch) return;
    this.selectAt(touch.clientX, touch.clientY, event.currentTarget.ownerSVGElement);
  }

  /**
   * The entity of a legend entry at a position, if one is there. A touch screen
   * fires no mouseenter, so the legend's own hover never runs & a press has to
   * find the entry itself.
   * @param {number} clientX Position of a pointer
   * @param {number} clientY Position of a pointer
   * @returns {number|undefined} Index of an entry in config.entities
   */
  legendIndexAt(clientX, clientY) {
    const element = this.shadowRoot && this.shadowRoot.elementFromPoint(clientX, clientY);
    const item = element && element.closest('[data-entity-index]');
    return item ? Number(item.dataset.entityIndex) : undefined;
  }

  /**
   * Read the graph under the cursor, wherever the cursor is on the card. The
   * chrome is drawn OVER the graph - a state row overlaps it, a header can sit
   * on a backdrop graph entirely - and those elements swallow a move before it
   * ever reaches the svg. Hit-testing cannot answer this; the geometry can.
   * @param {MouseEvent} event A move anywhere on the card
   */
  handleCardHover(event) {
    if (this.config.hover_mode !== HOVER_NEAREST) return;
    const root = this.shadowRoot;
    const graph = root && root.querySelector('.graph');
    if (!graph || !this.isWithin(graph, event)) {
      if (this.tooltip.value !== undefined) this.tooltip = {};
      return;
    }
    // The legend sits inside the graph & names an entity of its own: hovering
    // an entry shows THAT entity's current value, which reading the nearest
    // line would override on the next move.
    if (this.isWithin(root.querySelector('.graph__legend'), event)) return;
    this.selectAt(event.clientX, event.clientY);
  }

  /**
   * Is a pointer inside an element's box?
   * @param {Element} [element] Element to test, absent counts as "no"
   * @param {MouseEvent} event An event carrying a client position
   * @returns {boolean} True if the pointer is within
   */
  isWithin(element, event) {
    if (!element) return false;
    const {
      left, right, top, bottom,
    } = element.getBoundingClientRect();
    return event.clientX >= left && event.clientX <= right
      && event.clientY >= top && event.clientY <= bottom;
  }

  /**
   * Select the point/bar under a position given in client coordinates.
   * @param {number} clientX Position of a pointer
   * @param {number} clientY Position of a pointer
   * @param {SVGSVGElement} [svgElement] The graph's svg, looked up if omitted
   */
  selectAt(clientX, clientY, svgElement = this.shadowRoot
    && this.shadowRoot.querySelector('.graph svg')) {
    const matrix = svgElement && svgElement.getScreenCTM();
    if (!matrix) return;
    const { x, y } = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());

    if (this.config.show.graph === 'bar') {
      const hit = findNearestBar(this.bar, x, y);
      // Re-rendering on every move of a cursor would be wasteful
      if (!hit || (this.tooltip.entity === hit.entity && this.tooltip.index === hit.index)) return;
      this.setTooltip(hit.entity, hit.index, hit.bar.value);
      return;
    }
    const hit = findNearestPoint(this.points, x, y);
    if (!hit || (this.tooltip.entity === hit.entity && this.tooltip.index === hit.point[3])) return;
    this.setTooltip(hit.entity, hit.point[3], hit.point[V]);
  }

  /**
  * Renders points for a particular entity/static value
  * @returns {SVGTemplateResult} SVG element
  * @param {Array} points Array of points for a particular entity/static value
  * @param {number} index Index of an entry in config.entities
  */
  renderSvgPoints(points, index) {
    if (!points) return;
    // The coordinates are always computed, the circles are not always drawn
    if (!this.config.show.points || this.config.entities[index].show_points === false) return;
    const state = this.entity[index] !== undefined
      ? this.entity[index].state
      : this.isStaticValue(index)
        ? this.config.entities[index].static_value
        : undefined;
    const color = this.computeColor(state, index);
    const inactive = this.tooltip.entity !== undefined
      && this.tooltip.entity !== index
      && !this.isShowStaticInactive(index);
    const radius = getFirstDefinedItem(
      this.config.entities[index].line_width,
      this.config.line_width,
    );
    const hoverable = this.config.hover_mode === HOVER_POINT;
    return svg`
      <g class='line--points'
        ?tooltip=${this.tooltip.entity === index}
        ?inactive=${inactive}
        ?init=${this.length[index]}
        anim=${this.config.animate && this.config.show.points !== 'hover'}
        style="animation-delay: ${this.config.animate ? `${index * 0.5 + 0.5}s` : '0s'}"
        fill=${color}
        stroke=${color}
        stroke-width=${radius / 2}>
        ${points.map(point => this.renderSvgPoint(point, index, radius, hoverable))}
      </g>`;
  }

  renderSvgGradient(gradients) {
    if (!gradients) return;
    const items = gradients.map((gradient, i) => {
      if (!gradient) return;
      return svg`
        <linearGradient id=${`grad-${this.id}-${i}`} gradientTransform="rotate(90)">
          ${gradient.map(stop => svg`
            <stop stop-color=${stop.color} offset=${`${stop.offset}%`} />
          `)}
        </linearGradient>`;
    });
    return svg`${items}`;
  }

  /**
  * Renders a background rectangle for a particular entity/static value
  * @returns {SVGTemplateResult} SVG element
  * @param {Array} line Array of lines for a particular entity/static value
  * @param {number} index Index of an entry in config.entities
  */
  renderSvgLineRect(line, index) {
    if (!line) return;
    const state = this.entity[index] !== undefined
      ? this.entity[index].state
      : this.isStaticValue(index)
        ? this.config.entities[index].static_value
        : undefined;
    const fill = this.gradient[index]
      ? `url(#grad-${this.id}-${index})`
      : this.computeColor(state, index);
    const inactive = this.tooltip.entity !== undefined
      && this.tooltip.entity !== index
      && !this.isShowStaticInactive(index);
    return svg`
      <rect class='line--rect'
        ?inactive=${inactive}
        id=${`rect-${this.id}-${index}`}
        fill=${fill} height="100%" width="100%"
        mask=${`url(#line-${this.id}-${index})`}
      />`;
  }

  /**
  * Renders a background fill rectangle for a particular entity/static value
  * @returns {SVGTemplateResult} SVG element
  * @param {Array} fill Array of fill for a particular entity/static value
  * @param {number} index Index of an entry in config.entities
  */
  renderSvgFillRect(fill, index) {
    if (!fill) return;
    const state = this.entity[index] !== undefined
      ? this.entity[index].state
      : this.isStaticValue(index)
        ? this.config.entities[index].static_value
        : undefined;
    const svgFill = this.gradient[index]
      ? `url(#grad-${this.id}-${index})`
      : this.computeColor(state, index);
    const inactive = this.tooltip.entity !== undefined
      && this.tooltip.entity !== index
      && !this.isShowStaticInactive(index);
    return svg`
      <rect class='fill--rect'
        ?inactive=${inactive}
        id=${`fill-rect-${this.id}-${index}`}
        fill=${svgFill} height="100%" width="100%"
        mask=${`url(#fill-${this.id}-${index})`}
      />`;
  }

  /**
  * Renders bars for a particular entity/static value
  * @returns {SVGTemplateResult} SVG element
  * @param {Array} bars Array of bars for a particular entity/static value
  * @param {number} index Index of an entry in config.entities
  */
  renderSvgBars(bars, index) {
    if (!bars) return;
    const hoverable = this.config.hover_mode === HOVER_POINT;
    const items = bars.map((bar, i) => {
      const animation = this.config.animate
        ? svg`
          <animate attributeName='y' from=${this.graphHeight} to=${bar.y} dur='1s' fill='remove'
            calcMode='spline' keyTimes='0; 1' keySplines='0.215 0.61 0.355 1'>
          </animate>`
        : '';
      const color = this.computeColor(bar.value, index);
      return svg`
        <rect class='bar' x=${bar.x} y=${bar.y}
          height=${bar.height} width=${bar.width} fill=${color}
          @mouseover=${hoverable ? () => this.setTooltip(index, i, bar.value) : undefined}
          @mouseout=${hoverable ? () => (this.tooltip = {}) : undefined}>
          ${animation}
        </rect>`;
    });
    const inactive = this.tooltip.entity !== undefined
      && this.tooltip.entity !== index
      && !this.isShowStaticInactive(index);
    return svg`
      <g
        class='bars'
        ?anim=${this.config.animate}
        ?inactive=${inactive}
      >${items}</g>`;
  }

  /** Returns a rendered SVG part (fill, line, bars, points)
  * in a direct or a reversed order
  * @returns {SVGTemplateResult[]} SVG part
  * @param {any[]} data Array of data to render an SVG part
  * @param {Function} renderFunc Function to render an SVG part
  * @param {boolean} reversed True if a reversed order
  */
  renderSvgPart(data, renderFunc, reversed) {
    const renderFuncBound = renderFunc.bind(this);
    const len = data.length;
    const result = new Array(len);
    if (reversed) {
      for (let index = len - 1; index >= 0; index -= 1) {
        result[len - 1 - index] = renderFuncBound(data[index], index);
      }
    } else {
      for (let index = 0; index < len; index += 1) {
        result[index] = renderFuncBound(data[index], index);
      }
    }
    return result;
  }

  /** Returns all rendered SVG parts (fill, line, bars, points)
  * @returns {SVGTemplateResult} SVG element
  */
  renderSvg() {
    const { show } = this.config;
    const height = this.graphHeight;
    const width = this.graphWidth;
    const reversed = show.graph_order === 'reversed';
    return svg`
      <svg width='100%' height=${height !== 0 ? '100%' : 0} viewBox='0 0 ${width} ${height}'
        >
        ${this.renderGrid()}
        <g>
          <defs>
            ${this.renderSvgGradient(this.gradient)}
          </defs>
          ${this.renderSvgPart(this.fill, this.renderSvgFill, reversed)}
          ${this.renderSvgPart(this.fill, this.renderSvgFillRect, reversed)}
          ${this.renderSvgPart(this.line, this.renderSvgLine, reversed)}
          ${this.renderSvgPart(this.line, this.renderSvgLineRect, reversed)}
          ${this.renderSvgPart(this.bar, this.renderSvgBars, this.config.bar_spacing === -1 && reversed)}
        </g>
        ${this.renderSvgPart(this.points, this.renderSvgPoints, reversed)}
        ${this.renderSvgHoverMarker()}
        ${this.renderSvgHoverArea()}
      </svg>`;
  }

  /**
   * Renders the grid lines, FIRST in the svg so they sit behind everything -
   * an svg has no z-index, only document order.
   * @returns {SVGTemplateResult|undefined} SVG element
   */
  renderGrid() {
    const { grid_x: gridX, grid_y: gridY } = this.config;
    if (!gridX && !gridY) return;
    // Any graph will do for the geometry: they share a size & a window
    const graph = (this.Graph || []).find(item => item && item.coords.length > 0);
    if (!graph) return;

    const lines = [];
    if (gridX) {
      getGridTimes(graph._endTime, this.config.hours_to_show,
        { ...gridX, width: this.graphWidth })
        .forEach(({ time, major }) => {
          const x = graph.getX(time);
          lines.push(this.renderGridLine(gridX, major, x, 0, x, this.graphHeight));
        });
    }
    if (gridY) {
      // ...but the values follow one axis, & a graph only knows the bounds of
      // the axis its own entity was drawn against.
      const secondary = gridY.axis === 'secondary';
      const onAxis = (this.Graph || []).find((item, index) => item && item.coords.length > 0
        && (this.config.entities[index].y_axis === 'secondary') === secondary) || graph;
      const bound = secondary ? this.boundSecondary : this.bound;
      getGridValues(bound[0], bound[1],
        { ...gridY, logarithmic: this.config.logarithmic, height: this.graphHeight })
        .forEach(({ value, major }) => {
          const y = onAxis.getY(value);
          lines.push(this.renderGridLine(gridY, major, 0, y, this.graphWidth, y));
        });
    }
    return svg`<g class="grid">${lines}</g>`;
  }

  /**
   * Renders one grid line.
   * @param {object} grid A parsed grid_x/grid_y
   * @param {boolean} major Whether it is a full line rather than one between
   * @returns {SVGTemplateResult} SVG element
   */
  renderGridLine(grid, major, x1, y1, x2, y2) {
    const stroke = [
      grid.color !== undefined ? `stroke: ${grid.color};` : '',
      grid.width !== undefined ? `stroke-width: ${grid.width};` : '',
    ].join('');
    return svg`<line class="grid--line" ?minor=${!major} ?strong=${major && grid.minor > 0}
      x1=${x1} y1=${y1} x2=${x2} y2=${y2} style=${stroke} />`;
  }

  setTooltip(entity, index, value, label = null) {
    const {
      group_by,
      points_per_hour,
      hours_to_show,
    } = this.config;

    // time units in milliseconds in this function
    const interval = getMilli(1 / points_per_hour);
    const n_points = Math.ceil(hours_to_show * points_per_hour);

    // index is 0 (oldest) to n_points-1 (most recent ~= now)
    // count of intervals from now to end of bin
    // count is 0 (now) to n_points-1 (oldest)
    const count = (n_points - 1) - index;

    // offset end by a minute, if grouped by, e.g., date or hour
    const oneMinute = group_by !== 'interval' ? 60000 : 0;

    const now = this.getEndDate();

    now.setMilliseconds(now.getMilliseconds() - oneMinute - interval * count);
    const end = formatDateTime(
      now,
      this.config,
      this.datetimeFormatFromCfgParsed,
      this.datetimeFormatDateOptions,
      this.datetimeFormatTimeOptions,
      this._hass,
    );
    now.setMilliseconds(now.getMilliseconds() + oneMinute - interval);
    const start = formatDateTime(
      now,
      this.config,
      this.datetimeFormatFromCfgParsed,
      this.datetimeFormatDateOptions,
      this.datetimeFormatTimeOptions,
      this._hass,
    );

    this.tooltip = {
      value,
      count,
      entity,
      time: [start, end],
      index,
      label,
    };
  }

  /**
  * Renders primary Y-axis labels
  * @returns {TemplateResult} Lit template result
  */
  renderLabels() {
    if (!this.config.show.labels
        || !this.bound || this.primaryYaxisSeries.length === 0) {
      return html``;
    }
    // A value grid names every line it draws, which says more than the bounds
    const grid = this.renderGridLabelsY('primary');
    if (grid) return grid;
    // index is not passed into computeState() for a primary axis
    return html`
      <div class="graph__labels --primary flex">
        <span class="label--max">${this.computeState(this.bound[1])}</span>
        <span class="label--min">${this.computeState(this.bound[0])}</span>
      </div>
    `;
  }

  /**
  * Renders secondary Y-axis labels
  * @returns {TemplateResult} Lit template result
  */
  /**
   * Labels for a value grid: one per full line, at the line. Replaces the
   * bounds in the column that already exists, so it inherits its placement,
   * its theming & "show.labels: hover" - no second visual language.
   * @param {string} axis "primary" or "secondary"
   * @returns {TemplateResult|undefined} Lit template result
   */
  renderGridLabelsY(axis) {
    const grid = this.config.grid_y;
    // without labels the column falls back to naming the bounds, as it always did
    if (!grid || !grid.labels || (grid.axis || 'primary') !== axis) return undefined;
    const secondary = axis === 'secondary';
    const onAxis = (this.Graph || []).find((item, index) => item && item.coords.length > 0
      && (this.config.entities[index].y_axis === 'secondary') === secondary);
    if (!onAxis) return undefined;

    const bound = secondary ? this.boundSecondary : this.bound;
    let lastY = -Infinity;
    const labels = getGridValues(bound[0], bound[1], {
      ...grid, logarithmic: this.config.logarithmic, height: this.graphHeight,
    }).filter(line => line.major).reduce((result, { value }) => {
      const y = onAxis.getY(value);
      // a label is smaller than a grid gap, but two must still not overlap
      if (Math.abs(y - lastY) < GRID_LABEL_MIN_SPACING) return result;
      lastY = y;
      result.push(html`
        <span style="top: ${y}px">${this.computeState(value, secondary ? -1 : undefined)}</span>`);
      return result;
    }, []);
    if (labels.length === 0) return undefined;
    return html`
      <div class="graph__labels --${axis} --grid" ?always=${grid.labels === 'always'}>
        ${labels}
      </div>`;
  }

  /**
   * Labels for a time grid, along the bottom. Only for intervals which name a
   * date - an hourly grid would be a dozen labels saying very little.
   * @returns {TemplateResult} Lit template result
   */
  renderGridLabelsX() {
    const grid = this.config.grid_x;
    // "show.labels" is the card's switch for axis text of any kind, time
    // labels included - it named only the Y axis until there was an X one.
    if (!grid || !grid.labels || !this.config.show.labels) return html``;
    const graph = (this.Graph || []).find(item => item && item.coords.length > 0);
    if (!graph) return html``;
    const { hours_to_show: hours } = this.config;
    const interval = !grid.interval || grid.interval === 'auto'
      ? getGridInterval(hours, this.graphWidth)
      : grid.interval;
    if (!GRID_LABEL_INTERVALS.includes(interval)) return html``;

    const locale = this._hass && this._hass.locale && this._hass.locale.language;
    const options = interval === 'month' ? { month: 'short' }
      : interval === 'week' ? { day: 'numeric', month: 'short' }
        : (hours <= 24 * 8 ? { weekday: 'short' } : { day: 'numeric', month: 'numeric' });
    const formatter = getDateTimeFormat(locale, options);

    const times = getGridTimes(graph._endTime, hours, { ...grid, width: this.graphWidth })
      .filter(line => line.major)
      .map(({ time }) => ({ time, text: formatter.format(new Date(time)) }));
    // A label is wider than the line it names, so a grid which reads well can
    // still have labels which collide: show every Nth of them instead.
    const fontSize = this.config.font_size * 0.15 + 8.5;
    const widest = times.reduce((most, item) => Math.max(most, item.text.length), 0);
    const stride = getLabelStride(times.length, this.graphWidth, widest * fontSize * 0.6 + 6);

    const labels = times
      .filter((item, index) => index % stride === 0)
      .map(({ time, text }) => html`
        <span style="left: ${graph.getX(time)}px">${text}</span>`);
    return labels.length
      ? html`<div class="graph__labels --grid --grid-x" ?hover=${grid.labels === 'hover'}>
          ${labels}
        </div>`
      : html``;
  }

  renderLabelsSecondary() {
    if (!this.config.show.labels_secondary
        || !this.boundSecondary || this.secondaryYaxisSeries.length === 0) {
      return html``;
    }
    const grid = this.renderGridLabelsY('secondary');
    if (grid) return grid;
    // index "-1" is passed into computeState() for a secondary axis
    return html`
      <div class="graph__labels --secondary flex">
        <span class="label--max">${this.computeState(this.boundSecondary[1], -1)}</span>
        <span class="label--min">${this.computeState(this.boundSecondary[0], -1)}</span>
      </div>
    `;
  }

  /**
  * Renders extrema & average info
  * @returns {TemplateResult} Lit template result
  */
  renderInfo() {
    const {
      extrema,
      average,
      info_hide_unit: hideUnit,
    } = this.config.show;
    const location = (extrema === 'below' || average === 'below') ? 'below' : 'above';
    // index "0" is passed into computeStateWithUom() since "info" is shown for the 1st entry
    /* eslint-disable indent */
    return this.abs.length > 0 ? html`
      <div class="info flex" loc=${location}>
        ${this.abs.map(entry => html`
          <div class="info__item">
            <span class="info__item__type">${entry.type}</span>
            <span class="info__item__value">
              ${this.computeStateWithUom(entry.state, 0, hideUnit)}
            </span>
            <span class="info__item__time">
              ${entry.type !== 'avg'
                ? formatDateTime(
                    new Date(entry.last_changed),
                    this.config,
                    this.datetimeFormatFromCfgParsed,
                    this.datetimeFormatDateOptions,
                    this.datetimeFormatTimeOptions,
                    this._hass,
                  )
                : ''}
            </span>
          </div>
        `)}
      </div>
    ` : html``;
    /* eslint-enable indent */
  }

  /**
   * Start timing a hold. A hold fires hold_action from any input; moving the
   * pointer or letting go first leaves it a tap.
   * @param {PointerEvent} event A pointerdown on the card
   */
  handlePointerDown(event) {
    this._pointerType = event.pointerType;
    // Kept until the NEXT press: the click which ends a tap arrives after
    // pointerup, & that is where a tap is answered.
    this._pointerOrigin = [event.clientX, event.clientY];
    this._holdArmed = true;
    this._holdFired = false;
    if (event.pointerType === 'touch') {
      const legend = this.legendIndexAt(event.clientX, event.clientY);
      if (legend !== undefined) {
        this.setTooltip(legend, -1, this.getEntityState(legend), 'Current');
      }
    }
    clearTimeout(this._holdTimer);
    const { hold_action: holdAction } = this.config;
    if (!holdAction || holdAction.action === 'none') return;
    this._holdTimer = setTimeout(() => {
      this._holdFired = true;
      this.runAction(holdAction);
    }, HOLD_TIME);
  }

  /** A pointer which wanders is a scroll or a drag, not a hold. */
  handlePointerMove(event) {
    if (!this._holdArmed || !this._pointerOrigin) return;
    const [x, y] = this._pointerOrigin;
    if (Math.abs(event.clientX - x) > HOLD_MOVE_TOLERANCE
      || Math.abs(event.clientY - y) > HOLD_MOVE_TOLERANCE) this.cancelHold();
  }

  /**
   * A touch screen has no hover, so a TAP anywhere on the card reads the graph
   * & a HOLD acts on it - the same everywhere, with no boundary to find. A card
   * with nothing drawn to read falls back to acting.
   * @param {Event} event The click a tap produced
   * @returns {boolean} True if the tap was answered by reading
   */
  readOnTouch(event) {
    if (this._pointerType !== 'touch' || !this._pointerOrigin) return false;
    const svgElement = this.shadowRoot && this.shadowRoot.querySelector('.graph svg');
    if (!svgElement) return false;
    event.stopPropagation();
    if (this.legendIndexAt(...this._pointerOrigin) === undefined) {
      this.selectAt(this._pointerOrigin[0], this._pointerOrigin[1], svgElement);
    }
    return true;
  }

  cancelHold() {
    clearTimeout(this._holdTimer);
    this._holdArmed = false;
  }

  /**
   * Which entity a card-wide action applies to. A multi-entity card reads one
   * series at a time - hovering a line, or a legend entry - so an action taken
   * while one is highlighted means THAT entity, not just the first one.
   * A tap_action/hold_action naming an entity outranks both.
   * @param {object} [actionConfig] tap_action or hold_action
   * @returns {object|string|undefined} A state object, or a configured entity id
   */
  actionEntity(actionConfig) {
    if (actionConfig && actionConfig.entity) return actionConfig.entity;
    const highlighted = this.tooltip.entity;
    return (highlighted !== undefined && this.entity[highlighted]) || this.entity[0];
  }

  /**
   * Run a configured action. A target may be a state object or an entity id -
   * a legend entry and a state row pass the object they already hold.
   * @param {object} actionConfig tap_action or hold_action
   * @param {object|string} [entity] Target, defaulting to the one being read
   */
  runAction(actionConfig, entity = this.actionEntity(actionConfig)) {
    if (actionConfig.action === 'more-info' && !entity) return;
    handleClick(this, this._hass, this.config, actionConfig,
      (entity && entity.entity_id) || entity);
  }

  handlePopup(e, entity) {
    // a hold already acted; the click which follows it must not act again
    if (this._holdFired) {
      this._holdFired = false;
      e.stopPropagation();
      return;
    }
    if (this.readOnTouch(e)) return;
    e.stopPropagation();
    this.runAction(this.config.tap_action, entity);
  }

  get visibleEntities() {
    if (!this._visibleEntitiesCache) {
      this._visibleEntitiesCache = this.config.entities
        .filter(entity => entity.show_graph !== false);
    }
    return this._visibleEntitiesCache;
  }

  get primaryYaxisEntities() {
    if (!this._primaryYaxisEntitiesCache) {
      this._primaryYaxisEntitiesCache = this.visibleEntities
        .filter(entity => entity.y_axis === undefined || entity.y_axis === 'primary');
    }
    return this._primaryYaxisEntitiesCache;
  }

  get secondaryYaxisEntities() {
    if (!this._secondaryYaxisEntitiesCache) {
      this._secondaryYaxisEntitiesCache = this.visibleEntities
        .filter(entity => entity.y_axis === 'secondary');
    }
    return this._secondaryYaxisEntitiesCache;
  }

  get visibleLegends() {
    if (!this._visibleLegendsCache) {
      this._visibleLegendsCache = this.visibleEntities
        .filter(entity => entity.show_legend !== false);
    }
    return this._visibleLegendsCache;
  }

  /* A series with nothing plotted must not set an axis. Its min & max are 0
     until it is given data, so an entity with no history in the window would
     otherwise drag the axis down to zero for every other entity on it. */
  get primaryYaxisSeries() {
    return this.primaryYaxisEntities
      .map(entity => this.Graph[entity.index])
      .filter(graph => graph && graph.coords.length > 0);
  }

  get secondaryYaxisSeries() {
    return this.secondaryYaxisEntities
      .map(entity => this.Graph[entity.index])
      .filter(graph => graph && graph.coords.length > 0);
  }

  /**
  * Returns a color for an entity/static value
  * accounting `color_thresholds`, global `line_color` & individual `color` settings
  * @returns Color
  * @param {string | number} inState Value of a state/attribute or a static_value
  * @param {number} index Index of an entry in config.entities
  */
  computeColor(inState, index) {
    const { line_color } = this.config;
    const defaultColor = line_color[index] || line_color[0];

    if (inState === undefined) {
      return this.config.entities[index].color
        || defaultColor;
    }

    const color_thresholds = this.config.entities[index].color_thresholds
      || this.config.color_thresholds;
    const state = Number(inState) || 0;
    let intColor;
    if (color_thresholds.length > 0) {
      const { color } = color_thresholds.find(ele => ele.value <= state)
        || color_thresholds.at(-1);
      intColor = color;
      const indexThreshold = color_thresholds.findIndex(ele => ele.value <= state);
      if (indexThreshold !== -1) {
        const c1 = color_thresholds[indexThreshold];
        const c2 = color_thresholds[indexThreshold - 1];
        if (c2) {
          const factor = (c2.value - state) / (c2.value - c1.value);
          intColor = interpolateRGB(c2.color, c1.color, factor);
        } else {
          // state is equal to or above the last stop point
          intColor = color_thresholds[0].color;
        }
      } else {
        // state is below the first stop point
        intColor = color_thresholds[color_thresholds.length - 1].color;
      }
    }

    return this.config.entities[index].color
      || intColor
      || defaultColor;
  }

  /**
  * Returns a name of an entity/static value accounting a `name` option
  * @returns {string} Name of an entity/static value
  * @param {number} index Index of an entry in config.entities
  */
  computeName(index) {
    // use a possibly defined "name" option
    const entityConfig = this.config.entities[index];
    if (entityConfig
      && entityConfig.name !== undefined && entityConfig.name !== null) {
      return String(entityConfig.name);
    }
    // use a possibly present friendly_name for an entity
    const stateObj = this.entity && this.entity[index];
    if (stateObj) {
      return stateObj.attributes.friendly_name || stateObj.entity_id;
    }
    // use a fixed label for a static value
    return this.isStaticValue(index) ? 'Static' : '';
  }

  /**
  * Returns an icon for an entity
  * accounting an `icon` option, entity's native `icon` attribute,
  * fallback to a standard MDI "temperature" icon
  * @returns {string} mdi:icon
  * @param {object} entity stateObj for an entity
  */
  computeIcon(entity) {
    return (
      this.config.icon
      || entity && entity.attributes.icon
      || typeof stateIcon === 'function' && entity && stateIcon(entity)
      || ICONS.temperature
    );
  }

  /**
  * Returns a unit
  * @returns {string} Unit
  * @param {number} index Index of an entry in config.entities
  * @param {number|string} inState Value of a state/attribute,
  * only used to process a preserved unit for a currently unavailable entity
  */
  computeUom(index, inState = undefined) {
    const entityUnit = this.config.entities[index].unit;
    const cardUnit = this.config.unit;
    let unit;

    if (!this.entity[index] && this.isStaticValue(index)) {
      // processing static_value
      if (entityUnit !== undefined) {
        unit = entityUnit;
      } else if (cardUnit !== undefined) {
        unit = cardUnit;
      }
      return (unit || '');
    } else {
      // processing entity
      const entityId = this.entity[index].entity_id;
      const stateObj = this._hass.states[entityId];
      if (!stateObj || isUnavailableState(stateObj.state)) {
        // processing unavailable state
        if (inState !== undefined && !isUnavailableState(inState)) {
          // we need to get a unit for a historical non-unavailable entity
          if (this.preserved_uom[index] !== undefined) {
            // use a preserved unit
            unit = this.preserved_uom[index];
          } else {
            // try using a unit from config & attributes
            unit = this.config.entities[index].unit
              || this.config.unit
              || stateObj && stateObj.attributes.unit_of_measurement
              || '';
          }
        } else {
          unit = '';
        }
        return unit;
      } else {
        // processing normal state
        if (entityUnit !== undefined) {
          unit = entityUnit;
        } else if (cardUnit !== undefined) {
          unit = cardUnit;
        } else {
          // retrieving a native unit
          const { attribute } = this.config.entities[index];
          if (!attribute || !this.isObjectAttr(attribute)) {
            // any cases except an object attribute
            let parts;
            if (attribute) {
              parts = this._hass.formatEntityAttributeValueToParts(
                stateObj,
                attribute,
              );
            } else {
              parts = this._hass.formatEntityStateToParts(
                stateObj,
              );
            }
            const unitPart = parts.find(part => part.type === 'unit');
            unit = unitPart && unitPart.value;
          } else {
            // object attribute - considered as unitless
            unit = '';
          }
        }
        // preserve a computed unit
        if (this.preserved_uom[index] === undefined) {
          this.preserved_uom[index] = unit || '';
        }
        return (unit || '');
      }
    }
  }

  /**
  * Returns the "format" setting in effect for a value
  * @returns {string|undefined} "number", "duration" or undefined
  * @param {number} index Index of an entry in config.entities,
  * "undefined" for a primary Y-axis, "-1" for a secondary one
  */
  computeFormat(index) {
    if (index === undefined || index === -1
      || this.config.entities[index].format === undefined) {
      return this.config.format;
    }
    return this.config.entities[index].format;
  }

  /**
  * Returns how many seconds a unit of a value is worth, so that "format:
  * duration" can render an entity reporting minutes or hours just as well as
  * one reporting seconds. An unrecognised unit is taken to be seconds.
  * Y-axis labels borrow the unit of the first entity drawn against that axis.
  * @returns {number} Seconds per unit
  * @param {number} index Index of an entry in config.entities,
  * "undefined" for a primary Y-axis, "-1" for a secondary one
  * @param {number|string} inState Value of a state/attribute
  */
  computeDurationScale(index, inState = undefined) {
    let unitIndex = index;
    if (index === undefined || index === -1) {
      const secondary = index === -1;
      unitIndex = this.config.entities
        .findIndex(entity => (entity.y_axis === 'secondary') === secondary);
      if (unitIndex === -1) return 1;
    }
    // computeUom() reads this.entity[], which is not populated yet on a first render
    if (!this.entity[unitIndex] && !this.isStaticValue(unitIndex)) return 1;
    return DURATION_UNITS[this.computeUom(unitIndex, inState)] || 1;
  }

  /**
  * Returns a string value for a state/attribute or a static_value:
  * localized, following locale settings,
  * (for entities:) accounting possible individual accuracy settings & possible "decimals" options
  * @returns {string} value of a state/attribute
  * @param {number|string} inState Value of a state/attribute ("unformatted") or a static_value
  * @param {number} index Index of an entry in config.entities
  */
  computeState(inState, index) {
    if (this.config.state_map.length > 0) {
      const stateMap = Number.isInteger(inState)
        ? this.config.state_map[inState]
        : this.config.state_map.find(state => state.value === inState);

      if (stateMap) {
        return stateMap.label;
      } else {
        log(`value [${inState}] not found in state_map`);
      }
    }

    if (inState === undefined || inState === null || inState === '') {
      return formatNumber(NaN, this._hass.locale);
    }

    let state;
    if (isUnavailableState(inState)) {
      // as is
      state = inState;
    } else if (typeof inState === 'string') {
      // attempt to fix an unexpected number format
      state = parseFloat(inState.replace(/,/g, '.'));
    } else {
      // as is presented as a number
      state = Number(inState);
    }
    const factor = index === undefined
      ? this.axisFactors.primary
      : index === -1
        ? this.axisFactors.secondary
        : this.entityFactors[index];
    // safely process with a factor
    state = Number.isNaN(Number(state)) ? state : state * factor;

    let dec;
    // attempting to get "decimals" settings
    if (index === undefined) {
      // for a primary Y-axis
      dec = this.config.decimals_primary_labels !== undefined
        ? this.config.decimals_primary_labels
        : this.config.decimals;
    } else if (index === -1) {
      // for a secondary Y-axis
      dec = this.config.decimals_secondary_labels !== undefined
        ? this.config.decimals_secondary_labels
        : this.config.decimals;
    } else {
      // for a state or attribute value
      dec = this.config.entities[index].decimals !== undefined
        ? this.config.entities[index].decimals
        : this.config.decimals;
    }

    // A duration is written out as [h:]mm:ss rather than as a number, so it
    // never reaches formatNumber() and the entity's own display precision does
    // not apply either - "decimals" sizes the seconds group instead.
    if (this.computeFormat(index) === VALUE_FORMAT_DURATION
      && !Number.isNaN(Number(state))) {
      return formatDuration(
        state * this.computeDurationScale(index, inState),
        dec,
        this._hass.locale,
      );
    }

    let value;

    if (dec === undefined || Number.isNaN(Number(dec)) || Number.isNaN(Number(state))) {
      // no valid "decimals" settings defined, use a default accuracy
      if (index >= 0 && !this.isStaticValue(index)) {
        // formatting a state or attribute of an entity
        const entityId = this.config.entities[index].entity;
        const { attribute } = this.config.entities[index];
        const stateObj = this._hass.states[entityId];

        // additional check before calling API
        if (!stateObj) {
          return formatNumber(
            state,
            this._hass.locale,
          );
        }

        if (attribute && !this.isObjectAttr(attribute)) {
          // formatting not-object attribute
          const attrParts = this._hass.formatEntityAttributeValueToParts(
            stateObj,
            attribute,
            state,
          );
          const partValue = attrParts.find(part => part.type === 'value');
          value = partValue && partValue.value;
          return value;
        } else if (attribute && this.isObjectAttr(attribute)) {
          // formatting object attribute - similar to Y-axis labels
          return formatNumber(
            state,
            this._hass.locale,
          );
        } else {
          // formatting state
          const stateParts = this._hass.formatEntityStateToParts(
            stateObj,
            state,
          );
          const partValue = stateParts.find(part => part.type === 'value');
          value = partValue && partValue.value;
          return value;
        }
      } else {
        // formatting Y-axis (primary, secondary) labels or a static_value
        // use a default hard-coded accuracy
        return formatNumber(
          state,
          this._hass.locale,
        );
      }
    }

    // use an acuracy defined by "dec" variable
    return formatNumber(
      state,
      this._hass.locale,
      { minimumFractionDigits: dec, maximumFractionDigits: dec },
    );
  }

  /**
  * Returns settings defining an order of a state/attribute value presentation;
  * fallback to default settings in case of a static_value
  * @returns {Object}
  * directOrder - true: "value literal unit", false: "unit literal value";
  *
  * delimiter - an optional literal separator between value & unit
  * @param index Index of an entry in config.entities
  * @param {number|string} inState Value of a state/attribute,
  * only used to process a preserved unit for a currently unavailable entity
  */
  computeStateOrder(index, inState = undefined) {
    const entityId = this.config.entities[index].entity;
    const { attribute } = this.config.entities[index];
    if (!entityId && this.isStaticValue(index)) {
      // processing static_value
      return { directOrder: true, delimiter: '' };
    } else if (!attribute || !this.isObjectAttr(attribute)) {
      // processing entity, any cases except an object attribute
      const stateObj = this._hass.states[entityId];
      if (!stateObj || isUnavailableState(stateObj.state)) {
        // processing unavailable state
        if (inState !== undefined && !isUnavailableState(inState)) {
          // we need to get an order for a historical non-unavailable entity
          if (this.preserved_order[index] !== undefined) {
            // use a preserved order
            return this.preserved_order[index];
          } else {
            // presuming an order from config & attributes
            const unit = this.config.entities[index].unit
              || this.config.unit
              || stateObj && stateObj.attributes.unit_of_measurement;
            const delimiter = unit
              ? unit === '%' && blankBeforePercent(this._hass.locale) === ''
                ? '' : NBSP
              : '';
            return {
              directOrder: true,
              delimiter,
            };
          }
        } else {
          return { directOrder: true, delimiter: '' };
        }
      } else {
        // processing normal state
        let parts;
        if (attribute) {
          parts = this._hass.formatEntityAttributeValueToParts(
            stateObj,
            attribute,
          );
        } else {
          parts = this._hass.formatEntityStateToParts(stateObj);
        }
        const indexUnit = parts.findIndex(part => part.type === 'unit');
        const indexValue = parts.findIndex(part => part.type === 'value');
        const directOrder = indexUnit === -1 || indexUnit > indexValue;
        const delimiterPart = parts.find(part => part.type === 'literal');
        const delimiter = delimiterPart && delimiterPart.value || '';
        // preserve a computed order
        if (this.preserved_order[index] === undefined) {
          this.preserved_order[index] = { directOrder, delimiter };
        }
        return { directOrder, delimiter };
      }
    } else {
      // processing entity, object attribute
      return { directOrder: true, delimiter: NBSP };
    }
  }

  /**
  * Returns a string state/attribute value or static_value presentation
  * @returns {string} State/attribute value or static_value presentation
  * @param {number|string} inState Value of a state/attribute/static_value
  * @param {number} index Index of an entry in config.entities
  * @param {boolean} [hideUnit] Do not show a unit for a value
  */
  computeStateWithUom(inState, index, hideUnit) {
    // get a state/attribute value or a static_value
    const state = this.computeState(inState, index);

    // get a unit - a duration already carries its units in the ":" groups
    const unit = hideUnit || this.computeFormat(index) === VALUE_FORMAT_DURATION
      ? ''
      : this.computeUom(index, inState);

    // get native order & delimiter
    const { directOrder, delimiter: nativeDelimiter } = this.computeStateOrder(index, inState);

    let delimiter;
    if (unit === '') {
      delimiter = '';
    } else if (directOrder
      && !nativeDelimiter
      && (this.config.unit || this.config.entities[index].unit)
      && (unit !== '%'
        || blankBeforePercent(this._hass.locale) === NBSP)) {
      // add a delimiter for a user-defined unit (except for "%" for some locales)
      delimiter = NBSP;
    } else {
      delimiter = nativeDelimiter;
    }

    // compose a string
    const composed = directOrder
      ? `${state}${delimiter}${unit}`
      : `${unit}${delimiter}${state}`;
    return composed;
  }

  updateOnInterval() {
    if (this.stateChanged && !this.updating) {
      this.stateChanged = false;
      this.updateData();
    }
  }

  async updateData({ config } = this) {
    this.updating = true;

    const end = this.getEndDate();
    const start = new Date(end);
    start.setMilliseconds(start.getMilliseconds() - getMilli(config.hours_to_show));

    try {
      const promise = this.entity.map((entity, i) => this.updateEntity(entity, i, start, end));
      await Promise.all(promise);
    } catch (err) {
      log(err);
    }


    if (config.show.graph) {
      this.entity.forEach((entity, i) => {
        if (entity
          || (!entity && this.isStaticValue(i))
        ) {
          this.Graph[i].update();
        }
      });
    }

    this.updateBounds();

    this.updateGraphPaths();
    this.updating = false;
    this.setNextUpdate();
  }

  /**
   * Recompute lines/bars/fills/points from already binned data.
   * Called after new data & after a card is resized.
   */
  updateGraphPaths({ config } = this) {
    if (config.show.graph) {
      // index of a bar (only used for bars & only increments if a particular graph to be shown)
      let graphPos = 0;
      this.entity.forEach((entity, i) => {
        if ((!entity && !this.isStaticValue(i))
          || this.Graph[i].coords.length === 0)
          return;
        const bound = config.entities[i].y_axis === 'secondary' ? this.boundSecondary : this.bound;
        [this.Graph[i].min, this.Graph[i].max] = [bound[0], bound[1]];
        if (config.show.graph === 'bar') {
          this.bar[i] = this.Graph[i].getBars(graphPos);
          graphPos += 1;
        } else {
          const line = this.Graph[i].getPath();
          if (config.entities[i].show_line !== false) this.line[i] = line;
          if (config.show.fill
            && config.entities[i].show_fill !== false) this.fill[i] = this.Graph[i].getFill(line);
          // Always computed: "hover_mode: nearest" needs the coordinates even
          // when the points themselves are not drawn (see renderSvgPoints).
          this.points[i] = this.Graph[i].getPoints();
          if ((config.color_thresholds.length > 0
            || (config.entities[i].color_thresholds
                && config.entities[i].color_thresholds.length > 0))
            && !config.entities[i].color)
            this.gradient[i] = this.Graph[i]
              .computeGradient(config.entities[i].color_thresholds || config.color_thresholds);
        }
      });
      this.line = [...this.line]; // force the card's re-rendering
    }
  }

  getBoundary(type, series, configVal, fallback) {
    if (!(type in Math)) {
      throw new Error(`The type "${type}" is not present on the Math object`);
    }

    if (configVal === undefined) {
      // dynamic boundary depending on values
      // Math.min() of nothing is Infinity, which is truthy & would sail past
      // the fallback below - so no series at all has to be handled first.
      if (series.length === 0) return fallback;
      return Math[type](...series.map(ele => ele[type])) || fallback;
    }
    if (configVal[0] !== '~') {
      // fixed boundary
      return configVal;
    }
    // soft boundary (respecting out of range values)
    return Math[type](Number(configVal.substr(1)), ...series.map(ele => ele[type]));
  }

  getBoundaries(series, min, max, fallback, minRange) {
    let boundary = [
      this.getBoundary('min', series, min, fallback[0]),
      this.getBoundary('max', series, max, fallback[1]),
    ];

    if (minRange) {
      const currentRange = Math.abs(boundary[0] - boundary[1]);
      const diff = parseFloat(minRange) - currentRange;

      // Doesn't matter if minBoundRange is NaN because this will be false if so
      if (diff > 0) {
        const weights = [
          min !== undefined && min[0] !== '~' || max === undefined ? 0 : 1,
          max !== undefined && max[0] !== '~' || min === undefined ? 0 : 1,
        ];
        const sum = weights[0] + weights[1];
        if (sum > 0) {
          boundary = [
            boundary[0] - diff * weights[0] / sum,
            boundary[1] + diff * weights[1] / sum,
          ];
        } else {
          boundary = [
            boundary[0] - diff / 2,
            boundary[1] + diff / 2,
          ];
        }
      }
    }

    return boundary;
  }

  updateBounds({ config } = this) {
    this.bound = this.getBoundaries(
      this.primaryYaxisSeries,
      config.lower_bound,
      config.upper_bound,
      this.bound,
      config.min_bound_range,
    );

    this.boundSecondary = this.getBoundaries(
      this.secondaryYaxisSeries,
      config.lower_bound_secondary,
      config.upper_bound_secondary,
      this.boundSecondary,
      config.min_bound_range_secondary,
    );
  }

  async getCache(key) {
    return unpackEntry(await localForage.getItem(`${key}_${this._md5Config}`));
  }

  async setCache(key, entry) {
    return localForage.setItem(`${key}_${this._md5Config}`, packEntry(entry));
  }

  async updateEntity(entity, index, initStart, end) {
    if ((!entity && !this.isStaticValue(index))
      || (!entity && this.isStaticValue(index) && !this.updateQueue.includes(`static_value-${index}`))
      || (entity && !this.updateQueue.includes(`${entity.entity_id}-${index}`))
      || this.config.entities[index].show_graph === false
    ) return;

    if (this.isStaticValue(index)) {
      // process a fake static_value history
      const staticValue = this.config.entities[index].static_value;
      this.Graph[index].history = [{ state: staticValue }, { state: staticValue }];
      this.updateQueue = this.updateQueue.filter(entry => entry !== `static_value-${index}`);
      return;
    }

    this.updateQueue = this.updateQueue.filter(entry => entry !== `${entity.entity_id}-${index}`);

    // The whole window is refetched, not appended to a cached tail:
    // a bucket is revised until its period completes.
    const { statistics } = this.config.entities[index];
    if (statistics) {
      const period = statistics.period || this.statisticsPeriod();
      const stats = await this.fetchStatistics(entity.entity_id, initStart, end, period);
      if (stats.length === 0) {
        this.applyHistory(entity, index, [],
          `No ${period} statistics for ${entity.entity_id} in a shown period`);
        return;
      }
      // A type is resolved here & not in buildConfig(): only a response tells
      // whether an entity has "mean" or "sum" statistics.
      const type = getStatisticsType(stats, statistics.type);
      if (type === undefined) {
        this.applyHistory(entity, index, [], `No statistics types for ${entity.entity_id}`);
        return;
      }
      if (statistics.type !== undefined && statistics.type !== type) {
        this.logOnce(`Statistics type ${statistics.type} is not available for ${entity.entity_id}; using ${type}`);
      }
      const statHistory = stats
        .map(item => ({
          last_changed: new Date(item.start).toISOString(),
          state: item[type],
        }))
        .filter(item => !Number.isNaN(parseFloat(item.state)));
      this.applyHistory(entity, index, statHistory);
      return;
    }

    let stateHistory = [];
    let start = initStart;
    let skipInitialState = false;

    const history = this.config.cache
      ? await this.getCache(`${entity.entity_id}_${index}`)
      : undefined;
    // A cached window is appended to, never re-read, so anything wrong in it
    // stays wrong. isUsable() puts an age on that & rejects the two states a
    // record cannot honestly be in; when it says no the whole window is
    // fetched again, which is what a cold start would have done anyway.
    const usable = isUsable(history, this.config.hours_to_show, entity && entity.last_updated);
    // Keep the age of the entry, not of its last append - otherwise saving
    // resets the clock on every load & the window is never refetched.
    let firstFetched = new Date();
    if (usable) {
      firstFetched = new Date(history.first_fetched || history.last_fetched);
      stateHistory = history.data;

      let currDataIndex = stateHistory.findIndex(item => new Date(item.last_changed) > initStart);
      if (currDataIndex !== -1) {
        if (currDataIndex > 0) {
          // include previous item
          currDataIndex -= 1;
          // but change it's last changed time
          stateHistory[currDataIndex].last_changed = initStart;
        }

        stateHistory = stateHistory.slice(currDataIndex, stateHistory.length);
        // skip initial state when fetching recent/not-cached data
        skipInitialState = true;
      } else {
        // there were no states which could be used in current graph so clearing
        stateHistory = [];
      }

      const lastFetched = new Date(history.last_fetched);
      if (lastFetched > start) {
        start = new Date(lastFetched - 1);
      }
    }

    let newStateHistory = await this.fetchRecent(
      entity.entity_id,
      start,
      end,
      this.config.entities[index].attribute ? false : skipInitialState,
      !!this.config.entities[index].attribute,
    );
    if (newStateHistory[0] && newStateHistory[0].length > 0) {
      /**
      * hack because HA doesn't return anything if skipInitialState is false
      * when retrieving for attributes so we retrieve it and we remove it.*
      */
      if (this.config.entities[index].attribute && skipInitialState) {
        newStateHistory[0].shift();
      }
      // check if we should convert states to numeric values
      if (this.config.state_map.length > 0 || this.config.entities[index].attribute) {
        newStateHistory[0].forEach((item) => {
          if (this.config.entities[index].attribute) {
            // eslint-disable-next-line no-param-reassign
            item.state = this.getObjectAttr(item.attributes, this.config.entities[index].attribute);
            // eslint-disable-next-line no-param-reassign
            delete item.attributes;
          }
          if (this.config.state_map.length > 0)
            this._convertState(item);
        });
      }

      newStateHistory = newStateHistory[0].filter(item => !Number.isNaN(parseFloat(item.state)));
      newStateHistory = newStateHistory.map(item => ({
        last_changed: this.config.entities[index].attribute ? item.last_updated : item.last_changed,
        state: item.state,
      }));
      stateHistory = [...stateHistory, ...newStateHistory];

      if (this.config.cache) {
        this
          .setCache(`${entity.entity_id}_${index}`, {
            hours_to_show: this.config.hours_to_show,
            first_fetched: firstFetched,
            last_fetched: new Date(),
            data: stateHistory,
            version,
          })
          .catch((err) => {
            log(err);
            localForage.clear();
          });
      }
    }

    this.applyHistory(entity, index, stateHistory);
  }

  /** Log a message once: updateEntity() is called on every update. */
  logOnce(message) {
    if (this.loggedMessages.has(message)) return;
    this.loggedMessages.add(message);
    log(message);
  }

  /**
   * Pass a [{last_changed, state}] series to the graph;
   * used by both the history & the statistics paths.
   * @param {string} [reason] Why a series is empty, when the caller knows
   * better than "there is nothing in the window" - logged instead of it.
   */
  applyHistory(entity, index, stateHistory, reason) {
    if (stateHistory.length === 0) {
      // A series which draws nothing is otherwise indistinguishable from a
      // misconfigured one, so say so - once, since this runs on every update.
      this.logOnce(reason
        || `No values for ${entity && entity.entity_id} in a shown period; nothing is plotted`);
      // Hand the graph an empty history rather than none at all. A graph which
      // was never given one is what the loading indicator keys on, so an entity
      // with nothing in the window used to spin for ever (upstream #1326).
      this.Graph[index].history = [];
      return;
    }

    if (this.entity[0] && entity.entity_id === this.entity[0].entity_id) {
      this.updateExtrema(stateHistory);
    }

    if (this.config.entities[index].fixed_value === true) {
      const last = stateHistory[stateHistory.length - 1];
      this.Graph[index].history = [last, last];
    } else {
      this.Graph[index].history = stateHistory;
    }
  }

  /** Pick a period wide enough for hours_to_show. */
  statisticsPeriod() {
    const match = STATISTICS_PERIOD_THRESHOLDS
      .find(({ hours }) => this.config.hours_to_show <= hours);
    return match ? match.period : STATISTICS_PERIOD_FALLBACK;
  }

  async fetchStatistics(entityId, start, end, period) {
    const result = await this._hass.callWS({
      type: 'recorder/statistics_during_period',
      start_time: start ? start.toISOString() : undefined,
      end_time: end ? end.toISOString() : undefined,
      statistic_ids: [entityId],
      period,
    });
    return (result && result[entityId]) || [];
  }

  async fetchRecent(entityId, start, end, skipInitialState, withAttributes) {
    let url = 'history/period';
    if (start) url += `/${start.toISOString()}`;
    url += `?filter_entity_id=${entityId}`;
    if (end) url += `&end_time=${end.toISOString()}`;
    if (skipInitialState) url += '&skip_initial_state';
    if (!withAttributes) url += '&minimal_response&no_attributes';
    if (withAttributes) url += '&significant_changes_only=0';
    return this._hass.callApi('GET', url);
  }

  updateExtrema(history) {
    const { extrema, average } = this.config.show;
    this.abs = [
      ...(extrema ? [{
        type: 'min',
        ...getMin(history, 'state'),
      }] : []),
      ...(average ? [{
        type: 'avg',
        state: getAvg(history, 'state'),
      }] : []),
      ...(extrema ? [{
        type: 'max',
        ...getMax(history, 'state'),
      }] : []),
    ];
  }

  _convertState(res) {
    const resultIndex = this.config.state_map.findIndex(s => s.value === res.state);
    if (resultIndex === -1) {
      return;
    }

    res.state = resultIndex;
  }

  getEndDate() {
    const date = new Date();
    switch (this.config.group_by) {
      case 'date':
        date.setDate(date.getDate() + 1);
        date.setHours(0, 0, 0);
        break;
      case 'hour':
        date.setHours(date.getHours() + 1);
        date.setMinutes(0, 0);
        break;
      default:
        break;
    }
    return date;
  }

  setNextUpdate() {
    if (!this.config.update_interval) {
      const interval = 1 / this.config.points_per_hour;
      clearInterval(this.interval);
      this.interval = setInterval(() => {
        if (!this.updating) this.updateData();
      }, interval * ONE_HOUR);
    }
  }

  /** A height a graph is drawn in: a measured one, or one from a config. */
  get graphHeight() {
    return this._graphHeight !== undefined ? this._graphHeight : getGraphHeightPx(this.config);
  }

  /** A width a graph is drawn in: a measured one, or a default. */
  get graphWidth() {
    return this._graphWidth !== undefined ? this._graphWidth : DEFAULT_GRAPH_WIDTH;
  }

  getCardSize() {
    if (!this.config) return 3;
    return getCardSizeUnits(getDesiredCardHeight(this.config));
  }

  getGridOptions() {
    if (!this.config) return {};
    return getGridOptions(this.config);
  }
}

customElements.define('mini-graph-card', MiniGraphCard);

const NUMERIC_DOMAINS = ['counter', 'input_number', 'number'];

const isNumericEntity = (hass, entityId) => {
  const domain = entityId.split('.')[0];
  if (NUMERIC_DOMAINS.includes(domain)) return true;
  if (domain !== 'sensor') return false;

  const stateObj = hass.states[entityId];
  if (!stateObj) return false;
  return !!stateObj.attributes.unit_of_measurement || !!stateObj.attributes.state_class;
};

// Configure the preview in the Lovelace card picker
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'mini-graph-card',
  name: 'Mini Graph Card',
  preview: false,
  description: 'The Mini Graph card is a minimalistic and customizable graph card',
  getEntitySuggestion: (hass, entityId) => {
    if (!isNumericEntity(hass, entityId)) return null;

    return {
      config: {
        type: 'custom:mini-graph-card',
        entities: [{ entity: entityId }],
      },
    };
  },
});
