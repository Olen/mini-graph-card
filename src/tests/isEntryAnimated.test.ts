/**
 * Tests for isEntryAnimated() and checkLineStyle().
 */

import {
  expect, describe, it, vi, afterEach,
} from 'vitest';
import { isEntryAnimated } from '../others';
import { checkLineStyle } from '../checkOption';

const config = (card: any, ...entities: any[]) => ({ ...card, entities });

describe('isEntryAnimated', () => {
  it('falls back to the card option when an entity says nothing', () => {
    expect(isEntryAnimated(config({ animate: true }, {}), 0)).toBe(true);
    expect(isEntryAnimated(config({ animate: false }, {}), 0)).toBe(false);
    expect(isEntryAnimated(config({}, {}), 0)).toBe(false);
  });

  it('lets an entity override the card in either direction', () => {
    expect(isEntryAnimated(config({ animate: false }, { animate: true }), 0)).toBe(true);
    expect(isEntryAnimated(config({ animate: true }, { animate: false }), 0)).toBe(false);
  });

  it('treats undefined and null as "not set", so the card decides', () => {
    expect(isEntryAnimated(config({ animate: true }, { animate: undefined }), 0)).toBe(true);
    expect(isEntryAnimated(config({ animate: true }, { animate: null }), 0)).toBe(true);
  });

  it('answers per entity, not per card', () => {
    const conf = config({ animate: true }, { animate: false }, {});
    expect(isEntryAnimated(conf, 0)).toBe(false);
    expect(isEntryAnimated(conf, 1)).toBe(true);
  });

  it('falls back to the card when the entity is not there', () => {
    expect(isEntryAnimated(config({ animate: true }), 5)).toBe(true);
    expect(isEntryAnimated({ animate: true } as any, 0)).toBe(true);
  });

  // "animate: yes" is a string once js-yaml is done with it, and a string is
  // not true - so it switches the animation off AND hides the card's own
  // setting. Documented here because nothing warns about it.
  it('accepts only a real boolean true', () => {
    expect(isEntryAnimated(config({}, { animate: 'yes' }), 0)).toBe(false);
    expect(isEntryAnimated(config({ animate: true }, { animate: 'yes' }), 0)).toBe(false);
    expect(isEntryAnimated(config({ animate: 'true' }, {}), 0)).toBe(false);
  });
});

describe('checkLineStyle', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  afterEach(() => warn.mockClear());

  it('warns when an animated entity also carries a line_style', () => {
    checkLineStyle(config({ animate: true }, { line_style: '5, 5' }));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0].join(' ')).toContain('line_style');
  });

  it('warns for a card-wide line_style too', () => {
    checkLineStyle(config({ animate: true, line_style: '5, 5' }, {}));
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('stays quiet when the entity is not animated', () => {
    checkLineStyle(config({ animate: false, line_style: '5, 5' }, {}));
    checkLineStyle(config({ animate: true }, { animate: false, line_style: '5, 5' }));
    expect(warn).not.toHaveBeenCalled();
  });

  it('stays quiet when there is no line_style to ignore', () => {
    checkLineStyle(config({ animate: true }, {}));
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns only about the entities which are animated', () => {
    checkLineStyle(config(
      { animate: false, line_style: '5, 5' },
      { animate: true }, {}, { animate: true },
    ));
    expect(warn).toHaveBeenCalledTimes(2);
  });
});
