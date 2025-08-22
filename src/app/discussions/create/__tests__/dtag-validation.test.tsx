/**
 * @jest-environment jsdom
 */

import { render, screen } from '@testing-library/react';

describe('dTag Validation Functions', () => {
  it('validates dTag pattern', () => {
    const dTagRegex = /^[a-zA-Z0-9_-]+$/;
    
    // Valid dTags
    expect(dTagRegex.test('test-discussion')).toBe(true);
    expect(dTagRegex.test('test_discussion')).toBe(true);
    expect(dTagRegex.test('test123')).toBe(true);
    expect(dTagRegex.test('123test')).toBe(true);
    
    // Invalid dTags
    expect(dTagRegex.test('test@discussion')).toBe(false);
    expect(dTagRegex.test('test discussion')).toBe(false);
    expect(dTagRegex.test('test.discussion')).toBe(false);
  });

  it('validates dTag length constraints', () => {
    const isValidLength = (dTag: string) => dTag.length >= 3 && dTag.length <= 50;
    
    expect(isValidLength('ab')).toBe(false); // too short
    expect(isValidLength('abc')).toBe(true); // min length
    expect(isValidLength('a'.repeat(50))).toBe(true); // max length
    expect(isValidLength('a'.repeat(51))).toBe(false); // too long
  });
});