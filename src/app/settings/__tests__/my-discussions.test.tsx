/**
 * 設定画面の自作会話一覧機能テスト
 * spec_v2.mdの要件に基づく
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useAuth } from '@/lib/auth/auth-context';
import SettingsPage from '../page';

jest.mock('@/lib/auth/auth-context', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/lib/config/discussion-config', () => ({
  isDiscussionsEnabled: () => true,
  getNostrServiceConfig: () => ({ relays: ['wss://test-relay.com'] }),
}));

jest.mock('@/lib/nostr/nostr-service', () => ({
  createNostrService: jest.fn(() => ({
    getDiscussions: jest.fn().mockResolvedValue([]),
    publishSignedEvent: jest.fn().mockResolvedValue(true),
  })),
}));

jest.mock('@/lib/nostr/nostr-utils', () => ({
  hexToNpub: (hex: string) => `npub1${hex.slice(0, 10)}`,
  parseDiscussionEvent: jest.fn(),
  formatRelativeTime: jest.fn((timestamp) => new Date(timestamp * 1000).toLocaleDateString()),
}));

jest.mock('@/lib/nostr/naddr-utils', () => ({
  buildNaddrFromDiscussion: (discussion: any) => `naddr1${discussion.dTag}`,
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
  logout: jest.fn(),
  isLoading: false,
  error: null,
};

const mockUserDiscussions = [
  {
    id: '34550:user-pubkey-hex:discussion-1',
    dTag: 'discussion-1',
    title: '私の会話1',
    description: '説明1',
    moderators: [],
    authorPubkey: 'user-pubkey-hex',
    createdAt: 1640995200,
    event: {
      id: 'event-1',
      kind: 34550,
      pubkey: 'user-pubkey-hex',
      created_at: 1640995200,
      content: '説明1',
      tags: [['d', 'discussion-1']],
      sig: 'signature',
    },
  },
  {
    id: '34550:user-pubkey-hex:discussion-2',
    dTag: 'discussion-2',
    title: '私の会話2',
    description: '説明2',
    moderators: [],
    authorPubkey: 'user-pubkey-hex',
    createdAt: 1640995300,
    event: {
      id: 'event-2',
      kind: 34550,
      pubkey: 'user-pubkey-hex',
      created_at: 1640995300,
      content: '説明2',
      tags: [['d', 'discussion-2']],
      sig: 'signature',
    },
  },
];

describe('設定画面 - 自作会話一覧', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue(mockAuth);
  });

  describe('spec_v2.md要件確認', () => {
    test('自作会話一覧セクションが実装されている', () => {
      render(<SettingsPage />);
      
      // spec_v2.md要件: 自分が作成した会話の一覧が表示される
      expect(screen.getByText('自作会話一覧')).toBeInTheDocument();
    });

    test('既存の実装に追加されている', () => {
      render(<SettingsPage />);
      
      // spec_v2.md要件: 既存の実装に追加する
      expect(screen.getByText('設定')).toBeInTheDocument();
      expect(screen.getByText('アカウント情報')).toBeInTheDocument();
      expect(screen.getByText('自作会話一覧')).toBeInTheDocument();
    });

  });

  describe('アクセス制御', () => {
    test('ログインしていない場合は自作会話セクションが表示されない', () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: { isLoggedIn: false },
        logout: jest.fn(),
        isLoading: false,
        error: null,
      });
      
      render(<SettingsPage />);
      
      expect(screen.queryByText('自作会話一覧')).not.toBeInTheDocument();
    });
  });
});