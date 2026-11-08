/**
 * Tests for isTextState() - a state shown as Home Assistant words it, not as a number.
 */
import { describe, it, expect } from 'vitest';
import { isTextState } from '../others';

describe('isTextState', () => {
  it('is true for a word', () => {
    expect(isTextState('off')).toBe(true);
    expect(isTextState('heat_cool')).toBe(true);
  });

  it('is false for a number, also with a decimal comma', () => {
    expect(isTextState('21.5')).toBe(false);
    expect(isTextState('21,5')).toBe(false);
    expect(isTextState(21.5)).toBe(false);
  });
});
