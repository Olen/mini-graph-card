import {
  mdiAlignHorizontalLeft, mdiArrowExpandVertical, mdiEye,
  mdiFormatColorFill,
  mdiFormatSize,
  mdiGrid,
  mdiPalette,
  mdiStateMachine,
} from '@mdi/js';

const MAINSCHEMA = [
  {
    name: 'appearance',
    type: 'expandable',
    iconPath: mdiPalette,
    flatten: true,
    schema: [
      {
        name: '',
        type: 'grid',
        schema: [
          {
            name: 'name',
            label: 'Name',
            selector: { text: {} },
          },
          {
            name: 'icon',
            selector: { icon: {} },
          },
          {
            name: 'unit',
            selector: { text: {} },
          },
          {
            name: 'hour24',
            selector: { boolean: {} },
          },
          {
            name: 'hours_to_show',
            selector: { number: { min: 1 } },
          },
          {
            name: 'points_per_hour',
            selector: { number: { min: 0.1, step: 0.1 } },
          },
          {
            name: 'aggregate_func',
            selector: {
              select: {
                options: [
                  { label: 'Average', value: 'avg' },
                  { label: 'Median', value: 'median' },
                  { label: 'Minimum', value: 'min' },
                  { label: 'Maximum', value: 'max' },
                  { label: 'First', value: 'first' },
                  { label: 'Last', value: 'last' },
                  { label: 'Sum', value: 'sum' },
                  { label: 'Delta', value: 'delta' },
                  { label: 'Diff', value: 'diff' },
                ],
                mode: 'dropdown',
                translation_key: 'aggregate_func',
              },
            },
          },
          {
            name: 'group_by',
            selector: {
              select: {
                options: [
                  { label: 'Interval', value: 'interval' },
                  { label: 'Date', value: 'date' },
                  { label: 'Hour', value: 'hour' },
                ],
                mode: 'dropdown',
                translation_key: 'group_by',
              },
            },
          },
          {
            name: 'value_factor',
            selector: { number: {} },
          },
          {
            name: 'bar_spacing',
            selector: { number: { min: 0.1, step: 0.1 } },
          },
          {
            name: 'line_width',
            selector: { number: { min: 0.1, step: 0.1 } },
          },
          {
            name: 'color_thresholds_transition',
            selector: {
              select: {
                options: [
                  { label: 'Smooth', value: 'smooth' },
                  { label: 'Hard', value: 'hard' },
                ],
                mode: 'dropdown',
                translation_key: 'transition',
              },
            },
          },
          {
            name: 'animate',
            selector: { boolean: {} },
          },
          {
            name: 'logarithmic',
            selector: { boolean: {} },
          },
          {
            name: 'height',
            selector: { number: { min: 0, mode: 'box' } },
          },
          {
            // Takes "180" or "60%", so it cannot be a number selector.
            name: 'graph_height',
            selector: { text: {} },
          },
          {
            name: 'density',
            selector: {
              select: {
                options: [
                  { label: 'Auto', value: 'auto' },
                  { label: 'Comfortable', value: 'comfortable' },
                  { label: 'Compact', value: 'compact' },
                ],
                mode: 'dropdown',
                translation_key: 'density',
              },
            },
          },
          {
            name: 'hover_mode',
            selector: {
              select: {
                options: [
                  { label: 'Nearest', value: 'nearest' },
                  { label: 'Point', value: 'point' },
                ],
                mode: 'dropdown',
                translation_key: 'hover_mode',
              },
            },
          },
        ],
      },
      {
        name: 'font_sizes',
        type: 'expandable',
        iconPath: mdiFormatSize,
        flatten: true,
        schema: [
          {
            name: '',
            type: 'grid',
            schema: [
              { name: 'font_size', selector: { number: { min: 0.1, step: 0.1 } } },
              { name: 'font_size_header', selector: { number: { min: 0.1, step: 0.1 } } },
              { name: 'font_size_state', selector: { number: { min: 0.1, step: 0.1 } } },
              { name: 'font_size_secondary', selector: { number: { min: 0.1, step: 0.1 } } },
              { name: 'font_size_legend', selector: { number: { min: 0.1, step: 0.1 } } },
              { name: 'font_size_extrema', selector: { number: { min: 0.1, step: 0.1 } } },
              { name: 'font_size_labels', selector: { number: { min: 0.1, step: 0.1 } } },
            ],
          },
        ],
      },
      {
        name: 'bounds',
        type: 'expandable',
        iconPath: mdiArrowExpandVertical,
        flatten: true,
        schema: [
          {
            name: '',
            type: 'grid',
            schema: [
              {
                name: 'lower_bound',
                selector: { text: {} },
              },
              {
                name: 'upper_bound',
                selector: { text: {} },
              },
              {
                name: 'min_bound_range',
                selector: { number: { step: 0.1 } },
              },
            ],
          },
          {
            name: '',
            type: 'grid',
            schema: [
              {
                name: 'lower_bound_secondary',
                selector: { text: {} },
              },
              {
                name: 'upper_bound_secondary',
                selector: { text: {} },
              },
              {
                name: 'min_bound_range_secondary',
                selector: { number: { step: 0.1 } },
              },
            ],
          },
        ],
      },
      {
        name: 'alignment',
        type: 'expandable',
        iconPath: mdiAlignHorizontalLeft,
        flatten: true,
        schema: [
          {
            name: '',
            type: 'grid',
            schema: [
              {
                name: 'align_header',
                selector: {
                  select: {
                    options: [
                      { label: 'Default', value: 'default' },
                      { label: 'Left', value: 'left' },
                      { label: 'Right', value: 'right' },
                      { label: 'Center', value: 'center' },
                    ],
                    mode: 'dropdown',
                    translation_key: 'alignment',
                  },
                },
              },
              {
                name: 'align_icon',
                selector: {
                  select: {
                    options: [
                      { label: 'Left', value: 'left' },
                      { label: 'Right', value: 'right' },
                      { label: 'State', value: 'state' },
                    ],
                    mode: 'dropdown',
                    translation_key: 'alignment',
                  },
                },
              },
              {
                name: 'align_state',
                selector: {
                  select: {
                    options: [
                      { label: 'Left', value: 'left' },
                      { label: 'Right', value: 'right' },
                      { label: 'Center', value: 'center' },
                      { label: 'Top left', value: 'top-left' },
                      { label: 'Top right', value: 'top-right' },
                      { label: 'Bottom left', value: 'bottom-left' },
                      { label: 'Bottom right', value: 'bottom-right' },
                    ],
                    mode: 'dropdown',
                    translation_key: 'alignment',
                  },
                },
              },
            ],
          },
        ],
      },
      {
        name: 'show',
        type: 'expandable',
        iconPath: mdiEye,
        schema: [
          {
            name: '',
            type: 'grid',
            schema: [
              {
                name: 'name',
                default: true,
                selector: { boolean: {} },
              },
              {
                name: 'icon',
                default: true,
                selector: { boolean: {} },
              },
              {
                name: 'state',
                selector: {
                  select: {
                    options: [
                      { label: 'Show', value: 'show' },
                      { label: 'Hide', value: 'hide' },
                      { label: 'Last', value: 'last' },
                    ],
                    mode: 'dropdown',
                    translation_key: 'state',
                  },
                },
              },
              {
                name: 'graph',
                selector: {
                  select: {
                    options: [
                      { label: 'Line', value: 'line' },
                      { label: 'Bar', value: 'bar' },
                      { label: 'Hide', value: 'hide' },
                    ],
                    mode: 'dropdown',
                    translation_key: 'graph',
                  },
                },
              },
              {
                name: 'fill',
                // Ignored by Home Assistant before 2026.8, which just shows it.
                visible: { field: 'graph', operator: 'not_eq', value: 'hide' },
                selector: {
                  select: {
                    options: [
                      { label: 'Show', value: 'show' },
                      { label: 'Hide', value: 'hide' },
                      { label: 'Fade', value: 'fade' },
                    ],
                    mode: 'dropdown',
                    translation_key: 'fill',
                  },
                },
              },
              {
                name: 'points',
                // Ignored by Home Assistant before 2026.8, which just shows it.
                visible: { field: 'graph', operator: 'not_eq', value: 'hide' },
                selector: {
                  select: {
                    options: [
                      { label: 'Show', value: 'show' },
                      { label: 'Hide', value: 'hide' },
                      { label: 'Hover', value: 'hover' },
                    ],
                    mode: 'dropdown',
                    translation_key: 'points',
                  },
                },
              },
              {
                name: 'labels',
                selector: {
                  select: {
                    options: [
                      { label: 'Show', value: 'show' },
                      { label: 'Hide', value: 'hide' },
                      { label: 'Hover', value: 'hover' },
                    ],
                    mode: 'dropdown',
                    translation_key: 'labels',
                  },
                },
              },
              {
                name: 'labels_secondary',
                selector: {
                  select: {
                    options: [
                      { label: 'Show', value: 'show' },
                      { label: 'Hide', value: 'hide' },
                      { label: 'Hover', value: 'hover' },
                    ],
                    mode: 'dropdown',
                    translation_key: 'labels',
                  },
                },
              },
              {
                name: 'legend',
                default: true,
                selector: { boolean: {} },
              },
              {
                name: 'average',
                selector: { boolean: {} },
              },
              {
                name: 'extrema',
                selector: { boolean: {} },
              },

              {
                name: 'name_adaptive_color',
                selector: { boolean: {} },
              },
              {
                name: 'icon_adaptive_color',
                selector: { boolean: {} },
              },
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'color_thresholds',
    type: 'expandable',
    flatten: true,
    iconPath: mdiFormatColorFill,
    schema: [
      {
        name: 'color_thresholds',
        type: 'mgc-list',
        schema: [
          {
            name: '',
            type: 'grid',
            column_min_width: '100px',
            schema: [
              {
                name: 'value',
                selector: { number: { step: 0.1 } },
              },
              {
                name: 'color',
                selector: { hex_color: {} },
              },
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'state_map',
    type: 'expandable',
    flatten: true,
    iconPath: mdiStateMachine,
    schema: [
      {
        name: 'state_map',
        type: 'mgc-list',
        schema: [
          {
            name: '',
            type: 'grid',
            column_min_width: '100px',
            schema: [
              {
                name: 'value',
                selector: { text: {} },
              },
              {
                name: 'label',
                selector: { text: {} },
              },
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'options',
    type: 'expandable',
    flatten: true,
    iconPath: mdiGrid,
    schema: [
      {
        name: '',
        type: 'grid',
        schema: [
          { name: 'statistics', selector: { boolean: {} } },
          { name: 'grid_x', selector: { boolean: {} } },
          { name: 'grid_y', selector: { boolean: {} } },
        ],
      },
    ],
  },
  {
    name: 'tap_action',
    selector: { ui_action: {} },
  },
  {
    name: 'hold_action',
    selector: { ui_action: {} },
  },
];

const ENTITYSCHEMA = [
  {
    name: '',
    type: 'grid',
    schema: [
      {
        name: 'entity',
        selector: { entity: {} },
      },
      {
        name: 'attribute',
        selector: { attribute: {} },
        context: { filter_entity: 'entity' },
      },
      {
        name: 'name',
        selector: { text: {} },
      },
      {
        name: 'unit',
        selector: { text: {} },
      },
      {
        name: 'color',
        selector: { hex_color: { clearable: true } },
      },
      {
        name: 'state_adaptive_color',
        selector: { boolean: {} },
      },
      {
        name: 'aggregate_func',
        selector: {
          select: {
            options: [
              { label: 'Average', value: 'avg' },
              { label: 'Median', value: 'median' },
              { label: 'Minimum', value: 'min' },
              { label: 'Maximum', value: 'max' },
              { label: 'First', value: 'first' },
              { label: 'Last', value: 'last' },
              { label: 'Sum', value: 'sum' },
              { label: 'Delta', value: 'delta' },
              { label: 'Diff', value: 'diff' },
            ],
            mode: 'dropdown',
            translation_key: 'aggregate_func',
          },
        },
      },
    ],
  },
  {
    name: 'show',
    type: 'expandable',
    iconPath: mdiEye,
    flatten: true,
    schema: [
      {
        name: '',
        type: 'grid',
        schema: [
          {
            name: 'show_state',
            default: true,
            selector: { boolean: {} },
          },
          {
            name: 'show_indicator',
            selector: { boolean: {} },
          },
          {
            name: 'show_graph',
            default: true,
            selector: { boolean: {} },
          },
          {
            name: 'show_line',
            default: true,
            selector: { boolean: {} },
          },
          {
            name: 'show_fill',
            default: true,
            selector: { boolean: {} },
          },
          {
            name: 'show_points',
            default: true,
            selector: { boolean: {} },
          },
          {
            name: 'show_legend',
            default: true,
            selector: { boolean: {} },
          },
          {
            name: 'show_adaptive_color',
            selector: { boolean: {} },
          },
          {
            name: 'smoothing',
            default: true,
            selector: { boolean: {} },
          },
        ],
      },
    ],
  },
  {
    name: 'y_axis',
    selector: {
      select: {
        options: [
          { label: 'Primary', value: 'primary' },
          { label: 'Secondary', value: 'secondary' },
        ],
        translation_key: 'y_axis',
      },
    },
  },
];

const BOOLEANS = [
  'name',
  'icon',
  'legend',
  'average',
  'extrema',
  'name_adaptive_color',
  'icon_adaptive_color',
];

// Each of these is "off, on, or a whole object of settings" in yaml. The
// editor shows a switch; editor.js puts an existing object back untouched, so
// switching something else does not flatten a hand-written configuration.
const OBJECT_TOGGLES = [
  'statistics',
  'grid_x',
  'grid_y',
];

export {
  MAINSCHEMA,
  ENTITYSCHEMA,
  BOOLEANS,
  OBJECT_TOGGLES,
};
