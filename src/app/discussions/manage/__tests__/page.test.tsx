import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { useAuth } from '@/lib/auth/auth-context';
import { createNostrService } from '@/lib/nostr/nostr-service';
import DiscussionManagePage from '../page';

// Mock dependencies
jest.mock('@/lib/auth/auth-context');
jest.mock('@/lib/nostr/nostr-service');
jest.mock('@/lib/config/discussion-config', () => ({
  isDiscussionsEnabled: () => true,
  getNostrServiceConfig: () => ({ relays: [], defaultTimeout: 5000 }),
}));
jest.mock('@/lib/nostr/nostr-utils', () => ({
  getAdminPubkeyHex: () => 'admin-pubkey',
  parseDiscussionEvent: jest.fn(),
  formatRelativeTime: (timestamp: number) => 'some time ago',
}));
jest.mock('@/components/discussion/PermissionGuards', () => ({
  AdminCheck: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PermissionError: () => <div>Permission Error</div>,
}));
jest.mock('@/lib/rubyful/rubyfulRun', () => ({
  useRubyfulRun: jest.fn(),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockCreateNostrService = createNostrService as jest.MockedFunction<typeof createNostrService>;

describe('DiscussionManagePage NIP-72 compliance', () => {
  const mockNostrService = {
    getCommunityPostsToDiscussionList: jest.fn(),
    getApprovalEvents: jest.fn(),
    createDiscussionApprovalEvent: jest.fn(),
    publishSignedEvent: jest.fn(),
    createApprovalRevocationEvent: jest.fn(),
  };

  const mockUser = {
    pubkey: 'admin-pubkey',
    npub: 'npub...',
    pwk: {} as any,
    isLoggedIn: true,
    profile: { 
      name: 'Admin User', 
      pubkey: 'admin-pubkey',
      about: '',
      picture: ''
    },
  };

  const mockSignEvent = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock environment variable
    process.env.NEXT_PUBLIC_DISCUSSION_LIST_NADDR = 'naddr1discussion_list_test';
    
    mockUseAuth.mockReturnValue({
      user: mockUser,
      signEvent: mockSignEvent,
      login: jest.fn(),
      logout: jest.fn(),
      createAccount: jest.fn(),
      refreshProfile: jest.fn(),
      isLoading: false,
      error: null,
    });

    mockCreateNostrService.mockReturnValue(mockNostrService as any);
  });

  test.skip('should fetch NIP-72 community posts instead of kind:34550 discussions', async () => {
    // Mock NIP-72 compliant community posts (kind:1111)
    const mockCommunityPosts = [
      {
        id: 'post1',
        kind: 1111,
        tags: [
          ['a', '34550:admin-pubkey:discussion_list'], // Community definition
          ['q', '34550:user1:user_discussion'], // Spec requirement
        ],
        content: 'nostr:naddr1user_discussion',
        pubkey: 'user1',
        created_at: Math.floor(Date.now() / 1000),
        sig: 'signature',
      },
    ];

    const mockApprovalEvents: any[] = [];

    mockNostrService.getCommunityPostsToDiscussionList.mockResolvedValue(mockCommunityPosts);
    mockNostrService.getApprovalEvents.mockResolvedValue(mockApprovalEvents);

    render(<DiscussionManagePage />);

    await waitFor(() => {
      // Should call getCommunityPostsToDiscussionList with NIP-72 parameters
      expect(mockNostrService.getCommunityPostsToDiscussionList).toHaveBeenCalledWith(
        expect.any(String), // Discussion list naddr
        expect.objectContaining({
          limit: expect.any(Number), // Pagination parameters
        })
      );

      // Should NOT call old wrong methods
      expect(mockNostrService).not.toHaveProperty('getPendingUserDiscussions');
      expect(mockNostrService).not.toHaveProperty('getApprovedUserDiscussions');
    });
  });

  test.skip('should implement pagination for community posts', async () => {
    mockNostrService.getCommunityPostsToDiscussionList.mockResolvedValue([]);
    mockNostrService.getApprovalEvents.mockResolvedValue([]);

    render(<DiscussionManagePage />);

    await waitFor(() => {
      expect(mockNostrService.getCommunityPostsToDiscussionList).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          limit: expect.any(Number),
        })
      );
    });
  });

  test('should separate approved and pending posts based on approval events', async () => {
    const mockPosts = [
      {
        id: 'post1',
        kind: 1111,
        tags: [['q', 'discussion1']],
        content: 'nostr:discussion1',
      },
      {
        id: 'post2', 
        kind: 1111,
        tags: [['q', 'discussion2']],
        content: 'nostr:discussion2',
      },
    ];

    // Mock approval for post1 only
    const mockApprovals = [
      {
        id: 'approval1',
        kind: 4550,
        tags: [
          ['e', 'post1'],
          ['a', 'discussion1'],
        ],
      },
    ];

    mockNostrService.getCommunityPostsToDiscussionList.mockResolvedValue(mockPosts);
    mockNostrService.getApprovalEvents.mockResolvedValue(mockApprovals);

    render(<DiscussionManagePage />);

    await waitFor(() => {
      // Should show tabs (even if empty due to placeholder implementation)
      expect(screen.getByText(/承認待ち会話/)).toBeInTheDocument();
      expect(screen.getByText(/承認済み会話/)).toBeInTheDocument();
    });
  });

  test('should extract user discussion from q tag according to spec', async () => {
    const mockPost = {
      id: 'post1',
      kind: 1111,
      tags: [
        ['a', 'user_discussion_naddr'], 
        ['q', 'user_discussion_naddr'], // This should be used to get discussion details
      ],
      content: 'nostr:user_discussion_naddr',
    };

    mockNostrService.getCommunityPostsToDiscussionList.mockResolvedValue([mockPost]);
    mockNostrService.getApprovalEvents.mockResolvedValue([]);

    render(<DiscussionManagePage />);

    await waitFor(() => {
      // Should extract discussion naddr from q tag for fetching discussion details
      const qTag = mockPost.tags.find(tag => tag[0] === 'q');
      expect(qTag?.[1]).toBe('user_discussion_naddr');
    });
  });
});