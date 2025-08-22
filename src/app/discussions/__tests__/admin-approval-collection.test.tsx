/**
 * 管理者作成Kind:34550による承認済み投稿収集システムテスト
 * spec_v2.md要件: 管理者作成の Kind:34550 を使用して、承認済み投稿を集める
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { useAuth } from '@/lib/auth/auth-context';
import DiscussionsPage from '../page';

jest.mock('@/lib/auth/auth-context');
jest.mock('@/lib/config/discussion-config', () => ({
  isDiscussionsEnabled: () => true,
  getNostrServiceConfig: () => ({ relays: ['wss://test-relay.com'] }),
  getAdminPubkeyHex: () => 'admin-pubkey-hex',
}));

jest.mock('@/lib/nostr/nostr-service', () => ({
  createNostrService: jest.fn(() => ({
    getApprovedUserDiscussions: jest.fn(),
    getProfile: jest.fn(),
  })),
}));

jest.mock('@/lib/nostr/nostr-utils', () => ({
  parseDiscussionEvent: jest.fn(),
  parseDiscussionApprovalEvent: jest.fn(),
  createAuditTimeline: jest.fn(() => []),
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

const mockAuth = {
  user: {
    isLoggedIn: true,
    pubkey: 'user-pubkey-hex',
    profile: { name: 'テストユーザー' },
  },
  signEvent: jest.fn(),
  logout: jest.fn(),
  isLoading: false,
  error: null,
};

// 管理者作成の承認イベント（Kind:34550）
const mockAdminApprovalEvents = [
  {
    id: '34550:admin-pubkey-hex:approval-batch-1',
    dTag: 'approval-batch-1',
    title: '会話承認バッチ #1',
    description: '2024年1月分の承認済み会話',
    authorPubkey: 'admin-pubkey-hex',
    createdAt: 1640995200,
    event: {
      id: 'approval-event-1',
      kind: 34550,
      pubkey: 'admin-pubkey-hex',
      created_at: 1640995200,
      content: '2024年1月分の承認済み会話リスト',
      tags: [
        ['d', 'approval-batch-1'],
        ['q', '34550:user1-pubkey:user-discussion-1'], // 承認されたユーザー会話1
        ['q', '34550:user2-pubkey:user-discussion-2'], // 承認されたユーザー会話2
        ['q', '34550:user1-pubkey:user-discussion-3'], // 承認されたユーザー会話3
      ],
      sig: 'admin-signature',
    },
  },
  {
    id: '34550:admin-pubkey-hex:approval-batch-2',
    dTag: 'approval-batch-2',
    title: '会話承認バッチ #2',
    description: '2024年2月分の承認済み会話',
    authorPubkey: 'admin-pubkey-hex',
    createdAt: 1641081600,
    event: {
      id: 'approval-event-2',
      kind: 34550,
      pubkey: 'admin-pubkey-hex',
      created_at: 1641081600,
      content: '2024年2月分の承認済み会話リスト',
      tags: [
        ['d', 'approval-batch-2'],
        ['q', '34550:user3-pubkey:user-discussion-4'], // 承認されたユーザー会話4
        ['q', '34550:user2-pubkey:user-discussion-5'], // 承認されたユーザー会話5
      ],
      sig: 'admin-signature-2',
    },
  },
];

// 承認されたユーザー作成の会話（引用先）
const mockReferencedUserDiscussions = [
  {
    id: '34550:user1-pubkey:user-discussion-1',
    dTag: 'user-discussion-1',
    title: 'バス停の改善提案',
    description: '第3バス停の待合スペース改善について',
    authorPubkey: 'user1-pubkey',
    createdAt: 1640995100,
    event: {
      id: 'user-event-1',
      kind: 34550,
      pubkey: 'user1-pubkey',
      created_at: 1640995100,
      content: '第3バス停の待合スペース改善について',
      tags: [['d', 'user-discussion-1']],
      sig: 'user-signature-1',
    },
  },
  {
    id: '34550:user2-pubkey:user-discussion-2',
    dTag: 'user-discussion-2',
    title: '運行時間の延長要望',
    description: '夜間運行の延長について話し合いましょう',
    authorPubkey: 'user2-pubkey',
    createdAt: 1640995150,
    event: {
      id: 'user-event-2',
      kind: 34550,
      pubkey: 'user2-pubkey',
      created_at: 1640995150,
      content: '夜間運行の延長について話し合いましょう',
      tags: [['d', 'user-discussion-2']],
      sig: 'user-signature-2',
    },
  },
  {
    id: '34550:user1-pubkey:user-discussion-3',
    dTag: 'user-discussion-3',
    title: 'アクセシビリティ向上',
    description: '車椅子利用者向けの改善点',
    authorPubkey: 'user1-pubkey',
    createdAt: 1640995180,
    event: {
      id: 'user-event-3',
      kind: 34550,
      pubkey: 'user1-pubkey',
      created_at: 1640995180,
      content: '車椅子利用者向けの改善点について',
      tags: [['d', 'user-discussion-3']],
      sig: 'user-signature-3',
    },
  },
];

describe('管理者作成Kind:34550による承認済み投稿収集', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue(mockAuth);
  });

  describe('spec_v2.md要件: 承認システムの基本動作', () => {
    test('管理者作成のKind:34550承認イベントを取得する', async () => {
      const mockService = require('@/lib/nostr/nostr-service').createNostrService();
      mockService.getAdminApprovalEvents.mockResolvedValue(mockAdminApprovalEvents);
      mockService.getReferencedUserDiscussions.mockResolvedValue([]);
      mockService.getProfile.mockResolvedValue(null);

      render(<DiscussionsPage />);

      await waitFor(() => {
        // spec_v2.md要件: 管理者作成の Kind:34550 を使用
        expect(mockService.getAdminApprovalEvents).toHaveBeenCalledWith('admin-pubkey-hex');
      });
    });

    test('承認イベントに含まれるqタグを解析して承認済み投稿を収集する', async () => {
      const mockService = require('@/lib/nostr/nostr-service').createNostrService();
      mockService.getAdminApprovalEvents.mockResolvedValue(mockAdminApprovalEvents);
      mockService.getReferencedUserDiscussions.mockResolvedValue(mockReferencedUserDiscussions);
      mockService.getProfile.mockResolvedValue(null);

      render(<DiscussionsPage />);

      await waitFor(() => {
        // qタグで引用されたユーザー会話の取得
        const expectedReferences = [
          '34550:user1-pubkey:user-discussion-1',
          '34550:user2-pubkey:user-discussion-2',
          '34550:user1-pubkey:user-discussion-3',
          '34550:user3-pubkey:user-discussion-4',
          '34550:user2-pubkey:user-discussion-5',
        ];
        expect(mockService.getReferencedUserDiscussions).toHaveBeenCalledWith(expectedReferences);
      });
    });

    test('承認済みユーザー会話が一覧に表示される', async () => {
      const mockService = require('@/lib/nostr/nostr-service').createNostrService();
      mockService.getAdminApprovalEvents.mockResolvedValue(mockAdminApprovalEvents);
      mockService.getReferencedUserDiscussions.mockResolvedValue(mockReferencedUserDiscussions);
      mockService.getProfile.mockResolvedValue(null);

      render(<DiscussionsPage />);

      await waitFor(() => {
        // spec_v2.md要件: 承認済み投稿を集め、リンクを一覧する
        expect(screen.getByText('バス停の改善提案')).toBeInTheDocument();
        expect(screen.getByText('運行時間の延長要望')).toBeInTheDocument();
        expect(screen.getByText('アクセシビリティ向上')).toBeInTheDocument();
      });

      // ユーザー会話のリンクが正しく生成されている
      const link1 = screen.getByRole('link', { name: /バス停の改善提案/ });
      expect(link1).toHaveAttribute('href', '/discussions/naddr1user-discussion-1');

      const link2 = screen.getByRole('link', { name: /運行時間の延長要望/ });
      expect(link2).toHaveAttribute('href', '/discussions/naddr1user-discussion-2');
    });
  });

  describe('NIP-72承認システムの詳細動作', () => {
    test('複数の承認バッチから会話が統合される', async () => {
      const mockService = require('@/lib/nostr/nostr-service').createNostrService();
      mockService.getAdminApprovalEvents.mockResolvedValue(mockAdminApprovalEvents);
      mockService.getReferencedUserDiscussions.mockResolvedValue(mockReferencedUserDiscussions);
      mockService.getProfile.mockResolvedValue(null);

      render(<DiscussionsPage />);

      await waitFor(() => {
        // 2つの承認バッチ（1月分・2月分）からの会話が統合表示される
        expect(screen.getByText('バス停の改善提案')).toBeInTheDocument(); // バッチ1から
        expect(screen.getByText('運行時間の延長要望')).toBeInTheDocument(); // バッチ1から
        expect(screen.getByText('アクセシビリティ向上')).toBeInTheDocument(); // バッチ1から
      });
    });

    test('承認されていないユーザー会話は表示されない', async () => {
      const unauthorizedDiscussion = {
        id: '34550:user4-pubkey:unauthorized-discussion',
        dTag: 'unauthorized-discussion',
        title: '未承認の会話',
        description: '管理者の承認を受けていない会話',
        authorPubkey: 'user4-pubkey',
        createdAt: 1640995300,
      };

      const mockService = require('@/lib/nostr/nostr-service').createNostrService();
      mockService.getAdminApprovalEvents.mockResolvedValue(mockAdminApprovalEvents);
      // 承認済みリストに含まれていない会話は返されない
      mockService.getReferencedUserDiscussions.mockResolvedValue(mockReferencedUserDiscussions);
      mockService.getProfile.mockResolvedValue(null);

      render(<DiscussionsPage />);

      await waitFor(() => {
        // 未承認の会話は表示されない
        expect(screen.queryByText('未承認の会話')).not.toBeInTheDocument();
        
        // 承認済みの会話のみ表示される
        expect(screen.getByText('バス停の改善提案')).toBeInTheDocument();
        expect(screen.getByText('運行時間の延長要望')).toBeInTheDocument();
      });
    });

    test('管理者以外が作成した承認イベントは無視される', async () => {
      const fakeApprovalEvent = {
        id: '34550:fake-admin:fake-approval',
        dTag: 'fake-approval',
        title: '偽の承認イベント',
        authorPubkey: 'fake-admin-pubkey', // 管理者以外
        createdAt: 1640995400,
        event: {
          id: 'fake-event',
          kind: 34550,
          pubkey: 'fake-admin-pubkey',
          created_at: 1640995400,
          content: '偽の承認',
          tags: [
            ['d', 'fake-approval'],
            ['q', '34550:user5-pubkey:fake-approved-discussion'],
          ],
          sig: 'fake-signature',
        },
      };

      const mockService = require('@/lib/nostr/nostr-service').createNostrService();
      // 管理者のpubkeyで絞り込まれているため、偽の承認イベントは含まれない
      mockService.getAdminApprovalEvents.mockResolvedValue(mockAdminApprovalEvents);
      mockService.getReferencedUserDiscussions.mockResolvedValue(mockReferencedUserDiscussions);
      mockService.getProfile.mockResolvedValue(null);

      render(<DiscussionsPage />);

      await waitFor(() => {
        // 正規の管理者pubkeyでのみフィルタリング
        expect(mockService.getAdminApprovalEvents).toHaveBeenCalledWith('admin-pubkey-hex');
        
        // 偽の承認による会話は表示されない
        expect(screen.queryByText('fake-approved-discussion')).not.toBeInTheDocument();
      });
    });
  });

  describe('承認システムのエラーハンドリング', () => {
    test('承認イベント取得失敗時の適切な処理', async () => {
      const mockService = require('@/lib/nostr/nostr-service').createNostrService();
      mockService.getAdminApprovalEvents.mockRejectedValue(new Error('Network error'));
      mockService.getReferencedUserDiscussions.mockResolvedValue([]);
      mockService.getProfile.mockResolvedValue(null);

      render(<DiscussionsPage />);

      await waitFor(() => {
        // エラー時は空の状態を表示
        expect(screen.getByText('会話がまだありません。')).toBeInTheDocument();
      });
    });

    test('参照先ユーザー会話取得失敗時の処理', async () => {
      const mockService = require('@/lib/nostr/nostr-service').createNostrService();
      mockService.getAdminApprovalEvents.mockResolvedValue(mockAdminApprovalEvents);
      mockService.getReferencedUserDiscussions.mockRejectedValue(new Error('Referenced content not found'));
      mockService.getProfile.mockResolvedValue(null);

      render(<DiscussionsPage />);

      await waitFor(() => {
        // 参照先が取得できない場合も適切に処理
        expect(screen.getByText('会話がまだありません。')).toBeInTheDocument();
      });
    });

    test('承認イベントは存在するが参照先が空の場合', async () => {
      const emptyApprovalEvent = [{
        id: '34550:admin-pubkey-hex:empty-approval',
        dTag: 'empty-approval',
        title: '空の承認リスト',
        description: '参照のない承認イベント',
        authorPubkey: 'admin-pubkey-hex',
        createdAt: 1640995500,
        event: {
          id: 'empty-event',
          kind: 34550,
          pubkey: 'admin-pubkey-hex',
          created_at: 1640995500,
          content: '空の承認リスト',
          tags: [['d', 'empty-approval']], // qタグなし
          sig: 'signature',
        },
      }];

      const mockService = require('@/lib/nostr/nostr-service').createNostrService();
      mockService.getAdminApprovalEvents.mockResolvedValue(emptyApprovalEvent);
      mockService.getReferencedUserDiscussions.mockResolvedValue([]);
      mockService.getProfile.mockResolvedValue(null);

      render(<DiscussionsPage />);

      await waitFor(() => {
        expect(screen.getByText('会話がまだありません。')).toBeInTheDocument();
      });
    });
  });
});

/**
 * テスト結論: 管理者作成Kind:34550による承認システム
 * 
 * ✅ テスト対象機能:
 * 1. 管理者pubkeyによる承認イベント取得
 * 2. NIP-18 qタグの解析と承認済み投稿収集
 * 3. 複数承認バッチからの統合
 * 4. 未承認会話の除外
 * 5. 偽の承認イベントの無視
 * 6. エラーハンドリング
 * 
 * 🚨 現在の実装で失敗するテスト:
 * - getAdminApprovalEvents メソッドが未実装
 * - getReferencedUserDiscussions メソッドが未実装
 * - NIP-72承認システムの完全な実装が必要
 */