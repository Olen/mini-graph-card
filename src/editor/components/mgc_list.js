import { mdiPlus, mdiClose } from '@mdi/js';
import { fireEvent } from 'custom-card-helpers';
import { LitElement, css, html } from 'lit-element';
import { localize } from '../../localize/localize';

class MGCList extends LitElement {
  constructor() {
    super();
    this.computeLabel = this.computeLabel.bind(this);
  }

  static get properties() {
    return {
      hass: { attribute: false },
      data: { attribute: false },
      schema: { attribute: false },
    };
  }

  computeLabel(schema) {
    return this.hass.localize(`ui.panel.lovelace.editor.card.generic.${schema.name}`)
      || localize(this.hass, schema.name)
      || schema.name;
  }

  render() {
    if (!this.data) {
      return html`
      <div>
        <ha-icon-button
          .label=${this.hass.localize('ui.common.add')}
          .path=${mdiPlus}
          @click=${this.addRow}
        ></ha-icon-button>
        </div>
      <div>
      `;
    }

    return html`
      <div>
        <ha-icon-button
          .label=${this.hass.localize('ui.common.add')}
          .path=${mdiPlus}
          @click=${this.addRow}
        ></ha-icon-button>
        </div>
      <div>
      ${this.data.map((row, index) => html`
        <div class="list-entry">
        <ha-form
          .hass=${this.hass}
          .data=${row}
          .schema=${this.schema.schema}
          .index=${index}
          .computeLabel=${this.computeLabel}
          @value-changed=${this.valueChanged}
        ></ha-form>
        <ha-icon-button
          .label=${this.hass.localize('ui.common.clear')}
          .path=${mdiClose}
          .index=${index}
          @click=${this.removeRow}
        ></ha-icon-button>
        </div>
        `)}
      </div>
    `;
  }

  valueChanged(ev) {
    ev.stopPropagation();
    if (!this.data || !this.hass) {
      return;
    }
    const value = ev.detail.value || '';
    const index = (ev.target).index || 0;
    const newListValue = this.data.concat();

    newListValue[index] = value;

    fireEvent(this, 'value-changed', { value: newListValue });
  }

  addRow(ev) {
    ev.stopPropagation();
    const value = {};
    if (!this.data) {
      fireEvent(this, 'value-changed', { value: [value] });
      return;
    }

    fireEvent(this, 'value-changed', { value: [...this.data, value] });
  }

  removeRow(ev) {
    ev.stopPropagation();
    if (!this.data || !this.hass) {
      return;
    }
    const index = (ev.currentTarget).index || 0;
    const newListValue = this.data.concat();

    newListValue.splice(index, 1);

    fireEvent(this, 'value-changed', { value: newListValue });
  }

  static get styles() {
    return css`
    .list-entry {
      display: flex;
      align-items: center;
      margin-bottom: 8px;
    }
    .list-entry ha-form {
      flex-grow: 1;
    }
    `;
  }
}

if (!customElements.get('ha-form-mgc-list')) {
  customElements.define('ha-form-mgc-list', MGCList);
}
