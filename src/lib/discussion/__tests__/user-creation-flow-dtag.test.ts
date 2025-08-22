/**
 * @jest-environment node
 */

import {
  validateDiscussionCreationForm,
  createDiscussionCreationEvent,
  type DiscussionCreationForm,
} from '../user-creation-flow';

describe('User Creation Flow - dTag Support', () => {
  const baseForm: DiscussionCreationForm = {
    title: 'Test Discussion',
    description: 'Test Description',
    moderators: [],
  };

  describe('validateDiscussionCreationForm with dTag', () => {
    it('validates form without dTag', () => {
      const result = validateDiscussionCreationForm(baseForm);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('validates form with empty dTag', () => {
      const form = { ...baseForm, dTag: '' };
      const result = validateDiscussionCreationForm(form);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('validates form with valid dTag', () => {
      const form = { ...baseForm, dTag: 'test-discussion-2024' };
      const result = validateDiscussionCreationForm(form);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects dTag that is too short', () => {
      const form = { ...baseForm, dTag: 'ab' };
      const result = validateDiscussionCreationForm(form);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('IDは3文字以上50文字以内で入力してください');
    });

    it('rejects dTag that is too long', () => {
      const form = { ...baseForm, dTag: 'a'.repeat(51) };
      const result = validateDiscussionCreationForm(form);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('IDは3文字以上50文字以内で入力してください');
    });

    it('accepts dTag with valid characters', () => {
      const validDTags = [
        'abc123',
        'test-discussion',
        'test_discussion',
        'TEST-DISCUSSION-2024',
        'discussion_with_underscores',
        'discussion-with-hyphens',
        '123abc',
        'a1b2c3',
      ];

      validDTags.forEach(dTag => {
        const form = { ...baseForm, dTag };
        const result = validateDiscussionCreationForm(form);
        
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    it('rejects dTag with invalid characters', () => {
      const invalidDTags = [
        'test@discussion',
        'test discussion', // space
        'test.discussion', // dot
        'test+discussion', // plus
        'test#discussion', // hash
        'test&discussion', // ampersand
        'testディスカッション', // non-ASCII
        'test/discussion', // slash
      ];

      invalidDTags.forEach(dTag => {
        const form = { ...baseForm, dTag };
        const result = validateDiscussionCreationForm(form);
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('IDは英数字、ハイフン、アンダースコアのみ使用できます');
      });
    });

    it('accepts dTag at boundary lengths', () => {
      // 3文字（最小）
      const minForm = { ...baseForm, dTag: 'abc' };
      const minResult = validateDiscussionCreationForm(minForm);
      expect(minResult.isValid).toBe(true);

      // 50文字（最大）
      const maxForm = { ...baseForm, dTag: 'a'.repeat(50) };
      const maxResult = validateDiscussionCreationForm(maxForm);
      expect(maxResult.isValid).toBe(true);
    });
  });

  describe('createDiscussionCreationEvent with dTag', () => {
    it('uses provided dTag when specified', () => {
      const form = { ...baseForm, dTag: 'custom-discussion-id' };
      const event = createDiscussionCreationEvent(form, 'test-pubkey');
      
      const dTag = event.tags?.find(tag => tag[0] === 'd')?.[1];
      expect(dTag).toBe('custom-discussion-id');
    });

    it('generates automatic dTag when not specified', () => {
      const event = createDiscussionCreationEvent(baseForm, 'test-pubkey');
      
      const dTag = event.tags?.find(tag => tag[0] === 'd')?.[1];
      expect(dTag).toBeDefined();
      expect(typeof dTag).toBe('string');
      expect(dTag!.length).toBeGreaterThan(0);
    });

    it('generates automatic dTag when empty string provided', () => {
      const form = { ...baseForm, dTag: '' };
      const event = createDiscussionCreationEvent(form, 'test-pubkey');
      
      const dTag = event.tags?.find(tag => tag[0] === 'd')?.[1];
      expect(dTag).toBeDefined();
      expect(typeof dTag).toBe('string');
      expect(dTag!.length).toBeGreaterThan(0);
    });

    it('generates automatic dTag when whitespace-only string provided', () => {
      const form = { ...baseForm, dTag: '   ' };
      const event = createDiscussionCreationEvent(form, 'test-pubkey');
      
      const dTag = event.tags?.find(tag => tag[0] === 'd')?.[1];
      expect(dTag).toBeDefined();
      expect(typeof dTag).toBe('string');
      expect(dTag!.length).toBeGreaterThan(0);
      expect(dTag).not.toBe('   ');
    });

    it('trims whitespace from provided dTag', () => {
      const form = { ...baseForm, dTag: '  custom-id  ' };
      const event = createDiscussionCreationEvent(form, 'test-pubkey');
      
      const dTag = event.tags?.find(tag => tag[0] === 'd')?.[1];
      expect(dTag).toBe('custom-id');
    });
  });
});