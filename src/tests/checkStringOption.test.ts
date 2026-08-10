/**
 * Tests for checkStringOption().
 *
 * The file is disabled (renamed to *.dis) & thus is not used during a build process;
 * remove the "dis" extension to use it locally in your VSCode devcontainer.
 */

import { expect, describe, it, vi, afterEach } from 'vitest';
import { checkStringOption } from '../checkOption';
import { ALIGN_STATE, DEFAULT_ALIGN_STATE } from '../const';

const OPTION = 'align_state';

// log() -> console.warn
const mockWarn = () => vi.spyOn(console, 'warn').mockImplementation(() => { });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('checkStringOption', () => {

  [undefined, null].forEach((value) => {
    it(`checkStringOption: [${value}] -> a default value`, () => {
      const warn = mockWarn();
      expect(checkStringOption({ [OPTION]: value }, OPTION, ALIGN_STATE, DEFAULT_ALIGN_STATE))
        .toBe(DEFAULT_ALIGN_STATE);
      expect(warn).not.toHaveBeenCalled();
    });
  });

  it('checkStringOption: an option is not set -> a default value', () => {
    expect(checkStringOption({}, OPTION, ALIGN_STATE, DEFAULT_ALIGN_STATE))
      .toBe(DEFAULT_ALIGN_STATE);
  });

  ALIGN_STATE.forEach((value) => {
    it(`checkStringOption: an allowed value [${value}]`, () => {
      const warn = mockWarn();
      expect(checkStringOption({ [OPTION]: value }, OPTION, ALIGN_STATE, DEFAULT_ALIGN_STATE))
        .toBe(value);
      expect(warn).not.toHaveBeenCalled();
    });
  });

  ['LEFT', 'top', 'top_right', '', 123, ['left'], { left: true }].forEach((value) => {
    it(`checkStringOption: a not allowed value [${JSON.stringify(value)}] -> warns & a default`, () => {
      const warn = mockWarn();
      expect(checkStringOption({ [OPTION]: value }, OPTION, ALIGN_STATE, DEFAULT_ALIGN_STATE))
        .toBe(DEFAULT_ALIGN_STATE);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0].join(' ')).toContain(OPTION);
    });
  });
});
