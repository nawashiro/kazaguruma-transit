import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import DiscussionDetailPage from '../page';

// Mock all the modules and hooks
jest.mock('next/navigation', () => ({
  useParams: () => ({ naddr: 'test-naddr' }),
}));

jest.mock('@/lib/auth/auth-context', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/lib/config/discussion-config', () => ({
  isDiscussionsEnabled: () => true,
  getNostrServiceConfig: () => ({}),
}));

jest.mock('@/lib/nostr/nostr-service', () => ({
  createNostrService: () => ({
    streamDiscussionMeta: jest.fn(),
    getDiscussions: jest.fn().mockResolvedValue([{
      id: 'test-event-id',
      pubkey: 'test-author-pubkey',
      tags: [['d', 'test-discussion'], ['name', 'Test Discussion']],
      content: 'Test Description',
      created_at: Math.floor(Date.now() / 1000),
    }]),
    getDiscussionPosts: jest.fn().mockResolvedValue([]),
    getApprovals: jest.fn().mockResolvedValue([]),
    getApprovalsOnEose: jest.fn().mockResolvedValue([]),
    getEvaluationsForPosts: jest.fn().mockResolvedValue([]),
    getEvaluations: jest.fn().mockResolvedValue([]),
    getProfile: jest.fn().mockResolvedValue(null),
  }),
}));

jest.mock('@/lib/nostr/naddr-utils', () => ({
  extractDiscussionFromNaddr: () => ({
    dTag: 'test-discussion',
    authorPubkey: 'test-author-pubkey',
    discussionId: 'test-id',
  }),
}));


jest.mock('@/lib/nostr/nostr-utils', () => ({
  parseDiscussionEvent: jest.fn(),
  parsePostEvent: () => null,
  parseApprovalEvent: () => null,
  parseEvaluationEvent: () => null,
  combinePostsWithStats: () => [],
  createAuditTimeline: () => [],
  validatePostForm: () => [],
  formatRelativeTime: () => '1 hour ago',
  getAdminPubkeyHex: () => 'admin-pubkey',
  isModerator: () => false,
  filterUnevaluatedPosts: () => [],
}));

jest.mock('@/lib/test/test-data-loader', () => ({
  isTestMode: jest.fn(() => false),
  loadTestData: jest.fn(() => ({})),
}));

jest.mock('@/lib/evaluation/evaluation-service', () => ({
  evaluationService: {
    analyzeConsensus: jest.fn().mockResolvedValue(null),
  },
}));

// Mock fetch for bus stops API
global.fetch = jest.fn().mockResolvedValue({
  json: jest.fn().mockResolvedValue({
    success: true,
    data: [],
  }),
});

// Mock components that are causing issues
jest.mock('@/components/discussion/EvaluationComponent', () => {
  return {
    EvaluationComponent: function MockEvaluationComponent() {
      return <div>Evaluation Component</div>;
    },
  };
});

jest.mock('@/components/discussion/PermissionGuards', () => ({
  ModeratorCheck: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AdminCheck: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PermissionError: () => <div>Permission Error</div>,
}));

jest.mock('@/components/discussion/LoginModal', () => {
  return {
    LoginModal: function MockLoginModal() {
      return <div>Login Modal</div>;
    },
  };
});

jest.mock('@/components/discussion/PostPreview', () => {
  return {
    PostPreview: function MockPostPreview() {
      return <div>Post Preview</div>;
    },
  };
});

jest.mock('@/components/discussion/AuditTimeline', () => {
  return {
    AuditTimeline: function MockAuditTimeline() {
      return <div>Audit Timeline</div>;
    },
  };
});

jest.mock('@/components/ui/Button', () => {
  return function MockButton({ children, ...props }: any) {
    return <button {...props}>{children}</button>;
  };
});

