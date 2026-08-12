import { mdiClose } from '@mdi/js';
import { fireEvent } from 'custom-card-helpers';
import { css, html, LitElement } from 'lit-element';
import { isValidHex, convertColorNameToHex } from '../editorUtils';

// What an <input type="color"> can stand for: a hex value, or a plain CSS
// colour name that the canvas trick can turn into one. Notably NOT
// "rgba(...)", which has an alpha channel a swatch cannot show, and not
// "var(--x)", whose value is not known until the card renders.
const isSwatchable = value => !value
  || /^#[0-9a-f]{3,8}$/i.test(value)
  || /^[a-z]+$/i.test(value);

export const colorSelector = {
  hex_color: {},
};

export class CustomColorSelector extends LitElement {
  static get properties() {
    return {
      hass: { attribute: false },
      selector: { attribute: false },
      value: {},
      label: {},
    };
  }

  render() {
    // A colour this control cannot represent is shown as text rather than
    // drawn as black: the card accepts any CSS colour, and silently turning
    // "var(--accent-color)" into #000000 on the first click loses it.
    if (!isSwatchable(this.value)) {
      return html`
      <div class="color-container">
        <label id="hex" for="color-text">
          <span class="label">${this.label}</span>
          <input class="free-text"
            id="color-text"
            type="text"
            .value=${this.value || ''}
            @change=${this.textChanged}>
        </label>
      </div>
      `;
    }

    const isHex = isValidHex(this.value);
    const colorValue = isHex ? this.value : convertColorNameToHex(this.value);
    return html`
    <div class="color-container">
      <label id="hex" for="color-input">
        <span class="label">${this.label}</span>
        <span class="input-wrapper">
          <div class="overflow">
            <input class=${this.value ? '' : 'empty'}
              id="color-input"
              @input=${this.valueChanged}
              type="color"
              .value=${colorValue || '#000000'}>
          </div>
        </span>
        </label>
        ${this.selector.hex_color.clearable ? html`
          <ha-icon-button
          class="clear-button"
          .label=${this.hass.localize('ui.common.clear')}
          .path=${mdiClose}
          @click=${this.clearValue}
          ><ha-icon-button>
        ` : html``}
    </div>
    `;
  }

  textChanged(ev) {
    fireEvent(this, 'value-changed', { value: ev.target.value || undefined });
  }

  valueChanged(ev) {
    const value = (ev.target).value || '#000000';
    fireEvent(this, 'value-changed', { value });
  }

  clearValue() {
    fireEvent(this, 'value-changed', { value: undefined });
  }

  static get styles() {
    return css`
      #hex {
        display: flex;
        align-items: center;
        margin: 4px 0px;
        flex: 1;
      }

      .input-wrapper {
        width: 48px;
        height: 48px;
        box-sizing: border-box;
        border: 1px solid var(--outline-color);
        position: relative;
        border-radius: 50%;
      }

      #hex:hover .input-wrapper {
        border: 2px solid var(--outline-color);
      }

      .label {
        font-family: var(--mdc-typography-body2-font-family, var(--mdc-typography-font-family, Roboto, sans-serif));
        color: var(--mdc-theme-text-primary-on-background, rgba(0, 0, 0, .87));
        font-size: 1em;
        line-height: var(--mdc-typography-body2-line-height, 1.25rem);
        font-weight: var(--mdc-typography-body2-font-weight, 400);
        flex-grow: 1;
        padding-inline-start: 4px;
      }

      .overflow {
        width: 100%;
        height: 100%;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: inherit;
      }

      #hex input[type="color"] {
        min-width: 200%;
        min-height: 200%;
      }

      #hex .empty::before {
        background:
          repeating-conic-gradient(
           var(--secondary-background-color) 0 90deg,
          var(--disabled-text-color) 0 180deg)
          0 0/40px 40px round;
        content: '';
        min-width: 200%;
        min-height: 200%;
        display: block;
      }

      .color-container {
        display: flex;
        align-items: center;
      }

      .free-text {
        flex: 1;
        min-width: 0;
        font-family: inherit;
        font-size: 1em;
        padding: 8px;
        color: var(--primary-text-color);
        background: var(--secondary-background-color);
        border: 1px solid var(--outline-color);
        border-radius: 4px;
      }

      .clear-button {
        --mdc-icon-size: 20px;
        color: var(--input-dropdown-icon-color);
      }
    `;
  }
}

customElements.define('ha-selector-hex_color', CustomColorSelector);
