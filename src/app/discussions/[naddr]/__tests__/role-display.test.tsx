/**
 * @jest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { useAuth } from '@/lib/auth/auth-context';
import DiscussionDetailPage from '../page';
import { isDiscussionsEnabled } from '@/lib/config/discussion-config';

// モック設定
jest.mock('@/lib/auth/auth-context');
jest.mock('@/lib/config/discussion-config');
jest.mock('next/navigation', () => ({
  useParams: () => ({ naddr: 'test-naddr' }),
}));
jest.mock('@/lib/nostr/naddr-utils', () => ({
  extractDiscussionFromNaddr: () => ({
    dTag: 'test-dtag',
    discussionId: 'test-id',
    authorPubkey: 'author-pubkey',
  }),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockIsDiscussionsEnabled = isDiscussionsEnabled as jest.MockedFunction<typeof isDiscussionsEnabled>;

// テストデータ作成用のヘルパー
const createMockDiscussion = (authorPubkey: string, moderators: string[] = []) => ({
  getDiscussions: jest.fn().mockResolvedValue([{
    kind: 34550,
    tags: [
      ['d', 'test-dtag'],
      ['name', 'Test Discussion'],
      ['description', 'Test Description'],
      ...moderators.map(mod => ['p', mod, '', 'moderator']),
    ],
    content: 'Test Description',
    pubkey: authorPubkey,
    created_at: Math.floor(Date.now() / 1000),
    id: 'event-id',
  }]),
  getDiscussionPosts: jest.fn().mockResolvedValue([]),
  getApprovals: jest.fn().mockResolvedValue([]),
  getEvaluationsForPosts: jest.fn().mockResolvedValue([]),
  getProfile: jest.fn(),
  getEvaluations: jest.fn(),
});

describe('Discussion Role Display', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsDiscussionsEnabled.mockReturnValue(true);
    mockUseAuth.mockReturnValue({
      user: { 
        isLoggedIn: true, 
        pubkey: 'viewer-pubkey' 
      },
      signEvent: jest.fn(),
    });
  });

  it('displays creator badge for regular author', async () => {
    jest.doMock('@/lib/nostr/nostr-service', () => ({
      createNostrService: () => createMockDiscussion('author-pubkey'),
    }));

    render(<DiscussionDetailPage />);
    
    // 作成者バッジが表示されることを確認
    await screen.findByText('作成者');
    expect(screen.getByText('作成者')).toHaveClass('badge-outline');
  });

  it('displays moderator badge when author is also moderator', async () => {
    jest.doMock('@/lib/nostr/nostr-service', () => ({
      createNostrService: () => createMockDiscussion('author-pubkey', ['author-pubkey']),
    }));

    render(<DiscussionDetailPage />);
    
    // モデレーターバッジが表示され、作成者バッジは表示されないことを確認
    await screen.findByText('モデレーター');
    expect(screen.getByText('モデレーター')).toHaveClass('badge-secondary');
    expect(screen.queryByText('作成者')).not.toBeInTheDocument();
  });

  it('does not display admin badge even for admin user', async () => {
    // 管理者公開鍵を設定
    process.env.NEXT_PUBLIC_ADMIN_PUBKEY = 'admin-pubkey';

    jest.doMock('@/lib/nostr/nostr-service', () => ({
      createNostrService: () => createMockDiscussion('admin-pubkey'),
    }));

    render(<DiscussionDetailPage />);
    
    // 管理者バッジは表示されず、作成者バッジが表示されることを確認
    await screen.findByText('作成者');
    expect(screen.queryByText('管理者')).not.toBeInTheDocument();
    expect(screen.getByText('作成者')).toHaveClass('badge-outline');
  });

  it('displays moderator badge for admin who is also moderator', async () => {
    // 管理者公開鍵を設定
    process.env.NEXT_PUBLIC_ADMIN_PUBKEY = 'admin-pubkey';

    jest.doMock('@/lib/nostr/nostr-service', () => ({
      createNostrService: () => createMockDiscussion('admin-pubkey', ['admin-pubkey']),
    }));

    render(<DiscussionDetailPage />);
    
    // モデレーターバッジが表示されることを確認（管理者バッジではない）
    await screen.findByText('モデレーター');
    expect(screen.getByText('モデレーター')).toHaveClass('badge-secondary');
    expect(screen.queryByText('管理者')).not.toBeInTheDocument();
    expect(screen.queryByText('作成者')).not.toBeInTheDocument();
  });

  it('displays only one role badge per discussion', async () => {
    jest.doMock('@/lib/nostr/nostr-service', () => ({
      createNostrService: () => createMockDiscussion('author-pubkey', ['moderator1-pubkey', 'moderator2-pubkey']),
    }));

    render(<DiscussionDetailPage />);
    
    // 作成者バッジのみ表示されることを確認
    await screen.findByText('作成者');
    
    // バッジは1つだけ表示される
    const badges = screen.getAllByRole('generic', { name: /badge/ });
    const roleBadges = badges.filter(badge => 
      badge.textContent?.includes('作成者') || 
      badge.textContent?.includes('モデレーター') || 
      badge.textContent?.includes('管理者')
    );
    expect(roleBadges).toHaveLength(1);
  });
});