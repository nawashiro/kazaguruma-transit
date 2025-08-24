/**
 * TDD tests for displaying Kind:34550 details from q tag references
 * spec_v2.md requirement: Discussion management page should display Kind:34550 referenced by q tags
 */

// Mock utilities first
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
    getEventByNaddr: jest.fn(),
  })),
}));

import { fetchDiscussionDetails, enhanceDiscussionsWithDetails } from '../discussion-enhancement';
import type { ProcessedDiscussion } from '../discussion-processing';
import { createNostrService } from '@/lib/nostr/nostr-service';

describe('Kind:34550 Display from Q Tag References', () => {
  const mockProcessedDiscussion: ProcessedDiscussion = {
    communityPostId: 'post1',
    userDiscussionNaddr: '34550:user1-pubkey:user_discussion_1',
    authorPubkey: 'user1-pubkey',
    createdAt: Math.floor(Date.now() / 1000),
    isApproved: false,
  };

  const mockKind34550Event = {
    id: 'discussion1',
    kind: 34550,
    pubkey: 'user1-pubkey',
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['d', 'user_discussion_1'],
      ['name', 'バス停での体験談'],
      ['description', 'バス停での利用体験について意見交換しましょう'],
    ],
    content: 'バス停での利用体験について意見交換しましょう',
    sig: 'signature',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should fetch Kind:34550 details from hex ID', async () => {
    const mockCreateNostrService = createNostrService as jest.MockedFunction<typeof createNostrService>;
    const mockService = mockCreateNostrService.mock.results[0]?.value || mockCreateNostrService({} as any);
    mockService.getEventByNaddr.mockResolvedValue(mockKind34550Event);
    const result = await fetchDiscussionDetails('34550:user1-pubkey:user_discussion_1');

    // Should return discussion details structure
    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('dTag');
    expect(result).toHaveProperty('title');
    expect(result).toHaveProperty('description');
    expect(result).toHaveProperty('authorPubkey');
    expect(result).toHaveProperty('createdAt');
    expect(typeof result.title).toBe('string');
    expect(typeof result.description).toBe('string');
  });

  test('should enhance processed discussions with Kind:34550 details', async () => {
    const mockCreateNostrService = createNostrService as jest.MockedFunction<typeof createNostrService>;
    const mockService = mockCreateNostrService.mock.results[0]?.value || mockCreateNostrService({} as any);
    mockService.getEventByNaddr.mockResolvedValue(mockKind34550Event);
    const enhanced = await enhanceDiscussionsWithDetails([mockProcessedDiscussion]);

    expect(enhanced).toHaveLength(1);
    expect(enhanced[0]).toHaveProperty('discussionDetails');
    expect(enhanced[0].discussionDetails).toHaveProperty('title');
    expect(enhanced[0].discussionDetails).toHaveProperty('description');
  });

  test('should handle missing Kind:34550 events gracefully', async () => {
    const mockCreateNostrService = createNostrService as jest.MockedFunction<typeof createNostrService>;
    const mockService = mockCreateNostrService.mock.results[0]?.value || mockCreateNostrService({} as any);
    mockService.getEventByNaddr.mockResolvedValue(null);
    const result = await fetchDiscussionDetails('34550:nonexistent-pubkey:nonexistent_discussion');

    // Should return fallback details when event not found
    expect(result.title).toContain('詳細読み込み失敗');
    expect(result.description).toContain('詳細を取得できませんでした');
  });

  test('should handle multiple discussions with mixed success/failure', async () => {
    const discussions = [
      mockProcessedDiscussion,
      {
        ...mockProcessedDiscussion,
        communityPostId: 'post2',
        userDiscussionNaddr: '34550:nonexistent-pubkey:nonexistent_discussion',
        authorPubkey: 'user2-pubkey',
      },
    ];

    const mockCreateNostrService = createNostrService as jest.MockedFunction<typeof createNostrService>;
    const mockService = mockCreateNostrService.mock.results[0]?.value || mockCreateNostrService({} as any);
    mockService.getEventByNaddr
      .mockResolvedValueOnce(mockKind34550Event)
      .mockResolvedValueOnce(null);

    const enhanced = await enhanceDiscussionsWithDetails(discussions);

    expect(enhanced).toHaveLength(2);
    // First discussion should have valid details or fallback
    expect(enhanced[0]).toHaveProperty('discussionDetails');
    // Second discussion should have fallback details
    expect(enhanced[1]).toHaveProperty('discussionDetails');
  });
});