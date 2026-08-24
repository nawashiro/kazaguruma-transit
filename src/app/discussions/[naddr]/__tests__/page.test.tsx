import React from 'react';
import { fireEvent, render, screen, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import DiscussionDetailPage from '../page';

const mockRouterPush = jest.fn();
const mockUseAuth = jest.fn();
const mockUseDiscussionContentData = jest.fn();
const mockSignEvent = jest.fn();
const mockPublishSignedEvent = jest.fn();
const mockCreatePostEvent = jest.fn();
const mockCreateEvaluationEvent = jest.fn();
const mockAnalyzeConsensus = jest.fn();
const mockValidatePostForm = jest.fn<string[], [unknown]>();
const mockDiscussionMetaReload = jest.fn();
const mockDiscussion = {
  id: 'discussion-id',
  dTag: 'test-discussion',
  title: 'Test Discussion',
  description: 'Test Description',
  moderators: [],
  authorPubkey: 'test-author-pubkey',
  createdAt: 1,
  event: {
    id: 'discussion-event-id',
    pubkey: 'test-author-pubkey',
    created_at: 1,
    kind: 34550,
    tags: [],
    content: '',
    sig: 'discussion-signature',
  },
};
const mockDiscussionPost = {
  id: 'post-1',
  content: 'A useful post',
  authorPubkey: 'post-author-pubkey',
  discussionId: 'discussion-id',
  busStopTag: 'Stop A',
  createdAt: 1,
  approved: true,
  approvalState: 'approved' as const,
  approvedBy: [],
  event: {
    id: 'post-event-id',
    pubkey: 'post-author-pubkey',
    created_at: 1,
    kind: 1111,
    tags: [],
    content: 'A useful post',
    sig: 'post-signature',
  },
};
const mockDiscussionPosts = [mockDiscussionPost];

// Mock all the modules and hooks
jest.mock('next/navigation', () => ({
  useParams: () => ({ naddr: 'test-naddr' }),
  useRouter: () => ({ push: mockRouterPush }),
}));

jest.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('@/components/discussion/DiscussionTabLayout', () => ({
  useDiscussionMeta: () => ({
    discussion: mockDiscussion,
    isLoading: false,
    error: null,
    completionReason: 'eose',
    reload: mockDiscussionMetaReload,
  }),
}));

jest.mock('@/components/discussion/DiscussionContentDataProvider', () => ({
  useDiscussionContentData: () => mockUseDiscussionContentData(),
}));

jest.mock('@/lib/config/discussion-config', () => ({
  isDiscussionsEnabled: () => true,
  getNostrServiceConfig: () => ({ defaultTimeout: 100, relays: [] }),
  getDiscussionReadStrategyConfig: () => ({

    idleTimeoutMs: 100,
    hardTimeoutMs: 300,
    dedupWindowMs: 10,
  }),
  DEFAULT_RELAYS: [],
}));

jest.mock('@/lib/nostr/nostr-service', () => ({
  getNostrServiceConfigKey: () => 'test-config-key',
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
    createPostEvent: (...args: unknown[]) => mockCreatePostEvent(...args),
    createEvaluationEvent: (...args: unknown[]) => mockCreateEvaluationEvent(...args),
    publishSignedEvent: (...args: unknown[]) => mockPublishSignedEvent(...args),
  }),
}));

jest.mock('@/lib/nostr/discussion-ndk-gateway', () => ({
  createDiscussionNdkGateway: () => ({}),
}));

