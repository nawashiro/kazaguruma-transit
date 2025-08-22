/**
 * 会話作成画面のテスト
 * spec_v2.mdの要件に基づく
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import DiscussionCreatePage from '../page';

// モック設定
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
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
    publishSignedEvent: jest.fn(),
  })),
}));

jest.mock('@/lib/nostr/nostr-utils', () => ({
  getAdminPubkeyHex: () => 'admin-pubkey-hex',
  isValidNpub: (npub: string) => npub.startsWith('npub1'),
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
    pubkey: 'user-pubkey-hex',
  },
  signEvent: jest.fn(),
};

describe('DiscussionCreatePage', () => {
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

  describe('画面表示', () => {
    test('3ステップの説明が表示される', () => {
      render(<DiscussionCreatePage />);
      
      expect(screen.getByText(/作成すればURLが作られて、すぐに会話を始めることができます/)).toBeInTheDocument();
      expect(screen.getByText(/会話一覧への掲載は、少々お待ちください。担当者が確認します/)).toBeInTheDocument();
      expect(screen.getByText(/悪意のある書き込みを防ぐために、投稿を手作業で承認する必要があります/)).toBeInTheDocument();
    });

    test('会話作成フォームが表示される', () => {
      render(<DiscussionCreatePage />);
      
      expect(screen.getByLabelText('タイトル *')).toBeInTheDocument();
      expect(screen.getByLabelText('説明 *')).toBeInTheDocument();
      expect(screen.getByLabelText('モデレーター（任意）')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '会話を作成する' })).toBeInTheDocument();
    });

    test('戻るボタンが表示される', () => {
      render(<DiscussionCreatePage />);
      
      expect(screen.getByText('← 会話一覧に戻る')).toBeInTheDocument();
    });
  });

  describe('フォームバリデーション', () => {
    test('タイトルが空の場合エラーが表示される', async () => {
      render(<DiscussionCreatePage />);
      
      const createButton = screen.getByRole('button', { name: '会話を作成する' });
      fireEvent.click(createButton);
      
      await waitFor(() => {
        expect(screen.getByText('タイトルは必須です')).toBeInTheDocument();
      });
    });

    test('説明が空の場合エラーが表示される', async () => {
      render(<DiscussionCreatePage />);
      
      const titleInput = screen.getByLabelText('タイトル *');
      fireEvent.change(titleInput, { target: { value: 'テスト会話' } });
      
      const createButton = screen.getByRole('button', { name: '会話を作成する' });
      fireEvent.click(createButton);
      
      await waitFor(() => {
        expect(screen.getByText('説明は必須です')).toBeInTheDocument();
      });
    });

    test('タイトルが100文字を超える場合エラーが表示される', async () => {
      render(<DiscussionCreatePage />);
      
      const titleInput = screen.getByLabelText('タイトル *');
      const longTitle = 'a'.repeat(101);
      fireEvent.change(titleInput, { target: { value: longTitle } });
      
      const createButton = screen.getByRole('button', { name: '会話を作成する' });
      fireEvent.click(createButton);
      
      await waitFor(() => {
        expect(screen.getByText('タイトルは100文字以内で入力してください')).toBeInTheDocument();
      });
    });

    test('説明が500文字を超える場合エラーが表示される', async () => {
      render(<DiscussionCreatePage />);
      
      const titleInput = screen.getByLabelText('タイトル *');
      const descriptionInput = screen.getByLabelText('説明 *');
      const longDescription = 'a'.repeat(501);
      
      fireEvent.change(titleInput, { target: { value: 'テスト会話' } });
      fireEvent.change(descriptionInput, { target: { value: longDescription } });
      
      const createButton = screen.getByRole('button', { name: '会話を作成する' });
      fireEvent.click(createButton);
      
      await waitFor(() => {
        expect(screen.getByText('説明は500文字以内で入力してください')).toBeInTheDocument();
      });
    });

    test('無効なモデレーターIDの場合エラーが表示される', async () => {
      render(<DiscussionCreatePage />);
      
      const titleInput = screen.getByLabelText('タイトル *');
      const descriptionInput = screen.getByLabelText('説明 *');
      const moderatorInput = screen.getByLabelText('モデレーター（任意）');
      
      fireEvent.change(titleInput, { target: { value: 'テスト会話' } });
      fireEvent.change(descriptionInput, { target: { value: 'テスト説明' } });
      fireEvent.change(moderatorInput, { target: { value: 'invalid-npub' } });
      
      const createButton = screen.getByRole('button', { name: '会話を作成する' });
      fireEvent.click(createButton);
      
      await waitFor(() => {
        expect(screen.getByText('無効なモデレーターIDが含まれています')).toBeInTheDocument();
      });
    });
  });

  describe('会話作成フロー', () => {
    test('正常な会話作成が完了する', async () => {
      const mockSignEvent = jest.fn().mockResolvedValue({
        id: 'event-id',
        kind: 34550,
        pubkey: 'user-pubkey-hex',
        created_at: Math.floor(Date.now() / 1000),
        content: 'テスト説明',
        tags: [['d', 'test-discussion-id']],
        sig: 'signature',
      });
      
      (useAuth as jest.Mock).mockReturnValue({
        ...mockAuth,
        signEvent: mockSignEvent,
      });

      const { createNostrService } = require('@/lib/nostr/nostr-service');
      createNostrService().publishSignedEvent.mockResolvedValue(true);
      
      render(<DiscussionCreatePage />);
      
      const titleInput = screen.getByLabelText('タイトル *');
      const descriptionInput = screen.getByLabelText('説明 *');
      
      fireEvent.change(titleInput, { target: { value: 'テスト会話' } });
      fireEvent.change(descriptionInput, { target: { value: 'テスト説明' } });
      
      const createButton = screen.getByRole('button', { name: '会話を作成する' });
      fireEvent.click(createButton);
      
      await waitFor(() => {
        expect(screen.getByText('会話作成完了')).toBeInTheDocument();
      }, { timeout: 3000 });
      
      expect(mockSignEvent).toHaveBeenCalledTimes(2); // 会話作成 + 掲載リクエスト
    });

    test('ログインしていない場合はログインモーダルが表示される', () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: { isLoggedIn: false },
        signEvent: jest.fn(),
        login: jest.fn(),
        createAccount: jest.fn(),
        error: null,
      });
      
      render(<DiscussionCreatePage />);
      
      const createButton = screen.getByRole('button', { name: '会話を作成する' });
      fireEvent.click(createButton);
      
      expect(screen.getByText('アカウント作成')).toBeInTheDocument();
    });

    test('会話作成に失敗した場合エラーが表示される', async () => {
      const mockSignEvent = jest.fn().mockRejectedValue(new Error('署名失敗'));
      
      (useAuth as jest.Mock).mockReturnValue({
        ...mockAuth,
        signEvent: mockSignEvent,
      });
      
      render(<DiscussionCreatePage />);
      
      const titleInput = screen.getByLabelText('タイトル *');
      const descriptionInput = screen.getByLabelText('説明 *');
      
      fireEvent.change(titleInput, { target: { value: 'テスト会話' } });
      fireEvent.change(descriptionInput, { target: { value: 'テスト説明' } });
      
      const createButton = screen.getByRole('button', { name: '会話を作成する' });
      fireEvent.click(createButton);
      
      await waitFor(() => {
        expect(screen.getByText('イベントの署名に失敗しました')).toBeInTheDocument();
      });
    });
  });

  describe('ナビゲーション', () => {
    test('成功後に会話詳細画面へ遷移する', async () => {
      const mockSignEvent = jest.fn().mockResolvedValue({
        id: 'event-id',
        kind: 34550,
        pubkey: 'user-pubkey-hex',
        created_at: Math.floor(Date.now() / 1000),
        content: 'テスト説明',
        tags: [['d', 'test-discussion-id']],
        sig: 'signature',
      });
      
      (useAuth as jest.Mock).mockReturnValue({
        ...mockAuth,
        signEvent: mockSignEvent,
      });

      const { createNostrService } = require('@/lib/nostr/nostr-service');
      createNostrService().publishSignedEvent.mockResolvedValue(true);
      
      render(<DiscussionCreatePage />);
      
      const titleInput = screen.getByLabelText('タイトル *');
      const descriptionInput = screen.getByLabelText('説明 *');
      
      fireEvent.change(titleInput, { target: { value: 'テスト会話' } });
      fireEvent.change(descriptionInput, { target: { value: 'テスト説明' } });
      
      const createButton = screen.getByRole('button', { name: '会話を作成する' });
      fireEvent.click(createButton);
      
      await waitFor(() => {
        expect(screen.getByText('会話作成完了')).toBeInTheDocument();
      }, { timeout: 3000 });
      
      const goToDiscussionButton = screen.getByText('会話を開始する');
      fireEvent.click(goToDiscussionButton);
      
      expect(mockRouter.push).toHaveBeenCalledWith(expect.stringMatching(/^\/discussions\/naddr1/));
    });
  });

  describe('アクセシビリティ', () => {
    test('適切なaria-labelが設定されている', () => {
      render(<DiscussionCreatePage />);
      
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByLabelText('タイトル *')).toBeInTheDocument();
      expect(screen.getByLabelText('説明 *')).toBeInTheDocument();
      expect(screen.getByLabelText('モデレーター（任意）')).toBeInTheDocument();
    });

    test('フォーム送信中はボタンが無効化される', async () => {
      const mockSignEvent = jest.fn().mockImplementation(() => new Promise(resolve => {
        setTimeout(() => resolve({
          id: 'event-id',
          kind: 34550,
          pubkey: 'user-pubkey-hex',
          created_at: Math.floor(Date.now() / 1000),
          content: 'テスト説明',
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
      
      render(<DiscussionCreatePage />);
      
      const titleInput = screen.getByLabelText('タイトル *');
      const descriptionInput = screen.getByLabelText('説明 *');
      
      fireEvent.change(titleInput, { target: { value: 'テスト会話' } });
      fireEvent.change(descriptionInput, { target: { value: 'テスト説明' } });
      
      const createButton = screen.getByRole('button', { name: '会話を作成する' });
      fireEvent.click(createButton);
      
      expect(createButton).toBeDisabled();
      expect(screen.getByText('作成中...')).toBeInTheDocument();
    });
  });
});