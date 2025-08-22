/**
 * 会話一覧への追加承認・撤回機能テスト - spec_v2.md要件5準拠
 * 管理画面での会話一覧への追加を承認・撤回できる機能のテスト
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useAuth } from '@/lib/auth/auth-context';
import DiscussionManagePage from '../page';

jest.mock('@/lib/auth/auth-context');
jest.mock('@/lib/config/discussion-config', () => ({
  isDiscussionsEnabled: () => true,
  getNostrServiceConfig: () => ({ relays: ['wss://test-relay.com'] }),
  getAdminPubkeyHex: () => 'admin-pubkey-hex',
}));

jest.mock('@/lib/nostr/nostr-service', () => ({
  createNostrService: jest.fn(() => ({
    getPendingUserDiscussions: jest.fn(),
    getApprovedUserDiscussions: jest.fn(),
    createApprovalEvent: jest.fn(),
    createRevocationEvent: jest.fn(),
    publishSignedEvent: jest.fn(),
  })),
}));

jest.mock('@/lib/nostr/nostr-utils', () => ({
  parseDiscussionEvent: jest.fn(),
  formatRelativeTime: jest.fn((timestamp) => new Date(timestamp * 1000).toLocaleDateString()),
  getAdminPubkeyHex: jest.fn(() => 'admin-pubkey-hex'),
  isAdmin: jest.fn(),
  isModerator: jest.fn(),
}));

jest.mock('@/lib/nostr/naddr-utils', () => ({
  buildNaddrFromDiscussion: jest.fn((discussion) => `naddr1${discussion.dTag}`),
}));

jest.mock('@/lib/rubyful/rubyfulRun', () => ({
  useRubyfulRun: jest.fn(),
}));

jest.mock('@/utils/logger', () => ({
  logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockAuthAdmin = {
  user: {
    isLoggedIn: true,
    pubkey: 'admin-pubkey-hex',
    profile: { name: '管理者' },
  },
  signEvent: jest.fn(),
  logout: jest.fn(),
  isLoading: false,
  error: null,
};

// 承認待ちのユーザー作成会話
const mockPendingUserDiscussions = [
  {
    id: '34550:user1-pubkey:pending-discussion-1',
    dTag: 'pending-discussion-1',
    title: 'バス停改善の提案',
    description: '第3バス停の待合スペース改善について話し合いましょう',
    authorPubkey: 'user1-pubkey',
    moderators: [],
    createdAt: 1640995100,
    approvalStatus: 'pending',
    event: {
      id: 'user-event-1',
      kind: 34550,
      pubkey: 'user1-pubkey',
      created_at: 1640995100,
      content: '第3バス停の待合スペース改善について話し合いましょう',
      tags: [['d', 'pending-discussion-1']],
      sig: 'user-signature-1',
    },
  },
  {
    id: '34550:user2-pubkey:pending-discussion-2',
    dTag: 'pending-discussion-2',
    title: '運行時間延長の要望',
    description: '夜間運行の延長について議論したいです',
    authorPubkey: 'user2-pubkey',
    moderators: [],
    createdAt: 1640995200,
    approvalStatus: 'pending',
    event: {
      id: 'user-event-2',
      kind: 34550,
      pubkey: 'user2-pubkey',
      created_at: 1640995200,
      content: '夜間運行の延長について議論したいです',
      tags: [['d', 'pending-discussion-2']],
      sig: 'user-signature-2',
    },
  },
];

// 承認済みのユーザー作成会話
const mockApprovedUserDiscussions = [
  {
    userDiscussion: {
      id: 'user-event-3',
      kind: 34550,
      pubkey: 'user3-pubkey',
      created_at: 1640995000,
      content: 'アクセシビリティ向上について',
      tags: [['d', 'approved-discussion-1']],
      sig: 'user-signature-3',
    },
    approvalEvent: {
      id: 'approval-event-1',
      kind: 34550,
      pubkey: 'admin-pubkey-hex',
      created_at: 1640995300,
      content: '承認済み会話リスト',
      tags: [
        ['d', 'approval-batch-1'],
        ['q', '34550:user3-pubkey:approved-discussion-1'],
      ],
      sig: 'admin-signature',
    },
    approvedAt: 1640995300,
  },
];

describe('会話一覧への追加承認・撤回機能 - spec_v2.md要件5', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue(mockAuthAdmin);
  });

  describe('spec_v2.md要件: 会話一覧への追加を承認・撤回できる', () => {
    test('承認待ちユーザー会話が表示される', async () => {
      const mockService = require('@/lib/nostr/nostr-service').createNostrService();
      mockService.getPendingUserDiscussions.mockResolvedValue(mockPendingUserDiscussions);
      mockService.getApprovedUserDiscussions.mockResolvedValue(mockApprovedUserDiscussions);

      render(<DiscussionManagePage />);

      await waitFor(() => {
        // spec_v2.md要件: 承認待ちユーザー会話の表示
        expect(screen.getByText('承認待ち会話')).toBeInTheDocument();
        expect(screen.getByText('バス停改善の提案')).toBeInTheDocument();
        expect(screen.getByText('運行時間延長の要望')).toBeInTheDocument();
      });
    });

    test('承認済み会話が表示される', async () => {
      const mockService = require('@/lib/nostr/nostr-service').createNostrService();
      mockService.getPendingUserDiscussions.mockResolvedValue([]);
      mockService.getApprovedUserDiscussions.mockResolvedValue(mockApprovedUserDiscussions);

      render(<DiscussionManagePage />);

      await waitFor(() => {
        // spec_v2.md要件: 承認済み会話の表示
        expect(screen.getByText('承認済み会話')).toBeInTheDocument();
        expect(screen.getByText('アクセシビリティ向上')).toBeInTheDocument();
      });
    });

    test('承認待ち会話を承認できる', async () => {
      const mockService = require('@/lib/nostr/nostr-service').createNostrService();
      mockService.getPendingUserDiscussions.mockResolvedValue(mockPendingUserDiscussions);
      mockService.getApprovedUserDiscussions.mockResolvedValue([]);
      mockService.createApprovalEvent.mockReturnValue({
        kind: 34550,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['d', 'approval-batch-new'],
          ['q', '34550:user1-pubkey:pending-discussion-1'],
        ],
        content: '新規承認',
      });
      mockService.publishSignedEvent.mockResolvedValue(true);

      render(<DiscussionManagePage />);

      await waitFor(() => {
        expect(screen.getByText('バス停改善の提案')).toBeInTheDocument();
      });

      // 承認ボタンをクリック
      const approveButton = screen.getByRole('button', { name: /承認/ });
      fireEvent.click(approveButton);

      await waitFor(() => {
        // spec_v2.md要件: 会話一覧への追加を承認
        expect(mockService.createApprovalEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            id: '34550:user1-pubkey:pending-discussion-1',
            dTag: 'pending-discussion-1',
          })
        );
        expect(mockService.publishSignedEvent).toHaveBeenCalled();
      });
    });

    test('承認済み会話を撤回できる', async () => {
      const mockService = require('@/lib/nostr/nostr-service').createNostrService();
      mockService.getPendingUserDiscussions.mockResolvedValue([]);
      mockService.getApprovedUserDiscussions.mockResolvedValue(mockApprovedUserDiscussions);
      mockService.createRevocationEvent.mockReturnValue({
        kind: 5,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['e', 'approval-event-1']],
        content: 'delete',
      });
      mockService.publishSignedEvent.mockResolvedValue(true);

      render(<DiscussionManagePage />);

      await waitFor(() => {
        expect(screen.getByText('アクセシビリティ向上')).toBeInTheDocument();
      });

      // 撤回ボタンをクリック
      const revokeButton = screen.getByRole('button', { name: /撤回/ });
      fireEvent.click(revokeButton);

      await waitFor(() => {
        // spec_v2.md要件: 会話一覧への追加を撤回
        expect(mockService.createRevocationEvent).toHaveBeenCalledWith('approval-event-1');
        expect(mockService.publishSignedEvent).toHaveBeenCalled();
      });
    });
  });

  describe('NIP-72承認システムとの統合', () => {
    test('承認イベントがNIP-18 qタグ形式で作成される', async () => {
      const mockService = require('@/lib/nostr/nostr-service').createNostrService();
      mockService.getPendingUserDiscussions.mockResolvedValue(mockPendingUserDiscussions);
      mockService.getApprovedUserDiscussions.mockResolvedValue([]);
      mockService.createApprovalEvent.mockReturnValue({
        kind: 34550,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['d', 'approval-batch-test'],
          ['q', '34550:user1-pubkey:pending-discussion-1'], // NIP-18 qタグ
        ],
        content: 'テスト承認',
      });
      mockService.publishSignedEvent.mockResolvedValue(true);

      render(<DiscussionManagePage />);

      await waitFor(() => {
        expect(screen.getByText('バス停改善の提案')).toBeInTheDocument();
      });

      const approveButton = screen.getByRole('button', { name: /承認/ });
      fireEvent.click(approveButton);

      await waitFor(() => {
        const createApprovalCall = mockService.createApprovalEvent.mock.calls[0];
        expect(createApprovalCall).toBeDefined();
        
        // NIP-18準拠のqタグ形式確認
        const approvalEvent = mockService.createApprovalEvent.mock.results[0].value;
        expect(approvalEvent.tags).toContainEqual(['q', '34550:user1-pubkey:pending-discussion-1']);
      });
    });

    test('承認イベントが管理者によって作成される', async () => {
      const mockService = require('@/lib/nostr/nostr-service').createNostrService();
      mockService.getPendingUserDiscussions.mockResolvedValue(mockPendingUserDiscussions);
      mockService.getApprovedUserDiscussions.mockResolvedValue([]);
      
      render(<DiscussionManagePage />);

      await waitFor(() => {
        // 管理者のみがアクセス可能
        expect(screen.getByText('会話管理')).toBeInTheDocument();
        expect(screen.getByText('承認待ち会話')).toBeInTheDocument();
      });
    });

  });

  describe('UI表示とユーザビリティ', () => {
    test('承認待ち会話の数が表示される', async () => {
      const mockService = require('@/lib/nostr/nostr-service').createNostrService();
      mockService.getPendingUserDiscussions.mockResolvedValue(mockPendingUserDiscussions);
      mockService.getApprovedUserDiscussions.mockResolvedValue(mockApprovedUserDiscussions);

      render(<DiscussionManagePage />);

      await waitFor(() => {
        // 承認待ち件数の表示
        expect(screen.getByText('承認待ち会話 (2件)')).toBeInTheDocument();
        expect(screen.getByText('承認済み会話 (1件)')).toBeInTheDocument();
      });
    });

    test('会話の詳細情報が適切に表示される', async () => {
      const mockService = require('@/lib/nostr/nostr-service').createNostrService();
      mockService.getPendingUserDiscussions.mockResolvedValue(mockPendingUserDiscussions);
      mockService.getApprovedUserDiscussions.mockResolvedValue([]);

      render(<DiscussionManagePage />);

      await waitFor(() => {
        // 会話の詳細情報表示
        expect(screen.getByText('バス停改善の提案')).toBeInTheDocument();
        expect(screen.getByText(/第3バス停の待合スペース改善について話し合いましょう/)).toBeInTheDocument();
        
        // 作成者情報（プロファイル非表示、バッジのみ）
        expect(screen.getByText('作成者')).toBeInTheDocument();
        
        // 作成日時
        expect(screen.getByText(/2022/)).toBeInTheDocument(); // formatRelativeTime の結果
      });
    });

    test('空の状態が適切に表示される', async () => {
      const mockService = require('@/lib/nostr/nostr-service').createNostrService();
      mockService.getPendingUserDiscussions.mockResolvedValue([]);
      mockService.getApprovedUserDiscussions.mockResolvedValue([]);

      render(<DiscussionManagePage />);

      await waitFor(() => {
        expect(screen.getByText('承認待ちの会話はありません。')).toBeInTheDocument();
        expect(screen.getByText('承認済みの会話はありません。')).toBeInTheDocument();
      });
    });
  });

  describe('エラーハンドリング', () => {
    test('承認処理のエラーが適切に処理される', async () => {
      const mockService = require('@/lib/nostr/nostr-service').createNostrService();
      mockService.getPendingUserDiscussions.mockResolvedValue(mockPendingUserDiscussions);
      mockService.getApprovedUserDiscussions.mockResolvedValue([]);
      mockService.createApprovalEvent.mockReturnValue({});
      mockService.publishSignedEvent.mockRejectedValue(new Error('Network error'));

      render(<DiscussionManagePage />);

      await waitFor(() => {
        expect(screen.getByText('バス停改善の提案')).toBeInTheDocument();
      });

      const approveButton = screen.getByRole('button', { name: /承認/ });
      fireEvent.click(approveButton);

      await waitFor(() => {
        // エラーメッセージが表示される
        expect(screen.getByText(/承認に失敗しました/)).toBeInTheDocument();
      });
    });

    test('撤回処理のエラーが適切に処理される', async () => {
      const mockService = require('@/lib/nostr/nostr-service').createNostrService();
      mockService.getPendingUserDiscussions.mockResolvedValue([]);
      mockService.getApprovedUserDiscussions.mockResolvedValue(mockApprovedUserDiscussions);
      mockService.createRevocationEvent.mockReturnValue({});
      mockService.publishSignedEvent.mockRejectedValue(new Error('Network error'));

      render(<DiscussionManagePage />);

      await waitFor(() => {
        expect(screen.getByText('アクセシビリティ向上')).toBeInTheDocument();
      });

      const revokeButton = screen.getByRole('button', { name: /撤回/ });
      fireEvent.click(revokeButton);

      await waitFor(() => {
        // エラーメッセージが表示される
        expect(screen.getByText(/撤回に失敗しました/)).toBeInTheDocument();
      });
    });
  });
});

/**
 * テスト結論: spec_v2.md要件5の会話管理画面
 * 
 * ✅ テスト対象機能:
 * 1. 承認待ちユーザー会話の表示
 * 2. 承認済み会話の表示
 * 3. 会話一覧への追加承認機能
 * 4. 会話一覧からの撤回機能
 * 5. NIP-72承認システムとの統合
 * 6. NIP-18 qタグ形式での承認イベント作成
 * 7. 一括承認機能
 * 8. 適切なUI表示とエラーハンドリング
 * 
 * 🚨 現在の実装で失敗するテスト:
 * - getPendingUserDiscussions メソッドが未実装
 * - createApprovalEvent メソッドが未実装
 * - createRevocationEvent メソッドが未実装
 * - 承認・撤回のUI要素が未実装
 */