jest.mock('@/lib/nostr/nostr-read-executor', () => ({
  executeNostrRead: jest.fn().mockResolvedValue({
    events: [],
    completionReason: 'eose',
    duplicateCount: 0,
    elapsedMs: 0,
    attemptedRelayUrls: [],
    successfulEventRelayUrls: [],
    sourceRelayUrlsByEventId: {},
    attempts: [],
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
  validatePostForm: (formData: unknown) => mockValidatePostForm(formData),
  formatRelativeTime: () => '1 hour ago',
  getAdminPubkeyHex: () => 'admin-pubkey',
  isModerator: () => false,
  filterUnevaluatedPosts: () => [],
}));

jest.mock('@/lib/test/test-data-loader', () => ({
  isTestMode: () => false,
  loadTestData: () => ({}),
}));

jest.mock('@/lib/evaluation/evaluation-service', () => ({
  evaluationService: {
    analyzeConsensus: (...args: unknown[]) => mockAnalyzeConsensus(...args),
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
    EvaluationComponent: function MockEvaluationComponent({
      onEvaluate,
    }: {
      onEvaluate: (postId: string, rating: '+' | '-') => Promise<void>;
    }) {
      return (
        <button
          type="button"
          aria-label="評価する"
          onClick={() => void onEvaluate('post-1', '+')}
        >
          評価する
        </button>
      );
    },
  };
});

jest.mock('@/components/discussion/PermissionGuards', () => ({
  ModeratorCheck: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AdminCheck: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/discussion/PostPreview', () => {
  return {
    PostPreview: function MockPostPreview({
      onConfirm,
      onCancel,
    }: {
      onConfirm: () => void;
      onCancel: () => void;
    }) {
      return (
        <div>
          <button type="button" onClick={onCancel}>編集に戻る</button>
          <button type="button" onClick={onConfirm}>投稿を確定</button>
        </div>
      );
    },
  };
});

jest.mock('@/components/ui/Button', () => {
  return function MockButton({
    children,
    fullWidth,
    secondary,
    loading,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    fullWidth?: boolean;
    secondary?: boolean;
    loading?: boolean;
  }) {
    void fullWidth;
    void secondary;
    void loading;
    return <button {...props}>{children}</button>;
  };
});

describe('DiscussionDetailPage - unauthenticated public actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: { pubkey: null, isLoggedIn: false },
      signEvent: mockSignEvent,
    });
    mockUseDiscussionContentData.mockReturnValue({
      posts: mockDiscussionPosts,
      isLoading: false,
      error: null,
      addPost: jest.fn(),
    });
    mockCreatePostEvent.mockReset();
    mockCreateEvaluationEvent.mockReset();
    mockPublishSignedEvent.mockReset();
    mockSignEvent.mockReset();
    mockAnalyzeConsensus.mockReset();
    mockValidatePostForm.mockReset();
    mockValidatePostForm.mockReturnValue([]);
  });

  it('renders post validation errors as an assertive soft alert list', async () => {
    mockUseAuth.mockReturnValue({
      user: { pubkey: 'authenticated-user', isLoggedIn: true },
      signEvent: mockSignEvent,
    });
    mockValidatePostForm.mockReturnValue(['投稿内容の検証に失敗しました。']);

    render(<DiscussionDetailPage />);

    fireEvent.change(await screen.findByRole('textbox', { name: /投稿内容/ }), {
      target: { value: '投稿本文' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'プレビュー' }));
    fireEvent.click(await screen.findByRole('button', { name: '投稿を確定' }));
    fireEvent.click(screen.getByRole('button', { name: '編集に戻る' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveAttribute('aria-live', 'assertive');
    expect(alert).toHaveClass(
      'alert',
      'alert-error',
      'alert-soft',
      'text-base-content!',
    );
    expect(alert.querySelector('ul')).not.toBeNull();
    expect(alert).toHaveTextContent('投稿内容の検証に失敗しました。');
  });

  it('routes an unauthenticated post action to login without opening a modal or signing', async () => {
    const view = render(<DiscussionDetailPage />);

    fireEvent.change(await screen.findByRole('textbox', { name: /投稿内容/ }), {
      target: { value: '投稿本文' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'プレビュー' }));
    fireEvent.click(screen.getByRole('button', { name: '投稿を確定' }));

    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledTimes(1);
    });
    const target = new URL(
      mockRouterPush.mock.calls[0][0] as string,
      'https://kazaguruma.invalid',
    );
    expect(target.pathname).toBe('/login');
    expect(target.searchParams.get('returnTo')).toBe('/discussions/test-naddr');
    expect(target.searchParams.get('reason')).toBe('投稿するにはログインが必要です。');
    expect(target.searchParams.has('action')).toBe(false);
    expect(target.searchParams.has('payload')).toBe(false);
    expect(target.searchParams.has('draft')).toBe(false);
    expect(screen.queryByTestId('login-modal')).not.toBeInTheDocument();
    expect(mockSignEvent).not.toHaveBeenCalled();
    expect(mockPublishSignedEvent).not.toHaveBeenCalled();
    expect(mockCreatePostEvent).not.toHaveBeenCalled();
    expect(mockAnalyzeConsensus).not.toHaveBeenCalled();

    mockUseAuth.mockReturnValue({
      user: { pubkey: 'authenticated-user', isLoggedIn: true },
      signEvent: mockSignEvent,
    });
    view.rerender(<DiscussionDetailPage />);
    await waitFor(() => {
      expect(mockSignEvent).not.toHaveBeenCalled();
      expect(mockCreatePostEvent).not.toHaveBeenCalled();
      expect(mockPublishSignedEvent).not.toHaveBeenCalled();
    });
  });

  it('routes an unauthenticated evaluation action to login without evaluation side effects', async () => {
    const view = render(<DiscussionDetailPage />);

    fireEvent.click(await screen.findByRole('button', { name: '評価する' }));

    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledTimes(1);
    });
    const target = new URL(
      mockRouterPush.mock.calls[0][0] as string,
      'https://kazaguruma.invalid',
    );
    expect(target.pathname).toBe('/login');
    expect(target.searchParams.get('returnTo')).toBe('/discussions/test-naddr');
    expect(target.searchParams.get('reason')).toBe(
      '投稿を評価するにはログインが必要です。',
    );
    expect(target.searchParams.has('action')).toBe(false);
    expect(target.searchParams.has('payload')).toBe(false);
    expect(target.searchParams.has('draft')).toBe(false);
    expect(screen.queryByTestId('login-modal')).not.toBeInTheDocument();
    expect(mockSignEvent).not.toHaveBeenCalled();
    expect(mockPublishSignedEvent).not.toHaveBeenCalled();
    expect(mockCreateEvaluationEvent).not.toHaveBeenCalled();
    expect(mockAnalyzeConsensus).not.toHaveBeenCalled();

    mockUseAuth.mockReturnValue({
      user: { pubkey: 'authenticated-user', isLoggedIn: true },
      signEvent: mockSignEvent,
    });
    view.rerender(<DiscussionDetailPage />);
    await waitFor(() => {
      expect(mockSignEvent).not.toHaveBeenCalled();
      expect(mockCreateEvaluationEvent).not.toHaveBeenCalled();
      expect(mockPublishSignedEvent).not.toHaveBeenCalled();
    });
  });

  it('renders post read errors as soft alert content', async () => {
    mockUseDiscussionContentData.mockReturnValue({
      posts: mockDiscussionPosts,
      isLoading: false,
      error: '投稿・評価データの取得に失敗しました。',
      addPost: jest.fn(),
    });

    render(<DiscussionDetailPage />);

    const errorTexts = await screen.findAllByText('投稿・評価データの取得に失敗しました。');
    const postsStatus = errorTexts[0].closest<HTMLElement>('[role="status"]');
    expect(postsStatus).not.toBeNull();
    if (!postsStatus) {
      throw new Error('Expected the post read error to be rendered in a status container');
    }
    expect(postsStatus).toHaveAttribute('aria-live', 'polite');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(postsStatus).toHaveTextContent('投稿・評価データの取得に失敗しました。');
    expect(postsStatus).toHaveClass(
      'alert',
      'alert-error',
      'alert-soft',
      'text-base-content!',
    );
  });
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
      expect(screen.getByText('Test Discussion')).toBeInTheDocument();
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
      expect(screen.getByText('Test Discussion')).toBeInTheDocument();
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
      expect(screen.getByText('Test Discussion')).toBeInTheDocument();
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
