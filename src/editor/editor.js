import { fireEvent } from 'custom-card-helpers';
import { LitElement, html } from 'lit-element';
import './components/entitiesEditor';
import './components/entityEditor';
import './components/mgc_list';
import { localize } from '../localize/localize';
import { MAINSCHEMA, BOOLEANS, OBJECT_TOGGLES } from './editorConst';
import { booleanToString, stringToBoolean } from './editorUtils';

class MiniGraphCardEditor extends LitElement {
  constructor() {
    super();
    // ha-form calls these as its own methods, so an unbound one would read the
    // form's hass rather than ours. Bind once: a fresh closure per render would
    // change identity every time & make ha-form re-render.
    this.computeLabel = this.computeLabel.bind(this);
    this.computeHelper = this.computeHelper.bind(this);
    this.localizeValue = this.localizeValue.bind(this);
  }

  static get properties() {
    return {
      hass: {},
      _config: {},
      subElementEditorConfig: {},
    };
  }

  setConfig(config) {
    this._config = config;
    this._entities = config.entities;
  }

  /**
   * Options that are a whole object in yaml but a plain switch here.
   *
   * "grid_x: true" and "grid_x: {interval: day, minor: 1}" both mean "on", and
   * only the first can be expressed as a toggle. So the toggle shows on, and
   * the object is put back untouched unless the user actually switches it off.
   */
  buildToggles(config) {
    const toggles = {};
    OBJECT_TOGGLES.forEach((key) => {
      if (config[key] !== undefined) {
        toggles[key] = !!config[key];
      }
    });
    return toggles;
  }

  restoreToggles(newConfig) {
    const restored = {};
    OBJECT_TOGGLES.forEach((key) => {
      const next = newConfig[key];
      if (next === true) {
        const previous = this._config[key];
        restored[key] = typeof previous === 'object' && previous !== null ? previous : true;
      } else if (next === false) {
        restored[key] = undefined;
      }
    });
    return restored;
  }

  valueChanged(ev) {
    ev.stopPropagation();
    const newConfig = ev.detail.value || '';
    const newShow = {};

    if (typeof newConfig.show !== 'undefined') {
      Object.keys(newConfig.show).forEach((key) => {
        if (typeof newConfig.show[key] !== 'undefined') {
          newShow[key] = stringToBoolean(newConfig.show[key]);
        }
      });
    }

    if (!this._config || !this.hass) {
      return;
    }

    fireEvent(this, 'config-changed', {
      config:
      {
        ...newConfig,
        ...this.restoreToggles(newConfig),
        show: Object.keys(newShow).length !== 0 ? newShow : undefined,
      },
    });
  }

  buildShowObject(showObject) {
    if (typeof showObject === 'undefined') {
      return undefined;
    }
    const show = {};
    Object.keys(showObject).forEach((key) => {
      if (!BOOLEANS.includes(key)) {
        show[key] = booleanToString(showObject[key]);
      } else {
        show[key] = showObject[key];
      }
    });
    return show;
  }

  entitiesChanged(ev) {
    ev.stopPropagation();
    if (!this._config || !this.hass) {
      return;
    }
    fireEvent(this, 'config-changed', { config: { ...this._config, entities: ev.detail } });
  }

  // Ask Home Assistant first: every option a stock card also has is already
  // translated into every language HA ships, in the user's own language.
  computeLabel(schema) {
    return this.hass.localize(`ui.panel.lovelace.editor.card.generic.${schema.name}`)
      || localize(this.hass, schema.name)
      || schema.name;
  }

  computeHelper(schema) {
    return localize(this.hass, `helpers.${schema.name}`);
  }

  localizeValue(key) {
    return localize(this.hass, `values.${key}`) || key;
  }

  render() {
    if (!this.hass || !this._config) {
      return html``;
    }

    if (this.subElementEditorConfig !== undefined) {
      return this.renderSubElement();
    }

    const SHOW = this._config.show;
    const DATA = {
      ...this._config,
      ...this.buildToggles(this._config),
      show: this.buildShowObject(SHOW),
    };

    return html`
    <div>
      <mini-graph-card-entities-editor
        .hass=${this.hass}
        .entities=${this._entities}
        @config-changed=${this.entitiesChanged}
        @edit-row=${this.editRow}
      ></mini-graph-card-entities-editor>
      <ha-form
        .hass=${this.hass}
        .data=${DATA}
        .schema=${MAINSCHEMA}
        .computeLabel=${this.computeLabel}
        .computeHelper=${this.computeHelper}
        .localizeValue=${this.localizeValue}
        @value-changed=${this.valueChanged}
      ></ha-form>
    </div>
    `;
  }

  goBack() {
    this.subElementEditorConfig = undefined;
  }

  renderSubElement() {
    switch (this.subElementEditorConfig.type) {
      case 'entity':
        return html`
        <mini-graph-card-entity-editor
          .hass=${this.hass}
          .config=${this._entities[this.subElementEditorConfig.index]}
          @go-back=${this.goBack}
          @config-changed=${this.subElementChanged}
        ></mini-graph-card-entity-editor>
        `;
      default:
        return html``;
    }
  }

  subElementChanged(ev) {
    ev.stopPropagation();
    if (!this._config || !this.hass) {
      return;
    }
    const index = this.subElementEditorConfig.index || 0;
    if (index !== undefined) {
      const configentities = [...this._entities];
      configentities[index] = ev.detail;
      fireEvent(this, 'config-changed', { config: { ...this._config, entities: configentities } });
    }
  }

  editRow(ev) {
    ev.stopPropagation();
    if (!this._config || !this.hass) {
      return;
    }
    const id = ev.detail;
    this.subElementEditorConfig = { type: 'entity', index: id };
  }
}

if (!customElements.get('mini-graph-card-editor')) {
  customElements.define('mini-graph-card-editor', MiniGraphCardEditor);
}
