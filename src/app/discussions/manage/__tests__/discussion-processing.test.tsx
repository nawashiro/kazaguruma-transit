/**
 * TDD tests for NIP-72 community post processing in discussion management
 */

import { processCommunityPosts } from '../discussion-processing';

describe('Discussion Management NIP-72 Processing', () => {
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
    {
      id: 'post2',
      kind: 1111,
      pubkey: 'user2-pubkey', 
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['a', '34550:admin-pubkey:discussion_list'],
        ['q', '34550:user2-pubkey:user_discussion_2'],
      ],
      content: 'nostr:naddr1user_discussion_2',
      sig: 'signature2',
    },
  ];

  const mockApprovalEvents = [
    {
      id: 'approval1',
      kind: 4550,
      pubkey: 'admin-pubkey',
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['e', 'post1'],
        ['a', '34550:user1-pubkey:user_discussion_1'],
      ],
      content: JSON.stringify(mockCommunityPosts[0]),
      sig: 'approval-sig1',
    },
  ];

  test('should extract user discussion references from q tags', () => {
    const result = processCommunityPosts(mockCommunityPosts, []);

    expect(result.pending).toHaveLength(2);
    expect(result.pending[0].userDiscussionNaddr).toBe('34550:user1-pubkey:user_discussion_1');
    expect(result.pending[1].userDiscussionNaddr).toBe('34550:user2-pubkey:user_discussion_2');
  });

  test('should separate approved from pending discussions', () => {
    const result = processCommunityPosts(mockCommunityPosts, mockApprovalEvents);

    expect(result.pending).toHaveLength(1);
    expect(result.approved).toHaveLength(1);
    expect(result.approved[0].userDiscussionNaddr).toBe('34550:user1-pubkey:user_discussion_1');
    expect(result.pending[0].userDiscussionNaddr).toBe('34550:user2-pubkey:user_discussion_2');
  });

  test('should include approval metadata for approved discussions', () => {
    const result = processCommunityPosts(mockCommunityPosts, mockApprovalEvents);

    const approved = result.approved[0];
    expect(approved.isApproved).toBe(true);
    expect(approved.approvalEventId).toBe('approval1');
    expect(approved.approvedAt).toBe(mockApprovalEvents[0].created_at);
  });

  test('should handle discussions without q tags', () => {
    const postsWithoutQ = [
      {
        ...mockCommunityPosts[0],
        tags: [
            ['a', '34550:admin-pubkey:discussion_list'],
          // Missing q tag
        ],
      },
    ];

    const result = processCommunityPosts(postsWithoutQ, []);

    expect(result.pending).toHaveLength(0);
    expect(result.approved).toHaveLength(0);
  });

  test('should handle empty community posts array', () => {
    const result = processCommunityPosts([], mockApprovalEvents);

    expect(result.pending).toHaveLength(0);
    expect(result.approved).toHaveLength(0);
  });
});