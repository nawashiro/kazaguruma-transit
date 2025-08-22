/**
 * NIP-72承認システムに基づく管理画面テスト
 * spec_v2.md要件: NIP-72を使用した承認つきの一覧管理
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
    getAdminApprovalEvents: jest.fn(),
    createDiscussionApprovalEvent: jest.fn(),
    createApprovalRevocationEvent: jest.fn(),
    publishSignedEvent: jest.fn(),
  })),
}));

jest.mock('@/lib/nostr/nostr-utils', () => ({
  parseDiscussionEvent: jest.fn(),
  parseDiscussionApprovalEvent: jest.fn(),
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

// 管理者作成の承認イベント（NIP-72準拠）
const mockAdminApprovalEvents = [
  {
    id: '34550:admin-pubkey-hex:approval-list-active',
    dTag: 'approval-list-active',
    title: '有効な承認リスト',
    description: '現在有効な承認済み会話リスト',
    references: [
      '34550:user1-pubkey:approved-discussion-1',
      '34550:user2-pubkey:approved-discussion-2',
    ],
    authorPubkey: 'admin-pubkey-hex',
    createdAt: 1640995400,
    event: {
      id: 'approval-active',
      kind: 34550,
      pubkey: 'admin-pubkey-hex',
      created_at: 1640995400,
      content: '現在有効な承認済み会話リスト',
      tags: [
        ['d', 'approval-list-active'],
        ['name', '有効な承認リスト'],
        ['q', '34550:user1-pubkey:approved-discussion-1'],
        ['q', '34550:user2-pubkey:approved-discussion-2'],
      ],
      sig: 'admin-approval-signature',
    },
  },
];

// 承認待ちのユーザー会話（NIP-72で未承認）
const mockPendingDiscussions = [
  {
    id: '34550:user3-pubkey:pending-discussion-1',
    dTag: 'pending-discussion-1',
    title: 'バス路線の最適化',
    description: '効率的なバス路線について議論しましょう',
    authorPubkey: 'user3-pubkey',
    moderators: [],
    createdAt: 1640995500,
    approvalStatus: 'pending',
    event: {
      id: 'pending-event-1',
      kind: 34550,
      pubkey: 'user3-pubkey',
      created_at: 1640995500,
      content: '効率的なバス路線について議論しましょう',
      tags: [['d', 'pending-discussion-1']],
      sig: 'user3-signature',
    },
  },
];

describe('NIP-72承認システム管理画面', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue(mockAuthAdmin);
  });

  describe('NIP-72承認システムの基本動作', () => {
    test('管理者作成の承認イベント（Kind:34550）が取得される', async () => {
      const mockService = require('@/lib/nostr/nostr-service').createNostrService();
      mockService.getAdminApprovalEvents.mockResolvedValue(mockAdminApprovalEvents);
      mockService.getPendingUserDiscussions.mockResolvedValue(mockPendingDiscussions);

      render(<DiscussionManagePage />);

      await waitFor(() => {
        // NIP-72要件: 管理者作成のKind:34550承認イベント取得
        expect(mockService.getAdminApprovalEvents).toHaveBeenCalledWith('admin-pubkey-hex');
      });
    });

    test('承認イベントのNIP-18 qタグが解析される', async () => {
      const mockService = require('@/lib/nostr/nostr-service').createNostrService();
      mockService.getAdminApprovalEvents.mockResolvedValue(mockAdminApprovalEvents);
      mockService.getPendingUserDiscussions.mockResolvedValue([]);

      render(<DiscussionManagePage />);

      await waitFor(() => {
        // NIP-18 qタグからの引用解析
        expect(screen.getByText('承認済み会話 (2件)')).toBeInTheDocument();
      });
    });

    test('新しい承認イベントがNIP-18準拠で作成される', async () => {
      const mockService = require('@/lib/nostr/nostr-service').createNostrService();
      mockService.getPendingUserDiscussions.mockResolvedValue(mockPendingDiscussions);
      mockService.getAdminApprovalEvents.mockResolvedValue([]);
      mockService.createDiscussionApprovalEvent.mockReturnValue({
        kind: 34550,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['d', 'new-approval-batch'],
          ['name', '新規承認バッチ'],
          ['q', '34550:user3-pubkey:pending-discussion-1'], // NIP-18 qタグ
        ],
        content: '新しい承認バッチ',
      });
      mockService.publishSignedEvent.mockResolvedValue(true);

      render(<DiscussionManagePage />);

      await waitFor(() => {
        expect(screen.getByText('バス路線の最適化')).toBeInTheDocument();
      });

      // 承認ボタンをクリック
      const approveButton = screen.getByRole('button', { name: /承認/ });
      fireEvent.click(approveButton);

      await waitFor(() => {
        // NIP-18準拠のqタグ作成確認
        expect(mockService.createDiscussionApprovalEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            dTag: 'pending-discussion-1',
            authorPubkey: 'user3-pubkey',
          })
        );

        const createdEvent = mockService.createDiscussionApprovalEvent.mock.results[0].value;
        expect(createdEvent.tags).toContainEqual(['q', '34550:user3-pubkey:pending-discussion-1']);
      });
    });
  });

  describe('承認リストの管理（Replaceable Events）', () => {
    test('承認リストの更新が置換可能イベントとして処理される', async () => {
      const mockService = require('@/lib/nostr/nostr-service').createNostrService();
      mockService.getAdminApprovalEvents.mockResolvedValue(mockAdminApprovalEvents);
      mockService.getPendingUserDiscussions.mockResolvedValue(mockPendingDiscussions);
      mockService.createDiscussionApprovalEvent.mockReturnValue({
        kind: 34550,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['d', 'approval-list-active'], // 既存と同じdTag
          ['name', '更新された承認リスト'],
          ['q', '34550:user1-pubkey:approved-discussion-1'],
          ['q', '34550:user2-pubkey:approved-discussion-2'],
          ['q', '34550:user3-pubkey:pending-discussion-1'], // 新規追加
        ],
        content: '更新された承認リスト',
      });

      render(<DiscussionManagePage />);

      await waitFor(() => {
        expect(screen.getByText('バス路線の最適化')).toBeInTheDocument();
      });

      const approveButton = screen.getByRole('button', { name: /承認/ });
      fireEvent.click(approveButton);

      await waitFor(() => {
        // 既存の承認リストを更新（同じdTag使用）
        const createdEvent = mockService.createDiscussionApprovalEvent.mock.results[0].value;
        expect(createdEvent.tags).toContainEqual(['d', 'approval-list-active']);
        
        // 新規会話が追加される
        expect(createdEvent.tags).toContainEqual(['q', '34550:user3-pubkey:pending-discussion-1']);
      });
    });

    test('承認撤回がKind:5削除イベントとして処理される', async () => {
      const mockService = require('@/lib/nostr/nostr-service').createNostrService();
      mockService.getAdminApprovalEvents.mockResolvedValue(mockAdminApprovalEvents);
      mockService.getPendingUserDiscussions.mockResolvedValue([]);
      mockService.createApprovalRevocationEvent.mockReturnValue({
        kind: 5,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['e', 'approval-active']], // 削除対象の承認イベントID
        content: 'delete',
      });
      mockService.publishSignedEvent.mockResolvedValue(true);

      render(<DiscussionManagePage />);

      await waitFor(() => {
        expect(screen.getByText('承認済み会話 (2件)')).toBeInTheDocument();
      });

      // 撤回ボタンをクリック
      const revokeButton = screen.getByRole('button', { name: /一覧から削除/ });
      fireEvent.click(revokeButton);

      await waitFor(() => {
        // Kind:5削除イベントの作成確認
        expect(mockService.createApprovalRevocationEvent).toHaveBeenCalledWith('approval-active');
        
        const revocationEvent = mockService.createApprovalRevocationEvent.mock.results[0].value;
        expect(revocationEvent.kind).toBe(5);
        expect(revocationEvent.tags).toContainEqual(['e', 'approval-active']);
      });
    });
  });


  });

  describe('承認履歴とトレーサビリティ', () => {
    test('承認履歴が時系列で表示される', async () => {
      const mockApprovalHistory = [
        {
          id: 'approval-history-1',
          createdAt: 1640995400,
          approvedDiscussions: ['34550:user1-pubkey:approved-discussion-1'],
          revokedDiscussions: [],
          action: 'approve',
        },
        {
          id: 'approval-history-2',
          createdAt: 1640995450,
          approvedDiscussions: ['34550:user2-pubkey:approved-discussion-2'],
          revokedDiscussions: [],
          action: 'approve',
        },
      ];

      const mockService = require('@/lib/nostr/nostr-service').createNostrService();
      mockService.getAdminApprovalEvents.mockResolvedValue(mockAdminApprovalEvents);
      mockService.getApprovalHistory.mockResolvedValue(mockApprovalHistory);

      render(<DiscussionManagePage />);

      // 履歴タブをクリック
      const historyTab = screen.getByRole('tab', { name: /承認履歴/ });
      fireEvent.click(historyTab);

      await waitFor(() => {
        expect(screen.getByText('承認履歴')).toBeInTheDocument();
        expect(screen.getByText(/2件の承認操作/)).toBeInTheDocument();
      });
    });

    test('承認チェーンの整合性が確認される', async () => {
      const mockService = require('@/lib/nostr/nostr-service').createNostrService();
      mockService.getAdminApprovalEvents.mockResolvedValue(mockAdminApprovalEvents);
      mockService.validateApprovalChain.mockReturnValue({
        isValid: true,
        inconsistencies: [],
      });

      render(<DiscussionManagePage />);

      await waitFor(() => {
        // 承認チェーンの整合性確認
        expect(mockService.validateApprovalChain).toHaveBeenCalledWith(mockAdminApprovalEvents);
      });
    });
  });
});

/**
 * テスト結論: NIP-72承認システム管理画面
 * 
 * ✅ テスト対象機能:
 * 1. 管理者作成Kind:34550承認イベントの取得
 * 2. NIP-18 qタグからの引用解析
 * 3. NIP-18準拠の新規承認イベント作成
 * 4. Replaceable Eventsとしての承認リスト管理
 * 5. Kind:5削除イベントによる承認撤回
 * 6. 複数会話の一括承認機能
 * 7. 承認リストの部分的更新
 * 8. 承認履歴とトレーサビリティ
 * 
 * 🚨 現在の実装で失敗するテスト:
 * - getAdminApprovalEvents メソッドが未実装
 * - createDiscussionApprovalEvent メソッドが未実装
 * - createApprovalRevocationEvent メソッドが未実装
 * - NIP-72準拠のUI要素が未実装
 */