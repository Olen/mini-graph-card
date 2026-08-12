> [!WARNING]
> ## This is an experimental fork
>
> This branch is **not** the official [kalkih/mini-graph-card](https://github.com/kalkih/mini-graph-card).
> It is a fast-moving personal fork used to try out new features and fixes, and
> it is released early and often. Expect breaking changes, expect things to be
> broken for a while, and expect options to change name or behaviour between
> releases. Breaking changes are noted in the release notes.
>
> It tracks the upstream `dev` branch, and the goal is for the work here to end
> up upstream: everything is written to be merged back, and PRs are opened for
> the parts that are ready. If you want something stable, install the official
> card instead.

# Lovelace Mini Graph Card
A minimalistic and customizable graph card for [Home Assistant](https://github.com/home-assistant/home-assistant) Lovelace UI.

The card works with entities from within the **sensor** & **binary_sensor** domain and displays the sensors current state as well as a line graph representation of the history.

![Preview](https://user-images.githubusercontent.com/457678/52977264-edf34980-33cc-11e9-903b-cee43b307ed8.png)

## What this fork changes

Everything below is on top of upstream `dev`, which itself carries a lot that
has not been released - the last stable upstream release is v0.13.0.

### New options

| Option | What it does |
|--------|--------------|
| [`statistics`](#statistics) | Read a series from Home Assistant's statistics instead of raw history. Pre-aggregated server side, so a long graph fetches orders of magnitude fewer points and gets much faster to load. Also adds the `change` type and a `year` period, and picks a type the entity actually has. ([upstream PR #1423](https://github.com/kalkih/mini-graph-card/pull/1423)) |
| [`align_state`](#card-size) corners | `top-left`, `top-right`, `bottom-left`, `bottom-right` pin the current state to a corner, out of the flow, so it takes no row of its own and the graph gets the space. ([upstream #1153](https://github.com/kalkih/mini-graph-card/issues/1153)) |
| `font_size_state` | Size the current state on its own, without scaling extrema and axis labels along with it. ([upstream #752](https://github.com/kalkih/mini-graph-card/issues/752)) |
| [`graph_height`](#card-size) | Size the graph independently of the card. A graph is anchored to the bottom, so a percentage decides how much of the card's own chrome it sits behind - `100%` puts it behind everything, as a backdrop. |
| [`hold_action`](#tapping--holding) | Hold a card for half a second to act on it, the way stock Home Assistant cards behave. |
| [`density`](#density) | A card too short to afford its padding spends less of it, so a 2-row card is a graph rather than a stack of margins. ([upstream #1153](https://github.com/kalkih/mini-graph-card/issues/1153)) |
| `font_size_secondary` / `_legend` / `_extrema` / `_labels` | Size each part of the card on its own, instead of everything but the header and the state scaling off one number. |
| [`grid_x` / `grid_y`](#grid-lines) | Grid lines, with labels. Vertical ones land on real midnights and whole hours, horizontal ones on round values, and both thin out on a small card. ([upstream #837](https://github.com/kalkih/mini-graph-card/issues/837), [#739](https://github.com/kalkih/mini-graph-card/issues/739), and where [#1179](https://github.com/kalkih/mini-graph-card/pull/1179) was heading) |
| [`hover_mode`](#hovering) | Hover anywhere in the graph to read the nearest value, instead of having to hit a point a few pixels wide. Works with several entities & on a touch screen. ([upstream #1357](https://github.com/kalkih/mini-graph-card/issues/1357)) |

### The card sizes itself

The card implements `getGridOptions()`, so Home Assistant lays it out from
`height` and whatever else it shows, and it fills the cell it is given instead
of leaving dead space. A graph is redrawn for the size it really got, so a
`viewBox` matches its element 1:1 and nothing is scaled. `getCardSize()`
counts the same height instead of returning a fixed `3`.

In practice: no more `grid_options` and `card_mod` heights to make cards line
up. See [Card size](#card-size). ([upstream #1111](https://github.com/kalkih/mini-graph-card/issues/1111),
and where [#1155](https://github.com/kalkih/mini-graph-card/pull/1155) /
[#1199](https://github.com/kalkih/mini-graph-card/pull/1199) were heading)

### Fixes

- `aggregate_func: median` sorted the items rather than their states, so every
  comparison was `NaN` and the list was never sorted: it returned the middle
  value **in time order**. Broken since v0.11.0.
- A graph could not shrink into its card and was cut off at the bottom.
- A single-entity card reserved 19.6px on the right for a states container that
  was never filled.
- A card did not fill the cell a Sections view gave it: the host sized to its
  own content, so cards came out the same height whatever `grid_options.rows`
  asked for, and a card taller than its cell overlapped its neighbours.
- The tooltip's time range was sized in `rem` - against the document, not the
  card - so it was the one element which ignored `font_size`.
- `align_icon` had no default in the code, only in the docs, so an unconfigured
  icon rendered as `loc="undefined"`, matched neither CSS rule and sat against
  the name. The documented `right` is now actually applied - and a left-aligned
  header no longer shrinks to fit its content, which had left the icon's
  `margin-left: auto` with no space to push into. An invalid value now warns
  instead of silently landing in the same state.
- An `icon_image` was never given an alignment at all.
- `npm run build` failed on a clean checkout, because it runs the linter and
  the linter did not pass.

### Faster

`Intl.DateTimeFormat` is built once per locale and options instead of on every
call. A card formats a timestamp per tooltip, axis label and extrema entry, on
every render. The test suite - almost entirely datetime formatting - went from
9.0s to 1.7s.

### Breaking changes

- **`height` is the height of the CARD, not of the graph.** It decides which
  cell the card asks for; a card in a cell of another size follows the cell.
  Use the new `graph_height` to size the graph itself. A `height: 250` which
  used to mean "a 250px graph plus the chrome around it" now means "a 250px
  card". See [Card size](#card-size).
- **Clicking a graph now runs `tap_action`.** It used to do nothing at all - the
  graph swallowed clicks so that clicking a point could not open more-info.
- **On a touch screen a tap reads the card rather than acting on it**, anywhere
  on the card, and `hold_action` is how you act. A touch screen has no hover to
  read a graph with. This includes tapping an individual state, which used to
  open more-info for that entity. See
  [Tapping & holding](#tapping--holding).
- **`line_width`, `bar_spacing` and the point radius are in real pixels.** They
  used to be units of a 500-wide drawing stretched to the card, so they grew on
  a wide card and shrank on a narrow one.
- **`getCardSize()` no longer returns a fixed `3`**, so cards take a different
  amount of space in a Masonry view.
- **Hovering a graph selects the nearest value** rather than only a point
  directly under the cursor, see [Hovering](#hovering). Set
  `hover_mode: point` to get the old behaviour back.
- **`show.state: last` now works with `show.points: false`.** It reads the last
  plotted point, and the coordinates only existed when the points were drawn -
  so it used to silently show the current state instead.

### Development

The tests upstream ships are disabled and cannot be run where they are
committed. Here they run with `npm test` (7800+ tests, ~2s) in any timezone,
and CI runs lint, tests and a build on every push.

## Install

> [!IMPORTANT]
> This fork registers the same card name, `custom:mini-graph-card`. **Remove or
> uninstall the official card first** - two copies both define
> `<mini-graph-card>`, and whichever loads second is ignored, so you may be
> testing the one you did not mean to. In HACS: uninstall *mini-graph-card*,
> and delete any leftover `www/community/mini-graph-card/` files, including
> `mini-graph-card-bundle.js.gz` (Home Assistant serves the `.gz` in preference
> to the `.js`, so a stale one keeps being used).

### HACS custom repository (recommended)

1. HACS → three-dot menu → **Custom repositories**.
2. Repository: `https://github.com/Olen/mini-graph-card`, type: **Dashboard**
   (called *Lovelace* in older HACS versions).
3. Install **mini-graph-card** from the list, and reload your browser.

HACS installs the bundle to `/hacsfiles/mini-graph-card/mini-graph-card-bundle.js`
and adds the resource for you.

### Manual install

1. Download `mini-graph-card-bundle.js` from the
   [latest release](https://github.com/Olen/mini-graph-card/releases/latest)
   into your `config/www` directory.
2. Add the resource reference as described below.

### CLI install

1. Move into your `config/www` directory.
2. Grab the bundle:

  ```console
  $ wget $(curl -s https://api.github.com/repos/Olen/mini-graph-card/releases/latest \
      | grep browser_download_url | cut -d '"' -f 4)
  ```

3. Add the resource reference as described below.

### Add resource reference

Not needed for a HACS install - HACS registers the resource itself.

If you configure Lovelace via YAML, add a reference inside your
`configuration.yaml`:

  ```yaml
  resources:
    - url: /local/mini-graph-card-bundle.js?v=2026.8.5
      type: module
  ```

Else, if you prefer the graphical editor, use the menu to add the resource:

1. Make sure advanced mode is enabled in your user profile (click on your user name to get there)
2. Navigate to Settings -> Dashboards -> Resources tab. Hit the orange (+) icon
3. Enter URL `/local/mini-graph-card-bundle.js` and select type "JavaScript Module".
(Use `/hacsfiles/mini-graph-card/mini-graph-card-bundle.js` for a HACS install)
4. Reload your browser.

### Going back to the official card

Uninstall this one in HACS, remove the custom repository, then install
*mini-graph-card* from HACS as usual. The card config itself needs no changes -
unless you used an option this fork added, which the official card does not
know about.

## Updating
**If you have a version older than v0.0.8 installed, please delete the current files and follow the installation instructions again.**

1. Find your `mini-graph-card-bundle.js` file in `config/www` or wherever you ended up storing it.

2. Replace the local file with the latest one attached in the [latest release](https://github.com/kalkih/mini-graph-card/releases/latest).

3. Add the new version number to the end of the cards reference url in your `ui-lovelace.yaml` like below:

  ```yaml
  resources:
    - url: /local/mini-graph-card-bundle.js?v=2026.8.5
      type: module
  ```

*You may need to empty the browsers cache if you have problems loading the updated card.*

## Using the card

We recommend looking at the [Example usage section](#example-usage) to understand the basics to configure this card.
(also) pay attention to the **required** options mentioned below.

### Options

#### Card options
| Name | Type | Default | Since | Description |
|------|:----:|:-------:|:-----:|-------------|
| type ***(required)*** | string |  | v0.0.1 | `custom:mini-graph-card`.
| entities ***(required)*** | list |  | v0.2.0 | One or more sensor entities (along with [static values](#static-lines)) in a list, see [entities object](#entities-object) for additional entity/static value options.
| icon | string |  | v0.0.1 | Set a custom icon from any of the available mdi icons.
| icon_color | string |  | v0.14.0 | Set a custom icon color. Takes precedence over `icon_adaptive_color`.
| icon_image | string |  | v0.12.0 | Override icon with an image url.
| name | string |  | v0.0.1 | Set a custom name which is displayed beside the icon.
| unit | string |  | v0.0.1 | Set a custom unit of measurement (`''` value for an empty unit).
| tap_action | [action object](#action-object-options) |  | v0.7.0 | Action on click/tap, see [Tapping & holding](#tapping--holding).
| hold_action | [action object](#action-object-options) | `more-info` | | Action on a press held for half a second, see [Tapping & holding](#tapping--holding).
| group | boolean | `false` | v0.2.0 | Disable paddings and box-shadow, useful when nesting the card.
| hours_to_show | integer | `24` | v0.0.2 | Specify how many hours of history the graph should present.
| points_per_hour | number | `0.5` | v0.2.0 | Specify amount of data points the graph should display for each hour, *(basically the detail/accuracy/smoothing of the graph)*.
| aggregate_func | string | `avg` | v0.8.0 | Specify [aggregate function](#aggregate-functions) used to calculate point/bar in the graph.
| group_by | string | `interval` | v0.8.0 | Specify type of grouping of data, dynamic `interval`, `date` or `hour`.
| update_interval | number |  | v0.4.0 | Specify a custom update interval of the history data (in seconds), instead of on every state change.
| cache | boolean | `true` | v0.9.0 | Enable/disable local caching of history data.
| statistics | boolean *or* object |  |  | Read the series from statistics instead of raw history, see [Statistics](#statistics).
| show | list |  | v0.2.0 | List of UI elements to display/hide, for available items see [available show options](#available-show-options).
| animate | boolean | `false` | v0.2.0 | Add a reveal animation to the graph.
| height | number |  | v0.0.1 | Set a desired height of the **card**, see [Card size](#card-size). Left unset, a card asks for as much as it needs.
| graph_height | number *or* string | `auto` | | How tall the graph is drawn **inside** the card: a number of pixels, a percentage of the card (`60%`), or `auto` to fill what the rest of the card leaves. See [Card size](#card-size).
| bar_spacing | number | `4` | v0.9.0 | Set the spacing between bars in bar graph. Value `-1` is used to place bars on each other. See [examples](#bar-spacing-examples).
| bar_spacing_group | number |   | 0.14.0 | Set an additional spacing between bar groups (multiple entities) in bar graph. Fallback to `bar_spacing` if undefined; if `bar_spacing: -1` - then a default `4` value is used. See [examples](#bar-spacing-examples).
| line_width | number | `5` | v0.0.1 | Set the thickness of the line.
| line_style | string |  | v0.14.0 | Set the style of the line (see [Line styles](#line-styles)).
| line_color | string/list | `var(--accent-color)` | v0.0.1 | Set a custom color for the graph line, provide a list of colors for multiple graph entries.
| color_thresholds | list |  | v0.2.3 | Set thresholds for dynamic graph colors, see [Line color object](#line-color-object).
| color_thresholds_transition | string | `smooth` | v0.4.3 | Color threshold transition, `smooth` or `hard`.
| decimals | integer |  | v0.0.9 | Specify the exact number of decimals to show for number values, see [Number format](#number-format).
| decimals_primary_labels | integer |  | v0.14.0 | Specify the exact number of decimals to show for primary Y-axis labels, see [Number format](#number-format).
| decimals_secondary_labels | integer |  | v0.14.0 | Specify the exact number of decimals to show for secondary Y-axis labels, see [Number format](#number-format).
| hour24 | boolean |  | v0.2.1 | Set to `true` to display times in 24-hour format. See more details [here](#custom-format-for-datetime-values).
| datetime_format | string | | v.0.14.0 | Set a custom [format](#custom-format-for-datetime-values) for datetime values.
| font_size | number | `100` | v0.0.3 | Adjust the font size of the state, as percentage of the original size.
| font_size_header | number | `14` | v0.3.1 | Adjust the font size of the header, size in pixels.
| font_size_state | number |  |  | Adjust the font size of the current state, size in pixels. The unit follows at the same proportion as by default.
| font_size_secondary | number |  |  | Size of the states shown beside the primary one, in pixels. Its unit follows in proportion, as the primary state's does.
| font_size_legend | number |  |  | Size of the legend, in pixels.
| font_size_extrema | number |  |  | Size of the extrema row, in pixels.
| font_size_labels | number |  |  | Size of the axis, [grid](#grid-lines) and static-value labels, in pixels.
| density | string | `auto` | | How much padding a card spends between its rows: `comfortable` (16px), `compact` (8px), or `auto` to compact a card too short to afford it. See [Density](#density).
| align_header | string | `default` | v0.2.0 | Set the alignment of the header, `left`, `right`, `center` or `default`.
| align_icon | string | `right` | v0.2.0 | Set the alignment of the icon, `left`, `right` or `state`. A `right` icon shares its corner with a `top-right` state, see [Card size](#card-size).
| grid_x | boolean *or* [grid object](#grid-lines) | `false` | | Draw vertical grid lines at real clock boundaries, see [Grid lines](#grid-lines). `true` uses the defaults.
| grid_y | boolean *or* [grid object](#grid-lines) | `false` | | Draw horizontal grid lines at round values, see [Grid lines](#grid-lines). `true` uses the defaults.
| hover_mode | string | `nearest` | | How a value is picked when hovering the graph: `nearest` selects the point closest to the cursor from anywhere in the graph, `point` only when the cursor is over the point itself. See [Hovering](#hovering).
| align_state | string | `left` | v0.2.0 | Set the alignment of the current state: `left`, `right`, `center`, or `top-left`, `top-right`, `bottom-left`, `bottom-right` to pin it to a corner of the card, see [Card size](#card-size) - a `top-*` state wants `align_icon: state` or `left` to stay clear of the icon.
| lower_bound | number *or* string |  | v0.2.3 | Set a fixed lower bound for the graph Y-axis. String value starting with ~ (e.g. `~50`) specifies soft bound.
| upper_bound | number *or* string |  | v0.2.3 | Set a fixed upper bound for the graph Y-axis. String value starting with ~ (e.g. `~50`) specifies soft bound.
| min_bound_range | number |  | v0.x.x | Applied after everything, makes sure there's a minimum range that the Y-axis will have. Useful for not making small changes look large because of scale.
| lower_bound_secondary | number *or* string |  | v0.5.0 | Set a fixed lower bound for the graph secondary Y-axis. String value starting with ~ (e.g. `~50`) specifies soft bound.
| upper_bound_secondary | number *or* string |  | v0.5.0 | Set a fixed upper bound for the graph secondary Y-axis. String value starting with ~ (e.g. `~50`) specifies soft bound.
| min_bound_range_secondary | number |  | v0.x.x | Applied after everything, makes sure there's a minimum range that the secondary Y-axis will have. Useful for not making small changes look large because of scale.
| smoothing | boolean | `true` | v0.8.0 | Whether to make graph line smooth.
| state_map | [state map object](#state-map-object) |  | v0.8.0 | List of entity states to convert (order matters as position becomes a value on the graph).
| value_factor | number or object |   | v0.9.4<br>v0.14.0 | Scale a value, see [Value factor](#value-factor).
| value_factor_secondary | number or object |   | v0.14.0 | Scale a value, see [Value factor](#value-factor).
| logarithmic | boolean | `false` | v0.10.0 | Use a logarithmic scale for the graph (see [Logarithmic options](#logarithmic-options)).
| fill_baseline | number |  | v0.14.0 | Set a custom baseline for the graph (see [Baseline](#baseline)).



#### Entities object
Entities may be listed directly (as per `sensor.temperature` in the example below), or defined using
properties of the Entity object detailed in the following table (as per `sensor.pressure` in the example below).

| Name | Type | Default | Description |
|------|:----:|:-------:|-------------|
| entity ***(required)*** | string |         | Entity id of the sensor. Either `entity` or `static_value` must be defined.
| attribute | string |         | Retrieves an attribute or [sub-attribute (attr1.attr2...)](#accessing-attributes-in-complex-structures) instead of the state
| static_value | number |         | Set a value for a [static line](#static-lines). Either `entity` or `static_value` must be defined.
| name | string |         | Set a custom display name, defaults to entity's friendly_name or a `Static` label for a [static value](#static-lines).
| line_width | number |         | Override for a thickness of the line.
| line_style | string |   | Override the style of the line (see [Line styles](#line-styles)).
| color | string |         | Set a custom color, overrides all other color options including thresholds.
| color_thresholds | list |  | v0.14.0 | Override the thresholds for dynamic graph colors.
| color_thresholds_transition | string |  | v0.14.0 | Override the color threshold transition.
| unit | string |         | Set a custom unit of measurement, overrides `unit` set in base config (`''` value for an empty unit).
| aggregate_func | string |         | Override for aggregate function used to calculate point on the graph, `avg`, `median`, `min`, `max`, `first`, `last`, `sum`.
| decimals | integer |    | Override the exact number of decimals to show for number values, see [Number format](#number-format).
| show_state | boolean |         | Display the current state.
| show_legend_state | boolean |  false  | Display the current state as part of the legend.
| show_indicator | boolean |         | Display a color indicator next to the state.
| show_graph | boolean |         | Set to false to completely hide the graph.
| show_line | boolean |         | Set to false to hide the line.
| show_fill | boolean |         | Set to false to hide the fill.
| show_points | boolean |         | Set to false to hide the points (see a note below).
| show_legend | boolean |         | Set to false to turn hide from the legend.
| show_static_inactive | boolean |         | Set to true to disable hiding the line when a point of a line of another entity selected; meaningful for a [static line](#static-lines) only.
| state_adaptive_color | boolean |         | Make the color of the state adapt to the entity/static value color.
| y_axis | string |         | If 'secondary', displays using the secondary Y-axis on the right.
| statistics | boolean *or* object |         | Override statistics for this entity only, see [Statistics](#statistics).
| fixed_value | boolean |         | Set to true to graph the entity's current state as a fixed value instead of graphing its state history.
| smoothing | boolean |         | Override for a flag indicating whether to make graph line smooth.
| logarithmic | boolean |         | Override logarithmic scaling for this entity only (see [Logarithmic options](#logarithmic-options)).
| fill_baseline | number |   | Set a custom baseline for the graph or override a global `fill_baseline` option (see [Baseline](#baseline)).

Note: the "points" term is only applicable to a "line" graph, not to a "bar" graph.

```yaml
entities:
  - sensor.temperature
  - entity: sensor.pressure
    name: Pressure
    show_state: true
  - sensor.humidity
```

#### Available show options
All properties are optional.

| Name | Default | Options | Description |
|------|:-------:|:-------:|-------------|
| name | `true` | `true` / `false` | Display name.
| icon | `true` | `true` / `false` | Display icon.
| state | `true` | `true` / `false` / `last` | Display current state. `last` will show the last graph point's or bar's value (fallback to `true` if points are not shown for a line graph).
| graph | `line` | `line` / `bar` / `false` | Display option for the graph. If set to `bar` a maximum of `96` bars will be displayed.
| fill | `true` | `true` / `false` / `fade` | Display the line graph fill.
| points | `hover` | `true` / `false` / `hover` | Display graph data points (for a line graph only).
| legend | `true` | `true` / `false` / `below` | Display the graph legend (only shown when graph contains multiple entities); `below` - place below a graph.
| average | `false` | `true` / `false` / `below` | Display average information; `below` - place below a graph.
| extrema | `false` | `true` / `false` / `below` | Display max/min information; `below` - place below a graph.
| info_hide_unit | `false` | `true` / `false` | Do not show a unit for the average & max/min information.
| labels | `hover` | `true` / `false` / `hover` | Display axis labels: the Y-axis bounds, and the labels of a [grid](#grid-lines) on either axis. `false` removes all axis text from the card.
| labels_secondary | `hover` | `true` / `false` / `hover` | Display secondary Y-axis labels.
| name_adaptive_color | `false` | `true` / `false` | Make the name color adapt with the primary entity/static value color.
| icon_adaptive_color | `false` | `true` / `false` | Make the icon color adapt with the primary entity/static value color.
| loading_indicator | `true` | `true` / `false` | Show loading indicator while attempting to retrieve a history.
| graphs_order | `direct` | `direct` / `reversed` | Define an order of displaying graphs (see [Graphs order](#graphs-order)).


#### Line color object
See [dynamic line color](#dynamic-line-color) for example usage.

| Name | Type | Default | Description |
|------|:----:|:-------:|-------------|
| value ***(required [except in interpolation (see below)](#line-color-interpolation-of-stop-values))*** | number |  | The threshold for the color stop.
| color ***(required)*** | string |  | Color in 6 digit hex format (e.g. `#008080`).

##### Line color interpolation of stop values
As long as the first and last threshold stops have `value` properties, intermediate stops can exclude `value`; they will be interpolated linearly. For example, given stops like:

```yaml
color_thresholds:
  - value: 0
    color: "#ff0000"
  - color: "#ffff00"
  - color: "#00ff00"
  - value: 4
    color: "#0000ff"
```

The values will be interpolated as:

```yaml
color_thresholds:
  - value: 0
    color: "#ff0000"
  - value: 1.333333
    color: "#ffff00"
  - value: 2.666667
    color: "#00ff00"
  - value: 4
    color: "#0000ff"
```
The example above will result in the following colors of the graph: if value is
* between `0` (including this value) and  `1.33333`, the color is `#ff0000`,
* between `1.33333` (including this value) and `2.666667`, the color is `#ffff00`,
* between `2.666667` (including this value) and `4`, the color is `#00ff00`,
* equal to or more than `4`, the color is `#0000ff`.

As a shorthand, you can just use a color string for the stops that you want interpolated:

```yaml
  - value: 0
    color: "#ff0000"
  - "#ffff00"
  - "#00ff00"
  - value: 4
    color: "#0000ff"
```

#### Action object options

All card's area - except a graph part - supports processing of actions.
By default, tapping on an element opens a `more-info` dialog:
1. For "state" elements - the dialog is opened for a corresponding graph entity (not processed for a [static value](#static-lines)).
2. For "legend" elements - same as above.
3. For other card's areas (except a graph part) - the dialog is opened for the 1st graph entity (not processed for a [static value](#static-lines)).

| Name | Type | Default | Options | Description |
|------|:----:|:-------:|:-----------:|-------------|
| action | string | `more-info` | `more-info` / `navigate` / `call-service`  / `url` / `none` | Action to perform.
| entity | string |  | Any entity id | Override default entity of `more-info`, when  `action` is defined as `more-info`.<br>Note that this override is not applied when a "state" or a "legend" elements are tapped - in these cases always a corresponding graph entity is processed.
| service | string |  | Any service | Service to call (e.g. `media_player.toggle`) when `action` is defined as `call-service`.
| service_data | object |  | Any service data | Service data to include with the service call (e.g. `entity_id: media_player.office`).
| navigation_path | string |  | Any path | Path to navigate to (e.g. `/lovelace/0/`) when `action` is defined as `navigate`.
| url | string |  | Any URL | URL to open when `action` is defined as `url`.

#### State map object
| Name | Type | Default | Description |
|------|:----:|:-------:|-------------|
| value ***(required)*** | string |  | Value to convert.
| label | string | same as value | String to show as label (if the value is not precise).

#### Value factor

Defines a coefficent (factor) applied to displayed values (including Y-axis labels).
There are two available options - `value_factor` & `value_factor_secondary`:
1. If none option is defined, a default "1" factor is used (values are shown w/o any conversion).
2. If only `value_factor` is defined - it is applied to all entities.
3. If only `value_factor_secondary` is defined - it is applied to all entities with `y_axis: secondary`.
4. If both `value_factor` & `value_factor_secondary` are defined - they are applied to entities without `y_axis: secondary` & with `y_axis: secondary` correspondingly.

Each option can be defined either as a `number` or an `object` (see below).

A `number` value is a legacy format and defines an "exponent". Can be used for a unit conversion (e.g. convert Watts to kilo Watts); a negative value can be used to scale down (e.g. convert kilo Watts to Watts).
Any non-numerical value leads to a fallback to a default "1" factor.

An `object` value can be used to define either an "exponent" factor or a "scale" factor, see below:

| Name | Type | Default | Description |
|------|:----:|:-------:|-------------|
| type ***(required)*** | string |  | `exponent` or `scale`.<br>`exponent` - factor is an exponent (can be negative to scale down).<br>`scale` - factor is a multiplier (can be negative to get a negative value).
| factor ***(required)*** | number |  | A value of an exponent or a scale.

Invalid values (absent/undefined/invalid `type` or `factor`) passed in the object lead to a fallback to a default "1" factor.


### Aggregate functions
Recorded values are grouped in time buckets which are determined by `group_by`, `points_per_hour` configuration.
These buckets are converted later to single point/bar on the graph. Aggregate function defines the methods of that conversion.

| Name | Since | Description |
|------|:-------:|-------------|
| `avg` | v0.8.0 | Average
| `median` | v0.11.0 | Median
| `min` | v0.8.0 | Minimum - lowest value
| `max` | v0.8.0 | Maximum - largest value
| `first` | v0.9.0 |
| `last` | v0.9.0 |
| `sum` | v0.9.2 |
| `delta` | v0.9.4 | Calculates difference between max and min value
| `diff` | v0.11.0 | Calculates difference between first and last value

### Card size

The card reports its size to Home Assistant, so it is laid out correctly
without a manual `grid_options` in a Sections view or a `card_mod` height.

- In a **Sections view** `getGridOptions()` reports a desired number of rows,
  counted from `height` plus whatever the card shows - a header, a state, a
  legend, extrema. `min_rows` allows the card to be resized smaller. A
  `grid_options` in a config still wins over both.
- In a **Masonry view** `getCardSize()` reports the same height in 50px units,
  instead of a fixed `3` as before.

A state pinned to a corner with `align_state` is taken out of the flow, so it
takes no row of its own and the graph gets that space. It overlays the card, so
`top-right` is the one that fits alongside a header; `top-left` shares its row
with the name and icon, and a `bottom-*` state sits over the graph. Combine
those with `show.name: false` or a series that stays clear of that corner.

**A `top-*` state shares its corner with the icon**, which `align_icon` puts at
the `right` of the header by default. Pair them:

- `align_icon: state` moves the icon out of the header to sit beside the state
  itself, wherever that is pinned. This is usually what you want.
- `align_icon: left` leaves the icon in the header, at the opposite end from a
  `top-right` state.

```yaml
type: custom:mini-graph-card
align_state: top-right
align_icon: state
font_size_state: 21
entities:
  - sensor.outside_temperature
```

#### Two heights

`height` and `graph_height` answer different questions, and neither is expressed
in the other's terms:

| | Question | Effect |
|---|---|---|
| `height` | how big is the **card**? | what cell the card asks Home Assistant for |
| `graph_height` | how tall is the **graph** inside it? | only what is drawn |

`height` is a *desired* height, not a fixed one: a card placed in a cell of a
different size follows the cell. Left unset, the card asks for as much as its
own chrome needs plus a normal graph - which is what it always took.

`graph_height` defaults to `auto`: the graph is a row like any other and takes
whatever the header, state and legend leave. Give it a number of pixels or a
percentage of the card instead, and it comes out of the flow and is **anchored
to the bottom of the card** - so the taller it is, the more of the card's own
chrome it sits behind:

```yaml
type: custom:mini-graph-card
height: 250            # a 250px card...
graph_height: 100%     # ...with the graph behind everything in it
align_state: top-right
align_icon: state
entities:
  - sensor.outside_temperature
```

At `100%` the graph is a backdrop with the name, state and extrema floating over
it. Smaller values are useful in their own right: `60%` is a sparkline across
the bottom of a card, with the chrome in the clear above it.

A graph is redrawn for the size it really got, so nothing is scaled: a `viewBox`
matches its element 1:1. `line_width`, `bar_spacing` and a point radius are
therefore in real pixels; previously they were in units of a 500-wide drawing
stretched to a card, so they grew on a wide card and shrank on a narrow one.

### Density

A card spends 16px between each of its rows - the header, the state, the graph,
the extrema. On a card with a header and a state that is 48px before the graph
is drawn at all, which is fine on a tall card and most of the card on a short
one.

`density: compact` spends 8px instead. Nothing else changes: every part of the
card has a font size of its own (`font_size_header`, `font_size_state`,
`font_size_secondary`, `font_size_legend`, `font_size_extrema`,
`font_size_labels`), so padding and type are separate decisions.

`density: auto`, the default, uses the compact padding when a card is too short
to give the graph room after its chrome, and the comfortable padding otherwise.
It reacts to the height the card is **given**, so it only ever triggers where
something outside sets that: a cell in a Sections view. A Masonry card grows to
fit its own content, so there is nothing there to adapt to and `auto` leaves it
comfortable.

```yaml
type: custom:mini-graph-card
entities:
  - sensor.outside_temperature
density: compact
font_size_state: 18
```

### Grid lines

> [!NOTE]
> `grid_x`/`grid_y` draw lines **inside the graph**. They are unrelated to Home
> Assistant's own `grid_options`, which says how many columns and rows a card
> takes up in a Sections view.

Both take `true` for the defaults, or an object:

```yaml
type: custom:mini-graph-card
entities:
  - sensor.outside_temperature
hours_to_show: 336
grid_x: true
grid_y:
  step: 5
  labels: always
```

#### Grid object

| Name | Default | Options | Description |
|------|:-------:|---------|-------------|
| interval | `auto` | `5minute` / `15minute` / `hour` / `6hour` / `day` / `week` / `month` | **`grid_x` only.** How often a line is drawn. `auto` picks from `hours_to_show`, then coarsens further on a narrow card.
| step | `auto` | number | **`grid_y` only.** Distance between lines, in the entity's units. `auto` picks a round step - 1, 2 or 5 times a power of ten - aiming for a handful of lines, fewer on a short card.
| axis | `primary` | `primary` / `secondary` | **`grid_y` only.** Which Y axis the lines follow. Only one can be gridded; two sets of horizontal lines on different scales would be unreadable.
| labels | `hover` | `hover` / `always` / `true` / `false` | Whether the lines are named, and when. `hover` reveals them with the card, as `show.labels` does. `true` means `always`.
| minor | `0` | number | Lighter lines to draw between each pair of full ones. `2` gives thirds. The full lines then take more colour of their own, so the grid still reads as a hierarchy.
| color | | any CSS colour | Overrides the theme's colour for this card.
| width | `1` | number | Line width in pixels.

**Lines land on something real.** A `day` line sits on *local midnight*, a `6hour`
line on 00:00/06:00/12:00/18:00, a `month` line on the 1st - not at a fixed
distance back from the right-hand edge. That is the point of the feature: it
answers "when did a new day start", not "how long ago was that". Value lines
are the same idea: they land on 20/25/30 rather than dividing the bounds into
17.3/21.6/25.9.

**A small card gets fewer lines.** An automatic `interval` or `step` coarsens
until the lines are at least 32px apart, so a 100px-wide card does not receive
the thirteen lines a 600px one would. An `interval` or `step` you write yourself
is always obeyed - if you ask for it, you get it.

#### Which labels appear, and when

`grid_x` labels only name intervals which carry a date - `day`, `week` and
`month`. An hourly grid draws no labels: a dozen of them reading "13:00" costs
more than it says. Labels also thin out to every 2nd, 3rd... when the card is
too narrow to fit them all.

The switches interact like this:

| Option | Effect on lines | Effect on labels |
|---|---|---|
| `grid_x: false` (default) | no vertical lines | none |
| `grid_x: {labels: false}` | lines drawn | that grid is never named |
| `show.labels: false` | **lines still drawn** | no labels at all - neither axis, whatever `labels: always` says |
| `show.labels_secondary: false` | lines still drawn | no labels for a `grid_y` on the secondary axis |

Two rules worth stating plainly:

- **`show.labels` never turns the grid off.** It is about text, not lines. To
  remove the lines, set `grid_x`/`grid_y` to `false`.
- **`show.labels: false` beats `labels: always`.** It is the card's switch for
  axis text of any kind, so an explicit "no labels" wins over a per-grid
  preference. Use `grid_x: {labels: false}` to silence one grid & leave the
  other alone.

Colours come from `mcg-grid-color` and `mcg-grid-major-color`, see
[Theme variables](#theme-variables).

### Hovering

Hovering a graph shows the value at the point under the cursor. A point is as
wide as the line, so hitting one means chasing a circle a few pixels across, and
every miss drops the reading back to the current state - which is the flicker
in [upstream #1357](https://github.com/kalkih/mini-graph-card/issues/1357).

With the default `hover_mode: nearest` the cursor no longer has to be on a
point at all:

- **X picks the moment.** Anywhere in the graph, the point nearest the cursor
  horizontally is selected, so moving straight up or down never changes the
  time being read.
- **Y picks the entity.** With several entities, the curve the cursor is
  closest to wins. An entity whose data does not reach that part of the graph
  is never selected, however close its curve happens to be.
- A reading only clears when the cursor leaves the graph, so there is nothing
  to flicker.
- Dragging a finger across a graph works the same way, which makes a value
  readable on a phone.

Bars behave the same: a bar is selected from anywhere above it, not only from
the part that is painted.

While one entity is being read the others fade back, but stay faintly visible -
the selection changes wherever two curves cross, and blanking the others would
make the graph jump about. `--mcg-inactive-opacity` sets how faint, `0` hides
them as before.

The selected point is marked, whether or not `show.points` draws the points.
Set `hover_mode: point` for the old behaviour, where only the point itself
responds.

```yaml
type: custom:mini-graph-card
entities:
  - sensor.bedroom_temp
  - sensor.living_room_temp
hover_mode: nearest
```

### Tapping & holding

A click anywhere on the card runs `tap_action`, and a press held for half a
second runs `hold_action` - which defaults to `more-info`, as stock Home
Assistant cards do. A pointer that moves more than a few pixels is a scroll or a
drag, not a hold.

**On a touch screen a tap reads the card and a hold acts on it.** There is no
hover to read a graph with, so the tap has to do it - and it does so anywhere on
the card, with no boundary to find:

| | Tap / click | Hold |
|---|---|---|
| Mouse, pen | `tap_action` anywhere, graph included | `hold_action` |
| Touch | reads the value nearest the tap | `hold_action` |

A tap reads wherever it lands, including over the header and the state, because
a graph can be drawn behind either (see [Card size](#card-size)) and hunting for
the edge of it is not something a card should ask of anyone. A card with no
graph to read has nothing to show, so a tap there acts as a click does.

This keys off the input device that produced the gesture, not off the browser or
the screen, so a laptop with a touchscreen behaves correctly for each gesture in
turn. Set `hold_action: {action: none}` to switch holding off.

On a card showing several entities, an action applies to **the entity being
read** - the line the cursor is nearest, or the legend entry under it - rather
than always the first one. Naming an entity in the action itself still wins.

An action may be written either way - `hold_action: more-info` and
`hold_action: {action: more-info}` mean the same thing.

### Statistics

By default a series is read from the recorder's raw history. That history is
bounded by the recorder's `purge_keep_days`, and it gets expensive over long
spans - every state row in the window is fetched and then bucketed client side.

Setting `statistics` reads the series from Home Assistant's statistics
instead. Those are pre-aggregated server side and kept far longer than raw
history, so a wide graph costs a fraction of the rows.

The difference grows with the window. A two-week graph on a frequently updated
sensor fetches every recorded state - tens of thousands of rows per entity,
which the card then buckets in the browser. The same graph from hourly
statistics is a few hundred points, already aggregated. On a dashboard with
many graphs, or a card with several tabs at different time ranges, that is the
difference between a page that takes a long time to become usable and one that
loads promptly, and between switching a tab being a noticeable wait and being
immediate.

It is worth it for long windows only. Short ones are cheap from raw history
anyway, and statistics would cost accuracy and freshness for nothing - see the
notes below.

```yaml
type: custom:mini-graph-card
hours_to_show: 336
points_per_hour: 1
entities:
  - entity: sensor.outside_temperature
    statistics: true
```

| Option | Type | Default | Description
|--------|------|---------|------------
| period | string | derived from `hours_to_show` | `5minute`, `hour`, `day`, `week`, `month` or `year`.
| type | string | see below | Which statistic to plot: `mean`, `min`, `max`, `sum`, `state` or `change`.

```yaml
entities:
  - entity: sensor.outside_temperature
    statistics:
      period: hour
      type: max
```

`statistics` may be set per entity or card-wide, in which case it applies to
every entity that does not override it. `statistics: true` is shorthand for
the defaults, and `statistics: false` on an entity opts it back out.

Notes:

- Only entities with a `state_class` have statistics; the card logs a warning
  if there are none for an entity.
- Which types exist depends on the `state_class`: `measurement` has `mean`,
  `min` and `max`, `measurement_angle` has `mean` only (a circular mean),
  `total` and `total_increasing` have `sum`, `state` and `change`. The card
  reads the available types from a response, so a type which is not there is
  replaced by a default one, with a warning in a console.
- When `type` is not set, `mean` is used if it is available, otherwise `state`
  - the reading a raw history would show. Use `change` to plot a consumption
  per period instead, which is usually what is wanted for an energy, water or
  gas sensor.
- Home Assistant retains `5minute` statistics for a limited window (10 days by
  default) and hourly statistics indefinitely. When `period` is not set it is
  derived from `hours_to_show` so a long graph does not ask for data that has
  already been purged.
- Statistics are aggregated into fixed periods, so `points_per_hour` beyond one
  point per period only produces empty buckets.
- The whole window is refetched on update rather than appended to the cached
  tail, because a period's bucket is revised until that period completes.
- `statistics` cannot be combined with `attribute` or `state_map`. Statistics
  hold numeric aggregates of the state, so there is no attribute to read and
  no non-numeric state to map. Either combination logs a warning and the
  entity falls back to raw history, which honours both options.
- Values arrive in the entity's own unit. Home Assistant converts a statistic
  from the unit it was recorded in to the entity's current
  `unit_of_measurement` before returning it, which is the unit the card labels
  the axis with.

### Static lines

A static horizontal line is drawn for a user-defined static value.
Can be used in various applications like drawing a threshold line or a zeroth X-axis.

Notes:
1. Like a dynamic graph for an entity (defined by an `entity` option), a static line (defined by a `static_value` option) can use other applicable options: `name`, `line_width`, `line_style`, `color`, `unit`, `decimals`, `show_...`, `state_adaptive_color`, `y_axis`.
2. When `graph: bar`, a `static_value` entry is rendered as a set of constant bars.
3. Displaying extrema/average values is not supported for `static_value` entries.

See examples [below](#displaying-static-lines).

### Number format

Options `decimals` defined "card-wide" and/or for some entity/[static value](#static-lines) are used to set an exact number of decimals according to the following rules:
1. For state & attribute values, static values:
- if none `decimals` option is defined - a default presentation (see a note below) is used;
- if "card-wide" `decimals` is defined - this value is used;
- if `decimals` for some entity is defined - this value is used for this entity.
2. For extrema & average values (supported for the 1st entity only):
- if none `decimals` option is defined - a default presentation is used;
- if "card-wide" `decimals` is defined - this value is used;
- if `decimals` is defined for the 1st entity - this value is used.
3. For primary Y-axis labels:
- if "card-wide" `decimals` & `decimals_primary_labels` options are not defined - a default presentation is used;
- if "card-wide" `decimals` option is defined - this value is used;
- if "card-wide" `decimals_primary_labels` option is defined - this value is used.
4. For secondary Y-axis labels:
- if "card-wide" `decimals` & `decimals_secondary_labels` options are not defined - a default presentation is used;
- if "card-wide" `decimals` option is defined - this value is used;
- if "card-wide" `decimals_secondary_labels` option is defined - this value is used.
  
A "default presentation" refers to a default look in HA:
1. For a state value (also for extrema & average): if accuracy settings are defined for an entity - these settings are used, otherwise some default HA settings (depend on many factors incl. a `device_class`; for template sensors - a user-defined accuracy set in jinja templates is used).
2. For an attribute value (also for extrema & average): default HA settings are used (for template sensors - a user-defined accuracy set in jinja templates is used).
3. For Y-axis labels, [static values](#static-lines): "maximum 2 decimals" accuracy is used.
And for all values, HA number format settings (like `xxxx.xx` or `x xxx.x` or `x,xxx.x`) are used.


### Custom format for datetime values

By default, the card uses global HA Frontend settings for date & time values. An explicitly defined `datetime_format` option overrides the default format.

Note that the same approach is applied to `hour24` option: if the option is not defined, default settings are used. An explicitly defined `hour24` option overrides the default format.

Here are possible values for the `datetime_format` option:
```
DD/MM/YYYY HH:mm  DD.MM.YYYY HH:mm  DD-MM-YYYY HH:mm
MM/DD/YYYY HH:mm  MM.DD.YYYY HH:mm  MM-DD-YYYY HH:mm
YYYY/MM/DD HH:mm  YYYY.MM.DD HH:mm  YYYY-MM-DD HH:mm
```
where can be used `YYYY` or `YY`, `MM` or `M`, `DD` or `D`, `HH` or `H`.
A singular whitespace must be used to separate date & time formats. Letter case does matter.

Any values which do not match the pattern - lead to a fallback to a "day weekday" format (used as the only and default format till v.0.13).
For clarity, it is recommended to explicitly define a `day_weekday` value in case the legacy "day weekday" format is needed.

### Logarithmic options

Normally gaps between numbers on the graph are equal; the gap between 1 and 2 on the graph is the same as the gap between 100 and 101. The `logarithmic` option applies a [logarithmic transformation](https://en.wikipedia.org/wiki/Log_transformation_(statistics)) to the graph. With `logarithmic`, the graph is scaled by powers of 10, so the gap between 1, 10, 100, etc are equal. This is useful when your values span a wide range. Illuminance, for example, can swing from 1 to 5000 over the course of a day, and without a transformation it's hard to read the smaller values on the graph.

Note that this option rounds up the input to 1 so negative numbers or numbers less than 1 are rendered as 0; this is different from the formal definition of logarithm, where `log(x) < 0` when `x > 0 && x < 1` and $\infty$ or `NaN` when `x <= 0`.

### Line styles

A default line style is a "solid line". A style should be defined in a format used for a standard CSS `stroke-dasharray` property. Examples: `10,10` (dashes), `20,10` (long dashes); see cards examples [below](#custom-styles-for-line-graphs). It is better to use along with a `line_width` option.
Warning: the `line_style` option is not accounted if `animation: true` option is set.

### Baseline

The `fill_baseline` option is only meaningful for linear graphs with a fill.

By default, a fill is applied to an area between a curve and a bottom edge.
With the `fill_baseline` option set, areas between a curve & a baseline are filled.
This can be useful to show a deviation of a value near some basis (like for entities which can be both positive & nagitive).

Additionally, the `fill_baseline` option can be set individually for entities.

See examples [below](#custom-baseline).


### Graphs order

Note: this section only applies to line graphs & stacked bars graphs (with `bar_spacing: -1`).

For each entity/[static value](#static-lines), a `line` graph consists of 3 basic parts: a "line" part (curve), a "fill" part (if displaying a fill is configured), a "points" part (if displaying points is configured).

By default, graphs are shown in the following order:
1. All "fill" parts are shown (if configured).
2. All "line" parts are shown.
3. All "points" parts are shown (if configured).

Within each category, parts are shown in the following order:
1. First, a part for the 1st entity/static value in the `entities` list is processed.
2. Last, a part for the last entity/static value in the `entities` list is processed.

I.e. the last entity's/static value's graph will be shown as topmost.

This can be altered by setting a `graph_order` option: `direct` (default) stands for the described default order, `reversed` stands for "1st entity's/static value's graph is topmost".

Similarly for stacked bars graphs (when `bar_spacing: -1`): by default (or with `graph_order: direct`), bars for each point are processed in the following order:
1. First, a bar for the 1st entity/static value in the `entities` list is processed.
2. Last, a bar for the last entity/static value in the `entities` list is processed.

With `graph_order: reversed`, bars for the 1st entity/static value become topmost.

### Theme variables
The following theme variables can be set in your HA theme to customize the appearance of the card.

| Name | Default | Description |
|------|:-------:|-------------|
| mcg-title-letter-spacing |  | Letter spacing of the card title (`name` option).
| mcg-title-font-weight | 500 | Font weight of the card title.
| mcg-grid-color | var(--divider-color) | Colour of the [grid lines](#grid-lines).
| mcg-grid-major-color | var(--secondary-text-color) | Colour of the full grid lines where `minor` ones are drawn between them.
| mcg-inactive-opacity | 0.2 | Opacity of the lines/bars of the entities which are not the one being hovered, see [Hovering](#hovering). Set to `0` to hide them entirely.
| mcg-label-axis-opacity | 0.75 | Opacity of the Y-axis labels.
| mcg-label-static-opacity | 0.75 | Opacity of the static values' labels.
| mcg-label-axis-border-radius | 1em | Border radius of the Y-axis labels.
| mcg-label-static-border-radius | 1em | Border radius of the static values' labels.



### Example usage

#### Single entity card

![Single entity card](https://user-images.githubusercontent.com/457678/52009150-884d2500-24d2-11e9-9f2b-2981210d3897.png)

```yaml
type: custom:mini-graph-card
entities:
 - sensor.illumination
```

#### Alternative style

![Alternative style](https://user-images.githubusercontent.com/457678/52009161-8daa6f80-24d2-11e9-8678-47658a181615.png)

```yaml
type: custom:mini-graph-card
entities:
 - sensor.illumination
align_icon: left
align_state: center
show:
  fill: false
```

#### Multiple entities card

![Multiple entities card](https://user-images.githubusercontent.com/457678/52009165-900cc980-24d2-11e9-8cc6-c77de58465b5.png)

```yaml
type: custom:mini-graph-card
name: SERVER
icon: mdi:server
entities:
  - entity: sensor.server_total
    name: TOTAL
  - sensor.server_sent
  - sensor.server_received
```

#### Bar chart card

![Bar chart card](https://user-images.githubusercontent.com/457678/52970286-985e7300-33b3-11e9-89bc-1278c4e2ecf2.png)

```yaml
type: custom:mini-graph-card
entities:
  - entity: sensor.energy_consumption
name: ENERGY CONSUMPTION
show:
  graph: bar
```

#### Bar spacing

Custom `bar_spacing` & `bar_spacing_group`:

<img width="476" height="305" alt="image" src="https://github.com/user-attachments/assets/0f0bd87b-13d0-4237-b8ab-0c457d3df1d5" />

```yaml
type: custom:mini-graph-card
entities:
  - entity: sensor.ac68u_cpu_usage
    state_adaptive_color: true
  - entity: sensor.system_monitor_processor_use
    show_state: true
    state_adaptive_color: true
hours_to_show: 0.75
points_per_hour: 60
height: 200
smoothing: false
aggregate_func: last
bar_spacing: 1
bar_spacing_group: 4
show:
  graph: bar
  icon: false
  name: false
```
Placing bars on each other with `bar_spacing: -1`:

<img width="485" height="311" alt="image" src="https://github.com/user-attachments/assets/8fd8bdae-cd0e-4519-860c-b0bf54e824f4" />

```yaml
type: custom:mini-graph-card
entities:
  - entity: sensor.ac68u_cpu_usage
    state_adaptive_color: true
  - entity: sensor.system_monitor_processor_use
    show_state: true
    state_adaptive_color: true
hours_to_show: 0.75
points_per_hour: 60
height: 200
smoothing: false
aggregate_func: last
bar_spacing: -1
show:
  graph: bar
  icon: false
  name: false
```


#### Show data from the past week
![Show data from the past week](https://user-images.githubusercontent.com/457678/52009167-913df680-24d2-11e9-8732-52fc65e3f0d8.png)

Use the `hours_to_show` option to specify how many hours of history the graph should represent.
Use the `points_per_hour` option to specify the accuracy/detail of the graph.

```yaml
type: custom:mini-graph-card
entities:
  - sensor.living_room_temp
name: LIVING ROOM
hours_to_show: 168
points_per_hour: 0.25
```

#### Graph only card
Use the `show` option to show/hide UI elements.

<img width="482" height="127" alt="image" src="https://github.com/user-attachments/assets/95196d3b-4de9-49a1-ae88-72bf19b3f3d2" />

```yaml
type: custom:mini-graph-card
entities:
  - sensor.humidity
show:
  icon: false
  name: false
  state: false
```

#### Horizontally stacked cards
You can stack cards horizontally by using one or more `horizontal-stack(s)`.

![Horizontally stacked cards](https://user-images.githubusercontent.com/457678/52009171-926f2380-24d2-11e9-9dd4-28f010608858.png)

```yaml
type: horizontal-stack
cards:
  - type: custom:mini-graph-card
    entities:
      - sensor.humidity
    line_color: blue
    line_width: 8
    font_size: 75
  - type: custom:mini-graph-card
    entities:
      - sensor.illumination
    line_color: '#e74c3c'
    line_width: 8
    font_size: 75
  - type: custom:mini-graph-card
    entities:
      - sensor.temperature
    line_color: var(--accent-color)
    line_width: 8
    font_size: 75
```

#### Dynamic line color
Have the graph change line color dynamically.

![Dynamic line color](https://user-images.githubusercontent.com/457678/52573150-cbd05900-2e19-11e9-9e01-740753169093.png)

```yaml
type: custom:mini-graph-card
entities:
  - sensor.sensor_temperature
show:
  labels: true
color_thresholds:
  - value: 20
    color: "#f39c12"
  - value: 21
    color: "#d35400"
  - value: 21.5
    color: "#c0392b"
```

#### Alternate Y-axis
Have one or more series plot on a separate Y-axis, which appears on the right side of the graph. This example also
shows turning off the line, points and legend.

![Alternate Y-axis](https://user-images.githubusercontent.com/373079/60764115-63cf2780-a0c6-11e9-8b9a-97fc47161180.png)

```yaml
type: custom:mini-graph-card
entities:
  - entity: sensor.verandah
    name: Verandah
  - entity: sensor.lounge
    name: Lounge
  - entity: sensor.kitchen
    name: Kitchen
  - color: gray
    entity: input_number.nighttime
    name: Night
    show_line: false
    show_points: false
    show_legend: false
    y_axis: secondary
show:
  labels: true
  labels_secondary: true
```

#### Custom styles for line graphs

Set a custom line style globally for a whole card or per-entity:

<img width="478" height="221" alt="image" src="https://github.com/user-attachments/assets/daafee31-dec7-42bf-afa4-a3393755fbae" />

```
type: custom:mini-graph-card
entities:
  - entity: sensor.xiaomi_cg_1_temperature
line_style: 20,10
```

<img width="485" height="259" alt="image" src="https://github.com/user-attachments/assets/ce67cc56-b7eb-448f-aa7f-1ad48f3a65e1" />

```
type: custom:mini-graph-card
entities:
  - entity: sensor.xiaomi_cg_1_temperature
    line_style: 20,10
  - entity: sensor.xiaomi_cg_2_temperature
    line_style: 6,6
```

#### Displaying static lines

Example with a threshold line:

<img width="485" height="257" alt="image" src="https://github.com/user-attachments/assets/7d668913-1811-48e8-9a24-d6bed93f7ee9" />

```yaml
type: custom:mini-graph-card
entities:
  - entity: sensor.system_monitor_processor_use
  - static_value: 50
    name: Threshold
    unit: "%"
    show_legend_state: true
    show_state: false
    show_points: false
    show_fill: false
    line_width: 1
    line_style: 4,7
    color: red
lower_bound: ~0
show:
  labels: true
```

Example with a zeroth X-axis:

<img width="480" height="219" alt="image" src="https://github.com/user-attachments/assets/2fe260f2-439c-4652-b817-feec461cbee8" />

```yaml
type: custom:mini-graph-card
entities:
  - entity: sensor.temperature
  - static_value: 0
    show_state: false
    show_points: false
    show_fill: false
    show_legend: false
    line_width: 1
    color: grey
show:
  labels: true
```

Example with a static line which is not hidden when a point of a line of another entity selected:

<img width="481" height="353" alt="изображение" src="https://github.com/user-attachments/assets/bc11d3c1-c557-46e0-afe9-b7d2e17b35be" />

```yaml
type: custom:mini-graph-card
entities:
  - entity: sensor.system_monitor_processor_use
    line_width: 4
  - static_value: 50
    name: Threshold
    unit: "%"
    show_legend_state: true
    show_state: false
    show_points: false
    line_width: 1
    line_style: 4,7
    color: red
    show_static_inactive: true
lower_bound: ~0
points_per_hour: 60
hours_to_show: 3
height: 200
show:
  labels: true
  fill: false
```

#### Custom baseline

Baseline is set to 0:

<img width="497" height="217" alt="изображение" src="https://github.com/user-attachments/assets/c755d398-bbe8-435a-8571-ee4947483b56" />

```yaml
type: custom:mini-graph-card
entities:
  - entity: sensor.xxx
fill_baseline: 0
show:
  labels: true
```

Individual baselines for entities (along with displaying static lines):

<img width="498" height="264" alt="изображение" src="https://github.com/user-attachments/assets/43a39c0b-4ca2-40ad-8443-2e8821aa987b" />

```yaml
type: custom:mini-graph-card
entities:
  - entity: sensor.xiaomi_cg_1_co2
    fill_baseline: 660
    color: orange
    name: Room 1
  - static_value: 660
    show_fill: false
    line_width: 1
    color: orange
    show_legend: false
  - entity: sensor.xiaomi_cg_2_co2
    fill_baseline: 740
    color: green
    name: Room 2
  - static_value: 740
    show_fill: false
    line_width: 1
    color: green
    show_legend: false
height: 200
show:
  static_value_labels: left
  name: false
  icon: false
  state: false
```

#### Grouping by date

![mini_energy_daily](https://user-images.githubusercontent.com/8268674/66688605-3ffc1e80-ec7f-11e9-872e-935870a542f3.png)

You can group values by date, this way you can visualize for example daily energy consumption.

```yaml
type: custom:mini-graph-card
entities:
  - entity: sensor.energy_daily
name: Energy consumption
hours_to_show: 168
aggregate_func: max
group_by: date
show:
  graph: bar
```

#### Data aggregation functions
You can decide how values are aggregated for points on graph. Example how to display min, max, avg temperature per day
from last week.

![mini_temperature_aggregate_daily](https://user-images.githubusercontent.com/8268674/66688610-44c0d280-ec7f-11e9-86c2-a728da239dab.png)

```yaml
type: custom:mini-graph-card
entities:
  - entity: sensor.outside_temp
    aggregate_func: max
    name: Max
    color: "#e74c3c"
  - entity: sensor.outside_temp
    aggregate_func: min
    name: Min
  - entity: sensor.outside_temp
    aggregate_func: avg
    name: Avg
    color: green
name: Temp outside daily (last week)
hours_to_show: 168
group_by: date
```

#### Non-numeric sensor states

![mini_binary_sensor](https://user-images.githubusercontent.com/8268674/66825779-e1ff5d80-ef42-11e9-89eb-673d2ada8d34.png)

You can render non-numeric states by providing state_map config. For example this way you can show data coming from binary sensors.

```yaml
type: custom:mini-graph-card
entities:
  - entity: binary_sensor.living_room_motion
    name: Living room
  - entity: binary_sensor.corridor_motion
    name: Corridor
  - entity: binary_sensor.master_bed_motion
    name: Master bed.
    color: green
  - entity: binary_sensor.bedroom_motion
    name: Bedroom
name: Motion last hour
hours_to_show: 1
points_per_hour: 60
update_interval: 30
aggregate_func: max
line_width: 2
smoothing: false
state_map:
  - value: "off"
    label: Clear
  - value: "on"
    label: Detected
```


#### Showing additional info on the card

![изображение](https://user-images.githubusercontent.com/71872483/170584118-ef826b60-dce3-42ec-a005-0f467616cd37.png)

It is possible to show a state without displaying a graph for a sensor.
Imagine there are two CO-2 sensors & one humidity sensor; graphs are displayed for the CO-2 only, and the humidity is shown as a state only.
```yaml
type: custom:mini-graph-card
entities:
  - entity: sensor.xiaomi_cg_1_humidity
    show_state: true
    show_graph: false
  - entity: sensor.xiaomi_cg_1_co2
    color: green
    show_state: false
    name: CO2-1
  - entity: sensor.xiaomi_cg_2_co2
    color: orange
    show_state: false
    name: CO2-2
name: Humidity
hours_to_show: 4
points_per_hour: 60
show:
  name: true
  legend: true
  icon: false
  labels: true
```
This method may be also used to add a calculated value with it's own `aggregate_func` option.

#### Accessing attributes in complex structures

When using the `attribute` option in the [entities object](#entities-object), you can access data in structured attributes, such as dictionaries and lists.

##### Accessing dictionary attributes
Suppose you have data stored inside a *dictionary* attribute named `dict_attribute`
```yaml
dict_attribute:
  value_1: 53
  value_2: 64
  value_3: 72
```
Such data should be addressed as `dict_attribute.sub_attribute`:
```yaml
type: custom:mini-graph-card
entities:
  - entity: sensor.testing_object_data
    attribute: dict_attribute.value_1
    name: value_1 from dictionary attribute
```
![image](https://github.com/ildar170975/mini-graph-card/assets/71872483/0549afd5-901e-4e86-a144-edc4cd207440)

##### Accessing list attributes

Suppose you have data stored inside a *list* attribute named `list_attribute`:
```yaml
list_attribute:
  - value_1: 67
    value_2: 65
    value_3: 93
  - value_1: 134
    value_2: 130
    value_3: 186
  - value_1: 201
    value_2: 195
    value_3: 279
```
Such data should be addressed as `list_attribute.index.sub_attribute`:
```yaml
type: custom:mini-graph-card
entities:
  - entity: sensor.testing_object_data_list
    attribute: list_attribute.0.value_1
    name: value_1 from first element of list attribute
```
![image](https://github.com/ildar170975/mini-graph-card/assets/71872483/eebd0cea-da93-4bf5-97a1-118edd2a9c5e)

## Development

1. Clone this repository into your `config/www` folder using git:

```console
$ git clone https://github.com/kalkih/mini-graph-card.git
```

2. Add a reference to the card in your `ui-lovelace.yaml`:

```yaml
resources:
  - url: /local/mini-graph-card/dist/mini-graph-card-bundle.js
    type: module
```

### Instructions

*Requires `nodejs` & `npm`.*

1. Move into the `mini-graph-card` repo, checkout the *dev* branch & install dependencies:
```console
$ cd mini-graph-card && git checkout dev && npm install
```

2. Make changes to the source code.

3. Build the source by running:
```console
$ npm run build
```

4. Refresh the browser to see changes.

    *Make sure cache is cleared or disabled.*

5. *(Optional)* Watch the source and automatically rebuild on save:
```console
$ npm run watch
```

*The new `mini-graph-card-bundle.js` will be build and ready inside `/dist`.*

Note that the `dev` branch is the most up-to-date and matches our beta releases.

Please refer to the [Contribution Guidelines](./CONTRIBUTING.md) if you're interested in contributing to the project. (And thanks for considering!)

## Getting errors?
Make sure you have `javascript_version: latest` in your `configuration.yaml` under `frontend:`.

Make sure you have the latest versions of `mini-graph-card.js` & `mini-graph-lib.js`.

If you have issues after updating the card, try clearing your browser cache.

If you have issues displaying the card in older browsers, try changing `type: module` to `type: js` at the card reference in `ui-lovelace.yaml`.

## License
This project is under the MIT license.
