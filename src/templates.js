import { log } from './utils';

/**
 * Whether a value is a Jinja template rather than a literal.
 * @param {any} value
 * @returns {boolean}
 */
const isTemplate = value => typeof value === 'string' && /\{[%{]/.test(value);

/**
 * Keeps Home Assistant "render_template" subscriptions in step with the
 * templates a card currently uses. HA renders them & pushes a new result
 * whenever anything a template reads changes, so nothing is polled here.
 */
class TemplateSubscriber {
  /**
   * @param {Function} onUpdate Called after a result changes
   */
  constructor(onUpdate) {
    this._onUpdate = onUpdate;
    this._subs = new Map();
    this.results = {};
  }

  /**
   * Subscribe to what is new, drop what is gone or has been edited.
   * @param {object} hass
   * @param {object} templates Template string per key
   */
  sync(hass, templates) {
    [...this._subs.keys()].forEach((key) => {
      if (templates[key] !== this._subs.get(key).template) this._unsubscribe(key);
    });
    if (!hass || !hass.connection) return;
    Object.keys(templates).forEach((key) => {
      if (!this._subs.has(key)) this._subscribe(hass, key, templates[key]);
    });
  }

  _subscribe(hass, key, template) {
    // Held before the subscription resolves, so an unsubscribe that lands
    // first is not lost - it would leave a subscription nothing can cancel
    const sub = { template, unsub: undefined, closed: false };
    this._subs.set(key, sub);

    hass.connection.subscribeMessage(
      (msg) => {
        if (this.results[key] === msg.result) return;
        this.results[key] = msg.result;
        this._onUpdate();
      },
      { type: 'render_template', template },
    ).then((unsub) => {
      if (sub.closed) {
        unsub();
        return;
      }
      sub.unsub = unsub;
    }).catch((err) => {
      // An invalid template is the user's to fix; show it as empty & say why
      log(`Could not render template [${template}]: ${err && err.message || err}`);
      this.results[key] = '';
      this._onUpdate();
    });
  }

  _unsubscribe(key) {
    const sub = this._subs.get(key);
    if (!sub) return;
    sub.closed = true;
    if (sub.unsub) sub.unsub();
    this._subs.delete(key);
    delete this.results[key];
  }

  /** Drop every subscription, e.g. when the card leaves the document. */
  destroy() {
    [...this._subs.keys()].forEach(key => this._unsubscribe(key));
  }
}

export { isTemplate, TemplateSubscriber };