describe.skip('DiscussionDetailPage - Role Display', () => {
  const mockUseAuth = jest.requireMock('@/lib/auth/auth-context').useAuth as jest.MockedFunction<any>;
  const mockParseDiscussionEvent = jest.requireMock('@/lib/nostr/nostr-utils').parseDiscussionEvent as jest.MockedFunction<any>;
  
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Set up default mock return values
    mockParseDiscussionEvent.mockReturnValue({
      id: 'test-id',
      title: 'Test Discussion',
      description: 'Test Description',
      authorPubkey: 'test-author-pubkey',
      dTag: 'test-discussion',
      moderators: [
        { pubkey: 'moderator-pubkey', relay: '' }
      ],
      createdAt: Math.floor(Date.now() / 1000),
    });
  });

  it('should show creator role when user is the discussion creator but not a moderator', async () => {
    // Mock user as creator but not moderator
    mockUseAuth.mockReturnValue({
      user: { 
        pubkey: 'test-author-pubkey', // Same as discussion author
        isLoggedIn: true 
      },
      signEvent: jest.fn(),
    });

    await act(async () => {
      render(<DiscussionDetailPage />);
    });

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByText('投稿を評価')).toBeInTheDocument();
    });
    
    // Should show "作成者" (creator) role
    expect(screen.getByText('作成者')).toBeInTheDocument();
    // Should NOT show "モデレーター" (moderator) role  
    expect(screen.queryByText('モデレーター')).not.toBeInTheDocument();
  });

  it('should show moderator role when user is a moderator but not the creator', async () => {
    // Mock user as moderator but not creator
    mockUseAuth.mockReturnValue({
      user: { 
        pubkey: 'moderator-pubkey', // Same as moderator pubkey
        isLoggedIn: true 
      },
      signEvent: jest.fn(),
    });

    await act(async () => {
      render(<DiscussionDetailPage />);
    });

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByText('投稿を評価')).toBeInTheDocument();
    });
    
    // Should show "モデレーター" (moderator) role
    expect(screen.getByText('モデレーター')).toBeInTheDocument();
    // Should NOT show "作成者" (creator) role
    expect(screen.queryByText('作成者')).not.toBeInTheDocument();
  });

  it('should not show aside when user is neither creator nor moderator', async () => {
    // Mock user as neither creator nor moderator
    mockUseAuth.mockReturnValue({
      user: { 
        pubkey: 'other-user-pubkey', // Different from both creator and moderators
        isLoggedIn: true 
      },
      signEvent: jest.fn(),
    });

    await act(async () => {
      render(<DiscussionDetailPage />);
    });

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByText('投稿を評価')).toBeInTheDocument();
    });
    
    // Should NOT show the aside section at all
    expect(screen.queryByText('あなたは')).not.toBeInTheDocument();
    expect(screen.queryByText('作成者')).not.toBeInTheDocument();
    expect(screen.queryByText('モデレーター')).not.toBeInTheDocument();
  });

  it('should show moderator role when user is both creator and moderator', async () => {
    // Mock user as both creator and moderator (creator is in moderator list)
    mockParseDiscussionEvent.mockReturnValue({
      id: 'test-id',
      title: 'Test Discussion',
      description: 'Test Description',
      authorPubkey: 'test-author-pubkey',
      dTag: 'test-discussion',
      moderators: [
        { pubkey: 'test-author-pubkey', relay: '' }, // Creator is also moderator
        { pubkey: 'other-moderator-pubkey', relay: '' }
      ],
      createdAt: Math.floor(Date.now() / 1000),
    });

    mockUseAuth.mockReturnValue({
      user: { 
        pubkey: 'test-author-pubkey', // Same as discussion author AND moderator
        isLoggedIn: true 
      },
      signEvent: jest.fn(),
    });

    await act(async () => {
      render(<DiscussionDetailPage />);
    });

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByText('Test Discussion')).toBeInTheDocument();
    });
    
    // Should show "モデレーター" (moderator) role since creator is also moderator
    expect(screen.getByText('モデレーター')).toBeInTheDocument();
    // Should NOT show "作成者" (creator) role when user is both
    expect(screen.queryByText('作成者')).not.toBeInTheDocument();
  });
});

describe('DiscussionDetailPage - Legacy Role Block Removal', () => {
  const mockUseAuth = jest.requireMock('@/lib/auth/auth-context').useAuth as jest.MockedFunction<any>;
  const mockParseDiscussionEvent = jest.requireMock('@/lib/nostr/nostr-utils').parseDiscussionEvent as jest.MockedFunction<any>;
  const mockIsTestMode = jest.requireMock('@/lib/test/test-data-loader').isTestMode as jest.MockedFunction<any>;
  const mockLoadTestData = jest.requireMock('@/lib/test/test-data-loader').loadTestData as jest.MockedFunction<any>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: { pubkey: 'test-author-pubkey', isLoggedIn: true },
      signEvent: jest.fn(),
    });
    mockParseDiscussionEvent.mockReturnValue({
      id: 'test-id',
      title: 'Test Discussion',
      description: 'Test Description',
      authorPubkey: 'test-author-pubkey',
      dTag: 'test-discussion',
      moderators: [],
      createdAt: Math.floor(Date.now() / 1000),
    });
    mockIsTestMode.mockReturnValue(true);
    mockLoadTestData.mockResolvedValue({
      discussion: {
        id: 'test-id',
        title: 'Test Discussion',
        description: 'Test Description',
        authorPubkey: 'test-author-pubkey',
        dTag: 'test-discussion',
        moderators: [],
        createdAt: Math.floor(Date.now() / 1000),
      },
      posts: [],
      evaluations: [],
    });
  });

  it('does not render legacy role block content', async () => {
    await act(async () => {
      render(<DiscussionDetailPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('投稿を評価')).toBeInTheDocument();
    });

    expect(screen.queryByText('あなたは')).not.toBeInTheDocument();
    expect(screen.queryByText('作成者')).not.toBeInTheDocument();
    expect(screen.queryByText('モデレーター')).not.toBeInTheDocument();
  });
});
