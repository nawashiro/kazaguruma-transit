/**
 * 監査ログデータ取得分離のテスト
 * 会話一覧と監査ログのデータ取得が独立していることを確認
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DiscussionsPage from '../page';
import { useAuth } from '@/lib/auth/auth-context';
import { createNostrService } from '@/lib/nostr/nostr-service';

// モック
jest.mock('@/lib/auth/auth-context');
jest.mock('@/lib/config/discussion-config', () => ({
  isDiscussionsEnabled: () => true,
  getNostrServiceConfig: () => ({}),
}));
jest.mock('@/lib/nostr/nostr-service');
jest.mock('@/lib/nostr/nostr-utils', () => ({
  parseDiscussionEvent: jest.fn().mockReturnValue(null),
  parsePostEvent: jest.fn().mockReturnValue(null),
  parseApprovalEvent: jest.fn().mockReturnValue(null),
  createAuditTimeline: jest.fn().mockReturnValue([]),
  formatRelativeTime: () => '1時間前',
  getAdminPubkeyHex: () => 'admin-pubkey',
  isAdmin: jest.fn().mockReturnValue(false),
}));
jest.mock('@/lib/nostr/naddr-utils', () => ({
  extractDiscussionFromNaddr: jest.fn().mockReturnValue({
    authorPubkey: 'test-author',
    dTag: 'test-discussion',
    discussionId: 'test-discussion-id',
  }),
  buildNaddrFromDiscussion: jest.fn(),
}));
jest.mock('@/lib/rubyful/rubyfulRun', () => ({
  useRubyfulRun: jest.fn(),
}));
jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockCreateNostrService = createNostrService as jest.MockedFunction<typeof createNostrService>;

// 環境変数をモック
const originalEnv = process.env;
beforeAll(() => {
  process.env = {
    ...originalEnv,
    NEXT_PUBLIC_DISCUSSION_LIST_NADDR: 'naddr1test',
  };
});

afterAll(() => {
  process.env = originalEnv;
});

describe('監査ログデータ取得分離', () => {
  let mockNostrService: any;

  beforeEach(() => {
    mockNostrService = {
      getEvents: jest.fn().mockResolvedValue([]),
      getDiscussionPosts: jest.fn().mockResolvedValue([]),
      getApprovals: jest.fn().mockResolvedValue([]),
      getReferencedUserDiscussions: jest.fn().mockResolvedValue([]),
      getProfile: jest.fn().mockResolvedValue(null),
    };

    mockCreateNostrService.mockReturnValue(mockNostrService);

    mockUseAuth.mockReturnValue({
      user: {
        pubkey: 'test-user-pubkey',
        isLoggedIn: false,
      },
      signEvent: jest.fn(),
    } as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('初期ロード時は会話一覧のデータのみ取得される', async () => {
    render(<DiscussionsPage />);

    await waitFor(() => {
      // 会話一覧用のデータ取得が呼ばれている
      expect(mockNostrService.getEvents).toHaveBeenCalledTimes(1);
      expect(mockNostrService.getDiscussionPosts).toHaveBeenCalledTimes(1);
      expect(mockNostrService.getApprovals).toHaveBeenCalledTimes(1);
      expect(mockNostrService.getReferencedUserDiscussions).toHaveBeenCalledTimes(1);
    });

    // 初期状態では会話一覧タブがアクティブ
    expect(screen.getByRole('tab', { name: '意見交換タブを開く' })).toHaveClass('btn-active');
  });

  test('監査ログタブをクリックした時だけ監査ログのデータが追加取得される', async () => {
    render(<DiscussionsPage />);

    // 初期ロードを待つ
    await waitFor(() => {
      expect(mockNostrService.getDiscussionPosts).toHaveBeenCalledTimes(1);
    });

    // モックをクリア
    jest.clearAllMocks();

    // 監査ログタブをクリック
    fireEvent.click(screen.getByRole('tab', { name: '監査ログを開く' }));

    await waitFor(() => {
      // 監査ログ用の追加データ取得が呼ばれている
      expect(mockNostrService.getDiscussionPosts).toHaveBeenCalledTimes(1);
      expect(mockNostrService.getApprovals).toHaveBeenCalledTimes(1);
      expect(mockNostrService.getReferencedUserDiscussions).toHaveBeenCalledTimes(1);
      // 会話一覧のメタデータ取得は呼ばれない（監査ログでは不要）
      expect(mockNostrService.getEvents).not.toHaveBeenCalled();
    });

    // 監査ログタブがアクティブになっている
    expect(screen.getByRole('tab', { name: '監査ログを開く' })).toHaveClass('btn-active');
  });

  test('監査ログタブを複数回クリックしてもデータ取得は1回だけ', async () => {
    render(<DiscussionsPage />);

    // 初期ロードを待つ
    await waitFor(() => {
      expect(mockNostrService.getDiscussionPosts).toHaveBeenCalledTimes(1);
    });

    // モックをクリア
    jest.clearAllMocks();

    // 監査ログタブを複数回クリック
    fireEvent.click(screen.getByRole('tab', { name: '監査ログを開く' }));
    fireEvent.click(screen.getByRole('tab', { name: '監査ログを開く' }));
    fireEvent.click(screen.getByRole('tab', { name: '監査ログを開く' }));

    await waitFor(() => {
      // 1回だけ呼ばれる
      expect(mockNostrService.getDiscussionPosts).toHaveBeenCalledTimes(1);
      expect(mockNostrService.getApprovals).toHaveBeenCalledTimes(1);
      expect(mockNostrService.getReferencedUserDiscussions).toHaveBeenCalledTimes(1);
    });
  });

  test('会話一覧タブと監査ログタブを行き来してもデータ取得は最初の1回だけ', async () => {
    render(<DiscussionsPage />);

    // 初期ロードを待つ
    await waitFor(() => {
      expect(mockNostrService.getDiscussionPosts).toHaveBeenCalledTimes(1);
    });

    // モックをクリア
    jest.clearAllMocks();

    // タブを行き来
    fireEvent.click(screen.getByRole('tab', { name: '監査ログを開く' }));
    await waitFor(() => {
      expect(mockNostrService.getDiscussionPosts).toHaveBeenCalledTimes(1);
    });

    // 会話一覧に戻る - 追加のデータ取得は発生しない
    fireEvent.click(screen.getByRole('tab', { name: '意見交換タブを開く' }));
    expect(mockNostrService.getDiscussionPosts).toHaveBeenCalledTimes(1);

    // 再び監査ログに - 追加のデータ取得は発生しない
    fireEvent.click(screen.getByRole('tab', { name: '監査ログを開く' }));
    expect(mockNostrService.getDiscussionPosts).toHaveBeenCalledTimes(1);
  });

  test('ローディング状態が独立して管理される', async () => {
    render(<DiscussionsPage />);

    // 監査ログタブをクリック
    fireEvent.click(screen.getByRole('tab', { name: '監査ログを開く' }));

    // 監査ログのローディング状態を確認
    expect(screen.getByText('監査ログ')).toBeInTheDocument();
    // ローディングアニメーションが表示される（データが未ロードの場合）
  });
});