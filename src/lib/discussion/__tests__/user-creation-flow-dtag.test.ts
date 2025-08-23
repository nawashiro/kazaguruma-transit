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
    dTag: 'test-discussion', // dTag is now required
  };

  describe('validateDiscussionCreationForm with dTag', () => {
    it('rejects form without dTag', () => {
      const formWithoutDTag = {
        title: 'Test Discussion',
        description: 'Test Description',
        moderators: [],
        // dTag is missing
      } as DiscussionCreationForm;
      
      const result = validateDiscussionCreationForm(formWithoutDTag);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('IDは必須です');
    });

    it('rejects form with empty dTag', () => {
      const form = { ...baseForm, dTag: '' };
      const result = validateDiscussionCreationForm(form);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('IDは必須です');
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
      expect(result.errors).toContain('IDは3文字以上100文字以内で入力してください');
    });

    it('rejects dTag that is too long', () => {
      const form = { ...baseForm, dTag: 'a'.repeat(101) };
      const result = validateDiscussionCreationForm(form);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('IDは3文字以上100文字以内で入力してください');
    });

    it('accepts dTag with valid characters', () => {
      const validDTags = [
        'abc123',
        'test-discussion',
        'discussion-with-hyphens',
        '123abc',
        'a1b2c3',
        'my-discussion-2024',
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
        'TEST-DISCUSSION', // uppercase letters
        'test_discussion', // underscore
      ];

      invalidDTags.forEach(dTag => {
        const form = { ...baseForm, dTag };
        const result = validateDiscussionCreationForm(form);
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('IDは小文字英数字、ハイフンのみ使用できます');
      });
    });

    it('accepts dTag at boundary lengths', () => {
      // 3文字（最小）
      const minForm = { ...baseForm, dTag: 'abc' };
      const minResult = validateDiscussionCreationForm(minForm);
      expect(minResult.isValid).toBe(true);

      // 100文字（最大）
      const maxForm = { ...baseForm, dTag: 'a'.repeat(100) };
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

    it('uses dTag from baseForm when creating event', () => {
      const event = createDiscussionCreationEvent(baseForm, 'test-pubkey');
      
      const dTag = event.tags?.find(tag => tag[0] === 'd')?.[1];
      expect(dTag).toBe('test-discussion');
    });

    it('uses trimmed dTag when provided with whitespace', () => {
      const form = { ...baseForm, dTag: '  custom-id  ' };
      const event = createDiscussionCreationEvent(form, 'test-pubkey');
      
      const dTag = event.tags?.find(tag => tag[0] === 'd')?.[1];
      expect(dTag).toBe('custom-id');
    });
  });
});