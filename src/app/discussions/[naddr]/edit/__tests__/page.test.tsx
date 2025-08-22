/**
 * 会話編集画面のテスト
 * spec_v2.mdの要件に基づく
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import DiscussionEditPage from '../page';

// モック設定
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useParams: jest.fn(() => ({ naddr: 'naddr1test123' })),
}));

jest.mock('@/lib/auth/auth-context', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/lib/config/discussion-config', () => ({
  isDiscussionsEnabled: () => true,
  getNostrServiceConfig: () => ({ relays: ['wss://test-relay.com'] }),
}));

jest.mock('@/lib/nostr/nostr-service', () => ({
  createNostrService: jest.fn(() => ({
    getDiscussions: jest.fn(),
    deleteEvent: jest.fn(),
    publishSignedEvent: jest.fn(),
  })),
}));

jest.mock('@/lib/nostr/nostr-utils', () => ({
  getAdminPubkeyHex: () => 'admin-pubkey-hex',
  isValidNpub: (npub: string) => npub.startsWith('npub1'),
  parseDiscussionEvent: jest.fn(),
}));

jest.mock('@/lib/nostr/naddr-utils', () => ({
  extractDiscussionFromNaddr: jest.fn(() => ({
    dTag: 'test-discussion-id',
    authorPubkey: 'test-author-pubkey',
    discussionId: '34550:test-author-pubkey:test-discussion-id',
  })),
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const mockRouter = {
  push: jest.fn(),
  back: jest.fn(),
  refresh: jest.fn(),
  prefetch: jest.fn(),
};

const mockAuth = {
  user: {
    isLoggedIn: true,
    pubkey: 'test-author-pubkey', // 作成者と同じpubkey
  },
  signEvent: jest.fn(),
};

const mockDiscussion = {
  id: '34550:test-author-pubkey:test-discussion-id',
  dTag: 'test-discussion-id',
  title: 'テスト会話',
  description: 'テスト説明',
  moderators: [],
  authorPubkey: 'test-author-pubkey',
  createdAt: 1640995200,
  event: {
    id: 'event-id',
    kind: 34550,
    pubkey: 'test-author-pubkey',
    created_at: 1640995200,
    content: 'テスト説明',
    tags: [['d', 'test-discussion-id']],
    sig: 'signature',
  },
};

describe('DiscussionEditPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useAuth as jest.Mock).mockReturnValue({
      ...mockAuth,
      login: jest.fn(),
      createAccount: jest.fn(),
      error: null,
    });
  });

  describe('権限チェック', () => {
    test('作成者でない場合はアクセス拒否メッセージが表示される', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        ...mockAuth,
        user: {
          isLoggedIn: true,
          pubkey: 'different-user-pubkey', // 作成者とは違うpubkey
        },
      });

      const { createNostrService } = require('@/lib/nostr/nostr-service');
      createNostrService().getDiscussions.mockResolvedValue([mockDiscussion.event]);

      const { parseDiscussionEvent } = require('@/lib/nostr/nostr-utils');
      parseDiscussionEvent.mockReturnValue(mockDiscussion);
      
      render(<DiscussionEditPage />);
      
      await waitFor(() => {
        expect(screen.getByText('この会話を編集する権限がありません')).toBeInTheDocument();
      });
    });

    test('作成者の場合は編集フォームが表示される', async () => {
      const { createNostrService } = require('@/lib/nostr/nostr-service');
      createNostrService().getDiscussions.mockResolvedValue([mockDiscussion.event]);

      const { parseDiscussionEvent } = require('@/lib/nostr/nostr-utils');
      parseDiscussionEvent.mockReturnValue(mockDiscussion);
      
      render(<DiscussionEditPage />);
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('テスト会話')).toBeInTheDocument();
        expect(screen.getByDisplayValue('テスト説明')).toBeInTheDocument();
      });
    });
  });

  describe('編集機能', () => {
    beforeEach(() => {
      const { createNostrService } = require('@/lib/nostr/nostr-service');
      createNostrService().getDiscussions.mockResolvedValue([mockDiscussion.event]);

      const { parseDiscussionEvent } = require('@/lib/nostr/nostr-utils');
      parseDiscussionEvent.mockReturnValue(mockDiscussion);
    });

    test('タイトルと説明を編集できる', async () => {
      render(<DiscussionEditPage />);
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('テスト会話')).toBeInTheDocument();
      });
      
      const titleInput = screen.getByDisplayValue('テスト会話');
      const descriptionInput = screen.getByDisplayValue('テスト説明');
      
      fireEvent.change(titleInput, { target: { value: '編集された会話' } });
      fireEvent.change(descriptionInput, { target: { value: '編集された説明' } });
      
      expect(screen.getByDisplayValue('編集された会話')).toBeInTheDocument();
      expect(screen.getByDisplayValue('編集された説明')).toBeInTheDocument();
    });

    test('変更を保存できる', async () => {
      const mockSignEvent = jest.fn().mockResolvedValue({
        id: 'updated-event-id',
        kind: 34550,
        pubkey: 'test-author-pubkey',
        created_at: Math.floor(Date.now() / 1000),
        content: '編集された説明',
        tags: [['d', 'test-discussion-id']],
        sig: 'signature',
      });
      
      (useAuth as jest.Mock).mockReturnValue({
        ...mockAuth,
        signEvent: mockSignEvent,
      });

      const { createNostrService } = require('@/lib/nostr/nostr-service');
      createNostrService().publishSignedEvent.mockResolvedValue(true);
      
      render(<DiscussionEditPage />);
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('テスト会話')).toBeInTheDocument();
      });
      
      const titleInput = screen.getByDisplayValue('テスト会話');
      const descriptionInput = screen.getByDisplayValue('テスト説明');
      
      fireEvent.change(titleInput, { target: { value: '編集された会話' } });
      fireEvent.change(descriptionInput, { target: { value: '編集された説明' } });
      
      const saveButton = screen.getByRole('button', { name: '変更を保存' });
      fireEvent.click(saveButton);
      
      await waitFor(() => {
        expect(screen.getByText('会話が更新されました')).toBeInTheDocument();
      });
      
      expect(mockSignEvent).toHaveBeenCalled();
    });

    test('会話を削除できる', async () => {
      const mockSignEvent = jest.fn().mockResolvedValue({
        id: 'delete-event-id',
        kind: 5,
        pubkey: 'test-author-pubkey',
        created_at: Math.floor(Date.now() / 1000),
        content: '',
        tags: [['e', mockDiscussion.event?.id || 'event-id']],
        sig: 'signature',
      });
      
      (useAuth as jest.Mock).mockReturnValue({
        ...mockAuth,
        signEvent: mockSignEvent,
      });

      const { createNostrService } = require('@/lib/nostr/nostr-service');
      createNostrService().publishSignedEvent.mockResolvedValue(true);
      
      render(<DiscussionEditPage />);
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('テスト会話')).toBeInTheDocument();
      });
      
      const deleteButton = screen.getByRole('button', { name: '会話を削除' });
      fireEvent.click(deleteButton);
      
      // 確認ダイアログ
      const confirmDeleteButton = screen.getByRole('button', { name: '削除する' });
      fireEvent.click(confirmDeleteButton);
      
      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/discussions');
      });
      
      expect(mockSignEvent).toHaveBeenCalled();
    });
  });

  describe('バリデーション', () => {
    beforeEach(() => {
      const { createNostrService } = require('@/lib/nostr/nostr-service');
      createNostrService().getDiscussions.mockResolvedValue([mockDiscussion.event]);

      const { parseDiscussionEvent } = require('@/lib/nostr/nostr-utils');
      parseDiscussionEvent.mockReturnValue(mockDiscussion);
    });

    test('タイトルが空の場合エラーが表示される', async () => {
      render(<DiscussionEditPage />);
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('テスト会話')).toBeInTheDocument();
      });
      
      const titleInput = screen.getByDisplayValue('テスト会話');
      fireEvent.change(titleInput, { target: { value: '' } });
      
      const saveButton = screen.getByRole('button', { name: '変更を保存' });
      fireEvent.click(saveButton);
      
      await waitFor(() => {
        expect(screen.getByText('タイトルは必須です')).toBeInTheDocument();
      });
    });

    test('説明が空の場合エラーが表示される', async () => {
      render(<DiscussionEditPage />);
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('テスト説明')).toBeInTheDocument();
      });
      
      const descriptionInput = screen.getByDisplayValue('テスト説明');
      fireEvent.change(descriptionInput, { target: { value: '' } });
      
      const saveButton = screen.getByRole('button', { name: '変更を保存' });
      fireEvent.click(saveButton);
      
      await waitFor(() => {
        expect(screen.getByText('説明は必須です')).toBeInTheDocument();
      });
    });
  });

  describe('アクセシビリティ', () => {
    beforeEach(() => {
      const { createNostrService } = require('@/lib/nostr/nostr-service');
      createNostrService().getDiscussions.mockResolvedValue([mockDiscussion.event]);

      const { parseDiscussionEvent } = require('@/lib/nostr/nostr-utils');
      parseDiscussionEvent.mockReturnValue(mockDiscussion);
    });

    test('適切なaria-labelが設定されている', async () => {
      render(<DiscussionEditPage />);
      
      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
        expect(screen.getByLabelText('タイトル *')).toBeInTheDocument();
        expect(screen.getByLabelText('説明 *')).toBeInTheDocument();
      });
    });

    test('保存中はボタンが無効化される', async () => {
      const mockSignEvent = jest.fn().mockImplementation(() => new Promise(resolve => {
        setTimeout(() => resolve({
          id: 'updated-event-id',
          kind: 34550,
          pubkey: 'test-author-pubkey',
          created_at: Math.floor(Date.now() / 1000),
          content: '編集された説明',
          tags: [['d', 'test-discussion-id']],
          sig: 'signature',
        }), 100);
      }));
      
      (useAuth as jest.Mock).mockReturnValue({
        ...mockAuth,
        signEvent: mockSignEvent,
      });

      const { createNostrService } = require('@/lib/nostr/nostr-service');
      createNostrService().publishSignedEvent.mockResolvedValue(true);
      
      render(<DiscussionEditPage />);
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('テスト会話')).toBeInTheDocument();
      });
      
      const saveButton = screen.getByRole('button', { name: '変更を保存' });
      fireEvent.click(saveButton);
      
      expect(saveButton).toBeDisabled();
      expect(screen.getByText('保存中...')).toBeInTheDocument();
    });
  });
});