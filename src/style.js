import { css } from 'lit-element';

const style = css`
  :host {
    display: flex;
    flex-direction: column;
    /* Fill the cell a Sections grid gives us. Without it the host sizes to its
       own content, so every card comes out the same height whatever "rows" it
       was given - and a card taller than its cell overlaps its neighbours.
       Resolves to "auto" in a Masonry view, where the parent has no height. */
    height: 100%;
  }
  ha-card {
    flex-direction: column;
    box-sizing: border-box;
    /* Not "height: 100%": a card is stretched by a Sections grid, and
       stretching accounts for a margin while a percentage height does not -
       a card with a margin would overflow its cell by exactly that margin.
       No "min-height: 0" either: a card must not shrink below its content &
       clip it with "overflow: hidden" - a graph is what absorbs a shrinking. */
    flex: 1;
    padding: 16px 0 0 0;
    position: relative;
    overflow: hidden;
    /* A long press is a hold_action. Left to itself a browser answers one with
       its own gesture - text selection, or the iOS callout - and cancels the
       pointer, which cancels the hold with it. "manipulation" keeps panning &
       scrolling, it only drops the double-tap zoom. */
    touch-action: manipulation;
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    user-select: none;
  }
  ha-card > div {
    padding: 0px 16px 16px 16px;
  }
  /* "density: compact" - only the padding changes; every part of the card has
     a font size option of its own. */
  ha-card[compact] {
    padding-top: 8px;
  }
  ha-card[compact] > div {
    padding-bottom: 8px;
  }
  ha-card[compact] .graph__legend {
    padding-bottom: 4px;
  }
  ha-card > div:last-child {
    padding-bottom: 0;
  }
  ha-card .graph {
    padding: 0;
    order: 10;
  }
  ha-card[points] .line--points,
  ha-card[labels] .graph__labels.--primary,
  ha-card[labels-secondary] .graph__labels.--secondary {
    opacity: 0;
    transition: opacity .25s;
    animation: none;
  }
  ha-card[points]:hover .line--points,
  ha-card:hover .graph__labels.--primary,
  ha-card:hover .graph__labels.--secondary {
      opacity: 1;
  }
  /* "show.points: hover" reveals the points while the CARD is hovered, header
     included. With "hover_mode: nearest" a hovered graph shows the one selected
     point, so revealing all of them from elsewhere on the card is just noise:
     reveal the selected entity's group only. */
  ha-card[points][nearest]:hover .line--points:not([tooltip]) {
    opacity: 0;
  }
  ha-card[fill] path {
    stroke-linecap: initial;
    stroke-linejoin: initial;
  }
  .graph__legend {
    order: -1;
    padding: 0 16px 8px 16px;
  }
  .graph__legend[loc="below"] {
    order: 9;
    padding: 4px 16px;
  }
  ha-card[group] {
    box-shadow: none;
    border: none;
    padding: 0;
  }
  ha-card[group] > div {
    padding-left: 0;
    padding-right: 0;
  }
  ha-card[group] .graph__legend {
    padding-left: 0;
    padding-right: 0;
  }
  ha-card[hover] {
    cursor: pointer;
  }
  ha-spinner {
    margin: 4px auto;
  }
  .flex {
    display: flex;
    display: -webkit-flex;
    min-width: 0;
  }
  /* Three columns - icon, name, icon - so nothing has to shrink-wrap or be
     flung apart by "space-between". Which column each part lands in is decided
     in renderHeader(). From upstream #1413. */
  .header {
    display: grid;
    grid-template-columns: minmax(0, auto) minmax(0, 1fr) minmax(0, auto);
    grid-template-rows: 1fr;
    align-items: center;
    width: 100%;
    box-sizing: border-box;
  }
  .header > * {
    grid-row: 1;
  }
  .name {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    min-width: 0;
    width: 100%;
    letter-spacing: var(--mcg-title-letter-spacing, normal);
    overflow: hidden;
  }
  .name[loc="left"] {
    grid-column: 1 / 3;
    justify-self: start;
    text-align: left;
  }
  .name[loc="center"] {
    grid-column: 1 / 4;
    justify-self: center;
    text-align: center;
  }
  .name[loc="right"] {
    grid-column: 2 / 4;
    justify-self: end;
    text-align: right;
  }
  .name > span {
    font-size: 1.2em;
    font-weight: var(--mcg-title-font-weight, 500);
    max-height: 1.4em;
    min-height: 1.4em;
    opacity: .65;
  }
  .icon {
    color: var(--state-icon-color, #44739e);
  }
  .icon > ha-icon {
    height: 1.7em;
    width: 1.7em;
  }
  .icon[loc="left"] {
    grid-column: 1;
    justify-self: start;
  }
  .icon[loc="right"] {
    grid-column: 3;
    justify-self: end;
  }
  .icon[loc="state"] {
    align-self: center;
  }
  .states {
    align-items: flex-start;
    font-weight: 300;
    justify-content: space-between;
    flex-wrap: nowrap;
  }
  .states .icon {
    align-self: center;
    margin-left: 0;
  }
  /* The gap used to come from the "states--secondary" container, which was
     rendered even when empty; keep it where the icon follows a state. */
  .states > .state + .icon {
    margin-left: 1.4em;
  }
  .states[loc="center"] {
    justify-content: space-evenly;
  }
  /* A corner state is taken out of a flow & pinned to a card, so it takes no
     row of its own - a graph gets that space instead. The box spans the card
     and keeps the same 16px side padding as every other row, so a value lines
     up with the extrema & the header rather than with a hand-picked offset. */
  .states[loc^="top-"],
  .states[loc^="bottom-"] {
    position: absolute;
    left: 0;
    right: 0;
    margin: 0;
    padding: 0 16px;
    z-index: 1;
    /* the box spans a card, so it must not swallow hover over a graph */
    pointer-events: none;
  }
  .states[loc^="top-"] > *,
  .states[loc^="bottom-"] > * {
    pointer-events: auto;
  }
  .states[loc^="top-"] .state__uom,
  .states[loc^="bottom-"] .state__uom {
    /* A unit fills a row by default; in a corner it must not grow either. */
    flex: none;
  }
  .states[loc^="top-"] { top: 16px; }
  .states[loc^="bottom-"] { bottom: var(--mcg-state-bottom, 16px); }
  .states[loc$="-left"] { justify-content: flex-start; }
  .states[loc$="-right"] { justify-content: flex-end; }
  /* Mirror a right corner: an icon leads, and the gap goes on its other side */
  .states[loc$="-left"] > .icon {
    order: -1;
    margin-left: 0;
    margin-right: 1.4em;
  }
  .states[loc$="-left"] > .state + .icon {
    margin-left: 0;
  }
  .states[loc$="-right"] .states--secondary {
    align-items: flex-end;
  }
  .states[loc="right"] > .state {
    margin-left: auto;
    order: 2;
  }
  .states[loc="center"] .states--secondary,
  .states[loc="right"] .states--secondary {
    margin-left: 0;
  }
  .states[loc="center"] .states--secondary {
    align-items: center;
  }
  .states[loc="right"] .states--secondary {
    align-items: flex-start;
  }
  .states[loc="center"] .state__time {
    left: 50%;
    transform: translateX(-50%);
  }
  .states > .icon > ha-icon {
    height: 2em !important;
    width: 2em !important;
  }
  .states--secondary {
    /* An absolute size set for the primary state must not be inherited here:
       secondary states are scaled down relative to their own wrapper, and
       "initial" makes the custom property invalid so the var() fallback wins.
       font_size_secondary sets its own pair, which take over when given. */
    --mcg-state-value-size: var(--mcg-secondary-value-size, initial);
    --mcg-state-uom-size: var(--mcg-secondary-uom-size, initial);
    display: flex;
    flex-flow: column;
    flex-wrap: wrap;
    align-items: flex-end;
    margin-left: 1rem;
    min-width: 0;
    margin-left: 1.4em;
  }
  .state {
    position: relative;
    display: flex;
    flex-wrap: nowrap;
    max-width: 100%;
    min-width: 0;
    gap: .25rem;
  }
  .state > svg,
  .states--secondary > div:only-child svg {
    align-self: center;
    border-radius: 100%;
  }
  .state--small {
    font-size: .6em;
    margin-bottom: .6rem;
    flex-wrap: nowrap;
  }
  .states--secondary > :not(div:only-child) svg {
    position: absolute;
    left: -1.6em;
    align-self: center;
    height: 1em;
    width: 1em;
    border-radius: 100%;
    margin-right: 1em;
  }
  .state--small:last-child {
    margin-bottom: 0;
  }
  .states--secondary > div:only-child {
    font-size: 1em;
    margin-bottom: 0;
  }
  .state__value {
    display: inline-block;
    font-size: var(--mcg-state-value-size, 2.4em);
    line-height: 1.2em;
  }
  .state[reversed="true"] .state__value {
    order: 9;
  }
  .state__uom {
    flex: 1;
    align-self: flex-end;
    display: inline-block;
    font-size: var(--mcg-state-uom-size, 1.4em);
    font-weight: 400;
    line-height: 1.6em;
    margin-top: .1em;
    opacity: .6;
    vertical-align: bottom;
  }
  .state--small .state__uom {
    flex: 1;
  }
  .state__time {
    /* "em", not "rem": every other size on the card follows font_size, and
       this one silently did not. */
    font-size: .95em;
    font-weight: 500;
    bottom: -1.1rem;
    left: 0;
    opacity: .75;
    position: absolute;
    white-space: nowrap;
    animation: fade .15s cubic-bezier(0.215, 0.61, 0.355, 1);
  }
  /* The time range is positioned against the state, which in a right-hand
     corner sits at the card's right edge - anchored left, a wide range (a
     14-day graph names a date at both ends) runs straight off the card. */
  .states[loc="right"] .state__time,
  .states[loc$="-right"] .state__time {
    left: initial;
    right: 0;
  }
  /* Likewise below a bottom corner there is no card left to draw on. */
  .states[loc^="bottom-"] .state__time {
    bottom: initial;
    top: -1.1rem;
  }
  .graph {
    align-self: flex-end;
    box-sizing: border-box;
    display: flex;
    /* "graph_height: auto": a graph is a row like any other & takes whatever
       the chrome leaves, in a Masonry card as well as in a Sections cell. */
    flex-grow: 1;
    flex-shrink: 1;
    flex-direction: column;
    min-height: 0;
    width: 100%;
  }
  /* Any other "graph_height" takes the graph out of the flow & anchors it to
     the bottom of the card, so the taller it is the more of the card's own
     chrome it slides behind. Its height (or its top, for "below_header") is
     set inline. "ha-card" is the containing block - it is position: relative. */
  .graph[anchored] {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 0;
  }
  /* ...and the chrome stays on top of it. A corner state already lifts itself. */
  ha-card > .header,
  ha-card > .states,
  ha-card > .info {
    position: relative;
    z-index: 1;
  }
  .graph__container {
    flex: 1 1 auto;
    min-height: 0;
    display: grid;
    grid-template-columns: 1fr;
    grid-template-rows: 1fr;
    align-items: stretch;
  }
  .graph__container__svg {
    cursor: default;
    position: relative;
    display: block;
    width: 100%;
    height: 100%;
    /* An svg with a viewBox has an intrinsic aspect ratio, so a default
       "min-height: auto" floors this box at width/aspect & it refuses to
       shrink into its grid area - a graph then overflows a card & is cut off
       by "overflow: hidden". */
    min-height: 0;
    grid-column: 1;
    grid-row: 1;
  }
  svg {
    overflow: hidden;
    display: block;
  }
  path {
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .fill[anim="false"] {
    animation: reveal .25s cubic-bezier(0.215, 0.61, 0.355, 1) forwards;
  }
  .fill[anim="false"][type="fade"] {
    animation: reveal-2 .25s cubic-bezier(0.215, 0.61, 0.355, 1) forwards;
  }
  .line--points[anim="false"],
  .line[anim="false"] {
    animation: pop .25s cubic-bezier(0.215, 0.61, 0.355, 1) forwards;
  }
  /* A series which is not the selected one. Its line & bars stay faintly
     visible so a curve can still be followed across the graph: with several
     entities the selection changes wherever curves cross, and blanking the
     others outright makes the graph jump about. Its fill & points do go, they
     only add noise. Set --mcg-inactive-opacity to 0 to hide them as well. */
  .line--rect[inactive],
  .bars[inactive] {
    opacity: var(--mcg-inactive-opacity, 0.2) !important;
    animation: none !important;
    transition: all .15s !important;
  }
  .line--points[inactive],
  .fill--rect[inactive] {
    opacity: 0 !important;
    animation: none !important;
    transition: all .15s !important;
  }
  .line--points[tooltip] .line--point[inactive],
  .graph__static_value_labels > span[inactive] {
    opacity: 0;
  }
  /* Grid lines sit behind the data & must not take the pointer from it. */
  .grid {
    pointer-events: none;
  }
  .grid--line {
    stroke: var(--mcg-grid-color, var(--divider-color));
    stroke-width: 1;
    shape-rendering: crispEdges;
  }
  .grid--line[minor] {
    opacity: .4;
  }
  /* With minor lines between them the full ones need to carry more weight,
     or the grid reads as one undifferentiated mesh. */
  .grid--line[strong] {
    stroke: var(--mcg-grid-major-color, var(--secondary-text-color));
    opacity: .55;
  }
  .line--point {
    cursor: pointer;
    fill: var(--primary-background-color, white);
    stroke-width: inherit;
  }
  .line--point:hover {
    fill: var(--mcg-hover, inherit) !important;
  }
  /* "hover_mode: nearest": an overlay catching pointer moves anywhere in the
     graph. A transparent fill is still a painted one, so it does receive
     events - "fill: none" would not. */
  .hover-area {
    fill: transparent;
    pointer-events: all;
  }
  /* Marks the point or bar being read; not line-specific despite living
     among the point styles. */
  .hover--marker {
    pointer-events: none;
    transition: none;
  }
  .bars {
    animation: pop .25s cubic-bezier(0.215, 0.61, 0.355, 1);
  }
  .bars[anim] {
    animation: bars .5s cubic-bezier(0.215, 0.61, 0.355, 1);
  }
  .bar {
    transition: opacity .25s cubic-bezier(0.215, 0.61, 0.355, 1);
  }
  .bar:hover {
    opacity: .5;
    cursor: pointer;
  }
  path,
  .line--points,
  .fill {
    opacity: 0;
  }
  .line--points[anim="true"][init] {
    animation: pop .5s cubic-bezier(0.215, 0.61, 0.355, 1) forwards;
  }
  .fill[anim="true"][init] {
    animation: reveal .5s cubic-bezier(0.215, 0.61, 0.355, 1) forwards;
  }
  .fill[anim="true"][init][type="fade"] {
    animation: reveal-2 .5s cubic-bezier(0.215, 0.61, 0.355, 1) forwards;
  }
  .line[anim="true"][init] {
    animation: dash 1s cubic-bezier(0.215, 0.61, 0.355, 1) forwards;
  }
  .graph__labels {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: flex-start;
    font-size: var(--mcg-label-size, calc(.15em + 8.5px));
    padding: .6em;
    pointer-events: none;
    opacity: var(--mcg-label-axis-opacity, .75);
    grid-column: 1;
    grid-row: 1;
    position: relative;
  }
  .graph__labels.--secondary {
    align-items: flex-end;
    grid-column: 1;
    grid-row: 1;
  }
  /* Grid labels sit AT their line rather than at the ends of the box, so they
     are placed individually instead of by the column's space-between. */
  .graph__labels.--grid {
    display: block;
    padding: 0;
  }
  .graph__labels.--grid > span {
    position: absolute;
    white-space: nowrap;
  }
  /* "labels: always" outranks show.labels' hover gating - more specific than
     the "ha-card[labels] .graph__labels.--primary" rule which hides them. */
  ha-card[labels] .graph__labels.--primary.--grid[always],
  ha-card[labels-secondary] .graph__labels.--secondary.--grid[always] {
    opacity: var(--mcg-label-axis-opacity, .75);
    transition: none;
  }
  .graph__labels.--grid.--primary > span {
    left: .6em;
    transform: translateY(-50%);
  }
  .graph__labels.--grid.--secondary > span {
    right: .6em;
    transform: translateY(-50%);
  }
  .graph__labels.--grid-x {
    grid-column: 1;
    grid-row: 1;
    position: relative;
    font-size: var(--mcg-label-size, calc(.15em + 8.5px));
    opacity: var(--mcg-label-axis-opacity, .75);
    pointer-events: none;
  }
  /* "labels: hover" follows show.labels' own idea of hover: nothing at rest,
     revealed with the card. */
  .graph__labels.--grid-x[hover] {
    opacity: 0;
    transition: opacity .25s;
  }
  ha-card:hover .graph__labels.--grid-x[hover] {
    opacity: var(--mcg-label-axis-opacity, .75);
  }
  .graph__labels.--grid-x > span {
    bottom: .2em;
    /* against the line, not centred on it: a centred label on the first line
       would hang off the left edge of the card */
    margin-left: .3em;
  }
  .graph__labels > span {
    cursor: pointer;
    border-radius: var(--mcg-label-axis-border-radius, 1em);
  }
  .graph__static_value_labels {
    font-size: var(--mcg-label-size, calc(.15em + 8.5px));
    position: absolute;
    pointer-events: none;
    top: 0; bottom: 0;
    left: 0; right: 0;
  }
  .graph__labels > span,
  .graph__static_value_labels > span {
    background: var(--primary-background-color, white);
    padding: .2em .6em;
    box-shadow: 0 1px 3px rgba(0,0,0,.12), 0 1px 2px rgba(0,0,0,.24);
    white-space: nowrap;
    font-weight: 400;
    user-select: none;
  }
  .graph__static_value_labels > span {
    border-radius: var(--mcg-label-static-border-radius, 1em);
    opacity: var(--mcg-label-static-opacity, .75);
    position: absolute;
    transform: translate(-50%, -50%);
  }
  .graph__legend {
    font-size: var(--mcg-legend-size, 1em);
    display: flex;
    flex-direction: row;
    justify-content: space-evenly;
    flex-wrap: wrap;
  }
  .graph__legend__item {
    cursor: pointer;
    display: flex;
    min-width: 0;
    margin: .4em;
    align-items: center
  }
  .graph__legend__item span {
    opacity: .75;
    margin-left: .4em;
  }
  .graph__legend__item svg {
    border-radius: 100%;
    min-width: 10px;
  }
  .info {
    font-size: var(--mcg-extrema-size, 1em);
    justify-content: space-between;
    align-items: middle;
  }
  .info[loc="below"] {
    order: 99;
    padding-top: 4px;
    padding-bottom: 4px;
  }
  .info__item {
    display: flex;
    flex-flow: column;
    text-align: center;
  }
  .info__item:last-child {
    align-items: flex-end;
    text-align: right;
  }
  .info__item:first-child {
    align-items: flex-start;
    text-align: left;
  }
  .info__item__type {
    text-transform: capitalize;
    font-weight: 500;
    opacity: .9;
  }
  .info__item__time,
  .info__item__value {
    opacity: .75;
  }
  .ellipsis {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  @keyframes fade {
    0% { opacity: 0; }
  }
  @keyframes reveal {
    0% { opacity: 0; }
    100% { opacity: .15; }
  }
  @keyframes reveal-2 {
    0% { opacity: 0; }
    100% { opacity: .4; }
  }
  @keyframes pop {
    0% { opacity: 0; }
    100% { opacity: 1; }
  }
  @keyframes bars {
    0% { opacity: 0; }
    50% { opacity: 0; }
    100% { opacity: 1; }
  }
  @keyframes dash {
    0% {
      opacity: 0;
    }
    25% {
      opacity: 1;
    }
    100% {
      opacity: 1;
      stroke-dashoffset: 0;
    }
  }`;

export default style;
