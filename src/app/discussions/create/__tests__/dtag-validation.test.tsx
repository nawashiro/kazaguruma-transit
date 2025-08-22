/**
 * @jest-environment jsdom
 */

// Test utilities not used in this simple validation test

describe('dTag Validation Functions', () => {
  it('validates dTag pattern - lowercase letters, numbers, hyphens only', () => {
    const dTagRegex = /^[a-z0-9-]+$/;
    
    // Valid dTags (new spec: lowercase, numbers, hyphens only)
    expect(dTagRegex.test('test-discussion')).toBe(true);
    expect(dTagRegex.test('test123')).toBe(true);
    expect(dTagRegex.test('123test')).toBe(true);
    
    // Invalid dTags  
    expect(dTagRegex.test('test_discussion')).toBe(false); // underscore not allowed
    expect(dTagRegex.test('Test-Discussion')).toBe(false); // uppercase not allowed
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