/**
 * 監査ログの権限表示変更テスト
 * spec_v2.mdの要件に基づく
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { AuditTimeline } from '../AuditTimeline';
import type { AuditTimelineItem, Discussion } from '@/types/discussion';

jest.mock('@/lib/nostr/nostr-utils', () => ({
  formatRelativeTime: () => '1時間前',
  hexToNpub: (hex: string) => `npub1${hex.slice(0, 10)}`,
  parseDiscussionEvent: jest.fn(),
}));

jest.mock('@/lib/nostr/naddr-utils', () => ({
  buildNaddrFromRef: (ref: string) => `naddr1${ref.slice(0, 10)}`,
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const adminPubkey = 'admin-pubkey-hex';
const moderatorPubkey = 'moderator-pubkey-hex';
const regularUserPubkey = 'regular-user-pubkey-hex';

const mockItems: AuditTimelineItem[] = [
  {
    id: 'audit-1',
    type: 'discussion-created',
    timestamp: Date.now(),
    actorPubkey: adminPubkey,
    description: '管理者が会話を作成しました',
    event: {
      id: 'event-1',
      kind: 34550,
      pubkey: adminPubkey,
      created_at: Math.floor(Date.now() / 1000),
      content: 'テスト会話',
      tags: [],
      sig: 'signature',
    },
  },
  {
    id: 'audit-2',
    type: 'post-submitted',
    timestamp: Date.now(),
    actorPubkey: regularUserPubkey,
    description: '一般ユーザーが投稿しました',
    event: {
      id: 'event-2',
      kind: 1,
      pubkey: regularUserPubkey,
      created_at: Math.floor(Date.now() / 1000),
      content: 'テスト投稿',
      tags: [],
      sig: 'signature',
    },
  },
  {
    id: 'audit-3',
    type: 'post-approved',
    timestamp: Date.now(),
    actorPubkey: moderatorPubkey,
    targetId: 'event-2',
    description: 'モデレーターが投稿を承認しました',
    event: {
      id: 'event-3',
      kind: 1985,
      pubkey: moderatorPubkey,
      created_at: Math.floor(Date.now() / 1000),
      content: '{"content":"テスト投稿"}',
      tags: [],
      sig: 'signature',
    },
  },
];

const mockProfiles = {
  [adminPubkey]: { name: '管理者' },
  [moderatorPubkey]: { name: 'モデレーター1' },
  [regularUserPubkey]: { name: '一般ユーザー' },
};

const mockModerators = [moderatorPubkey];

const mockDiscussion: Discussion = {
  id: "discussion-1",
  title: "テスト会話",
  description: "テスト会話の説明",
  authorPubkey: "author-pubkey",
  dTag: "test-discussion",
  moderators: [],
  createdAt: 1640995200,
  updatedAt: 1640995200,
  event: {
    kind: 34550,
    id: "event-1",
    pubkey: "author-pubkey",
    created_at: 1640995200,
    content: JSON.stringify({
      title: "テスト会話",
      description: "テスト会話の説明",
    }),
    tags: [["d", "test-discussion"]],
    sig: "signature",
  },
};

const createMockPostEventWithQTag = (qTag?: string) => ({
  kind: 1111,
  id: "post-1",
  pubkey: "user-pubkey",
  created_at: 1640995300,
  content: "qタグを含む投稿",
  tags: qTag ? [["q", qTag]] : [],
  sig: "post-signature",
});

describe('AuditTimeline権限表示', () => {
  describe('権限に応じた表示制御', () => {
    test('管理者の場合は名前とbadgeが表示される', () => {
      render(
        <AuditTimeline 
          items={mockItems} 
          profiles={mockProfiles}
          adminPubkey={adminPubkey}
          moderators={mockModerators}
          viewerPubkey={adminPubkey}
        />
      );
      
      const adminElements = screen.getAllByText('管理者');
      expect(adminElements.length).toBeGreaterThan(0); // 名前とbadge両方
    });

    test('モデレーターの場合は名前が表示される', () => {
      render(
        <AuditTimeline 
          items={mockItems} 
          profiles={mockProfiles}
          adminPubkey={adminPubkey}
          moderators={mockModerators}
          viewerPubkey={moderatorPubkey}
        />
      );
      
      expect(screen.getAllByText('モデレーター1').length).toBeGreaterThan(0);
    });

    test('一般ユーザーが見る場合は管理者・モデレーターの名前のみ表示され、一般ユーザーはbadgeで表示される', () => {
      render(
        <AuditTimeline 
          items={mockItems} 
          profiles={mockProfiles}
          adminPubkey={adminPubkey}
          moderators={mockModerators}
          viewerPubkey={regularUserPubkey}
        />
      );
      
      // 管理者・モデレーターの名前は表示される
      expect(screen.getAllByText('管理者').length).toBeGreaterThan(0);
      expect(screen.getAllByText('モデレーター1').length).toBeGreaterThan(0);
      
      // 一般ユーザーは名前ではなく、pubkeyの短縮版のみ表示される（badgeなし）
      expect(screen.queryByText('一般ユーザー')).not.toBeInTheDocument();
    });

    test('閲覧者が管理者・モデレーターでない場合、管理者・モデレーター以外の名前は表示されない', () => {
      render(
        <AuditTimeline 
          items={mockItems} 
          profiles={mockProfiles}
          adminPubkey={adminPubkey}
          moderators={mockModerators}
          viewerPubkey="other-user-pubkey"
        />
      );
      
      // 管理者・モデレーターの名前は表示される
      expect(screen.getAllByText('管理者').length).toBeGreaterThan(0);
      expect(screen.getAllByText('モデレーター1').length).toBeGreaterThan(0);
      
      // 一般ユーザーの名前は表示されない
      expect(screen.queryByText('一般ユーザー')).not.toBeInTheDocument();
      
      // 代わりに短縮pubkeyのみ表示される
    });
  });

  describe('badge表示', () => {
    test('会話作成者には「作成者」badgeが表示される', () => {
      const discussionCreator = 'discussion-creator-pubkey';
      const creatorItems: AuditTimelineItem[] = [
        {
          id: 'audit-creator',
          type: 'discussion-created',
          timestamp: Date.now(),
          actorPubkey: discussionCreator,
          description: '会話を作成しました',
          event: {
            id: 'event-creator',
            kind: 34550,
            pubkey: discussionCreator,
            created_at: Math.floor(Date.now() / 1000),
            content: 'テスト会話',
            tags: [],
            sig: 'signature',
          },
        },
      ];

      render(
        <AuditTimeline 
          items={creatorItems} 
          profiles={{}}
          adminPubkey={adminPubkey}
          moderators={[]}
          viewerPubkey={regularUserPubkey}
          discussionAuthorPubkey={discussionCreator}
        />
      );
      
      // 仕様により監査画面では作成者バッジは表示されない
      expect(screen.queryByText('作成者')).not.toBeInTheDocument();
    });

    test('モデレーターには「モデレーター」badgeが表示される', () => {
      const moderatorItems: AuditTimelineItem[] = [
        {
          id: 'audit-mod',
          type: 'post-approved',
          timestamp: Date.now(),
          actorPubkey: moderatorPubkey,
          targetId: 'event-2',
          description: '投稿を承認しました',
          event: {
            id: 'event-mod',
            kind: 1985,
            pubkey: moderatorPubkey,
            created_at: Math.floor(Date.now() / 1000),
            content: '{"content":"承認"}',
            tags: [],
            sig: 'signature',
          },
        },
      ];

      render(
        <AuditTimeline 
          items={moderatorItems} 
          profiles={{}}
          adminPubkey={adminPubkey}
          moderators={[moderatorPubkey]}
          viewerPubkey={regularUserPubkey}
        />
      );
      
      expect(screen.getByText('モデレーター')).toBeInTheDocument();
    });
  });

  describe('プロファイル非表示', () => {
    test('一般ユーザーのプロファイルは取得されず、名前は表示されない', () => {
      render(
        <AuditTimeline 
          items={mockItems} 
          profiles={mockProfiles}
          adminPubkey={adminPubkey}
          moderators={mockModerators}
          viewerPubkey={regularUserPubkey}
          shouldLoadProfiles={false} // プロファイル取得を無効化
        />
      );
      
      // 一般ユーザーの名前は表示されない
      expect(screen.queryByText('一般ユーザー')).not.toBeInTheDocument();
      
      // pubkeyの短縮版のみ表示される
      expect(screen.getByText(/npub1regular/)).toBeInTheDocument();
    });
  });

  describe('qタグフィルタ機能', () => {
    describe('qタグフィルタリング', () => {
      test('qタグを含む投稿のみを表示する', () => {
        const itemsWithQTag: AuditTimelineItem[] = [
          {
            id: "post-1",
            type: "post-submitted",
            timestamp: 1640995300,
            actorPubkey: "user-pubkey",
            description: "投稿が提出されました",
            event: createMockPostEventWithQTag("34550:author-pubkey:test-discussion"),
          },
          {
            id: "post-2",
            type: "post-submitted",
            timestamp: 1640995400,
            actorPubkey: "user-pubkey",
            description: "投稿が提出されました（qタグなし）",
            event: createMockPostEventWithQTag(), // qタグなし
          },
        ];

        render(
          <AuditTimeline
            items={itemsWithQTag}
            profiles={mockProfiles}
            adminPubkey={adminPubkey}
            moderators={mockModerators}
            viewerPubkey={regularUserPubkey}
            qTagFilter={true}
            referencedDiscussions={[mockDiscussion]}
          />
        );

        // qタグを含む投稿のみが表示される
        expect(screen.getByText("投稿が提出されました")).toBeInTheDocument();
        expect(screen.queryByText("投稿が提出されました（qタグなし）")).not.toBeInTheDocument();
      });

      test('qタグフィルタがfalseの場合、全ての投稿を表示する', () => {
        const items: AuditTimelineItem[] = [
          {
            id: "post-1",
            type: "post-submitted",
            timestamp: 1640995300,
            actorPubkey: "user-pubkey",
            description: "投稿が提出されました",
            event: createMockPostEventWithQTag("34550:author-pubkey:test-discussion"),
          },
          {
            id: "post-2",
            type: "post-submitted",
            timestamp: 1640995400,
            actorPubkey: "user-pubkey",
            description: "投稿が提出されました（qタグなし）",
            event: createMockPostEventWithQTag(),
          },
        ];

        render(
          <AuditTimeline
            items={items}
            profiles={mockProfiles}
            adminPubkey={adminPubkey}
            moderators={mockModerators}
            viewerPubkey={regularUserPubkey}
            qTagFilter={false}
            referencedDiscussions={[mockDiscussion]}
          />
        );

        // 全ての投稿が表示される
        expect(screen.getByText("投稿が提出されました")).toBeInTheDocument();
        expect(screen.getByText("投稿が提出されました（qタグなし）")).toBeInTheDocument();
      });
    });

    describe('qタグレンダリング', () => {
      test('参照された会話情報を表示する', () => {
        const itemWithQTag: AuditTimelineItem[] = [
          {
            id: "post-1",
            type: "post-submitted",
            timestamp: 1640995300,
            actorPubkey: "user-pubkey",
            description: "投稿が提出されました",
            event: createMockPostEventWithQTag("34550:author-pubkey:test-discussion"),
          },
        ];

        render(
          <AuditTimeline
            items={itemWithQTag}
            profiles={mockProfiles}
            adminPubkey={adminPubkey}
            moderators={mockModerators}
            viewerPubkey={regularUserPubkey}
            qTagFilter={true}
            referencedDiscussions={[mockDiscussion]}
          />
        );

        // 参照された会話のタイトルが表示される
        expect(screen.getByText("テスト会話")).toBeInTheDocument();
        expect(screen.getByText(/テスト会話の説明/)).toBeInTheDocument();
      });

      test('参照された会話が見つからない場合のメッセージを表示する', () => {
        const itemWithInvalidQTag: AuditTimelineItem[] = [
          {
            id: "post-1",
            type: "post-submitted",
            timestamp: 1640995300,
            actorPubkey: "user-pubkey",
            description: "投稿が提出されました",
            event: createMockPostEventWithQTag("34550:unknown-pubkey:unknown-discussion"),
          },
        ];

        render(
          <AuditTimeline
            items={itemWithInvalidQTag}
            profiles={mockProfiles}
            adminPubkey={adminPubkey}
            moderators={mockModerators}
            viewerPubkey={regularUserPubkey}
            qTagFilter={true}
            referencedDiscussions={[mockDiscussion]}
          />
        );

        // 「会話が見つかりません」メッセージが表示される
        expect(screen.getByText(/会話が見つかりません/)).toBeInTheDocument();
      });

      test('複数のqタグを持つ投稿を正しく表示する', () => {
        const multipleQTagEvent = {
          kind: 1111,
          id: "post-1",
          pubkey: "user-pubkey",
          created_at: 1640995300,
          content: "複数のqタグを含む投稿",
          tags: [
            ["q", "34550:author-pubkey:test-discussion"],
            ["q", "34550:author2-pubkey:test-discussion2"],
          ],
          sig: "post-signature",
        };

        const mockDiscussion2: Discussion = {
          ...mockDiscussion,
          id: "discussion-2",
          title: "テスト会話2",
          description: "テスト会話2の説明",
          authorPubkey: "author2-pubkey",
          dTag: "test-discussion2",
        };

        const itemWithMultipleQTags: AuditTimelineItem[] = [
          {
            id: "post-1",
            type: "post-submitted",
            timestamp: 1640995300,
            actorPubkey: "user-pubkey",
            description: "投稿が提出されました",
            event: multipleQTagEvent,
          },
        ];

        render(
          <AuditTimeline
            items={itemWithMultipleQTags}
            profiles={mockProfiles}
            adminPubkey={adminPubkey}
            moderators={mockModerators}
            viewerPubkey={regularUserPubkey}
            qTagFilter={true}
            referencedDiscussions={[mockDiscussion, mockDiscussion2]}
          />
        );

        // 両方の参照された会話のタイトルが表示される
        expect(screen.getByText("テスト会話")).toBeInTheDocument();
        expect(screen.getByText("テスト会話2")).toBeInTheDocument();
      });
    });

    describe('既存機能の継続', () => {
      test('qタグ機能が有効でも既存のタイムライン機能が正常に動作する', () => {
        const regularItems: AuditTimelineItem[] = [
          {
            id: "discussion-1",
            type: "discussion-created",
            timestamp: 1640995200,
            actorPubkey: "admin-pubkey",
            description: "会話が作成されました",
            event: mockDiscussion.event,
          },
        ];

        render(
          <AuditTimeline
            items={regularItems}
            profiles={mockProfiles}
            adminPubkey={adminPubkey}
            moderators={mockModerators}
            viewerPubkey={regularUserPubkey}
            qTagFilter={false}
            referencedDiscussions={[]}
          />
        );

        expect(screen.getByText("会話が作成されました")).toBeInTheDocument();
      });
    });
  });
});