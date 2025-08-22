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
jest.mock('@/lib/nostr/nostr-service', () => ({
  createNostrService: () => ({
    getDiscussions: jest.fn(),
    getDiscussionPosts: jest.fn(),
    getApprovals: jest.fn(),
    getEvaluationsForPosts: jest.fn(),
    getProfile: jest.fn(),
    getEvaluations: jest.fn(),
  }),
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

describe('Discussion Edit Access', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsDiscussionsEnabled.mockReturnValue(true);
  });

  it('shows edit button for discussion author', async () => {
    mockUseAuth.mockReturnValue({
      user: { 
        isLoggedIn: true, 
        pubkey: 'author-pubkey' 
      },
      signEvent: jest.fn(),
    });

    render(<DiscussionDetailPage />);
    
    // 編集ボタンが表示されることを確認
    await screen.findByText('会話を編集');
  });

  it('shows edit button for admin', async () => {
    // 管理者公開鍵を設定
    process.env.NEXT_PUBLIC_ADMIN_PUBKEY = 'admin-pubkey';
    
    mockUseAuth.mockReturnValue({
      user: { 
        isLoggedIn: true, 
        pubkey: 'admin-pubkey' 
      },
      signEvent: jest.fn(),
    });

    render(<DiscussionDetailPage />);
    
    // 編集ボタンが表示されることを確認
    await screen.findByText('会話を編集');
  });

  it('shows edit button for moderator', async () => {
    // モデレーター情報を含む会話データをモック
    jest.doMock('@/lib/nostr/nostr-service', () => ({
      createNostrService: () => ({
        getDiscussions: jest.fn().mockResolvedValue([{
          kind: 34550,
          tags: [
            ['d', 'test-dtag'],
            ['name', 'Test Discussion'],
            ['description', 'Test Description'],
            ['p', 'moderator-pubkey', '', 'moderator']
          ],
          content: 'Test Description',
          pubkey: 'author-pubkey',
          created_at: Math.floor(Date.now() / 1000),
        }]),
        getDiscussionPosts: jest.fn().mockResolvedValue([]),
        getApprovals: jest.fn().mockResolvedValue([]),
        getEvaluationsForPosts: jest.fn().mockResolvedValue([]),
        getProfile: jest.fn(),
        getEvaluations: jest.fn(),
      }),
    }));

    mockUseAuth.mockReturnValue({
      user: { 
        isLoggedIn: true, 
        pubkey: 'moderator-pubkey' 
      },
      signEvent: jest.fn(),
    });

    render(<DiscussionDetailPage />);
    
    // 編集ボタンが表示されることを確認
    await screen.findByText('会話を編集');
  });

  it('does not show edit button for unauthorized user', async () => {
    mockUseAuth.mockReturnValue({
      user: { 
        isLoggedIn: true, 
        pubkey: 'unauthorized-pubkey' 
      },
      signEvent: jest.fn(),
    });

    render(<DiscussionDetailPage />);
    
    // 編集ボタンが表示されないことを確認
    expect(screen.queryByText('会話を編集')).not.toBeInTheDocument();
  });
});