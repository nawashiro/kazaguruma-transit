/**
 * NIP-72承認システムに基づく会話一覧テスト - spec_v2.md準拠
 * 管理者作成のKind:34550で承認されたユーザー作成Kind:34550への引用リンクを一覧する
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { useAuth } from '@/lib/auth/auth-context';
import DiscussionsPage from '../page';

jest.mock('@/lib/auth/auth-context', () => ({
  useAuth: jest.fn(),
}));

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
  parseDiscussionRequestEvent: jest.fn(),
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
  logger: {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
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

// spec_v2.md要件に基づくテストデータ
// 管理者作成のKind:34550（承認リスト）がユーザー作成Kind:34550を引用している
const mockApprovedReferences = [
  {
    id: '34550:admin-pubkey-hex:approved-list-1',
    dTag: 'approved-list-1',
    title: '承認済み会話一覧 #1',
    description: 'ユーザー作成会話の承認リスト',
    authorPubkey: 'admin-pubkey-hex',
    createdAt: 1640995200,
    references: [
      {
        // NIP-18 q タグで引用されたユーザー作成の会話
        targetId: '34550:user1-pubkey:discussion-alpha',
        targetDTag: 'discussion-alpha',
        targetTitle: 'ユーザー会話α',
        targetDescription: 'ユーザーが作成した会話α',
        targetAuthorPubkey: 'user1-pubkey',
        targetCreatedAt: 1640995100,
        naddr: 'naddr1discussion-alpha',
      },
      {
        targetId: '34550:user2-pubkey:discussion-beta',
        targetDTag: 'discussion-beta',
        targetTitle: 'ユーザー会話β',
        targetDescription: 'ユーザーが作成した会話β',
        targetAuthorPubkey: 'user2-pubkey',
        targetCreatedAt: 1640995150,
        naddr: 'naddr1discussion-beta',
      },
    ],
    event: {
      id: 'event-approved-1',
      kind: 34550,
      pubkey: 'admin-pubkey-hex',
      created_at: 1640995200,
      content: '承認済み会話リスト',
      tags: [
        ['d', 'approved-list-1'],
        ['q', '34550:user1-pubkey:discussion-alpha'], // NIP-18 q タグでの引用
        ['q', '34550:user2-pubkey:discussion-beta'],
      ],
      sig: 'signature',
    },
  },
];

describe('NIP-72承認システム会話一覧 - spec_v2.md準拠', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue(mockAuth);
  });

  describe('spec_v2.md要件1: 承認済み投稿収集システム', () => {
    test('管理者作成のKind:34550を使用した承認済み投稿収集', async () => {
      const mockService = require('@/lib/nostr/nostr-service').createNostrService();
      mockService.getApprovedUserDiscussions.mockResolvedValue([]);
      mockService.getProfile.mockResolvedValue(null);

      render(<DiscussionsPage />);

      // spec_v2.md要件確認: 管理者作成の Kind:34550 を使用して、承認済み投稿を集める
      await waitFor(() => {
        expect(mockService.getApprovedUserDiscussions).toHaveBeenCalledWith('admin-pubkey-hex');
      });
    });

    test('引用として含まれたユーザー作成Kind:34550へのリンクを一覧する', async () => {
      const mockService = require('@/lib/nostr/nostr-service').createNostrService();
      mockService.getApprovedDiscussionReferences.mockResolvedValue(mockApprovedReferences);
      mockService.getProfile.mockResolvedValue(null);

      render(<DiscussionsPage />);

      await waitFor(() => {
        // spec_v2.md要件: ユーザー作成の Kind:34550 へのリンクを一覧
        expect(screen.getByText('ユーザー会話α')).toBeInTheDocument();
        expect(screen.getByText('ユーザー会話β')).toBeInTheDocument();
      });

      // 引用リンクが正しくnaddr形式で作成されている
      const linkAlpha = screen.getByRole('link', { name: /ユーザー会話α/ });
      expect(linkAlpha).toHaveAttribute('href', '/discussions/naddr1discussion-alpha');

      const linkBeta = screen.getByRole('link', { name: /ユーザー会話β/ });
      expect(linkBeta).toHaveAttribute('href', '/discussions/naddr1discussion-beta');
    });
  });

  describe('spec_v2.md要件: NIP-18 q タグ引用システム', () => {
    test('NIP-18 q タグで引用されたKind:34550が正しく解析される', async () => {
      const mockService = require('@/lib/nostr/nostr-service').createNostrService();
      mockService.getApprovedDiscussionReferences.mockResolvedValue(mockApprovedReferences);
      mockService.getProfile.mockResolvedValue(null);

      render(<DiscussionsPage />);

      await waitFor(() => {
        // NIP-18 q タグの内容が正しく表示される
        expect(screen.getByText('ユーザー会話α')).toBeInTheDocument();
        expect(screen.getByText('ユーザー会話β')).toBeInTheDocument();
      });

      // q タグで引用された元イベントの情報が表示される
      expect(screen.getByText(/ユーザーが作成した会話α/)).toBeInTheDocument();
      expect(screen.getByText(/ユーザーが作成した会話β/)).toBeInTheDocument();
    });

    test('置換可能イベントの識別子形式が正しく処理される', async () => {
      const mockService = require('@/lib/nostr/nostr-service').createNostrService();
      mockService.getApprovedDiscussionReferences.mockResolvedValue(mockApprovedReferences);
      mockService.getProfile.mockResolvedValue(null);

      render(<DiscussionsPage />);

      await waitFor(() => {
        // spec_v2.md要件: 30023:f723...:abcd 形式の識別子が処理される
        // （テストデータでは 34550:user1-pubkey:discussion-alpha 形式）
        expect(mockService.getApprovedDiscussionReferences).toHaveBeenCalled();
      });

      // naddr形式でのリンクが生成されている
      const links = screen.getAllByRole('link');
      const discussionLinks = links.filter(link => 
        link.getAttribute('href')?.includes('/discussions/naddr1')
      );
      expect(discussionLinks.length).toBeGreaterThan(0);
    });
  });

  describe('監査ログの権限制御 - spec_v2.md要件', () => {
    test('管理者・モデレーターのみプロファイル名が表示される', async () => {
      const mockService = require('@/lib/nostr/nostr-service').createNostrService();
      mockService.getApprovedDiscussionReferences.mockResolvedValue(mockApprovedReferences);
      mockService.getProfile.mockResolvedValue({
        content: JSON.stringify({ name: '管理者名' }),
      });

      render(<DiscussionsPage />);

      // 監査ログタブに切り替え
      const auditTab = screen.getByRole('tab', { name: /監査ログ/ });
      expect(auditTab).toBeInTheDocument();

      // spec_v2.md要件: 管理者・モデレーターのプロファイルのみ取得
      await waitFor(() => {
        expect(mockService.getProfile).toHaveBeenCalledWith('admin-pubkey-hex');
      });
    });

    test('一般ユーザーはプロファイル非表示でバッジ表示', async () => {
      const mockService = require('@/lib/nostr/nostr-service').createNostrService();
      mockService.getApprovedDiscussionReferences.mockResolvedValue(mockApprovedReferences);
      mockService.getProfile.mockResolvedValue(null);

      render(<DiscussionsPage />);

      await waitFor(() => {
        // spec_v2.md要件: プロファイルは取得せず、「作成者」「モデレーター」のbadgeを表示
        // （一般ユーザーのプロファイルは取得しない）
        const userPubkeys = ['user1-pubkey', 'user2-pubkey'];
        userPubkeys.forEach(pubkey => {
          expect(mockService.getProfile).not.toHaveBeenCalledWith(pubkey);
        });
      });
    });
  });

  describe('UI表示要件', () => {
    test('承認済み会話一覧の基本表示', async () => {
      const mockService = require('@/lib/nostr/nostr-service').createNostrService();
      mockService.getApprovedDiscussionReferences.mockResolvedValue(mockApprovedReferences);
      mockService.getProfile.mockResolvedValue(null);

      render(<DiscussionsPage />);

      // 基本UI要素の確認
      expect(screen.getByText('意見交換')).toBeInTheDocument();
      expect(screen.getByText('会話一覧')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText('ユーザー会話α')).toBeInTheDocument();
        expect(screen.getByText('ユーザー会話β')).toBeInTheDocument();
      });
    });

    test('空の承認リストの表示', async () => {
      const mockService = require('@/lib/nostr/nostr-service').createNostrService();
      mockService.getApprovedDiscussionReferences.mockResolvedValue([]);
      mockService.getProfile.mockResolvedValue(null);

      render(<DiscussionsPage />);

      await waitFor(() => {
        expect(screen.getByText('会話がまだありません。')).toBeInTheDocument();
      });
    });
  });

  describe('「新しい会話をリクエスト」機能のオミット確認', () => {
    test('リクエスト機能が表示されない', async () => {
      const mockService = require('@/lib/nostr/nostr-service').createNostrService();
      mockService.getApprovedDiscussionReferences.mockResolvedValue(mockApprovedReferences);
      mockService.getProfile.mockResolvedValue(null);

      render(<DiscussionsPage />);

      await waitFor(() => {
        // spec_v2.md要件: 「新しい会話をリクエスト」機能は完全オミット
        expect(screen.queryByText('新しい会話をリクエスト')).not.toBeInTheDocument();
        expect(screen.queryByText('リクエストを送信')).not.toBeInTheDocument();
      });
    });

    test('リクエストフォームが存在しない', async () => {
      const mockService = require('@/lib/nostr/nostr-service').createNostrService();
      mockService.getApprovedDiscussionReferences.mockResolvedValue(mockApprovedReferences);
      mockService.getProfile.mockResolvedValue(null);

      render(<DiscussionsPage />);

      await waitFor(() => {
        // リクエスト関連のフォーム要素が存在しない
        expect(screen.queryByLabelText('タイトル')).not.toBeInTheDocument();
        expect(screen.queryByLabelText('説明')).not.toBeInTheDocument();
        expect(screen.queryByPlaceholderText('会話のタイトル')).not.toBeInTheDocument();
      });
    });
  });
});

/**
 * テスト結論: spec_v2.mdの最重要要件をテスト
 * 
 * ✅ テスト対象要件:
 * 1. 管理者作成のKind:34550による承認済み投稿収集
 * 2. NIP-18 q タグでの引用システム
 * 3. ユーザー作成Kind:34550へのリンク一覧
 * 4. 監査ログの権限制御（管理者・モデレーターのみプロファイル表示）
 * 5. 「新しい会話をリクエスト」機能の完全オミット
 * 
 * 🚨 現在の実装では失敗するテスト:
 * - getApprovedDiscussionReferences メソッドが未実装
 * - NIP-72承認システムが未実装
 * - リクエスト機能がまだ存在している
 */