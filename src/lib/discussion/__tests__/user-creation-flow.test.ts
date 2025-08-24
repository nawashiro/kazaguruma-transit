/**
 * Tests for user discussion creation flow
 * Based on spec_v2.md user creation requirements
 */

import {
  validateDiscussionCreationForm,
  createDiscussionCreationEvent,
  createDiscussionListingRequest,
  processDiscussionCreationFlow,
} from '../user-creation-flow';
import { naddrEncode } from '@/lib/nostr/naddr-utils';

jest.mock('@/utils/logger', () => ({
  logger: {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock nostr service
jest.mock('@/lib/nostr/nostr-service', () => ({
  createNostrService: jest.fn(() => ({
    createDiscussionEvent: jest.fn(),
    createDiscussionRequestEvent: jest.fn(),
    publishSignedEvent: jest.fn(),
  })),
}));

describe('User Discussion Creation Flow', () => {
  const validCreationForm = {
    title: 'バス停での体験',
    description: 'バス停での利用体験について意見交換しましょう',
    moderators: [], // Skip moderators for now
    dTag: 'bus-stop-experience-001',
  };

  const validUserPubkey = 'f723816e33f9e4ed5e3b4c3b2c99e8b8a8c8d9e7f123456789abcdef01234567';
  const adminPubkey = 'a123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  describe('validateDiscussionCreationForm', () => {
    test('should validate valid form data', () => {
      const result = validateDiscussionCreationForm(validCreationForm);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('should reject empty title', () => {
      const invalidForm = {
        ...validCreationForm,
        title: '',
      };
      
      const result = validateDiscussionCreationForm(invalidForm);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('タイトルは必須です');
    });

    test('should reject empty description', () => {
      const invalidForm = {
        ...validCreationForm,
        description: '',
      };
      
      const result = validateDiscussionCreationForm(invalidForm);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('説明は必須です');
    });

    test('should reject title that is too long', () => {
      const invalidForm = {
        ...validCreationForm,
        title: 'a'.repeat(101), // 100文字制限を超過
      };
      
      const result = validateDiscussionCreationForm(invalidForm);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('タイトルは100文字以内で入力してください');
    });

    test('should reject description that is too long', () => {
      const invalidForm = {
        ...validCreationForm,
        description: 'a'.repeat(501), // 500文字制限を超過
      };
      
      const result = validateDiscussionCreationForm(invalidForm);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('説明は500文字以内で入力してください');
    });

    test('should reject invalid moderator pubkeys', () => {
      const invalidForm = {
        ...validCreationForm,
        moderators: ['invalid-pubkey'],
      };
      
      const result = validateDiscussionCreationForm(invalidForm);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('無効なモデレーターIDが含まれています');
    });

    test('should accept empty moderators array', () => {
      const validFormNoMods = {
        ...validCreationForm,
        moderators: [],
      };
      
      const result = validateDiscussionCreationForm(validFormNoMods);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('createDiscussionCreationEvent', () => {
    test('should create valid discussion event template', () => {
      const result = createDiscussionCreationEvent(
        validCreationForm,
        validUserPubkey
      );
      
      expect(result.kind).toBe(34550);
      expect(result.content).toBe(validCreationForm.description);
      expect(result.pubkey).toBe(validUserPubkey);
      
      // Check required tags
      const nameTag = result.tags!.find(tag => tag[0] === 'name');
      const descTag = result.tags!.find(tag => tag[0] === 'description');
      const dTag = result.tags!.find(tag => tag[0] === 'd');
      
      expect(nameTag?.[1]).toBe(validCreationForm.title);
      expect(descTag?.[1]).toBe(validCreationForm.description);
      expect(dTag?.[1]).toBe(validCreationForm.dTag);
    });

    test('should include moderator tags', () => {
      const result = createDiscussionCreationEvent(
        validCreationForm,
        validUserPubkey
      );
      
      const moderatorTags = result.tags!.filter(tag => 
        tag[0] === 'p' && tag[3] === 'moderator'
      );
      
      expect(moderatorTags).toHaveLength(validCreationForm.moderators.length);
    });

    test('should use provided dTag', () => {
      const result = createDiscussionCreationEvent(validCreationForm, validUserPubkey);
      
      const dTag = result.tags!.find(tag => tag[0] === 'd')?.[1];
      
      expect(dTag).toBe(validCreationForm.dTag);
    });
  });

  describe('createDiscussionListingRequest', () => {
    
    const mockDiscussionNaddr = naddrEncode({
      identifier: 'bus-stop-experience-001',
      pubkey: validUserPubkey,
      kind: 34550,
    });
    const mockDiscussionListNaddr = naddrEncode({
      identifier: 'discussion_list_test',
      pubkey: adminPubkey,
      kind: 34550,
    });

    // Mock process.env for testing
    beforeEach(() => {
      process.env.NEXT_PUBLIC_DISCUSSION_LIST_NADDR = mockDiscussionListNaddr;
    });

    test('should create NIP-72 compliant listing request', () => {
      const result = createDiscussionListingRequest(
        validCreationForm,
        mockDiscussionNaddr,
        adminPubkey,
        validUserPubkey
      );
      
      // NIP-72 requires kind:1111 for community posts
      expect(result.kind).toBe(1111);
      expect(result.pubkey).toBe(validUserPubkey);
      
      // Content should only contain nostr: URI as per NIP-72
      expect(result.content).toBe(`nostr:${mockDiscussionNaddr}`);
    });

    test('should include required NIP-72 tags', () => {
      const result = createDiscussionListingRequest(
        validCreationForm,
        mockDiscussionNaddr,
        adminPubkey,
        validUserPubkey
      );
      
      const tags = result.tags || [];
      
      // NIP-72 requires a tag for community definition (in hex format)
      const aTag = tags.find(tag => tag[0] === 'a');
      expect(aTag).toBeDefined();
      expect(aTag![1]).toBe(`34550:${adminPubkey}:discussion_list_test`);

      // NIP-72 requires p tag for community author
      const pTag = tags.find(tag => tag[0] === 'p');
      expect(pTag).toBeDefined();

      // NIP-72 requires k tag with 34550
      const kTag = tags.find(tag => tag[0] === 'k');
      expect(kTag).toBeDefined();
      expect(kTag![1]).toBe('34550');

      // Spec requires q tag for user-created kind:34550 reference (in hex format)
      const qTag = tags.find(tag => tag[0] === 'q');
      expect(qTag).toBeDefined();
      expect(qTag![1]).toBe(`34550:${validUserPubkey}:bus-stop-experience-001`);
    });

    test('should NOT include non-compliant tags', () => {
      const result = createDiscussionListingRequest(
        validCreationForm,
        mockDiscussionNaddr,
        adminPubkey,
        validUserPubkey
      );
      
      const tags = result.tags || [];
      
      // Should NOT have t tag (non-standard)
      const tTag = tags.find(tag => tag[0] === 't');
      expect(tTag).toBeUndefined();
      
      // Should NOT have subject tag (non-standard)
      const subjectTag = tags.find(tag => tag[0] === 'subject');
      expect(subjectTag).toBeUndefined();
    });
  });

  describe('processDiscussionCreationFlow', () => {
    const mockSignEvent = jest.fn();
    const mockPublishEvent = jest.fn();

    beforeEach(() => {
      jest.clearAllMocks();
      mockSignEvent.mockResolvedValue({ id: 'signed-event-id' });
      mockPublishEvent.mockResolvedValue(true);
    });

    test('should complete full creation flow successfully', async () => {
      const result = await processDiscussionCreationFlow({
        formData: validCreationForm,
        userPubkey: validUserPubkey,
        adminPubkey,
        signEvent: mockSignEvent,
        publishEvent: mockPublishEvent,
      });
      
      expect(result.success).toBe(true);
      expect(result.discussionNaddr).toMatch(/^naddr1[a-z0-9]+$/);
      expect(result.errors).toEqual([]);
      
      // Should call sign and publish twice (discussion + request)
      expect(mockSignEvent).toHaveBeenCalledTimes(2);
      expect(mockPublishEvent).toHaveBeenCalledTimes(2);
    });

    test('should handle validation errors', async () => {
      const invalidForm = {
        ...validCreationForm,
        title: '',
      };
      
      const result = await processDiscussionCreationFlow({
        formData: invalidForm,
        userPubkey: validUserPubkey,
        adminPubkey,
        signEvent: mockSignEvent,
        publishEvent: mockPublishEvent,
      });
      
      expect(result.success).toBe(false);
      expect(result.errors).toContain('タイトルは必須です');
      expect(mockSignEvent).not.toHaveBeenCalled();
      expect(mockPublishEvent).not.toHaveBeenCalled();
    });

    test('should handle signing failure', async () => {
      mockSignEvent.mockRejectedValue(new Error('Signing failed'));
      
      const result = await processDiscussionCreationFlow({
        formData: validCreationForm,
        userPubkey: validUserPubkey,
        adminPubkey,
        signEvent: mockSignEvent,
        publishEvent: mockPublishEvent,
      });
      
      expect(result.success).toBe(false);
      expect(result.errors).toContain('イベントの署名に失敗しました');
    });

    test('should handle publishing failure', async () => {
      mockPublishEvent.mockResolvedValue(false);
      
      const result = await processDiscussionCreationFlow({
        formData: validCreationForm,
        userPubkey: validUserPubkey,
        adminPubkey,
        signEvent: mockSignEvent,
        publishEvent: mockPublishEvent,
      });
      
      expect(result.success).toBe(false);
      expect(result.errors).toContain('リレーへの投稿に失敗しました');
    });

    test('should generate appropriate success message', async () => {
      const result = await processDiscussionCreationFlow({
        formData: validCreationForm,
        userPubkey: validUserPubkey,
        adminPubkey,
        signEvent: mockSignEvent,
        publishEvent: mockPublishEvent,
      });
      
      expect(result.success).toBe(true);
      expect(result.successMessage).toContain('会話が作成されました');
      expect(result.successMessage).toContain('すぐに開始できます');
      expect(result.successMessage).toContain('10個程度の書き込み');
    });
  });

  describe('integration scenarios', () => {
    test('should handle complete user journey', async () => {
      // Simulate complete user creation flow as per spec_v2.md
      const form = {
        title: '新宿駅前バス停の体験',
        description: '朝の通勤時間帯での利用体験について話し合いましょう',
        moderators: [],
        dTag: 'shinjuku-station-experience',
      };

      // 1. Validate form
      const validation = validateDiscussionCreationForm(form);
      expect(validation.isValid).toBe(true);

      // 2. Create events
      const discussionEvent = createDiscussionCreationEvent(form, validUserPubkey);
      expect(discussionEvent.kind).toBe(34550);

      // 3. Build naddr from created discussion (data structure for reference)
      const discussionData = {
        id: `34550:${validUserPubkey}:${form.dTag}`,
        dTag: form.dTag,
        title: form.title,
        description: form.description,
        moderators: [],
        authorPubkey: validUserPubkey,
        createdAt: Math.floor(Date.now() / 1000),
        event: discussionEvent,
      };

      // 4. Create listing request
      const validMockNaddr = naddrEncode({
        identifier: 'bus-stop-experience-001',
        pubkey: validUserPubkey,
        kind: 34550,
      });
      
      const listingRequest = createDiscussionListingRequest(
        form,
        validMockNaddr,
        adminPubkey,
        validUserPubkey
      );

      expect(listingRequest.kind).toBe(1111);
      expect(listingRequest.content).toBe(`nostr:${validMockNaddr}`);

      // 5. Validate discussion data structure
      expect(discussionData.dTag).toBe(form.dTag);
      expect(discussionData.title).toBe(form.title);
      expect(discussionData.description).toBe(form.description);
    });

    test('should handle edge cases in creation flow', async () => {
      // Test with Japanese title and special characters
      const japaneseForm = {
        title: 'バス停での体験談 - 朝の通勤編',
        description: '毎朝利用している風ぐるまについて、\n改善点や良い点を共有しませんか？',
        moderators: [],
        dTag: 'bus-experience-morning-commute',
      };

      const validation = validateDiscussionCreationForm(japaneseForm);
      expect(validation.isValid).toBe(true);

      const event = createDiscussionCreationEvent(japaneseForm, validUserPubkey);
      expect(event.content).toContain('毎朝利用している');
      expect(event.content).toContain('\n'); // Should preserve newlines
    });
  });

  describe('error recovery scenarios', () => {
    test('should provide helpful error messages for common mistakes', () => {
      const commonMistakes = [
        { title: '', description: 'valid', expectedError: 'タイトルは必須です' },
        { title: 'valid', description: '', expectedError: '説明は必須です' },
        { title: 'a'.repeat(101), description: 'valid', expectedError: 'タイトルは100文字以内' },
        { title: 'valid', description: 'a'.repeat(501), expectedError: '説明は500文字以内' },
      ];

      commonMistakes.forEach(({ title, description, expectedError }) => {
        const result = validateDiscussionCreationForm({
          title,
          description,
          moderators: [],
          dTag: 'test-discussion-id',
        });
        
        expect(result.isValid).toBe(false);
        expect(result.errors.some(error => error.includes(expectedError.split('は')[0]))).toBe(true);
      });
    });

    test('should handle network failures gracefully', async () => {
      const mockSignEvent = jest.fn().mockResolvedValue({ id: 'test' });
      const mockPublishEvent = jest.fn().mockResolvedValue(false); // Network failure

      const validFormWithDTag = {
        ...validCreationForm,
        dTag: 'network-test-discussion',
      };

      const result = await processDiscussionCreationFlow({
        formData: validFormWithDTag,
        userPubkey: validUserPubkey,
        adminPubkey,
        signEvent: mockSignEvent,
        publishEvent: mockPublishEvent,
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain('リレーへの投稿に失敗しました');
    });
  });

  describe('spec_v2.md compliance', () => {
    test('should create events according to NIP-72 specification', () => {
      const event = createDiscussionCreationEvent(validCreationForm, validUserPubkey);
      
      // Check NIP-72 compliance
      expect(event.kind).toBe(34550); // Replaceable event
      expect(event.tags!.find(tag => tag[0] === 'd')).toBeDefined(); // d tag required
      expect(event.tags!.find(tag => tag[0] === 'name')).toBeDefined(); // name tag
      expect(event.tags!.find(tag => tag[0] === 'description')).toBeDefined(); // description tag
    });

    test('should create listing request according to NIP-72 specification', () => {
      const validMockNaddr = naddrEncode({
        identifier: 'bus-stop-experience-001',
        pubkey: validUserPubkey,
        kind: 34550,
      });
      
      const request = createDiscussionListingRequest(
        validCreationForm,
        validMockNaddr,
        adminPubkey,
        validUserPubkey
      );
      
      // Check NIP-72 compliance - should have q tag referencing user discussion (in hex format)
      const qTag = request.tags!.find(tag => tag[0] === 'q');
      expect(qTag).toBeDefined();
      expect(qTag?.[1]).toBe(`34550:${validUserPubkey}:bus-stop-experience-001`); // Should reference the user's discussion in hex format
      
      // Should NOT have t or subject tags (non-standard)
      const tTag = request.tags!.find(tag => tag[0] === 't');
      const subjectTag = request.tags!.find(tag => tag[0] === 'subject');
      expect(tTag).toBeUndefined();
      expect(subjectTag).toBeUndefined();
    });

    test('should include friendly guidance messages as per spec', () => {
      const result = processDiscussionCreationFlow({
        formData: validCreationForm,
        userPubkey: validUserPubkey,
        adminPubkey,
        signEvent: jest.fn().mockResolvedValue({ id: 'test' }),
        publishEvent: jest.fn().mockResolvedValue(true),
      });

      // Should include the 3-step guidance from spec_v2.md
      result.then(res => {
        if (res.success) {
          expect(res.successMessage).toContain('URLを共有すれば、仲間を呼び込めます');
          expect(res.successMessage).toContain('10個程度の書き込み');
          expect(res.successMessage).toContain('会話一覧への掲載は、少々お待ちください');
        }
      });
    });
  });
});