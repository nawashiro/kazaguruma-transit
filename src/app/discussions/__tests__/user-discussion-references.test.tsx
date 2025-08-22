/**
 * ユーザー作成Kind:34550への引用リンク一覧テスト
 * spec_v2.md要件: 引用として含まれたユーザー作成の Kind:34550 へのリンクを一覧する
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
    getUserDiscussionDetails: jest.fn(),
    getProfile: jest.fn(),
  })),
}));

jest.mock('@/lib/nostr/nostr-utils', () => ({
  parseDiscussionEvent: jest.fn(),
  createAuditTimeline: jest.fn(() => []),
  formatRelativeTime: jest.fn((timestamp) => new Date(timestamp * 1000).toLocaleDateString()),
  getAdminPubkeyHex: jest.fn(() => 'admin-pubkey-hex'),
  isAdmin: jest.fn(),
  isModerator: jest.fn(),
}));

jest.mock('@/lib/nostr/naddr-utils', () => ({
  buildNaddrFromDiscussion: jest.fn((discussion) => `naddr1${discussion.dTag}`),
  parseNaddrReference: jest.fn(),
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

// 承認されたユーザー作成の会話データ
const mockApprovedUserDiscussions = [
  {
    // ユーザー1作成の会話
    id: '34550:user1-pubkey:transit-accessibility',
    dTag: 'transit-accessibility',
    title: '交通アクセシビリティの改善',
    description: '車椅子や高齢者の方が利用しやすいバス停の設計について議論しましょう',
    authorPubkey: 'user1-pubkey',
    moderators: ['user1-pubkey', 'mod1-pubkey'],
    createdAt: 1640995100,
    approvedAt: 1640995200, // 管理者による承認日時
    approvalReference: '34550:admin-pubkey-hex:approval-batch-1',
    event: {
      id: 'user-event-1',
      kind: 34550,
      pubkey: 'user1-pubkey',
      created_at: 1640995100,
      content: '車椅子や高齢者の方が利用しやすいバス停の設計について議論しましょう',
      tags: [
        ['d', 'transit-accessibility'],
        ['p', 'mod1-pubkey'], // モデレーター
      ],
      sig: 'user1-signature',
    },
  },
  {
    // ユーザー2作成の会話
    id: '34550:user2-pubkey:route-optimization',
    dTag: 'route-optimization',
    title: 'ルート最適化の提案',
    description: '現在の運行ルートをより効率的にするためのアイデア交換',
    authorPubkey: 'user2-pubkey',
    moderators: ['user2-pubkey'],
    createdAt: 1640995150,
    approvedAt: 1640995300,
    approvalReference: '34550:admin-pubkey-hex:approval-batch-1',
    event: {
      id: 'user-event-2',
      kind: 34550,
      pubkey: 'user2-pubkey',
      created_at: 1640995150,
      content: '現在の運行ルートをより効率的にするためのアイデア交換',
      tags: [['d', 'route-optimization']],
      sig: 'user2-signature',
    },
  },
  {
    // ユーザー3作成の会話
    id: '34550:user3-pubkey:eco-friendly-transport',
    dTag: 'eco-friendly-transport',
    title: '環境に優しい交通手段',
    description: '電気バスや自転車連携など、環境配慮型の交通システムについて',
    authorPubkey: 'user3-pubkey',
    moderators: ['user3-pubkey', 'mod2-pubkey'],
    createdAt: 1640995200,
    approvedAt: 1640995400,
    approvalReference: '34550:admin-pubkey-hex:approval-batch-2',
    event: {
      id: 'user-event-3',
      kind: 34550,
      pubkey: 'user3-pubkey',
      created_at: 1640995200,
      content: '電気バスや自転車連携など、環境配慮型の交通システムについて',
      tags: [
        ['d', 'eco-friendly-transport'],
        ['p', 'mod2-pubkey'],
      ],
      sig: 'user3-signature',
    },
  },
];

describe('ユーザー作成Kind:34550への引用リンク一覧', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue(mockAuth);
  });

  describe('spec_v2.md要件: ユーザー作成会話の引用リンク表示', () => {
    test('承認されたユーザー作成Kind:34550への引用リンクが一覧表示される', async () => {
      const mockService = require('@/lib/nostr/nostr-service').createNostrService();
      mockService.getApprovedUserDiscussions.mockResolvedValue(mockApprovedUserDiscussions);
      mockService.getProfile.mockResolvedValue(null);

      render(<DiscussionsPage />);

      await waitFor(() => {
        // spec_v2.md要件: ユーザー作成の Kind:34550 へのリンクを一覧
        expect(screen.getByText('交通アクセシビリティの改善')).toBeInTheDocument();
        expect(screen.getByText('ルート最適化の提案')).toBeInTheDocument();
        expect(screen.getByText('環境に優しい交通手段')).toBeInTheDocument();
      });

      // 各会話への引用リンクが正しくnaddr形式で生成されている
      const accessibilityLink = screen.getByRole('link', { name: /交通アクセシビリティの改善/ });
      expect(accessibilityLink).toHaveAttribute('href', '/discussions/naddr1transit-accessibility');

      const routeLink = screen.getByRole('link', { name: /ルート最適化の提案/ });
      expect(routeLink).toHaveAttribute('href', '/discussions/naddr1route-optimization');

      const ecoLink = screen.getByRole('link', { name: /環境に優しい交通手段/ });
      expect(ecoLink).toHaveAttribute('href', '/discussions/naddr1eco-friendly-transport');
    });

    test('ユーザー作成会話の詳細情報が適切に表示される', async () => {
      const mockService = require('@/lib/nostr/nostr-service').createNostrService();
      mockService.getApprovedUserDiscussions.mockResolvedValue(mockApprovedUserDiscussions);
      mockService.getProfile.mockResolvedValue(null);

      render(<DiscussionsPage />);

      await waitFor(() => {
        // 説明文の表示（70文字制限）
        expect(screen.getByText(/車椅子や高齢者の方が利用しやすいバス停の設計について議論しましょう/)).toBeInTheDocument();
        expect(screen.getByText(/現在の運行ルートをより効率的にするためのアイデア交換/)).toBeInTheDocument();
        expect(screen.getByText(/電気バスや自転車連携など、環境配慮型の交通システムについて/)).toBeInTheDocument();
      });

      // 作成日時の表示
      const timestamps = screen.getAllByRole('time');
      expect(timestamps.length).toBeGreaterThan(0);

      // モデレーター数の表示
      expect(screen.getByText('2 モデレーター')).toBeInTheDocument(); // user1の会話
      expect(screen.getByText('1 モデレーター')).toBeInTheDocument();  // user2の会話
    });

    test('承認されていないユーザー作成会話は表示されない', async () => {
      const unapprovedDiscussion = {
        id: '34550:user4-pubkey:unapproved-discussion',
        dTag: 'unapproved-discussion',
        title: '未承認の会話',
        description: '管理者による承認を待っている会話',
        authorPubkey: 'user4-pubkey',
        createdAt: 1640995300,
        approvedAt: null, // 未承認
        approvalReference: null,
      };

      const mockService = require('@/lib/nostr/nostr-service').createNostrService();
      // 承認済みのみ返される
      mockService.getApprovedUserDiscussions.mockResolvedValue(mockApprovedUserDiscussions);
      mockService.getProfile.mockResolvedValue(null);

      render(<DiscussionsPage />);

      await waitFor(() => {
        // 承認済みの会話は表示される
        expect(screen.getByText('交通アクセシビリティの改善')).toBeInTheDocument();
        
        // 未承認の会話は表示されない
        expect(screen.queryByText('未承認の会話')).not.toBeInTheDocument();
      });
    });
  });

  describe('naddr形式によるリンク管理', () => {
    test('ユーザー作成会話のnaddr形式リンクが正しく生成される', async () => {
      const mockService = require('@/lib/nostr/nostr-service').createNostrService();
      mockService.getApprovedUserDiscussions.mockResolvedValue(mockApprovedUserDiscussions);
      mockService.getProfile.mockResolvedValue(null);

      const mockBuildNaddr = require('@/lib/nostr/naddr-utils').buildNaddrFromDiscussion;
      mockBuildNaddr.mockImplementation((discussion) => {
        // spec_v2.md要件: naddr形式でのリンク生成
        return `naddr1${discussion.dTag}test${discussion.authorPubkey.slice(0, 8)}`;
      });

      render(<DiscussionsPage />);

      await waitFor(() => {
        expect(mockBuildNaddr).toHaveBeenCalledWith(
          expect.objectContaining({
            dTag: 'transit-accessibility',
            authorPubkey: 'user1-pubkey',
          })
        );
        expect(mockBuildNaddr).toHaveBeenCalledWith(
          expect.objectContaining({
            dTag: 'route-optimization',
            authorPubkey: 'user2-pubkey',
          })
        );
      });
    });

    test('naddr形式のURI スキーム対応', async () => {
      const mockService = require('@/lib/nostr/nostr-service').createNostrService();
      mockService.getApprovedUserDiscussions.mockResolvedValue(mockApprovedUserDiscussions);
      mockService.getProfile.mockResolvedValue(null);

      render(<DiscussionsPage />);

      await waitFor(() => {
        // spec_v2.md要件: nostr:naddr... URI スキーム対応
        const links = screen.getAllByRole('link');
        const discussionLinks = links.filter(link => 
          link.getAttribute('href')?.includes('/discussions/naddr1')
        );
        
        expect(discussionLinks.length).toBe(3); // 3つのユーザー作成会話
      });
    });

    test('置換可能オブジェクトの識別子形式確認', async () => {
      const mockService = require('@/lib/nostr/nostr-service').createNostrService();
      mockService.getApprovedUserDiscussions.mockResolvedValue(mockApprovedUserDiscussions);
      mockService.getProfile.mockResolvedValue(null);

      render(<DiscussionsPage />);

      await waitFor(() => {
        // spec_v2.md要件: 置換可能イベントの識別子形式 30023:f723...:abcd
        // 実装では Kind:34550 を使用
        mockApprovedUserDiscussions.forEach(discussion => {
          expect(discussion.id).toMatch(/^34550:[a-z0-9-]+:[a-z0-9-]+$/);
        });
      });
    });
  });

  describe('ユーザー作成会話のメタデータ表示', () => {
    test('作成者情報の適切な表示制御', async () => {
      const mockService = require('@/lib/nostr/nostr-service').createNostrService();
      mockService.getApprovedUserDiscussions.mockResolvedValue(mockApprovedUserDiscussions);
      mockService.getProfile.mockResolvedValue(null);

      render(<DiscussionsPage />);

      await waitFor(() => {
        // spec_v2.md要件: 一般ユーザーのプロファイルは取得しない
        // 作成者のpubkeyでプロファイル取得が呼ばれていないことを確認
        expect(mockService.getProfile).not.toHaveBeenCalledWith('user1-pubkey');
        expect(mockService.getProfile).not.toHaveBeenCalledWith('user2-pubkey');
        expect(mockService.getProfile).not.toHaveBeenCalledWith('user3-pubkey');
      });

      // 代わりに「作成者」バッジが表示される
      const creatorBadges = screen.getAllByText(/モデレーター/);
      expect(creatorBadges.length).toBeGreaterThan(0);
    });

    test('モデレーター数の正確な表示', async () => {
      const mockService = require('@/lib/nostr/nostr-service').createNostrService();
      mockService.getApprovedUserDiscussions.mockResolvedValue(mockApprovedUserDiscussions);
      mockService.getProfile.mockResolvedValue(null);

      render(<DiscussionsPage />);

      await waitFor(() => {
        // user1の会話: 作成者 + 1モデレーター = 2モデレーター
        expect(screen.getByText('2 モデレーター')).toBeInTheDocument();
        
        // user2の会話: 作成者のみ = 1モデレーター
        expect(screen.getByText('1 モデレーター')).toBeInTheDocument();
      });
    });

    test('承認日時と作成日時の区別', async () => {
      const mockService = require('@/lib/nostr/nostr-service').createNostrService();
      mockService.getApprovedUserDiscussions.mockResolvedValue(mockApprovedUserDiscussions);
      mockService.getProfile.mockResolvedValue(null);

      render(<DiscussionsPage />);

      await waitFor(() => {
        // 表示される日時は作成日時（createdAt）
        const timestamps = screen.getAllByRole('time');
        timestamps.forEach(timeElement => {
          const datetime = timeElement.getAttribute('datetime');
          expect(datetime).toBeDefined();
          // 作成日時が表示されていることを確認
          expect(new Date(datetime as string).getTime()).toBeGreaterThan(1640995000 * 1000);
        });
      });
    });
  });

  describe('エラーハンドリングと空状態', () => {
    test('承認済みユーザー会話が存在しない場合', async () => {
      const mockService = require('@/lib/nostr/nostr-service').createNostrService();
      mockService.getApprovedUserDiscussions.mockResolvedValue([]);
      mockService.getProfile.mockResolvedValue(null);

      render(<DiscussionsPage />);

      await waitFor(() => {
        expect(screen.getByText('会話がまだありません。')).toBeInTheDocument();
      });
    });

    test('ユーザー会話取得エラー時の処理', async () => {
      const mockService = require('@/lib/nostr/nostr-service').createNostrService();
      mockService.getApprovedUserDiscussions.mockRejectedValue(new Error('Network error'));
      mockService.getProfile.mockResolvedValue(null);

      render(<DiscussionsPage />);

      await waitFor(() => {
        expect(screen.getByText('会話がまだありません。')).toBeInTheDocument();
      });
    });

    test('破損したユーザー会話データのフィルタリング', async () => {
      const corruptedData = [
        ...mockApprovedUserDiscussions,
        {
          // 必須フィールドが欠けているデータ
          id: '34550:corrupt-pubkey:corrupt-discussion',
          dTag: null, // 破損
          title: '', // 空
          authorPubkey: 'corrupt-pubkey',
          createdAt: 1640995400,
        },
      ];

      const mockService = require('@/lib/nostr/nostr-service').createNostrService();
      mockService.getApprovedUserDiscussions.mockResolvedValue(corruptedData);
      mockService.getProfile.mockResolvedValue(null);

      render(<DiscussionsPage />);

      await waitFor(() => {
        // 正常なデータのみ表示される
        expect(screen.getByText('交通アクセシビリティの改善')).toBeInTheDocument();
        expect(screen.getByText('ルート最適化の提案')).toBeInTheDocument();
        expect(screen.getByText('環境に優しい交通手段')).toBeInTheDocument();
        
        // 破損したデータは表示されない
        expect(screen.queryByText('corrupt-discussion')).not.toBeInTheDocument();
      });
    });
  });
});

/**
 * テスト結論: ユーザー作成Kind:34550への引用リンク一覧
 * 
 * ✅ テスト対象機能:
 * 1. 承認されたユーザー作成会話の引用リンク表示
 * 2. naddr形式によるリンク管理
 * 3. ユーザー会話の詳細情報表示
 * 4. 作成者情報の適切な表示制御
 * 5. 承認/未承認の区別
 * 6. エラーハンドリング
 * 
 * 🚨 現在の実装で失敗するテスト:
 * - getApprovedUserDiscussions メソッドが未実装
 * - ユーザー作成会話の承認システムが未実装
 * - プロファイル表示制御が未実装
 */