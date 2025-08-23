/**
 * Simple test for basic NIP-72 processing functionality
 */

import { processCommunityPosts } from '../discussion-processing';

describe('Simple Discussion Processing', () => {
  test('should process community posts correctly', () => {
    const mockCommunityPosts = [
      {
        id: 'post1',
        kind: 1111,
        pubkey: 'user1-pubkey',
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['a', '34550:admin-pubkey:discussion_list'],
          ['q', '34550:user1-pubkey:user_discussion_1'], // Required q tag
        ],
        content: 'nostr:naddr1user_discussion_1',
        sig: 'signature1',
      },
    ];

    const mockApprovalEvents: any[] = [];

    const result = processCommunityPosts(mockCommunityPosts, mockApprovalEvents);

    expect(result.pending).toHaveLength(1);
    expect(result.approved).toHaveLength(0);
    expect(result.pending[0].userDiscussionNaddr).toBe('34550:user1-pubkey:user_discussion_1');
    expect(result.pending[0].isApproved).toBe(false);
  });

  test('should mark discussions as approved when approval event exists', () => {
    const mockCommunityPosts = [
      {
        id: 'post1',
        kind: 1111,
        pubkey: 'user1-pubkey',
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['a', '34550:admin-pubkey:discussion_list'],
          ['q', '34550:user1-pubkey:user_discussion_1'],
        ],
        content: 'nostr:naddr1user_discussion_1',
        sig: 'signature1',
      },
    ];

    const mockApprovalEvents = [
      {
        id: 'approval1',
        kind: 4550,
        pubkey: 'admin-pubkey',
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['e', 'post1'], // References the community post
          ['a', '34550:admin-pubkey:discussion_list'],
        ],
        content: JSON.stringify(mockCommunityPosts[0]),
        sig: 'approval-sig1',
      },
    ];

    const result = processCommunityPosts(mockCommunityPosts, mockApprovalEvents);

    expect(result.pending).toHaveLength(0);
    expect(result.approved).toHaveLength(1);
    expect(result.approved[0].userDiscussionNaddr).toBe('34550:user1-pubkey:user_discussion_1');
    expect(result.approved[0].isApproved).toBe(true);
    expect(result.approved[0].approvalEventId).toBe('approval1');
  });
});