import en from './languages/en.json';
import de from './languages/de.json';

const LANGUAGES = {
  en,
  de,
};

const DEFAULT_LANG = 'en';

// "de-CH" and "de" mean the same file to us.
const languageOf = hass => (hass && hass.locale && hass.locale.language
  ? hass.locale.language.split('-')[0]
  : DEFAULT_LANG);

const lookup = (obj, key) => key.split('.')
  .reduce((node, part) => (node ? node[part] : undefined), obj);

/**
 * The card's own strings, for the options Home Assistant knows nothing about.
 *
 * Home Assistant has no public way for a custom card to add translations
 * (home-assistant/frontend#6482), and the private one is to write into
 * `hass.resources` - the frontend's own store, shared by every panel. Reading
 * from our bundle instead keeps the card out of hass entirely.
 *
 * It costs nothing: computeLabel still asks Home Assistant first, so every
 * option a stock card also has stays translated into every language HA ships.
 *
 * Returns '' for a key we do not have, so callers can fall back with `||`.
 */
const localize = (hass, key) => lookup(LANGUAGES[languageOf(hass)], key)
  || lookup(LANGUAGES[DEFAULT_LANG], key)
  || '';

export default localize;
export { localize };
